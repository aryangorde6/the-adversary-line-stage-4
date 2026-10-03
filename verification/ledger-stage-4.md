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
| Stage-4 supplied checks | **5** | **4 passed / 1 failed** |
| Whether those 4 passes are stage-4 behaviour | unknown | **unmeasured** |
| Stage-4 checks opened by me | 0 | the file has not been read |
| Stage-4 product source | none | no `stage-4/` directory exists |
| Highest contiguous supplied stage | 3 | stage 1 120/0, stage 2 25/25, stage 3 7/7 at `9121b38` |

**The four passes are not assumed to be stage-4 behaviour.** A stage's first sample suite usually partly
measures the stage before it — stage 3's supplied suite was the first thing that touched policies and
series, and the four rows that passed there were satisfied by a build with *no* policy support at all.
**So each of the five checks is, until measured, a statement about `9121b38`'s behaviour wearing a stage-4
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

**Ruled by the Foreman, and recorded here as binding on stage 4:** the four keys are **refused with 422**
now, as a stage-3 defect in an accepted build; fixtures that genuinely express policies, series,
history and counters are **stage-4 work**. The Saboteur's stage-3 round plants against `9121b38` and is
unaffected, since the fix lands after it.

**Implemented at `a69e6ba` and graded directly: `S4-151` and `S4-152` are satisfied in stage 3**, with
two findings that change how stage-4 rows must be written. First, **the refusal names the door that
works, and I checked that it does**: all four keys → 422 `fixture_unsupported` naming the key and the
import door; a document carrying the three stores **under `state`** imports 204 and **really seeds them**
(policies 1, series 1, `batch_counters` 7); a refused fixture leaves the exported state **byte-equal**.
Second, **the stores are absent from an export while empty**, so a stage-4 row asserting that the export
carries them must seed them first — **absence against an empty state cannot be told from silence**, and
that is a stage-4 version of the mistake this section exists because of.

**A stage-4 fixture that genuinely expresses policies, series, history and counters is therefore still
missing, and it is stage-4 work.** `S4-151` and `S4-152` are re-measured on a stage-4 build rather than
banked; what stage 3 supplies is the refusal, not the capability.

## 0.2 The second arrival path, still able to express the fixed defect

A reservation may be **seeded** with `revision: 5` and `accepted_terms: null`, and the fixture
validator accepts it:

```
revision honoured -> revision=5   terms=null
```

That is precisely the inconsistent state `S3-121` found in the **import** path and the Builder fixed
**there** — so the two arrival paths can still be made to disagree, from a fixture, without either of
them being wrong about what it was asked. **One path was fixed; the other can still express the same
defect.** Row `S4-150` carries both halves, because *"the import path derives policy-0 terms"* and
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
    capability** — the refusal is legible and the 204 is not.
---

