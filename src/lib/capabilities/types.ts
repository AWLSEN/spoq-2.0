/**
 * JIT capability protocol.
 *
 * The agent (Claude Code + GLM) is taught via system preamble that when it
 * needs a third-party service to complete the user's task, it emits a
 * request token inline. The portal detects it, shows a connect card, and
 * on connect routes through Composio OAuth for that toolkit.
 *
 * Token format (single line, self-closing XML-ish):
 *   <<SPOQ-NEED type="<composio-toolkit-slug>" reason="<short human reason>"/>>
 *
 * The `type` value IS the Composio toolkit slug — gmail, google_calendar,
 * slack, notion, github, stripe, linear, twilio, calendly, google_drive, …
 * The agent picks whichever toolkit fits; there is no closed menu.
 */

export type CapabilityKind = string;

export interface CapabilityRequest {
  kind: CapabilityKind;
  reason: string;
}

export type CapabilityStatus =
  | { state: "connected"; label: string }
  | { state: "declined" };

/** Client-side ephemeral session state, keyed by Composio toolkit slug. */
export type CapabilityState = Record<string, CapabilityStatus>;

export const DEFAULT_CAPABILITY_STATE: CapabilityState = {};
