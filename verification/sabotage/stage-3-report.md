# Sabotage Report for Tablekeeper Stage 3 (commit a69e6ba)

## Complete List of Mutants Tested

| # | Mutant | Requirement | Implemented | Supplied Harness | Adversary Probes | Probe File | Result |
|---|--------|-------------|-------------|------------------|------------------|------------|--------|
| 1 | Grid/explain seam (e6a0830) | S3-003, S3-005, S3-009 | YES | **NOT RUN** | **CAUGHT** | `api_core.py` | S3-003, S3-009 FAIL |
| 2 | Occurrence reference emission (df4387d) | S3-105, S3-105b | YES | **NOT RUN** | **CAUGHT** | `terms_history_series.py` | S3-105, S3-105b-missing-reservation FAIL |
| 3 | Fixture refusal half-application | S4-152 | YES | **NOT RUN** | **MISSED** | `api_core.py`, `terms_history_series.py` | 48/48 api_core, 34/34 terms_history passed |

## Totals

**Supplied harness:** Not run against stage-3 mutants (would require full suite with UI checks)

**Adversary probes caught:** 2 of 3 implemented mutants

### Missed by Adversary Probes (1 mutant)

| Mutant | Requirement | Why Missed |
|--------|-------------|------------|
| Fixture refusal half-application | S4-152 | No probe checks for partial writes on refused fixture |

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