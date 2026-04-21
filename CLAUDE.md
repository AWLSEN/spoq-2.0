# SPOQ 2.0 — agent instructions

## Vision
Grandma-ready portal to AI agents. One chat box. No jargon. Deferred login.

## Defaults (locked)
- Harness: Claude Code CLI
- Model: GLM-4.6 via `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`
- Sandbox: OrbCloud (shared pool for anonymous, dedicated for paid)

## Non-negotiables
- User never sees the word "harness", "API key", "model", "token" in default UI.
- First message works with zero auth.
- Login is a capability gate (JIT), never a landing wall.
- Commit after every small step. Push after 5.
- Save learnings to `learnings.txt` before ending a session.

## Verification bar
- 20 canonical grandma tasks, ≥85% pass rate graded by Opus judge.
- <4s time to first visible value.
- Grandma can complete a task unaided on first try.
