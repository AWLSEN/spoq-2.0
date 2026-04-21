export type SandboxEvent =
  | { kind: "stdout"; chunk: string }
  | { kind: "stderr"; chunk: string }
  | { kind: "done"; exitCode: number; durationMs: number }
  | { kind: "error"; message: string };

export interface Sandbox {
  /** Stream Claude Code CLI output for a single prompt. */
  run(prompt: string, opts?: { timeoutMs?: number }): AsyncIterable<SandboxEvent>;
}

export const DEFAULT_TIMEOUT_MS = 120_000;
