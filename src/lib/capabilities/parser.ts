import { CapabilityKind, CapabilityRequest } from "./types";

const ALLOWED: CapabilityKind[] = [
  "identity",
  "email.send",
  "phone.sms",
  "card.charge",
];

// <<SPOQ-NEED type="email.send" reason="to send the thank-you email"/>>
// Tolerant of whitespace, single/double quotes, and both closers:
//   "/>>", "/>", ">>", ">"  (GLM occasionally emits only one ">")
const TOKEN_RE =
  /<<SPOQ-NEED\s+type=["']([^"']+)["']\s+reason=["']([^"']*)["']\s*\/?>+/g;

export interface ParsedOutput {
  /** Output with all capability tokens stripped. */
  clean: string;
  /** Capability requests detected, in order. */
  requests: CapabilityRequest[];
}

export function parseCapabilityTokens(raw: string): ParsedOutput {
  const requests: CapabilityRequest[] = [];
  const clean = raw.replace(TOKEN_RE, (_full, rawKind: string, reason: string) => {
    const kind = rawKind.trim() as CapabilityKind;
    if (ALLOWED.includes(kind)) {
      requests.push({ kind, reason: reason.trim() });
    }
    return ""; // strip token from user-visible text
  });
  return { clean, requests };
}
