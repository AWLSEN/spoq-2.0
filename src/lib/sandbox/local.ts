import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_TIMEOUT_MS,
  Sandbox,
  SandboxEvent,
  SandboxRunOptions,
} from "./types";

/**
 * Local subprocess sandbox: spawns `claude -p <prompt>` in an isolated
 * temp workdir, with GLM env injected. Matches the exact code path
 * validated in Phase 0.
 *
 * Swap for `orb.ts` once Orb auth is sorted. Contract-compatible.
 */
class LocalSandbox implements Sandbox {
  async *run(
    prompt: string,
    opts?: SandboxRunOptions
  ): AsyncGenerator<SandboxEvent> {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const workdir = mkdtempSync(join(tmpdir(), "spoq-sandbox-"));
    const started = Date.now();

    const env = {
      ...process.env,
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ?? "",
      ANTHROPIC_BASE_URL:
        process.env.ANTHROPIC_BASE_URL ?? "https://api.z.ai/api/anthropic",
      ANTHROPIC_DEFAULT_OPUS_MODEL:
        process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "GLM-4.6",
      API_TIMEOUT_MS: process.env.API_TIMEOUT_MS ?? "300000",
    };

    if (!env.ANTHROPIC_AUTH_TOKEN) {
      yield { kind: "error", message: "ANTHROPIC_AUTH_TOKEN not set" };
      rmSync(workdir, { recursive: true, force: true });
      return;
    }

    const args = ["-p", prompt, "--dangerously-skip-permissions"];
    if (opts?.appendSystemPrompt) {
      args.push("--append-system-prompt", opts.appendSystemPrompt);
    }
    if (opts?.mcpServers && opts.mcpServers.length > 0) {
      const mcpConfig = {
        mcpServers: Object.fromEntries(
          opts.mcpServers.map((s) => [
            s.name,
            { type: "http", url: s.url, headers: s.headers ?? {} },
          ])
        ),
      };
      const mcpPath = join(workdir, ".mcp.json");
      writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2), "utf8");
      args.push("--mcp-config", mcpPath, "--strict-mcp-config");
    }

    const child = spawn("claude", args, {
      cwd: workdir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const queue: SandboxEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let finished = false;

    const push = (ev: SandboxEvent) => {
      queue.push(ev);
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => push({ kind: "stdout", chunk }));
    child.stderr.on("data", (chunk: string) => push({ kind: "stderr", chunk }));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      push({ kind: "error", message: `sandbox timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      push({
        kind: "done",
        exitCode: code ?? -1,
        durationMs: Date.now() - started,
      });
      finished = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    });

    try {
      while (!finished || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((r) => (resolveNext = r));
        }
        while (queue.length > 0) {
          const ev = queue.shift()!;
          yield ev;
          if (ev.kind === "done") return;
        }
      }
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  }
}

export const localSandbox = new LocalSandbox();
