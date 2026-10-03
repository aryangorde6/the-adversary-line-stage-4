# Stage-1 reconciliation: the three live rows from the `818d24b` mapping

The Saboteur's mapping at `818d24b` reports three mutants as **NOT CAUGHT** by probes my `4540b2b`
table names as first-failing (`R005b`, `R041d`, `R053c`). I re-ran each defect myself, from a clean
scratch copy of `stage-1`, one mutant per run, each on its own port, with the mutation asserted
present in the built source before the probe ran. **All three are caught, with those rows failing
first.** Below: the exact patch, the marker proving it was applied, and the failing output.

## 1. Non-atomic idempotency — `R005_concurrency.js` — CAUGHT

    src/server.js   function withIdempotency(ctx, handler) {
                  -> async function withIdempotency(ctx, handler) {
    src/server.js     if (record) return { status: 200, body: record.response };
                       const result = handler(state);
                  ->   if (record) return { status: 200, body: record.response };
                       await new Promise((r) => setTimeout(r, 25));
                       const result = handler(state);
    src/server.js     const result = route.key ? withIdempotency(ctx, run) : await run();
                  ->   const result = route.key ? await withIdempotency(ctx, run) : await run();

    mutation marker in src/server.js (occurrences of setTimeout): 1
    server up on 8401

    ROW R005b FAIL replay count=7, expected 9 (exactly one 201 and nine 200s)
    ROW R005c FAIL 409 count=2, expected 0 — codes=["table_unavailable","table_unavailable"]
    ROW R005g FAIL second trial -> 201 count=1, 409 count=9
    ROW R005g2-1 FAIL 10 parallel identical POSTs -> 201=1 200=0 409=9

## 2. Null replay — `R041_replay.js` — CAUGHT

    src/idempotency.js   response: JSON.parse(JSON.stringify(response)),
                      -> response: null,

    mutation marker in src/idempotency.js (occurrences of "response: null"): 1
    server up on 8402

    ROW R041d FAIL replayed body = null — reference null (want MMDH087M), status null
                   (want confirmed), created_at null (want 2026-10-03T15:57:49+00:00)
    ROW R041e FAIL replayed body byte-identical to the original response: false
    ROW R041h FAIL replay after the amend -> 200, body identical to the original: false
    SUMMARY 8/11 passed

## 3. Fabricated instant for a skipped local time — `R053_dst.js` — CAUGHT

    src/domain.js   fail('invalid_local_time', placeContext(restaurant, null, wall));
                 -> return Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi);

    mutation marker in src/domain.js (occurrences of the fabricated instant): 1
    server up on 8403

    ROW R053c FAIL book 2026-03-29T02:30 in Europe/Berlin -> 201 (expected 422 invalid_local_time;
                  201 means the skipped time was fabricated)
    ROW R053d FAIL reservations after booking the skipped time = 1 (expected 0)
    ROW R053f FAIL book 2026-03-08T02:30 in America/New_York -> 201
    SUMMARY 14/17 passed

## The most likely explanation, offered as a hypothesis and not as a finding against anyone

**My own first attempt at this reconciliation produced the Saboteur's result.** I ran all three
mutants in one script; each started its own server, but all three tried to bind the same port, so
the second and third servers never came up and their probes were answered by the **first mutant's
build**:

    ===== m05 probe=R041_replay.js
    mutation marker in src/idempotency.js: 1        <- the mutation IS in m05's source
    SUMMARY 11/11 passed                             <- and its probe reported green

m05 and m06 both reported fully green against mutations that were demonstrably present in their own
source trees, because the probe was talking to a different process. A stale container, a reused port
or a shared base URL produces exactly this: a green run against a build that was never under test. I
found it only because the run was internally inconsistent — the mutation marker said one thing and the
probe result another — and asserting the fault happened before asserting the reaction is what made
the inconsistency visible.

So the reading I would put to the Saboteur is: **the three NOT CAUGHT rows are most likely a harness
isolation failure rather than three coverage gaps**, and the cheapest way to settle it is for the
mutation's own marker to be asserted in the same run as the probe. My `mutants/patch.py` aborts if its
target string is not found exactly once, and `apply.sh` additionally syntax-checks every mutated file
and re-runs each probe against an unmutated copy on its own port — that is why my runs cannot produce
a green against the wrong build.

## What I am NOT claiming

- Not that the Saboteur's patches are wrong. I ran **descriptions of the defects**, not its patch
  text, and a patch that fails to apply would leave an unmutated build that passes everything. To
  close this properly I need its exact patch text for these three, so that both sides are running a
  byte-identical mutation.
- Not that the mapping's other rows are wrong. The four rows the Foreman has already sent back as
  never-implemented are absence of evidence, and I will not write probes against mutants that do not
  exist — especially the single-timezone ones, where a probe written before the fixture exists would
  inherit the mask and report green.
- Not any change to a stage-1 requirement. These are coverage questions, not disputed readings.

## Reproducing

    bash verification/probes/s1/mutants/apply.sh              # all eleven: mutant FAILs, baseline PASSes
    bash /tmp/opencode/recon2.sh                              # the three live rows, one port each
