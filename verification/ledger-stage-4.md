# Tablekeeper stage-4 verification ledger

> **Provenance of every specification claim in this ledger: the specifications are read from
> `/home/aryan/band_hack/dark-factory-wearedevs/tablekeeper/spec/`, which is NOT inside this repository and
> has never been version-controlled beside the code it governs** (`git ls-tree -r HEAD --name-only | grep -c
> "spec/"` returns 0; the repo root holds only `stage-1..4` and `verification`). **So a claim about what a
> specification does or does not say is unverifiable from inside the work and must name the checkout it was
> read from, exactly as a claim about a defect names the commit it was measured at.**
> **Keep grep's exit code; never establish an absence through `| wc -l`: `0` found, `1` searched and absent,
> `2` could not search — and a missing directory returns the same `0` on stdout as a real absence.** Every
> spec absence in this ledger was re-verified with the exit code kept, and all three are `1` (searched,
> absent): `S4-152`, `303a`, and `S[0-9]-[0-9]+[a-z]?` against `spec/`. **A check that can report "absent"
> without reporting "could not look" will eventually be the evidence for something never examined, and the
> failure is invisible precisely when the check is cheap, because a vacuous result and a real one are the
> same number.** *Per the Builder, who raised the suspicion that these zeros were vacuous and withdrew it on
> evidence — a suspicion withdrawn on evidence is worth more than one never raised.*
>
> **A SWEEP CATCHES ABSENCE AND CANNOT CATCH MISDIRECTION — and this is the honest boundary of every
> instrument above.** The exit-code rule retires the failure where a check reports *nothing*. **It cannot retire
> the failure where a check reports something read in the WRONG SENSE, because that returns a hit, and a hit is
> exactly what the discipline is built to trust.** All four anchor errors this stage were misdirection, not
> absence: `S4-` read as *stage 4*; the Foreman's stage-4 §Seating; my stage-1 §8/§4; and *token* read as stage
> 4's concurrency counter because the export paragraph had been discussed in those terms for an hour. **In every
> case a real string was correctly found, correctly located, and read as something it is not — and a wider grep
> cannot help, because the sweep finds strings and this failure is in what the strings MEAN.** The only
> instrument that catches it is asking what the word means in the file it came from. *Per the Builder, whose
> class this is, and whose `:107` misreading was the fourth instance committed ninety seconds after they named
> it — which is what makes it a shape rather than a lapse.*
>
> **And this is the one rule in this ledger that CANNOT be expressed as a command, which is exactly why it will
> be the one that decays.** Every other clause here is greppable, and a greppable rule survives because someone
> can check it. **This one requires reading, so nothing in the room can enforce it, and an unenforceable rule in
> a document nobody rereads is a rule that will be gone by the next stage.**
>
> **THE SWEEP IS ALSO OVER THIS ROOM'S OWN DOCUMENTS, not only over the specifications — and this is where the
> answers already were.** `ledger-stage-4.md:978` has read *"replant 1 -- `restaurant_revisions` on live |
> **LATENT** -- real, held, never exported"* since the mutant was graded, inside a table about mutants — **and the
> round-trip obligation was still being anchored to bearer tokens an hour later.** The fact was never missing. **A
> fact filed under a mutation table reads as a mutation result; a fact filed under a requirement table reads as a
> requirement; and a room's own answers do not announce themselves as answers, they sit next to the questions that
> were asked.** Every anchor error this stage was this: the right text, in the room's hand, one question from
> where it was looked for. *Per the Builder.*
>
> **The `S4-` prefix is a LEDGER SEQUENCE NUMBER, not a stage reference -- and it is the only part of a
> relabelled identifier that still asserts something about the world.** Six column headers were changed from
> "Requirement" to "Ledger row (room-internal)" while the prefix stood, so `S4-152` continued to read as
> *stage 4* to the two seats that went looking for its authority: **a wrong identifier is harmless because it
> fails a lookup, but a wrong identifier SHAPED LIKE A CITATION is a vector -- it does not fail, it misdirects,
> and it misdirects only the seats careful enough to be looking for authority.** `S4-152` is anchored in
> **stage-1** §3.3. *Per the Builder.*
>
> **A claim about authority names where it searched, not only what it found.** Every finding this stage was a
> lookup -- *does this heading exist?* -- and **nobody swept for the headings they were not looking for, so
> "not found" was free to mean either "absent" or "not searched."** That produced a false citation
> (Foreman: stage-4 §"Seating changes after a table closure") and then a false absence (mine: NO SPECULATION
> ANCHOR), **in the same cell, one after the other, and the room that filed the rule about the second meaning
> used it for the first.** The sweep is four files and one command -- `grep -nE '^#{2,3} ' spec/*.md` -- so
> **"I looked in stage-4" should never have been a finding at all.** *This is `grep | wc -l` one layer up: a
> check answers the question it was asked.*
>
> **Row identifiers are room-internal labels, not specification citations.** The stage specifications are prose under headings and contain **no numbered requirements at all** — `grep -rnoE "S[0-9]-[0-9]+[a-z]?" ~/band_hack/dark-factory-wearedevs/tablekeeper/spec/ | wc -l` returns **0**. **Every `S4-*` / `S3-*` ID in this ledger was invented by this room.** A row's authority is its text and its hash; a specification's authority is its prose, and the two headings stage 4 actually defines are *"Seating changes after a table closure"* and *"Amend recurring reservations"*. **An identifier formatted like a citation is a claim about where authority lives, and it is trusted in a way a sentence is not — three rulings this stage argued the status of a label that a `grep` would have shown was never a requirement.**
>
> **THE SIXTEENTH RULE, and it is a command that runs -- filed after @Builder broke the fifteenth by obeying it.**
> The Foreman's rule was: *a row may not be anchored without the sentence in the cell, verbatim, and `grep -F` for
> that sentence must return it.* **Correct in intent, and it does not run: a SENTENCE IS NOT A LINE.** The corpus is
> hard-wrapped and the break falls mid-sentence, so `grep -F` on the deciding row's sentences returns **exit 1 on
> five of six**, including BOTH of stage 4's:
>
> ```
> $ grep -F "A restaurant revision starts at 0 after reset and increments once for each successful"  spec/  -> exit 1
> $ grep -F "Any intervening restaurant revision invalidates the plan"                                   spec/  -> exit 1
> $ grep -F "Import is replacement, not merge"                                                          spec/  -> exit 1
> $ grep -F "Reset continues to clear all state, including imported state."                             spec/  -> exit 1
> $ grep -F "Import takes that entire object and atomically replaces the service's state"                spec/  -> exit 0
>
> stage-4.md:47-48   "...A restaurant revision starts"
>                    "at 0 after reset and increments once for each successful new booking..."
> ```
>
> **The form that works, normalise whitespace FIRST, then match:**
>
> ```
> for f in stage-1 stage-2 stage-3 stage-4; do tr -s ' \n' '  ' < ~/band_hack/dark-factory-wearedevs/tablekeeper/spec/$f.md | grep -F "<sentence>"; done
> ```
>
> **Six of six, verified. One `tr` is the whole cost -- so the check was never unenforceable, it was aimed at the
> wrong shape: written from the shape of a CITATION (something quotable) rather than the shape of the FILE it
> governs.** And the counterexample is worse than none: `ledger:1560`, the single row of fifty-four that quotes its
> sentence, PASSES the bare rule -- because that sentence happens to sit entirely on one line. **The rule would have
> looked like it worked on the only instance anyone checked, which is `:105`'s shape exactly: right, verified, and
> about the wrong thing.**
>
> **TWO REFINEMENTS FOR SOURCE, because the sentences anyone actually reasons with are comments, and comments break
> the rule in a new way (@Builder, verified):**
>
> ```
> $ sed 's|//| |g' stage-4/src/state.js | tr -s ' \n' '  ' < state-4/src/state.js | grep -F "a closure is a fact about a date"   -> exit 0
> $ tr -s ' \n' '  ' < stage-4/src/state.js | sed 's|//| |g' | grep -F "a closure is a fact about a date"                   -> exit 1
> ```
>
> **ORDER IS A TRAP: strip `//` FIRST, normalise second. The other order fails identically and looks like a missing
> sentence**, because `// ` sits MID-SENTENCE -- the text is `spent once; a` / `// closure is a fact` -- so
> whitespace normalisation closes the newline but leaves the marker, and no fixed-string search crosses it. **Also
> quote mid-sentence words in the FILE's case:** a `replans` quotation opening with capital `A` fails against the
> file's lowercase `and a plan`.
>
> **And the shape of it is the room's own, one level down: the sentences that broke the rule are ALL comments.
> Normalised `grep -F` handles declarations and breaks on argument -- which is every sentence anyone in this room
> actually reasoned with. The machine-checkable form passes the words nobody thought about and fails the ones where
> the thinking was recorded.**
>
> **WHAT IT STILL DOES NOT DO, stated plainly: a seat quoting §10's tokens sentence passes `grep -F` and can still
> be wrong about `tokens`.** This closes fabricated memory; it does not close meaning. The residue is the Builder's
> clause as filed: *ask what the word means in the file it came from.* That part is reading, it was always going to
> be reading, **and the honest thing is to say so rather than pretend a command exists.** The count on rows quoting
> a `grep -F`-able sentence verbatim: **1 of 54.** The rule's only counterexample is currently its best-formed cell.
>
> **And they are not FINDABLE either, which is a separate failure from not being citable.** Citing `S4-152` is bad
> practice because it points at nothing in the specification; *searching* the specification for `S4-152` is worse,
> because it returns nothing and a reader who trusts the room's own identifier will conclude the requirement is
> absent. **Both directions of failure were live here: this ledger asserted that a spec sentence existed and cited
> a row that cannot be resolved to it, while a reader grepping the specs for that row would find no such text and
> no way to tell that from a genuine absence.** So an unverifiable identifier is worse than none -- it converts a
> checkable claim into an unfalsifiable one. **A row is traceable only through its quoted sentence, and that is the
> only handle that survives the next stage, when this room and these IDs are gone.**
>
> **Authorship convention.** This document is committed by the **Adversary** on behalf of the room; **authorship of individual claims is recorded in prose at the claim, because the repository's own history attributes every line here to one seat.** `git log --format="%an" -- verification/ledger-stage-4.md` returns `54 Adversary` and nothing else, while the clauses, the `S4-171*` rows, the mutation records and the `SEED 1 GRADED` entry were written by the **Builder** and the **Foreman**. Git attributes a commit, not a sentence: **an index whose entries carry one author is an index nobody can audit**, and this one caused three erroneous rulings before a fourth seat read it.

**Accompanies the specification: `tablekeeper/spec/stage-4.md`.** A stage number is not authority — this is a
ledger of rows and clauses, and the specification is the document that defines the product.

> **For this track, the specifications live outside the result repository — `tablekeeper/`'s own. That is a
> fact about this track's layout and _not_ about the room's: `kickoff-manifest.json` lists a second track,
> `pocketful/`, with its own specifications and its own supplied tests, and the six-source index below is the
> _tablekeeper_ list, not the room's inventory.** Stated per track because a fact true of one track and false
> of the room is exactly the kind of sentence that gets applied where it is false. `tablekeeper/spec/stage-1.md` …
> `stage-4.md`, `docs/participant-guide.md` and `kickoff-manifest.json` are **not tracked files**, so they
> never surface when a seat reads a folder or lists a tree — **which is precisely why this ledger read as
> though it were the specification.** It is not: **a ledger records what a seat must not miss; it does not
> define the product.** Read the specification for the stage you are working in, then this ledger.

**What kind of document this is, stated in its own first line: a ledger of rows and clauses — a record of
what a seat must not miss. It is not a specification, it is not the brief, and it does not define the
product.** I once introduced it as the brief and never corrected that, and a seat read it in full and
implemented a stage from it; **nothing in a folder listing says which kind of document you are reading**, so
the kind now says it about itself (clause 47).

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

## The deletion audit, run on my own rows first

**The Foreman's second step is a deletion audit rather than another mutant: delete or invert one assertion
at a time and confirm the suite reports it.** I ran it on my own stage-4 rows before anyone else, because a
row I cannot show failing is a row I am reporting green for.

| row | assertion inverted | result |
|---|---|---|
| `S4-171a` | the expected plan's second assignment (`BBBBBB` → `t_3`, which would make the two bookings share a table) | **FAIL, 13/14** — the suite reports it and names the plan it got |
| `S4-167-a1` | `day_state` **absent** instead of present on a no-slot day | **FAIL, 15/16** — reported with the value the service returned |

**Two inversions, two reports, both naming what was observed rather than that something differed.** Combined
with `negative_control.py` — **7 rows proven capable of failing, each against the wrong answer a real build
returned** — the audit covers the rows I wrote *about a shape* and the rows I wrote *about a plan*.

**Which probe the audit should lead with, and the Builder's contribution to the question, which is better than
mine: `error-layer.mjs` is the first probe in this project that has been _red before it was committed_.** It
failed once, on its own one-table fixture, and the fixture was fixed rather than the assertion — so its green
is **a green it has been wrong about once.** `invariants.mjs` by contrast was introduced red, then green, then
one later red, and has been green far more often than red. **The criterion is corrected, because the Builder's own correction inverted it and the Foreman ruled against
the offer on the evidence that followed.** As written it selected `error-layer.mjs`; from the history, **that
probe has one commit, was never committed red, and its three-table fixture shipped in the same commit as its
green** — so **there is no committed red in its record at all.** The corrected rule has three parts:

> **Lead with a probe that has a _committed_ red; where none exists, the audit must _manufacture_ one** — by
> inverting an assertion deliberately and confirming the suite reports it. **A criterion that cannot be
> answered from the record disqualifies the candidate rather than qualifying it**, because a probe with no red
> in its history has been tested by nothing but its own author.

**And a red is not one thing. A _gap-red_ asserts that the probe does not establish something — it is the
instrument reporting honestly about itself, and it says nothing about coverage. A _failure-red_ asserts that
the product does not do something — it is evidence the probe is aimed, and it says nothing about whether the
probe knows what it does not know.** `optimiser.mjs` now exits 1 to announce that objective 3 is unverified:
that is a gap-red, and it is the correct state for an unestablished property.

**The audit therefore leads with `invariants.mjs`**, which has a committed red at `ee04207`, is the folder's
largest probe, and **has been measured blind to objective 2 while green throughout** — a known, documented
blindness rather than a suspected one.

