export type SandboxEvent =
  | { kind: "stdout"; chunk: string }
  | { kind: "stderr"; chunk: string }
  | { kind: "done"; exitCode: number; durationMs: number }
  | { kind: "error"; message: string };

/**
 * One HTTP MCP server definition. When provided, the sandbox writes a
 * temporary .mcp.json and passes `--mcp-config <path>` to claude-code
 * so the harness can invoke tools like GMAIL_SEND_EMAIL.
 */
export interface HttpMcpServer {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

export interface SandboxRunOptions {
  timeoutMs?: number;
  appendSystemPrompt?: string;
  mcpServers?: HttpMcpServer[];
}

export interface Sandbox {
  /** Stream Claude Code CLI output for a single prompt. */
  run(prompt: string, opts?: SandboxRunOptions): AsyncIterable<SandboxEvent>;
}

export const DEFAULT_TIMEOUT_MS = 120_000;
