#!/usr/bin/env bash
set -euo pipefail

wait_health() {
  local url="$1"
  local timeout="${2:-60}"
  local end=$((SECONDS + timeout))
  while [ $SECONDS -lt $end ]; do
    if curl -sf "${url}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}