**The original criterion is not discarded but demoted, because it was right about a different thing:** A probe that has been
wrong while green has nothing to protect; **a probe that has been right while green may be right by
construction.**

**And `error-layer.mjs`'s third assertion is the one worth copying into every door row: that the coercion
itself is asserted — that an unregistered code _does_ become `validation_failed`** — so the hazard that made
`stale_plan` answer 422 with a validation message stays visible instead of being described and then
forgotten. **Asserting that the hazard still exists is different from asserting that the good path works,
and only one of the two tells you whether the guard is load-bearing.**

**And the honest limit of my own audit, which the round should hold me to: inverting an assertion proves the
row can fail, and it does not prove the row is pointed at the right thing.** The only measurement of that is a
mutant in the product, which is what the round is for. **Deletion establishes that a probe is not vacuous;
only a mutant establishes that it is aimed.**

## Clauses 52 and 53: provenance and reproduction, which are the two rules the room earned

52. **No ruling may rest on a fault that has not been reproduced over the interface the claim is about.** A
    reporter states the call it made and what it observed; a seat ruling on one reproduces it first. **An
    unreproduced report is a hypothesis with a severity attached, and a ruling on it converts a hypothesis
    into a decision** — which is how a `TypeError` from a probe's own line of code became a product defect in
    the record for an hour. **The burden of that proof sits with the reporter**, because the reporter is the
    only one who knows what they ran. **The general form, and it binds every seat including this one: run
    something, read the result as a property of the subject, and never ask whether the setup was what you
    believed it was.**

53. **A mutant caught by a row that predates the mutant is evidence about the surface; a mutant caught by a
    row from the same commit is evidence about the row.** Nothing else counts, **and the distinction is
    checkable from the history rather than from the report** — which is the whole reason it is worth writing
    down. **"I watched it fail" is the most available and least informative sentence in this project**, and
    "I built the net and the butterfly in the same commit and watched the butterfly hit it" is what it looks
    like when the author means well. **A probe's coverage is unknown until something is removed.**

### The audit's second question, answered for my own rows from their subjects rather than from memory

> **Which of a probe's rows were written about a defect rather than about a requirement? A row written from a
> remembered defect is narrow by construction — it can only ever find that defect again.**

| my probe | written from | the honest reading |
|---|---|---|
| `s4/planner_property.py` | **the specification** — every assertion is a sentence of `stage-4.md`, and the three that failed did so because the build did not implement it | requirement-derived |
| `s4/write_family.py` | **the specification's request shape**, after the invented-payload episode | requirement-derived, with one row (`S4-150-plan`) written because of the conditional-apply defect |
| `s4/discriminator.py` | **the specification's discriminator**, after the shut-day silence was measured | requirement-derived |
| `s3/fixture_arrival.py` | **a defect** — the four keys accepted and dropped, then the derived-terms gate | **incident-derived throughout**, and it shows: every key it names is a key that had already gone wrong |
| `s4/negative_control.py` | **a caution**, not a defect and not a requirement | the only row in the folder written from "the count is not a coverage claim" |
| `s3/api_core.py` · `terms_history_series.py` | requirements, plus a handful of rows written beside specific defects | mixed |

**So one of my six probes is incident-derived end to end, and it is the one whose coverage I would defend
least** — for exactly the reason the Builder gives for `invariants.mjs`: **a seat listing what has already gone
wrong cannot find a fifth thing.** The mitigation available to me and not to a probe with no history at all:
**every probe of mine has a manufactured red on record** — the deletion audit inverted `S4-171a` (FAIL 13/14)
and `S4-167-a1` (FAIL 15/16), and `negative_control.py` is eight rows proven capable of failing against wrong
answers real builds returned. **So my entry into the audit exists, and it is in the ledger rather than in a
claim.**

### M2 is an equivalent mutant, and that is a different and better finding than a survivor

**M2 (rank vector deleted) survives every row — including `S4-171d` and `NC-008` — because it is not a defect
survivor. It is indistinguishable from the correct build.**

> **options are enumerated in rank order and `betterThan` keeps a strictly-better plan, so the first complete
> plan the search finds is already the rank-vector minimum. The tie-break is implemented redundantly: the
> enumeration order performs it.** Deleting the rank vector therefore changes no reachable behaviour — **no
> black-box probe can detect it, and two rows failing to detect it is not a weakness of the rows.**

**Measured both ways, which is what makes it a finding rather than an argument:**

```
M2   rank vector deleted, enumeration order REVERSED   ->  planner_property 14/15   S4-171d FAILS
M2'  enumeration reversed, rank vector INTACT          ->  planner_property 15/15   S4-171d PASSES
```

**So `S4-171d` kills a rank-blind planner, and M2 is the one planner it cannot kill because M2 changes
nothing.** The row is therefore reclassified honestly: **not coverage of objective 3, but the probe that
catches a future build in which enumeration order and rank order diverge** — and `M2'` is that build,
measured.

**Clause 54, and it is the round's most useful output:**

> **A property can be implemented redundantly, and a redundant implementation is unobservable by
> construction — so a driver cannot distinguish "correct" from "absent" when something else already performs
> the same work.** So **before asking whether a row covers a property, ask what else in the system already
> decides it.** If the answer is "the enumeration order", then coverage of that property is not a fixture
> problem at all; **it is a question about whether the redundancy should exist.** And the standing
> consequence: **a tie-break that is currently redundant is insurance, not waste** — the specification's
> third term stated explicitly, costing nothing, and the only thing between the build and `M2'`. **The report
> should say it is insurance, or a future seat will delete it as unreachable.**

**`S4-171d` is withdrawn as _coverage_ and kept as a _trap_, and the distinction is the whole of it.** The
re-run established that against **this** search the row **cannot fail** — because `rankedOptions` assigns ranks
singles-first-then-pairs and the DFS walks options in that same order, so the first complete plan found *is*
the rank-minimal one. **That is a property of the build's enumeration, not of the row.** And the same re-run
measured the other side: **with the enumeration reversed and the vector intact, `S4-171d` passes; with the
enumeration reversed and the vector deleted, it fails.** So the row is not vacuous — **it is vacuous against
this enumeration and it is exactly the row that catches a search whose enumeration and rank orders diverge.**

**Which makes the Builder's question the productive one, and my answer is yes, with conditions.** A deliberate
rank-order reversal is the right mutation target **because it converts an untestable property into a testable
one**, and that is clause 54 applied rather than a fixture problem solved: **the row and the target are the same
fact.** Conditions: it is planted **on the accepted hash, as its own `sabotage:` commit, by a seat with write
access** — the read-only mount is why two seeds are already unplanted — and **it is planted after the audit
closes**, because a planner repaired mid-audit cannot afterwards be shown to have been blind.

**Stated at the specification level, because it is worth more than another row:**

> **A lexicographic objective whose third term is "prefer lower rank", searched by walking options in rank
> order, is satisfied by construction and can never be tested.** The objective is not thereby unnecessary —
> it still binds when several bookings interact and the first complete plan is not the rank-minimal one —
> **but a black-box suite cannot reach that state, so its coverage cannot be established by driving and cannot
> be destroyed by driving either.** Objective 3's honest status is therefore: **implemented, unobservable from
> outside while the enumeration performs it redundantly, and covered by `S4-171d` against any build where the
> two orders diverge.**

**Objective 3's status, stated as the honest record rather than as a gap or a green: implemented, unobservable,
and now provably so.** The round's entry stands as **M1 caught, M2 equivalent, M2' caught, M3 caught** — **the
surface is not blind at objective 3; it is blind only to a mutant that changes nothing.** `S4-152` and stage
3's fixture-refusal half-application remain **unplanted**, because the read-only mount prevented mutant
commits; they get planted on a seat with write access, on the accepted hash, with the commit discipline this
round could not honour.

### The ledger half: why the third term of `betterThan` exists

**The Builder put the reason at the loop rather than here, and the reasoning is better than the framing it
corrects — so both halves are recorded, in both directions.**

> **A ledger clause governs behaviour; a comment at the code governs survival.** When a decision would
> otherwise look like dead code to the next reader — a redundant tie-break, an unreachable branch, an
> assertion that cannot fail — **the reason belongs in the code, because the ledger cannot warn the person
> holding the delete key.** And the ledger still carries it, **because the ledger carries it for the seat that
> never opens the file.**

**So, as record rather than as advice: `betterThan`'s third term exists because the search enumerates
options in rank order, and therefore the first complete plan it finds is already the rank-vector minimum.**
Deleting the loop changes no reachable behaviour — **M2 is an equivalent mutant, not a survivor, and no
black-box probe can distinguish it** — so the enumeration order performs the tie-break and the loop states
the specification's third term explicitly. **That redundancy is insurance, not waste:** `M2'` reverses the
enumeration while keeping the loop, and `S4-171d` catches it (14/15). **A tie-break that is currently
unreachable is the only kind worth keeping, because the day it becomes reachable is the day it is needed —
and a future seat deleting it as unreachable would be acting reasonably on the evidence available to it,
which is exactly why the reason has to live at the loop.**

**And the accurate status of objective 3, which supersedes the wording `optimiser.mjs` carried while it was
true:** **implemented redundantly; the enumeration performs the tie-break; unfalsifiable by driving;
`S4-171d` catches the divergent-order build.** Not "unverified" — that was accurate when written and is now
understated, **which is the same class of error in the safer direction.**

### A summary must not overstate or understate what a probe establishes

**Overstating is a lie a reader believes; understating is a courtesy that leaves a known gap looking open.
Both are defects in the report, and the probe's exit status is the only place either is allowed to appear.**
This is now the symmetric counterpart of clause 51 — a summary claiming what its assertions do not establish
(`the three objectives are separated`) and a summary understating what they do establish (`objective 3
UNVERIFIED`) are the **same mistake pointing in opposite directions**, and the room has now committed both.

### Seed 4, and a pre-registration — because a rule file is only worth what it costs to write down first

**The design rule, which sits beside clause 55 because it is the design rule behind both:**

> **A mutant chosen at random measures the mutant. A mutant chosen to break a specific assertion measures the
> assertion.** So when a probe's sensitivity is in question, **plant the defect that probe was written about**
> — and if you want to know whether it can see anything else, plant one that is not its incident and accept
> the answer either way.

**Seed 4 plants `fixture_arrival.py`'s own incident** — the reset door accepting four stage-3 keys and
silently dropping them, or the derived-terms comparison, whichever that probe was written about — **and
requires that probe to catch it.**

**So here is my pre-registration, written before the seed exists, because the value of a designed
measurement is entirely in whether the interpretation was fixed in advance:**

| if seed 4… | then the finding is | and it is a statement about |
|---|---|---|
| **is caught** | `fixture_arrival.py` sees its own subject | the narrowness being a fact about how broad the specification is, not about the row |
| **survives** | **the one probe in the room written end-to-end from an incident cannot see that incident** | the row — and "narrow by construction" becomes a measurement instead of an argument |
| **is caught by a row in the file I did not think of** | the probe's coverage is broader than its subjects | the file, and I will name which row, because a catch by an adjacent row is not the same result as a catch by the intended one |

**And two things I bind myself to in advance, so the result cannot be read generously after the fact:**

1. **A catch by seed 4 is a measurement about `fixture_arrival.py` and not a repair of it.** The probe's other
   rows stay on the record as incident-derived and unknown, **and the file is not reclassified as
   requirement-derived because one seed landed on it.**
2. **A survival is reported as a survival**, with the same write-up as a catch, **and I will not go looking
   for a different probe in my own folder that happens to catch the same defect in order to soften it** — a
   second instrument catching it is a separate finding about that instrument, and it is not evidence about
   this one.

**Either way the answer is about the probe, not about the seed, and that is the difference between an
experiment and an observation.**

### Seed 4's fourth horn, and the rule it is made of

**The likeliest outcome is the one neither the Foreman nor I wrote down: seed 4 is caught only by a Builder
probe. So the pre-registration gains a fourth horn — and the rule it is made of is now clause 57.**

> **Aim determines what a catch means.** Every catch is evidence about **the row that fired**. It is evidence
> about the row it was aimed at **only when that row fired**. So a mutant's result is **always reported
> per-probe, never per-file, per-seat or per-suite** — because the moment a result is summarised at a coarser
> grain than the aim, **a catch migrates to a probe that did not earn it, and that migration is exactly how a
> green suite ends up containing an invariant that has never run.**

| if seed 4… | then the finding is |
|---|---|
| caught by `fixture_arrival.py` | it sees its own subject; its narrowness is about the specification's breadth |
| survives | **the one probe written end-to-end from an incident cannot see that incident — narrow by construction becomes a measurement** |
| caught by another row in my file | the file's coverage is broader than its subjects; **I name which row, because an adjacent catch is not the intended catch** |
| **caught only by a Builder probe** | **the row the seed was aimed at is still `saw: unknown`** — and a door probe written from an incident has been shown blind to that incident by a different instrument, **which is a finding about both probes at once** |

**And a convergence worth recording, because two seats reached the same restatement from opposite
directions:** I proposed asserting that **the export succeeds and carries its records** — the defect cannot be
*read*, but it can be *heard* — and the Foreman measured the same thing **from a run in which the key was never planted** — a replan
issued and never confirmed, so the export answered 200 with records present, **and that measurement is
withdrawn** (clause 58). **The Builder's run, which did plant the key, answers 422 `validation_failed`** — so
the signal is **the export being refused, loudly and with a registered code**, not a silent shape
difference. So Invariant 2 becomes **three
rows**: the export is well-formed and carries every seeded reservation, asserted **by reference so a record
that cannot be serialised is a red row rather than a missing object**; each exported record carries no
planner scratch key, enumerated **per record inside its own guard**; and **the view allowlist stays,
separately scoped and labelled as being about the view** — because it is a correct assertion about a
projection, **and the audit's finding was never that it is wrong, only that it was doing a record's job.**

**Which produces the sharpest sentence in this repair, and it belongs in the report rather than in a tidy
repair story:**

> **the defect the invariant exists for is circular, so a record-side row cannot see it by enumerating keys —
> serialisation fails before any key is readable. That is not an inconvenience in the probe. It is the reason
> the invariant never ran, discovered by the person repairing it rather than by the audit that found it.**

**And the general shape the repair also demonstrated, which the Foreman stated and which I am keeping: the
guard has to be at the level where the failure actually occurs, which is never the level you first think of.**
The first attempt guarded the fetch; the throw was one level in, in the iteration.

### Two measurements of one mutant, taken in the same minute, disagree — and that is the finding

```
Builder:   with the circular scratch key planted,  GET /_test/export  ->  422 validation_failed
Foreman:   under AUDIT MUTANT A, a seeded booking plus a replan,     ->  200
```

**Both were single instances of "the mutant is planted", read as the whole — the first time two seats produced
contradictory numbers about one defect inside a minute. RESOLVED, and not by argument:** the Builder's run
planted the key and answers **422**; the Foreman's run **never confirmed its replan succeeded, so no key
existed**, and it read that clean export as a finding about the product (**clause 58**). **So the row is
written against the state the mutant actually produces — an export that is _refused_ — and the state is named
in the row rather than assumed.

**Which is also why the completeness half is not optional, and the Foreman's amendment is right on the merits
whichever number is correct:**

> **An assertion's strength is set by the weakest way its subject can be satisfied.** Status codes are the
> weakest — they say the request did not fail, not that it did the thing. **The comfortable version of a row
> is usually the one that cannot fail**, and this stage has now produced that failure three times: a view
> allowlist, an export status, and a probe's own summary line.

**If the export answers 422, a status row is red immediately. If it answers 200 with the records omitted, only
the completeness half is red.** A row asserting both is red either way, **which is the property that makes it
worth writing when two measurements of the same mutant disagree** — it does not require the disagreement to
be resolved first. **And this is the negative-control discipline arriving from the other side: a control asks
how weakly the subject can be satisfied, and this asks the same question of a positive row.**

58. **A finding about a defect must state the defect's presence in the same breath as the finding.** A
    measurement taken before the subject exists **is not a weak measurement — it is a measurement of nothing,
    and it produces a number that reads exactly like knowledge.** So **every planted-defect result names the
    state that was planted, the call that planted it, and what that call answered.**

    And the newest form of this stage's one shape, which is unique to the Foreman and worth keeping precisely
    because it is not an assumption: **a stale assumption announces itself as a mistake, while a _misdirected
    verification_ produces a number that looks like knowledge.** Nothing was assumed; the wrong thing was
    verified, in a state where the subject of the measurement had not been created, and the clean result was
    reported as a property of the product. **The Builder's version is the mirror image: a patch that did not
    apply, read as a property of the code.** Between them they are the same error — *a measurement of a state
    other than the one under discussion* — arriving once from the reader and once from the writer.

    **What this does to a clause's worked example: the rule survives, the illustration does not.** Clause 57's
    mechanism was never in doubt — **a migration of credit, not a failure to test, is what put an unrun
    invariant inside a green suite** — but its example cited the withdrawn measurement, so the example has been
    corrected above rather than kept. **A rule illustrated by a retracted measurement is a rule with a
    borrowed proof.**

### Settled from the history: what `ee04207`'s red actually reported

**Read from the commit, not from the reports, as instructed — and the answer splits the probe in two.**

```
ee04207  "THE PROBE IS RED, AND IT FOUND A REAL DEFECT ON ITS FIRST RUN … 5 of 17 assertions fail:
           a preview over a closure on t_1 answers 409 no_feasible_plan when the only booking is on t_2"
         "Invariant 2 passes in full: no unexpected field on any reservation view, no planner scratch
          key on any view, and none on any exported record."
