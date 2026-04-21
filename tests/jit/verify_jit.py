#!/usr/bin/env python3
"""
End-to-end verification of the JIT capability protocol.

Starts from an already-running dev server at http://localhost:3000.
Runs three scenarios:

  1. POSITIVE — "send email" task should emit an email.send capability_request.
  2. NEGATIVE — "write an email" (drafting only) should NOT emit any request.
  3. RESUME   — after positive, send follow-up indicating connected,
                expect the agent to actually draft/"send" it without re-asking.
"""
from __future__ import annotations

import json
import sys
import urllib.request

BASE_URL = "http://localhost:3000"


def chat(messages, capabilities=None, timeout=240):
    req = urllib.request.Request(
        f"{BASE_URL}/api/chat",
        method="POST",
        headers={"content-type": "application/json"},
        data=json.dumps(
            {"messages": messages, "capabilities": capabilities or {}}
        ).encode(),
    )
    events = []
    clean = []
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        buf = ""
        while True:
            raw = resp.read1(4096)
            if not raw:
                break
            buf += raw.decode("utf-8", errors="replace")
            chunks = buf.split("\n\n")
            buf = chunks.pop()
            for ev in chunks:
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
                events.append(data)
                if data.get("kind") == "stdout_clean":
                    clean.append(data.get("chunk", ""))
    return {"events": events, "clean_text": "".join(clean)}


def capability_requests(events):
    return [e["request"] for e in events if e.get("kind") == "capability_request"]


def ok_done(events):
    return any(
        e.get("kind") == "done" and e.get("exitCode") == 0 for e in events
    )


def main() -> int:
    passes = 0
    total = 0

    # ── Scenario 1: POSITIVE — send email ─────────────────────────
    total += 1
    print("[1/3] positive: 'send a thank-you email to my sister Priya'")
    r = chat(
        [
            {
                "role": "user",
                "text": (
                    "Please send a thank-you email to my sister Priya for the "
                    "birthday gift she sent me. Send it now."
                ),
            }
        ]
    )
    reqs = capability_requests(r["events"])
    kinds = [req["kind"] for req in reqs]
    has_email = any(k == "email.send" for k in kinds)
    print(f"   events: {len(r['events'])}  requests: {kinds}")
    print(f"   clean text preview: {r['clean_text'][:180]!r}")
    if has_email and ok_done(r["events"]):
        print("   PASS\n")
        passes += 1
    else:
        print("   FAIL\n")

    # ── Scenario 2: NEGATIVE — draft only, don't send ─────────────
    total += 1
    print("[2/3] negative: 'help me write a thank-you email' (drafting only)")
    r2 = chat(
        [
            {
                "role": "user",
                "text": (
                    "Help me write a short polite thank-you email to someone who "
                    "interviewed me for a job. Just the draft — don't send anything."
                ),
            }
        ]
    )
    reqs2 = capability_requests(r2["events"])
    kinds2 = [req["kind"] for req in reqs2]
    print(f"   events: {len(r2['events'])}  requests: {kinds2}")
    print(f"   clean text preview: {r2['clean_text'][:180]!r}")
    if not reqs2 and ok_done(r2["events"]):
        print("   PASS\n")
        passes += 1
    else:
        print("   FAIL\n")

    # ── Scenario 3: RESUME — capability connected, agent continues ──
    total += 1
    print("[3/3] resume: after connecting, agent should continue without re-asking")
    r3 = chat(
        messages=[
            {
                "role": "user",
                "text": (
                    "Please send a thank-you email to my sister Priya for the "
                    "birthday gift she sent me. Send it now."
                ),
            },
            {
                "role": "agent",
                "text": "I'd like to use your email to send this. Which one should I use?",
            },
            {
                "role": "user",
                "text": (
                    "(email.send is now connected as you@example.com — please continue.)"
                ),
            },
        ],
        capabilities={
            "email.send": {"state": "connected", "label": "you@example.com"}
        },
    )
    reqs3 = capability_requests(r3["events"])
    clean3 = r3["clean_text"].lower()
    print(f"   events: {len(r3['events'])}  requests: {[r['kind'] for r in reqs3]}")
    print(f"   clean text preview: {r3['clean_text'][:200]!r}")
    # A good resume: no new email.send request, output mentions Priya/thank-you.
    asked_again = any(r["kind"] == "email.send" for r in reqs3)
    plausible = ("priya" in clean3 or "thank" in clean3) and len(clean3.strip()) > 40
    if not asked_again and plausible and ok_done(r3["events"]):
        print("   PASS\n")
        passes += 1
    else:
        print("   FAIL\n")

    print(f"TOTAL: {passes}/{total}")
    return 0 if passes == total else 1


if __name__ == "__main__":
    sys.exit(main())
