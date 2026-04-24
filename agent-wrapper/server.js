// Runs inside Sam's Orb computer. Accepts POST /run with a chat prompt
// + system preamble + mcp servers, spawns `claude -p ...`, streams stdout
// back line-by-line as SSE events that mirror the Sandbox event shape.

const http = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const PORT = Number(process.env.PORT ?? 8000);
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
const DEFAULT_TIMEOUT_MS = Number(process.env.DEFAULT_TIMEOUT_MS ?? 300_000);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sseWrite(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function handleRun(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `bad json: ${e.message}` }));
    return;
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "prompt required" }));
    return;
  }
  const appendSystemPrompt =
    typeof body.appendSystemPrompt === "string" ? body.appendSystemPrompt : "";
  const mcpServers = Array.isArray(body.mcpServers) ? body.mcpServers : [];
  const timeoutMs = Number(body.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });

  const workdir = mkdtempSync(join(tmpdir(), "spoq-run-"));
  const started = Date.now();

  const args = ["-p", prompt, "--dangerously-skip-permissions"];
  if (appendSystemPrompt) {
    args.push("--append-system-prompt", appendSystemPrompt);
  }
  if (mcpServers.length > 0) {
    const mcpConfig = {
      mcpServers: Object.fromEntries(
        mcpServers.map((s) => [
          s.name,
          { type: "http", url: s.url, headers: s.headers ?? {} },
        ])
      ),
    };
    const mcpPath = join(workdir, ".mcp.json");
    writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2), "utf8");
    args.push("--mcp-config", mcpPath, "--strict-mcp-config");
  }

  const child = spawn(CLAUDE_BIN, args, {
    cwd: workdir,
    env: {
      ...process.env,
      // Claude Code uses Anthropic-style env vars; for OpenRouter we map
      // OPENROUTER_API_KEY -> ANTHROPIC_AUTH_TOKEN and set OpenRouter's
      // Anthropic-compatible base URL.
      ANTHROPIC_AUTH_TOKEN:
        process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN ?? "",
      ANTHROPIC_BASE_URL:
        process.env.ANTHROPIC_BASE_URL ?? "https://openrouter.ai/api",
      ANTHROPIC_DEFAULT_OPUS_MODEL:
        process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "z-ai/glm-4.6",
      API_TIMEOUT_MS: process.env.API_TIMEOUT_MS ?? "300000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => sseWrite(res, { kind: "stdout", chunk }));
  child.stderr.on("data", (chunk) => sseWrite(res, { kind: "stderr", chunk }));

  const timer = setTimeout(() => {
    child.kill("SIGKILL");
    sseWrite(res, { kind: "error", message: `timed out after ${timeoutMs}ms` });
  }, timeoutMs);

  child.on("close", (code) => {
    clearTimeout(timer);
    sseWrite(res, {
      kind: "done",
      exitCode: code ?? -1,
      durationMs: Date.now() - started,
    });
    try { rmSync(workdir, { recursive: true, force: true }); } catch {}
    res.end();
  });

  req.on("close", () => {
    try { child.kill("SIGKILL"); } catch {}
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, version: "0.1.0" }));
    return;
  }
  if (req.method === "GET" && req.url === "/debug/env") {
    const keys = ["ANTHROPIC_BASE_URL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "API_TIMEOUT_MS", "PORT", "ORB_PORT", "ORB_PROXY_PORT", "AGENT_API_BASE_URL"];
    const out = {};
    for (const k of keys) out[k] = process.env[k] ?? null;
    out.HAS_AUTH_TOKEN = Boolean(process.env.ANTHROPIC_AUTH_TOKEN);
    out.AUTH_TOKEN_PREFIX = (process.env.ANTHROPIC_AUTH_TOKEN ?? "").slice(0, 8);
    out.HAS_OPENROUTER_KEY = Boolean(process.env.OPENROUTER_API_KEY);
    out.OPENROUTER_KEY_PREFIX = (process.env.OPENROUTER_API_KEY ?? "").slice(0, 8);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out, null, 2));
    return;
  }
  if (req.method === "POST" && req.url === "/run") {
    await handleRun(req, res);
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[spoq-agent-wrapper] listening on 0.0.0.0:${PORT}`);
});