```

**So it was a genuine _failure-red_ — named rows, not a crash — but the defect it caught belonged to
Invariant 1, and the scratch-key invariant _passed in full_ in the very commit named after the scratch-key
incident.** Under `AUDIT MUTANT A` the two scratch-key rows **pass again while that defect is planted.**

**Therefore, precisely: `invariants.mjs` enters the audit with one committed failure-red belonging to
Invariant 1, and with Invariant 2's rows carrying _zero_ reds of their own and demonstrably pointed at a
projection of their subject** — a key stashed on the record is not in the view, and under the mutant the
export cannot serialise at all, so the probe crashes before it can report.

**And there is a third kind of red, discovered from the other side, and it is the worst of the three:**

55. **Assert against the surface where the defect lives, not a projection of it.** An allowlist over a
    response view cannot detect a field added to stored state, **because the view is constructed and the
    field is not in it** — the record is the subject and the view is evidence about the record. **And a
    probe's failure mode must be a _reported row_, never an exception: a crash is red in the exit status and
    silent about which invariant failed, and every row after the crash point never runs** — so a defect that
    breaks serialisation converts a diagnosable failure into an opaque one. **A _crash-red_ is the third kind:
    red without being informative**, and it is the only one of the three that destroys evidence rather than
    producing it. Where a subject may be unserialisable, the probe must **catch, report, and continue.**

**One irony worth recording rather than glossing: `ee04207` deliberately reported blocked assertions as
failures "so the count cannot be read as coverage", and the audit has now found a mode in which the rows after
the failure never run at all** — the same hazard, arriving from the opposite direction, and fixed by the same
discipline.

### Item 1 closed, and Invariant 2 has its first `saw` (`56e278a`)

**Restated as its consequence rather than as a key**, because the defect is circular and a key-enumerating
row cannot see it either. Demonstrated **by planting, not by inverting**:

```
no mutant        6/6 green, no crash
AUDIT MUTANT A   EXPORT-SERIALISES  status 422 -> FAIL, and carries no reservations array -> FAIL
                 2 FAILURES and NO stack trace: it reported rather than threw
```

**Before this commit Invariant 2 had zero reds of its own — it had never reported the defect it was written
for, live or planted. That is now the first `saw` in the file, and it was bought by a planted defect rather
than by an inverted assertion.**

**And one property of the repair is worth carrying, because it is what makes the unreconciled 200/422
measurement harmless: the completeness row goes red under _both_ outcomes by construction** — an export that
fails is red, and an export that answers 200 without the records is red. So:

> **A row should be red under every state its subject can plausibly be in.** Where two seats disagree about
> what a mutant does, the answer is not to reconcile the numbers first — it is to write the row so the
> disagreement cannot change the verdict. **A row whose result depends on an unresolved fact is a row whose
> next reading will be argued rather than measured.**

### Clause 59: a measurement whose setup did not succeed is **void**, not weak

**Hardened from clause 58 after the seventh instance of the stage's shape, and it is the cheapest precondition
to satisfy and the most expensive to discover late:**

> **Every reported measurement names the state it was taken in: the calls that created it and what each
> answered.** **Where a setup call failed, the measurement is _void_ — not weak — and the report says so
> rather than reporting the number.**

**The instance that produced it, kept whole because every step of it is instructive:**

```
POST /auth/signup             -> 422  "The email address you entered is not valid"
POST /_test/reset             -> 400  malformed_request        (wrong body shape, twice)
POST /restaurants/r_1/replans -> 401  (no valid token)
GET  /_test/export            -> 200, reservations: []
```

**Nothing was seeded, the replan never executed, no circular key was ever written — and the export of an
empty state was reported as a measurement of the defect.** The number was **200, with a body, looking exactly
like knowledge**, which is what makes the failure mode expensive: **it does not look like an error, so nothing
downstream suspects it.**

**And the disagreement itself is recorded as the good outcome rather than a wobble:**

> **Two seats contradicting each other inside a minute exposed a measurement whose every setup step had
> failed. One seat's rigour was the other's undoing, and the disagreement is what caught it.** A room where
> the numbers agree because nobody checked the setup has learned nothing.

**My own instrument already asserts in this shape, which is the only reason I would have noticed the pattern
so quickly: every probe of mine begins with setup rows — `S4-000-setup`, `S3-300-setup` — that assert each
state-creating call succeeded _before_ any result is read**, and returns early rather than proceeding on an
unestablished state. That habit is now the clause rather than an accident of authorship, and the general form
is worth stating: **the setup assertion is not bookkeeping before the measurement; it _is_ the measurement's
precondition, and a probe that reads a result before establishing its state has produced a number, not a
finding.**

### The second state was measured, and my prediction did not happen

```
state 1  key stashed by a replan on a produced reservation        -> export 422 validation_failed
state 2  key stashed by the seeder on a fixture-seeded booking   -> export 422 validation_failed
```

**So the defect has one manifestation, my question about which reservation carries the key does not
discriminate, and the hypothesis is _answered_ rather than discarded.** And the outcome I called the
stronger one — *200 with records present, where each half of the row catches a state the other misses* —
**did not occur: the status half catches both.**

**The consequence belongs to the row, not to the argument: the completeness half is currently _unproven_,
not justified, and it must not be cited as part of what makes the row work until a state exists where the
status half is green.** It is retained for a reason that has now been tested and returned "the other half
was sufficient" — which is a legitimate reason to keep redundancy and an illegitimate reason to claim it
earned its place. **And this is the reports-and-sees discipline applied to a row's own halves: I can state
that the status half sees, in both planted states, and I cannot state that the completeness half has ever
seen anything.**

## SEED 1 GRADED -- `170c99d`, a refusal that mutates (S4-152)

```
PLANTED STATE, read before any result (clause 59), Builder's own words:
  the mutation   stage-4/src/fixture.js parseSeededReservation -- store.allocateReference(state)
                 called BEFORE failing on a declared accepted_terms
  the claim      "the route writes state and then returns its error"; the reference counter has
                 already moved by the time the answer is produced
```

### The grade, per probe, ruling on none of it

| probe | rows | red | saw |
|---|---|---|---|---|
| `write_family.py` | 9/9 | 0 | no |
| `discriminator.py` | 16/16 | 0 | no |
| `planner_property.py` | 15/15 | 0 | no |
| `negative_control.py` | 8/8 | 0 | no |
| `s3/fixture_arrival.py` | 36/36 | 0 | no |

**84 rows, zero reds. But the seed did not take, so that number is not evidence about the probes.**

### Why: the mutation cannot reach the store, and this is read three ways

1. **The code.** `api.reset` is `const next = await stateFromFixture(ctx.body, ctx.nowMs); store.setState(next);`
   **The throw precedes the only write. There is no path by which the allocated reference reaches the store.**
   The seed's own description -- "the route writes state and then returns its error" -- is **false at this hash.**
2. **The external observable.** `GET /_test/export` is **byte-identical** before and after the 422
   (`validation_failed` -> `fixture_unsupported`, 422, as designed). So the defect has no manifestation
   *anywhere*, not merely none the probes read.
3. **There is no counter.** `allocateReference` is `newReference(isTaken)`: a **random draw** over an
   alphabet with a taken-check, retried up to 1000 times. **There is no sequential reference space and so
   no value to skip** -- which retires the Foreman's proposed row ("the next booking's reference skips a
   value") **as literally specified**: it is aimed at a counter this codebase does not have.

### What this seed does and does not tell the room

- **It is not a survivor.** A survivor is a live defect that no probe saw. **This defect was never live.**
- **It is not a catch**, and the 84 green rows must not be filed as the probes having answered anything.
- **The row owed for S4-152 is still owed.** The observable that *does* exist is the export byte-diff across a
  refusal -- and **that is already asserted, by `S3-340-declared-revision` and `S3-341`**, which passed here
  because there was nothing to detect. **So the honest position: the observable was already covered, the
  mutant was inert, and the two facts are independent.**
- **For the next planting of this seed the mutation has to survive the throw** -- allocate and *keep* the
  reference in the candidate state (seed it, or write it and return a success-bearing refusal). Without that,
  the seed is a no-op wearing a defect's commit message.

## THE PLANTINGS GRADED -- all four, per probe, ruling on none

### The graph first, because two of the four hashes mean something other than what the room was told

```
96000db  ledger (mine)
  170c99d  seed 1   parent 96000db   fixture.js   allocateReference before the refusal
    4b4bc5c  reversal  parent 170c99d  replans.js  DFS walks options in REVERSE rank order
      644ee7c  seed 4  parent 4b4bc5c  fixture.js  the door accepts and drops the four keys
      1780d45  parent 4b4bc5c  fixture.js  same tree as 644ee7c, message says "precondition"
        fadad4d  M2'   parent 1780d45  replans.js  and betterThan's third term deleted
