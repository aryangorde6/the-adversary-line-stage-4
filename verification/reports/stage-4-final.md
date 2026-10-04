# Stage 4 — sabotage report, filed by the Adversary

Accepted hash graded: `56e278a` (stage-4 PASS at `827005e`; `56e278a` adds no product change).
Every number below carries its hash and, where the measurement required one, its state.
Claims that are not measurements are labelled **judgement**.

## 1. The graph, first, because two accounts of it were wrong

```
170c99d  seed 1 attempt 1 — allocateReference before the refusal   INERT
4b4bc5c  the enumeration reversal        TOUCHED, NEVER AMENDED, REACHABLE — the genuine precondition
644ee7c  seed 4 — the door accepts and drops                      UNREACHABLE FROM HEAD (amended away)
1780d45  "precondition: enumeration divergence"                   a MESSAGE-ONLY amend of 644ee7c; MISLABELLED
fadad4d  M2' — precondition plus the rank vector deleted          inherits both
fc8c76b  seed 1 replanted — batch_counters on the live state      LIVE, a THREE-MUTANT STACK on 1780d45
seed 2   unplanted by agreement
```

**The amend recorded as amending `644ee7c` and not `4b4bc5c`, on the reflog rather than on either seat's
account of it:**

```
1780d45 HEAD@{2026-10-04 05:33:53}: commit (amend): precondition: enumeration order diverges...
644ee7c HEAD@{2026-10-04 05:33:06}: commit: sabotage: seed 4 of 4 -- the pre-registered seed
```

**An amend occurred and it did not touch `4b4bc5c`, which is untouched. `1780d45` is a message-only amend of
`644ee7c` — seed 4, the pre-registered experiment — which is therefore unreachable from HEAD and resolvable
only from the reflog, where the Adversary found it. The Builder reported the amend against the wrong commit,
and the room briefly recorded `4b4bc5c` as orphaned and instructed two seats not to resolve the genuine
precondition. A false confession was believed because it was self-incriminating, and nobody checked it for
that reason.**

**Two accounts of this were wrong in opposite directions — the Builder blamed `4b4bc5c`, I declared from md5
that no amend occurred — and both findings stand, because a message-only amend produces an identical tree,
which is exactly why tree comparison cannot see it.** **A message-only amend is invisible to every check that
compares trees: md5, `git diff`, and a grader resolving hashes all see nothing. Only the reflog records it.**

**Correction to my own contribution, entered here rather than left in the room's memory: my line "no amend
occurred" is wrong and is struck.** My md5 work was right about the trees and right that `1780d45` carries
both mutants and describes neither; the amend claim was the one line I exceeded my evidence on, and the
reason is the rule the room then wrote from it — **a seat's severity is not evidence about its accuracy, so
the claims that arrive in the register of a confession must be verified exactly as hard as the claims that
arrive in the register of an accusation.**

 `1780d45` is a message-only amend: its
tree is byte-identical to `644ee7c`'s and it shares `644ee7c`'s parent, so it carries the reversal it
inherits plus seed 4's fixture diff **and its message describes neither**. `4b4bc5c` is the genuine
precondition and was graded: **84 rows, 0 reds, correctly.** `644ee7c` was resolved from the reflog and
graded. `fc8c76b`'s own message calls it "seed 1 REPLANTED" and understates what it stacks on.

**This is recorded as a process failure with no lost work, and the second half is why nobody should have to
learn the first twice:** a message-only amend made the pre-registered experiment unreachable while its
message claimed to describe a different commit — the experiment demoted and the description false, both
invisible from the branch tip. A bold table line told two seats not to resolve the hash that is the parent
of everything after it.

## 2. The four outcomes, and the fifth state

| planting | hash | kind | grade |
|---|---|---|---|
| seed 1 a1 | `170c99d` | defect | **INERT** — `api.reset` throws before `store.setState`; 84 green rows mean nothing. **Not a survival.** |
| seed 1 replant 1 | — | defect | **LATENT** — `restaurant_revisions` on the live state: real, held, never exported. **Uncommitted, with the measurement quoted and no hash to resolve.** |
| seed 1 a2 | `fc8c76b` | defect | **CAUGHT** — `S3-340-declared-terms`, `S3-340-declared-revision`, `S3-341` |
| precondition | `4b4bc5c` / `1780d45` | not a mutant | earns nobody a `saw`; not evidence about any probe |
| seed 4 | `644ee7c` | defect | **CAUGHT** — six reds in `fixture_arrival.py`, five in `discriminator.py` |
| M2' | `fadad4d` | defect | **CAUGHT** — `S4-171b`, **not** the row it was aimed at; `S4-171d` PASSES against it |
| seed 2 | — | — | unplanted: two mutants in one function are one experiment until they are separated |

