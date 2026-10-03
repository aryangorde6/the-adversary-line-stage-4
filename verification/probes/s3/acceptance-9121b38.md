# Stage-3 acceptance at `9121b38` — PASS

**The accepted hash is `9121b38`.** `77c69f8`, `df4387d` and `e6a0830` are row-only additions
recorded against it (`git diff 9121b38 77c69f8 -- stage-3/src` empty), each graded directly at the
row-only hash and each unchanged: at `77c69f8` — `git diff 9121b38 77c69f8 -- stage-3/src` is **empty**: the
commit is row-only, the Builder's own words, so I graded it directly rather than letting the verdict
rest on its parent. At `77c69f8`, from `git archive`: `/health` ok, `/` 200 in 9917 bytes;
supplied stage 1 **120/120**, stage 2 **25/25**, stage 3 **7/7**, highest contiguous **3**;
`api_core` **48/48**; `terms_history_series` **34/34** — including `S3-105b-missing-reservation`, the
case the occurrence reference's emission exists for, which the Builder's commit makes permanent in his
own suite; and the stage-2 regression surface green with **0 residual** (`closed_day` 26/26,
`out_of_order_lost` 14/14, `focus_lifecycle` 48/48, `focus_reentry` 17/17, `states_set` 11/11).
Nothing about the verdict moved, and stage 4 remains **unmeasured**.

## The original acceptance at `9121b38`

Verdict: **PASS.** Every ledger row I hold has been checked at this hash and holds. The product change
is seven lines in `stage-3/src/series.js`; everything else in the range is verification.

## Hash discipline

    git diff 387ed26 9121b38
      stage-3/src/series.js                     |  7 +      <- product
      stage-3/verification-probes/stage3-api.mjs| 17 ++     <- rows
      verification/…                            | my probes and ledger

    git archive 9121b38 stage-3 -> docker build -> docker run
    GET /health -> {"status":"ok"}     GET / -> 200, 9917 bytes (byte-identical to f4fdcb0)

## Supplied command, isolated mode

| suite | collected | passed | failed |
|---|---|---|---|
| stage 1 | 120 | 120 | 0 |
| stage 2 | 25 | 25 | 0 |
| stage 3 | 7 | 7 | 0 |

Highest contiguous stage: **3**. Stage 4 remains **unmeasured**, not failed.

## The blocked row, closed

`S3-105` — the occurrence object now carries `reference` **beside** `index` and `exception`, emitted
from the series record rather than read back off the reservation:

    ROW S3-105 PASS  occurrence-level reference='EL1MWQEG' (nested: 'EL1MWQEG');
                     occurrence keys = ['exception', 'index', 'reference', 'reservation']
    ROW S3-111 PASS  distinct references ['EL1MWQEG','0ORYJ7I8','YM6RVX1G'], indices [0,1,2];
                     occurrence-level references identical to the nested ones

The row reads the field **at the level the specification names** and reports both readings, so a build
that moves it back down fails here — which is the property that makes it a row rather than a hope.

## Stage-2 regression surface (S3-150) — no row regressed

All ten stage-2 probes against the stage-3 build, **375 and 1280**: `closed_day` 26/26 · `presence` 7/7 ·
`inert_and_widths` 10/10 · `judgment_rows` 11/11 · `out_of_order_lost` 14/14 · `states_set` 11/11 ·
`contrast_focus` 17/17 · `focus_lifecycle` 48/48 **0 residual** · `focus_reentry` 17/17 **0 residual** ·
`focus_single_rule` 9/9.

## My stage-3 rows

| probe | result |
|---|---|
| `api_core.py` — policies and availability explanations | **48 / 48** |
| `terms_history_series.py` — terms, revision, history, decision, series | **34 / 34** |

### The case the reference is emitted for, driven

The occurrence reference is taken from the **series record**, not from the reservation, so it must
still name the occurrence when there is no reservation to read — and that state is reachable: export,
drop the series' own reservations from the document, import (204), then read the series.

    ROW S3-105b-missing-reservation PASS  GET /series with every reservation absent -> 200;
      occurrences still carry their own reference with reservation=null = True
      observed [(0, 'NNEJNHY5', None), (1, 'HOPOHGM0', None), (2, 'ODK5M62K', None)]

A value copied from the nested reservation would be `null` on all three here. That is the design claim
verified by driving it, not accepted from the report.

## Recorded as unmeasured rather than as results

Groups 4 and 6 beyond the rows above (the full history event table, combined-table history, collective
moves under policies), and stage 4. `S3-121` is recorded as **driven** by the Builder — a real stage-2
export imported into stage 3, a re-export carrying all four new stores, and that re-export imported
into a fresh stage 3 and exported identically — and as **finding a defect** that reasoning had not: an
imported booking arriving with `accepted_terms: null`, so every later accepted-cutoff check would fall
back to the restaurant's current rules with no error anywhere.

## Three rulings in the ledger, none requiring a code change

`S3-102` (`reservation_cancelled` wins when an anchor is both adopted and cancelled, ruled with the
reason) · `S3-118`/`S3-139` (`state.batch_counters` as the row's chosen quantity, with the standing note
that a row satisfied against an invented field is not satisfied) · `S3-A2` (recorded, not assumed).
Plus `S3-070a`: an imported reservation's history starts **empty**, with the exception that proves it —
generated occurrences *are* created here and each carries its own `created` entry.
