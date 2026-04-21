"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "agent"; text: string };

export default function ChatSession() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (q && !startedRef.current) {
      startedRef.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function send(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setRunning(true);
    // Phase 2 wires this to /api/chat. For Phase 1 we stub to prove the UI shell.
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "agent", text: data.reply ?? "(no reply)" }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", text: "Something went wrong. Try again in a moment." },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <a href="/" className="text-sm text-[#6b645a] hover:text-[#1a1a1a] transition-colors w-fit">
          ← new
        </a>

        <div className="flex-1 flex flex-col gap-6">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "self-end max-w-[85%] rounded-2xl bg-[#1a1a1a] px-4 py-3 text-white"
                  : "self-start max-w-[90%] rounded-2xl bg-white border border-[#e7e1d5] px-4 py-3 text-[#1a1a1a] whitespace-pre-wrap"
              }
            >
              {m.text}
            </div>
          ))}
          {running && (
            <div className="self-start text-sm text-[#6b645a] italic">thinking…</div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || running) return;
            send(input);
          }}
          className="flex gap-2 rounded-full border border-[#e7e1d5] bg-white px-4 py-2 focus-within:border-[#1a1a1a]"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="say more…"
            className="flex-1 bg-transparent outline-none text-[#1a1a1a] placeholder-[#a39e93]"
          />
          <button
            type="submit"
            disabled={!input.trim() || running}
            className="rounded-full bg-[#1a1a1a] px-4 py-1 text-sm text-white disabled:bg-[#cfc9bd]"
          >
            send
          </button>
        </form>
      </div>
    </main>
  );
}
