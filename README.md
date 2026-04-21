# SPOQ 2.0

A grandma-ready portal to the best coding agents.

One chat box. One default harness (Claude Code). One default model (GLM-4.6). No login wall. Login only when the agent needs your identity.

## Status

**Phase 0 — GLM + Claude Code compatibility spike.** Go/no-go gate before any UI work.

See `PLAN.md` for the full roadmap.

## Architecture

```
USER → SPOQ PORTAL (Next.js) → HARNESS (Claude Code CLI) → ORBCLOUD sandbox
                                     ↓
                              GLM-4.6 via /v1/messages
```

## Repo layout (planned)

```
spoq-2.0/
├── phase0-spike/           # GLM + Claude Code go/no-go gate
├── app/                    # Next.js App Router (Phase 1+)
├── components/             # ChatBox, JITResource
├── lib/                    # orb, glm, stripe, twilio, resend
├── db/                     # Drizzle schema
├── sandbox-image/          # Orb image with claude-code baked in
├── tests/canonical/        # 20 grandma tasks
├── tests/judge/            # Opus LLM judge
├── .github/workflows/      # canonical-cron.yml
├── learnings.txt
├── PLAN.md
└── CLAUDE.md
```
