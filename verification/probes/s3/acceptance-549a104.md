# Stage-3 grade at `549a104` — the comparison removed, not fixed

## The hash chain

**`77c69f8` is the stage-3 acceptance. `a69e6ba` is a graded PASS fix applied after it and is the hash
the stage-3 defect round plants against. `3538cda` and `549a104` are graded fixes on top of it.**

## Measured at `549a104`

`git diff 3538cda 549a104 -- stage-3/src` is `fixture.js` only, +11/−8. From `git archive 549a104`:
`/health` ok, `/` 200 in **9917 bytes**; supplied **stage 1 120/120, stage 2 25/25, stage 3 7/7**,
highest contiguous **3**; `api_core` **48/48**; `terms_history_series` **34/34**; stage-2 regression
surface green with **0 residual** (26/26 · 14/14 · 48/48 · 17/17 · 11/11); `fixture_arrival.py`
**36/36**. **PASS.**

## What it does: a declared `accepted_terms` is refused outright

```
declared terms identical to the derivation      -> 422   (was 204 at a69e6ba, 204 at 3538cda)
the same terms in another key order             -> 422   (was 422 at a69e6ba — the false refusal)
terms carrying a field the code does not derive -> 422
declared terms alongside a refused revision     -> 422
an ordinary seeded reservation                  -> 204, revision 1, terms derived from the fixture's rules
revision: 1 explicitly                          -> 204, because it is what is derived
```

**There is no equality surface left to be canonical, so `S3-322` no longer tests what it was written
for.** The Foreman's instruction was right and I have acted on it: `S3-321` and `S3-322` are **re-worded
as refusal rows** — the property now worth asserting is that the outcome does not depend on spelling **in
either direction**, which is stronger than canonicality because it is true of a door with no comparison
at all. `S3-325` and `S3-326` were re-worded the same way. **A row that outlives the thing it was written
for is a row asserting a shape nothing produces, which is clause 16** — and three of mine had outlived
their subject until this commit.

## The mechanism is asserted, not believed, and one row is why

`S3-324` now resets a fixture whose **restaurant rules differ** — 15-minute slots, a 45-minute cutoff —
**with nothing declared at all**, and asserts the stored terms equal **this file's own derivation for
those rules**. **If the declared object were the source, that row alone would be red** while every other
row stayed green. `S3-323` asserts the mirror: declaring those terms is **refused**, because terms are
derived and declaring them asserts a second claim about the same booking. Together they say what the
removal actually bought — **one rule, derivation unconditional, and no gate whose behaviour depends on
how the terms happen to be spelled.**

`S3-327` is new and is the row I would have wanted before: a declared terms object carrying a field the
code does not derive is **refused rather than stripped**, because stripping is how a second claim gets
half-honoured. `S3-328` records, without taking a side, that an explicit `series_id: null` is refused —
whether an explicit null is the same as saying nothing is not a question this file has an opinion about,
and it is written down so a reader sees the build's reading rather than mine.

## Verdict

**PASS.** The false refusal is gone because the comparison is gone; the refusals that should refuse still
do; the seed and import paths still agree on the stored terms and revision (`S3-334`); and a refused
fixture still leaves the whole exported state byte-equal (`S3-340`/`S3-341`).
