import { NextRequest, NextResponse } from "next/server";
import { getComposio } from "@/lib/composio/client";
import { toolkitFor } from "@/lib/composio/toolkits";
import { CapabilityKind } from "@/lib/capabilities/types";

export const runtime = "nodejs";

/**
 * Opened in a popup by the JITResource Connect button.
 *   /api/oauth/start?kind=email.send&user_id=<sess>
 *
 * Calls composio.toolkits.authorize(user_id, toolkitSlug) which returns a
 * ConnectionRequest with a redirectUrl pointing at the toolkit's OAuth
 * consent page. We 302 the popup to that URL. After consent Composio
 * finishes the handshake and redirects back to our /api/oauth/callback.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as CapabilityKind | null;
  const userId = url.searchParams.get("user_id");

  if (!kind || !userId) {
    return errorPage("missing kind or user_id");
  }
  const toolkit = toolkitFor(kind);
  if (!toolkit) {
    return errorPage(`no toolkit mapped for capability "${kind}"`);
  }

  try {
    const composio = getComposio();
    const conn = await composio.toolkits.authorize(userId, toolkit);
    if (!conn.redirectUrl) {
      return errorPage(
        `composio did not return an OAuth redirect URL for ${toolkit}`
      );
    }
    return NextResponse.redirect(conn.redirectUrl, { status: 302 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorPage(`composio authorize failed: ${msg}`);
  }
}

function errorPage(message: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>connection error</title>
     <style>body{font-family:system-ui;padding:2rem;background:#fffaf0;color:#1a1a1a}</style>
     <h1 style="font-weight:400">couldn't start connection</h1>
     <p style="color:#6b645a">${escapeHtml(message)}</p>
     <script>
       window.opener && window.opener.postMessage(
         { source: "spoq-oauth", ok: false, error: ${JSON.stringify(message)} },
         window.location.origin
       );
     </script>`,
    { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
