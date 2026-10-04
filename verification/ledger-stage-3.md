# Tablekeeper Stage 3 — Requirements Ledger

Result repository: /home/aryan/band_hack/band-work/tablekeeper5
Specification: /home/aryan/band_hack/dark-factory-wearedevs/tablekeeper/spec/stage-3.md
Preceding specifications: `stage-1.md`, `stage-2.md`

**This ledger exists before any stage-3 code does.** The stage-3 folder is the accepted stage-2
service carried forward with nothing implemented; every row below is a requirement from the
specification text, and none of it has been measured yet. Ordered by how likely a row is to be
graded and how unlikely a competent first attempt is to satisfy it. Rows at the top decide the stage.
Every status, code and literal string is taken from the specification, not from an implementation.

**Known state of the stage, measured rather than assumed — and corrected, because the number was right
and my reason for it was not.** The first figure reported here was 7 collected / 1 failed / 0 passed,
with six checks never reporting. The Builder re-ran the supplied command and measured **6 failed / 1
passed**, and that is the figure of record, confirmed at two pinned commits — `8c207fd` (the stage-3
folder commit) and `0283f55` — each built from `git archive <hash> stage-3`.

**I originally explained the disagreement by claiming the tree at `0283f55` could not start.** That was
wrong, and the Builder's walk of every commit from the folder commit to HEAD shows why: there is **no**
commit where `api.js` requires `./series` and `series.js` is absent. The first commit that requires it,
`26d0c99`, is the same commit that adds it, and `0283f55` predates the work entirely. The combination I
reported existed only in a **working tree**, in the minutes between editing `api.js` and writing
`series.js` — and my run was taken from that tree.

**So the lesson is not "a build that does not start invalidates measurements". It is this:**

> **A measurement taken from a working tree is a measurement of the working tree, and the only thing
> that exposes it is that every reported number names the commit it was taken from.** A measurement of
> an unpinned tree is not evidence about any commit.

That clause is now clause 11 of this header, stated in the sharpened form, and every number I report
carries its hash. **The opening line's conclusion survives and its justification does not** — which is
worth recording plainly, because a ledger entry can be right and be wrong about why, and a reader
deciding how much to trust a number needs both halves.

**The 422 point stands independently and is unaffected.** On the current build two of those six
failures are **422 on `POST /reservations`** — a route stage 2 has — while the others are 404s or a
missing key. **A refusal from a route that exists is a different fault from an absent route, and a
status code cannot tell them apart:** a refused seed, a refused body and a refused field all arrive as
422 and send an implementer to three different places. So the suite probes the stage's real bulk *and*
some of its failures are refusals rather than absences. `S3-020` and `S3-024` are the two rows to amend
**when a run shows the distinction mattering** — one run is evidence about a failure mode, not evidence
about twenty rows.

**A working tree, measured once, and what it cost.** My first stage-3 run was taken from a working tree
mid-implementation, and it reported **7 failed / 0 passed** against the pinned truth of **6 failed / 1
passed**. The number was wrong and the reason was not a hash at all: **a measurement taken from a
working tree is a measurement of the working tree**, and the only thing that exposes it is that every
reported number names the commit it came from. **Stage 4 is recorded here as unmeasured rather than as a
result** — 4 passed / 1 failed, unopened — so a reader does not mistake an unreached stage for a
reached one.

## Standing clauses, restated here because they do not travel into a new ledger by themselves

Every clause below was added after a real reading error on this build. Each costs one line and each
removes a class of confident wrong number. **Restate them at the top of every stage-3 probe file too.** Clauses 1-15 are the whole of the
method this project arrived at; none of them was anticipated at the start.

1. **Assert the injected fault or the setup step actually happened before asserting the product's
   reaction to it.** A proxy that relays a request and then closes the socket has already written a
   response; a fixture whose reset returned 422 has already left the previous store in place.
2. **Assert the shape of what you read before concluding from it.** A missing key is not a zero:
   `assert "state" in doc` before counting `doc["state"]["reservations"]`.
3. **Measure against the surface the thing is actually drawn on.** A ring drawn outside an element's
   box is compared with that element's **parent**; a border on the element is compared with the
   element's own background. Follow the mechanism, not the element type.
4. **An instrument that looks at the wrong element inverts rather than merely misses** — a stale probe
   reports a false green or a false red depending only on which way the change went. A probe that
   cannot see a change is worse than no probe.
5. **A single keystroke is not a state transition when the control holds several stops.** Walk until
   the state actually changes, and assert that you arrived. A date field holds four; a grid holds
   dozens.
6. **For every state asserted in one direction, assert the transition back.** A teardown that is
   correct can still leave no path that restores the state — the `372e879` defect was invisible to
   every row that tested only that the indicator went *off*.
7. **Presence and wording are separate failures, and "absent" means absent from the document, not
   `hidden`.** A hidden container satisfies a visibility check and fails a presence check.
8. **A comparison that cannot distinguish the two cases is vacuous however green it is.** Assert that
   the mutant and the real build produce *different* results, not merely that both were run.
9. **Reasoning about a path instead of driving it is the same error wearing better manners.** Anything
   graded, or used to justify keeping or removing a mechanism, must come from a trace.
10. **Every mechanism added on a story about why it was needed must have that story re-derived when its
    surroundings change — and removing a mechanism can uncover the defects it was covering, so the
    removal is not finished until those are found.**
11. **The service you measure must be the service you started.** Before trusting any number from a run:
    was the build started, does `/health` answer, is the port free, and is the marker you asserted
    present in the build that answered? A green from a service that is not under test does not announce
    itself — it looks like coverage.
12. **Before reporting a miss, establish that the mutant is reachable.** An uncaught mutant may be a
    gap in the probe or dead code. `grep` for the mutated symbol's call sites and read the count: three
    stage-1 "misses" turned out to be invisible to a diner, to the transport, and to the call graph,
    and all three would have been written up as "probe missed it".
13. **The status a defect arrives with is not a reliable signature of the defect — assert the property,
    not the symptom's usual costume.** Stage 3 is built on fields whose absence reads as a state: a
    missing `explain` is not an empty explanation, `policy_version: 0` is not an absent version, and a
    `200` is not proof a screen showed the right thing.
