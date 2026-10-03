# Stage-2 acceptance at `389bbe42aad5afb8e5a826ccb34fcac24a056eb3` (product identical to `8aa02aa`)

Verdict: **BLOCKED** on one row, unchanged from `8aa02aa` and for the same reason: the focus half of
S2-042. Everything else is green, including two concerns raised just before this run that I measured
rather than accepted.

Both hashes are named because the product is the same product: `git diff 8aa02aa 389bbe4` touches
only `stage-2/verification-probes/ui-grid.mjs`, `ui-lib.mjs` and my own `states_set.py`. Nothing under
`stage-2/src/` differs, so the verdict for the product is the verdict for `8aa02aa`.

## The sanctioned command

Clean clone at `389bbe4` in `/tmp/check-389bbe4`, built and started as `stage-2/RUN.md` says.

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

Highest contiguous stage: **2**.

## My probes

| probe | result |
|---|---|
| `states_set.py` | **11 / 11** — eight states, eight distinct triples |
| `closed_day.py` | **26 / 26**, short window included |
| `presence.py` | **7 / 7** |
| `inert_and_widths.py` | **10 / 10** |
| `out_of_order_lost.py` | **12 / 12** |
| `contrast_focus.py` | **15 / 17** — contrast 8/8, focus 6/8 |

## The failing row, unchanged

37 tab stops on `/`, three of them with no visible focus indicator, all three on `date-input`, where
`document.activeElement` is the date input, exactly one such element exists, it is visible, and
`matches(':focus')` is **false**. So `input:focus { outline: 3px solid … }` cannot paint at that stop
because the selector does not match. The per-stop reading and both screenshots are in
`acceptance-8aa02aa.md` and `verification/screens/8aa02aa/`; nothing about it moved, because nothing
under `src/` moved.

## The two concerns about my focus rows producing a false green — both measured, neither reproduces

Reported: the grid cells compute `outline-style: none` with a green indicator, so (a) comparing the
ring against the parent would be the wrong comparison and (b) a green ring on a green cell carries two
meanings in one paint. Measured at this hash, on a focused **free** cell reached by real `Tab`
presses:

    slot-t_1-00:00  data-available="true"
    outline  solid 3px rgb(140, 59, 18)  offset 1px      <- brand brown, not green
    cell background   rgb(227, 242, 233)
    parent surface    rgb(255, 255, 255)
    ring vs the cell's own background   6.60:1
    ring vs the parent surface          7.64:1

1. **The comparison is the same one, and it does not matter here.** The cell's indicator is a 3px
   outline at `outline-offset: 1px`, i.e. drawn outside the cell's box, so clause 5 applies and the
   parent surface is the correct comparison — 7.64:1. Measured against the cell's own background it is
   6.60:1. Both are far above 3:1, so the row is not asserting a property of the wrong pair in a way
   that could change its verdict.
2. **There is no green-on-green.** The focused cell's ring is `rgb(140, 59, 18)`, the same brand brown
   the form controls use, not `rgb(31, 107, 69)`. So "focused" and "available" do not share a paint on
   a cell, and the S2-043 class of defect — two meanings in one colour — does not arise here.

My generic tab-walk already covered cells, because free cells are in the tab order: it reported no
cell failure at either hash. That is now explained rather than assumed, which is the difference
between a green row and a measured one.

## Re-verified, not re-read

Closed day signed in and out: results region out of the document, `no-slots` visible, sentence says
closed and names the day; **short window included** — `opening_hours` 18:00-18:30 on every weekday,
reset asserted 204 first, `slots` length 0 read from the service, then the screen. Open day on load:
grid visible, non-empty empty-state text, `no-slots` absent. Fully-booked day: 90 cells, all
`data-available="false"`, no message. Presence containers absent in every state where they should not
be. Unavailable cells `disabled` with `aria-disabled="true"`, inert to a scripted click. Out-of-order:
45 of the second search's cells and its date after the late first response lands, region present and
visible in flight. Lost response, retry with the same key and a byte-identical body showing the
original reference with exactly one reservation, refusal showing `booking-error` alone. Contrast
lowest 5.08:1 across four routes and both sign-in states. No sideways scrolling at 375 or 1280.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-389bbe4
    cd /tmp/check-389bbe4 && git checkout -q 389bbe4 && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2h -e PORT=8080 -p 8086:8080 tablekeeper
    for p in states_set closed_day presence inert_and_widths out_of_order_lost contrast_focus; do
      BASE=http://127.0.0.1:8086 python verification/probes/s2/$p.py
    done
