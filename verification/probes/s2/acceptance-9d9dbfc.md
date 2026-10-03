# Stage-2 acceptance at `9d9dbfc2e10b1080f3342735d2d83def17ac6600` (product change; supersedes `e0e10eb`)

Verdict: **PASS.** The product change is one rule replacing two, measured as one rule. Every row I
hold is green at both widths.

## Hash discipline, from the diff

    git diff e0e10eb 9d9dbfc
      stage-2/src/ui/client.js                          |   9 +-      <- the product change
      stage-2/verification-probes/ui-states-a11y.mjs     |  88 ++---   <- rows
      verification/probes/s2/…                          | my own probes

The product change is nine lines: the `clearDateRing` handler and its two registrations
(`window blur`, `pagehide`) are **removed**, leaving `syncDateRing` — recompute from
`dateField.contains(document.activeElement)` — plus the existing poll. So `9d9dbfc` is product and
the change is behaviour only, consistent with `/` serving 9917 bytes byte-identical across four
hashes.

## The sanctioned command

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

## My probes, both widths

| probe | 375 | 1280 |
|---|---|---|
| `focus_single_rule.py` (new) | 9/9 | 9/9 |
| `focus_lifecycle.py` | 46/46 | 46/46 |
| `focus_reentry.py` | 16/16 | 16/16 |
| `contrast_focus.py` | 17/17 | 17/17 |
| `states_set.py` | 11/11 | 11/11 |
| `closed_day.py` | 26/26 | 26/26 |
| `presence.py` | 7/7 | 7/7 |
| `inert_and_widths.py` | 10/10 | 10/10 |
| `out_of_order_lost.py` | 12/12 | 12/12 |
| `judgment_rows.py` | 11/11 | 11/11 |

## One rule, not two — the trace that distinguishes them

**20 samples at 5ms, starting the instant `blur` is dispatched with the keyboard inside the field:
present at 20 of 20, painted at 20 of 20.** No sample where the indicator is absent, so there is no
window in which it is cleared and put back. A clear-then-restore design cannot produce that trace,
which is why I assert it this way rather than as a latency: a sampling row can hold "no flicker" and a
number cannot.

**Containment as a single rule, both directions.** All four internal stops hold the indicator,
including the `:focus`-mismatched one (`inside=true, painted=true` where `isFocus=false`), and once
focus moves to another control it is gone in **3ms**.

**The poll is inert for every arrival that fires an event.** With `setInterval` stubbed to a no-op
before any page script runs and the handlers untouched: a real click arrival and a keyboard arrival
both leave the ring painted at **every observed internal stop**, the `:focus`-mismatched one included.
`Shift+Tab` backwards from the search button reaches the field after **2 presses** — reachable with no
pointer event at all, which is the arrival a poll could be hiding.

**And load-bearing for exactly one arrival**, which my own probe does *not* establish and says so: a
programmatic `blur()` then `focus()` fires `focus` and `focusin` **even from script** — measured, not
assumed — so it is not the event-free path at all. The genuinely event-free arrival is focus
returning to a field the document already considers focused, and **that measurement is the
Builder's**, driven with its own construction and the poll stubbed. My row reports what it can see
and explicitly does not claim that path.

## Bounds, measured, and which path each applies to

| path | measured |
|---|---|
| focus moving to another control | 3–7ms |
| a real (trusted) mouse click elsewhere | 3–9ms |
| a programmatic `.blur()` | 334–341ms |
| silent return tracked again | 7–10ms on the event path |

## Four faults of my own, one of them the stale-probe fault in its purest form

1. **`focus_lifecycle.py` asserted the pre-ruling semantics.** Its `window blur` and `pagehide` rows
   demanded that a dispatched exit clear the indicator, and at `9d9dbfc` they reported **four false
   reds** against the accepted containment semantics. This is the stale-probe fault — an instrument
   looking at the wrong thing reports a false red or a false green depending only on which way the
   change went — and it is the first time it has bitten me on a change that was *correct*. Both rows
   now assert the settled semantics: the indicator **stays** while the keyboard is inside, and is
   **gone** once focus genuinely leaves.
2. **A synthetic `element.click()` used as a "real click".** It fires no `pointerdown`, so it timed
   the poll rather than the event path — 1603ms, which I read as a stuck ring for a moment. The row
   now uses a trusted Playwright click.
3. **`Shift+Tab` assumed to reach the field in one press.** It takes two, because `party-size-input`
   sits between the search button and the field. A row that hard-coded one press reported a red
   against a field that was perfectly reachable.
4. **The bounds loop timed a teardown it had not set up.** A walk that failed to re-enter the field
   left the previous case's ring standing, and I timed its removal. The precondition is now asserted
   before the measurement — clause 2, in a place I had not thought to apply it.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-9d9dbfc
    cd /tmp/check-9d9dbfc && git checkout -q 9d9dbfc && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2k -e PORT=8080 -p 8089:8080 tablekeeper
    for p in focus_single_rule focus_lifecycle focus_reentry contrast_focus states_set closed_day \
             presence inert_and_widths out_of_order_lost judgment_rows; do
      for w in 375 1280; do BASE=http://127.0.0.1:8089 W=$w python verification/probes/s2/$p.py; done
    done