14. **A row can be measuring the wrong gate.** Assert the absence you are checking for and the request
    may have failed *earlier*, so the absence was never tested: a policy sent with neither an
    idempotency key nor a token answers 401, and reading that as the missing key's answer is a
    confident number about a gate the row never reached. When a row expects one refusal, send a request
    that can only be refused for that reason.
15. **A staged failure that does not fail is the worst of the staging faults.** Every other one hides a
    wrong measurement behind a red; a row asserting a *failure* it never caused would report **green for
    a defect that does not exist**. Stage 3's own example: a "failing adoption" that simply succeeded,
    until another account took the anchor's table at the first generated slot. Assert the fault landed
    before asserting the product's reaction — and if you cannot cause the fault, delete the row rather
    than weaken it.
16. **An invariant believed rather than produced.** A comment that describes a shape the code does not
    emit is the same failure as a field defaulted rather than derived, one layer down and far easier to
    miss: `series.js` documented *"the occurrence carries its own reference beside index and
    exception"* while `seriesView()` returned `{index, exception, reservation}`, and it survived a
    commit whose message was about a different defect, so nobody announced an omission. **A comment is a
    claim about code; a row is a check.** Where a shape is stated, assert the shape's *keys* exactly —
    reading a value out of a nested object passes whether or not the outer object carries it.
17. **Assert the reason a design exists, not only its behaviour.** If a field is emitted rather than
    looked up, the row must exercise the case the emission was for, or a lookup of the nested object
    would pass every assertion in the file. Stage 3's own example: the occurrence reference is taken
    from the series record so it still names an occurrence whose reservation is absent — and
    **every other row in that file had a reservation behind every occurrence**, so a future edit could
    have replaced the emission with a lookup and turned the whole suite green. Reach the case the way a
    caller can: export, delete the generated reservations while keeping the series record that names
    them, import, read the series. This is clause 16's second half — a comment documenting a shape the
    code does not emit, and a design whose justification nothing tests, are the same gap at different
    altitudes.

**Standing convention: every row states both halves of its assertion.** Where a requirement says
something must appear, the row also says what must *not* appear, and vice versa.

---
## Group 1 — Availability explanations (`explain=true`)

The riskiest group in the stage, because the failure mode is a *plausible* response: an `explain`
array that is present, ordered and complete-looking while being wrong in one of rows 1-4 below. Every
row here is decided by comparing `explain` against the independently computed answer, never against
the response's own `available` field.

| id | requirement (verbatim) | observable that proves it |
|---|---|---|
| S3-001 | "`explain` is optional. Its only accepted value is `true`; any other value, including `false`, `1` and the empty string, is 422 `validation_failed`." | For each of `false`, `1`, `0`, `TRUE`, `yes`, `""`, `"true "` (trailing space), assert 422 `validation_failed` and assert the destination is unchanged by a following `GET /availability`. Then `explain=true` -> 200, and the parameter absent -> 200. |
| S3-002 | "Without it the response keeps stage 1's shape — no explanation fields appear." | `GET /availability` with no `explain`: assert the body has **no** `explain` key on the response and **no** `explain` key on any element of `slots`, and that `available_table_ids` is byte-identical to the same query with `explain=true`. A response that always includes `explain` fails here while passing every other row in this group. |
| S3-003 | "Every table of the restaurant appears exactly once, available or not, in fixture order — the same order `available_table_ids` uses." | For each slot, assert `explain.map(e => e.table_id)` equals the restaurant's table ids in fixture order exactly, and that the ids whose `available` is true are exactly `available_table_ids` **in the same order**. Assert no duplicate `table_id` and no missing one, with both halves: count equal *and* order equal. |
| S3-004 | "Both rules are reported for every table, in the order above. A rule that holds is reported holding; a table excluded by both reports both false. No rule may be omitted." | For every table in every slot assert `rules.map(r => r.rule)` is exactly `["capacity","no_overlap"]` in that order, both present. Include a table that fails **both** rules (party 6 on a 4-seat with an overlapping booking) and assert both report `holds: false`. Include a table that fails **neither** and assert both true. |
| S3-005 | "`available` is true exactly when both rules hold." | Recompute both rules independently from fixture capacity and the reservation set, then assert `e.available === (capacityHolds && noOverlapHolds)` for every table in every slot. Assert both directions: a table the response calls available whose capacity does not hold, and one it calls unavailable whose rules both hold. |
| S3-006 | "`no_overlap` holds when no confirmed reservation on that table overlaps the slot's interval" | Seed a confirmed booking on `t_1` 19:00-20:30 and assert, for the 19:00 slot on `t_1`, `no_overlap.holds === false`; for the 18:00 slot (ends exactly at 19:00) `true`; for 20:30 `true` — the half-open boundary, which stage 1 owns and must not regress. Cancel the booking and assert `no_overlap` becomes true for 19:00. |
| S3-007 | "`capacity` holds when `party_size` is at most the table's `capacity`" | Party exactly equal to capacity -> `holds: true`; party one more -> `false`. Assert against the **policy's** capacity where a policy is in force (see S3-030), and against the fixture's otherwise. |
| S3-008 | "A closed day still returns `\"slots\": []`" | A weekday with no `opening_hours` entry: assert `slots` is an empty array **and** that the body still validates as stage 1's shape with `explain=true` requested — assert the key `slots` is present before asserting its length (clause 2). |
| S3-009 | "a slot with no available table still appears — now with a full `explain` for every table" | A fully booked day: assert `slots.length > 0`, every `available_table_ids` is `[]`, and every slot carries an `explain` entry for **every** table with both rules present. Assert the slots are not dropped and no `no-slots`-style substitution happens at the API level. |
| S3-010 | "With `explain=true`, each table explanation additionally identifies its `policy_version`." | Under policy 0 assert `policy_version === 0` for every entry; under a published policy assert the version that applies to that slot's local date. Assert the field is present as an **integer**, and that `0` is not confused with absent — an entry with `policy_version: 0` and an entry with no `policy_version` must be distinguishable. |
| S3-011 | "Published policies can change the slot values." | Publish a policy with a different `slot_minutes` and assert the slot grid changes accordingly, with `explain=true` reflecting the new capacity rule for at least one table whose outcome flips. Assert both halves: the grid changed *and* the same query without `explain` also changed, so the change is in availability and not only in the explanation. |

