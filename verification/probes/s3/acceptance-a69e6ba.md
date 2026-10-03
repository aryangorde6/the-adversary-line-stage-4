# Stage-3 acceptance at `a69e6ba` — graded directly, after the accepted hash

## The hash chain, settled in one paragraph

**`77c69f8` is the stage-3 acceptance. `a69e6ba` is a graded PASS fix applied after it. `a69e6ba` is the
hash the stage-3 defect round plants against. `3538cda` is a later graded fix (the canonical terms
gate).** `9121b38`, `77c69f8`, `df4387d` and `e6a0830` are the PASS and the row-only additions graded
directly against it, each holding. Nothing further needs to be inferred from a conversation.

## The table

| Hash | What it is | My grade |
|---|---|---|
| `9121b38` | the `S3-105` fix | PASS; the Saboteur's stage-3 round plants here |
| `77c69f8` | row-only, the absent-reservation row | **the accepted stage-3 hash** — graded directly, `-- stage-3/src` empty against `9121b38` |
| `e6a0830` | row-only, the seam row | graded directly; product unchanged; PASS |
| `a69e6ba` | **product change** — the fixture refusals | **graded here, as a fix applied after acceptance** |

**`77c69f8` is what the stage-3 acceptance rests on.** `a69e6ba` is a stage-3 defect fix landing after
that acceptance and after the Saboteur's round, so it is graded as a fix rather than re-adopting it as
the accepted hash — but nothing about it regresses anything, so a reader may treat the accepted stage-3
behaviour as `a69e6ba`'s.

## What `a69e6ba` does, measured

From `git archive a69e6ba stage-3`: `/health` ok, `/` 200 in 9917 bytes; supplied **stage 1 120/120,
stage 2 25/25, stage 3 7/7**, highest contiguous **3**; `api_core` **48/48**; `terms_history_series`
**34/34**; stage-2 regression surface green with **0 residual** (`closed_day` 26/26 · `out_of_order_lost`
14/14 · `focus_lifecycle` 48/48 · `focus_reentry` 17/17 · `states_set` 11/11); and the new
`fixture_arrival.py` **29/30**.

### The four keys are refusals, and the door the refusal names is a door that works

`S3-301-policies` / `-series` / `-history` / `-batch_counters`: each key alone → **422
`fixture_unsupported`**, the offending key **named in the body**, and the message **naming the import
door**. Then, because a refusal that points at a dead end is not a legible absence:

- `S3-302a` the four stores are **absent from an export while empty** — which is why `S3-302b` is
  asserted *after* the import that seeds them and not before it, since absence against an empty state
  cannot be told from silence.
- `S3-303` a document carrying all three stores **under `state`** imports **204**.
- `S3-304` and that import **really seeded them**: policies 1, series 1, `batch_counters.r_anker` 7.
- `S3-302b` the export then **carries all four stores**.

**The sentence the refusal names is therefore true, and I checked it rather than believing it.**

### The seed path can no longer express the booking the import path refuses

`S3-310`: `revision: 5` with `accepted_terms: null`, `revision: 2`, `revision: 0`, `series_id`,
`series_index` — each **422 `fixture_unsupported`**. `S3-311`: `accepted_terms` differing from the
derived policy-0 terms by **one field** → 422. Refused rather than coerced.

### The Foreman's two questions about acceptance — answered

**Is a declared `revision: 1` genuinely unable to diverge?** **Yes, and observably.** `S3-320` accepts
it; `S3-331` reads the booking back at **revision 1**; and `S3-332` compares its `accepted_terms`
against **this file's own derivation from the fixture's rules** — recomputed in the probe from
`slot_minutes`, `reservation_duration_minutes`, `cancellation_cutoff_minutes`, `opening_hours` and the
table capacities, never read out of a response — and they are **equal**. So the stored terms are the
derived ones, not a copy of whatever the fixture wrote. `S3-333` confirms `effective_from` is absent
from `accepted_terms`, which is the deliberate exclusion, not an accident of serialisation.

**Is a fixture whose `accepted_terms` matches the derived value *by coincidence rather than by
derivation* still accepted — and if so, is acceptance on equality or on derivation?** **They differ, and
the build is on neither.** `S3-321` accepts terms identical to the derived ones. `S3-322` **fails**: the
**same terms with the keys in a different order** are refused with 422. The comparison is
`JSON.stringify(raw.accepted_terms) !== JSON.stringify(derivedTerms)` — so acceptance is on **byte
equality of the JSON text**, which is *stricter* than equality of the terms and *looser* than
derivation.

- **Stricter than equality:** a probe author writing the same terms in a different key order is told
  `fixture_unsupported`, with a code that says the fixture is unsupported rather than that the terms
  differ. Nothing in the specification governs this door, so I record it rather than call it a defect.
- **Looser than derivation:** nothing checks that the fixture's terms were *derived*; it checks that
  they serialise identically. **The two coincide only while the derived serialisation is stable** —
  add a key to `acceptedTermsOf`, or reorder it, and every fixture asserting those terms breaks at once,
  with a refusal whose message points at the fixture rather than at the change.
- **The storage risk the question was aimed at does not exist**, and `S3-334` is why: seed the booking,
  export, re-import, and the booking reads back with **identical `accepted_terms` and identical
  `revision`**. **The two arrival paths compute the same derived value**, which was the actual
  requirement; a differential row that asserts equality must also assert both sides were reached, and
  this one asserts the import returned 204 and both bookings were read.

### A refusal changes nothing

`S3-340-policies` / `-batch_counters`: a fixture refused for a stage-3 key leaves the **whole exported
state byte-equal** to the baseline. `S3-341`: a fixture carrying **two** refusable faults is refused
once and changes nothing. A refusal that half-applies would be worse than no refusal.

## Recorded, not claimed: a 204 for state in the wrong place

`S3-303a` — a document carrying the three stores at the **top level** rather than under `state` imports
**204** and seeds nothing. Unknown top-level fields are ignored, so the 204 is defensible and I do not
call it a defect. **But it is the same shape as the fixture 204 this file was written about**, one
level up: a success code standing in for state that was never read. It is recorded because a probe
author who puts a key in the wrong place gets the same silence the fixture used to give, and the only
reason I found it is that my own first attempt made that mistake.

## Verdict

**PASS.** One row red (`S3-322`), and it is a strictness question about a door no requirement
specifies rather than a behaviour the specification contradicts. Stage 4 remains **unmeasured**, and its
ledger (`81f2e37`) already treats `S4-150` and `S4-152` as satisfied-in-principle rows to be
re-measured on a stage-4 build rather than as work already banked.
