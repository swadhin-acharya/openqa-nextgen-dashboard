#!/usr/bin/env bash
#
# Wraps a test command with Phase 10 live-execution polling: while the
# command runs, re-tars and re-POSTs allure-results/ to /api/ingest every
# POLL_INTERVAL seconds with inProgress: true, so partial pass/fail counts
# show up as a "running now" banner on the dashboard in real time (see
# supabase/migrations/0012_live_executions.sql and
# src/components/LiveExecutionBanner.tsx). Once the command exits, one
# final ingest (no inProgress flag) writes the real historical record and
# clears the live banner - exactly like a normal, non-live ingest.
#
# This script is NOT part of the dashboard's own deploy - it's meant to be
# copied into (or curl'd from) whatever CI pipeline or local machine runs
# the actual test suite.
#
# Usage:
#   OPENQA_PAT=oqp_xxx ./scripts/live-ingest.sh -- mvn test
#   OPENQA_PAT=oqp_xxx ./scripts/live-ingest.sh -- npx cucumber-js
#
# Env vars:
#   OPENQA_PAT           required - the project's personal access token
#   OPENQA_INGEST_URL    default https://openqa-nextgen-dashboard.vercel.app/api/ingest
#   ALLURE_RESULTS_DIR   default ./allure-results
#   POLL_INTERVAL        default 20 (seconds)

set -euo pipefail

if [ "${1:-}" != "--" ]; then
  echo "Usage: OPENQA_PAT=... $0 -- <test command>" >&2
  exit 1
fi
shift

: "${OPENQA_PAT:?Set OPENQA_PAT to your project personal access token}"
OPENQA_INGEST_URL="${OPENQA_INGEST_URL:-https://openqa-nextgen-dashboard.vercel.app/api/ingest}"
ALLURE_RESULTS_DIR="${ALLURE_RESULTS_DIR:-allure-results}"
POLL_INTERVAL="${POLL_INTERVAL:-20}"
# Stable across every poll of this run, including the final call - that's
# how the server knows which live_executions row to clear on completion.
EXECUTION_ID="live-$(date +%s)-$$"

ingest() {
  local in_progress="$1"
  [ -d "$ALLURE_RESULTS_DIR" ] || return 0

  local tarball
  tarball="$(mktemp -t openqa-live-XXXXXX).tar.gz"
  # COPYFILE_DISABLE avoids macOS tar's AppleDouble sidecar files (the
  # server strips them defensively too, but cleaner to not send them).
  COPYFILE_DISABLE=1 tar -czf "$tarball" -C "$ALLURE_RESULTS_DIR" .
  local archive
  archive="$(base64 < "$tarball" | tr -d '\n')"
  rm -f "$tarball"

  local body
  if [ "$in_progress" = "true" ]; then
    body="$(printf '{"inProgress":true,"executionId":"%s","archive":"%s"}' "$EXECUTION_ID" "$archive")"
  else
    body="$(printf '{"executionId":"%s","archive":"%s"}' "$EXECUTION_ID" "$archive")"
  fi

  curl -sS -X POST "$OPENQA_INGEST_URL" \
    -H "Authorization: Bearer $OPENQA_PAT" \
    -H "Content-Type: application/json" \
    -d "$body" -o /dev/null -w "  live-ingest (inProgress=$in_progress): HTTP %{http_code}\n" || true
}

# Run the test command in the background so this script can poll alongside it.
"$@" &
TEST_PID=$!

while kill -0 "$TEST_PID" 2>/dev/null; do
  sleep "$POLL_INTERVAL"
  kill -0 "$TEST_PID" 2>/dev/null && ingest true
done

wait "$TEST_PID"
TEST_EXIT=$?

# Final, real ingest - merges into history and clears the live row.
ingest false

exit "$TEST_EXIT"
