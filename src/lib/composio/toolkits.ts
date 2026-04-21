/**
 * Capability kind IS the Composio toolkit slug — the agent requests any
 * toolkit by name (gmail, slack, notion, …). These helpers exist so the
 * OAuth routes and session builder don't need to know that.
 */

export function toolkitFor(kind: string): string | null {
  const slug = kind.trim().toLowerCase();
  return slug.length > 0 ? slug : null;
}

export function capabilityFromToolkit(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  return s.length > 0 ? s : null;
}
