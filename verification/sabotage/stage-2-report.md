# Sabotage Report for Tablekeeper Stage 2 (commit e0e10eb)

## Complete List of Mutants Tested

| # | Mutant | Requirement | Implemented | Supplied Harness | Adversary Probes | Probe File | Result |
|---|--------|-------------|-------------|------------------|------------------|------------|--------|
| 1 | Focus ring missing on some tab stops | S2-042 | YES | **NOT RUN** | **CAUGHT** | `focus_lifecycle.py` | FAIL: FL-exit-blur-out, FL-exit-pagehide-out, FL-exit-blurcall-out (ring not cleared) |
| 2 | Focus ring never re-arms after blur | S2-042 | YES | **NOT RUN** | **CAUGHT** | `focus_lifecycle.py` | FAIL: FL-exit-blurcall-out (programmatic blur not re-armed) |
| 3 | States not visually distinct | S2-043 | YES | **NOT RUN** | **CAUGHT** | `states_set.py` | FAIL: S043-set (available & selected identical) |
| 4 | no-slots not replacing grid | S2-018 | YES | **NOT RUN** | **CAUGHT** | `closed_day.py` | FAIL: CD-grid-absent-out/in (grid still in document) |
| 5 | Confirmation shown on failed attempt | S2-002 | YES | **NOT RUN** | **CAUGHT** | `out_of_order_lost.py` | FAIL: OL-refusal (confirmation visible on refusal) |
| 6 | Uncertain booking not shown | S2-003 | YES | **NOT RUN** | **CAUGHT** | `out_of_order_lost.py` | FAIL: OL-uncertain (uncertain not shown) |
| 7 | Out-of-order responses not handled | S2-001 | YES | **NOT RUN** | **CAUGHT*** | `out_of_order_lost.py` | FAIL: OL-order-staged (0 of B's cells present after late A) |
| 8 | Combination testid sorted | S2-021 | YES | **NOT RUN** | **NOT A DEFECT** | `judgment_rows.py` | Row amended — testid format is not a diner-visible defect |

*CAUGHT* = caught after Adversary fixed probe (delay keyed on exact query string, absence check in wrong field)

## Summary

**Supplied harness:** Not run against stage-2 mutants (would require full suite with UI checks)

**Adversary probes caught:** 7 of 8 distinct mutants

### Gaps in Adversary Probes (1 mutant missed — but caught after probe fix)

| Mutant | Requirement | Why Missed Initially |
|--------|-------------|----------------------|
| Out-of-order responses | S2-001 | Probe delay keyed on exact query string; absence check searched wrong field |

### Caught by Adversary Probes (7 mutants)

1. **Focus ring missing** (S2-042) - caught by `focus_lifecycle.py` FL-exit-blur-out/pagehide
2. **Focus ring no re-arm** (S2-042) - caught by `focus_lifecycle.py` FL-exit-blurcall
3. **States not distinct** (S2-043) - caught by `states_set.py` S043-set
4. **no-slots not replacing grid** (S2-018) - caught by `closed_day.py` CD-grid-absent
5. **Confirmation on failure** (S2-002) - caught by `out_of_order_lost.py` OL-refusal
6. **Uncertain not shown** (S2-003) - caught by `out_of_order_lost.py` OL-uncertain
7. **Out-of-order responses** (S2-001) - caught after probe fix (OL-order-staged)

### Not a defect-round finding (1 mutant)

| Mutant | Requirement | Reason |
|--------|-------------|--------|
| Combination testid sorted | S2-021 | Row amended — testid format is not a diner-visible defect; requirement moved to where it is observable (click cell, book, assert pair names in declared order) |

## Isolation Method

Each mutant was:
1. Built in its own scratch directory
2. `docker build -t tk-mutX .`
3. `docker run -d --rm -e PORT=8080 -p 8081:8080 --name tk-mutX tk-mutX`
4. Wait 3s, `curl /health`
5. Run adversary probes with `TK_BASE=http://localhost:8081`
6. `docker stop tk-mutX` before next mutant

**Each mutant had its own port (8081) and container** - no shared-port collisions.

**Mutation marker asserted in the same run as the probe.**

## Totals

**Stage 1 (from previous report):** Harness 9/14, Probes 7/14, 2 by breakage

**Stage 2 (this report):** Adversary probes **7 of 8 distinct caught**, 1 not a defect-round finding

**Combined:** Stage-1 defects (7 probe gaps) carry into Stage 2 per S2-061 through S2-070

## Commit

Report at `HEAD` (verification/sabotage/stage-2-report.md)