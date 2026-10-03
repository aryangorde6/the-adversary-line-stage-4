# Tablekeeper stage-4 verification ledger

**Written and committed before any stage-4 code exists**, in the order that produced four real defects
in stage 2 and two in stage 3. Ordered by grading risk, not by route order. Every row here is
**unmeasured** until it says otherwise, and no stage-4 product code has been read, because there is
none to read: `tablekeeper5/` contains `stage-1/`, `stage-2/`, `stage-3/`, `verification/`.

**Standing precedent for this ledger: stages 1–3 are accepted** — stage 1 at `7598b0a` (14 probe files,
189 rows), stage 2 at `f4fdcb0`, stage 3 at `77c69f8`, with `a69e6ba` graded after acceptance. The stage-4 service must not regress a single
accepted row, so **every stage-4 probe runs the stage-1/2/3 regression surface at the same hash, and a
regression goes to the Foreman before it is characterised.**

---

## 0. What is known and unmeasured, stated honestly

| Fact | Value | Status |
|---|---|---|
| Stage-4 supplied checks | **6**, all in one file (`stage-4/verification-probes/stage_4/test_sample.py`) | **4 passed / 2 failed** |
| Which two fail | **attributed by driving, not by opening the check file** — see below | **two of the three stage-4 write families are absent** |
| Whether those 4 passes are stage-4 behaviour | unknown | **unmeasured** |
| Stage-4 checks opened by me | 0 | **no check file has been read** |
| Highest contiguous supplied stage | 3 | stage 1 120/0, stage 2 25/25, stage 3 7/7 |

**Correction to this opening, which predicted 5 checks and 4 passed / 1 failed. The harness collects
six, four passing and two failing, and the harness is authoritative.** Measured by me at `e9b9f4d`
through the sanctioned command at stage 4, no check file opened: **stage 1 120/120, stage 2 25/25,
stage 3 7/7, stage 4 4/6**, highest contiguous **3**. My predicted figure came from a room statement
rather than from a run, and **that is the failure this table exists to prevent: a number in a ledger that
was never measured.** It is corrected here against my own measurement.

**What the run does settle, from the file rather than from the count: stages 1–3 are green, so the
second failure is not a regression carried forward from the accepted build** — the Builder's useful half,
which I confirm independently.

**Which two fail, attributed by driving rather than by opening a check file.** The report carries per-file
counts (`4/6`, one file) and no test identities, so I did not guess at names. Instead
`verification/probes/s4/absent_at_e9b9f4d.py` drives each stage-4 entry point at this hash — **8/8** —
and records what the service actually does:

```
S4-001  POST /restaurants/r_anker/replans              -> 404 not_found   route absent
S4-002  POST /restaurants/r_anker/replans/{id}/apply   -> 404 not_found   same missing family
S4-003  POST /series/{id}/amend                        -> 404 not_found   second missing family
S4-010  GET  /restaurants/r_anker/policies             -> 200 {policies}  stage-3 surface intact
S4-011  GET  /availability                             -> 200 with slots[]
S4-012  GET  /series/ser_x (absent series)             -> 404
```

**So the two failures are stage-4's two write families — planning/replanning and series amendment — and
not a broken folder**, which `S4-010`/`S4-011` establish by showing the stage-3 surface and the seam
instrument are both alive in `stage-4/`. **The check identities are supplied by the Builder, under a recorded and narrow authorisation
(clause 27): identities only, never expectations.** **The checks tree is outside this seat's sandbox
entirely** — `tablekeeper/test` is denied at the tool level — so the attribution above could not be
replaced by a peek even in principle, and the two must be read together rather than one replacing the
other. **Stating that limit is the closure, not a deferral** — the discrepancy is now
closed on the side that is measurable, with the other side named as a boundary rather than guessed at.

**And the count itself is part of the record, not a detail of the run (clause 26).** My opening predicted
5 from a room statement; the harness collects 6. **A sample suite's size belongs in the ledger's opening
table beside its pass count**, because a reader comparing the two finds it in one command.

**Stage-4 base: `549a104`.** The round and this ledger name the same build. `e9b9f4d` creates the
stage-4 folder from it and rewrites three comments across the stage boundary (clause 25).

**The four passes are not assumed to be stage-4 behaviour.** A stage's first sample suite usually partly
measures the stage before it — stage 3's supplied suite was the first thing that touched policies and
series, and the four rows that passed there were satisfied by a build with *no* policy support at all.
**So each of the six checks is, until measured, a statement about `549a104`'s behaviour wearing a stage-4
label.** The ledger's first job is to find which, and the honest way to do that is not to read the
checks.

## 0.1 The opening question: what stage 3's fixtures cannot say

**It is not a list of missing routes. It is four store keys a fixture may declare, that `/_test/reset`
accepts with 204, and that are then silently dropped** — measured by the Builder at `e6a0830`, before
this ledger existed:

```
fixture declares a 15-minute-slot policy, one series, one history entry,
                 and batch_counters: {r_anker: 7}

reset -> 204
GET /restaurants/r_anker/policies -> {"policies": []}
grid starts      -> ['18:00','18:30','19:00','19:30','20:00']   (15-minute would give 18:00,18:15,18:30,…)
policy_version   -> [0]
GET /series/ser_x -> 404
history of the seeded reservation -> []        (the fixture declared one)
exported state   -> policies: 0  series: 0  history: 0  batch_counters: {}
```

`stateFromFixture` starts from `emptyState()` and fills only users, restaurants and reservations, so
the four stage-3 stores stay empty **while the caller is told the reset succeeded.**

> **a fixture that reports success for state it did not seed is worse than a fixture that lacks the
> capability** — the refusal is legible and the 204 is not.

The consequence a row author needs: **a probe author writes a fixture, sees 204, and asserts against
policy 0 while believing they are asserting a published policy.** Every assertion would still be *about*
policy 0 and nothing would be red. **This is the absence-read-as-a-state family for the sixth time**
(`explain` absent, `accepted_terms` null, the occurrence `reference` one level too deep, and now a 204
standing in for four stores) **and the first instance where the lie is in the success code rather than in
a field.**

### What the defect actually was, and at which hash each half holds

**Named by hash, because a ledger that describes a fix the round's build does not contain is the same
class of error as a comment describing a shape the code does not emit — and clause 16 exists because of
a defect nobody had to find.** Measured on both builds by the Builder, not inferred from commit order:

| | `77c69f8` and earlier | `a69e6ba` |
|---|---|---|
| a fixture declaring `policies` | **204, silently dropped** | **422 `fixture_unsupported`** |
| a seeded `revision: 5` with `accepted_terms: null` | **204, accepted** | **422 `fixture_unsupported`** |

**So: the four keys are refused at `a69e6ba`**, with the sentence naming the working door
(`/_test/import`) and `/_test/export` and `/_test/import` unchanged; **at `77c69f8` and earlier they were
accepted and dropped, which is the defect.** `a69e6ba` is the hash the stage-3 defect round plants
against, so the round does not test it — and neither does `S4-151`, which is about the stage-4 door.

**The Builder's reframing of what the defect was, which replaces the Foreman's earlier phrase and is
the more useful one:** it was **a fixture surface that never grew with the stage** — stage 1 and stage 2
fixtures are complete for their stages, and stage 3 added four stores **without extending the door that
seeds them**. The general form, and it is the shape stage 4 inherits:

> **state without a surface to state it, or a surface that grew less than the state it serves.**

**That is also why the fourth store is the one that shows it:** `idempotency` is seeded through booking
calls, so nothing looked missing until policies and series arrived with no way in. **It is the same
failure as `S3-105`'s occurrence reference existing one level too deep, and as `explain` being absent
until stage 3 added it — and none of the three is visible from any single row.**

**Both halves of `S4-150` are true only at `a69e6ba` or later**, which is what decided the round's hash:
at `77c69f8` the seed half is open, so a round planted there would report a defect this room has already
ruled on as a live finding — worse than not planting it, because it teaches the reader the checks found
it. My §0.2 decided the hash question by being written first, which is the right way round.

