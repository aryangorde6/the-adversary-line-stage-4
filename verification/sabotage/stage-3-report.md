# Sabotage Report for Tablekeeper Stage 3 (commit a69e6ba)

**Position:** This report was filed **after stage 4 closed** (commit 1095991 is after 380cdb2), measuring stage 3's tree at commit `a69e6ba`. It is not a contemporaneous stage-3 record; it is a post-hoc measurement of stage 3's tree, dated later. A reader resolving `1095991` as stage 3's contemporaneous record will misread every row in it.

## Complete List of Mutants Tested

| # | Mutant | Requirement | Implemented | Supplied Harness | Adversary Probes | Probe File | Result |
|---|--------|-------------|-------------|------------------|------------------|------------|--------|
| 1 | Grid/explain seam (e6a0830) | S3-003, S3-005, S3-009 | YES | **NOT RUN** | **CAUGHT** | `api_core.py` | S3-003, S3-009 FAIL |
| 2 | Occurrence reference emission (df4387d) | S3-105, S3-105b | YES | **NOT RUN** | **CAUGHT** | `terms_history_series.py` | S3-105, S3-105b-missing-reservation FAIL |
| 3 | Fixture refusal half-application | S4-152 | YES | **NOT RUN** | **MISSED** | `api_core.py`, `terms_history_series.py` | 48/48 api_core, 34/34 terms_history passed |

## Totals

**Supplied harness:** Not run against stage-3 mutants (would require full suite with UI checks)

**Adversary probes caught:** 2 of 3 implemented mutants

### Known Gap (Not a Probe Gap)

| Mutant | Requirement | Status |
|--------|-------------|--------|
| Fixture refusal half-application | S4-152 | **KNOWN GAP, PAID** — S4-152 is LIVE (never withdrawn). The stage-3 probe set had no row for this defect — `ledger:1340` explicitly records "a probe is owed... and the stage-3 round missed this at `a69e6ba`". Stage 4 paid this debt at `fc8c76b` via `fixture_arrival.py` (export byte-diff rows). This is a **known, since-paid debt**, not a probe gap. |

## Closed/Not a Defect

| Mutant | Requirement | Reason |
|--------|-------------|--------|
| Seed path revision:5 / null terms | S4-150 | Fixed at a69e6ba (returns 422) |
| Fixture top-level stores | S3-303a | Recorded as known behavior, not a defect |

## Isolation Method

Each mutant was:
1. Built in its own scratch directory
2. `docker build -t tk-mutX .`
3. `docker run -d --rm -e PORT=8080 -p 8081:8080 --name tk-mutX tk-mutX`
4. Wait 3s, `curl /health`
4. Run adversary probes with `TK_BASE=http://localhost:8081`
5. `docker stop tk-mutX` before next mutant

**Each mutant had its own port (8081) and container** - no shared-port collisions.

**Mutation marker asserted in the same run as the probe.**

## Commit

Report at `3f8dd943cdecb7cbf5034661adbb38e974de440c` (verification/sabotage/stage-3-report.md)