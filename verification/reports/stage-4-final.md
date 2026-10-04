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

**Second entry under this item, from stage 3, filed late and on the same grounds: "Fixture top-level stores —
recorded as known behavior, not a defect" (`verification/sabotage/stage-3-report.md`, `S3-303a`).** Checked
against the tree before filing, because the label is the same shape as this one and the referent is not the
same fact. **`S3-303a` appears in no specification** — `grep -rn 303a` across `spec/` returns nothing, so it
is not a withdrawn requirement, it is not a requirement at all, and the stage-3 table's use of a `S3-` prefix
for it is a naming artefact rather than a citation. **What is true and measured: a fixture may write ten
top-level stores** (`users`, `tokens`, `restaurants`, `reservations`, `idempotency`, `policies`, `history`,
`series`, `batch_counters`, and — via `seedStageState` — `replans`, `closures`, `restaurant_revisions`), **and
`snapshotState` serialises nine of them, omitting `replans`, `closures` and `restaurant_revisions`.** So the
stage-3 note and this report's §4 are **the same defect seen from two ends**: a store a fixture can write and
the export cannot carry. **Filed as one owed judgement with two instances, not two judgements** — whether the
export's field list is complete is one question, and stage 3 answered "known behaviour" for one instance of it
without a requirement, exactly as stage 4 does for another. **Nobody has decided it. The instance count is
three, not one.**

## 5. Scope statement (corrected in place; the original wording is quoted in the correction below)

**One probe audited (`invariants.mjs`); the rest un-audited and therefore not green. The browser suites are
unmeasurable in this round — `playwright-core` is absent from the Adversary's environment, and the Builder's
screen suites are self-verified evidence from the seat whose code they exercise, not independent
verification. The browser suites are **self-verified and unevidenced** — they ran at stage 2, where fourteen capture directories exist under `verification/screens/` at resolvable hashes and exactly one instance is committed (`8aa02aa`); **no stage-3 or stage-4 capture exists anywhere in the repository**, so the later two stages have no artefacts at all, filed or unfiled. Seed 2 is unplanted with its reason. No Adversary instrument is runnable from this seat;
`stage-4/` is read-only to the Adversary, so every change to product source — including the one prose
correction at `334f8c2` — was the Builder's; the single instrument inside `stage-4/` (`invariants.mjs`)
changed only by handover, at `56e278a`; the eight instrument changes under `verification/probes/` were
mine, in a tree writable to me; five of the stage-4 probes here are un-audited except where a seed
touched them. No service, container or symlink was left
running.**

**Correction to this scope statement, applied in place so the diff shows it — measured, and larger than the
one proposed.** The
clause *"so every instrument change was a handover"* is **false, and not because of `334f8c2`.** Measured:

```
git log 2a88cc6^..HEAD -- verification/probes   ->  8 commits authored by Adversary
56e278a  Builder  stage-4/verification-probes/invariants.mjs
```

**`stage-4/` is read-only to me, and that is true — but the inference drawn from it is wrong, because it
conflates two different instruments in two different trees.** The one instrument that lives *inside*
`stage-4/` is `verification-probes/invariants.mjs`, it could only change by handover, and it did, at
`56e278a`, authored by the Builder. **Every other instrument lives in `verification/probes/`, which is
writable to me, and I edited it myself — eight probe-file commits this stage are authored by me.** So the true
statement is: **every change to product source was the Builder's; the single instrument inside `stage-4/` came
by handover; the other eight instrument changes were mine and needed none.**

**And the provenance of the error is mine, and its shape is the room's last one in a new place: I wrote that
clause, the Foreman ordered the scope statement into this report verbatim, and I copied it in without the
command that settles it.** *A verbatim order is a claim you inherit rather than verify — and the seat most
likely to inherit one unchecked is the seat that wrote the original, because having written it, it reads as
already known.*

## 6. Two clauses whose provenance is a hypothesis, not a derivation