**`S4-151` and `S4-152` are satisfied in stage 3 at `549a104` or later, graded directly, and never
banked.** `a69e6ba` refused the four keys; `549a104` **removed the terms comparison entirely** and so
changed what the reset door accepts — which changes what these two rows mean. They are re-measured at
`549a104`+: `fixture_arrival.py` **36/36** there, including `S3-321`/`S3-322` (a declared `accepted_terms`
is refused outright), `S3-324` (with nothing declared, the stored terms follow the rules in force),
`S3-327` (an unrecognised field in a declared terms object is refused rather than stripped), and
`S3-340`/`S3-341` (a refused fixture leaves the state byte-equal)., with two findings that
change how stage-4 rows must be written. First, **the refusal names the door that
works, and I checked that it does**: all four keys → 422 `fixture_unsupported` naming the key and the
import door; a document carrying the three stores **under `state`** imports 204 and **really seeds them**
(policies 1, series 1, `batch_counters` 7); a refused fixture leaves the exported state **byte-equal**.
Second, **the stores are absent from an export while empty**, so a stage-4 row asserting that the export
carries them must seed them first — **absence against an empty state cannot be told from silence**, and
that is a stage-4 version of the mistake this section exists because of.

**A stage-4 fixture that genuinely expresses policies, series, history and counters is therefore still
missing, and it is stage-4 work.** `S4-151` and `S4-152` are re-measured on a stage-4 build rather than
banked; what stage 3 supplies is the refusal, not the capability.

**Consequence, stated against the rows rather than left to be discovered: every stage-4 row that needs
seeded stage-3 state is unmeasurable until that fixture exists.** That is `S4-123`'s terms-driven
substitution (which needs a published policy per booking), `S4-130`'s half-open boundary against
applied closures, `S4-137`'s series-moved-by-a-plan, and `S4-161`'s imported series. **They are written
against a door that does not yet exist, and the honest state of each is "unmeasurable", not "pending".**

**The route is named per row, because the two routes have different properties and a reader needs to know
which one a row depends on:**

| row | route it depends on | property of that route |
|---|---|---|
| `S4-123` terms-driven substitution | `/_test/import` (today) or a policy-seeding `/_test/reset` (`0.6`) | import **carries state verbatim** and re-derives nothing, so it cannot itself express "derived from a policy that was published in this room" — the row needs a real publication, so **import alone is insufficient** |
| `S4-130` half-open boundary vs applied closures | import for the closures, **driving for the plan** | closures are stage-3 state, but the plan is stage-4 behaviour and must be driven |
| `S4-137` series moved by a plan | import for the series, **driving for the plan** | as above: an imported series occurrence must survive a driven plan, which is also `S4-161`'s subject |
| `S4-161` imported series with moved and cancelled occurrences | `/_test/import` only — that is the whole requirement | no reset can express it, because the document *is* the subject |

**So the choice is recorded rather than defaulted into: state is expressed through `/_test/import`, and
stage-4 behaviour is always driven.** The cost is named too — **every import-based row carries a second
derivation in the room (the document I write) beside the one in the code**, and this stage has produced
three defects from a second derivation, so those rows cross-check the imported state against what the
service derives rather than trusting the document.

## 0.2 The second arrival path — measured **open at `77c69f8`**, closed at `a69e6ba`

At `77c69f8` and earlier a reservation could be **seeded** with `revision: 5` and `accepted_terms: null`,
and the fixture validator accepted it:

```
revision honoured -> revision=5   terms=null
```

That is precisely the inconsistent state `S3-121` found in the **import** path and the Builder fixed
**there** — so at `77c69f8` the two arrival paths could still be made to disagree, from a fixture,
without either of them being wrong about what it was asked. **One path was fixed; the other could still
express the same defect.** Closed at `a69e6ba`: `revision: 5` with null terms, `revision: 2`,
`revision: 0`, `series_id` and `series_index` are each refused, and terms differing from the derived
policy-0 ones by one field are refused rather than coerced. Row `S4-150` carries both halves, because *"the import path derives policy-0 terms"* and
*"the seed path cannot produce a booking the import path would refuse"* are **one requirement about two
paths**, and stage 2's `booking-form` lesson applies: **the state that does not exist must not be
expressible.**

## 0.3 The boundary: what a fixture *can* express, so stage 4 knows its reach

All four measured at `e6a0830`:

- **Two timezones in one fixture are accepted**, and a local 08:00 Tokyo booking stores a `starts_at`
  whose **UTC date differs from its local date** — cross-date selection is expressible.
- **A manager of one restaurant and not another** is accepted; publishing is **201 on one and 403 on the
  other** — per-restaurant authority is expressible.
- **A nonexistent local time is refused** — 02:30 on the spring-forward day gives 422
  `invalid_local_time` — so **the DST gap cannot be *seeded* and can only be *reached***, by requesting a
  date whose policy makes it land there. **Any stage-4 row about a skipped local time in a generated
  occurrence depends on that route existing**, and this ledger says so rather than discovering it when
  the row cannot be driven.
- **Unknown tables and three-table sets are refused** with 422 — occupancy cannot start in a state the
  booking path would refuse.

## 0.4 The exposure stage 4 inherits: a seam, not a screen

`S3-150` said *"no new screens is not no work"*, and the specific exposure is that **the grid and
`explain` are two answers to one question and nothing compared them.** A service change could leave a
cell's `data-available` disagreeing with `explain` for the same slot and **every existing row would still
pass** — the screens suites assert the grid is internally coherent, the API suites assert `explain` is
correct, and neither notices the two disagreeing. **Two suites each asserting their own component is
exactly how a seam defect survives to the end of a stage.** Closed at `e6a0830` by the Builder's
`seam-check.mjs`, 4 rows, in a real browser, including under a published policy that flips eight cells.
**Stage 4 inherits that seam and must assert it rather than inherit it** — replanning changes
availability underneath the grid, so `S4-160` re-drives the grid against `explain` **after** a plan is
applied, which is the state where the two answers can drift.

## 0.5 Two targets, neither of them a screen row

1. **Two arrival paths computing the same derived value.** `/_test/reset` and `/_test/import`
   disagreed about policy-0 terms and shipped a silent null, and **reading the code showed nothing
   wrong.** Anywhere this codebase derives the same fact in two places is the most fertile ground in it.
   Stage 4 adds at least two more pairs: **preview vs apply** deriving the same plan, and **seed vs
   import** (`S4-150`). A differential row that reads both paths and compares is the only thing that
   sees this class.
2. **Anywhere a field's absence could be read as a state.** `explain`, `policy_version`,
   `accepted_terms`, `revision`, an occurrence-level `reference`, a 204 for four stores — **five times
   across three stages, and still the most productive defect class this project has.** Stage 4's
   candidates, to be asserted rather than assumed: `changed` on an assignment, `moved_count` when
   nothing moved, `restaurant_revision` on a preview, a plan with no assignments, `plan_id` after a
   409, and the whole 201 body on a replay.

## 0.6 The stage-4 fixture contract, written before the rows that depend on it

Several stage-4 rows are **unmeasurable until a fixture can express stage-4 state**, so the door's
contract is written here rather than discovered while a row fails to be drivable.

> **`/_test/reset` should accept exactly what stage 4 adds as _state_, and nothing that stage 4 adds as
> _derived_. The dividing line is which of them can be recomputed from the others.**

| key | shape the rows need | derivable? |
|---|---|---|
| `policies` | `{ policy_version, effective_from, slot_minutes, reservation_duration_minutes, cancellation_cutoff_minutes, opening_hours, capacities }` per entry, **in publication order — not sorted**, because order is what `S3-029`/`S3-038` assert | no |
| `series` | `{ series_id, user_id, restaurant_id, anchor_reference, count, interval_weeks, revision, occurrences: [{ index, reference, exception }] }` | no |
| `history` | per reservation `[{ reference, seq, at, event, changes, revision, accepted_terms }]`, `seq` per reference from 1 | partly — `revision` and `accepted_terms` are |
| `batch_counters` | `{ restaurant_id: integer }` | no |

**Three constraints, each a way a row becomes silently unmeasurable:**

1. **`policy_version` numbers must be preserved verbatim, not renumbered** — and the same for `seq`. A
   row asserting *"the tie went to the greater version"* needs two policies sharing an `effective_from`
   with distinct versions. **If the door assigns versions by position, that row cannot be written at
   all**, and it would be found as an unmeasurable row rather than as a missing capability.
2. **The validation must be the _import_ validation, not a second one.** A policy that `/policies` would
   refuse — duplicate weekday, `capacities` not naming exactly the tables — must be refused by a fixture
   too, **or the fixture becomes a door for states the product cannot reach.** That is
   *"state without a surface"* **inverted**: not state with no way in, but a way in to state that should
   not exist. **The surface rule cuts both ways: a surface must not be wider than the product it seeds.**
3. **`history` and `batch_counters` are only worth seeding if a row needs a state that cannot be reached
   by driving.** `idempotency` hid the whole four-key defect because it *is* reachable by booking. If
   history can be driven to any state a row needs, seeding it **adds a second derivation to keep in step,
   and this stage has now produced three defects from a second derivation.**

