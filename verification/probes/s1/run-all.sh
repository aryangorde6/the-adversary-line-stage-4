#!/usr/bin/env bash
# Run every stage-1 probe against a running service.
#
#   TK_BASE=http://127.0.0.1:8099 ./verification/probes/s1/run-all.sh
#
# Starts nothing and stops nothing: the caller owns the container. Exits non-zero if any
# probe fails, and prints which.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
export TK_BASE="${TK_BASE:-http://127.0.0.1:8099}"

failed=0
for probe in "$here"/R*.js; do
  name="$(basename "$probe")"
  out="$(node "$probe" 2>&1)"
  status=$?
  printf '%s\n' "$out"
  if [ "$status" -ne 0 ]; then
    failed=$((failed + 1))
    echo "PROBE $name exited $status"
  fi
  echo
done

if [ "$failed" -ne 0 ]; then
  echo "RUNNER FAILED: $failed probe file(s) reported at least one failing row"
  exit 1
fi
echo "RUNNER OK: every probe file reported no failing row"