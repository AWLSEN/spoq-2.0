"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "agent"; text: string; done?: boolean };

export default function ChatSession() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q && !startedRef.current) {
      startedRef.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    setMessages((m) => [...m, { role: "user", text }, { role: "agent", text: "" }]);
    setInput("");
    setRunning(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`http ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.kind === "stdout") {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last.role === "agent") last.text += ev.chunk;
                return copy;
              });
            } else if (ev.kind === "error") {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last.role === "agent") last.text += `\n\n[error: ${ev.message}]`;
                return copy;
              });
            }
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last.role === "agent") last.text += `\n\n[error: ${msg}]`;
        return copy;
      });
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
                  ? "self-end max-w-[85%] rounded-2xl bg-[#1a1a1a] px-4 py-3 text-white whitespace-pre-wrap"
                  : "self-start max-w-[90%] rounded-2xl bg-white border border-[#e7e1d5] px-4 py-3 text-[#1a1a1a] whitespace-pre-wrap"
              }
            >
              {m.text || (m.role === "agent" && running ? "thinking…" : "")}
            </div>
          ))}
          <div ref={scrollRef} />
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
            placeholder={running ? "agent is thinking…" : "say more…"}
            disabled={running}
            className="flex-1 bg-transparent outline-none text-[#1a1a1a] placeholder-[#a39e93] disabled:opacity-50"
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