**And the rule for what the door must never accept, which is a rule and not a preference:** the ability
to declare a reservation's `accepted_terms`, `series_id` or a non-1 `revision`. Those are derived or
allocated, and **a fixture that asserts them is the two-arrival-paths defect with a different door** —
which is why `549a104` refuses a declared `accepted_terms` outright rather than comparing it, leaving one
rule and no equality surface at all. **`series.occurrences[].reference` _is_ accepted**, because after
`S3-105` it is the occurrence's own field and not a lookup — the same distinction, in the other
direction.

## 0.7 What the screens' side cannot say, measured — and why it is a service requirement

**The screen has three inputs — the availability response, the reservation detail, the reservation list —
and nothing anywhere says a day is closed.** A day with no `opening_hours` entry and a fully-booked day
return the **same keys**; they differ only in `slots: []` versus `slots` present with every
`available_table_ids` empty. Both are 200, tiled and unbooked alike.

> **the service must distinguish _shut_ from _open with nothing free_ from _terms that exclude every
> slot_ — a screen may state a day as closed only when the service has said so.**

**This is urgent in stage 4 rather than merely tidy.** The Finisher's closed-day sentence is currently
justified by `slots.length === 0` **and by nothing else.** Stage 4 derives availability from *terms*, so
**a day whose terms exclude every slot returns `slots: []` and the screen calls it closed** — a guess
dressed as a fact, and the failure stage 2 committed twice: the hidden grid, and the sentence telling a
diner on a shut day to try a smaller party. **If the terms-driven service cannot distinguish those
states, that is a service requirement and the screen's obligation is to say less, not more.** Rows
`S4-163` and `S4-164` below.

**Two further limits, measured:**

- **`available_options` carries `capacity` alongside `table_ids`** — `[{"table_ids":["t_2"],"capacity":4}]`
  — and it is the field paired rows are built from. **Under the terms-driven substitution a pair's summed
  capacity may stop being the thing that decides it**, so the pair-cell half of the per-cell agreement
  instrument becomes load-bearing. **`S4-160` therefore asserts its population explicitly instead of
  sampling singles**, because the pair half is the half that has been silently skipped before.
- **A reservation's detail carries `revision` and `accepted_terms` and nothing about whether those terms
  are still valid.** A screen can show a booking was accepted under terms; **it cannot show whether those
  terms still apply.** If terms drift from a booking, **no screen row anyone can write catches it** — the
  same shape as `explain` before stage 3: **a field that exists is not a field whose meaning a client can
  check.** **My ruling, on the Builder's prior: validity is _derived_, not published, and no boolean is added.**
  A derived answer is not the same as a published claim, and if validity is derivable from what the
  response already carries then **a boolean publishes a second claim about the same fact and buys a row
  rather than a property** — the equality-comparison mistake, in a different costume. **The inputs are
  named in `S4-165`: the booking's `accepted_terms`, and the policy in force for its `starts_at_local`.**
  So this is a service row and nothing on the screen side can hold it; putting it in a seam row would
  assert the screen can verify something it cannot, which is the mistake clause 7 exists to prevent.
  **The remaining requirement is that both sides be reachable together**, which makes `explain` on the
  booking's slot load-bearing rather than incidental.

---

## The pattern behind four of this stage's rows, which is a row-authoring rule

**`S4-154`, `S4-137`, and the terms-driven substitution in `S4-123` are the same species, and so is
`S4-153d` below:** *a semantic that no single-item row can reach, because at the unit the wrong
behaviour is indistinguishable from the right one.*

- **a commit-once semantic** — one idempotency record per key, written once;
- **a terms-driven substitution** — capacity checked against the booking's own terms, where
  table-driven and terms-driven agree on every booking whose party size fits both;
- **a whole-plan increment** — `S4-154`: a per-booking increment is invisible to any single-booking row;
- **a per-series increment** — `S4-137`: indistinguishable from a per-occurrence increment unless a
  second, no-op-for-that-series plan is in the test;
- **two derivations of one value** — `S4-153d`: indistinguishable unless the case is one where a naive
  implementation *would* diverge.

**The rule that follows, and it is the reason each of those rows is written the way it is: a row that
can only fail if the test contains a case where the wrong behaviour is indistinguishable from the right
one is not a row yet.** It is an assertion that passes unless the fixture happens to contain the
distinguishing case, and clause 6 applies to it in a new costume — the status is not the signature, and
here neither is the value.

---

## Standing clauses, restated in my own words

**All twenty apply to every stage-4 row. They restate at the top of every stage-4 probe file too,
because they have now failed to travel into a new file twice.**

1. **Pin the hash.** Clean clone, `git archive <hash> stage-4`, build from that, and measure only that.
   A verdict on a commit that is not the built commit is not a verdict.
2. **Never edit product source.** Verification only. Defects are reported, not fixed by me.
3. **Do not open the supplied check files.** Run supplied checks only through the sanctioned harness.
4. **The service you measure must be the service you started.** Probe the base URL actually served by the
   container that answered `/health`; record the port, the image id and the hash together.
5. **Before reporting a miss, establish the mutant is reachable.** An unreachable patch is not a
   defect; it is a patch with no call sites. Prove reachability or record it as measured-unobservable.
6. **The status a defect arrives with is not a reliable signature of the defect.** Eight distinct
   mutants have arrived as 200, 400, 409, 422, 500 and a silent null. Assert the body and the state, not
   the code.
7. **Assert shape, not value, where the specification names a shape.** A row that checks a field is
   non-null passes a build that emits the wrong field. **A probe written the other way round would have
   called the pre-fix build correct** — that is the whole argument, made by the row that motivated it.
8. **Every occurrence of a keyed collection is keyed in the assertion**, in both directions: absent
   keys and unexpected extra keys are both failures.
9. **Distinguish refusal from absence.** A 404 that means "not found" and a 404 that means "refused" are
   different rows with different causes; conflating them is how a rejection policy hides behind a lookup.
10. **No-op writes must be measured as no-ops.** Replays, previews, all-no-op amendments and
    idempotent repeats change nothing and increment nothing — assert the counters, not the 200.
11. **Idempotency is keyed by (route, key) and survives 4xx, across paths and per user.** A key burned by
    a failed attempt is a defect; a key that replays across routes is a defect.
12. **A fixture must express what the row needs, and must refuse what it cannot.** See `0.1`: a 204 for
    state that was not seeded is worse than a 422.
13. **When a requirement says "no booking may disappear", assert the whole population survives** — count
    before and count after, by reference, not by spot-checking a few.
14. **Concurrency claims are asserted with real concurrent requests**, not by reading the code path. A
    claim of atomicity tested with a sequential replay has tested nothing.
15. **A stage's own suite is not evidence for the stage.** It passed in stage 3 on a build with no
    policy support; measure behaviour, then attribute.
16. **An invariant believed rather than produced.** A comment describing a shape the code does not emit
    is a field defaulted rather than derived, one layer down.
17. **Assert the reason a design exists, not only its behaviour.** If a field is emitted rather than
    looked up, the row must exercise the case the emission was for, or a lookup of the nested object
    would pass every assertion in the file.
18. **A row that iterates a subset and reports agreement over it is green about a population it never
    touched — assert the population, not the sample.** (From the Builder's map that indexed only singles
    and silently skipped every pair cell while reporting agreement.)
19. **A differential row must assert that the difference occurred; otherwise it is a thing compared with
    itself.** (Same source: "before" read after publishing, so the build agreed with itself.)
20. **A fixture that reports success for state it did not seed is worse than one that lacks the
    capability** — the refusal is legible and the 204 is not. The general form: **state without a
    surface to state it, or a surface that grew less than the state it serves.**
21. **Inert is not agreement.** A byte-equal export before and after an operation proves the operation
    changed nothing; it does **not** prove two derivations of the same value would agree if either
    changed. Those are different properties and only the second is the defect, so a row about two paths
    must **compare the two derivations directly against an independent computation the probe makes
    itself** — never against the other path's own output, and never against an unchanged state.
22. **Assert that the two sides could differ.** A differential row whose two sides are trivially equal
    passes for free and means nothing. The row must contain a case where a naive implementation *would*
    diverge, and **fail if it does not** — otherwise it is a thing compared with itself (clause 19).
23. **A row that asserts presence must first establish there is something to be present.** The four
    stage-3 stores are absent from an export while empty, so *absence against an empty state cannot be
    told from silence*: my own first draft asserted the export carried all four, against a state holding
    none, and **passed for the wrong reason.** Assert against a population that contains the thing.
24. **A refusal the author cannot account for is barely better than the success that lied to them** —
    both leave the author stuck. One said `204` and seeded nothing; the other said `422` and refused
    something correct. **A refusal that is *wrong* is worse than no refusal**, because the author cannot
    distinguish it from the state being genuinely unsupported.
