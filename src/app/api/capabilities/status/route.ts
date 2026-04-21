import { NextRequest } from "next/server";
import { getComposio } from "@/lib/composio/client";
import { toolkitFor } from "@/lib/composio/toolkits";
import { CapabilityKind } from "@/lib/capabilities/types";

export const runtime = "nodejs";

/**
 * Poll endpoint: GET /api/capabilities/status?user_id=<sess>&kind=email.send
 * Returns { connected: boolean, label?: string }.
 * The portal polls this after opening an OAuth popup to know when the
 * handshake finished, without needing a postMessage from Composio's
 * success page (managed auth owns that redirect).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as CapabilityKind | null;
  const userId = url.searchParams.get("user_id");
  if (!kind || !userId) {
    return json({ error: "missing kind or user_id" }, 400);
  }
  const toolkit = toolkitFor(kind);
  if (!toolkit) {
    return json({ connected: false, reason: "no toolkit mapped" });
  }

  try {
    const composio = getComposio();
    const list = await composio.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [toolkit],
    });
    const active = list.items?.find((a) => a.status === "ACTIVE");
    if (!active) return json({ connected: false });

    const label =
      pickLabel(active) ?? `connected ${toolkit}`;
    return json({ connected: true, label, id: active.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ connected: false, error: msg }, 200);
  }
}

function pickLabel(acct: { data?: unknown; params?: unknown }): string | null {
  const poke = (obj: unknown): string | null => {
    if (!obj || typeof obj !== "object") return null;
    const rec = obj as Record<string, unknown>;
    for (const key of ["email", "user_email", "account_email", "userEmail", "login", "username"]) {
      const v = rec[key];
      if (typeof v === "string" && v.includes("@")) return v;
      if (typeof v === "string" && v.length > 0) return v;
    }
    return null;
  };
  return poke(acct.data) ?? poke(acct.params);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