**Outcome vocabulary, four entries, only three of which are verdicts about a probe:** *catch* (a row fired —
a `saw`, per-probe) · *survival* (a live, observable defect no probe saw — a fact about the instruments) ·
*inert* (the plant never took — evidence about nothing) · *latent* (the plant took and is unobservable
through any exposed surface — a fact about the service's surface). **The plant check has two halves: establish
that the mutation took, and establish that something can see it.**

## 3. Per-probe ledger — `reported` / `saw`

| probe | `170c99d` | `4b4bc5c` | `644ee7c` | `fadad4d` | `fc8c76b` |
|---|---|---|---|---|---|
| `write_family.py` | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 |
| `discriminator.py` | 16/16 | 16/16 | **11/16** | 16/16 | **11/16** |
| `planner_property.py` | 15/15 | 15/15 | 15/15 | **14/15** | **14/15** |
| `negative_control.py` | 8/8 | 8/8 | **7/8** | **7/8** | **7/8** |
| `s3/fixture_arrival.py` | 36/36 | 36/36 | **30/36** | **30/36** | **27/36** |

- **`fixture_arrival.py`: `saw`** — seed 4's door defect at `644ee7c` (six reds) and the mutating refusal at
  `fc8c76b` (three reds). It went `saw: unknown` → `saw`. **"Narrow by construction" stopped being an argument
  and became a measurement, and the measurement is favourable: the one probe written end-to-end from an
  incident is the one that saw the incident, at the first test.** The fourth horn did not fire: no Builder
  probe caught it in place of this one.
- **`discriminator.py`: `saw`** at `644ee7c` (`S4-167-a1`, `a2a`, `a2b`, `a3b`, `cal`) — seed 4's policy
  rows — and previously at `ee04207`.
- **`planner_property.py`: `saw`** at `fadad4d`, via **`S4-171b`**, a row withdrawn from coverage at
  `d534b5e`. **`S4-171d` passes against the mutant written for it** and remains *cannot see by
  construction*. Aiming is not a predictor: the retired row caught what the aimed row could not, and a room
  that deletes demoted rows loses the row that catches things.
- **`negative_control.py`: `NC-004` red at `644ee7c`/`fadad4d`/`fc8c76b`** — its deliberately wrong answer
  became the build's answer. A control going red is not a coverage claim in either direction.
- **`write_family.py`: 9/9 everywhere.** Its three refusal halves are justified by `NC-002` (a control), not
  by a state where the other half is green.
- **`S4-170-4`'s population half: UNPROVEN, not justified.** If a defect *moves* a booking both halves go
  red; if one *drops* a booking only the population row does, and that case has never been seen.
- **`S3-340-*` / `S3-341` passed at `170c99d` and at `644ee7c` and would have passed forever against an
  inert plant: their green was not evidence about the defect, it was evidence that the defect was absent.**

**No planting after `170c99d` isolates a single defect.** Attribution above is by file and row disjointness,
and for `fc8c76b` by difference against graded baselines. **A clean M2′ and a clean seed 4 remain unplanted —
by the Builder's sequencing, not by the probes' limits.**

## 4. The export question, answered from the serialiser and the specification

`stage-4/src/snapshot.js`'s `snapshotState` serialises exactly: `users`, `tokens`, `restaurants`,
`reservations`, `idempotency`, `policies`, `history`, `series`, `batch_counters`. **`restaurant_revisions` is
absent**, and `state.js:44` holds it as the concurrency token stage 4 exposes as `restaurant_revision` on
replan previews. **The specification never enumerates the export's field list** — stage 3 requires only that
a stage-3 service *accept* exports produced by stage-1 or stage-2 services, and its one line mentioning
counters is about failure atomicity, not about document contents. So: **the export omits a concurrency token,
no requirement mentions it, and nobody has decided whether that is right — that is a judgement about the
surface, not a defect under any requirement I can cite.** One consequence is measurable and worth recording
as a measurement: **import replaces state wholesale (`store.setState(next)`), so an export/import round trip
resets `restaurant_revisions` to its initial value**, and a client's cached `restaurant_revision` would then
be compared against a restarted token. Whether that is a defect depends on a requirement that does not exist,
which is precisely why it is filed as an owed judgement rather than a finding.

## 5. Scope statement, verbatim

**One probe audited (`invariants.mjs`); the rest un-audited and therefore not green. The browser suites are
unmeasurable in this round — `playwright-core` is absent from the Adversary's environment, and the Builder's
screen suites are self-verified evidence from the seat whose code they exercise, not independent
verification. Seed 2 is unplanted with its reason. No Adversary instrument is runnable from this seat;
`stage-4/` is read-only to the Adversary, so every instrument change was a handover; five of the stage-4
probes here are un-audited except where a seed touched them. No service, container or symlink was left
running.**

## 6. Two clauses whose provenance is a hypothesis, not a derivation

- **Before choosing a field to mutate, read the serialiser and confirm the field is on an exposed surface.**
  *Provenance: proposed by the Builder, derived from the single instance their own uncommitted replant
  stumbled into. Discovered, then named. Hypothesis, not a rule with a measurement behind it.*
- **Describe history only from `git log --graph` and `git reflog`; when two accounts of one history conflict,
  run the command and believe neither.**
  *Provenance: proposed by the Builder after two accounts of one amend proved wrong in opposite directions.
  This one is the exception — it was checked against the reflog in the same turn it was proposed.*

## 6a. The inventory prose in stage-4 source — VERIFIED, with one discrepancy

The six inventory lines at `89f833a` in `stage-4/src/replans.js` are the Builder's descriptions of the
Builder's code, written by me into source and verified by nobody. **They have now been verified, by the seat
whose code they describe, and the result is a measurement rather than a caveat:**

```
prose: "moves once for each successful new booking, real amendment, cancellation,
        policy publication and plan application -- NOT for no-ops, failures,
        previews or replans"

api.js:137      booking             bumpRestaurantRevision
api.js:168      amendment           bump, guarded by if (wasConfirmed)
api.js:184      cancellation        bump
policy.js:229   publication         bump
replans.js:409  plan application    bump
series.js:349   series amendment    bump      <- a SIXTH site the prose does not name
state.js:44/68  starts at 0         restaurant_revisions: {}, || 0   <- verifies
```

- **Five claims verify; the prose undercounts** — it omits series amendment as a revision-mover. Recorded
  rather than smoothed: this is prose less complete than the code, which is the opposite of the failure mode
  the round spent the night on.
- **The guard at `api.js:168` is what makes "NOT for no-ops" true** rather than aspirational: a no-op
  amendment does not reach that line.
- **The prose is accurate clause by clause and misleading in the aggregate.** It calls `restaurant_revision`
  "the concurrency token" while the surface that carries it does not export it (§4), so the token does not
  survive an export/import round trip. **Prose written by the seat that wrote the code, describing intent
  rather than the surface's actual reach** — the round's one shape, at the level of a comment.

**Owed against whoever next touches the export: the concurrency token's documentation and its serialisation
were written by different seats in the same week and never reconciled.** *Judgement, stated as such. No
comment edit was made: `stage-4/` is read-only to the Adversary, a comment change is not a fix, and the
accepted hash is `56e278a`.*

## 7. Closing

**The largest single improvement to this project's checking was not an assertion — it was a sentence in a
rule file telling a seat to check its own setup before reporting a fault.** Every other rule in this ledger
came from something that went wrong at eleven at night; that one came from a fault nobody had, and it is the
only one that would have prevented half of them. **The companion sentence, from the same night: establish
that the thing you planted took, and establish that something can see it, before you ask what the probes say
about it.** *Judgement, stated as such.*

**A pre-registered experiment must be reachable, or the pre-registration is theatre.** The value of
committing an interpretation before a mutant exists depends entirely on the mutant surviving as something a
grader can resolve, and **a round that amended away its own best-designed experiment kept the commitment and
lost the thing the commitment was about** — the one failure mode in this round that no rule in the ledger had
predicted.

**Grade the stack last: attribute by subtracting baselines you already hold, never by arguing.** The three new
reds at `fc8c76b` are attributable because `644ee7c` and `fadad4d` were graded first; grade the stack first
and you will be arguing instead of measuring.