33. **A requirement can be wrong in the direction its author intends to prevent, so a ruling is measured
    against the build's own conventions before it is implemented, not after.** `S4-167`'s precedence was
    ruled twice — once by the Foreman, once by me — and both times from the restaurant's calendar, which
    is not where this product reads hours from. **Implementing it as ruled would have reported `shut` over
    seven bookable times: the row producing the defect it exists to prevent.** A carefully reasoned
    requirement is still a guess until something drives it.
31. **A measurement whose failure mode is silence must have its setup checked first**, because silence is
    indistinguishable from slowness **and slowness is the more comfortable story.** All four screen suites
    read their base URL from `process.argv[2]` with **no connection timeout**, so a wrong URL produces
    silence rather than an error — and a 20-minute silence was reported as a hang and as a flaky suite
    before the invocation was checked twice. **A suite must also assert it reached its service**
    (`GET /health`) before running a single row, so "I could not start it" and "it found nothing" can never
    look alike.
32. **One argument must have one convention, and an undocumented second convention is a trap with the
    reader's name on it.** `verification-probes/` carried both `process.env.BASE` (the two API suites) and
    `argv[2]` (the four screen suites), **with a README documenting only the argv form** — so the env
    convention could only be learned by reading the source, which is exactly what a verifier should not
    have to do. **Where an instrument's convention is discoverable only from its implementation, the
    convention is the defect**, and the fix is to accept both forms and document both.
30. **A row's green tells the reader less than it appears to when a subset of its assertions is
    load-bearing, and the row must say which.** A row with a hole announces itself; **a row whose visible
    green overstates its coverage does not.** `S4-167` is the standing example: `terms_exclude_all` has
    exactly one producing configuration, so if the implementation answers `shut` whenever `slots` is empty,
    **assertions 1 and 2 still pass and only assertion 3 — the terms-driven one — catches it.** The row
    therefore names assertion 3 as load-bearing. **Naming the load-bearing assertion is part of writing
    the row, not a postscript to it.**
28. **A probe narrower than its row is a check of a smaller requirement, and it reports green about it.**
    So **before any defect round, walk each row its probes will defend against the probes themselves** —
    every key, every branch, every population — and record the walk in the report. This has happened four
    times in this project, and the third instance was in **my own** file after I wrote the clause from
    someone else's instance of it.
29. **Distinguish coverage debt from path debt.** A probe narrower than its row is fixed by **writing the
    missing coverage**; a defect no probe mutates is fixed by **mutating the path**. **Asserting a
    requirement is not mutating it**, and only the first is paid by adding rows.
27. **Independence is a property of the record, not of the seat — so any authorisation to read supplied
    checks must be written down, with its scope** — *and so must any authorisation that turns out to have
    been unnecessary, because that is the more useful fact.* **Corrected at `1e56016`: the premise of mine
    was wrong.** I recorded that the two failing checks' identities could be known only from inside the
    file. **They were never hidden: the harness prints a `FAILED` line per failure carrying the test id and
    the assertion message, so a check's identity is knowable from the log of the very run that executes
    it.** The Builder had been reading that log since stage 1. So:
    - **the checks tree is not the only route to a check's identity, and the route that exists is the
      command's own output** — a later reader told only "this seat may not read the checks" is told
      something narrower than the truth;
    - **the authorisation is recorded as unnecessary in the event**, while the fact that it was given is
      recorded too, because recording it was right and its redundancy is the lesson;
    - **the margin named rather than let pass:** the log's assertion strings carry a little of each
      check's *content* — the route, the expected status — which is marginally more than a bare name and
      is information already measured by driving. **The fix for that margin belongs in the harness's log
      format, not in a seat's restraint.**
    **Both supplied names agree with the drive-based attribution** (`test_a_closure_preview_returns_a_plan`
    → the planning family, `test_series_clock_time_can_be_changed` → the series family), and the Builder
    reports it looked for disagreement first. **Identity and attribution are separate pieces of knowledge,
    and only driving supplied the second.**
26. **A sample suite's size is part of its record, not a detail of the run.** The pass count and the
    check count belong in the same sentence: *six checks, four passing, two failing* is one fact, and
    **"5 checks, 4 passed / 1 failed" is a different fact, not a rounding of the first.** A number in a
    ledger that came from a conversation rather than from a run will disagree with the run, and the
    reader who finds it is not the person who wrote it.
25. **A comment explaining a decision is not neutral — across a stage boundary it becomes the design's
    apparent intent, and a reader implements what the comment says rather than what the code refuses.**
    Rewriting a comment across a stage boundary is not tidying; **it is correcting an instruction.** At
    `e9b9f4d` `fixture.js` said "the stage-3 stores" and explained why a 204 that seeds nothing is worse
    than a missing capability — **in stage 4 that reads as the intended design.** This is the third
    instance of the family in three stages: the occurrence shape documented and not emitted; a design
    whose justification nothing tested; and **a refusal documented as if it were the design**, which is
    the worst of the three **because it is indistinguishable from a deliberate limitation.** The sharp
    corollary for `S4-151`: a reader who implements from the comment instead of from this ledger builds
    the **refusal** instead of the **capability**, and `S4-151`'s stage-4 half will look unimplementable
    for a reason that is only documentary.
---

## A. Arrival paths (highest risk: two paths, one fact, and a 204 that lies)

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-150` (**both halves true only at `a69e6ba`+**) | Seed and import must not be able to express the same inconsistent booking. Both halves: the import path derives policy-0 terms (true since `387ed26`), **and** the seed path cannot produce `revision: 5` with `accepted_terms: null` (true only at `a69e6ba`; **open at `77c69f8`**). | Fixture-seed that state → **422**; and a differential row: seed a booking, export, import the export, compare the two bookings' `revision`/`accepted_terms`/terms-derived quantities field by field. | The `S3-121` defect returns through the other door. Fixing one arrival path and leaving the other able to express the state is the defect, not the fix. |
| `S4-151` (**re-measured at `549a104` or later**; refusal satisfied there; **capability still missing**) | `/_test/reset` must refuse the four keys it cannot seed, naming the key and the door that works — **and, in stage 4, be able to seed them.** | At `a69e6ba` this is 422 `fixture_unsupported`, key named, import door named, import verified to really seed (`S3-303`/`S3-304`). **The stage-4 half is the positive control:** a fixture that declares a 15-minute policy, one series, one history entry and `batch_counters` must reset **204** and the grid must then read **15-minute slots** — so a row cannot assert policy 0 while believing it asserts a policy. And a store that holds something must appear in the export: **absent while empty cannot be told from silence** (`S3-302a`). | A probe author writing a stage-4 fixture gets 204 and believes it seeded a policy, and every downstream assertion is *about* policy 0 with nothing red. **That is the defect this row's second half exists to make impossible rather than merely unlikely.** |
| `S4-152` (**re-measured at `549a104` or later**; **a probe is owed — see _Probes owed_, and the stage-3 round missed this at `a69e6ba`**) | A refused fixture changes nothing at all: **no store may be half-seeded**. | Byte-equal full-state export around a refused reset — for each key alone, for all four together, and for a fixture carrying a refusal alongside legal seeds. Then the split-refusal half: **a build that refuses one key and silently drops another is caught**, which is the mutant this row now has a job for. | A refusal that half-applies is worse than no refusal. **The refusal is now load-bearing behaviour at `a69e6ba`** — it is a new code on a new path — so a mutant returning 422 while writing some declared stores passes every other row in this section. |

## B. Preview and apply: revisions, atomicity, idempotency

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-101` | `POST /restaurants/{id}/replans` requires a manager **and an idempotency key**. | Non-manager → 403; missing key → the spec's status (**ambiguity A1**); a valid key twice → same `plan_id`, no second plan, no revision change. | A preview that increments anything is a silent state change. |
| `S4-153` | **Preview stores only a plan**: no closure, no occupancy change, no reservation revision, no history entry. | Full-state export before and after a preview: **byte-equal**. `restaurant_revision` unchanged; each considered booking's `revision` unchanged; history unchanged. | **Inertness, not agreement (clause 21).** This row is necessary and not sufficient: it cannot see two derivations of the same plan disagreeing. `S4-153d` is the row for that, and it is why the class in `0.5`(1) is not closed by this one. |
| `S4-153d` | **The previewed plan and the applied plan are computed independently and must be equal in every element a booking will be written from.** Drive a preview, apply it, and compare **element by element** — reference, `table_ids`, `changed`, and the terms/time/identity fields each booking is written with — against **a second derivation this probe computes itself** from the fixture's own capacities, terms and closures. **Never against the preview's own output, and never against a byte-equal export.** Plus the clause-22 half: the fixture must be one where a naive implementation **would** diverge — a preview that reused apply's partial state, or that re-derived capacity table-driven instead of terms-driven — and the row **fails if the two derivations turn out trivially equal**. | A preview/apply pair that agrees because it is the same code called twice. `S4-153` cannot see it; only a direct comparison against an independent derivation can. |
| `S4-154` | `restaurant_revision` increments **once for the whole plan**, not per moved booking. | A plan moving three bookings increments exactly one. | Per-booking incrementing is the obvious wrong answer and is invisible to any single-move row. |
| `S4-155` | The revision counter increments once for each successful new booking, real amendment, cancellation, policy publication and plan application — **and not** for no-ops, failures, previews or replays. | A single counter walked through all eight transitions, asserting the value at each step. | A counter that is right for plans and wrong for the other five transitions is the common shape. |
| `S4-156` | Apply requires a manager and an idempotency key; returns 201 with `plan_id`, `restaurant_revision`, `reservations` covering every considered booking in reference order. | Body key set exactly as named; `reservations` in ascending reference order; `len(reservations) == considered`. | A response that omits unmoved bookings satisfies a weaker reading and hides data loss. |
| `S4-157` | Unknown plan, or a plan from another restaurant → 404. | Both, plus a plan id that is well-formed but absent. | 404 conflated with refusal. |
| `S4-158` | Any intervening restaurant revision invalidates the plan → 409 `stale_plan`, changing nothing. | Preview, then make any revision-moving write, then apply → 409 and **byte-equal export before/after**. **A closure at another restaurant must NOT invalidate it** — the positive control, same fixture. | One half of this row is the trap: a build that invalidates on any write passes the negative half and fails the control. |
| `S4-159` | A plan already applied under a **different** key → 409 `plan_already_applied`; replay of the **successful** key → the original response with 200, even after later changes and cancellations. | Both keys, then a later write, then replay again → still 200 and the identical body. Assert the body equals the first response field by field, not merely that it is 200. | Replay returning a fresh body is the defect that only appears after a later write. |
| `S4-160a` | Application is atomic: concurrent applications must not leave partially moved bookings. | Two concurrent applies of the same plan → one 201, one 409; and after both, **every** considered booking is wholly moved or wholly unmoved — never a mixture — with matching `revision` and history counts. | Sequential replays test nothing here (clause 14). |

