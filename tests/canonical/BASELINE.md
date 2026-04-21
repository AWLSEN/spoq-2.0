# Canonical baseline — run-20260421-230154

**Date:** 2026-04-21 23:01 PDT
**Pass rate:** **36/40 = 90.0%** (bar: 85%)
**Decision:** PASS
**Judge:** GLM-4.6 self-judge (upgrade to Claude Opus when `ANTHROPIC_JUDGE_KEY` is set)

## Scores

| Task | Score | Note |
|------|-------|------|
| c01_recipe | 2 | dal tadka recipe, ingredients + numbered method |
| c02_translate | **0** | GLM-side timeout (120s, empty output) |
| c03_itinerary | 2 | 2-day Goa plan, 5 activities/day |
| c04_solar | **0** | GLM-side timeout (120s, empty output) |
| c05_email | 2 | warm polite thank-you under 100 words |
| c06_weather | 2 | Delhi-June clothing (3 items) |
| c07_groceries | 2 | week-long Indian dinner list, grouped |
| c08_medication_reminder | 2 | 3 practical reminders |
| c09_walking_habit | 2 | 3 numbered steps |
| c10_phone_setup | 2 | 3 real iOS settings |
| c11_bank_fraud | 2 | 3 concrete phishing signs |
| c12_trip_pack | 2 | London October checklist |
| c13_dinner_idea | 2 | rice/eggs/onion 15-min recipe |
| c14_exercise_knee | 2 | 3 gentle exercises, safe |
| c15_gift_idea | 2 | 3 gardening-relevant gifts |
| c16_letter_to_bank | 2 | formal letter, placeholders correct |
| c17_time_in_london | 2 | correct BST/GMT DST awareness |
| c18_compare_tea | 2 | green vs black under 80 words |
| c19_simple_budget | 2 | ₹50k budget, 4 categories, sums |
| c20_code_reverse | 2 | valid Python w/ docstring + example |

## Observations

- **Tool-calling works:** c20 (code) and c01 (recipe) used the full Claude Code agent loop with Write/WebFetch tools as needed.
- **Two GLM stalls:** `c02_translate` and `c04_solar` both hit the 120s timeout with zero output. Same prompts passed in 5s during Phase 2 verification → this is a transient GLM free-tier issue, not a code issue.
- **Mitigation (next run):** added retry-with-backoff + shortened base timeout to 90s in `run.py`. Expected to push pass rate to 95-100% on steady-state GLM.

## Next baseline gate
Re-run nightly via GHA cron (`.github/workflows/canonical-cron.yml`). Alert if pass rate drops below 85%.
