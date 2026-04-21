#!/usr/bin/env python3
"""
Canonical task runner — runs all 20 grandma tasks via Claude Code CLI + GLM
and writes results to tests/canonical/results/<timestamp>.jsonl.

This is the ground truth feed for the LLM judge (tests/judge/).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
RESULTS.mkdir(exist_ok=True)


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


def run_one(task: dict, env: dict, timeout: int = 120) -> dict:
    start = time.time()
    try:
        proc = subprocess.run(
            ["claude", "-p", task["prompt"], "--dangerously-skip-permissions"],
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        exit_code = proc.returncode
        stdout = proc.stdout
        stderr = proc.stderr
    except subprocess.TimeoutExpired:
        exit_code = -1
        stdout = ""
        stderr = f"TIMEOUT after {timeout}s"
    duration = round(time.time() - start, 2)
    return {
        "task_id": task["id"],
        "category": task["category"],
        "prompt": task["prompt"],
        "rubric": task["rubric"],
        "exit_code": exit_code,
        "duration_s": duration,
        "output_len": len(stdout),
        "output": stdout,
        "stderr": stderr[:2000],
    }


def main() -> int:
    env = load_env()
    tasks = json.loads((HERE / "tasks.json").read_text())
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = RESULTS / f"run-{ts}.jsonl"

    # Optionally filter via CANONICAL_FILTER env var (substring match on id).
    filt = os.environ.get("CANONICAL_FILTER", "")
    if filt:
        tasks = [t for t in tasks if filt in t["id"]]
        print(f"filter={filt!r} → {len(tasks)} tasks")

    print(f"Running {len(tasks)} canonical tasks → {out}")
    with out.open("w") as f:
        for i, task in enumerate(tasks, start=1):
            print(f"[{i}/{len(tasks)}] {task['id']} ...", flush=True)
            rec = run_one(task, env)
            f.write(json.dumps(rec) + "\n")
            print(f"     exit={rec['exit_code']} {rec['duration_s']}s len={rec['output_len']}")

    print(f"Done → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
