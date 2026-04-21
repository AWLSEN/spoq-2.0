import { getDevComputer } from "@/lib/orb/provision";
import {
  DEFAULT_TIMEOUT_MS,
  Sandbox,
  SandboxEvent,
  SandboxRunOptions,
} from "./types";

/**
 * Forwards a chat run to Sam's single dev Orb computer. The payload
 * (agent-wrapper/server.js) accepts POST /run and streams SSE events
 * whose shape mirrors SandboxEvent — so this driver is a thin passthrough.
 */
class OrbSandbox implements Sandbox {
  async *run(
    prompt: string,
    opts?: SandboxRunOptions
  ): AsyncGenerator<SandboxEvent> {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const started = Date.now();

    let computer: { id: string; url: string };
    try {
      computer = await getDevComputer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { kind: "error", message: `orb provision failed: ${msg}` };
      yield { kind: "done", exitCode: -1, durationMs: Date.now() - started };
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${computer.url}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          appendSystemPrompt: opts?.appendSystemPrompt ?? "",
          mcpServers: opts?.mcpServers ?? [],
          timeoutMs,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      yield { kind: "error", message: `orb fetch failed: ${msg}` };
      yield { kind: "done", exitCode: -1, durationMs: Date.now() - started };
      return;
    }

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const text = await res.text().catch(() => "");
      yield {
        kind: "error",
        message: `orb ${res.status}: ${text.slice(0, 200)}`,
      };
      yield { kind: "done", exitCode: -1, durationMs: Date.now() - started };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
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
            const ev = JSON.parse(payload) as SandboxEvent;
            yield ev;
            if (ev.kind === "done") return;
          } catch {
            // skip malformed frame
          }
        }
      }
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }

    yield { kind: "done", exitCode: 0, durationMs: Date.now() - started };
  }
}

export const orbSandbox = new OrbSandbox();
