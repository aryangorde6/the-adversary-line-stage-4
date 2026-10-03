# Stage-2 acceptance at `f4fdcb014a67c8bf92d7807f62b9bdf20f60aac8` (product `ce26c84` beneath)

Verdict: **PASS.** The residual is closed by an event, with no timer, and the ledger is re-cut rather
than amended. No row is left as a hedge.

## Hash discipline

    git diff 3af2a2f f4fdcb0 -- stage-2/src
      stage-2/src/ui/client.js | 5 +-   <- product: 'focusout' added to the handler list

One line of substance: `['focusin', 'focusout', 'focus', 'pointerdown', 'keydown', 'touchstart']`.
`grep -rn "setInterval\|requestAnimationFrame" stage-2/src/` returns **nothing**.

## The sanctioned command

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

## My probes, both widths

| probe | 375 | 1280 |
|---|---|---|
| `focus_lifecycle.py` | 48/48, **0 residual** | 48/48, **0 residual** |
| `focus_reentry.py` | 17/17, **0 residual** | 17/17, **0 residual** |
| `focus_single_rule.py` | 9/9 | 9/9 |
| `contrast_focus.py` | 17/17 | 17/17 |
| `states_set.py` | 11/11 | 11/11 |
| `closed_day.py` | 26/26 | 26/26 |
| `presence.py` | 7/7 | 7/7 |
| `inert_and_widths.py` | 10/10 | 10/10 |
| `out_of_order_lost.py` | 12/12 | 12/12 |
| `judgment_rows.py` | 11/11 | 11/11 |

## The residual, closed and asserted as an ordinary row

A programmatic `.blur()` from the field's **first** stop, read in the **same evaluate** that causes
it: containment **false**, indicator **absent**, nothing painted. No wait, no bound, no residual class
— `focusout` is in the handler list and the row now asserts what the product does rather than
reporting a hole. Both probes that carried the residual print `0 residual`.

Two rows exist only because of what this hash changed:

- **one keystroke is not a departure.** One `Tab` from inside the field lands on `date-input` with the
  indicator still painted: the control holds four internal stops. A probe that pressed once and read
  would have measured the wrong thing.
- **read which element painted it.** After a `Tab` out, the *neighbouring* control's own ring is
  painted while the date field's is not. The rows read the carrier's class, and one asserts the
  distinction directly.

## The falsifiable number, re-measured

**All four internal date-field stops hold the indicator, and one of them does not match `:focus`.**
The earlier figure of "18 of 18, 4 mismatched" came from a walk that cycled the field repeatedly; the
count that means something is the number of stops the control actually has. It is recorded in that
form, and a change that removes the mismatched stop re-opens the row.

## Ledger re-cut, not amended

`ca80a95` described a 500ms poll. That mechanism does not exist, so the section was replaced rather
than edited: no timer, the containment row with `focusout` and the measurement that it fires exactly
once on the transition out and not between inner segments, the residual closed, the two unmeasurable
paths recorded as unreachable, and a new clause 10 — *removing a mechanism can uncover the defects it
was covering, and the removal is not finished until those are found* — because with the interval
present a `blur()`-only departure cleared within 500ms. The poll was repairing a missing departure
signal for as long as it existed.