## Group 2 — Publishing policies

| id | requirement (verbatim) | observable that proves it |
|---|---|---|
| S3-020 | "Restaurants may now declare `manager_user_ids` in their reset fixture (default `[]`)." | A fixture with `manager_user_ids: ["u_ada"]` and one without the key at all. Assert the default is `[]` by publishing as Ada against the keyless fixture and getting **403**. Assert the declared list is honoured in both directions (Ada can, Bob cannot). |
| S3-021 | "Only these users may publish policies. Unknown restaurant is 404; an authenticated non-manager is 403 `forbidden`; no token is 401." | Three rows in one: no token -> 401; Bob's valid token -> 403 `forbidden`; manager's token on `r_unknown` -> 404 `not_found`. Assert the **codes and error codes** for each, and that a 403 does not create a policy (subsequent `GET .../policies` still omits it). |
| S3-022 | "managers do not gain access to other diners' private lookup/history" | As manager, request another user's reservation by reference and their history and decision: assert 404 `not_found` for each, identical to what a signed-out stranger receives. Assert the manager's own lookup still works. |
| S3-023 | "`POST /restaurants/{id}/policies` requires an idempotency key, with stage 1's replay rules." | No `Idempotency-Key` -> 422 (stage 1's rule for keyed writes). Same key + byte-identical body twice -> 201 then **200 with a byte-identical body**, and the version counter incremented **once**. Same key + different body -> 409 `idempotency_key_reuse`. |
| S3-024 | "It accepts a **complete policy**, not a patch" | Omit each required field in turn (`effective_from`, `slot_minutes`, `reservation_duration_minutes`, `cancellation_cutoff_minutes`, `opening_hours`, `capacities`) -> 422 `validation_failed`. Assert each omission separately, and assert no partial application: the fixture's values are unchanged afterwards. |
| S3-025 | "Returns 201 with the supplied policy plus `policy_version`, an integer starting at 1 and increasing by one per restaurant." | First publication -> 201 with `policy_version: 1`; second -> `2`. Assert `policy_version` is an integer and not a string, and assert the echoed policy equals the supplied one field for field. |
| S3-026 | "Failed writes and replays allocate no version." | Publish an invalid policy, then a valid one: assert the valid one's version is the next integer with no gap. Replay a successful publication with its key: assert the version list length is unchanged. Do this per restaurant as well as across two, since the counter is per restaurant. |
| S3-027 | "Policy 0 is the original fixture's rules and applies before any published policy." | With no policy published, assert availability matches the fixture exactly and every `explain` entry reports `policy_version: 0`. Then publish a policy with `effective_from` in the future and assert a date **before** it still resolves to version 0. |
| S3-028 | "Policies are immutable." | `GET /restaurants/{id}/policies` twice with a write in between: assert the earlier policy's fields are unchanged. Assert there is no accepted mutation shape: a `PUT`/`PATCH` to the same path is either absent (404/405) or refused, and either way the listed policy is byte-identical. |
| S3-029 | "Publication order may differ from effective-date order." | Publish effective dates 2026-10-01 then 2026-09-20, assert both are listed **in publication order**, and assert selection by date still picks 2026-09-20's policy for a date on 2026-09-25 (S3-031). |
| S3-030 | "For a booking's **local start date**, choose the greatest `effective_from` not later than that date; ties choose the greatest `policy_version`." | Three policies: A effective 2026-09-20, B effective 2026-10-01, C effective 2026-09-20 published last. For a local start on 2026-09-25 assert C wins (tie on date, greater version); on 2026-10-02 assert B; on 2026-09-01 assert policy 0. Assert the selection is on the **local** date, not the UTC date — a Tokyo 08:00 local booking whose UTC date is the previous day must select by the local date. |
| S3-031 | "A new same-date policy supersedes the old one for future decisions, without changing any accepted reservation." | Publish A then B with the same `effective_from`, with different capacities. Assert a **new** booking resolves under B; assert an **existing** booking's `accepted_terms`, `revision`, end time and history are untouched. Both halves, or the implementation could satisfy one and break the other. |
| S3-032 | "Effective dates may be in the past; publication never retroactively edits a booking." | Publish a policy effective last week, then assert every pre-existing booking keeps its original `accepted_terms` and history, and that a booking made **today** resolves under the new policy. |
| S3-033 | "`effective_from` is an actual `YYYY-MM-DD` date; grid and duration are integers 1..1440; cutoff is an integer 0..10080; booleans are not integers." | Table of invalid values: `2026-13-01`, `2026-02-30`, `2026-9-1`, `24/09/2026`, `slot_minutes: 0`, `1441`, `30.5`, `"30"`, `true`; `cancellation_cutoff_minutes: -1`, `10081`, `true`; `effective_from: "today"`. Each -> 422 `validation_failed`, each with no version allocated (S3-026). Assert the boundaries `1`, `1440`, `0`, `10080` are **accepted**. |
| S3-034 | "Opening hours follow stage 1 and contain no duplicate weekdays." | Duplicate weekday entries -> 422; `closes <= opens` -> 422; unknown weekday -> 422; `24:00` -> 422. And a valid multi-day policy -> 201. |
| S3-035 | "`capacities` names **exactly** the restaurant's table ids with integer capacities 1..100." | Missing a table id -> 422; an unknown table id -> 422; capacity `0`, `101`, `1.5`, `true` -> 422. Assert both directions: no missing id and no extra id, so an implementation that only checks the ones present fails. |
| S3-036 | "Invalid policy is 422 `validation_failed`, with no version or state change." | After each invalid publication assert `GET /restaurants/{id}/policies` is byte-identical to before, and the next valid publication gets the next version with no gap. |
| S3-037 | "Table ids, labels, timezone and declared combinations cannot be changed by a policy." | Include `tables`, `labels`, `timezone` or `combinable` keys in the policy body (unknown fields are ignored — S3-039), then assert `GET /restaurants/{id}` returns the fixture's original ids, labels, timezone and combinations unchanged, and that availability still uses them. |
| S3-038 | "`GET /restaurants/{id}/policies` is public and returns `{\"policies\": [...]}` in publication order, omitting policy 0." | No token -> 200. Assert the array length equals the number of successful publications, that the **first element is version 1** (policy 0 omitted), and that the order is publication order rather than effective-date order when those differ (S3-029). Assert the key `policies` exists before counting it. |
| S3-039 | "Unknown fields are ignored." | Add `"future_field": {...}` and a misspelled known field (`"slot_minute": 15`) to a policy body: assert 201, and assert the misspelled field did **not** take effect (the effective `slot_minutes` is the fixture's). A misspelling silently ignored is right; a misspelling silently applied is the defect. |
| S3-040 | "The ordinary restaurant detail still returns its original fixture configuration. Availability and booking decisions use the selected policy, not that detail." | After publishing a policy that changes `slot_minutes`, `reservation_duration_minutes` and `capacities`, assert `GET /restaurants/{id}` still reports the fixture's values while `/availability?explain=true` and a new booking reflect the policy's. Both halves in one comparison, because either alone is satisfiable by an implementation that changes the detail. |

## Group 3 — Accepted terms and revision on every reservation

| id | requirement (verbatim) | observable that proves it |
|---|---|---|
| S3-050 | "Every reservation response gains `revision` (1 at creation) and `accepted_terms`" | On 201 create assert `revision === 1` (integer) and `accepted_terms` carries all five fields: `policy_version`, `slot_minutes`, `reservation_duration_minutes`, `cancellation_cutoff_minutes`, `opening_hours`, `capacities` — six keys, `effective_from` excluded. Assert `effective_from` is **absent** from `accepted_terms` and that its absence is a deliberate exclusion rather than a missing snapshot. |
| S3-051 | "This is a snapshot of the entire selected policy, excluding `effective_from`." | Publish a policy whose values differ from the fixture's on every field, create a booking under it, then **change the policy** with a second publication and assert the booking's `accepted_terms` still carries the first policy's values field for field. A terms object read live from the current policy fails here. |
| S3-052 | "Seeded bookings start at revision 1 under policy 0." | Reset with `reservations` containing a booking, then read it by reference and assert `revision === 1` and `accepted_terms.policy_version === 0` with the fixture's values. |
| S3-053 | "Responses to old idempotency keys remain the original response, including the original revision and terms." | Book under policy A with a key; publish policy B; amend the booking so its revision becomes 2; replay the original key -> 200 with the **original** body byte-identical, `revision: 1` and A's terms. Assert the replay did not re-run the operation (revision still 2 on a fresh read). |
| S3-054 | "A policy publication does not change existing bookings, their end times, or their history." | Snapshot `ends_at` and history before publishing; publish; assert both byte-identical afterwards, and assert a **new** policy's shorter duration does not truncate an existing booking's `ends_at`. |
| S3-055 | "Cancel checks the accepted cutoff, against the current start." | A booking whose `accepted_terms.cancellation_cutoff_minutes` is 120, cancelled 119 minutes before start -> 200; at 121 minutes -> 409 `cutoff_passed`. Then publish a policy with a **shorter** cutoff and assert the original booking still uses 120. The cross-half matters: an implementation reading the current policy fails exactly here. |
| S3-056 | "A real diner amendment ... checks the old accepted cutoff first, then validates **all** resulting fields against the policy applicable to the resulting start date." | One booking, two assertions: (a) an amendment inside the **new** policy's cutoff but outside the **old** accepted one -> 409 `cutoff_passed`; (b) an amendment inside the old cutoff whose resulting date falls under a policy that forbids the result (capacity too small) -> 422. Assert the order by constructing a case where both would fire and checking the status is the cutoff's. |
| S3-057 | "It atomically replaces accepted terms and end time and increments revision once." | Amend across a policy boundary: assert `revision` goes 1 -> 2 (once, not twice), `accepted_terms` now carries the **resulting** date's policy, and `ends_at` is computed with that policy's duration. Assert a multi-field amendment still increments by exactly one. |
| S3-058 | "A no-op amendment retains terms, end time and revision and records no history. It still requires a confirmed, editable booking." | PATCH with a field set to its current value: assert 200, `revision` unchanged, `ends_at` unchanged, `accepted_terms` unchanged, and history length unchanged. Then the same no-op on a **cancelled** booking -> 409 `reservation_cancelled`, and on a booking inside the cutoff -> 409 `cutoff_passed`. The guard clauses are the half most implementations skip. |
| S3-059 | "Failed amendments change nothing." | Each failing amendment in turn (cutoff, capacity, overlap, stale revision, cancelled): after each, assert revision, terms, end time, history and occupancy are all byte-identical to before. |
| S3-060 | "Cancel increments revision once; repeated cancel does not." | Cancel -> revision 2; cancel again -> 200 with revision still 2, and assert the history gained no second `cancelled` entry. |
| S3-061 | "`PATCH` optionally accepts `expected_revision`. A positive integer differing from the current revision gives 409 `stale_revision` before cutoff/validation; invalid type/range gives 422." | Three rows: matching revision -> 200; mismatched -> 409 `stale_revision`, **and** construct a case where the amendment would also fail the cutoff, asserting the status is 409 — the word *before* is the requirement; `0`, `-1`, `"1"`, `1.5`, `true` -> 422; omission -> stage 1 semantics (no stale check at all). |
| S3-062 | "Two concurrent amendments using one revision: at most one real change succeeds." | Two parallel `PATCH`es carrying the same `expected_revision`: assert exactly one 200 and one 409 `stale_revision`, and that the final revision is 2 with exactly one `changed` history entry. Genuinely parallel requests, never a sequential replay — a loop of awaits cannot see this race. |
| S3-063 | "Unrelated unknown fields remain ignored." | PATCH with `{"party_size": 4, "colour": "blue", "table_idd": "t_9"}`: assert 200, `colour` and the misspelled key ignored, and `table_id` unchanged. Assert `party_size` did take effect, or the row passes on an implementation that ignores everything. |

## Group 4 — Reservation history

| id | requirement (verbatim) | observable that proves it |
|---|---|---|
| S3-070 | "`GET /reservations/{reference}/history` — The reservation's own record, oldest first." | Create, amend twice, cancel: assert three entries in order, the first `created`, and that the array is in ascending `seq`. Assert no entry from another reservation appears. |
| S3-070a | **Ruling, Adversary, on the Builder's question: an imported reservation's history starts EMPTY, and that is right.** History is a record of what happened *in this service*, so it begins when the reservation enters it. A stage-2 document carries no history, so an imported booking has none; and an adoption must not invent a `created` entry for an anchor it did not create, because that entry would assert an event this service never observed and would then sit in the record beside real ones. The exception that proves the rule is the **generated** occurrences of that adoption: they *are* created here, so each carries its own `created` entry, and the Builder's re-export confirms both do. Assert: an imported reservation's `history` is `[]` with 200; after adopting a series on it, occurrence zero's history is **still** `[]` while every generated occurrence's history has exactly one `created` entry. |
| S3-071 | "Only its owner may read it; anyone else, signed in or not, gets the same 404 `not_found`" | Four requests: owner with token -> 200; Bob with a token -> 404 `not_found`; no token -> 404; unknown reference -> 404. Assert the 404 body is **identical** for a stranger and for a missing reference, so "not yours" cannot be told from "does not exist". |
| S3-072 | "A cancelled reservation still has its history." | Cancel a booking, then read history -> 200 with the `cancelled` entry present. Assert the entry is readable after cancellation and not replaced by an empty array. |
| S3-073 | "`seq` starts at 1 and increases by exactly 1, so the order is total even when two writes land in the same second." | Six writes in a row: assert `seq` is `[1,2,3,4,5,6]` with no gaps and no repeats, and that entries are returned in `seq` order which is also `at` order. Force the same-second case by making the writes back to back, and assert the order is by `seq` even where two `at` values are equal. |
| S3-074 | "`created` names all three fields, each with `\"from\": null`." | Assert entry 1's `changes` is exactly `table_id`, `starts_at_local`, `party_size` in that order, each with `from: null` and a `to` equal to what was booked. Assert a pair booking names `table_ids` instead (S3-110) rather than also naming `table_id`. |
| S3-075 | "`changed` names only the fields that actually changed, in the order `table_id`, `starts_at_local`, `party_size`." | A `PATCH` touching two of the three: assert `changes` has exactly two entries in the specified order, and the untouched field is **absent** rather than present with `from == to`. |
| S3-076 | "A `PATCH` that sets a field to the value it already has ... records **no entry at all**." | A no-op PATCH between two real amendments: assert the history jumps from `seq` 1 to 2 with no entry between, and that the later real amendment's `seq` is still previous + 1 — a no-op that consumed a `seq` fails here while passing a length check. |
| S3-077 | "`cancelled` carries an empty `changes`, and nothing follows it." | Assert `changes` is `[]` (present and empty, not absent) and that no entry has a greater `seq`. Then amend the cancelled booking -> 409, and assert still nothing follows. |
| S3-078 | "Replaying an idempotent `POST /reservations` records nothing" | Book with a key, replay the key, then assert history has exactly one `created` entry and the reservation's revision is 1. Assert a replay does not append a duplicate `created`. |
| S3-079 | "Each history entry additionally carries the reservation's resulting `revision` and complete `accepted_terms`. Old entries never acquire newer terms." | Across a policy boundary: assert entry 2's `accepted_terms` is the **new** policy's and entry 1's remains the **old** one, and that each entry's `revision` is the revision resulting from that event. This is the row a live-read implementation fails, and it is the row that makes history a record rather than a view. |
| S3-080 | "`GET /reservations/{reference}/decision` returns `{\"reference\", \"revision\", \"accepted_terms\"}` for the current booking, including after cancellation, with history's owner-only 404 rule." | Owner -> 200 with exactly those three keys; after cancel -> 200 still, with the incremented revision; stranger -> 404; no token -> 404. Assert `accepted_terms` matches the current booking's, not the policy's. |
| S3-081 | "History and decision return 404 even without authentication, resolving the exception to stage 1's general 401 rule." | Both endpoints, no `Authorization` header at all -> 404 `not_found` and **not** 401. Assert the code exactly, since stage 1's rule is 401 for unauthenticated private reads and this is the stated exception. |

## Group 5 — Recurring reservations (`POST /series`)

The largest group and the one where a partial implementation looks most like a complete one: a series
can be created, listed and cancelled while occurrence *i* is silently wrong. Every row below is
decided by reading the occurrences and recomputing their expected local start times independently.

| id | requirement (verbatim) | observable that proves it |
|---|---|---|
| S3-100 | "`POST /series` adopts an existing reservation as occurrence zero ... An idempotency key is required." | No key -> 422. With a key -> 201. Assert occurrence zero's `reference` is the anchor's, so the adoption did not create a second booking. |
| S3-101 | "The anchor must belong to the caller, be confirmed and satisfy its accepted cancellation cutoff." | Own confirmed anchor inside the cutoff -> 201; own anchor inside the cutoff window -> 409 with the cutoff's code; own **cancelled** anchor -> 409 `reservation_cancelled`. The cutoff half is separate from S3-102 and fails independently. |
| S3-102 | "Unknown or another owner's anchor gives 404 `not_found`; cancelled gives 409 `reservation_cancelled`; already adopted gives 409 `already_in_series`." | Three rows with their exact codes. For `already_in_series`, adopt the same anchor with a **different** key, so idempotency cannot explain the refusal; and adopt with the **same** key and assert 200 with a byte-identical body instead. Assert both, or the row cannot tell the two rules apart. |
| S3-103 | "`count` is an integer 2..12 including the anchor; `interval_weeks` is an integer 1..4. Invalid values, including booleans, give 422 `validation_failed`." | `1`, `13`, `0`, `-1`, `2.5`, `"8"`, `true` for `count`; `0`, `5`, `1.5`, `"1"`, `false` for `interval_weeks` -> 422 each. Assert the accepted boundaries: `count: 2`, `count: 12`, `interval_weeks: 1`, `interval_weeks: 4` all -> 201. |
| S3-104 | "No token gives 401." | No `Authorization` -> 401, distinct from the 404 for another owner's anchor in the same request shape. |
| S3-105 | "Occurrence zero is the anchor itself: its reference, identity, revision, terms, history, timestamps and original idempotent response remain unchanged." | Snapshot the anchor's full response and history before adoption; adopt; assert both byte-identical afterwards, including `created_at` and the anchor's original idempotent replay. Assert the anchor's revision is still whatever it was, not 1. |
| S3-106 | "Occurrence i starts on the anchor's local calendar date plus i × interval_weeks × 7 days, at the same local clock time." | `count: 4`, `interval_weeks: 2`: assert the four local start dates are anchor + 0, 14, 28, 42 days with the **same clock time**, and that the arithmetic is on the **local** date — an anchor in Tokyo must not slip a day when its UTC date differs. Recompute the expected dates in the probe from the anchor's local date, never from the service. |
| S3-107 | "Each generated occurrence independently selects its date's policy, including duration and capacity, and obeys ordinary opening, DST and occupancy rules." | A series whose occurrences straddle a policy boundary: assert occurrence 0 and 1 carry policy A's `accepted_terms` and occurrence 2 carries policy B's, and that each `ends_at` uses **its own** policy's duration. Then a series whose occurrence 2 lands on a closed day -> the whole adoption fails (S3-109). |
| S3-108 | "A nonexistent local time rejects the entire adoption with `invalid_local_time`; repeated times use stage 1's first occurrence rule." | Anchor on a date whose +7 days lands on a DST-skipped local time: assert the adoption fails with `invalid_local_time` and creates nothing. Anchor on a fall-back repeated time: assert the generated occurrence resolves to the **first** occurrence, compared against the IANA database computed in the probe. |
| S3-109 | "No partial series, reservations, histories, counters or idempotency claim survive failure. The first failing occurrence in index order determines the ordinary booking error." | Force occurrence 2 of 4 to fail (capacity, or a table already taken): assert the response is that ordinary booking error, and assert `GET /reservations` shows **no** generated occurrence, the series list has no entry, the restaurant revision did not move, and a **replay of the same key** is treated as a first use (201, not a 200 replay). The last clause is the one an implementation with a half-rolled-back transaction gets wrong. |
| S3-110 | "Generated occurrences use the anchor's party size and table selection." | Anchor on `t_2` for 4: assert every generated occurrence is on `t_2` with `party_size: 4`, and that none is on another table. |
| S3-111 | "Return 201 ... `occurrences` includes all count occurrences in index order. Each has a distinct ordinary reservation reference; references and indices never change when dates or tables change." | Assert `occurrences.length === count`, `index` is `[0..count-1]` in order, and every `reservation.reference` is distinct. Then amend occurrence 1 to a different table and re-read the series: assert `index` 1 still names the **same reference** while its table changed. Assert occurrence 0 has `exception: false` and `reservation` equal to the anchor's response. |
| S3-112 | "Occurrences appear in ordinary reservation lists, occupy tables, and have ordinary histories." | `GET /reservations` includes every occurrence; `GET /availability` no longer offers the occupied slot; `GET /reservations/{ref}/history` on a generated occurrence returns a `created` entry. Assert all three, and assert a non-caller cannot read a generated occurrence's history. |
| S3-113 | "`GET /series/{series_id}` returns this shape with current reservation states. Only the owner may read it: another user or no token gives 404 `not_found`." | Owner -> 200 with the same shape; assert a cancelled occurrence is reported with its **current** status rather than the status at adoption. Bob -> 404; no token -> 404; unknown id -> 404. |
| S3-114 | "A real individual PATCH permanently marks that occurrence as `exception: true` and increments the series revision once; a no-op or failure changes neither." | Amend occurrence 1 for real -> series `revision` 2 and occurrence 1 `exception: true`; amend occurrence 1 again for real -> revision 3, still `exception: true` (permanently, never cleared). Assert a **no-op** amendment and a **failed** amendment each leave revision and the flag untouched — the negative halves, which are where "permanently" usually breaks. |
| S3-115 | "Cancellation increments the series revision once, retaining the cancelled occurrence, but does not mark it as an exception; repeated cancel does nothing." | Cancel occurrence 2 -> series revision +1, the occurrence **still present** in the array with `exception: false` and a cancelled status; cancel again -> revision unchanged and no second history entry for that occurrence. The "does not mark it as an exception" half is separate and easy to conflate with S3-114. |
| S3-116 | "Cancelling the anchor does not cancel its siblings." | Cancel occurrence 0; assert occurrences 1..n are still confirmed and still occupy their tables, and that the series is still readable. |
| S3-117 | "Ordinary cutoff and revision checks still apply." | Amend an occurrence inside its accepted cutoff -> 200; outside -> 409 `cutoff_passed`; with a stale `expected_revision` -> 409 `stale_revision`. Assert the cutoff used is the **occurrence's own accepted** cutoff, by crossing a policy boundary first. |
| S3-118 | "Adoption increments the restaurant revision once for the whole operation." | Read the restaurant revision (or the policy version counter the implementation exposes) before and after adopting `count: 6`; assert it moved by exactly **one**, not six. Name the quantity explicitly in the row, because "restaurant revision" has no field of its own in stages 1-2 and the probe must state which counter it is reading. |
| S3-119 | "Replays return the original series response, even after later changes, and change no counter." | Adopt with a key; amend an occurrence; cancel another; replay the key -> 200 byte-identical to the original 201 body, and assert the series revision and every `exception` flag are unchanged by the replay. |
| S3-120 | "Unknown fields are ignored." | Adoption body with `{"anchor_reference", "count", "interval_weeks", "colour": "blue", "interval_week": 3}` -> 201 with `interval_weeks` as supplied and the misspelled key ignored; assert the generated dates follow `interval_weeks`, not the misspelling. |
| S3-121 | "A stage-3 service must accept exports produced by the same team's stage-1 or stage-2 service. Adoption must work on reservations imported this way. Existing confirmation links, sessions and original booking retries remain valid." | Export from a stage-2 build, import into stage-3, then: read a reference by link (200), reuse an existing bearer token (200), replay an original booking key (200 byte-identical), and adopt a series on an imported reservation (201). Assert `format_version: 1` and `track: "tablekeeper"` on the document before importing (clause 2), and assert the imported reservation has `revision: 1` and policy-0 terms. |
| S3-121a | **Recorded, not a fault: publishing a policy after a CROSS-STAGE import answers 403 `forbidden`.** A stage-2 document's fixture declares no `manager_user_ids`, so after importing one nobody is a manager and `POST /restaurants/{id}/policies` is correctly refused. `S3-020` behaving correctly across a version boundary. **A reader who hits this mid-verification will assume a regression, so it is written here:** and the constraint is real — a document imported from stage 2 cannot publish until a fixture grants a manager. |

## Group 6 — Combined tables and collective moves

| id | requirement (verbatim) | observable that proves it |
|---|---|---|
| S3-130 | "Stage 3's accepted terms apply to combinations too; capacity is the sum of the **selected policy's** capacities." | A pair whose capacities are 4 and 2 under policy 0 (sum 6) and 2 and 2 under a published policy (sum 4): assert a party of 5 is accepted under the first and 422 `party_exceeds_capacity` under the second, and that `explain` reports `capacity.holds` accordingly for the pair entry. |
| S3-131 | "In history, retain stage-3 fields for single-to-single operations." | A single-table booking's `created` entry names `table_id` (not `table_ids`) and carries `revision` and `accepted_terms` as in S3-074. Assert the absence of `table_ids` on a single booking's history, which is the half a blanket rename breaks. |
| S3-132 | "For a creation of a pair, replace the `table_id` change by `table_ids` (from null to the pair)." | Create a pair booking: assert the `created` entry's `changes` contains `table_ids` with `from: null` and `to` equal to the pair in **declared combination order**, and that no `table_id` change is present. |
| S3-133 | "For a change involving a pair, use `table_ids` (complete before/after lists) instead of `table_id`." | Amend a pair booking's `party_size`: assert the entry names `table_ids` with `from` and `to` both the complete pair lists; amend it to a single table: assert `from` is the pair and `to` is the single table's one-element list, in declared order. Assert a pair-to-same-pair **reversed** input names the same set. |
| S3-134 | "Table-set order is the declared combination order. A reversed input pair names the same set and is not an amendment on its own." | Declare `["t_2","t_1"]`; assert the pair booking's history `to` is `["t_2","t_1"]` and its response `table_ids` likewise. Then amend with `["t_1","t_2"]` -> assert 200 with **no new history entry** and revision unchanged (S3-058's rule applied to a reversed set). |
| S3-135 | "Each real change in `POST /reservation-moves` uses individual PATCH semantics: check the old accepted cutoff, then adopt the resulting date's policy." | A batch whose first move crosses a policy boundary and whose second move would violate the **new** policy's capacity: assert 422, and assert the first booking's terms and revision are untouched — the ordering requirement stated as an outcome. |
| S3-136 | "Per-move `expected_revision` is optional and follows PATCH validation and stale-revision rules." | One move carrying a matching revision -> 200; one carrying a stale revision -> 409 `stale_revision`; one carrying `"1"` or `true` -> 422. Assert the whole batch is refused in each failing case (S3-138). |
| S3-137 | "A no-op retains its terms and history." | A batch containing one real change and one no-op: assert the no-op booking's revision, terms, end time and history are unchanged while the real one moved, and the series revision moved **once**. |
| S3-138 | "All resulting bookings must satisfy amendment and occupancy rules; failure leaves every booking unchanged." | A batch whose first item is legal and whose second conflicts: assert 409 and that the first booking is still on its original table and time, its availability unchanged, and no revision moved anywhere in the batch. Both halves — the refusal *and* the untouched state. |
| S3-139 | "Every changed booking gains one revision and changed history entry; the restaurant revision increases once for the whole batch." | A three-item batch where two change: assert each changed booking's revision +1 with exactly one `changed` entry, the unchanged one's revision +0, and the batch-level counter +1 (S3-118's naming discipline). |
| S3-140 | "Each affected series revision increases once, and each changed series occurrence becomes a permanent diner exception. A failed batch or replay changes no revisions, histories or exception flags." | Move two occurrences of one series in one batch: assert that series' revision +1 (not +2), both occurrences `exception: true`, and a sibling series untouched. Then the failed batch from S3-138: assert **no** exception flag anywhere and no series revision moved — the negative half, and the one that distinguishes "applied then rolled back" from "never applied". |
| S3-141 | "Policy selection, revision and replay rules are unchanged." | Replay a successful moves batch with its key after further changes -> 200 byte-identical, and assert no revision, history or exception flag moved. |

## Group 7 — Screens

| id | requirement (verbatim) | observable that proves it |
|---|---|---|
| S3-150 | "No new screens are required for explanations or history. The availability grid continues to follow the stage-2 rules." | Every stage-2 screen row still holds at stage 3 — presence-not-visibility for the three containers, the closed-day sentence, the eight-state set, focus containment, out-of-order and lost-response. **Do not treat this as "no work": it is the stage-2 ledger applied to a new build, and the whole of stage 2's screen work is exposed to regression by a service change.** |

## Ambiguities, recorded as ambiguities

| id | ambiguity | how the row treats it |
|---|---|---|
| S3-A1 | "the restaurant revision" (S3-118, S3-139) names no field in stages 1-2. | The row must **name the counter it reads** and assert it moved by exactly one. If no such counter is exposed, that is a gap to record rather than a quantity to invent. |
| S3-A2 | Whether `explain=true` is validated when the restaurant is unknown (404) or the parameter first (422). | Both rows are stated; the row asserts whichever the implementation returns **and records which**, so the choice becomes visible instead of accidental. |
| S3-A3 | Whether a policy with `opening_hours` absent for a weekday means "closed" or "fall back to the fixture". | Row S3-034 asserts a policy is complete, so absence is 422; if an implementation treats absence as "inherit", that is a defect against S3-024 and the row says so. |
| S3-A4 | Whether `no_overlap` considers cancelled reservations. | Row S3-006 asserts it does not, by cancelling and re-reading the same slot — the only way to settle it from outside. |
| S3-A5 | Whether a series' generated occurrences may be adopted into another series. | Not stated. Row S3-102 asserts the ordinary rules apply to the anchor, and records the outcome rather than assuming either answer. |
| S3-A6 | Whether `expected_revision` on a **moves** batch is per item or one value for the batch. | Row S3-136 asserts per item, from "Per-move `expected_revision`", and records the reading. |
| S3-A7 | Whether `GET /series/{id}` includes the anchor's own current terms or the adoption-time terms. | Row S3-113 asserts **current** states, from "with current reservation states". |
| S3-A8 | Whether an occurrence's history `created` entry names the anchor's `reference` or its own. | Row S3-112 asserts an ordinary `created` entry on the generated occurrence's own history; S3-111 asserts references stay stable. |

## Row count and judgment rows

Total rows: **75** requirement rows across seven groups, plus 8 recorded ambiguities. No row in this
ledger has been measured: stage 3 has never been run green.

Judgment rows — requirements no command or measurement can settle, listed so they are graded as
taste rather than as pass/fail: **none yet.** Stage 3's additions are API-shaped and every row above
is decidable by a request or a measurement. If a screen judgement row appears while stage 2's screen
rows are being carried forward, it is listed in the stage-2 ledger and referenced from S3-150 rather
than restated.

**The first thing to measure is not a row at all:** the six stage-3 sample-suite rows that never
reported. They are unknowns, and a ledger that treats them as passes would be the exact error this
project has spent two stages removing.


---

## THE ACCEPTANCE PATH FOR STAGE 3, filed in the one document that grades nothing and is graded by nothing

### WHY THIS IS HERE AND NOT IN `ledger-stage-4.md` NEXT TO THE INSTRUMENTS
`:2495` of the stage-4 ledger argues that rules living in a transcript are not a document, and the last
instrument was in fact in the thread for five hours with a citation that did not resolve. Filing it beside
the instruments is what @Builder asked for and it is wrong, for a reason this stage discovered about
itself: **writing a criterion into a document that the criterion counts adds a copy of the thing counted.**
The stage-4 ledger holds the convention named at `:176`, and its counter-example at `:2416` and `:2426`
exists because someone reported a count of a phrase and, in reporting it, typed the phrase.

### THE LAW, IN PROSE, QUOTING NO PHRASE
A convention is rewritten by every run that measures it. To report a count of a phrase you must write the
phrase, so the instrument that verifies a convention is what destroys it, and there is no phrasing of this
that survives a counterexample, because recording the counterexample is the counterexample.
Counter-example: stage-4 ledger `:2416` and `:2426`, occurrences are 3, at `:176`, `:2416` and `:2426`.
**Reference a convention by line number and never by quoting it. Do not make it 4.**
This paragraph was drafted to contain zero occurrences of the phrase it describes. Verified: it does.
**That verification is itself the only part that could not be checked without typing the phrase into a
command, which is the residue, and it is why the discipline is a line reference and not an intention.**

### THE GENERAL FORM, WHICH IS THE ONLY ONE THAT TELLS AN INHERITING SEAT WHY
**An instrument must never read the thing it governs.** A criterion may not grade the file it is filed in,
and a diffstat may not read the index that becomes the commit. Both failures are one shape: the check gains
authority over its own reference point, and a change to that reference point becomes a way to defeat it.
Filing a criterion in lowercase instead of capitals was that. Staging an append so the unstaged remainder
reads clean was that. `:2416` was that. **The reference point is always the thing the person fixing the work
controls, and an instrument that reads it has already lost the authority it was granted.**

### THE TWO PROHIBITIONS, WHICH ARE DIFFERENT AND ONLY ONE IS ABOUT THE COUNT
1. **A criterion may not be filed in a document it governs.** Filing it anywhere else is safe.
2. **A criterion may not govern the document it is filed in.** This is the one that generalises.

### THE GRADED SET, ENUMERATED, AND WHY ENUMERATION IS LOAD-BEARING
```
verification/ledger-stage-4.md          graded   3 occurrences of the phrase
verification/sabotage/stage-3-report.md graded   body 1 / log 7
verification/ledger-stage-3.md          NOT graded, and this file is where the criterion lives
```
The exit is real only because the graded set is two specific files. **The day this is generalised to "any
document in `verification/`", it governs the file it is filed in and the exit closes.** That is not a defect
to engineer around. It is the residue stated as a fact about scope: **a check may be filed anywhere except
where it has authority, and authority is exactly what makes filing it dangerous.**

### THE INSTRUMENT, IN PROSE, REFERRED TO BY WHAT IT READS RATHER THAN BY ITS TEXT
Three parts, and only the first is mechanical:

- **REFUTE, before the commit.** The diffstat for the stage-3 report must read one insertion and five
  deletions, and the unstaged remainder must read zero, or the commit is not made. Take it from the working
  tree before naming a hash: a check that runs after the commit requires a peer to be watching, which makes
  the quality of the work a function of that peer's attention rather than of the work. **An instrument that
  depends on a witness is not an instrument.**
- **CONFIRM, by a person.** A human reads the body of the stage-3 report and judges the convention is in the
  body's own voice. Wording is not graded and cannot be.
- **HINT, never a gate.** The greps are recorded as observations and never as gates, because a criterion
  that fires on phrasing is a story about a criterion.

**There is no automated acceptance path for this class and that is a property of the class, not a gap.** A
check cannot know what a fix will say unless it dictates the words, and dictating the words is grading the
wording. So the two requirements this room held at once -- a check that cannot be satisfied by deleting
content, and a check that does not grade wording -- are incompatible. **An automated refutation path
exists; acceptance does not.**

**MEASURED, not asserted:** four natural phrasings of the missing body line were inserted into a copy of the
real file with the log copies removed. **One of four passed the phrase form and two of four passed the
single-word form.** The single that passes both is the phrase copied verbatim from the log entries the fix
is supposed to delete, so **a criterion that accepts only a copy of the defect grades fidelity to the error,
which is worse than grading vocabulary.** Do not narrow the grep further: a narrower grep convicts the next
legitimate wording.

### WHY THE DELETIONS KEEP COMING BACK, IN OPERATIONAL FORM
There is no body address for provenance, so a correction run that reads the log and finds the convention only
there has nowhere to put its finding, and appends. **The deletions are the symptom; the missing body line is
the cause, and the cause is the single insertion.** Seven attempts were appends, not deletions, because an
append was the only available move. **The next seat's first act should be to create the address, and the
deliverables will follow from it rather than needing to be chased.**
