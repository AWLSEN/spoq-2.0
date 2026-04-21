/**
 * JIT capability protocol.
 *
 * The agent (Claude Code + GLM) is taught via system preamble to emit a
 * request token inline in its output when it realizes it needs a real-world
 * capability. The portal detects the token, surfaces an inline prompt, and
 * on user response, carries the decision into the next turn.
 *
 * Token format (single line, self-closing XML-ish):
 *   <<SPOQ-NEED type="<kind>" reason="<short human reason>"/>>
 */

export type CapabilityKind =
  | "identity" // who is the user
  | "email.send" // send email from the user
  | "phone.sms" // send/receive SMS as the user
  | "card.charge"; // charge a virtual card on the user's behalf

export interface CapabilityRequest {
  kind: CapabilityKind;
  reason: string;
}

export type CapabilityStatus =
  | { state: "absent" }
  | { state: "connected"; label: string }
  | { state: "declined" };

/** Client-side ephemeral session state. */
export type CapabilityState = Record<CapabilityKind, CapabilityStatus>;

export const DEFAULT_CAPABILITY_STATE: CapabilityState = {
  identity: { state: "absent" },
  "email.send": { state: "absent" },
  "phone.sms": { state: "absent" },
  "card.charge": { state: "absent" },
};

export const CAPABILITY_LABELS: Record<CapabilityKind, string> = {
  identity: "who you are",
  "email.send": "your email",
  "phone.sms": "your phone",
  "card.charge": "a payment card",
};

export const CAPABILITY_CONNECT_LABELS: Record<CapabilityKind, string> = {
  identity: "Sign in",
  "email.send": "Connect email",
  "phone.sms": "Connect phone",
  "card.charge": "Connect card",
};
