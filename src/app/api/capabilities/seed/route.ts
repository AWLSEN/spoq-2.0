import { NextRequest } from "next/server";
import { getComposio, hasComposioKey } from "@/lib/composio/client";
import { CapabilityState } from "@/lib/capabilities/types";

export const runtime = "nodejs";

/**
 * Seed endpoint. Called once per page load by the chat UI to rebuild the
 * capability state from Composio's server-side truth, so a reload never
 * forces the user to re-OAuth a service they already connected.
 *
 *   GET /api/capabilities/seed?user_id=<sess>
 *   → { caps: CapabilityState }
 *
 * Returns an empty object if Composio isn't configured, or on any error
 * (we degrade silently; the agent will just re-ask if needed).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return json({ caps: {} });
  if (!hasComposioKey()) return json({ caps: {} });

  try {
    const composio = getComposio();
    const list = await composio.connectedAccounts.list({
      userIds: [userId],
    });
    const caps: CapabilityState = {};
    for (const acct of list.items ?? []) {
      if (acct.status !== "ACTIVE") continue;
      const slug = acct.toolkit?.slug;
      if (!slug || caps[slug]) continue;
      caps[slug] = {
        state: "connected",
        label: pickLabel(acct) ?? `connected ${slug}`,
      };
    }
    return json({ caps });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ caps: {}, error: msg });
  }
}

function pickLabel(acct: { data?: unknown; params?: unknown }): string | null {
  const poke = (obj: unknown): string | null => {
    if (!obj || typeof obj !== "object") return null;
    const rec = obj as Record<string, unknown>;
    for (const key of [
      "email",
      "user_email",
      "account_email",
      "userEmail",
      "login",
      "username",
    ]) {
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
