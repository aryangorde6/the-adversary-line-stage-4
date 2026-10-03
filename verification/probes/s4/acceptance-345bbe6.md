# Stage-4 acceptance at `345bbe6` — PASS, after the walk and one regression found in my own rows

## Supplied, measured by me, from `git archive 345bbe6`

| stage | result |
|---|---|
| 1 | **120 / 120**, 0 failed |
| 2 | **25 / 25**, 0 failed |
| 3 | **7 / 7**, 0 failed |
| **4** | **6 / 6**, 0 failed — was 4 passed / 2 failed |
| **highest contiguous** | **4** |

`/health` answering. **A stage's supplied suite is green for the first time in this project.**

## My own rows at this hash

| suite | result |
|---|---|
| `s4/write_family.py` | **9 / 9** — the documented body, the route **reached**, naive instants 422, reversed interval 422, unknown table 404, apply with `{}` 2xx and its exact key set |
| `s4/discriminator.py` | **16 / 16** — `day_state` present on a no-slot day, the three states pairwise distinguishable without `slots.length`, terms-derived by a policy change with the calendar untouched, 3b read from the policies surface, and `S4-167-cal` asserting the two calendars disagree in both directions |
| `s3/api_core.py` | **48 / 48** |
| `s3/terms_history_series.py` | **34 / 34** |
| `s3/fixture_arrival.py` | **36 / 36** — including `S4-151-control`, the positive control that a 15-minute policy yields a 15-minute grid |
| stage-2 screen suites at 1280 and at 375 | `closed_day` **26/26** · `out_of_order_lost` **14/14** · `focus_lifecycle` **48/48, 0 residual** · `focus_reentry` **17/17, 0 residual** · `states_set` **11/11** |

## The walk, five questions, run on my own rows first — and what it found

1. **Coverage.** `write_family.py`'s apply rows were **conditional on the plan succeeding**, so the documented
   apply body was only asserted when the preview happened to work — **a row that vanishes when the thing it
   checks is broken.** It now **fails** when there is no `plan_id`, and asserts the 201's key set as a shape.
2. **Reverse direction and counts.** No comparison in my stage-4 probes compares two collections of the same
   kind, so nothing bites. `seam-check` and `ui-grid` are the rows that do, and both now assert both
   directions and both counts.
3. **Precondition.** `S3-331` asserted a seeded booking's revision without asserting that the seeder derived
   it; `S3-324` asserts exactly that, so the pair covers it. `S4-151-control` depends on the policy having
   seeded, which `S3-301-policies` asserts. **Covered, but only because the neighbouring row does it.**
4. **Lossiness.** No map in my stage-4 probes keys anything by a value the surface carries; the two maps I
   do key (`after.get(key)`, the policies list) are read-only lookups over whole documents. **Nothing lossy.**
5. **Conformance.** `write_family.py` is the conformance row and it is green — **9 / 9**, which was 2 / 6 at
   `2a88cc6`. The specification's three validations now answer 422 / 422 / 404 instead of three `400`s.

## The regression, and it was mine: a stage-2 row that stage-4 work made wrong

**`closed_day`'s `CD-short-window-out` and `-in` went red at this hash, at both widths.** Per the standing
rule that goes to the Foreman first, and here is the finding: **the build is right and my row was wrong.**

The row required the word **"closed"** on any day with no slots — correct while `slots: []` *meant* shut, and
**false now that the service distinguishes shut from a day whose terms exclude every slot.** The service
reports `day_state: terms_exclude_all` for that date and the screen correctly says *"There are no times to
book … Try another date, or a smaller party"* — **which is exactly what `S4-164` requires and exactly what my
row forbade.**

Re-worded per clause 35: **the row reads the service's own `day_state` first**, asserts the closed wording
**only where the day is reported shut**, and asserts the **absence** of a closed claim where it is not — which
is the direction that actually catches a screen inferring closure from an empty slot list. 26/26 at both
widths.

**So the first stage-4 regression was a stale requirement in my own accepted stage-2 row, found by re-running
the surface rather than by reading the diff — and it is the same species as `ui-grid.mjs`'s short-window row,
in a file nobody had opened.**

## And one probe retired rather than fixed

`absent_at_e9b9f4d.py` asserts the write family is **absent** at the folder-only build. That is true at
`e9b9f4d` and false from `2a88cc6` onward, **so on a conforming build it reports red on purpose.** It is kept,
and its header now says so in capitals: **it is the evidence for the baseline attribution in §0 — "the two
failures are the two absent write families" — established by driving rather than by counting, and it is run
only against `e9b9f4d`.**

## Verdict

**PASS.** Highest contiguous stage **4**; supplied stage 4 **6/6**; every stage-4 row of mine green; the whole
stage-1/2/3 regression surface green with **0 residual** at both widths. **The browser half remains reported,
not verified by me** — no browser instrument is runnable from this seat — and `S4-160`'s per-cell population,
`S4-161`'s screen corroboration and `S4-164`'s rendered claim are the Builder's and the Finisher's rows from
my specification. **`S4-165` is satisfied by existing behaviour**, and **`S4-152`'s path-debt probe is still
owed** — asserting the refusal is not mutating it, and that belongs to the next defect round.
