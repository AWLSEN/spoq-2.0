#!/usr/bin/env bash
# Phase 0 spike: run 5 canonical tasks through Claude Code CLI + GLM-4.6.
# Outputs results/spike-<timestamp>.jsonl

set -u  # do not set -e; we want to capture failures too

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

# shellcheck disable=SC1091
set -a
source "$REPO_ROOT/.env"
set +a

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$RESULTS_DIR/spike-$TIMESTAMP.jsonl"
SUMMARY="$RESULTS_DIR/spike-$TIMESTAMP.summary.txt"

echo "=== SPOQ 2.0 Phase 0 Spike ===" | tee "$SUMMARY"
echo "Timestamp: $TIMESTAMP" | tee -a "$SUMMARY"
echo "Base URL : $ANTHROPIC_BASE_URL" | tee -a "$SUMMARY"
echo "Model    : ${ANTHROPIC_DEFAULT_OPUS_MODEL:-default}" | tee -a "$SUMMARY"
echo "CLI      : $(claude --version 2>&1 | head -1)" | tee -a "$SUMMARY"
echo "" | tee -a "$SUMMARY"

TASK_COUNT=$(python3 -c "import json,sys; print(len(json.load(open('$SCRIPT_DIR/tasks.json'))))")
echo "Running $TASK_COUNT tasks..." | tee -a "$SUMMARY"
echo "" | tee -a "$SUMMARY"

for i in $(seq 0 $((TASK_COUNT - 1))); do
  TASK_JSON=$(python3 -c "import json; print(json.dumps(json.load(open('$SCRIPT_DIR/tasks.json'))[$i]))")
  TASK_ID=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
  TASK_PROMPT=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['prompt'])")

  echo "[$((i+1))/$TASK_COUNT] $TASK_ID" | tee -a "$SUMMARY"

  START=$(python3 -c "import time; print(time.time())")
  OUTPUT_FILE=$(mktemp)
  ERROR_FILE=$(mktemp)

  # Run Claude Code CLI in headless print mode.
  # --print/-p: print response and exit (no interactive loop)
  # --dangerously-skip-permissions: spike only; we need non-interactive
  timeout 120 claude -p "$TASK_PROMPT" \
    --dangerously-skip-permissions \
    > "$OUTPUT_FILE" 2> "$ERROR_FILE"
  EXIT=$?
  END=$(python3 -c "import time; print(time.time())")
  DURATION=$(python3 -c "print(round($END - $START, 2))")

  OUTPUT=$(cat "$OUTPUT_FILE")
  STDERR=$(cat "$ERROR_FILE")
  OUTPUT_LEN=${#OUTPUT}

  STATUS="ok"
  if [ $EXIT -ne 0 ]; then STATUS="fail"; fi
  if [ $OUTPUT_LEN -lt 20 ]; then STATUS="empty"; fi

  echo "  exit=$EXIT duration=${DURATION}s len=$OUTPUT_LEN status=$STATUS" | tee -a "$SUMMARY"

  # Append JSONL record
  python3 <<PYEOF >> "$OUT"
import json
rec = {
  "task_id": "$TASK_ID",
  "prompt": ${TASK_PROMPT@Q},
  "exit_code": $EXIT,
  "duration_s": $DURATION,
  "output_len": $OUTPUT_LEN,
  "status": "$STATUS",
  "output": open("$OUTPUT_FILE").read(),
  "stderr": open("$ERROR_FILE").read()[:2000],
}
print(json.dumps(rec))
PYEOF

  rm -f "$OUTPUT_FILE" "$ERROR_FILE"
done

echo "" | tee -a "$SUMMARY"
echo "Results: $OUT" | tee -a "$SUMMARY"
echo "Summary: $SUMMARY" | tee -a "$SUMMARY"
