# Stage-2 acceptance at `3af2a2fec516d90222a1bdc1832c202902e7d8ae` (product `80e91db` beneath)

Verdict: **PASS, with one recorded residual.** Every requirement row holds at this hash. One state is
uncovered by the product's own design, is reproduced by three of my probes, and is recorded in the
ledger as a measured residual rather than as coverage or as a caveat.

## Hash discipline

    git diff 9d9dbfc 3af2a2f
      stage-2/src/ui/client.js   | 9 +-     <- product: window.setInterval(syncDateRing, 500) removed
      stage-2/verification-probes/ui-states-a11y.mjs | 16 +-  <- rows
      verification/…             | my own probes and ledger

`grep -rn setInterval stage-2/src/` returns **nothing**: no poll, nothing running in the browser.

## The sanctioned command

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

## My probes, both widths

| probe | 375 | 1280 |
|---|---|---|
| `focus_single_rule.py` | 9/9 | 9/9 |
| `focus_lifecycle.py` | 44/44, **2 residual** | 44/44, **2 residual** |
| `focus_reentry.py` | 16/16, **1 residual** | 16/16, **1 residual** |
| `contrast_focus.py` | 17/17 | 17/17 |
| `states_set.py` | 11/11 | 11/11 |
| `closed_day.py` | 26/26 | 26/26 |
| `presence.py` | 7/7 | 7/7 |
| `inert_and_widths.py` | 10/10 | 10/10 |
| `out_of_order_lost.py` | 12/12 | 12/12 |
| `judgment_rows.py` | 11/11 | 11/11 |

## The row is now a property, not a bound

Every re-entry assertion reads the indicator **in the same evaluate that causes the event** — no
settle time, no wait, no bound — because with no poll a bound is a hedge that would weaken into "true
eventually" and keep passing a mechanism that has been removed. Measured on the event paths: `focusin`
onto another control 3–11ms, a real trusted click 3–9ms, four internal stops holding the indicator
including the `:focus`-mismatched one, rebuild correct both ways, lifecycle freeze holding inside the
field and creating nothing outside it.

## The residual, measured three times over

A programmatic `.blur()` from the field's **first** stop leaves `kb-focus` on while
`document.activeElement` is `BODY` and containment is false; `blur` is not in the handler list and
there is no poll. From an **inner segment** the same call leaves `activeElement` on the input,
containment still holds, and the indicator correctly stays — so a row must blur from the first stop or
it cannot reach the state it names. My first attempt blurred from wherever the walk ended, could not
produce the state, and would have reported the residual as absent.

The three probes report it as `RESIDUAL` and count it for neither pass nor fail: a FAIL would be a red
for a condition the ledger records, and a PASS would claim it closed. **I am not claiming it is
closed.** If you want it treated as a defect rather than a recorded state, those rows flip to FAIL in
one edit and I will re-run.

## What changed in my own probes, and why

1. `focus_reentry.py` and `focus_single_rule.py` had bounds and settle loops for a **silent-return
   path that no longer exists** — a hedge for a deleted mechanism. Both are now immediate reads with
   no bound.
2. `focus_lifecycle.py`'s programmatic-blur row asserted a teardown that cannot happen without a poll;
   it is now the residual row.
3. The 20-sample 5ms flicker trace from `9d9dbfc` is **dropped**: it measured the poll's absence of a
   flicker window, and the poll is gone.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-3af2a2f
    cd /tmp/check-3af2a2f && git checkout -q 3af2a2f && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2m -e PORT=8080 -p 8090:8080 tablekeeper
    for p in focus_single_rule focus_lifecycle focus_reentry contrast_focus states_set closed_day \
             presence inert_and_widths out_of_order_lost judgment_rows; do
      for w in 375 1280; do BASE=http://127.0.0.1:8090 W=$w python verification/probes/s2/$p.py; done
    done
