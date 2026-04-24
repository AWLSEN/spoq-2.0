import { NextRequest } from "next/server";
import { getSandbox } from "@/lib/sandbox";
import { parseCapabilityTokens } from "@/lib/capabilities/parser";
import { buildSystemPreamble } from "@/lib/capabilities/preamble";
import {
  CapabilityState,
  DEFAULT_CAPABILITY_STATE,
} from "@/lib/capabilities/types";
import {
  ConversationMessage,
  flattenConversation,
} from "@/lib/agent/conversation";
import { buildMcpServersForUser } from "@/lib/composio/session";

export const runtime = "nodejs";

interface ChatRequest {
  // Full conversation history from the client (includes the new user turn).
  messages: ConversationMessage[];
  // Client-tracked ephemeral capability state.
  capabilities?: CapabilityState;
  // Stable per-browser id; used as Composio user_id for MCP + OAuth.
  user_id?: string;
}

/**
 * Streams Claude Code + GLM output as SSE, extracting JIT capability
 * requests (<<SPOQ-NEED .../>>) and emitting them as dedicated events.
 *
 * Event kinds:
 *   { kind: "stdout_clean", chunk: string }   — user-visible text
 *   { kind: "capability_request", request: { kind, reason } }
 *   { kind: "done", exitCode, durationMs }
 *   { kind: "error", message }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<ChatRequest>;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return new Response(JSON.stringify({ error: "no user message" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const capState: CapabilityState = {
    ...DEFAULT_CAPABILITY_STATE,
    ...(body.capabilities ?? {}),
  };

  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const prompt = flattenConversation(messages);
  const preamble = buildSystemPreamble(capState);
  const mcpServers = await buildMcpServersForUser(userId, capState);

  const sandbox = getSandbox();
  const encoder = new TextEncoder();

  const runId = Math.random().toString(36).slice(2, 8);
  const runStart = Date.now();
  const logTag = `[chat ${runId}]`;
  const lastUser = messages[messages.length - 1]?.text ?? "";
  const connectedSlugs = Object.entries(capState)
    .filter(([, s]) => s.state === "connected")
    .map(([k]) => k);
  console.log(
    `${logTag} start user_id=${userId || "-"} caps=[${connectedSlugs.join(
      ","
    )}] mcp=${mcpServers.length} msg=${JSON.stringify(
      lastUser.slice(0, 160)
    )}${lastUser.length > 160 ? "…" : ""}`
  );

  const stream = new ReadableStream({
    async start(controller) {
      // Buffer stdout across chunks so capability tokens that span chunk
      // boundaries are still detected. Flush clean text up to the last
      // safe boundary on each chunk.
      let buffer = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const capabilityKinds: string[] = [];
      const send = (ev: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));

      try {
        for await (const ev of sandbox.run(prompt, {
          appendSystemPrompt: preamble,
          mcpServers,
        })) {
          if (ev.kind === "stdout") {
            buffer += ev.chunk;
            stdoutBytes += ev.chunk.length;
            // Find the last position safe to flush (i.e. we're sure no partial
            // token straddles the split). Be conservative: flush everything
            // up to the most recent "<<" that could start a token. If no
            // "<<" in the last 80 chars, flush all.
            const cutIdx = buffer.lastIndexOf("<<");
            let flushable: string;
            if (cutIdx === -1 || buffer.length - cutIdx > 200) {
              // no partial token pending → flush everything, parse tokens
              flushable = buffer;
              buffer = "";
            } else {
              flushable = buffer.slice(0, cutIdx);
              buffer = buffer.slice(cutIdx);
            }
            if (flushable) {
              const { clean, requests } = parseCapabilityTokens(flushable);
              if (clean) send({ kind: "stdout_clean", chunk: clean });
              for (const request of requests) {
                capabilityKinds.push(request.kind);
                console.log(
                  `${logTag} capability_request kind=${request.kind} reason=${JSON.stringify(request.reason)}`
                );
                send({ kind: "capability_request", request });
              }
            }
          } else if (ev.kind === "stderr") {
            stderrBytes += ev.chunk.length;
            // log sandbox stderr server-side so we keep a record even
            // though we also forward it to the client
            console.warn(`${logTag} stderr ${JSON.stringify(ev.chunk.slice(0, 500))}`);
            send({ kind: "stderr", chunk: ev.chunk });
          } else if (ev.kind === "done") {
            // final flush
            const { clean, requests } = parseCapabilityTokens(buffer);
            buffer = "";
            if (clean) send({ kind: "stdout_clean", chunk: clean });
            for (const request of requests) {
              capabilityKinds.push(request.kind);
              console.log(
                `${logTag} capability_request kind=${request.kind} reason=${JSON.stringify(request.reason)} (trailing)`
              );
              send({ kind: "capability_request", request });
            }
            console.log(
              `${logTag} done exit=${ev.exitCode} sandboxMs=${ev.durationMs} totalMs=${Date.now() - runStart} stdout=${stdoutBytes}b stderr=${stderrBytes}b caps=[${capabilityKinds.join(",")}]`
            );
            send({ kind: "done", exitCode: ev.exitCode, durationMs: ev.durationMs });
          } else if (ev.kind === "error") {
            console.error(`${logTag} error message=${JSON.stringify(ev.message)}`);
            send({ kind: "error", message: ev.message });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        console.error(`${logTag} exception`, err);
        send({ kind: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