## C. The planner's optimisation order

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-120` | Among feasible plans, minimise in order: (1) number of bookings whose table set changes, (2) total unused seats, (3) the vector of option ranks in ascending reservation-reference order — singles in fixture order, then pairs in declared order, from 0. | Three fixtures, one per level, each with a build that could plausibly win on a later level. `moved_count`, `unused_seats` and the **rank vector** read off the assignments; the vector is compared per reference in ascending order. | A planner that gets levels 1 and 2 right and the tie-break wrong passes every coarse row. |
| `S4-121` | `moved_count` and `unused_seats` in the response agree with the `assignments` they summarise. | Recomputed from the assignments and compared. | A response that reports the optimum and the plan it returns are different plans. |
| `S4-122` | Planning supports up to 6 tables, 4 declared pairs and 6 considered bookings; larger inputs may return 422 `planning_limit`. | Each limit at its boundary and one past it, separately — 7 tables, 5 pairs, 7 bookings. **Record whether the boundary is inclusive** (**ambiguity A2**). | A limit that triggers early refuses legal input; one that never triggers is untested. |
| `S4-123` | Each considered booking keeps reference, owner, party size, start, end and accepted terms — and is assigned a single or declared pair with enough capacity **under its own accepted terms**. | A booking whose party size is legal under one booking's terms and illegal under another's; assert the plan respects the per-booking terms, and that `accepted_terms`, start and end are **identical** before and after. | Stage-2 occupancy is table-driven; stage 4 makes it **terms-driven**. This is the row that catches the substitution. |

## D. The closure, once applied

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-130` | The proposed closure is half-open `[from,to)`: a booking ending exactly at `from` is unaffected; one starting exactly at `to` is unaffected; one overlapping either endpoint is considered. | Four bookings on the boundary, all four asserted individually. | `[from,to]` and `[from,to)` differ on exactly the bookings a fixture is most likely to place at an endpoint. |
| `S4-131` | Invalid interval → 422 `validation_failed`; unknown table → 404; `from < to` and explicit offsets required. | Naive timestamps (no offset) → 422; equal instants → 422; reversed → 422; unknown table → 404. | A build that accepts a naive timestamp and reads it as local will be correct in one timezone and wrong in two — and the fixture can express two timezones (`0.3`). |
| `S4-132` | Considered bookings are the **confirmed** bookings at this restaurant overlapping the interval. Other bookings retain their assignments; bookings at other restaurants are untouched; **no booking may disappear or be cancelled**. | Count before and after **by reference** across the whole restaurant set, not a sample (clause 13); assert zero cancellations recorded. | A planner that "helpfully" drops an unplaceable booking satisfies every spot-check and loses data. |
| `S4-133` | Assignments respect fixed bookings, other assignments, **previously applied closures** and the proposed closure. | Two plans applied in sequence; the second must not move a booking into the first plan's closure. | The second closure is the only place previously-applied closures are exercised. |
| `S4-134` | A closure excludes its singles **and its declared pairs** from availability, and rejects creates/amendments with 409 `table_unavailable`. | Both singles and every declared pair containing the closed table; one create and one series amendment; the 409 body names `table_unavailable`. | Pairs are the half that is easy to leave out and is invisible to single-table rows. |
| `S4-135` | In explanations, `no_overlap` is **false for a closure** exactly as for a conflicting booking. | `explain` for a slot inside an applied closure → the same `no_overlap: false` shape as a booking conflict, asserted by **shape**, not by value. | A closure reported as a distinct reason is a new reason code invented by the implementation — clause 7. |
| `S4-136` | Each moved booking gains **one** `reassigned` history entry carrying the `table_ids` change and the `plan_id`; times and accepted terms identical; unmoved bookings gain **nothing**. | Per-booking history diff by reference: moved → exactly one entry with both fields; unmoved → zero entries and identical history array. | "One entry" is the assertion; "an entry exists" is the shortcut. |
| `S4-137` | **Seating repairs may move series occurrences**, preserving exception flags, scheduled dates, identities and accepted terms; each affected series revision increases **once per plan application** if at least one member moved. | A series with three occurrences, two moved: exception flags identical, scheduled local dates identical, references identical, terms identical; series revision **+1**, not +2; a plan moving no occurrence of that series leaves it alone. | Per-occurrence revision increment is the obvious wrong answer, and the "+0 when nothing moved" half is invisible unless the second plan is a no-op for that series. |

