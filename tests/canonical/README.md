# Canonical grandma task suite

20 tasks modelled after a 60-year-old non-technical user's real questions.
Three categories: `info` (facts, recipes, translations), `plan` (itineraries,
emails, shopping lists), and — deferred to Phase 5 — `action` (actually book,
send, or buy something).

## Run
```bash
# All 20 tasks via Claude Code CLI + GLM
python3 tests/canonical/run.py

# Just a subset
CANONICAL_FILTER=c01 python3 tests/canonical/run.py
```

Outputs land in `tests/canonical/results/run-<ts>.jsonl` (gitignored).

## Judge
```bash
# Uses GLM as self-judge by default; set ANTHROPIC_JUDGE_KEY to use Claude Opus
python3 tests/judge/judge.py tests/canonical/results/run-<ts>.jsonl
```

Pass bar: **≥85% of max score** (2 pts × 20 tasks = 40 max → 34 to pass).
