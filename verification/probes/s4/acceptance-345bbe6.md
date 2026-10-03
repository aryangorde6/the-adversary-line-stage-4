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


---

# Addendum: `379379b` graded, with a negative control

## Everything re-measured at `379379b`

| | result |
|---|---|
| supplied, mine | stage 1 **120/120** · stage 2 **25/25** · stage 3 **7/7** · **stage 4 6/6** · **highest contiguous 4** |
| `s4/write_family.py` | **9 / 9** |
| `s4/discriminator.py` | **16 / 16** |
| `s3/api_core.py` · `terms_history_series.py` · `fixture_arrival.py` | **48/48** · **34/34** · **36/36** |
| stage-2 screen suites at **1280 and 375** | `closed_day` **26/26** · `out_of_order_lost` **14/14** · `focus_lifecycle` **48/48, 0 residual** · `focus_reentry` **17/17, 0 residual** · `states_set` **11/11** |

**No stage-2 or stage-3 row regresses at this hash, including the `CD-short-window-*` pair re-worded at
`345bbe6`.**

## The negative control, because a count is not a coverage claim

**299 rows, 6/0, 47/47 — each of those is a count, and the Foreman's caution is right that a count is not a
coverage claim.** So `verification/probes/s4/negative_control.py` takes the same requests the positive rows
make and asserts **the wrong answer**, requiring each to be reported FAIL. **4/4 — four rows proven capable of
failing:**

| row | the wrong expectation, and why it is the one that would matter |
|---|---|
| `NC-001` | the documented replans body was **not** refused as 404 (it is 201) — if it were 404, the row asserting it is reached would be vacuous |
| `NC-002` | the 201 body does **not** carry the pre-conformance shape (`closure, created_at, moves, plan_id, policy_version`) — the shape row, checked against the shape that used to be there |
| `NC-003` | the three specified refusals are **not** all `400` (422 / 422 / 404) — if they were all 400 again, the 422/422/404 rows would be vacuous |
| `NC-004` | a day whose policy omits Sunday is **not** reported `open` (it is `shut`) — the discriminator's rows, checked against a state they must be able to reject |

**The first draft of `NC-002` asserted a wrong key set that turned out to be the right one**, which is itself
the finding: **I picked "wrong" by guessing, and the guess was the correct shape.** The control was rewritten to
assert **the shape the pre-conformance build actually returned** — which is the only wrong answer worth testing
against, because it is the one a stale expectation would actually carry.

## Verdict at `379379b`: **PASS**, unchanged in substance

**One row of mine remains owed and it is not a coverage debt: `S4-152`'s path debt.** Asserting the refusal is
not mutating it, so the probe that pays it belongs to the next defect round, and the standing example of
clause 29 stands. **The browser half remains reported rather than verified by me** — and at this hash the
Builder's own report identifies **three suites (`ui-messages`, `ui-a11y`, `ui-states-a11y`) last measured at
`345bbe6`**, one commit earlier, which is a stale green by clause 48's own definition and should be re-run
before the stage is closed.


---

# Stage-4 acceptance at `75bb37e` — PASS

**`345bbe6` is recorded PASS-superseded:** it is a commit where every suite and the supplied run were green
and the planner refused a feasible plan. **A full green surface is not weak evidence about the planner; it is
no evidence at all.** The walk, the measurements and the two findings from that pass all stand — the acceptance
of that hash is what is void.

## Measured by me, from `git archive 75bb37e`

| | result |
|---|---|
| supplied | stage 1 **120/120** · stage 2 **25/25** · stage 3 **7/7** · **stage 4 6/6** · **highest contiguous 4** |
| `s4/write_family.py` | **9 / 9** |
| `s4/discriminator.py` | **16 / 16** |
| `s4/negative_control.py` | **4 / 4** — four rows proven capable of failing |
| **`s4/planner_property.py`** | **11 / 11** — new; the properties the supplied run could not see |
| `s3/api_core.py` · `terms_history_series.py` · `fixture_arrival.py` | **48/48** · **34/34** · **36/36** |
| stage-2 screen suites at **1280 and 375** | `closed_day` **26/26** · `out_of_order_lost` **14/14** · `focus_lifecycle` **48/48, 0 residual** · `focus_reentry` **17/17, 0 residual** · `states_set` **11/11** |

## `S4-170`, the row the supplied run could not see, written from the specification

1. **A closure is a constraint, not an assignment.** A booking that does **not** hold the closed table is
   still considered, keeps its table, is reported `changed: false`, `moved_count: 0`, **gains no history
   entry**, and its revision does not move. **This is the case that answered `409 no_feasible_plan` at
   `345bbe6`, and it now answers 201 with the booking left alone.**
2. **Considered means _overlapping_, not _constrained_.** With two overlapping bookings and one outside the
   interval, `assignments` carries **exactly the two overlapping references, in reference order** — asserted by
   reference and not sampled, because the two sets are different sets.
3. **The objective is lexicographic**, and a party of 3 on a closed 2-seat table **must** move.
4. **Nothing may disappear**: the whole population survives the plan, by reference, with none cancelled.

## The thinness in my own row, named rather than absorbed

