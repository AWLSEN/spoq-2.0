import { NextRequest } from "next/server";
import { getSandbox } from "@/lib/sandbox";

export const runtime = "nodejs";

/**
 * Phase 2: stream Claude Code + GLM sandbox stdout as SSE.
 * Body: { message: string }
 * Response: text/event-stream with events:
 *   data: { "kind": "stdout", "chunk": "..." }
 *   data: { "kind": "stderr", "chunk": "..." }
 *   data: { "kind": "done", "exitCode": 0, "durationMs": 12345 }
 *   data: { "kind": "error", "message": "..." }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message: string = typeof body?.message === "string" ? body.message : "";
  if (!message.trim()) {
    return new Response(JSON.stringify({ error: "empty message" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const sandbox = getSandbox();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of sandbox.run(message)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ kind: "error", message: msg })}\n\n`
          )
        );
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