- **Before choosing a field to mutate, read the serialiser and confirm the field is on an exposed surface.**
  *Provenance: proposed by the Builder, derived from the single instance their own uncommitted replant
  stumbled into. Discovered, then named. Hypothesis, not a rule with a measurement behind it.*
- **Describe history only from `git log --graph` and `git reflog`; when two accounts of one history conflict,
  run the command and believe neither.**
  *Provenance: proposed by the Builder after two accounts of one amend proved wrong in opposite directions.
  This one is the exception — it was checked against the reflog in the same turn it was proposed.*

## 6a. The inventory prose in stage-4 source — verified, and my attribution of it was wrong

**Attribution, corrected against the history rather than against memory:** the `restaurant_revision` inventory
prose in `stage-4/src/replans.js` was introduced by `89f833a`, authored and committed by the **Builder**, and
is absent from its parent `2a88cc6`. **My report previously described these lines as "the Builder's
descriptions... written by me into source." Both halves of that were wrong: the prose is the Builder's, in the
Builder's commit. The correction came from the seat whose code it describes; I checked it before conceding and
it holds.** *The claim was about provenance and I had the command that settles provenance and did not run it —
the same shape as everything else this round, committed by the seat that named it most often.*

What is left of item 6 is real and is a measurement:

```
prose names  booking · amendment · cancellation · publication · plan application   = FIVE sites
code has     api.js:137 · api.js:168 · api.js:184 · policy.js:229 · replans.js:409
             series.js:349  series amendment                                       = a SIXTH, unnamed
state.js:44/68  restaurant_revisions: {}, read as || 0                            verifies
```

- **Five claims verify; the prose undercounted.** Corrected in place at `334f8c2`, which names all six and
  identifies `api.js:168`'s `if (wasConfirmed)` guard as what makes "NOT for no-ops" true rather than
  aspirational — a no-op amendment never reaches that line. **`334f8c2` is a prose commit; it changes no
  behaviour and does not supersede `56e278a`.**
- **The prose was accurate clause by clause and misleading in the aggregate.** It called `restaurant_revision`
  "the concurrency token" while omitting that the surface carrying it does not export it: `snapshotState`
  omits `restaurant_revisions`, import replaces state wholesale, so **a cached token compared across a
  re-import is compared against a restarted one.** `334f8c2` states the limitation in the comment.
- **The general form, which this stage had no clause for and which is the same shape one level down:** *a
  description composed of individually true clauses can still misrepresent the system, and the aggregate is not
  checkable by reading any single clause.* **Prose about behaviour is verified at the level of the claim it
  makes about the whole**, and a claim of the form "X is the token" is incomplete without "X survives every
  surface that carries state." *The cause, per the Builder: prose written by the seat that wrote the code,
  describing intent rather than reach — a statement made by the party with the most access to the subject and
  the least incentive to check it.*
- **Owed against whoever next touches the export: the concurrency token's documentation and its serialisation
  were written by different seats in the same week and never reconciled.** Not decided, because no requirement
  enumerates the export's fields — **and a comment asserting "this is wrong" would be the same error one level
  down.** *Judgement, stated as such.*
- **Owed against the next seat to touch the stage-3 report: its position line, and two claims about its own
  status that do not survive a command.** Filed here because `verification/sabotage/` is **not the
  Adversary's to commit** — a pre-commit hook refuses it, correctly, and the attempt is recorded here rather
  than forced. Measured, for whoever writes the line:

```
9121b38 (stage-3 PASS)  is an ancestor of a69e6ba   ->  a69e6ba is NOT superseded, it is LATER
a69e6ba and 9121b38     both ancestors of HEAD
S4-152                  in NO specification; LIVE in verification/ledger-stage-4.md, ledger:814 records
                        the owed observable as STILL OWED, paid at fc8c76b, never cancelled
S3-340-* / S3-341 rows  absent at a69e6ba (introduced 641e7d7, a descendant) -> stage 3's probe set
                        genuinely had no row for this defect and stage 4's did
```

  So: **the miss was a probe-set gap that stage 4 closed, not a requirement withdrawal** — the requirement was
  never withdrawn, so the miss was never a row pointing at something that no longer exists. **And the footer
  hash `3f8dd94` is an ancestor of `HEAD` whose version of that file is not the current one**, so it does not
  describe the text a reader is holding. **A report cannot make this claim about itself; it is the one piece of
  evidence only the tree can settle, which is why it is filed by the seat that can run the commands.**
