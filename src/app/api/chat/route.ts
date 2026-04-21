import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Phase 1 stub. Phase 2 will:
 *  - spin up an Orb sandbox (or reuse a warm one from the anonymous pool)
 *  - exec `claude -p <message> --dangerously-skip-permissions` with GLM env
 *  - stream stdout back as SSE
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message: string = body?.message ?? "";
  if (!message.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  return NextResponse.json({
    reply:
      "I hear you — the agent isn't wired up yet in this phase. " +
      `Your message: "${message}". ` +
      "Phase 2 will run this in a real sandbox.",
  });
}
