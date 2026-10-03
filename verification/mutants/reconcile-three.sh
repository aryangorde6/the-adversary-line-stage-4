set -uo pipefail
REPO=/home/aryan/band_hack/band-work/tablekeeper5
PATCH=$REPO/verification/probes/s1/mutants/patch.py
WORK=/tmp/opencode/recon
rm -rf $WORK; mkdir -p $WORK
port=8401
for id in m02 m05 m06; do
  case $id in m02) P=R005_concurrency.js; marker=server.js;; m05) P=R041_replay.js; marker=idempotency.js;; m06) P=R053_dst.js; marker=domain.js;; esac
  cp -r $REPO/stage-1 $WORK/$id
  python3 $PATCH $id $WORK/$id >/dev/null || { echo "$id PATCH FAILED"; continue; }
  for f in $WORK/$id/src/*.js; do node --check "$f" >/dev/null || echo "$id SYNTAX $f"; done
  echo "===== $id probe=$P port=$port"
  case $id in
    m02) grep -c "setTimeout" $WORK/$id/src/server.js | sed 's/^/mutation marker in src\/server.js: /';;
    m05) grep -c "response: null" $WORK/$id/src/idempotency.js | sed 's/^/mutation marker in src\/idempotency.js: /';;
    m06) grep -c "return Date.UTC" $WORK/$id/src/domain.js | sed 's/^/mutation marker in src\/domain.js: /';;
  esac
  ( cd $WORK/$id && PORT=$port node src/main.js > $WORK/$id.log 2>&1 & echo $! > $WORK/$id.pid )
  sleep 1
  if ! curl -sf http://127.0.0.1:$port/health >/dev/null; then echo "$id DID NOT START"; cat $WORK/$id.log; kill "$(cat $WORK/$id.pid)" 2>/dev/null; continue; fi
  echo "server up on $port, pid $(cat $WORK/$id.pid)"
  TK_BASE=http://127.0.0.1:$port timeout 150 node $REPO/verification/probes/s1/$P 2>&1 | grep -E "^ROW .* FAIL|^SUMMARY" | head -5
  kill "$(cat $WORK/$id.pid)" 2>/dev/null; rm -f $WORK/$id.pid
  port=$((port+1)); echo
done
