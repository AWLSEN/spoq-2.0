"use client";

import { CapabilityKind } from "./types";

/**
 * Per-browser identity used as the Composio user_id. Stable across
 * reloads within the same browser so connections persist through
 * the whole "session" (conceptual — we don't have accounts yet).
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  const key = "spoq.user_id";
  let v = localStorage.getItem(key);
  if (!v) {
    v = "spoq_" + crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(key, v);
  }
  return v;
}

/**
 * Open the OAuth popup and poll /api/capabilities/status until the
 * connection goes ACTIVE (or the user closes the popup / we time out).
 * Resolves with the connected label on success, rejects on failure.
 *
 * Every capability routes through Composio. If the toolkit slug is
 * unknown to Composio, /api/oauth/start will surface the error.
 */
export async function connectCapability(
  kind: CapabilityKind
): Promise<{ label: string }> {
  const userId = getUserId();

  const startUrl = `/api/oauth/start?kind=${encodeURIComponent(
    kind
  )}&user_id=${encodeURIComponent(userId)}`;

  const popup = window.open(
    startUrl,
    "spoq-oauth",
    "width=520,height=640,noopener=no,noreferrer=no"
  );
  if (!popup) throw new Error("popup blocked");

  const started = Date.now();
  const timeoutMs = 180_000;
  const intervalMs = 2000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const tick = async () => {
      if (settled) return;
      if (Date.now() - started > timeoutMs) {
        settled = true;
        try { popup.close(); } catch {}
        reject(new Error("connection timed out"));
        return;
      }
      try {
        const res = await fetch(
          `/api/capabilities/status?kind=${encodeURIComponent(
            kind
          )}&user_id=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as {
          connected: boolean;
          label?: string;
        };
        if (data.connected) {
          settled = true;
          try { popup.close(); } catch {}
          resolve({ label: data.label ?? kind });
          return;
        }
      } catch {
        // network blip — keep polling
      }
      setTimeout(tick, intervalMs);
    };
    setTimeout(tick, intervalMs);
  });
}
