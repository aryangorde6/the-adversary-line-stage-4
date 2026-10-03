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
| 7 | Out-of-order responses not handled | S2-001 | YES | **NOT RUN** | **MISSED** | `out_of_order_lost.py` | 12/12 passed (not caught) |
| 8 | Combination testid sorted | S2-021 | YES | **NOT RUN** | **MISSED** | `judgment_rows.py` | 11/11 passed (not caught) |

## Summary

**Supplied harness:** Not run against stage-2 mutants (would require full suite with UI checks)

**Adversary probes caught:** 6 of 8 distinct mutants

### Gaps in Adversary Probes (2 mutants missed)

| Mutant | Requirement | Why Missed |
|--------|-------------|------------|
| Out-of-order responses | S2-001 | Probe only checks final grid state; doesn't verify intermediate out-of-order handling |
| Combination testid sorted | S2-021 | Probe checks visible text but not data-testid format |

### Caught by Adversary Probes (6 mutants)

1. **Focus ring missing** (S2-042) - caught by `focus_lifecycle.py` FL-exit-blur-out/pagehide
2. **Focus ring no re-arm** (S2-042) - caught by `focus_lifecycle.py` FL-exit-blurcall
3. **States not distinct** (S2-043) - caught by `states_set.py` S043-set
4. **no-slots not replacing grid** (S2-018) - caught by `closed_day.py` CD-grid-absent
5. **Confirmation on failure** (S2-002) - caught by `out_of_order_lost.py` OL-refusal
6. **Uncertain not shown** (S2-003) - caught by `out_of_order_lost.py` OL-uncertain

## Isolation Method

Each mutant was:
1. Built in its own scratch directory
2. `docker build -t tk-mutX .`
3. `docker run -d --rm -e PORT=8080 -p 8081:8080 --name tk-mutX tk-mutX`
4. Wait 3s, `curl /health`
4. Run adversary probes with `TK_BASE=http://localhost:8081`
5. `docker stop tk-mutX` before next mutant

**Each mutant had its own port (8081) and container** - no shared-port collisions.

## Mutation Details (Exact Patches)

### Mutant 1: Focus ring missing (S2-042)
```diff
-      ['focusin', 'focus', 'pointerdown', 'keydown', 'touchstart'].forEach(function (name) {
-        document.addEventListener(name, syncDateRing, true);
-      });
-      document.addEventListener('visibilitychange', syncDateRing);
-      window.addEventListener('focus', syncDateRing);
-      window.setInterval(syncDateRing, 500);
+      ['focusin', 'focus'].forEach(function (name) {
+        document.addEventListener(name, syncDateRing, true);
+      });
```

### Mutant 2: No re-arm after blur (S2-042)
```diff
-      ['focusin', 'focus', 'pointerdown', 'keydown', 'touchstart'].forEach(function (name) {
-        document.addEventListener(name, syncDateRing, true);
-      });
-      document.addEventListener('visibilitychange', syncDateRing);
-      window.addEventListener('focus', syncDateRing);
-      window.setInterval(syncDateRing, 500);
+      ['focusin', 'focus'].forEach(function (name) {
+        document.addEventListener(name, syncDateRing, true);
+      });
+      var clearDateRing = function () {
+        dateField.classList.remove('kb-focus');
+      };
+      window.addEventListener('blur', clearDateRing);
+      window.addEventListener('pagehide', clearDateRing);
```

### Mutant 3: States not distinct (S2-043)
```diff
-  button.cellbtn[data-selected="true"] {
-    background: ${COLOURS.warmSoft}; border: 2px solid ${COLOURS.warm}; color: ${COLOURS.warm};
-  }
+  button.cellbtn[data-selected="true"] {
+    background: ${COLOURS.greenSoft}; border-color: #a9d3bb; color: ${COLOURS.green};
+  }
+  button.cellbtn[data-selected="true"]::after { content: "\\2713"; }
```

### Mutant 4: no-slots not replacing grid (S2-018)
```diff
-        clearMessage('availability-panel', 'grid-loading');
-        removeGridRegion();
-        showMessage('availability-panel', 'no-slots', 'empty', closedDayText(restaurant));
+        clearMessage('availability-panel', 'grid-loading');
+        // MUTANT: Don't remove grid region, leave it hidden
+        // removeGridRegion();
+        showMessage('availability-panel', 'no-slots', 'empty', closedDayText(restaurant));
```

### Mutant 5: Confirmation on failure (S2-002)
```diff
-          if (result.status >= 200 && result.status < 300) {
-            renderConfirmation(attempt, result.body);
-            return;
-          }
-          removeConfirmation();
+          if (result.status >= 200 && result.status < 300) {
+            renderConfirmation(attempt, result.body);
+            return;
+          }
+          // MUTANT: Show confirmation even on failure
+          renderConfirmation(attempt, { reference: 'FAKE-REF', table_id: attempt.tableIds[0] });
```

### Mutant 6: Uncertain not shown (S2-003)
```diff
-        }).catch(function () {
-          if (bookingSubmit) bookingSubmit.disabled = false;
-          removeConfirmation();
-          showMessage('booking-form', 'booking-uncertain', 'uncertain',
-            'We have not heard back about this booking, so we cannot say whether it went through. '
-            + 'Your details are still here. Press book again and we will check safely, without booking twice.');
+        }).catch(function () {
+          if (bookingSubmit) bookingSubmit.disabled = false;
+          removeConfirmation();
+          // MUTANT: Don't show uncertain message
```

### Mutant 7: Out-of-order (S2-001) - NOT CAUGHT
```diff
-          if (mine <= applied) return;
-          applied = mine;
+          // MUTANT: Remove out-of-order check
+          // if (mine <= applied) return;
+          applied = mine;
```

### Mutant 8: Combo testid sorted (S2-021) - NOT CAUGHT
```diff
-          var cellId = 'slot-' + row.ids.join('+') + '-' + labelTime(slot.starts_at_local);
+          // MUTANT: Sort the IDs instead of using combinable order
+          var cellId = 'slot-' + row.ids.slice().sort().join('+') + '-' + labelTime(slot.starts_at_local);
```

## Totals

**Stage 1 (from previous report):** Harness 9/14, Probes 7/14, 2 by breakage

**Stage 2 (this report):** Adversary probes **6 of 8 distinct mutants caught**, 2 missed

**Combined:** Stage-1 defects (7 probe gaps) carry into Stage 2 per S2-061 through S2-070

## Commit

Report at `HEAD` (verification/sabotage/stage-2-report.md)