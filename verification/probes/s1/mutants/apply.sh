#!/usr/bin/env bash
# Prove each stage-1 probe catches the mutant it targets.
#
# For each mutant: copy stage-1 to a scratch directory OUTSIDE the repository, apply one exact
# patch, syntax-check the result, start it on its own port, run the probe that targets it and
# require FAIL. Then run the same probe against an unmutated copy and require PASS. Nothing
# inside the repository is written to or modified.
#
#   bash verification/probes/s1/mutants/apply.sh
#
# Every service this starts is stopped by the trap below, by the recorded pid.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
SRC="$REPO/stage-1"
SCRATCH="${SCRATCH:-/tmp/opencode/adv-mutants}"
BASE_PORT="${BASE_PORT:-8210}"

rm -rf "$SCRATCH"; mkdir -p "$SCRATCH"

MUTANTS="m01 m02 m03 m04 m05 m06 m08 m09 m10 m11 m12"

wait_health() {
  local p="$1" i
  for i in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:$p/health" >/dev/null 2>&1; then return 0; fi
    sleep 0.25
  done
  return 1
}

stop_server() {
  local dir="$1"
  if [ -f "$dir/server.pid" ]; then
    kill "$(cat "$dir/server.pid")" 2>/dev/null
    rm -f "$dir/server.pid"
  fi
}

trap 'for d in "$SCRATCH"/*/; do [ -d "$d" ] && stop_server "$d"; done' EXIT

SEQ=0
start_server() {
  local dir="$1"
  SEQ=$((SEQ + 1))
  PORT_N=$((BASE_PORT + SEQ))
  ( cd "$dir" && PORT="$PORT_N" nohup node src/main.js > "$dir/server.log" 2>&1 &
    echo $! > "$dir/server.pid" )
  if ! wait_health "$PORT_N"; then
    echo "service failed to start on $PORT_N; log:" >&2
    sed -n '1,20p' "$dir/server.log" >&2
    return 1
  fi
}

run_probe() {
  local probe="$1" p="$2"
  ( cd "$REPO" && TK_BASE="http://127.0.0.1:$p" timeout 150 node "verification/probes/s1/$probe" 2>&1 )
}

printf '%-5s %-22s %-10s %-9s %s\n' ID PROBE MUTATED BASELINE FIRST_FAILING_ROW
caught=0; broken=0

for id in $MUTANTS; do
  probe="$(python3 -c "import sys;sys.path.insert(0,'$HERE');import patch;print(patch.probe_for('$id'))")"

  # ---- mutated copy -------------------------------------------------------
  dir="$SCRATCH/$id"
  cp -r "$SRC" "$dir"
  if ! python3 "$HERE/patch.py" "$id" "$dir" >/dev/null 2>"$dir/patch.err"; then
    printf '%-5s %-22s %-10s %-9s %s\n' "$id" "$probe" "PATCH-FAIL" "-" "$(head -1 "$dir/patch.err")"
    broken=$((broken + 1)); rm -rf "$dir"; continue
  fi
  syn=ok
  for f in "$dir"/src/*.js; do
    node --check "$f" >/dev/null 2>&1 || { syn="$f"; break; }
  done
  if [ "$syn" != ok ]; then
    printf '%-5s %-22s %-10s %-9s %s\n' "$id" "$probe" "SYNTAX" "-" "does not parse: $syn"
    broken=$((broken + 1)); rm -rf "$dir"; continue
  fi

  if start_server "$dir"; then
    mut_out="$(run_probe "$probe" "$PORT_N")"; mut_rc=$?
    stop_server "$dir"
  else
    mut_out=""; mut_rc=99
  fi
  mut_rows="$(printf '%s\n' "$mut_out" | grep -c '^ROW .* FAIL')"
  if [ "$mut_rc" -ne 0 ] && [ "$mut_rows" -gt 0 ]; then
    mut_verdict="CAUGHT"; caught=$((caught + 1))
    first="$(printf '%s\n' "$mut_out" | grep '^ROW .* FAIL' | head -1 | cut -c1-120)"
  else
    mut_verdict="MISSED"; broken=$((broken + 1))
    first="probe exited $mut_rc with $mut_rows failing rows"
  fi

  # ---- unmutated copy, same probe ----------------------------------------
  bdir="$SCRATCH/$id.baseline"
  cp -r "$SRC" "$bdir"
  if start_server "$bdir"; then
    base_out="$(run_probe "$probe" "$PORT_N")"; base_rc=$?
    stop_server "$bdir"
  else
    base_rc=99
  fi
  if [ "$base_rc" -eq 0 ]; then base_verdict="PASS"; else base_verdict="FAIL"; broken=$((broken + 1)); fi
  rm -rf "$bdir"

  printf '%-5s %-22s %-10s %-9s %s\n' "$id" "$probe" "$mut_verdict" "$base_verdict" "$first"
done

echo
echo "MUTANTS caught=$caught not_caught_or_broken=$broken"
[ "$broken" -eq 0 ] || exit 1