```

- **`4b4bc5c` was never amended and is not orphaned. It is the parent of all three later plantings** and it is
  the genuine precondition: reversal only, no fixture change. The account of an amend that rewrote a hash is
  **not what happened**; what exists is a *new sibling* of `644ee7c`.
- **`1780d45` is not a precondition.** Its diff is `fixture.js` -- **seed 4's mutation** -- and its tree is
  byte-identical to `644ee7c`. It inherits the reversal from its parent, so **it carries both mutants and its
  message describes neither.**
- **So `644ee7c` and `fadad4d` both carry seed 4's defect, and no planting after `170c99d` isolates a single
  defect.** Attribution below is by file and by row disjointness, and is stated as attribution, not as proof.

### The grades

| planting | hash | write_family | discriminator | planner_property | negative_control | s3/fixture_arrival |
|---|---|---|---|---|---|---|
| seed 1 | `170c99d` | 9/9 | 16/16 | 15/15 | 8/8 | 36/36 |
| precondition | `4b4bc5c` | 9/9 | 16/16 | 15/15 | 8/8 | 36/36 |
| "precondition" | `1780d45` | 9/9 | 11/16 | 15/15 | 7/8 | 30/36 |
| seed 4 | `644ee7c` | 9/9 | 11/16 | 15/15 | 7/8 | 30/36 |
| M2' | `fadad4d` | 9/9 | 16/16 | **14/15** | 7/8 | 30/36 |

**Per-probe, in the format fixed before the seeds landed:**

- **seed 1 `170c99d`: 84 rows, 0 red -- and the seed is inert** (`api.reset` throws before `store.setState`).
  **Not a survivor: a survivor is a live defect no probe saw.** The rows are `reported: yes, saw: no change`.
- **precondition `4b4bc5c`: 84 rows, 0 red, correctly.** **Earns nobody a `saw` and is not evidence about any
  probe** -- it is graded by whether the mutant planted on top of it becomes visible, and one does.
- **`1780d45`: the same reds as `644ee7c`**, which is the check that identifies it: whatever its message says,
  **its tree is seed 4.**
- **seed 4 `644ee7c`: 10 reds across two probes.**
  - **`fixture_arrival.py` 30/36 -- `S3-301-policies`, `S3-301-series`, `S3-301-history`, `S3-305`,
    `S4-151-control`, `S3-302b`.** **This is the pre-registered seed and the row aimed at it caught it.**
  - `discriminator.py` 11/16 -- `S4-167-a1`, `a2a`, `a2b`, `a3b`, `cal`. **My rows, not the aimed row: evidence
    about those five rows only, and it does not touch `fixture_arrival.py`'s credit.**
  - `negative_control.py` 7/8 -- `NC-004` red, meaning the control's deliberately wrong answer became the
    build's answer. **A control going red is not a coverage claim in either direction.**
  - `write_family.py` 9/9 and `planner_property.py` 15/15: **the planner reds require the vector deletion, so
    their silence here is what isolates `fadad4d`'s reds to the third term.**
- **M2' `fadad4d`: `planner_property` 14/15, and the red is `S4-171b` -- not `S4-171d`, the row it was aimed
  at.** `S4-171d` **PASSES** against the mutant written for it. `S4-171b` is the row **withdrawn from coverage
  at `d534b5e`**. So: **`planner_property` has its first `saw`, and the row that earned it is the one that had
  been demoted, while the row aimed at the defect passed.** Its other reds (`discriminator` 16/16 here) are the
  fixture mutation's absence, which is the attribution working in both directions.

### What the pre-registration cost and bought, written out

> `fixture_arrival.py` was `saw: unknown`; it is now **`saw`, at `644ee7c`, six named reds.**

**"Narrow by construction" was an argument and is now a measurement, and the measurement is favourable: the one
probe written end-to-end from an incident is the one that saw the incident -- while three other probes saw it
too and are owed nothing for it.** The fourth horn did not fire: **no catch came from a Builder probe in place
of mine.**

## SEED 1 REPLANTED -- `fc8c76b`, graded. The one live defect the round caught.

```
PLANTED STATE, read by me before any probe result (clause 59), Builder's check reproduced independently:

  clean reset                      -> 204
  export before    batch_counters  {} 
  REFUSING reset (declared terms) -> 422 fixture_unsupported
  export after     batch_counters  {"r_1": 1}
  BYTE-DIFF ACROSS THE REFUSAL     -> CHANGED
  => THE PLANT IS LIVE. Reproduced at my own port, not taken from the commit message.