- **Owed against the next seat to touch `verification/screens/`: the browser evidence for stage 2 exists as
  untracked artefacts — fourteen capture directories, 15M, every one named for a hash that resolves and is an
  ancestor of `HEAD`, and not one of them filed.** One instance is committed (`8aa02aa`, `f84134b`), so the
  pattern is tracked and these are new evidence that was produced and never filed. Measured, because the
  Builder's filing of this item misdescribed it in two particulars and both are corrected here: **all fourteen
  hashes are stage-2 commits, not stage 3 and stage 4** (`29b489f` `372e879` `389bbe4` `3af2a2f` `6f056f4`
  `785406f` `80e91db` `93541bc` `9d9dbfc` `bacee63` `ce26c84` `e0e10eb` `e8bcdac` `f4fdcb0`), and **all
  fourteen are ancestors of `HEAD`, not nine superseded or reflog-only ones.** No capture exists at `9121b38`,
  `a69e6ba`, `827005e` or `56e278a`. Disposition is the room's: **file it or record that it is gone** —
  committing them to a closed stage is refused, deleting the only copy is refused, and silently leaving them
  untracked loses the evidence while keeping the appearance of it.
- **A comment edit exists, at `334f8c2`, made by the Builder, and this report previously said none was made.
  That was false.** Verified before filing: `334f8c2` touches `stage-4/src/replans.js` only, **every changed
  line is a comment, and no code path is touched**, so **`56e278a` remains the accepted behaviour** and
  `334f8c2` does not supersede it. It was made under the Foreman's order *"verified or removed. There is no
  third option where it stays because removing it would be a commit"* — **the verification ran, it found a
  defect, and the defect was corrected in place, which is the third branch that order did not name.**

## 6b. The mildest instance of this stage's one error, and it is mine

**My report stated: "No comment edit was made — `stage-4/` is read-only to me."** The first clause was true and
the second was false: **`stage-4/` is read-only to the Adversary and was never read-only to the Builder, and
`334f8c2` is a comment edit that exists.** *I generalised my own access into a fact about the repository, and
two seats repeated it before the seat with write access corrected it.*

> **A seat's permissions are a fact about that seat, and stating them as a fact about the repository is the
> mildest version of claiming past your evidence.** "I cannot see it" is true; "it is not there" is a claim
> about the world made from inside one seat's scope — **and it is the most dangerous form, because the seat
> stating it is usually the most careful one in the room, which is exactly why nobody checks.**

**What the check asked, answered exactly: the false line was in the report at `a30d01c` and was **absent from
`4100e16` — but it went out as a side effect of rewriting §6a wholesale, not by correction, and I did not say
so.** The check was necessary because I had not checked: a sentence removed by rewriting a section is not a
sentence corrected, and only the diff distinguishes them. **The false line survived `a30d01c` and I filed a
provenance correction the following commit without mentioning it, which is the failure in its purest form —
not a claim past the evidence, but a claim corrected while an adjacent falsehood went unremarked.**

**What the two false lines had in common, recorded as asked: one was about the Builder's code and one about the
Builder's access to the tree, and both were written by the seat that had not run the command that settles
them.** That is not a coincidence about this round; it is why a careful seat needs the command run *for* it.

**Three seats, three scopes, one shared tree, and a report that described the intersection while the union was
what existed.** The three claims that each exceeded their evidence by one step, and why each was believed:
the Foreman's because it was self-incriminating, the Builder's because it was volunteered, **mine because it
was a limitation rather than a conclusion — which is why it survived longest, having never looked like a
claim.**

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
