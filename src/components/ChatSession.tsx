"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import JITResource from "./JITResource";
import {
  connectCapability,
  getUserId,
} from "@/lib/capabilities/client-connect";
import {
  CapabilityKind,
  CapabilityRequest,
  CapabilityState,
  DEFAULT_CAPABILITY_STATE,
} from "@/lib/capabilities/types";

type Item =
  | { kind: "user"; text: string; hidden?: boolean }
  | { kind: "agent"; text: string }
  | { kind: "capability"; request: CapabilityRequest; resolved?: "connected" | "skipped" };

export default function ChatSession() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [caps, setCaps] = useState<CapabilityState>(DEFAULT_CAPABILITY_STATE);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed caps from Composio on mount so reloads don't re-ask for OAuth.
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    fetch(`/api/capabilities/seed?user_id=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d: { caps?: CapabilityState }) => {
        if (d.caps && Object.keys(d.caps).length > 0) setCaps(d.caps);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (q && !startedRef.current) {
      startedRef.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  function conversationForApi(upToUserText: string) {
    const history: { role: "user" | "agent"; text: string }[] = [];
    for (const it of items) {
      if (it.kind === "user") history.push({ role: "user", text: it.text });
      else if (it.kind === "agent" && it.text.trim())
        history.push({ role: "agent", text: it.text });
    }
    history.push({ role: "user", text: upToUserText });
    return history;
  }

  async function send(
    text: string,
    capsOverride?: CapabilityState,
    opts?: { hidden?: boolean }
  ) {
    const activeCaps = capsOverride ?? caps;
    const messagesForApi = conversationForApi(text);
    setItems((prev) => [
      ...prev,
      { kind: "user", text, hidden: opts?.hidden },
      { kind: "agent", text: "" },
    ]);
    setInput("");
    setRunning(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          capabilities: activeCaps,
          user_id: getUserId(),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`http ${res.status}`);

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
            if (ev.kind === "stdout_clean") {
              setItems((prev) => {
                const last = prev[prev.length - 1];
                if (!last || last.kind !== "agent") return prev;
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + ev.chunk },
                ];
              });
            } else if (ev.kind === "capability_request") {
              setItems((prev) => [...prev, { kind: "capability", request: ev.request }]);
            } else if (ev.kind === "error") {
              setItems((prev) => {
                const last = prev[prev.length - 1];
                if (!last || last.kind !== "agent") return prev;
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + `\n\n[error: ${ev.message}]` },
                ];
              });
            }
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setItems((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.kind !== "agent") return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + `\n\n[error: ${msg}]` },
        ];
      });
    } finally {
      setRunning(false);
    }
  }

  function markCapabilityResolved(index: number, resolved: "connected" | "skipped") {
    setItems((prev) => {
      const copy = [...prev];
      const it = copy[index];
      if (it && it.kind === "capability") copy[index] = { ...it, resolved };
      return copy;
    });
  }

  async function connect(index: number, kind: CapabilityKind) {
    try {
      const { label } = await connectCapability(kind);
      const nextCaps: CapabilityState = {
        ...caps,
        [kind]: { state: "connected" as const, label },
      };
      setCaps(nextCaps);
      markCapabilityResolved(index, "connected");
      send(
        `Connected: ${kind} as ${label}. Continue the task without commentary.`,
        nextCaps,
        { hidden: true }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setItems((prev) => {
        const copy = [...prev];
        copy.push({
          kind: "agent",
          text: `[connection failed: ${msg}]`,
        });
        return copy;
      });
    }
  }

  function skip(index: number, kind: CapabilityKind) {
    const nextCaps: CapabilityState = {
      ...caps,
      [kind]: { state: "declined" as const },
    };
    setCaps(nextCaps);
    markCapabilityResolved(index, "skipped");
    send(
      `Declined: ${kind}. Continue without it, or finish with a draft the user can send manually.`,
      nextCaps,
      { hidden: true }
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <a
          href="/"
          className="text-sm text-[#6b645a] hover:text-[#1a1a1a] transition-colors w-fit"
        >
          ← new
        </a>

        <div className="flex-1 flex flex-col gap-4">
          {items.map((it, i) => {
            if (it.kind === "user") {
              if (it.hidden) return null;
              return (
                <div
                  key={i}
                  className="self-end max-w-[85%] rounded-2xl bg-[#1a1a1a] px-4 py-3 text-white whitespace-pre-wrap"
                >
                  {it.text}
                </div>
              );
            }
            if (it.kind === "agent") {
              return (
                <div
                  key={i}
                  className="self-start max-w-[90%] rounded-2xl bg-white border border-[#e7e1d5] px-4 py-3 text-[#1a1a1a] whitespace-pre-wrap"
                >
                  {it.text || (running && i === items.length - 1 ? "thinking…" : "")}
                </div>
              );
            }
            if (it.resolved === "connected") {
              return (
                <div
                  key={i}
                  className="self-stretch text-xs text-[#6b645a] italic px-2"
                >
                  connected {it.request.kind}
                </div>
              );
            }
            if (it.resolved === "skipped") {
              return (
                <div
                  key={i}
                  className="self-stretch text-xs text-[#6b645a] italic px-2"
                >
                  skipped {it.request.kind}
                </div>
              );
            }
            return (
              <JITResource
                key={i}
                request={it.request}
                onConnect={() => connect(i, it.request.kind)}
                onSkip={() => skip(i, it.request.kind)}
                busy={running}
              />
            );
          })}
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
