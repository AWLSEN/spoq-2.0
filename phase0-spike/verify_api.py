#!/usr/bin/env python3
"""
Phase 2 verification: hit the live /api/chat SSE endpoint with 3 canonical
tasks and confirm real GLM output streams through.

Pre-req: `pnpm run dev` running on http://localhost:3000.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request

BASE_URL = "http://localhost:3000"

# NOTE: keyword heuristics are a smoke test only. Phase 6 introduces an
# Opus LLM-judge that grades on semantic fit, not string matching.
TASKS = [
    {
        "id": "api_t1_translate",
        "prompt": "Translate 'good morning' to Hindi, Spanish, and French. Just the three translations, one per line.",
        # Spanish + French substrings; Hindi may be Devanagari — checked via min-length.
        "contains_any": ["buenos", "bonjour"],
        "min_len": 20,
    },
    {
        "id": "api_t2_info",
        "prompt": "Name 3 healthy breakfast options in under 60 words. Use a bulleted list.",
        "contains_any": ["•", "-", "*"],  # any bullet marker
        "min_len": 60,
    },
    {
        "id": "api_t3_plan",
        "prompt": "Suggest a 3-step plan to start a walking habit for a 60-year-old. Number the steps.",
        "contains_any": ["1", "walk"],
        "min_len": 100,
    },
]


def hit(prompt: str, timeout: int = 180) -> dict:
    req = urllib.request.Request(
        f"{BASE_URL}/api/chat",
        method="POST",
        headers={"content-type": "application/json"},
        data=json.dumps({"message": prompt}).encode(),
    )
    start = time.time()
    chunks: list[str] = []
    done = None
    errors: list[str] = []
    first_chunk_at: float | None = None

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        buf = ""
        while True:
            raw = resp.read1(4096)
            if not raw:
                break
            buf += raw.decode("utf-8", errors="replace")
            events = buf.split("\n\n")
            buf = events.pop()
            for ev in events:
                ev = ev.strip()
                if not ev.startswith("data:"):
                    continue
                payload = ev[5:].strip()
                if not payload:
                    continue
                try:
                    data = json.loads(payload)
                except Exception:
                    continue
                if data.get("kind") == "stdout":
                    if first_chunk_at is None:
                        first_chunk_at = time.time()
                    chunks.append(data.get("chunk", ""))
                elif data.get("kind") == "done":
                    done = data
                elif data.get("kind") == "error":
                    errors.append(data.get("message", ""))

    duration = round(time.time() - start, 2)
    ttf = round((first_chunk_at - start), 2) if first_chunk_at else None
    return {
        "output": "".join(chunks),
        "done": done,
        "errors": errors,
        "duration_s": duration,
        "time_to_first_chunk_s": ttf,
    }


def main() -> int:
    passes = 0
    print(f"=== SPOQ 2.0 Phase 2 verification against {BASE_URL} ===\n")
    for task in TASKS:
        print(f"[{task['id']}]")
        print(f"  prompt: {task['prompt']}")
        try:
            r = hit(task["prompt"])
        except Exception as e:
            print(f"  FAIL: request error: {e}\n")
            continue

        out_low = r["output"].lower()
        found_any = any(s.lower() in out_low for s in task.get("contains_any", []))
        long_enough = len(r["output"]) >= task.get("min_len", 0)
        ok_exit = bool(r["done"]) and r["done"].get("exitCode") == 0
        status = "PASS" if ok_exit and found_any and long_enough else "FAIL"
        if status == "PASS":
            passes += 1

        print(f"  duration: {r['duration_s']}s  ttfc: {r['time_to_first_chunk_s']}s")
        print(f"  output len: {len(r['output'])}")
        print(f"  found_any: {found_any}  long_enough: {long_enough}")
        print(f"  errors: {r['errors']}")
        print(f"  done: {r['done']}")
        print(f"  STATUS: {status}")
        print(f"  preview: {r['output'][:200].strip()!r}")
        print()

    print(f"TOTAL: {passes}/{len(TASKS)} passed")
    return 0 if passes == len(TASKS) else 1


if __name__ == "__main__":
    sys.exit(main())
