import { CapabilityRequest } from "./types";

// <<SPOQ-NEED type="gmail" reason="to read your inbox"/>>
// Tolerant of whitespace, single/double quotes, and both closers:
//   "/>>", "/>", ">>", ">"  (GLM occasionally emits only one ">")
// Accept either attribute name: `type` (current) or `toolkit` (alias).
const TOKEN_RE =
  /<<SPOQ-NEED\s+(?:type|toolkit)=["']([^"']+)["']\s+reason=["']([^"']*)["']\s*\/?>+/g;

// Legacy aliases from the old hardcoded menu → Composio toolkit slugs.
// Keeps old agent outputs working during the transition.
const LEGACY_ALIASES: Record<string, string> = {
  "email.send": "gmail",
  "phone.sms": "twilio",
  "card.charge": "stripe",
};

export interface ParsedOutput {
  /** Output with all capability tokens stripped. */
  clean: string;
  /** Capability requests detected, in order. */
  requests: CapabilityRequest[];
}

export function parseCapabilityTokens(raw: string): ParsedOutput {
  const requests: CapabilityRequest[] = [];
  const clean = raw.replace(TOKEN_RE, (_full, rawKind: string, reason: string) => {
    let kind = rawKind.trim().toLowerCase();
    if (LEGACY_ALIASES[kind]) kind = LEGACY_ALIASES[kind];
    if (kind) requests.push({ kind, reason: reason.trim() });
    return "";
  });
  return { clean, requests };
}