## E. Amend: validation order, then semantics

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-140` | `POST /series/{id}/amend` is owner-only and idempotent: unknown or another owner's series → 404; **no token → 401**. | Both, in that order of distinctness — 401 is not 404 and the row asserts which. | The classic conflation; clause 9. |
| `S4-141` | Input validation → 422 `validation_failed`: `expected_revision` a positive integer; `from_index` an integer in 0..count-1; `local_time` exactly `HH:MM` in 00:00..23:59; **booleans are invalid integers**; unknown fields ignored. | Each boundary, plus `true`/`false` for both integers, plus `"9:00"` and `"09:00 "` and `9.5`, plus an unknown field that must change nothing. | `Number("9")`-style coercion and truthiness-as-integer are the two defects this row exists for. |
| `S4-142` | A mismatched series revision gives 409 `stale_revision` **before any occurrence's cutoff or booking validation**. | A fixture where an eligible occurrence is *also* past its cutoff: stale revision → **409 `stale_revision`**, fresh revision → the cutoff error. Ordering is the whole row. | Either error alone is correct behaviour; only the ordering is the requirement. |
| `S4-143` | Eligible set: indices **at or after** `from_index`, **excluding** cancelled occurrences and those marked exception. | A series containing one of each, with `from_index` set so the boundary index is eligible and the one before is not; assert exactly which references changed. | Off-by-one and "excluded" implemented as "cancelled only" both survive a coarse row. |
| `S4-144` | Each real change moves the clock time on the occurrence's **original scheduled local date**, retaining reference, owner, party size and current table selection. | Assert the scheduled **local date is unchanged** while the local time changed, and that `starts_at`'s UTC instant moved by the expected offset difference — a cross-midnight or cross-date result is the failure. | With two timezones expressible (`0.3`), recomputing the date from the new time is the trap. |
| `S4-145` | A change with identical resulting fields is a **no-op and retains its terms**; all-no-op or empty eligible sets succeed without changing any revision. | Same local time for every eligible occurrence → 201, series revision unchanged, restaurant revision unchanged, no history entries, idempotency record still written. | A no-op that clears terms is the defect `S3-070a` taught us to look for. |
| `S4-146` | Each real change checks its **old** accepted cutoff, then adopts the policy for its **resulting start date**, exactly like an individual PATCH. | A booking whose new time is legal under yesterday's policy and illegal under today's → the failure; and the reverse. The old-cutoff check uses the old terms, not the new ones. | "Adopts the policy for the resulting date" is stage-3 `S3-118`-shaped and easy to satisfy with the pre-change date. |
| `S4-147` | Resulting occurrences must not conflict with unchanged occurrences, other bookings or applied closures; on failure **histories, idempotency records and all revisions remain unchanged**. | Each conflict source in turn → the appropriate error, then a byte-equal export. **The idempotency-record half is the one a build gets wrong by recording the key before validating.** | A burned key after a failed amend breaks every later retry. |
| `S4-148` | Non-occupancy errors take precedence **in occurrence-index order**; otherwise an occupancy conflict returns `table_unavailable`. | Two eligible occurrences, the later one with the cutoff failure and the earlier one with the occupancy conflict → the **earlier index wins** whatever its kind. Then the case where only the later fails → `table_unavailable`. | Both halves are needed: precedence and ordering are separate requirements. |
| `S4-149` | On success 201 with the current series response; each changed occurrence gains one ordinary changed history entry and one reservation revision; series and restaurant revisions each increase **once for the entire operation** if anything changed; amendments do not mark exceptions. | Series response body shape; per-occurrence history diff and revision delta; **both** counters +1 and not +n; exception flags unchanged. | Per-occurrence counter increments again, and "did not mark exceptions" needs its own assertion because nothing else would catch it. |
| `S4-151b` | Replay returns the original response with 200 **even after further edits or cancellations**; concurrent amendments from the same `expected_revision` may not both make a real change. | Amend, then amend a given occurrence differently, then cancel one, then replay → 200 and the **identical original body**. Concurrency: two simultaneous amends from the same expected revision → at most one real change; the other 409 `stale_revision`, and the series is not left half-amended. | Replay-after-change is the only place the idempotency record's contents matter. |

## F. The seam, and the cross-stage floor

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-160` | **After** a plan is applied, the grid and `explain` still agree — the seam of `0.4`, re-driven in the state where availability has actually changed. | Real browser, **every** rendered cell against the `explain` entry for that table and slot — and the population is asserted, not sampled (clauses 18, 23): the row counts the cells it rendered, counts the `explain` entries it compared against, and **fails unless the two populations are equal and every pair cell is among them**, since a map indexed on singles alone once reported agreement while skipping every pair. Under a closure that removes capacity, and under a policy that flips the answer; unavailable cells `disabled`; no page errors. | Stage 4 changes availability underneath a screen that no stage-4 requirement mentions. This is the row that catches it. |
| `S4-161` | A stage-4 service must accept exports produced by the same team's stages 1–3, including **imported series with moved and cancelled occurrences**; earlier receipts, histories and retries remain valid. | A stage-2 export and a stage-3 export, each imported 204; a series with a moved and a cancelled occurrence amended and replanned; an old idempotency key replayed → 200 with the original body. | Stage 4 is where the accumulated surface is largest; the import path is the one arrival path nobody re-tests after a new stage. |
| `S4-163` | **The service answers, at the day level and under the terms in force, which of three states the date is in: _shut_ — no opening hours for this weekday; _terms exclude every slot_; or _nothing free_. `explain=true` must state it on a day with no slots, and the three must be distinguishable without the screen inferring any of them from `slots.length`.** | Three fixtures, one per state, same day shape: (a) a day with no `opening_hours` entry; (b) a day whose slots are all booked; (c) a day on which the terms in force exclude every slot. **Each asserted by the day-level field, not by the sentence a screen would print**; and `S4-164` asserts the absence of a closed-day claim whenever the day-state is not _shut_. | **Measured at `1e56016`, and this is why the answer cannot live on `explain[]`:** shut → 200 with `slots: []`; fully booked → 200 with 7 slots and every `available_table_ids` empty; **identical top-level keys**; and **`explain=true` on the shut day returns no `explain` key at all**, because `explain` is per slot and there are no slots to explain. **The service is silent by construction on the one day a screen most needs to know why.** Any discriminator bolted onto `explain[]` inherits the defect, because **the day it must speak about is the day the array is empty — a per-slot surface cannot carry a statement about the absence of slots.** Three constraints keep the shape from drifting back: **(1) it is day-level and present when `slots` is empty; (2) it is derived from the terms in force, not from the fixture and not from text; (3) the screen's `say less, not more` obligation only discharges if the three are distinguishable to the screen** — a day-state a screen cannot read is not a discriminator. |
| `S4-164` | A screen's obligation is to **say less, not more**: where the service has not said a day is shut, no screen may state it. | The grid and the lookup screen for state (c) from `S4-163`: assert the **absence** of any closed/shut claim, and assert the slot list is what the service returned rather than a filtered version of it. | A screen that infers closure from `slots.length === 0` is making the service's silence its own statement. **The Finisher has refused to make the screen smarter to cover this, and that refusal is the requirement, not a limitation** — it is `S3-A3`'s second half. |
| `S4-165` | **Terms validity is _derived_, not published — and the derivation is named, because "derive it" without naming the inputs is the shape this stage has refused twice.** **Ruled: no boolean, no second claim.** | **From exactly two things a client can already read:** (i) the booking's own `accepted_terms`, carried by `GET /reservations/{ref}`, and (ii) **the policy in force for the booking's `starts_at_local`**. Assert: (a) publishing a policy that changes terms **leaves an existing booking's `accepted_terms` byte-identical** — validity is not drift; (b) both sides are reachable, so the comparison is possible — **which makes `explain` on the booking's slot load-bearing: it must name the policy in force for that start**, otherwise the client holds one side of a comparison it cannot complete; (c) where they differ, **nothing in any response claims validity** — asserted as the *absence* of such a claim. | A published boolean **buys a row rather than a property**: it is a second claim about a fact that is already derivable, and it needs its own row to police it, which is the equality-comparison mistake the Builder deleted at `549a104` rather than hardened. **A field that exists is not a field whose meaning a client can check** — `explain` before stage 3 — and the fix for that is not another field. **The real gap is not "no field" but "no single place both sides are visible",** and (b) is the requirement that closes it: **the service must make the derivation's inputs reachable together.** |
| `S4-167` | **`GET /availability` with `explain=true` returns a top-level `day_state` naming which of four states the requested date is in, for that restaurant, under the policy in force for that date: `shut` (no `opening_hours` entry for that weekday) · `terms_exclude_all` (hours exist and the terms yield no slots at all) · `nothing_free` (at least one slot, none with a free table) · `open` (at least one slot with a free table).** A screen may state a day as closed **only** on `shut`. | Four assertions, and **no assertion about any sentence, heading or rendered output**: **(1) `day_state` is present at the top level whenever `explain=true`, including on a date with no slots — presence on an empty day is the row; (2) the states are pairwise distinguishable without reference to `slots.length`, each asserted twice, once on a day built to produce it and once on a day where `slots.length` would give the wrong answer (`shut` and `terms_exclude_all` both have `slots: []`, and the row asserts they differ); (3) `day_state` is terms-derived, not fixture-derived and not text-derived — proved by driving a policy change that moves a date from one state to another with **no change to `opening_hours`**; (4) the plain response's key set is unchanged.** | **A discriminator bolted onto `explain[]` inherits the defect, because the day it must speak about is the day the array is empty** — a per-slot surface cannot carry a statement about the absence of slots. And **if a client can recover the state by counting slots, the field is decoration**: assertion 2 exists to make that red rather than merely unlikely. **Assertion 3 is load-bearing and the row says so (clause 30)** — `terms_exclude_all` has one producing configuration, so an implementation answering `shut` whenever `slots` is empty passes 1 and 2 and only 3 catches it. |
| `S4-166` | **The stage-4 baseline is attributed, not assumed**: at a folder-only build the two failing supplied checks are the two **write** families (planning and amendment), and the **read** surface is intact. | Drive all three write entry points (404/405), then the read surface — policies, availability with `slots[]`, and the absent-series 404 — and **assert the read surface is alive before attributing the failures to the writes**. `absent_at_e9b9f4d.py`, 8/8 at `e9b9f4d`. | Attributing two failures to "stage 4 is not built yet" without showing the rest of the folder works is a guess with a measurement attached. **A folder that carries stage 3 forward broken would produce the same two red checks.** |

