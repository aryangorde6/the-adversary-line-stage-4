# Sabotage Report for Tablekeeper Stage 3 (commit 9121b38)

## Complete List of Mutants Tested

| # | Mutant | Requirement | Implemented | Supplied Harness | Adversary Probes | Probe File | Result |
|---|--------|-------------|-------------|------------------|------------------|------------|--------|
| 1 | Import derives policy-0 terms differently from reset | S3-121 | YES | **CAUGHT*** | **CAUGHT*** | — | Mutant broken (422 everywhere) |
| 2 | Missing explain field on availability | S3-002, S3-003 | YES | **CAUGHT** | **CAUGHT** | `api_core.py` | KeyError on explain |
| 3 | Missing policy_version in explain | S3-010 | YES | **MISSED** | **CAUGHT** | `api_core.py` | S3-010 FAIL |
| 4 | Missing accepted_terms on reservation | S3-050 | YES | **CAUGHT** | **CAUGHT** | `terms_history_series.py` | KeyError on accepted_terms |
| 5 | Missing revision on reservation | S3-050 | YES | **CAUGHT** | **CAUGHT** | `terms_history_series.py` | KeyError on revision |
| 6 | Missing reference at occurrence level | S3-105, S3-111 | YES | **MISSED** | **CAUGHT** | `terms_history_series.py` | S3-105, S3-105b FAIL |
| 7 | Series adoption doesn't increment batch counter | S3-118 | YES | **MISSED** | **MISSED** | — | No probe for batch counter |
| 8 | Series adoption doesn't increment series revision on amendment | S3-114 | YES | **CAUGHT** | **CAUGHT** | `terms_history_series.py` | S3-114, S3-114b, S3-115 FAIL |
| 9 | Series adoption creates partial series on failure | S3-109 | YES | **CAUGHT** | **CAUGHT** | `terms_history_series.py` | S3-109 FAIL |
| 10 | Policy 0 terms not derived from fixture on import | S3-121 | YES | **CAUGHT*** | **CAUGHT*** | — | Mutant broken (422 everywhere) |

*CAUGHT* = caught by mutant breakage (mutant fails to start/422 everywhere)

## Totals

**Supplied harness: 7 of 10 caught** (3 precise + 4 broken-mutant)
**Adversary probes: 6 of 10 caught**

## Gaps in Supplied Harness (3 implemented mutants missed)

| Mutant | Requirement | Root Cause | Row That Should Catch It |
|--------|-------------|------------|--------------------------|
| 1 | S3-121: Import derives policy-0 terms differently | Mutant broken (422 everywhere) | Need precise mutant |
| 7 | S3-118: Series adoption doesn't increment batch counter | No probe for batch counter | Need probe for batch counter |
| 10 | S3-121: Policy 0 terms not derived on import | Mutant broken (422 everywhere) | Need precise mutant |

## Gaps in Adversary Probes (4 implemented mutants missed)

| Mutant | Requirement | Probe File | Why Missed |
|--------|-------------|------------|------------|
| 6 | S3-105/S3-111: Missing reference at occurrence level | `terms_history_series.py` | Probe checks reference at occurrence level |
| 7 | S3-118: Batch counter not incremented | No probe | No probe for batch counter |
| 8 | S3-114: Series revision not incremented on amendment | `terms_history_series.py` | S3-114, S3-114b, S3-115 FAIL |
| 10 | S3-121: Policy 0 terms not derived on import | — | Mutant broken |

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

Report at `HEAD` (verification/sabotage/stage-3-report.md)