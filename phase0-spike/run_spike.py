#!/usr/bin/env python3
"""Phase 0 spike: run canonical tasks through Claude Code CLI + GLM-4.6."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
RESULTS_DIR = SCRIPT_DIR / "results"
RESULTS_DIR.mkdir(exist_ok=True)


def load_env():
    env_file = REPO_ROOT / ".env"
    env = os.environ.copy()
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def run_task(task: dict, env: dict, timeout: int = 120) -> dict:
    start = time.time()
    try:
        proc = subprocess.run(
            [
                "claude",
                "-p",
                task["prompt"],
                "--dangerously-skip-permissions",
            ],
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        exit_code = proc.returncode
        stdout = proc.stdout
        stderr = proc.stderr
    except subprocess.TimeoutExpired as e:
        exit_code = -1
        stdout = (e.stdout or b"").decode("utf-8", errors="replace") if e.stdout else ""
        stderr = f"TIMEOUT after {timeout}s"
    duration = round(time.time() - start, 2)

    status = "ok"
    if exit_code != 0:
        status = "fail"
    elif len(stdout.strip()) < 20:
        status = "empty"

    return {
        "task_id": task["id"],
        "category": task["category"],
        "prompt": task["prompt"],
        "expect": task["expect"],
        "exit_code": exit_code,
        "duration_s": duration,
        "output_len": len(stdout),
        "status": status,
        "output": stdout,
        "stderr": stderr[:4000],
    }


def main():
    env = load_env()
    tasks = json.loads((SCRIPT_DIR / "tasks.json").read_text())

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_path = RESULTS_DIR / f"spike-{ts}.jsonl"
    summary_path = RESULTS_DIR / f"spike-{ts}.summary.txt"

    lines = [
        "=== SPOQ 2.0 Phase 0 Spike ===",
        f"Timestamp: {ts}",
        f"Base URL : {env.get('ANTHROPIC_BASE_URL', '<not set>')}",
        f"Model    : {env.get('ANTHROPIC_DEFAULT_OPUS_MODEL', 'default')}",
        f"Task count: {len(tasks)}",
        "",
    ]
    print("\n".join(lines))

    records = []
    for i, task in enumerate(tasks, start=1):
        print(f"[{i}/{len(tasks)}] {task['id']} ({task['category']})")
        rec = run_task(task, env)
        records.append(rec)
        line = (
            f"  exit={rec['exit_code']} duration={rec['duration_s']}s "
            f"len={rec['output_len']} status={rec['status']}"
        )
        print(line)
        lines.append(f"[{i}/{len(tasks)}] {task['id']} ({task['category']})")
        lines.append(line)

    with out_path.open("w") as f:
        for rec in records:
            f.write(json.dumps(rec) + "\n")

    ok_count = sum(1 for r in records if r["status"] == "ok")
    lines.append("")
    lines.append(f"Status summary: {ok_count}/{len(records)} ran cleanly (ok)")
    lines.append(f"Results: {out_path}")
    summary_path.write_text("\n".join(lines))

    print("\n" + "\n".join(lines[-3:]))
    return 0 if ok_count == len(records) else 1


if __name__ == "__main__":
    sys.exit(main())