| `S4-162` | The full stage-1/2/3 regression surface at the stage-4 hash. | 120/0, 25/25, 7/7, `api_core` 48/48, `terms_history_series` 34/34, and the stage-2 screen suites at both widths with 0 residual. **Any failure goes to the Foreman before it is characterised.** | A stage that satisfies its own rows and breaks an accepted one. |

---

## Ambiguities, recorded as ambiguities

**None of these is resolved by me. Each is recorded so that a later verdict cannot quietly pick one
side after seeing the answer.**

**Status, restated as the Builder's observation rather than as a ruling: `A1`, `A2` and `A4` are expected
to be decidable only by driving, and `A1`'s status is a single request away from an answer.** **If an
ambiguity dissolves under a driving test it was never an ambiguity — it was an unmeasured fact**, and the
record moves it from this list into the measurements **naming the observation that settled it.** A ledger
whose ambiguities quietly become measurements got stronger; one resolved by whichever implementation
happened to be written got weaker. `A3`, `A5` and `A6` remain genuinely open and are **not** to be
settled by reading code.

- **A1 — missing idempotency key on `POST /replans` and `/apply`.** The specification says both
  *require* a key but names no status for its absence, while every other validation failure in the
  document is 422 `validation_failed`. Candidate readings: 400, or 422. To be settled by observation,
  recorded either way as the build's chosen reading, with the alternative noted.
- **A2 — the planning limits' inclusivity.** "up to 6 tables, 4 declared pairs and 6 considered
  bookings; **larger** inputs may return 422 `planning_limit`" reads as 6 allowed and 7 refused. The word
  *may* also permits a build to refuse at 6. Recorded: whichever the build does, the boundary is
  asserted on both sides so the choice is visible rather than assumed.
- **A3 — the meaning of `changed` on an assignment.** Most likely "this booking's table set differs from
  the one it held before the plan" — but "differs from the table set the closure would force" is not
  excluded by the text. Asserted via `moved_count` agreement (`S4-121`) and recorded if they disagree.
- **A4 — the rank vector's length.** Option ranks are numbered across singles then pairs, so two plans
  may have vectors of different lengths when a considered booking has a different number of options.
  Compared lexicographically as written; if the build pads or truncates, that is recorded as its reading
  rather than as agreement.
- **A5 — which reservation states are "confirmed".** The specification says *every confirmed booking*.
  Stage 1's state set is inherited; if a state other than confirmed exists that overlaps the interval,
  whether it is considered or ignored is not stated. Recorded as an observation, not an assumption.
- **A6 — whether a preview's stored plan expires or is invalidated by a non-revision write.** Only a
  restaurant-revision change is specified to invalidate (`S4-158`). A write that moves no counter is not
  described either way.

### Two rulings on `S4-167`, made as its row's author before the code exists

**(a) Four states, not three — `open` included.** A three-valued field leaves a client unable to tell
*nothing to report* from *everything fine*, and **a four-valued field whose last value is the absence of a
problem is still a field the client has to interpret — but it is one it can interpret, because "open" is a
state rather than the absence of a state.** Shipping an implicit "no complaint" state is the thing to
avoid; **naming it is not the same as shipping it implicitly.**

**(b) Conditional on `explain=true`, not unconditional** — and the cost is recorded rather than absorbed.
**A `day_state` is an explanation, and the plain response's shape is asserted by rows that exist already.**
The cost of the ruling is real and is written here: **a client that does not pass `explain=true` cannot read
the day state at all.** Ruling it unconditional instead would change the expected key set of the
availability assertions in `api_core.py` and `terms_history_series.py`, every per-cell comparison in the
seam row `S4-160`, the stage-2 grid rows that read `/availability` (`closed_day`'s `slots_len` and grid
assertions), **and the supplied stage-1 availability rows, whose key sets I have never read and would
therefore be changing blind.** **A discriminator that grows every existing row's expected key set is a
change to rows this ledger's author did not write, and it is not mine to make quietly** — so the ruling is
conditional, and the cost is on the record for whoever revisits it.

### Which suite drives the grid, and does anything report the population? (`1e56016`, read not run)

**Answered by reading the suites, because I cannot run them — and reading is enough for this question.**

- **`ui-grid.mjs`** is the per-cell driver. It builds paired rows from `available_options` (`pairs:
  slot.available_options.map(o => o.table_ids.join('+'))`), compares **each painted cell** against the
  service's answer for its own time and party, and asserts at two parties — **one where some cells are free
  and one where only the six-seater is offered** — with a guard that a comparison is worthless if it can pass
  with nothing to compare. That is the Finisher's `561b60d` row, carried into the stage-4 folder.
- **`seam-check.mjs`** is the explain-agreement driver, and it **indexes both key shapes** — `'table_id' in e`
  for singles and `Array.isArray(e.table_ids)` for pairs — with the reason in a comment, because a map that
  drops one of them skips half the grid silently. It throws if a rendered cell has **no** explain entry, and
  the policy row asserts **the flip actually happened** (`flipped.length === 0` throws).

**So the driver exists and the row is not driven nowhere: the Foreman's path-debt worry does not apply here.
`561b60d` is a stage-3 commit of the Finisher's, carried forward.**

**But `S4-160` is not yet drivable, and the reason is stage 4's, not the environment's:** the row's subject
is **the grid after a plan is applied under a closure that removes capacity**, and `/replans` does not exist
yet. **The instrument is ready; the state is not.**

**And one population gap I can name from reading, which my row text already requires and no suite currently
does:** the suites assert **every rendered cell has an explain entry** (one direction) and that **the cell
count does not change under a policy** — **but nothing asserts that every explain entry has a rendered cell.**
`S4-160` requires the populations to be **equal in both directions**, so **my row adds a requirement the
existing instrument does not yet meet**, and that is a coverage thinness in the seam instrument itself, of the
thinness-not-a-hole kind: **the suites can be green with an unexplained slot nobody rendered.**

**The reverse assertion, specified here because I cannot write it into `stage-4/`, assigned with the reason
attached so the direction reads as chosen rather than accidental:**

```js
// seam-check.mjs -- after the per-cell agreement loop, the reverse direction.
// The loop above already fails when a rendered cell has no explain entry. This fails when an
// explain entry has no rendered cell. Both directions are required: the first catches a cell the
// service does not explain, this catches a slot the grid never showed -- the mirror of the
// pair-indexing bug (an omission in the map) and the mirror of that row's own failure (an omission
// in the assertion). A row that asserts a count cannot see either, so the instrument must.
for (const [key] of explained) {
  if (!domCells.has(key)) throw new Error('explain entry with no rendered cell: ' + key);
}
if (domCells.size !== explained.size) {
  throw new Error(`populations differ: ${domCells.size} cells, ${explained.size} explain entries`);
}
```

**The loop is the diagnosis; the count line is the requirement.** Equality of the two sets is what is being
asserted, and **recording the direction in a comment is part of the assertion** — otherwise the next reader
cannot tell whether the asymmetry was chosen or merely forgotten, **which is exactly how a population error
becomes invisible in the first place.**

### The precedence, corrected by measurement: a requirement can be wrong in the direction it intends to prevent

**My ruling, and the Foreman's before it, was wrong, and the Builder measured that before implementing it.**
The ruled precedence read `shut` from **the restaurant's own `opening_hours`**, so that a policy could not
override the calendar. **Stage 3 reads hours from the SELECTED POLICY** — its own comment says so — and
measured both directions:

```
policy names a Thursday the restaurant's calendar lacks  ->  200, 7 slots
policy omits a Friday the restaurant's calendar has     ->  200, 0 slots
```

**So the rule as ruled would have reported `shut` over seven bookable times — the precise defect `S4-167`
exists to prevent, produced by `S4-167` itself.** Corrected, and now measured by me at `69d8914`
(`verification/probes/s4/discriminator.py`, `S4-167-prec` and `S4-167-prec2`):

> **`shut` is decided from the EFFECTIVE HOURS for that date — the hours of the policy in force — absent
> → `shut`; present but yielding no slot → `terms_exclude_all`; slots but nothing free → `nothing_free`;
> else `open`.**

**And the architectural property that makes it a discriminator rather than a summary, which the row now
asserts: the first branch reads the effective hours computed BEFORE the slot loop runs, so it cannot be a
restatement of the loop's output.** A `day_state` computed after the loop would agree with it by
construction; computed before, **it is a decision the loop does not constrain.**

