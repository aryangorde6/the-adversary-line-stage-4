# Stage-3 grade at `3538cda` — the canonical terms gate

## The hash chain, settled in one paragraph

**`77c69f8` is the stage-3 acceptance. `a69e6ba` is a graded PASS fix applied after it. `a69e6ba` is the
hash the stage-3 defect round plants against. `3538cda` is a later graded fix — the canonical terms gate.**
`9121b38` and the row-only additions `77c69f8`, `df4387d`, `e6a0830` are the PASS and its graded rows.

## Measured at `3538cda`

`git archive 3538cda stage-3`: `/health` ok, `/` 200 in **9917 bytes**; supplied **stage 1 120/120,
stage 2 25/25, stage 3 7/7**, highest contiguous **3**; `api_core` **48/48**; `terms_history_series`
**34/34**; stage-2 regression surface green with **0 residual** (`closed_day` 26/26 · `out_of_order_lost`
14/14 · `focus_lifecycle` 48/48 · `focus_reentry` 17/17 · `states_set` 11/11); `fixture_arrival.py`
**34/34** — up from 29/30 at `a69e6ba`, with six new rows. `git diff a69e6ba 3538cda -- stage-3/src` is
`fixture.js` only, +9/−2. **PASS.**

## Both halves of my question, answered by driving rather than by agreement

**Is the declared object ever the source? No — and the mechanism is now asserted, not believed.** My
worst case was a fixture whose `accepted_terms` happened to equal today's derivation and diverged
tomorrow. **The decisive test is to change the rules the derivation comes from**, inside one restaurant,
because that is the only way to change what the derivation *is* rather than which restaurant it came from:

| Row | Assertion | Result |
|---|---|---|
| `S3-323` | a fixture declaring terms derived from **15-minute / 45-minute** restaurant rules resets **204** | **PASS** — the gate refuses only what disagrees with the derivation it just computed |
| `S3-324` | the **stored** terms equal this file's derivation for the rules **actually in force** — `slot_minutes: 15`, `cancellation_cutoff_minutes: 45` | **PASS** — if the declared object were the source, the stored terms would be the old 30/120 ones and **this row alone would be red while every other row stayed green** |

So **acceptance is an equality check that decides only whether to refuse, and the derivation is
unconditional** — the fixture's rules are read again on every reset and the terms are re-derived from
them. A declared object that happens to match cannot drift, because it is never kept.

## The fix, and the fragility that remains in a different form

`JSON.stringify` was key-order sensitive, so identical content in a different order was a different
string and a semantically correct fixture was refused with a reason the author could not see. Now:

- `S3-322` the same terms with the **top-level** keys reordered → **204** (was 422 at `a69e6ba`).
- `S3-325` the same terms with the keys of **every nested object** reordered as well — `opening_hours`
  entries and `capacities` — → **204**. **A canonicalisation that only sorted the top level would still
  refuse a correct fixture**, which is the same false refusal one level in.
- `S3-326` canonicalisation did **not** weaken the refusal: a genuinely different terms object, declared
  alongside a refused revision, is still **422 `fixture_unsupported`** — and `S3-311` (terms differing by
  one field) and `S3-310-*` (revision 5 with null terms, revision 2, revision 0, `series_id`,
  `series_index`) all still refuse.
- `S3-302a`–`S3-304` unchanged: the four keys are refused naming the working door, the import really
  seeds, and a refused fixture leaves the state byte-equal.

**The residual fragility, recorded rather than left implied: nothing checks that the declared terms were
*derived*, only that they are equal to a derivation computed now.** The gate is content equality against
a fresh derivation, which is the right comparison — **but a fixture may still express an accident**: a
terms object that coincides with this build's derivation is accepted, and the coincidence is not
distinguishable from an author who derived it. The stored value is unaffected either way (`S3-324`), so
this is a property of the door's permissiveness, not a defect in what is kept.

**And the general form, now clause 24: a refusal the author cannot account for is barely better than the
success that lied to them** — both leave the author stuck. One said `204` and seeded nothing; this said
`422` and refused something correct. **A refusal that is *wrong* is worse than no refusal**, because the
author cannot tell it from the state being genuinely unsupported. It is the same failure as the four store
keys, one level in.

## Verdict

**PASS.** Nothing regressed, the false refusal is closed at both levels of the object, the refusals that
should refuse still do, and the question that found it came back with a premise that held *and* a defect
one level lower — which is worth more than "the premise holds".