**Levels 2 and 3 of the objective are asserted only for presence and self-consistency.** `S4-170-3b` checks
that `unused_seats` and `moved_count` are reported, and `S4-170-3c` checks that `moved_count` agrees with the
assignment list the plan ships — **but I have not built the fixture where a seat-greedy plan that changes fewer
table sets must lose, or the one where two plans tie on both and the rank vector decides.** So:

> **my optimiser row is a thinness, not a hole, and a thinness looks like coverage.** The level-1 property is
> genuinely asserted (a party that cannot stay must move). **Levels 2 and 3 are asserted for presence and
> internal consistency only**, and a build that ignored the seat total and the rank vector would pass every row
> I wrote. The fixtures that would separate them are owed, and they are owed as rows rather than as a note.

## Verdict

**PASS at `75bb37e`.** Supplied **6/6**, highest contiguous **4**, every stage-4 row of mine green, the whole
stage-1/2/3 regression surface green with **0 residual** at both widths, and four rows proven capable of
failing by the negative control. **Two items remain open and recorded rather than absorbed:** the optimiser
fixtures for levels 2 and 3, and **`S4-152`'s path debt**, which is owed to the next defect round — asserting
the refusal is not mutating it. **The browser half remains reported rather than verified by me**, and the
Builder's own statement of that limit is the honest form: **its suites are the only browser evidence in the
room and it runs them, so they are verified by the seat whose code they exercise.**


---

# Stage-4 acceptance at `827005e` — PASS, and the accepted hash moves here

**Why the hash moves and not just the verdict: `345bbe6`, `379379b` and `75bb37e` were all graded PASS over an
optimiser that did not implement the specification's second objective at all.** Three green commits over a
planner that put a party of two on a six-seat table because that table was first in fixture order. The stage's
record now says so in those words.

## Measured by me at `827005e`

| | result |
|---|---|
| supplied | stage 1 **120/120** · stage 2 **25/25** · stage 3 **7/7** · **stage 4 6/6** · **highest contiguous 4** |
| `s4/planner_property.py` | **14 / 14** — including `S4-171c`, written for the defect the Builder found |
| `s4/negative_control.py` | **7 / 7** — seven rows proven capable of failing |
| `s4/write_family.py` · `s4/discriminator.py` | **9 / 9** · **16 / 16** |
| `s3/api_core.py` · `terms_history_series.py` · `fixture_arrival.py` | **48/48** · **34/34** · **36/36** |
| stage-2 screens at **1280 and 375** | `closed_day` **26/26** · `out_of_order_lost` **14/14** · `focus_lifecycle` **48/48, 0 residual** · `focus_reentry` **17/17, 0 residual** · `states_set` **11/11** |

## `S4-171c`, and the honest correction to my own earlier claim

**My `S4-171a` could not have caught this defect, and saying otherwise would be the wrong kind of green.** In
that fixture the only plan tying on level 1 was **unique**, so the row separated *level-1-first from
level-2-first* and said nothing about the seat term **within** a tie. My disclosure of a thinness described a
real gap — and the first separating fixture found a defect my row did not reach.

`S4-171c` reaches it, and the fixture is built so the two candidate plans are **different plans**:

```
t_4 (cap 4) is DECLARED BEFORE t_2 (cap 2)   ->  a rank-greedy search puts BBBBBBB on t_4, wasting 2 seats
AAAAAA (party 2) holds t_3 and may stay      ->  the correct plan puts BBBBBBB on t_2, wasting none
both plans change exactly ONE booking       ->  level 1 ties; only the seat total separates them
```

**`75bb37e` answered `{AAAAAA: t_3, BBBBBB: t_4}` — the rank-greedy plan. `827005e` answers
`{AAAAAA: t_3, BBBBBB: t_2}`.** And `NC-007` asserts the old answer **must not** be returned, so the row
cannot pass on the defect returning.

## What this adds to the record rather than to the ledger's optimism

**The Builder's control is the finding, and it is about instruments rather than about the planner:** with
objective 2 deleted from the comparison, `optimiser.mjs` reports failures and **`invariants.mjs` — 31
assertions that caught a planner defect the turn before — reports all green.** **A 31-assertion invariant
probe cannot see a missing middle objective at all.** That is the strongest evidence yet for the standing
instruction that every objective needs a row naming **the plan that must come out**: **a number reported
honestly by a wrong plan satisfies every assertion about numbers.**

**And the correct claim is falsifiability, not correctness.** Three fixtures passing does not make the
optimiser right; it makes it **falsifiable**, which it was not an hour ago. **A green surface over an
unfalsifiable property and a green surface over a defective one look identical from the outside**, and the
difference only ever shows up as a row someone was asked to write on purpose.

## Open, with owners

1. **`S4-152`'s path debt, plus stage 3's fixture-refusal half-application** — unpaid, and owed to the next
   defect round.
2. **The browser half is self-verified** — the Builder's suites are the only browser evidence in the room and
   the Builder runs them, so **verified by the seat whose code they exercise; 400-odd rows must not be read as
   independence**, and this seat cannot drive a browser at all.

**Verdict: PASS at `827005e`.**
