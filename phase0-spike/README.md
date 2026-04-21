# Phase 0 — GLM + Claude Code Spike

## Purpose
Verify Claude Code CLI can be driven cleanly by GLM-4.6 via `ANTHROPIC_BASE_URL`. This is the go/no-go gate for the entire SPOQ 2.0 project.

## Method
1. Set `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL` to point at GLM.
2. Run Claude Code CLI in headless mode (`claude -p "<prompt>"`) against 5 grandma-ish tasks.
3. Capture stdout, stderr, exit code, duration.
4. Have GPT/Opus-as-judge grade each output on a 0–2 scale (0=fail, 1=partial, 2=pass).
5. Aggregate: ≥8/10 (≥80%) = GO. <8/10 = investigate or pivot to LiteLLM.

## Tasks
1. "What's a simple dal tadka recipe I can make in 30 minutes?" (info)
2. "Write me a Python function to reverse a string." (code)
3. "Translate 'hello, how are you?' into Hindi, Spanish, and French." (translation)
4. "Plan a 2-day weekend itinerary for Goa for an older couple." (plan)
5. "What are the top 3 benefits of solar panels in a hot climate?" (info)

## Files
- `run_spike.sh` — runs all 5 tasks, writes JSONL results
- `judge.py` — Opus judge grades each result
- `results/` — outputs (gitignored)
