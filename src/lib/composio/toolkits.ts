import { CapabilityKind } from "@/lib/capabilities/types";

/**
 * Map each SPOQ capability kind to a Composio toolkit slug.
 * The toolkit slug is what Composio's authorize() and session APIs expect.
 */
export const CAPABILITY_TO_TOOLKIT: Partial<Record<CapabilityKind, string>> = {
  "email.send": "gmail",
  // identity / phone.sms / card.charge — future toolkits, not yet wired.
};

export function toolkitFor(kind: CapabilityKind): string | null {
  return CAPABILITY_TO_TOOLKIT[kind] ?? null;
}

export function capabilityFromToolkit(slug: string): CapabilityKind | null {
  for (const [kind, s] of Object.entries(CAPABILITY_TO_TOOLKIT)) {
    if (s === slug) return kind as CapabilityKind;
  }
  return null;
}