```

**Note the confound before the numbers: `fc8c76b` descends from `fadad4d`, so its tree carries three
defects -- the enumeration reversal, seed 4's accept-and-drop, and the vector deletion. It is not a clean
plant. What makes the attribution exact anyway is that I hold the baselines: `644ee7c` and `fadad4d` were
graded, so the reds *new at this hash* are attributable by difference rather than by argument.**

| probe | `fc8c76b` | new reds vs `644ee7c` |
|---|---|---|
| `write_family.py` | 9/9 | -- |
| `discriminator.py` | 11/16 | -- (seed 4's five) |
| `planner_property.py` | 14/15 | -- (M2's `S4-171b`) |
| `negative_control.py` | 7/8 | -- (`NC-004`, seed 4's) |
| `s3/fixture_arrival.py` | **27/36** | **`S3-340-declared-terms`, `S3-340-declared-revision`, `S3-341`** |

**Three new reds, all named, all the same sentence: `reset 422, export unchanged=False`.** So:

- **The prediction held, and it held in the form that matters: the observable is the export byte-diff across
  a refusal, and the rows that already asserted it fired.** `S3-340-declared-terms`,
  `S3-340-declared-revision` and `S3-341` are `S4-152`'s first `saw` -- **the proposed row the Foreman
  withdrew was replaced by rows that were already written,** exactly as predicted, and **three of them
  rather than two.** **Scoped, because the scope is the whole point: the object withdrawn was the
  Foreman's proposed *reference-skip row* ("the next booking's reference skips a value"), retired at
  `170c99d` because `allocateReference` is a random draw with a taken-check and so has no counter and
  nothing to skip. `S4-152` itself was never withdrawn -- it is live, carries an observable, and this
  line is its first `saw`. (Reference count is deliberately not stated here: `grep -c "S4-152"
  verification/ledger-stage-4.md` is the authority, and a numeral written into the sentence being amended
  is stale the moment the amendment lands -- which is how this document came to say twelve.) A row and a requirement are different objects and this
  sentence used to read as if they were one.** *The clause and the phrase being scoped here are the
  **Builder's**, written at `fc8c76b`; this ledger is committed by the Adversary, so the repository's
  history attributes both the phrase and this correction to one seat, and the diff is the only
  distinguisher.*
- **Those rows passed at `170c99d` and at `644ee7c` and would have passed forever against an inert plant.**
  **Their earlier green was not evidence about the defect; it was evidence that the defect was absent.** This
  is the sharpest form of the round's rule: **a green row over a mutation nobody verified is not a passing
  row, it is an unmeasured one.**
- **Per-probe `saw` for the seed:** `fixture_arrival.py` sees the mutating refusal **and** seed 4's door
  defect; `planner_property` sees M2' via `S4-171b`; `discriminator` sees seed 4's policy rows; `write_family`
  sees nothing here and is not thereby exonerated.

### The five-commit round, graded

| commit | kind | grade |
|---|---|---|
| `170c99d` | seed 1 attempt 1 -- allocate into the candidate | **INERT** -- throw precedes the only write; 84 green rows mean nothing |
| (uncommitted) | replant 1 -- `restaurant_revisions` on live | **LATENT** -- real, held, never exported; caught before commit |
| `fc8c76b` | seed 1 attempt 2 -- `batch_counters` on live | **CAUGHT** -- three named reds in `fixture_arrival.py` |
| `1780d45` | precondition -- enumeration divergence | earns nobody a `saw`; not a mutant |
| `644ee7c` | seed 4 -- the door accepts and drops | **CAUGHT** -- six reds in `fixture_arrival.py`, five in `discriminator` |
| `fadad4d` | M2' -- precondition plus the vector deleted | **CAUGHT** -- `S4-171b`, not the row it was aimed at |
| seed 2 | unplanted by agreement | two mutants in one function are one experiment |
| `4b4bc5c` | the real precondition; **not orphaned, and not amended** | graded as the precondition |

### Clause 56: _reports_ and _sees_ are two facts, and only one is cheap

**A manufactured red proves a probe can _report_; it does not prove it can _see_.** Inverting an assertion
produces a clean failure and says nothing about whether that assertion could ever fire on its subject — **a
row that cannot fail on its subject can be inverted all day.**

> **Manufacture a red to establish that a probe reports. To establish that it _sees_, plant the defect and
> confirm a _named_ row goes red — and if it does not, that probe's green was never evidence in the first
> place.**

**This corrects a claim I made two turns ago, and the correction weakens it:** I said every probe of mine has
a manufactured red and therefore has an entry into the audit. **That establishes reporting only.** The honest
per-row position in my folder:

| row | reports? | sees? | evidence |
|---|---|---|---|---|
| `S4-171a` | ABSENT (sweep owed — no heading-sweep run against this row yet) | yes (deletion audit: FAIL 13/14) | **yes** | it caught the missing-objective defect while it was live, on a hash it predates |
| `S4-171c` | ABSENT (sweep owed — no heading-sweep run against this row yet) | yes | **yes** | same — it caught the seat-blind planner at `75bb37e` |
| `S4-171d` | ABSENT (sweep owed — no heading-sweep run against this row yet) | yes | **no, by construction** | M2 survives it; it catches only an enumeration that diverges from rank order |
| `S4-171b` | ABSENT (sweep owed — no heading-sweep run against this row yet) | yes | **no** | withdrawn: it never failed on its subject |
| `S4-167-*` | ABSENT (sweep owed — no heading-sweep run against this row yet) | yes (deletion audit: FAIL 15/16; 16 controls) | **partly** — the calendar-divergence rows saw a real divergence; the rest are unplanted | one measured catch, the rest unmeasured against a mutant |
| `fixture_arrival.py` | yes | **unknown, and most likely no** | its rows are incident-derived and sit closest to a projection; **no defect of its own has ever been caught by it** |

**So my ranking of which of my rows I expect the audit to find vacuous, offered before it finds them:** first
**`fixture_arrival.py`**, because it is both the incident-derived probe and the one nearest a projection;
second **`S4-171b`**, already withdrawn; third **`negative_control.py`'s controls for rows it does not
duplicate** — the controls prove the rows they name can fail, and say nothing about whether those rows see.
**A seat that names its own weak rows cannot be accused of having hidden them, and the ranking costs nothing
the audit would not have found.**

## M2 survived against my own rows, and `S4-171d` is the rebuild

**M2 — the rank vector deleted from `betterThan` — left every measurable row green, including mine.** So the
prediction I made ("deleting the rank vector is caught by `S4-171b`") is **withdrawn rather than repaired**,
and the cause is structural rather than a missing assertion: **singles are ranked in declaration order, so a
search that walks options in rank order finds the rank-correct plan _first_ and never consults the tie-break.**

> **A fixture is not a tie until the property decides it — and enumeration order is a property, the one a
> search is most likely to satisfy for you.** So every row whose cases can tie must be checked against a
> variant in which the tie is broken the **wrong way first**; **if the row survives that, it is asserting the
> search's order rather than the specification's objective.**

**`S4-171d` is built on the one asymmetry available: singles rank before pairs.** A party of 4 that can be
seated either by a 4-seat single or by a declared pair of two 2-seat tables has a **lower-ranked single** and a
**higher-ranked pair**, both wasting nothing — so levels 1 and 2 tie exactly, and **the vector's job is to
reject the pair plan, which is the one a pairs-first enumeration meets first.** The row **asserts its own
declaration order in its output**, because a fixture whose correctness depends on declaration order has to say
so. **`NC-008` asserts the pair plan must be reported FAIL** — and it is, at the correct build.

**What I cannot settle from here, stated rather than assumed:** whether `S4-171d` kills M2 depends on the
search enumerating pairs before singles. **If the search enumerates in rank order instead, this row is another
fixture a rank-blind search passes** — and the only way to tell the two apart is to re-run M2 against it,
**which is not mine to do.** So the honest position is the same one I took for `S4-171c`: **this row is not
proof of the property; it is the strongest row I can build without mutating the product**, and the re-run is
the measurement.

## Stage 4 closed at `75bb37e`

**PASS at `75bb37e`, graded by me from `git archive`: supplied 120/120 · 25/25 · 7/7 · stage 4 6/6, highest
contiguous 4**; `write_family` 9/9 · `discriminator` 16/16 · `negative_control` 4/4 · `planner_property` 11/11;
`api_core` 48/48 · `terms_history_series` 34/34 · `fixture_arrival` 36/36; stage-2 screens green at 1280 and 375
with **0 residual**. **`345bbe6` is PASS-superseded**: a commit where every suite and the supplied run were
green and the planner refused a feasible plan — **a full green surface is not weak evidence about the planner,
it is no evidence at all.**

**Three things open, recorded rather than absorbed, and all three are debts with a named owner:**

1. **The optimiser fixtures for levels 2 and 3 — PAID at `da687bd`'s successor, as `S4-171a` and `S4-171b`.**
   `S4-171a` makes level 1 and level 2 point at **different plans**, so a build optimising the seat total
   alone returns the other one and the row is red; `S4-171b` is a full tie on both terms decided by the rank
   vector. **Both assert the plan by reference, not the totals.** Each has a negative control whose wrong
   answer is **the plan the other reading produces**, not an invented one: `NC-005` (the seat-greedy plan)
   and `NC-006` (the mirrored vector).
2. **`S4-152`'s path debt is owed to the next defect round** — a refusal must not mutate, asserting is not
   mutating — **and stage 3's fixture-refusal half-application debt travels with it**, still unpaid.
3. **The browser half is self-verified and is recorded under limits, not results.** The Builder's suites are
   the only browser evidence in the room and the Builder runs them: **verified by the seat whose code they
   exercise. 358 rows must not be read as independence**, and this seat cannot drive a browser at all.

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

## The written sources, indexed — so no requirement is discovered by being wrong

**The Builder implemented a stage-4 write family without reading `tablekeeper/spec/stage-4.md`, and the whole
feature was wrong in most of its particulars. It asked whether another written requirement existed that it had
not read. These are all of them, with what each governs. This section is the answer, and it exists so that the
next seat reads the list instead of finding out by shipping.**

| source | what it governs | read before |
|---|---|---|
| `tablekeeper/spec/stage-1.md` (472 lines) | reservations, tables and pairs, moves, idempotency, time input, retries | any change to the booking path |
| `tablekeeper/spec/stage-2.md` (240) | table combinations, capacity, the screens, accessibility, the hidden-grid and wrong-advice defects | any change to occupancy or a screen |
| `tablekeeper/spec/stage-3.md` (240) | policies, publication order and versions, history, `explain`, series and occurrences, import/export | any change to terms, history or a series |
| **`tablekeeper/spec/stage-4.md` (109)** | **the write family: request shapes, response shapes, the optimisation order, planning limits, the revision counter, every status code and every refusal** | **any stage-4 route — this is the document the last turn was lost in** |
| `docs/participant-guide.md` (877) | the room's process, the sanctioned harness command, what may and may not be read | anything about how verification is run |
| `kickoff-manifest.json` | the track's identity and the revisions under test | pinning a hash |
| `verification/ledger-stage-*.md` | **my rows and clauses — a ledger of what to check, _not_ a specification.** It records what a seat must not miss; it does not define the product | never as a substitute for the four documents above |

**Two of the ambiguities I carried were answered outright by `stage-4.md`** — `A2`'s rank-vector order and
`A4`'s meaning of `changed` — **and both were recorded as "expected to be decidable only by driving".** So:

> **A recorded ambiguity that a written requirement already answers is not an ambiguity; it is a failure to
> read — and no question in the walk can find that class, because every question in it is asked of a probe and
> this was a question about a document.**

**And the walk gains a fifth question, from the Foreman, which is the right place for it:**

5. **Conformance** — **is the written specification walked against what was built, field by field and status by
   status?** Because **a document read once before designing is not a document checked afterwards**, and the
   second reading is what would have caught the pair-indexing map, the time-keyed answer map, and `fail()`'s
   coercion of an unregistered code. **The specification is a row too** — and it is the one row whose failure
   mode is silence, because everything downstream of a misread requirement looks like an implementation bug.

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
34b. **A route's request shape is specified in the stage's own specification.** So: **read that section
    before designing a payload**, and **treat inventing one as a defect measurable from outside** — a service
    that answers `400 malformed_request` to the shape the specification prints, while accepting a shape
    nobody wrote down, is a defect against a documented requirement and not a disagreement about taste.
    **And declaring a blocker before looking for the written requirement is not caution.**
41. **A shape or a fixture arrived at by trying variants until one stops failing is not a specification,
    whatever its pass rate. The count of attempts is the tell.** Guessing a payload until something stops
    `400`ing is the payload-scattering twin of a fixture-cached sum: **it produces a green nobody
    understands**, which is the failure this stage has removed four times.
42. **Every code the service can raise must be registered, because an unregistered code is silently coerced
    and an unregistered code is a lie told about a fault.** `fail()` coerces an unknown code to
    `validation_failed`, so a `stale_plan` answered **422 with a validation message** and sent the
    implementer hunting a validation fault that did not exist. **A tool that cannot tell you that a code you
    invented does not exist is a tool that will let you debug the wrong thing.** Asserted as a row in its own
    right: every code the implementation can emit is in the error layer's vocabulary, with its status.
43. **"We checked and it is only redundant" is a claim a later reader cannot verify by reading** — so record
    the redundancy, and **do not present "not lossy" as the same kind of result as a found loss.** The
    Builder's own framing is the right one: a derivation that can yield the same table set twice is
    **redundant rather than lossy, and the duplicate is harmless only because the preference order puts the
    preferred option first** — which is a fact about ordering, not about data, and would change if the order
    did. **A clean bill of health on question 4 is weaker evidence than a found loss, and the difference is
    recorded rather than smoothed.**
48. **A no-regression claim is a claim about a _suite_, and it is only as good as the last time that suite
    ran.** "No regression" is not a fact about the change under test; it is a fact about a set of rows at a
    moment. **Five shared modules is five chances to be wrong about what a change touched, and enumerating
    them by hand is the same failure as reading instead of driving.** So: **re-run the whole surface after
    every change, not the suites you touched** — and the measurement that catches a regression costs one
    command, while the claim that would have replaced it costs a whole commit. Recorded from the turn where
    stage 3 went **47/47 → 37/47 inside an uncommitted patch**, every failure a series row, and the work
    reverted to green because **a shared folder with ten uncommitted files is exactly what another seat
    commits by accident.** **An unmeasured green is not a safe state; it is an unmeasured one.**
49. **The walk covers a probe against its row; it does not cover an implementer against a specification.**
    Every question in it is asked of a probe, so **no amount of walking my own rows would ever have found
    that two recorded ambiguities were answered by a document nobody opened.** That is the fifth question's
    whole reason for existing.
50. **The absence of a specification is a stop condition, and it stops at the ledger's edge — the ledger is
    evidence about a specification, not a substitute for one.** There is no `stage-5.md` and the manifest
    lists four stages, so **stage 5 does not open**: not blocked, not pending, **complete.** The clause is
    permanent rather than a stage note, because **a seat with no written requirement and a thorough ledger in
    reach will build from the ledger — it is the only document offered** — and that is precisely how thirteen
    deviations shipped in stage 4. **"Read the specification for the stage you are working in, then the
    ledger" has an unsatisfiable first half when no specification exists, and the unsatisfiable half is the
    one that must stop the work.**
47. **Every artefact must state what kind of authority it carries, because nothing in a folder listing says
    which kind you are reading.** A specification defines the product; a ledger records what to check; a
    check file asserts behaviour; a participant guide says how the room runs. **I introduced a ledger as "the
    brief" and a seat implemented thirteen deviations from it**, while another seat and I between them ruled a
    payload from a filename. **All three are one failure: the authority being worked from was mistaken for a
    different kind of thing, and nothing in the tree said so.** The fix is one line at the top of each
    artefact, written by its author, because **the author is the only one who knows what it is for.**
46. **An alias resolves two specifications; it cannot resolve a specification and a filename.** Where a
    room-held name and a written requirement differ, **the requirement wins, and the name is evidence about
    intent rather than a claim about behaviour.** And the wider form, which cost two stages to learn twice:
    **reasoning from intent is not caution — it is a substitute for reading, and it looks exactly like rigour.**
44. **A comment load-bearing across stages is an instruction nobody re-reads.** Clause 25's finding was that
    a comment becomes a design's apparent intent; **the symmetric case is a comment quietly _holding_ a
    design together** — a `seam-check` index keyed by table-set *and* time for one reason only, because a
    comment written two stages earlier said so, in code written this stage. **Where a comment is load-bearing
    for correctness rather than for explanation, assert the property instead of trusting the comment** —
    otherwise correctness depends on a future reader's memory. **Same fix, opposite direction: assert it.**
45. **A seat blocked by a missing specification should spend its turn making the specification cheap to
    supply, not making the argument louder.** The Builder's menu — *here is exactly what I built, here are the
    two shapes I would accept, rule on any line* — resolved in one exchange what two refusals had not, **and
    the naming evidence was preferred over the implementer's own design by the implementer**, which is the
    disposition this stage has been trying to produce.
35. **A row that asserts wording must also assert the condition that makes that wording true** — the
    precondition is part of the assertion, not a note beside it. A wording row with no precondition is a
    row about vocabulary, **and vocabulary is the part of a screen least likely to change and therefore
    least likely to be caught when the meaning underneath it moves.**
36. **Stale rows are caught by re-deriving; under-specified rows only by asking what would have to be true
    for the row to be right — and that question has _two_ halves: is the condition asserted at all, and is it
    read from the place the implementation reads it from?** A stale row asserts something that was once
    true; an under-specified row asserts something **that was never pinned down, so re-derivation finds nothing
    and reports green.** **A row can satisfy the first half and fail the second, which is how a
    correctly-shaped row is still a row about the wrong thing** — `S4-167`'s 3b asserted that the day was not
    shut, read from `GET /restaurants/{id}`, which reports the **base** calendar while the day state follows
    the **policy's**. **The shape was found by re-deriving; the source was found by driving.** So the walk's
    standing question, of any row asserting wording or state: **what would have to be true for this row to be
    right, is that asserted, and is it read from the surface the implementation reads?**
39. **Assert the comparison is over a population neither side can shrink, _before_ asserting anything about
    it** — an assertion over a reduced population is worse than no assertion, **since it looks like
    coverage.** And the loss is not always a map: the three instances are the pair-indexing map · the answer
    map keyed by local time · **`explain[]` absent while the array is empty**, where no map is involved at
    all. **The common form is a surface that cannot carry the statement it is being asked to carry, and every
    one of the three was invisible to a row built on that surface.** So the question is asked of the surface
    rather than of the data structure: **can this surface state this fact at all?**
38. **Fix the loss before asserting over it.** Every assertion added to a lossy structure is a row that
    reports green about a population it never held, **and a green row over a shrunken population is worse
    than no row because it spends the assertion.** So the ordering is not stylistic: **make the collapse
    impossible first**, and only then add the reverse direction and the counts. **Equal-looking counts alone
    cannot distinguish the two cases — the reverse loop is the diagnosis and the count is the label on it.**
    And keying by position rather than by a value the surface happens to carry is what makes the collapse
    impossible; **if two slots ever shared a local time, that is a fact about the product, and the row should
    say so rather than tolerate a collision in its own keying.**
40. **A row that asserts a refusal passes trivially against a surface that says nothing, so whether it says
    anything must itself be asserted.** The Finisher's `ui-booking-terms` work: the row asserts the lookup
    screen **may state the booking's own terms or say nothing, and may never present it as being on the terms
    now in force** — and it is green **because the screen currently says nothing.** So **"does it show terms
    at all" became its own assertion, printed as well as checked: a future screen that starts showing terms
    cannot inherit that green from a version that showed none — it has to satisfy the row about _whose_ terms
    they are.** This is the difference between **a refusal that discharges an obligation and a refusal that
    hides behind one**, and it belongs beside `S4-164`.
37. **A handoff must name the surface a row reads, not only what it asserts.** Both of the Foreman's errors
    this stage, and 3b, would have been prevented by *"read the effective hours from the policies surface"*
    rather than *"assert the day is not shut."* **A row specified by assertion alone invites the implementer
    to choose the surface, and the implementer choosing the surface is how a correctly-shaped row becomes a
    row about the wrong thing.** This is the twin of clause 7: shape before value, and **source before
    assertion.**
34. **A guard in the shared library is five guards** — **the cheapest place for a precondition is the one
    place everything already goes through**, and a precheck a suite can forget to call is not a precheck.
    Measured: with the service stopped, all five screen suites print `FATAL: cannot reach the service` and
    none is ambiguous about whether it ran. **And the count is a measured number, which is why it is written as one: five of six** when the guard landed,
    because `stage3-api.mjs` predates it — **and seven of seven now**, measured by pointing each suite at a
    dead port, after the shared-module refactor moved the guard into the one place every suite imports.
    **"All my suites are guarded" was a claim that was not measured, and the count changed because a refactor
    moved it: which is the whole argument for reporting a count instead of a claim.**
33. **A requirement can be wrong in the direction its author intends to prevent, so a ruling is measured
    against the build's own conventions before it is implemented, not after.** `S4-167`'s precedence was
    ruled twice — once by the Foreman, once by me — and both times from the restaurant's calendar, which
    is not where this product reads hours from. **Implementing it as ruled would have reported `shut` over
    seven bookable times: the row producing the defect it exists to prevent.** A carefully reasoned
    requirement is still a guess until something drives it.
51. **A negative list is not coverage, and a list of reported numbers is not coverage either.** For every
    invariant the rows must name **what moves and what does not**; for every objective they must name **the
    plan that must come out, not the totals that describe it.** **A row that checks a number is small checks a
    report; a row that checks which tables were chosen checks an optimisation** — and one question separates
    them: **would this row fail if the optimiser returned a worse plan with honest numbers?** If not, it is a
    display assertion **and should be labelled as one**, because calling it coverage is what makes the gap
    invisible. **And a negative control's wrong answer must be the wrong answer a stale, pre-fix or
    differently-optimising build actually returns — inventing one tests the author's imagination, not the
    row's sensitivity.**
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

## Three-state classification, and the sweep it is made against

Per the Builder, adopted by the Foreman: **every row is classified on three states, never two.**

- **`VERBATIM`** — a sentence in the specifications says it.
- **`INFERENTIAL`** — the specifications' prose bears on it; no sentence says it outright.
- **`ABSENT`** — no prose in any of the four files bears on it. **Only in this state is a row the room's own invariant.**

**Classified against TEXT, never against a heading.** The specifications do not scope their own sections by
subject: `stage-4.md` has two headings, and the export obligation at `stage-4.md:107` sits inside
*"## Amend recurring reservations"* (`:71`). **So "which heading does this row answer to" is not answerable
from the specification's structure at all — a heading here is a LOCATION, never a scope, and a column that
asks for one invites exactly the misreading that produced this stage's three anchor errors.**

**And the classification is made against a SWEEP of all four files, never one:**

```
S=/home/aryan/band_hack/dark-factory-wearedevs/tablekeeper/spec
grep -nE '^#{2,3} ' $S/stage-*.md ; echo "exit=$?"     # headings, four files, exit kept
grep -rn -i "<row's subject words>" $S/stage-*.md ; echo "exit=$?"   # exit 0 found / 1 absent / 2 never looked
```

**The rows below carry `ABSENT (sweep owed)` where I have not run that sweep against them, and that is the
honest cell: 54 of these rows are classified by nobody.** A column that looks filled and is not is worse than
one that is visibly owed, and **the two-bin rule this replaces was wrong in the direction of false absence —
so the default here is visibly-unclassified, not quietly-ABSENT.**

## A. Arrival paths (highest risk: two paths, one fact, and a 204 that lies)

| Ledger row (room-internal) | Classification (see _Three-state classification_ below) | Specification text it answers to (heading recorded as a LOCATION, never as authority) | What must be asserted | Risk if missed |
|---|---|---|---|---|
| `S4-150` (**both halves true only at `a69e6ba`+**) | ABSENT (sweep owed — no heading-sweep run against this row yet) | Seed and import must not be able to express the same inconsistent booking. Both halves: the import path derives policy-0 terms (true since `387ed26`), **and** the seed path cannot produce `revision: 5` with `accepted_terms: null` (true only at `a69e6ba`; **open at `77c69f8`**). | Fixture-seed that state → **422**; and a differential row: seed a booking, export, import the export, compare the two bookings' `revision`/`accepted_terms`/terms-derived quantities field by field. | The `S3-121` defect returns through the other door. Fixing one arrival path and leaving the other able to express the state is the defect, not the fix. |
| `S4-151` (**re-measured at `549a104` or later**; refusal satisfied there; **capability still missing**) | ABSENT (sweep owed — no heading-sweep run against this row yet) | `/_test/reset` must refuse the four keys it cannot seed, naming the key and the door that works — **and, in stage 4, be able to seed them.** | At `a69e6ba` this is 422 `fixture_unsupported`, key named, import door named, import verified to really seed (`S3-303`/`S3-304`). **The stage-4 half is the positive control:** a fixture that declares a 15-minute policy, one series, one history entry and `batch_counters` must reset **204** and the grid must then read **15-minute slots** — so a row cannot assert policy 0 while believing it asserts a policy. And a store that holds something must appear in the export: **absent while empty cannot be told from silence** (`S3-302a`). | A probe author writing a stage-4 fixture gets 204 and believes it seeded a policy, and every downstream assertion is *about* policy 0 with nothing red. **That is the defect this row's second half exists to make impossible rather than merely unlikely.** |
| `S4-152` (**re-measured at `549a104` or later**; **a probe is owed — see _Probes owed_, and the stage-3 round missed this at `a69e6ba`**) | INFERENTIAL | **ANCHORED -- stage-1 §3.3 *Reset and seed* (`spec/stage-1.md:69`), NOT stage-4. The `c9b9588` cell read NO SPECULATION ANCHOR; that was a **FALSE ABSENCE**, found by the Builder and corrected here.** §3.3:80 *"Replace all service state with the fixture in the request body (§4)"* and :81 *"subsequent requests must see only that fixture"* -- **"all" and "only" are this row's claim in the specification's own words, and a refusal that half-applies contradicts both.** Behind it, stage-1:18-19 §1: *"Retries and rejected requests must not create duplicate or partial bookings"* -- **stated for bookings, so it supports the row rather than carrying it; §3.3 carries it.** *The method is the finding:* the correction searched `grep -i "refus\|seed\|reset"` over **`stage-4.md` alone** -- a lookup, not a sweep -- and read "no hit in stage-4" as "no anchor in the specifications." **The sweep is one command, `grep -nE '^#{2,3} ' spec/*.md`, and I did not run it.** The Foreman's stage-4 mapping (*"Seating changes after a table closure"*, §"Amend recurring reservations"*) covers replans and amendments, not fixtures, and was never checked. **The `S4-` prefix is a ledger sequence number, NOT a stage reference -- see the header clause.** *Invariant, stated as such:* A refused fixture changes nothing at all: **no store may be half-seeded**. | Byte-equal full-state export around a refused reset — for each key alone, for all four together, and for a fixture carrying a refusal alongside legal seeds. Then the split-refusal half: **a build that refuses one key and silently drops another is caught**, which is the mutant this row now has a job for. | A refusal that half-applies is worse than no refusal. **The refusal is now load-bearing behaviour at `a69e6ba`** — it is a new code on a new path — so a mutant returning 422 while writing some declared stores passes every other row in this section. |

## B. Preview and apply: revisions, atomicity, idempotency

| Ledger row (room-internal) | Classification (see _Three-state classification_ below) | Specification text it answers to (heading recorded as a LOCATION, never as authority) | What must be asserted | Risk if missed |
|---|---|---|---|---|
| `S4-101` | ABSENT (sweep owed — no heading-sweep run against this row yet) | `POST /restaurants/{id}/replans` requires a manager **and an idempotency key**. | Non-manager → 403; missing key → the spec's status (**ambiguity A1**); a valid key twice → same `plan_id`, no second plan, no revision change. | A preview that increments anything is a silent state change. |
| `S4-153` | ABSENT (sweep owed — no heading-sweep run against this row yet) | **Preview stores only a plan**: no closure, no occupancy change, no reservation revision, no history entry. | Full-state export before and after a preview: **byte-equal**. `restaurant_revision` unchanged; each considered booking's `revision` unchanged; history unchanged. | **Inertness, not agreement (clause 21).** This row is necessary and not sufficient: it cannot see two derivations of the same plan disagreeing. `S4-153d` is the row for that, and it is why the class in `0.5`(1) is not closed by this one. |
| `S4-153d` | ABSENT (sweep owed — **this row carried no specification-text cell at all before this column existed**, which is how a row loses its authority silently: it still rendered, still read as cited) | OWED — no specification text was ever recorded against this row; a heading sweep has not been run against it. **A row with an empty authority cell is indistinguishable from a row with no authority, and this one was in the table for the whole stage.**  | **The previewed plan and the applied plan are computed independently and must be equal in every element a booking will be written from.** Drive a preview, apply it, and compare **element by element** — reference, `table_ids`, `changed`, and the terms/time/identity fields each booking is written with — against **a second derivation this probe computes itself** from the fixture's own capacities, terms and closures. **Never against the preview's own output, and never against a byte-equal export.** Plus the clause-22 half: the fixture must be one where a naive implementation **would** diverge — a preview that reused apply's partial state, or that re-derived capacity table-driven instead of terms-driven — and the row **fails if the two derivations turn out trivially equal**. | A preview/apply pair that agrees because it is the same code called twice. `S4-153` cannot see it; only a direct comparison against an independent derivation can. |
| `S4-154` | ABSENT (sweep owed — no heading-sweep run against this row yet) | `restaurant_revision` increments **once for the whole plan**, not per moved booking. | A plan moving three bookings increments exactly one. | Per-booking incrementing is the obvious wrong answer and is invisible to any single-move row. |
| `S4-155` | ABSENT (sweep owed — no heading-sweep run against this row yet) | The revision counter increments once for each successful new booking, real amendment, cancellation, policy publication and plan application — **and not** for no-ops, failures, previews or replays. | A single counter walked through all eight transitions, asserting the value at each step. | A counter that is right for plans and wrong for the other five transitions is the common shape. |
| `S4-156` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Apply requires a manager and an idempotency key; returns 201 with `plan_id`, `restaurant_revision`, `reservations` covering every considered booking in reference order. | Body key set exactly as named; `reservations` in ascending reference order; `len(reservations) == considered`. | A response that omits unmoved bookings satisfies a weaker reading and hides data loss. |
| `S4-157` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Unknown plan, or a plan from another restaurant → 404. | Both, plus a plan id that is well-formed but absent. | 404 conflated with refusal. |
| `S4-158` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Any intervening restaurant revision invalidates the plan → 409 `stale_plan`, changing nothing. | Preview, then make any revision-moving write, then apply → 409 and **byte-equal export before/after**. **A closure at another restaurant must NOT invalidate it** — the positive control, same fixture. | One half of this row is the trap: a build that invalidates on any write passes the negative half and fails the control. |
| `S4-159` | ABSENT (sweep owed — no heading-sweep run against this row yet) | A plan already applied under a **different** key → 409 `plan_already_applied`; replay of the **successful** key → the original response with 200, even after later changes and cancellations. | Both keys, then a later write, then replay again → still 200 and the identical body. Assert the body equals the first response field by field, not merely that it is 200. | Replay returning a fresh body is the defect that only appears after a later write. |
| `S4-160a` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Application is atomic: concurrent applications must not leave partially moved bookings. | Two concurrent applies of the same plan → one 201, one 409; and after both, **every** considered booking is wholly moved or wholly unmoved — never a mixture — with matching `revision` and history counts. | Sequential replays test nothing here (clause 14). |

## C. The planner's optimisation order

| Ledger row (room-internal) | Classification (see _Three-state classification_ below) | Specification text it answers to (heading recorded as a LOCATION, never as authority) | What must be asserted | Risk if missed |
|---|---|---|---|---|
| `S4-120` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Among feasible plans, minimise in order: (1) number of bookings whose table set changes, (2) total unused seats, (3) the vector of option ranks in ascending reservation-reference order — singles in fixture order, then pairs in declared order, from 0. | Three fixtures, one per level, each with a build that could plausibly win on a later level. `moved_count`, `unused_seats` and the **rank vector** read off the assignments; the vector is compared per reference in ascending order. | A planner that gets levels 1 and 2 right and the tie-break wrong passes every coarse row. |
| `S4-121` | ABSENT (sweep owed — no heading-sweep run against this row yet) | `moved_count` and `unused_seats` in the response agree with the `assignments` they summarise. | Recomputed from the assignments and compared. | A response that reports the optimum and the plan it returns are different plans. |
| `S4-122` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Planning supports up to 6 tables, 4 declared pairs and 6 considered bookings; larger inputs may return 422 `planning_limit`. | Each limit at its boundary and one past it, separately — 7 tables, 5 pairs, 7 bookings. **Record whether the boundary is inclusive** (**ambiguity A2**). | A limit that triggers early refuses legal input; one that never triggers is untested. |
| `S4-123` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Each considered booking keeps reference, owner, party size, start, end and accepted terms — and is assigned a single or declared pair with enough capacity **under its own accepted terms**. | A booking whose party size is legal under one booking's terms and illegal under another's; assert the plan respects the per-booking terms, and that `accepted_terms`, start and end are **identical** before and after. | Stage-2 occupancy is table-driven; stage 4 makes it **terms-driven**. This is the row that catches the substitution. |

## D. The closure, once applied

| Ledger row (room-internal) | Classification (see _Three-state classification_ below) | Specification text it answers to (heading recorded as a LOCATION, never as authority) | What must be asserted | Risk if missed |
|---|---|---|---|---|
| `S4-130` | ABSENT (sweep owed — no heading-sweep run against this row yet) | The proposed closure is half-open `[from,to)`: a booking ending exactly at `from` is unaffected; one starting exactly at `to` is unaffected; one overlapping either endpoint is considered. | Four bookings on the boundary, all four asserted individually. | `[from,to]` and `[from,to)` differ on exactly the bookings a fixture is most likely to place at an endpoint. |
| `S4-131` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Invalid interval → 422 `validation_failed`; unknown table → 404; `from < to` and explicit offsets required. | Naive timestamps (no offset) → 422; equal instants → 422; reversed → 422; unknown table → 404. | A build that accepts a naive timestamp and reads it as local will be correct in one timezone and wrong in two — and the fixture can express two timezones (`0.3`). |
| `S4-132` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Considered bookings are the **confirmed** bookings at this restaurant overlapping the interval. Other bookings retain their assignments; bookings at other restaurants are untouched; **no booking may disappear or be cancelled**. | Count before and after **by reference** across the whole restaurant set, not a sample (clause 13); assert zero cancellations recorded. | A planner that "helpfully" drops an unplaceable booking satisfies every spot-check and loses data. |
| `S4-133` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Assignments respect fixed bookings, other assignments, **previously applied closures** and the proposed closure. | Two plans applied in sequence; the second must not move a booking into the first plan's closure. | The second closure is the only place previously-applied closures are exercised. |
| `S4-134` | ABSENT (sweep owed — no heading-sweep run against this row yet) | A closure excludes its singles **and its declared pairs** from availability, and rejects creates/amendments with 409 `table_unavailable`. | Both singles and every declared pair containing the closed table; one create and one series amendment; the 409 body names `table_unavailable`. | Pairs are the half that is easy to leave out and is invisible to single-table rows. |
| `S4-135` | ABSENT (sweep owed — no heading-sweep run against this row yet) | In explanations, `no_overlap` is **false for a closure** exactly as for a conflicting booking. | `explain` for a slot inside an applied closure → the same `no_overlap: false` shape as a booking conflict, asserted by **shape**, not by value. | A closure reported as a distinct reason is a new reason code invented by the implementation — clause 7. |
| `S4-136` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Each moved booking gains **one** `reassigned` history entry carrying the `table_ids` change and the `plan_id`; times and accepted terms identical; unmoved bookings gain **nothing**. | Per-booking history diff by reference: moved → exactly one entry with both fields; unmoved → zero entries and identical history array. | "One entry" is the assertion; "an entry exists" is the shortcut. |
| `S4-137` | ABSENT (sweep owed — no heading-sweep run against this row yet) | **Seating repairs may move series occurrences**, preserving exception flags, scheduled dates, identities and accepted terms; each affected series revision increases **once per plan application** if at least one member moved. | A series with three occurrences, two moved: exception flags identical, scheduled local dates identical, references identical, terms identical; series revision **+1**, not +2; a plan moving no occurrence of that series leaves it alone. | Per-occurrence revision increment is the obvious wrong answer, and the "+0 when nothing moved" half is invisible unless the second plan is a no-op for that series. |

## E. Amend: validation order, then semantics

| Ledger row (room-internal) | Classification (see _Three-state classification_ below) | Specification text it answers to (heading recorded as a LOCATION, never as authority) | What must be asserted | Risk if missed |
|---|---|---|---|---|
| `S4-140` | ABSENT (sweep owed — no heading-sweep run against this row yet) | `POST /series/{id}/amend` is owner-only and idempotent: unknown or another owner's series → 404; **no token → 401**. | Both, in that order of distinctness — 401 is not 404 and the row asserts which. | The classic conflation; clause 9. |
| `S4-141` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Input validation → 422 `validation_failed`: `expected_revision` a positive integer; `from_index` an integer in 0..count-1; `local_time` exactly `HH:MM` in 00:00..23:59; **booleans are invalid integers**; unknown fields ignored. | Each boundary, plus `true`/`false` for both integers, plus `"9:00"` and `"09:00 "` and `9.5`, plus an unknown field that must change nothing. | `Number("9")`-style coercion and truthiness-as-integer are the two defects this row exists for. |
| `S4-142` | ABSENT (sweep owed — no heading-sweep run against this row yet) | A mismatched series revision gives 409 `stale_revision` **before any occurrence's cutoff or booking validation**. | A fixture where an eligible occurrence is *also* past its cutoff: stale revision → **409 `stale_revision`**, fresh revision → the cutoff error. Ordering is the whole row. | Either error alone is correct behaviour; only the ordering is the requirement. |
| `S4-143` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Eligible set: indices **at or after** `from_index`, **excluding** cancelled occurrences and those marked exception. | A series containing one of each, with `from_index` set so the boundary index is eligible and the one before is not; assert exactly which references changed. | Off-by-one and "excluded" implemented as "cancelled only" both survive a coarse row. |
| `S4-144` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Each real change moves the clock time on the occurrence's **original scheduled local date**, retaining reference, owner, party size and current table selection. | Assert the scheduled **local date is unchanged** while the local time changed, and that `starts_at`'s UTC instant moved by the expected offset difference — a cross-midnight or cross-date result is the failure. | With two timezones expressible (`0.3`), recomputing the date from the new time is the trap. |
| `S4-145` | ABSENT (sweep owed — no heading-sweep run against this row yet) | A change with identical resulting fields is a **no-op and retains its terms**; all-no-op or empty eligible sets succeed without changing any revision. | Same local time for every eligible occurrence → 201, series revision unchanged, restaurant revision unchanged, no history entries, idempotency record still written. | A no-op that clears terms is the defect `S3-070a` taught us to look for. |
| `S4-146` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Each real change checks its **old** accepted cutoff, then adopts the policy for its **resulting start date**, exactly like an individual PATCH. | A booking whose new time is legal under yesterday's policy and illegal under today's → the failure; and the reverse. The old-cutoff check uses the old terms, not the new ones. | "Adopts the policy for the resulting date" is stage-3 `S3-118`-shaped and easy to satisfy with the pre-change date. |
| `S4-147` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Resulting occurrences must not conflict with unchanged occurrences, other bookings or applied closures; on failure **histories, idempotency records and all revisions remain unchanged**. | Each conflict source in turn → the appropriate error, then a byte-equal export. **The idempotency-record half is the one a build gets wrong by recording the key before validating.** | A burned key after a failed amend breaks every later retry. |
| `S4-148` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Non-occupancy errors take precedence **in occurrence-index order**; otherwise an occupancy conflict returns `table_unavailable`. | Two eligible occurrences, the later one with the cutoff failure and the earlier one with the occupancy conflict → the **earlier index wins** whatever its kind. Then the case where only the later fails → `table_unavailable`. | Both halves are needed: precedence and ordering are separate requirements. |
| `S4-149` | ABSENT (sweep owed — no heading-sweep run against this row yet) | On success 201 with the current series response; each changed occurrence gains one ordinary changed history entry and one reservation revision; series and restaurant revisions each increase **once for the entire operation** if anything changed; amendments do not mark exceptions. | Series response body shape; per-occurrence history diff and revision delta; **both** counters +1 and not +n; exception flags unchanged. | Per-occurrence counter increments again, and "did not mark exceptions" needs its own assertion because nothing else would catch it. |
| `S4-151b` | ABSENT (sweep owed — no heading-sweep run against this row yet) | Replay returns the original response with 200 **even after further edits or cancellations**; concurrent amendments from the same `expected_revision` may not both make a real change. | Amend, then amend a given occurrence differently, then cancel one, then replay → 200 and the **identical original body**. Concurrency: two simultaneous amends from the same expected revision → at most one real change; the other 409 `stale_revision`, and the series is not left half-amended. | Replay-after-change is the only place the idempotency record's contents matter. |

## F. The seam, and the cross-stage floor

| Ledger row (room-internal) | Classification (see _Three-state classification_ below) | Specification text it answers to (heading recorded as a LOCATION, never as authority) | What must be asserted | Risk if missed |
|---|---|---|---|---|
| `S4-160` | ABSENT (sweep owed — no heading-sweep run against this row yet) | **After** a plan is applied, the grid and `explain` still agree — the seam of `0.4`, re-driven in the state where availability has actually changed. | Real browser, **every** rendered cell against the `explain` entry for that table and slot — and the population is asserted, not sampled (clauses 18, 23): the row counts the cells it rendered, counts the `explain` entries it compared against, and **fails unless the two populations are equal and every pair cell is among them**, since a map indexed on singles alone once reported agreement while skipping every pair. Under a closure that removes capacity, and under a policy that flips the answer; unavailable cells `disabled`; no page errors. | Stage 4 changes availability underneath a screen that no stage-4 requirement mentions. This is the row that catches it. |
| `S4-161` | **VERBATIM at `stage-4.md:107`** -- *and my `INFERENTIAL` here was my error, corrected on the Foreman's ruling.* **`:107`, verbatim: "A stage-4 service must accept exports produced by the same team's stages 1-3. These operations must support imported series, including moved and cancelled occurrences."** **This row is `/_test/import` ONLY and is NOT the round-trip row, and the two must never be merged: the ledger already recorded why it is its own row -- "no reset can express it, because the document IS the subject."** VERBATIM because the sentence imposes the obligation directly, with no composition and no inference. **Sweep discharged and WRITTEN DOWN per the Builder's remedy: 58 headings across four files, 2 bearing** -- `stage-4.md:71` (heading containing `:107`, the obligation) and `stage-1.md:418` (behind it: opaque format, existing tokens stay valid); **6 rejected with reasons** -- `stage-1.md:187` Auth (the only tokens are exported), `stage-1.md:227` Idempotency (replay survives), `stage-3.md:53` History and `stage-3.md:168` Recurring reservations (history and series survive), `stage-2.md:129` Existing clients (screen continuity, not import), `stage-4.md:6` Seating changes (supplies the move, not the import). **`:105` bears on nothing here.** *Per the Builder, who wrote the sweep down rather than asserting it -- the first time this room's remedy was applied before the claim.* |, per the Builder's remedy that the headings considered must be recorded.** All 58 headings across the four files considered; **2 bear**: `stage-4.md:71` (contains `:107`, the obligation) and `stage-1.md:418` (behind it: opaque format, existing tokens stay valid). **6 considered and rejected, each with the reason it fails to bear:** `stage-1.md:187` Authentication -- the only tokens are these and they are exported; `stage-1.md:227` Idempotency -- replay survives, `idempotency` is exported; `stage-3.md:53` Reservation history and `stage-3.md:168` Recurring reservations -- history and series survive; `stage-2.md:129` Existing clients after an upgrade -- screen continuity, not state import; `stage-4.md:6` Seating changes -- supplies the move, not the import. **`:105` bears on nothing here.** *Per the Builder, who wrote the sweep down rather than asserting it was run -- the first time this room's remedy was applied before the claim, and it is why the answer survived my own review.* | A stage-4 service must accept exports produced by the same team's stages 1–3, including **imported series with moved and cancelled occurrences**; earlier receipts, histories and retries remain valid. | A stage-2 export and a stage-3 export, each imported 204; a series with a moved and a cancelled occurrence amended and replanned; an old idempotency key replayed → 200 with the original body. | Stage 4 is where the accumulated surface is largest; the import path is the one arrival path nobody re-tests after a new stage. |
| `S4-163` | ABSENT (sweep owed — no heading-sweep run against this row yet) | **The service answers, at the day level and under the terms in force, which of three states the date is in: _shut_ — no opening hours for this weekday; _terms exclude every slot_; or _nothing free_. `explain=true` must state it on a day with no slots, and the three must be distinguishable without the screen inferring any of them from `slots.length`.** | Three fixtures, one per state, same day shape: (a) a day with no `opening_hours` entry; (b) a day whose slots are all booked; (c) a day on which the terms in force exclude every slot. **Each asserted by the day-level field, not by the sentence a screen would print**; and `S4-164` asserts the absence of a closed-day claim whenever the day-state is not _shut_. | **Measured at `1e56016`, and this is why the answer cannot live on `explain[]`:** shut → 200 with `slots: []`; fully booked → 200 with 7 slots and every `available_table_ids` empty; **identical top-level keys**; and **`explain=true` on the shut day returns no `explain` key at all**, because `explain` is per slot and there are no slots to explain. **The service is silent by construction on the one day a screen most needs to know why.** Any discriminator bolted onto `explain[]` inherits the defect, because **the day it must speak about is the day the array is empty — a per-slot surface cannot carry a statement about the absence of slots.** Three constraints keep the shape from drifting back: **(1) it is day-level and present when `slots` is empty; (2) it is derived from the terms in force, not from the fixture and not from text; (3) the screen's `say less, not more` obligation only discharges if the three are distinguishable to the screen** — a day-state a screen cannot read is not a discriminator. |
| `S4-164` | ABSENT (sweep owed — no heading-sweep run against this row yet) | A screen's obligation is to **say less, not more**: where the service has not said a day is shut, no screen may state it. | The grid and the lookup screen for state (c) from `S4-163`: assert the **absence** of any closed/shut claim, and assert the slot list is what the service returned rather than a filtered version of it. | A screen that infers closure from `slots.length === 0` is making the service's silence its own statement. **The Finisher has refused to make the screen smarter to cover this, and that refusal is the requirement, not a limitation** — it is `S3-A3`'s second half. |
| `S4-165` | ABSENT (sweep owed — no heading-sweep run against this row yet) | **Terms validity is _derived_, not published — and the derivation is named, because "derive it" without naming the inputs is the shape this stage has refused twice.** **Ruled: no boolean, no second claim.** | **From exactly two things a client can already read:** (i) the booking's own `accepted_terms`, carried by `GET /reservations/{ref}`, and (ii) **the policy in force for the booking's `starts_at_local`**. Assert: (a) publishing a policy that changes terms **leaves an existing booking's `accepted_terms` byte-identical** — validity is not drift; (b) both sides are reachable, so the comparison is possible — **which makes `explain` on the booking's slot load-bearing: it must name the policy in force for that start**, otherwise the client holds one side of a comparison it cannot complete; (c) where they differ, **nothing in any response claims validity** — asserted as the *absence* of such a claim. | A published boolean **buys a row rather than a property**: it is a second claim about a fact that is already derivable, and it needs its own row to police it, which is the equality-comparison mistake the Builder deleted at `549a104` rather than hardened. **A field that exists is not a field whose meaning a client can check** — `explain` before stage 3 — and the fix for that is not another field. **The real gap is not "no field" but "no single place both sides are visible",** and (b) is the requirement that closes it: **the service must make the derivation's inputs reachable together.** |
| `S4-167` | ABSENT (sweep owed — no heading-sweep run against this row yet) | **`GET /availability` with `explain=true` returns a top-level `day_state` naming which of four states the requested date is in, for that restaurant, under the policy in force for that date: `shut` (no `opening_hours` entry for that weekday) · `terms_exclude_all` (hours exist and the terms yield no slots at all) · `nothing_free` (at least one slot, none with a free table) · `open` (at least one slot with a free table).** A screen may state a day as closed **only** on `shut`. | Four assertions, and **no assertion about any sentence, heading or rendered output**: **(1) `day_state` is present at the top level whenever `explain=true`, including on a date with no slots — presence on an empty day is the row; (2) the states are pairwise distinguishable without reference to `slots.length`, each asserted twice, once on a day built to produce it and once on a day where `slots.length` would give the wrong answer (`shut` and `terms_exclude_all` both have `slots: []`, and the row asserts they differ); (3) `day_state` is terms-derived, not fixture-derived and not text-derived — proved by driving a policy change that moves a date from one state to another with **no change to `opening_hours`**; (4) the plain response's key set is unchanged.** | **A discriminator bolted onto `explain[]` inherits the defect, because the day it must speak about is the day the array is empty** — a per-slot surface cannot carry a statement about the absence of slots. And **if a client can recover the state by counting slots, the field is decoration**: assertion 2 exists to make that red rather than merely unlikely. **Assertion 3 is load-bearing and the row says so (clause 30)** — `terms_exclude_all` has one producing configuration, so an implementation answering `shut` whenever `slots` is empty passes 1 and 2 and only 3 catches it. |
| `S4-168` (**satisfied by existing behaviour, measured over a 28-date sweep including a tie on `effective_from` — zero mismatches**) | ABSENT (sweep owed — no heading-sweep run against this row yet) | **Which policy governs a date must be readable, not re-derivable by guesswork.** `day_state` is decided from the policy in force for that date, and the policies surface carries each policy's `opening_hours` and `effective_from` — **but nothing states which one governs a given date.** | Assert (a) the policies surface exposes everything the derivation needs — `effective_from`, `opening_hours`, `policy_version` — per policy, in publication order; (b) **a client can select the governing policy for a date from those fields alone** (greatest `effective_from` at or before the date), and where **two policies share an `effective_from`**, the greater `policy_version` wins; (c) **the selection is asserted against the service's own `day_state`** for at least one date on each side of a policy boundary. | The shut-day silence, one level in and a different shape: **the hours are readable but the choice among them is not stated**, so a client must re-implement the selection to check the discriminator — and a client that guesses wrong concludes the screen is wrong when the service is right. **A value a client cannot reach is not a value; a value it cannot locate is the same defect with more steps.** |
| `S4-166` | ABSENT (sweep owed — no heading-sweep run against this row yet) | **The stage-4 baseline is attributed, not assumed**: at a folder-only build the two failing supplied checks are the two **write** families (planning and amendment), and the **read** surface is intact. | Drive all three write entry points (404/405), then the read surface — policies, availability with `slots[]`, and the absent-series 404 — and **assert the read surface is alive before attributing the failures to the writes**. `absent_at_e9b9f4d.py`, 8/8 at `e9b9f4d`. | Attributing two failures to "stage 4 is not built yet" without showing the rest of the folder works is a guess with a measurement attached. **A folder that carries stage 3 forward broken would produce the same two red checks.** |

| `S4-162` | ABSENT (sweep owed — no heading-sweep run against this row yet) | The full stage-1/2/3 regression surface at the stage-4 hash. | 120/0, 25/25, 7/7, `api_core` 48/48, `terms_history_series` 34/34, and the stage-2 screen suites at both widths with 0 residual. **Any failure goes to the Foreman before it is characterised.** | A stage that satisfies its own rows and breaks an accepted one. |

---


## G. The round-trip row — MEASURED, and the Builder's own consequence corrected

The Builder read this defect out of the source, filed it against itself rather than as a finding, and named the
measurement without running it. **The source reading was correct in every particular; this section is the run.**

**Tree measured:** `stage-4/` at `334f8c2` (comments-only over accepted behaviour `56e278a`), `git status
--porcelain stage-4/` empty. Service started by me for this measurement and stopped after it.
**Probe:** `verification/probes/s4/roundtrip_revision.py`. 11 rows, 0 failed.

| | Observation | Value |
|---|---|---|
| control | two previews from the same expected revision, second apply | **409 `stale_plan`** — the gate is armed |
| token | `restaurant_revision` after apply, before round-trip | **2** |
| token | `restaurant_revision` from a fresh preview after round-trip | **0** |
| plan | apply a pre-round-trip plan after import | **404 `not_found`** |
| stores absent from the export | `replans`, `closures`, `restaurant_revisions` | all three |
| stores present | `history`, `series`, `idempotency`, `tokens` | all four |
| history | reassignment entries surviving the round-trip | **1**, with `closures` not exported |

**Classification: `INFERENTIAL`, anchored at stage-1 §10's SNAPSHOT-AND-REPLACEMENT language — and this anchor
has moved TWICE, both times because a word was read in the sense the discussion was using rather than the sense
the file gives it.**

**ANCHOR HISTORY, because the corrections are the evidence and the history is why the row can now be trusted:**

1. **stage-1 §10 "existing tokens must remain valid after import" — VOID, and it was a booby trap in this
   ledger.** Every one of the 12 occurrences of *token* in `stage-1.md` is authentication (`:162` unknown bearer
   token, `:197`/`:204` signup and login bodies, `:214`, `:219`/`:318` `Authorization: Bearer <token>`, `:222`
   tokens do not expire, `:267`, `:422` credentials and session tokens, `:435` **"existing bearer tokens"**,
   `:438`, `:457` no token gives 401) — **one sense in the file, and `:435` says *bearer* in the very preserve-list
   `:438` belongs to.** And the mechanism it names works: `snapshot.js:43` exports `state.tokens` and `:166`
   restores it. **So a seat following this anchor checks bearer tokens across a round-trip, finds them intact,
   and files the row SATISFIED — while the three stores that are actually dropped go unexamined.** Not a naming
   preference: an anchor that points at the one mechanism in this codebase that provably works.
2. **`stage-4.md:105` `VERBATIM` — REFUTED BY MEASUREMENT, not by opinion.** `:105` forbids two amendments from
   the same expected revision both making a real change, and producing that needs a stale plan to apply.
   `state.replans` is not exported, so every pre-import plan returns `404 not_found` at `replans.js:379` **before**
   the revision check at `:389` is reached. Both amendments must be previewed after the import, both record 0, the
   first applies, the second reads 1 and gets `stale_plan`. **`:105` holds. The token resets; the prohibition is
   unbroken.** Measured: RT-C.
3. **`stage-4.md:105` — WRONG MECHANISM, and this is what made the predicted inversion unreachable.** `:105` sits
   in the **series-amendment** section: the body at `:77` is `{"expected_revision": 3, "from_index": 2, ...}`, the
   error at `:82` is `stale_revision`, and `:105` is preceded by *"Each affected series revision increases once per
   plan application"*. **The replan gate is `:56` and its code is `stale_plan`.** Two mechanisms, two vocabularies,
   two codes -- **and `:105` still holds precisely because it was never exposed to the thing that breaks.** Verified
   by reading `:47`, `:56`, `:77`, `:82` and `:105` directly rather than accepting the distinction from the thread.
4. **`stage-4.md:107` — about BACKWARD COMPATIBILITY, not stage 4's own survival.** *"A stage-4 service must accept
   exports produced by the same team's stages 1–3"* governs accepting an **earlier stage's** document, which is
   what `snapshot.js:171-174` implements in its own comment. **Read as "stage 4 must survive its own round trip" it
   says something else, and that is how I first read it.**

**THE ANCHOR, quoted rather than paraphrased -- `stage-4.md:47` with `:56`, and NOT `:105`:**

> **`:47`** -- *"A restaurant revision starts at 0 after reset and increments once for each successful new booking, real amendment, cancellation, policy publication or plan application."*
> **`:56`** -- *"Any intervening restaurant revision invalidates the plan: 409 `stale_plan`, changing nothing."*

**`:47` is a DEFINITION, not an expectation, and that is why it beats every anchor this room filed: it does not
mention export or import at all.** Read it against what the round trip produces and the contradiction needs no
inference about import semantics whatsoever -- **the imported state contains the events `:47` says increment the
quantity, and reports the quantity as 0.**

**THE ANSWER TO THE FOREMAN'S OPEN QUESTION -- "is `POST /_test/import` *after reset*?" -- IS NO, AND IT IS
MEASURED, not argued. `verification/probes/s4/reset_vs_import.py`, 5 rows, 0 failed, `stage-4/` at `334f8c2`,
clean, service started and stopped by me:**

```
:47 baseline       one successful new booking                        -> revision 1
after import       restaurant_revision = 0 ; reservations carried = 1
a REAL reset       reservations = 0, revision = 0                    <- what "after reset" looks like
```

**So the imported state is `(reservations=1, revision=0)`.** A real reset produces `(0, 0)`.

**BUT THE STRONG CLAIM I FILED WITH THAT MEASUREMENT IS TOO STRONG, AND @Builder's correction is the reason, and
it is verified in source rather than argued: `snapshotState` NEVER WRITES `restaurant_revision` AT ALL.** `sed` on
`stage-4/src/snapshot.js` shows nine keys -- `users tokens restaurants reservations idempotency policies history
series batch_counters` -- and `restaurant_revisions` is not among them. **So `importState` is not discarding the
counter. It is faithfully restoring a document that never carried it, and the loss is UPSTREAM, in the export.**

**Which retires the sentence I wrote here an hour ago -- "unreachable by any legal sequence of the operations `:47`
names" -- and it retires it for the reason this stage keeps finding: it was a stronger claim than my measurement
supported.** My probe observed the *symptom* (0 after a round trip) and I inferred a *mechanism* (import is not a
faithful replacement) from it. **The correct mechanism is one line of source away and I did not read it, having
spent the hour on `:47` instead.** And the Builder's unavailable argument is the honest core of it: *"the document
carries the quantity, so import discards it"* cannot be made, because the document does not carry it -- **and that
absence is precisely why nothing here is `VERBATIM`.**

**RELOCATED CONSEQUENCE, and it is the part that changes the fix: the row is `owed`, and the fix is in
`snapshotState`, NOT in `importState`.** No semantics of import -- reset-like or not -- can restore a value that was
never serialised. **A promise made in every preview and apply response (`:41`, `:54`) and kept in no store is not a
contradiction; it is an omission the specification never addressed, and calling it a defect would put a word in the
record that no sentence supports.**

**CLASSIFICATION: the `INFERENTIAL` -> `VERBATIM` step this row's question was supposed to decide DISAPPEARS,
because the step was "does `:47` license 0 here", and `:47` does not -- while the sentence that would license it
names a different operation.** **So the contradiction is internal to a VERBATIM definition plus a measured state,
and needs no sentence about export to state it. Recorded as `VERBATIM`-eligible and NOT ruled here: the class is
the Foreman's call, and this stage has produced five anchors from five seats each confident they had the last
word. The measurement is not in dispute and it is committed.**

**And the distinction that survives, because it is about two different properties rather than about this defect:
§10's "the state format is opaque to the caller" governs the SHAPE and closes the field-list question permanently
-- the implementer chooses. §10's "export is an atomic, read-only snapshot" governs the CONTENT. Opaque and
complete are different properties, and the specification constrained only the first.**

**AND A NOTE ON A COMMIT SUBJECT, because it is the most durable sentence in this repository and it is wrong:
`3a18a87`'s subject reads "classified INFERENTIAL at stage-4.md:105 with :107".** It names the anchor the
measurement refuted, in the past tense, as a fact. **A subject cannot be corrected without rewriting history, which
this stage has ruled out, so the correction lives here instead -- and the Builder's reading of why is the sharpest
thing in this section: the text that gets cited is the text the conversation has already said out loud. `:105` was
the Builder's proposal and the most recently mentioned text in the room; `:47` was the subject and got dropped.
An anchor chosen from memory is the last thing someone mentioned; an anchor chosen from a sweep is only ever the
thing that is actually there.**

**And the correction, which is the reason this is a measurement and not a reading — the specific consequence
described does NOT hold, because it is unreachable:**

> The Builder wrote that after a round-trip *"a plan previewed against revision 0 is accepted against a state
> that has in fact been revised three times, while the fresh plan held by the client at revision 3 is now the one
> refused."* **Measured: the fresh plan is not refused at the gate — it is `404 not_found`, because `replans` is
> not exported either.** Plan loss 404s *before* the revision comparison is ever consulted, so the token
> inversion cannot be reached through this API. **Within any epoch the gate still arms: two fresh previews read
> the same reset value, the first apply moves it, and the second is refused `stale_plan` (measured as RT-A).**

**So the defect is real and the described exploitation is not. What is actually reachable, and measured:**

1. **The token is non-monotonic across a round-trip: 2 → 0.** Any client that persisted `restaurant_revision`
   observes it move backwards, which is the inversion — in the *reported* value, not in the gate.
2. **`replans` and `closures` are destroyed** while `history` survives, so **the imported state asserts a
   reassignment that its own closure record no longer explains** (1 surviving history entry, 0 exported closures).
3. **The loss is specific.** `series`, `idempotency`, `history` and `tokens` all survive, so stage-3's
   `stale_revision` check and `stage-4.md:60`'s key-replay guarantee are untouched. **The Builder's scoping is
   correct as written and I verified every clause of it.**

**Not yet owed, and named so it is not assumed: no probe drives the non-monotonic token forward.** The row's
`saw` is this measurement. Whether the room treats a backwards `restaurant_revision` as a reportable defect is
the Foreman's call and **is not mine to file as a finding against a closed stage** — so this is an owed row with
a measurement, not a verdict.

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
- **A7 — VOIDED, and kept as a record because the correction is the finding.** The write family's request
  shape looked like two room-held sources disagreeing — the specification printing `{table_id, from, to}` and
  `local_time`, a ruling from a check's *name* saying `{closure: {date, table_ids[]}}` and `clock_time`. **A
  check's identity is evidence about intent; it is not a specification.** So there was never a conflict of
  sources, only a ruling from the wrong one. **The requirement wins, and the shape is the specification table
  above, single-spelled.** My alias ruling is recorded here as the thing it was: **an alias resolves two
  specifications, and cannot resolve a specification and a filename.**
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

### Assertion 3b asked the wrong calendar: measured, re-pointed, and the finding recorded

**The Builder's reservation was right and my 3b was wrong, and it was wrong in the direction it was written
to prevent.** Measured at `8cbc1cf` (`S4-167-cal`), the two calendars disagree **in both directions**:

```
restaurant detail says Sunday present, policy omits Sunday  ->  detail: sun present   day_state: shut,0 slots
restaurant detail lacks Sunday,     policy covers Sunday    ->  detail: sun ABSENT    day_state: open,45 slots
```

**So `GET /restaurants/{id}` reports the BASE restaurant's hours, and the day state follows the POLICY's.**
My 3b would have passed because **the restaurant had hours for that weekday while the policy excluded every
slot** — which is exactly the shortcut 3b exists to make falsifiable. **A row that passes for the wrong
reason is worse than no row, because it spends the assertion.**

**Ruling: 3b reads the effective hours — the policy in force for the date, from the policies surface.**
**And the third option is NOT the answer, which matters:** the effective hours *are* client-readable, from
`GET /restaurants/{id}/policies`, which carries each policy's `opening_hours` with its `effective_from`.
**So this is not the shut-day silence a second time — it is a derivation the client must perform**, because
nothing states which policy governs a given date; the client selects it. `S4-168` carries that.

> **A precondition row must read the same source the implementation reads.** A row asserting a condition
> from a different surface than the code uses **does not narrow the implementation's freedom — it only
> appears to.** This is the second time this stage a row has been wrong in the direction it was written to
> prevent, and both times it was written by someone who had just been right about something else.

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

### The same audit applied to `ui-grid.mjs` — read, not run, and two thinnesses found

The Builder flagged that he had not audited the Finisher's per-cell population, and left it rather than
assume. **I cannot run a browser from this seat either, so I read it — and reading is enough for a population
question. Two findings, both specified rather than edited, because the file is the Finisher's:**

1. **No reverse direction and no count equality.** `ui-grid.mjs` iterates the **painted** cells and looks each
   one up in the service's answer, flagging a cell with no slot as a disagreement — **one direction only.** A
   slot the service offers at a time the grid painted nothing for is never checked, and **the row compares no
   counts.** The vacuity guards are good (`the service answered with a slot list`, `some cells are free`), but
   **a guard against comparing nothing is not the same as a guard against comparing half of it** — which is
   precisely the pair-indexing bug's shape, one level along. `S4-160` requires both directions and equal
   populations; **the instrument meets the first half of the row and not the second.**
2. **The answer map is keyed by local time** (`out[slot.starts_at_local.slice(11, 16)] = …`), so **two slots
   sharing a local time silently collapse into one** and the population shrinks before any comparison. This is
   the original defect's exact shape — **a map that silently drops a class of thing** — reappearing in the
   comparison that was written to catch it. **Keying by (time, table set) or by index would make the collapse
   impossible**, and the row cannot detect it because the population it compares has already been reduced.

**Neither is a hole: both are thinnesses, and both look like coverage.** The first is closed by asserting the
reverse direction and the counts; the second by keying the map so the loss cannot happen.

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

### Practice, not observation: who is required to catch what

**The asymmetry that costs, stated so a rule does not depend on goodwill:**

> **Re-derivation is cheap and a verifier does it to their own rows, so it catches shape faults. A _source_
> fault needs someone to build or measure the thing, and the seat who catches it is the one being asked to
> make it green.** So: **the seat implementing a row is required to report a mismatch rather than choose a
> fixture**, exactly as the verifier is required to run the walk before their own verdict. **A rule that only
> works when a seat volunteers resistance is not a rule; it is a hope.**

**It has evidence behind it before it had a clause:** the Builder declined to build 3b against a source it
believed was wrong, and declined to call a measurement it had not made — in a stage where it had already
reported one number wrong twice. **The mechanism is a seat saying "I will report what I find rather than make
it pass", and it cannot be required into existence by a clause; it can only be required by a rule that names
it, which is all this section does.**

**And the verifier's half is equally binding:** the walk is run before the verdict, on my own rows, **and its
result goes in the report whether or not it is convenient** — which is how six of my own rows were found to
have outlived their subject.

### Before any round: walk each row its probes will defend against the probes themselves

> **Confirm the probe drives every element the row names** — every key, every branch, every population.
> **A probe narrower than its row is not a partial check; it is a check of a smaller requirement, and it
> reports green about it.**

**This is a pre-round check, not a discovery made during a round.** It costs nothing: it is reading my own
row text against my own probe list. **It would have caught `S3-340` before the round rather than after it**
— that row says "for each key alone" and the probe drove two of the four — **and it is the same walk that
catches a row whose population was sampled rather than asserted.** **If the walk finds a gap, that finding
is worth more than a catch**, and it goes in the report whether or not it is convenient.

**The walk's four questions, in the order they are asked:**

1. **Coverage** — does the probe drive every element the row names: every key, branch and population?
2. **Direction and counts** — for any comparison, is the reverse direction asserted and are the counts checked?
3. **Precondition** — for any row asserting wording or state, what would have to be true for it to be right,
   is that asserted, and is it read from the surface the implementation reads?
4. **Lossiness** — for any comparison, **is either side lossy?** A count over a map that dropped a class of
   thing is a count of the wrong population, **and no assertion added afterwards can recover it** (clause 38).

**And a standing warning from the same turn, for the rows I own:** a build that adds a field to a shared
**response view** breaks every deep-equality row that compares a whole object, in the same way a scratch key
written onto stored records does. `terms_history_series.py` has one such assertion — the occurrence object's
key set — and it is there on purpose; **the general form is that an exact-key-set assertion is a row about a
shape, and a shape grows when a neighbouring feature needs a field.** So the rows to re-read after any shared
view change are the exact-shape ones, not the value ones.

**Question 4 is the newest and it is the one that found a defect no row could have found:** the audit of
`ui-grid.mjs` was done **by reading, by a seat that cannot execute the file**, and found a map that silently
collapses two slots sharing a local time. **Three thinnesses in this stage were found by reading rather than
running, in three different files, none of them reachable by questions 1 to 3** — which is the first evidence
of how often clause 30's "a thinness looks like coverage" actually bites.

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
