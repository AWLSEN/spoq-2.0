import { CapabilityKind } from "./types";

/**
 * Stub connection labels returned when the user clicks "Connect".
 * Replaced per-capability with real service integrations later:
 *   identity  → Clerk / Google One-Tap
 *   email.send → Resend (verified domain)
 *   phone.sms  → Twilio
 *   card.charge → Stripe Issuing virtual card
 */
export function stubConnect(kind: CapabilityKind): string {
  switch (kind) {
    case "identity":
      return "you@example.com";
    case "email.send":
      return "you@example.com (stub)";
    case "phone.sms":
      return "+1 (555) 010-0001 (stub)";
    case "card.charge":
      return "Visa •• 4242 (stub)";
  }
}