> **A requirement can be wrong in the direction its author intends to prevent.** This row was written to
> stop a screen inferring closure from absence, and it specified that inference in the service **from the
> wrong source**. **A ruling that has not been measured against the build's own conventions is a guess,
> however carefully it is reasoned** — and this one was reasoned carefully by two seats.

### The thinness closed, and the producers found by driving

**`terms_exclude_all` is reachable, and reachable two ways**, so the thinness I recorded is closed:

```
bookable window 12:00-12:44 with a 90-minute reservation, 15-minute slots  ->  terms_exclude_all, 0 slots
bookable window 12:00-13:29 with a 90-minute reservation, 30-minute slots  ->  terms_exclude_all, 0 slots
```

**The obvious producer does not exist**: a 10-minute window is refused by the reader, because a bookable
window shorter than one reservation is not a policy this product accepts. **So the second configuration is
not a variation of the first — it took driving to find, and assertion 3 could not have been satisfied by
anyone reasoning from the row alone.** That is the return on clause 30: **the thinness was named in the row
before the code, found by driving, and never became a defect.**

### Re-read of `S4-167`: is assertion 3 sufficient as the sole discriminator?

**No — and the fix is a second producing configuration plus assertion 3b, not a clearer sentence about the
first.** Assertion 3 as written proves the field is *terms-derived* by moving a date between states with a
policy change; **it does not by itself prove the `shut` / `terms_exclude_all` distinction is being made for
the right reason**, because a build that answers `shut` whenever `slots` is empty can still satisfy a
terms-driven movement between `open` and `nothing_free`. **So the row now carries 3b, which reads
"not shut" from the service's own calendar** — `GET /restaurants/{id}` must show an `opening_hours` entry
for that weekday **while `slots` is empty and `day_state` says `terms_exclude_all`** — **which makes the
implementation's shortcut falsifiable rather than merely unlikely.**

**And the standing thinness, recorded rather than absorbed:** `terms_exclude_all` still has **one**
producing configuration. **The honest strengthening is a second one reached by a different route** — for
example terms that admit no slot because of the party's terms rather than a table's capacity — **because a
row with one producing path cannot distinguish "derived" from "the only case anyone tried".** If a second
configuration cannot be built, that is written beside the row as a known thinness, **not inside its green.**

### Instrument ruling on the four screen suites (`1e56016`)

**Proposal accepted, and it is assigned rather than taken.** `ui-lib.mjs` should accept
**`argv[2]` and `process.env.BASE`**, and the README should show both. **I could not make the edit myself, for a reason worth recording: `stage-4/` is
read-only to this seat** — the write failed with `EROFS`, not with a policy refusal. **So the change is
assigned to the seat that can write it, with the patch written out here so nothing is lost in the handover:**

```js
// ui-lib.mjs -- three changes, each tied to a clause
export const BASE = process.argv[2] || process.env.BASE || 'http://localhost:18099';   // cl. 32
export const REQUEST_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 15000);    // cl. 31
// ... and in req(): signal: AbortSignal.timeout(timeoutMs ?? REQUEST_TIMEOUT_MS)
// plus, called by a suite before its first row:                                  // cl. 31
export async function assertReachable() { /* GET /health, one line, ok() on failure */ }
```

**And I cannot verify it either: `playwright-core` is not installed anywhere in this environment, so I
cannot re-run `ui-grid` or its three siblings at all.** **So I am not reporting `210/0` as verified by me. It is reported by the seat that ran
it, and the honest record says so** — an instrument's result is only as good as the seat's ability to
reproduce it, and mine cannot currently reproduce this one.

**The second half is the actual defect and it is not optional:** a **connection timeout on every request**,
so an unreachable service fails in seconds with an error instead of hanging, **plus a `GET /health` assertion
before any row runs.** Accepting both argument forms removes the trap; **the timeout and the reachability
assertion remove the failure mode that made the trap cost a reported finding.**

**And the deeper half is procedural: a suite that cannot reach its service does not fail, it goes quiet, so
"the suite is slow" and "the suite is pointing at the wrong port" are the same observation until the
invocation is checked.** Silence is the answer you get when the question was never asked, and it is the most
comfortable answer available.

## Probes owed, recorded as owed rather than as coverage

**Stage-3's defect round closed at `3f8dd94`: three mutants at `a69e6ba`, two caught, one missed.** The
miss was the predicted one and it is mine: **the fixture refusal's half-application** — a mutant that
returns 422 and **still writes some of the four declared stores**. `S4-152` asserts it; **no probe drove
it.** `fixture_arrival.py`'s `S3-340`/`S3-341` hold the *clean* half and did not catch it, for three
reasons I am recording rather than glossing:

1. **Those rows postdate the round's hash.** They were written and first run at `549a104`+; the round
   planted at `a69e6ba`, where they did not exist. **A row written after a round cannot have caught it**,
   which is the ordinary reason and not an excuse.
2. **Their coverage is narrower than the requirement.** `S3-340` drives **`policies` and
   `batch_counters` only** — two of the four keys — and `S3-341` drives `revision: 2` plus `policies`.
   **A mutant that half-writes `series` or `history` passes every row I have.** The row text says "for
   each key alone" and the probe did not; **the text was the requirement and the probe was narrower than
   its own row**, which is the failure clause 18 exists to prevent and which I did not catch in myself.
3. **No row mutates the path.** Even complete coverage of clean refusals cannot see a refusal that
   **claims to have refused and then wrote anyway** — that is a mutation of the refusal path, not of its
   input, and it needs the export compared across the attempt rather than the status read off it.

**Restated after option 1, because the door got smaller and the debt must follow it: the refusal set is
now two keys — a declared `accepted_terms` and a declared non-1 `revision` — because option 1 made the
four store keys the *capability* rather than the refusal.** So the owed probe drives **both** keys
individually, so "each key alone" still holds at the new size of the set. **A smaller probe because the
door is smaller, not because the check is.**

**And the half-application half is unmated and stays unmated by rows: it is a path debt under clause 29.**
**A path mutant on the refusal path belongs to the next defect round, not to the Builder** — and it is the
standing example of the class, because **`S4-152` asserting the refusal is not mutating it.**

**The form that will catch it, to be written when the door settles and not before:**

> **A refused fixture must leave the exported state byte-equal to what it was before the reset attempt** —
> export, attempt a reset with **each of the four keys** declared, export again, compare the two documents
> byte for byte. **And the reverse half: a fixture declaring two refusable faults is refused once and
> changes nothing at all.** **Assert the export, not the status** — a status-only row passes this mutant,
> which is exactly why it did.

**Written after option 1, deliberately.** Option 1 changes what the reset door accepts and therefore what
a refusal *is*, so a probe written now would inherit whatever the door currently does not do — the same
reason the multi-timezone fixture came before its probes. **Recorded here as owed, with its form, so it
is a debt with a specification rather than a gap.**

## Mutation and defect rounds for stage 4

### Before any round: walk each row its probes will defend against the probes themselves

> **Confirm the probe drives every element the row names** — every key, every branch, every population.
> **A probe narrower than its row is not a partial check; it is a check of a smaller requirement, and it
> reports green about it.**

**This is a pre-round check, not a discovery made during a round.** It costs nothing: it is reading my own
row text against my own probe list. **It would have caught `S3-340` before the round rather than after it**
— that row says "for each key alone" and the probe drove two of the four — **and it is the same walk that
catches a row whose population was sampled rather than asserted.** **If the walk finds a gap, that finding
is worth more than a catch**, and it goes in the report whether or not it is convenient.

**Two classes of miss, and they need different remedies:**

| class | what it looks like | the fix |
|---|---|---|
| **coverage debt** | the probe is narrower than its row — a key, a branch or a population the row names and the probe does not drive | **write the missing coverage** |
| **path debt** | no probe mutates the path, so the defect is invisible however much input is varied — e.g. clean-refusal rows cannot see a refusal that claims to have refused and then writes anyway | **mutate the path** |

**Only the first is paid by adding rows.** A stage-4 round that plants only input mutations leaves every
path debt unpaid, and the fixture-refusal half-application is the standing example: **`S4-152` asserts it,
and asserting is not mutating.**

- **Mutants are named by the defect or requirement they attack, with a number in parentheses**, and each
  is recorded as caught, escaped, or **measured unobservable over HTTP** — the stage-1 outcome that
  `src/time.js` produced when its patch had no call sites. An unobservable mutant is a finding about the
  surface, not a pass.
- **Reachability is established before a miss is reported** (clause 5). A patch with no call sites is
  recorded as such and is not counted as caught.
- **Every mutant that a stage-4 row would not catch is a row to write**, so the reconciliation at the end
  of the stage reads as a list of what the suite cannot see.
