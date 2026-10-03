# Stage-2 acceptance at `e0e10ebea1704701d9d9d2287c833c3adfcef281` (product `e8bcdac` beneath)

Verdict: **PASS.** The `372e879` red is fixed and the fix is verified per stop, per exit, in both
directions, at 375 and 1280. Everything green at `372e879` is still green.

**Hash discipline first, as asked:** `git diff e8bcdac e0e10eb` touches exactly one file,
`stage-2/verification-probes/ui-states-a11y.mjs` (+44 lines). No product change, so `e0e10eb` adds
rows and `e8bcdac` is the product graded — measured, not assumed.

## The sanctioned command

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

Highest contiguous stage: **2**. `/` 200 in 9917 bytes.

## My probes at this hash

| probe | 375 | 1280 |
|---|---|---|
| `focus_reentry.py` (new, 16 rows) | 16/16 | 16/16 |
| `focus_lifecycle.py` | 42/42 | 42/42 |
| `contrast_focus.py` | 17/17 | 17/17 |
| `states_set.py` | 11/11 | 11/11 |
| `closed_day.py` | 26/26 | 26/26 |
| `presence.py` | 7/7 | 7/7 |
| `inert_and_widths.py` | 10/10 | 10/10 |
| `out_of_order_lost.py` | 12/12 | 12/12 |
| `judgment_rows.py` | 11/11 | 11/11 |

## The `372e879` red, closed: the ring comes back

For each of the two exits that fire without a focus event, at each width:

| after | class at the 4 internal stops, before | off after the exit | inner-segment ring after a real click back in | after a **silent** re-entry |
|---|---|---|---|---|
| `window` blur | 4 of 4 held | absent | **painted, 3px `rgb(140, 59, 18)`, 7–10ms** | **painted, 45–77ms** |
| `pagehide` | 4 of 4 held | absent | **painted, 3px, 8–10ms** | **painted, 45–83ms** |

`painted`, not merely the class, at the stop where `matches(':focus')` is **false** — the only thing
that can paint there. That row was `none` in all four combinations at `372e879`.

**No premature teardown, asserted in the same breath as each exit:** the class is held at all four
internal stops before the exit fires, including the `:focus`-mismatched one, at both widths. The new
mechanism's claim — that it recomputes from containment rather than from events, so the `focusin`s
fired *between* inner segments cannot clear it — is tested rather than accepted: all four stops hold.

**The Builder's table reproduced as fixed**, and I drove it in my own direction too: focus, exit,
silent re-entry with `element.focus()`, then walk to the inner segment.

## The two questions about the poll, answered

1. **Does it cost anything?** Idle for 2.2s with focus outside the field: **0 DOM mutations** observed
   by a `MutationObserver` across four ticks, and no class present. It reads state; it does not
   accumulate it. A real click re-entry is served in **3–10ms**, so ordinary interaction is on the
   event path and never waits for the tick. Two full navigations leave **no residue**, and **zero page
   errors** across every run.
2. **Is it load-bearing, or an accommodation for the probe?** **Load-bearing, and for a real reason.**
   The silent return is the only path no handler can catch: `element.focus()` fires nothing. Measured
   at 45–83ms — under one 500ms tick, which is consistent with the tick doing exactly that work and
   nothing else. Recorded as part of the design.

**Not measurable in this harness, and recorded as such rather than as coverage:** a real OS-level
window switch. Headless Chromium has no window manager, so `window` blur and `pagehide` are driven
through dispatched events on the same handlers, not through a genuine window transition. That limit
is the Builder's to have named, and its work in reaching those paths is what found the `372e879`
defect in the first place.

## Teardown latency, which is a property of the design and not of the probe

Recomputed rather than stored, so a teardown is not instantaneous — and my fixed 250ms waits were
shorter than the recompute, which is why I first saw two reds here:

| exit | cleared in |
|---|---|
| `focusin` onto another control | 1–4ms |
| `window` blur | 3–4ms |
| `pagehide` | 1–4ms |
| real mouse click elsewhere | 4–14ms |
| programmatic `.blur()` | **229–283ms** |

Every path clears well inside a second; the programmatic blur is the slowest, which is consistent
with it being the one that fires no handler the mechanism listens to and therefore waiting on the
tick. That is the design working as described, and it is why the rows now poll to a deadline and
record the latency.

## Two of my own rows were wrong again, in the same two directions

1. **A dispatched exit with the keyboard still inside the field.** My first form asserted that
   dispatching `blur` clears the indicator. It does not — and it should not, because the keyboard has
   not left. The row now asserts both halves: the indicator **stays** while the focus is genuinely
   inside and is **gone** once it has left. This is the second time tonight a *correct* result read as
   a failure, and the tell is the same both times: a correct ring reading as a stuck one.
2. **Fixed waits shorter than the recompute**, described above.

I count those as one fault with two faces, and it is the same class as the one the room found at
`372e879`: I asserted a mechanism when the requirement is a behaviour. A dispatched event is a proxy
for "the keyboard left"; the keyboard leaving is the requirement.

## Everything else, re-measured

- **Closed day**, signed in and out, region out of the document, `no-slots` visible, sentence says
  closed and names the day; **short window** covered with reset asserted 204 first and `slots` read
  from the service before the screen.
- **Open day on load**: grid visible, non-empty empty-state text, `no-slots` absent.
- **Fully-booked day**: every cell `data-available="false"`, no message.
- **The three containers** absent in every state where they should not be; the form is built on
  choosing a table and removed when a search abandons the attempt; `reservation-detail` absent until
  there is one.
- **Taken against chosen** distinguishable on colour, on `disabled`/`aria-disabled`, and on the
  accessible name.
- **States set**: eight observed, eight distinct triples, including `loading` against `empty`.
- **Out-of-order**: 45 of the second search's cells and its date asserted positively after the late
  first response lands; region present and visible in flight.
- **Lost response, retry, refusal**: uncertain message with the booking committed server-side; retry
  with the same key and a byte-identical body showing the original reference and exactly one
  reservation; refusal showing `booking-error` alone.
- **Contrast** lowest 5.08:1; **no sideways scrolling** at either width; **1 press from a focused
  search button to the first free table**, **zero unavailable cells in the tab order**.
- **Judgment rows**: no raw `t_`/`r_` identifier in visible text on any route; a pair booking reads
  `Window and Corner · Tuesday 8 December 2026 at 00:00`, with no `+` and no "combined"; no word
  explaining how the system works in diner-facing text.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-e0e10eb
    cd /tmp/check-e0e10eb && git checkout -q e0e10eb && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2j -e PORT=8080 -p 8088:8080 tablekeeper
    for p in focus_reentry focus_lifecycle contrast_focus states_set closed_day presence \
             inert_and_widths out_of_order_lost judgment_rows; do
      for w in 375 1280; do BASE=http://127.0.0.1:8088 W=$w python verification/probes/s2/$p.py; done
    done
