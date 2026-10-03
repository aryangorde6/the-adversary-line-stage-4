# Stage-3 acceptance at `ec6a513` (product commits `26d0c99`, `3d4e09e`, `ec6a513`, all in `stage-3/`)

Verdict: **BLOCKED on one row**, and it is a single missing field. Everything else I hold is green,
including the whole stage-2 screen and API surface re-run against the stage-3 build.

## It boots, from a clean archive

    git archive ec6a513 stage-3 | tar -x -C /tmp/s3grade
    cd stage-3 && docker build -t adv-s3grade . && docker run -d --name adv-s3grade -p 8101:8080 …
    GET /health   -> {"status":"ok"}
    GET /          -> 200, 9917 bytes   (byte-identical to f4fdcb0, as reported)

## Supplied command, isolated mode

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |
| stage 3 | 7 | 7 | 0 | 0 |

Highest contiguous stage: **3**. No FAILED lines in the stage-3 log.

## Stage-2 regression surface (S3-150) — all green against the stage-3 build

`closed_day` 26/26 · `presence` 7/7 · `inert_and_widths` 10/10 · `judgment_rows` 11/11 ·
`out_of_order_lost` 14/14 · `states_set` 11/11 · `contrast_focus` 17/17 · `focus_lifecycle` 48/48 with
**0 residual** · `focus_reentry` 17/17 with **0 residual** · `focus_single_rule` 9/9 — at 375 and 1280.
**No stage-2 row regressed.**

## My stage-3 rows

| probe | result |
|---|---|
| `api_core.py` — policies and explanations | **48 / 48** |
| `terms_history_series.py` — terms, revision, history, decision, series | **30 / 31** |

## The failing row: S3-105 — the occurrence object has no `reference`

The specification's series shape is, verbatim:

```json
{"series_id": "opaque", "revision": 1, "interval_weeks": 1,
 "occurrences": [{"index": 0, "reference": "ABC12345", "exception": false,
                  "reservation": { "...": "ordinary reservation response" }}]}
```

Measured at `ec6a513`, every occurrence object carries exactly three keys:

    occurrence[0] keys = ['exception', 'index', 'reservation']
    occurrence-level reference = None      (inside `reservation` it is '50VHWPGZ')

`S3-111` requires "Each has a distinct ordinary reservation reference; references and indices never
change when dates or tables change", and the shape puts that reference **beside** `index` and
`exception`. It is not there. The information is recoverable one level down, which is why no earlier
row failed — and that is exactly the shape of defect this project spent two stages naming: the field
a client needs is absent from the object the client reads, and the value happens to exist somewhere
else. One field, one row, one commit's fix.

## What passed that was worth watching

- **`explain` is computed independently**, so S3-005's two-directional assertion is a real
  comparison: capacities and occupancy recomputed in the probe, `available` compared against them, and
  the run contained **both** available and unavailable table-slots so the comparison had two classes
  to work with.
- **No slot carries `explain` unless asked for**, and asking changes nothing byte-identically (S3-002).
- `explain` with `false`, `1`, `0`, `""`, `TRUE` -> 422 each; `true` -> 200.
- **Policy selection and versions**: no key -> 422 with a token, no token -> 401, non-manager -> 403
  `forbidden`, unknown restaurant -> 404, every one of the six required fields missing in turn -> 422
  each with **no version allocated**, rejected replays allocating nothing, `capacities` exactness in
  five directions, eight invalid values and the boundaries `1440`/`10080` accepted, and the restaurant
  detail still reporting the **fixture** while availability uses the policy (S3-040).
- **Accepted terms**: exactly the six keys with `effective_from` excluded, revision 1 at creation, a
  no-op amendment consuming neither revision nor history, a real amendment +1 with only the changed
  field in `changed`, `expected_revision` stale -> 409 `stale_revision` **before** cutoff/validation and
  `"1"` -> 422, and history's `created` entry still carrying the **create-time** terms while the
  booking moved on (S3-079 — the record, not a view).
- **404 rules**: `decision` and `history` anonymous -> 404, another account -> 404, and the two bodies
  byte-identical, so "not yours" cannot be told from "does not exist".
- **Series**: occurrence zero *is* the anchor with `exception: false`; occurrence dates recomputed in
  the probe from the anchor's local date match exactly; indices 0,1,2 with distinct references; replay
  byte-identical; `already_in_series` on a different key; 404 for another account's adoption; a real
  amendment flags **only** that occurrence and bumps the series revision once, a no-op does neither;
  cancellation retains the occurrence and does **not** mark it an exception; and a **forced** failing
  adoption leaves no partial series and no idempotency claim, so the retry is evaluated afresh.

## My own errors in writing these two probes, all caught before they reached a verdict

1. **`S3-021a` measured the wrong thing.** I sent a policy with no key *and* no token and asserted a
   key-related refusal; the service answers 401 because auth is checked first. The row now sends a
   manager's token without a key, so it isolates the missing key.
2. **`S3-005` reported two false negatives** because my occupancy model hard-coded one 90-minute
   booking while the published policy makes it 120 minutes, so two slots overlapped that I had not
   accounted for. The recomputation now derives occupancy from the seeded starts and the policy's own
   duration — and the row is stronger for it, since it reads the policy rather than assuming 90.
3. **`S3-008` used a Sunday the fixture opens.** My "closed day" was an open day; the row now publishes
   a Mondays-only policy, and asserts the `slots` key exists before reading its length.
4. **`S3-109` staged nothing.** The adoption simply succeeded, so the row about failed adoptions
   measured a success. It now has another account take the anchor's table at the first generated slot,
   asserts that setup succeeded, and only then reads the absence of partial state.
5. **`S3-109b` asserted 201 where the rule is about re-evaluation.** The conflict persists, so a correct
   retry cannot succeed; what it must not do is replay or answer `idempotency_key_reuse`. The row now
   asserts the ordinary conflict code. Asserting a wish rather than the rule would have been a red
   against correct code.

## Not measured

Groups 4 and 6 beyond the rows above (the full history event table, combined-table history, and
collective moves under policies), S3-121 driven end to end from an actual stage-2 export, and the
three ambiguities the Builder raised, which are mine to settle rather than to measure. Stage 3 is
BLOCKED on S3-105, so those are not run yet; they are listed here rather than quietly omitted.
