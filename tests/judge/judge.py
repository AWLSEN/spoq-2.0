#!/usr/bin/env python3
"""
LLM judge — grades canonical task outputs on a 0–2 scale.

Priority for judge model:
  1. Claude Opus (if ANTHROPIC_JUDGE_KEY env var set)
  2. GLM-4.6 fallback (uses the same key the runner used)

Output: tests/judge/scores/<source-basename>.json with aggregate pass rate.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SCORES = HERE / "scores"
SCORES.mkdir(exist_ok=True)

JUDGE_SYSTEM = """You are a strict quality judge for a grandma-facing AI assistant.
Given a prompt, a rubric, and the assistant's output, return a single JSON
object: {"score": 0|1|2, "reason": "<one sentence>"}.

Scoring:
  2 = fully meets the rubric; a 60-year-old non-technical user would be satisfied.
  1 = partially meets it; some structure or content is missing, but not a failure.
  0 = does not meet the rubric; wrong, empty, or confusing output.

Be concise. Return only the JSON object, nothing else.
"""


def load_env() -> dict:
    env = os.environ.copy()
    dotenv = ROOT / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def call_anthropic_like(base_url: str, api_key: str, model: str, user_msg: str) -> str:
    """Call an Anthropic-compatible /v1/messages endpoint and return assistant text."""
    body = {
        "model": model,
        "max_tokens": 400,
        "system": JUDGE_SYSTEM,
        "messages": [{"role": "user", "content": user_msg}],
    }
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/v1/messages",
        method="POST",
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        data=json.dumps(body).encode(),
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    # content is a list of blocks; pull text blocks
    parts = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "".join(parts).strip()


def parse_verdict(text: str) -> dict:
    """Extract {score, reason} from model output. Tolerant of code fences."""
    text = text.strip()
    if text.startswith("```"):
        # strip first fence line and last fence line
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # Find first { … } block
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return {"score": 0, "reason": f"could not parse judge output: {text[:200]!r}"}
    try:
        obj = json.loads(text[start : end + 1])
    except Exception as e:
        return {"score": 0, "reason": f"judge parse error: {e}"}
    score = obj.get("score", 0)
    if score not in (0, 1, 2):
        score = 0
    return {"score": score, "reason": str(obj.get("reason", ""))[:300]}


def judge_one(rec: dict, env: dict) -> dict:
    user_msg = (
        f"PROMPT:\n{rec['prompt']}\n\n"
        f"RUBRIC:\n{rec['rubric']}\n\n"
        f"ASSISTANT OUTPUT:\n{rec['output']}\n"
    )

    anth_key = env.get("ANTHROPIC_JUDGE_KEY")
    if anth_key:
        text = call_anthropic_like(
            "https://api.anthropic.com", anth_key, "claude-opus-4-7", user_msg
        )
        model_used = "claude-opus-4-7"
    else:
        key = env.get("ANTHROPIC_AUTH_TOKEN") or ""
        base = env.get("ANTHROPIC_BASE_URL") or "https://api.z.ai/api/anthropic"
        model = env.get("ANTHROPIC_DEFAULT_OPUS_MODEL") or "GLM-4.6"
        text = call_anthropic_like(base, key, model, user_msg)
        model_used = f"{model} (self-judge)"

    verdict = parse_verdict(text)
    verdict["judge_model"] = model_used
    return verdict


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("results_file", help="path to canonical results JSONL")
    ap.add_argument("--limit", type=int, default=0, help="only judge first N records")
    args = ap.parse_args()

    env = load_env()
    src = Path(args.results_file)
    records = [json.loads(line) for line in src.read_text().splitlines() if line.strip()]
    if args.limit:
        records = records[: args.limit]

    print(f"Judging {len(records)} records from {src.name}")
    graded = []
    total_score = 0
    for i, rec in enumerate(records, start=1):
        print(f"[{i}/{len(records)}] {rec['task_id']} ...", flush=True)
        try:
            verdict = judge_one(rec, env)
        except Exception as e:
            verdict = {"score": 0, "reason": f"judge error: {e}", "judge_model": "error"}
        total_score += verdict["score"]
        graded.append({**rec, "judge": verdict})
        print(f"     score={verdict['score']} reason={verdict['reason'][:80]!r}")

    max_score = 2 * len(records)
    pass_rate = round(100 * total_score / max_score, 1) if max_score else 0
    out = SCORES / f"{src.stem}.scores.json"
    out.write_text(
        json.dumps(
            {
                "source": src.name,
                "record_count": len(records),
                "total_score": total_score,
                "max_score": max_score,
                "pass_rate_pct": pass_rate,
                "bar": 85.0,
                "decision": "PASS" if pass_rate >= 85.0 else "FAIL",
                "records": graded,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    print(f"\nTotal: {total_score}/{max_score} = {pass_rate}% (bar 85%)")
    print(f"Decision: {'PASS' if pass_rate >= 85 else 'FAIL'}")
    print(f"Full report: {out}")
    return 0 if pass_rate >= 85 else 1


if __name__ == "__main__":
    sys.exit(main())