## A. Arrival paths (highest risk: two paths, one fact, and a 204 that lies)

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-150` | Seed and import must not be able to express the same inconsistent booking. Both halves: the import path derives policy-0 terms, **and** the seed path cannot produce `revision: 5` with `accepted_terms: null`. | Fixture-seed that state → **422**; and a differential row: seed a booking, export, import the export, compare the two bookings' `revision`/`accepted_terms`/terms-derived quantities field by field. | The `S3-121` defect returns through the other door. Fixing one arrival path and leaving the other able to express the state is the defect, not the fix. |
| `S4-151` (partly satisfied in stage 3) | `/_test/reset` must refuse the four keys it cannot seed (`policies`, `series`, `history`, `batch_counters`) with 422 `validation_failed`, naming the key. | Each key alone → 422 with the key in the body; all four → 422; **none of them** → 204 and the store seeded as declared. Then the positive control: a fixture that declares nothing about stage-3 stores and a row that reads a 15-minute grid — the grid must be **30-minute**, so a row cannot silently assert policy 0 believing it asserts a policy. | A probe author writing a stage-4 fixture gets 204 and believes it seeded a policy. Every downstream assertion is *about* policy 0 and nothing is red. |
| `S4-152` | After the 422 lands, **no store may be half-seeded**: a refused fixture changes nothing at all. | Before/after export equality of the whole state on a refused reset. | A refusal that half-applies is worse than no refusal. |

## B. Preview and apply: revisions, atomicity, idempotency

| Row | Requirement | What must be asserted | Risk if missed |
|---|---|---|---|
| `S4-101` | `POST /restaurants/{id}/replans` requires a manager **and an idempotency key**. | Non-manager → 403; missing key → the spec's status (**ambiguity A1**); a valid key twice → same `plan_id`, no second plan, no revision change. | A preview that increments anything is a silent state change. |
| `S4-153` | **Preview stores only a plan**: no closure, no occupancy change, no reservation revision, no history entry. | Full-state export before and after a preview: **byte-equal**. `restaurant_revision` unchanged; each considered booking's `revision` unchanged; history unchanged. | This is the row that catches the class in `0.5`(1) — preview and apply deriving the same plan differently. |
| `S4-154` | `restaurant_revision` increments **once for the whole plan**, not per moved booking. | A plan moving three bookings increments exactly one. | Per-booking incrementing is the obvious wrong answer and is invisible to any single-move row. |
| `S4-155` | The revision counter increments once for each successful new booking, real amendment, cancellation, policy publication and plan application — **and not** for no-ops, failures, previews or replays. | A single counter walked through all eight transitions, asserting the value at each step. | A counter that is right for plans and wrong for the other five transitions is the common shape. |
| `S4-156` | Apply requires a manager and an idempotency key; returns 201 with `plan_id`, `restaurant_revision`, `reservations` covering every considered booking in reference order. | Body key set exactly as named; `reservations` in ascending reference order; `len(reservations) == considered`. | A response that omits unmoved bookings satisfies a weaker reading and hides data loss. |
| `S4-157` | Unknown plan, or a plan from another restaurant → 404. | Both, plus a plan id that is well-formed but absent. | 404 conflated with refusal. |
| `S4-158` | Any intervening restaurant revision invalidates the plan → 409 `stale_plan`, changing nothing. | Preview, then make any revision-moving write, then apply → 409 and **byte-equal export before/after**. **A closure at another restaurant must NOT invalidate it** — the positive control, same fixture. | One half of this row is the trap: a build that invalidates on any write passes the negative half and fails the control. |
| `S4-159` | A plan already applied under a **different** key → 409 `plan_already_applied`; replay of the **successful** key → the original response with 200, even after later changes and cancellations. | Both keys, then a later write, then replay again → still 200 and the identical body. Assert the body equals the first response field by field, not merely that it is 200. | Replay returning a fresh body is the defect that only appears after a later write. |
| `S4-160` | Application is atomic: concurrent applications must not leave partially moved bookings. | Two concurrent applies of the same plan → one 201, one 409; and after both, **every** considered booking is wholly moved or wholly unmoved — never a mixture — with matching `revision` and history counts. | Sequential replays test nothing here (clause 14). |

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
| `S4-160` | **After** a plan is applied, the grid and `explain` still agree — the seam of `0.4`, re-driven in the state where availability has actually changed. | Real browser, every rendered cell against the `explain` entry for that table and slot, **singles and pairs**, under a closure that removes capacity; unavailable cells `disabled`; no page errors. And the population is asserted, not sampled (clause 18). | Stage 4 changes availability underneath a screen that no stage-4 requirement mentions. This is the row that catches it. |
| `S4-161` | A stage-4 service must accept exports produced by the same team's stages 1–3, including **imported series with moved and cancelled occurrences**; earlier receipts, histories and retries remain valid. | A stage-2 export and a stage-3 export, each imported 204; a series with a moved and a cancelled occurrence amended and replanned; an old idempotency key replayed → 200 with the original body. | Stage 4 is where the accumulated surface is largest; the import path is the one arrival path nobody re-tests after a new stage. |
| `S4-162` | The full stage-1/2/3 regression surface at the stage-4 hash. | 120/0, 25/25, 7/7, `api_core` 48/48, `terms_history_series` 34/34, and the stage-2 screen suites at both widths with 0 residual. **Any failure goes to the Foreman before it is characterised.** | A stage that satisfies its own rows and breaks an accepted one. |

---

## Ambiguities, recorded as ambiguities

**None of these is resolved by me. Each is recorded so that a later verdict cannot quietly pick one
side after seeing the answer.**

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

## Mutation and defect rounds for stage 4

- **Mutants are named by the defect or requirement they attack, with a number in parentheses**, and each
  is recorded as caught, escaped, or **measured unobservable over HTTP** — the stage-1 outcome that
  `src/time.js` produced when its patch had no call sites. An unobservable mutant is a finding about the
  surface, not a pass.
- **Reachability is established before a miss is reported** (clause 5). A patch with no call sites is
  recorded as such and is not counted as caught.
- **Every mutant that a stage-4 row would not catch is a row to write**, so the reconciliation at the end
  of the stage reads as a list of what the suite cannot see.
