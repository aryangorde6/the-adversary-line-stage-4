# Stage-2 acceptance at `8aa02aa553cbdf7949e01a3a98926d4bb9b2058d`

Verdict: **BLOCKED** on one row. S2-043 is fixed and the fix is verified with the set assertion
extended over every state the run can reach. The focus half of S2-042 is **still red**, measured
rather than argued, and a screenshot at the failing stop settles what the computed style could not.

## The sanctioned command

Clean clone at `8aa02aa` in `/tmp/check-8aa02aa`, built and started as `stage-2/RUN.md` says.

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

Highest contiguous stage: **2**.

## My probes

| probe | result |
|---|---|
| `states_set.py` | **11 / 11** — eight states, eight distinct triples |
| `closed_day.py` | **26 / 26** — including the short-window closed day |
| `presence.py` | **7 / 7** |
| `inert_and_widths.py` | **10 / 10** |
| `out_of_order_lost.py` | **12 / 12** |
| `contrast_focus.py` | **15 / 17** at 375 and again at 1280 — contrast 8/8, focus 6/8 |

## S2-043, verified — and extended past the seven

    available    rgb(227, 242, 233) | rgb(31, 107, 69)  | rgb(169, 211, 187)
    unavailable  rgb(255, 255, 255) | rgb(111, 95, 78) | rgb(227, 215, 198)
    selected     rgb(246, 231, 220) | rgb(140, 59, 18) | rgb(140, 59, 18)
    loading      rgb(255, 255, 255) | rgb(111, 95, 78) | rgb(217, 184, 156)
    in_flight    rgb(140,  59,  18) | rgb(255, 255, 255)| rgb(140,  59,  18)
    confirmation rgb(253, 250, 245) | rgb( 43,  33,  24)| rgb( 43,  33,  24)
    error        rgb(251, 233, 229) | rgb(154,  44,  28)| rgb(232, 195, 186)
    uncertain    rgb(253, 241, 218) | rgb(138,  90,   6)| rgb(236, 214, 164)

    8 states observed, 8 distinct triples

`empty` is read on load and `loading` while a search is held open at the proxy, so the set is over
**every** state the run reaches rather than the seven the requirement names. The eighth collision
the Finisher found (`loading` and `empty`) is resolved: the waiting notice is a dashed outline on
white, the settled one filled.

## Taken and chosen, on both channels

    taken cell  slot-t_1-00:00      disabled=true  aria-disabled="true"  label "Table Window at 00:00, taken"
    free  cell  slot-t_3-00:00      disabled=false aria-disabled=null    label "Table Garden at 00:00, free"

The ARIA channel separates them and the accessible name separates them, so "taken" and "chosen" do
not rely on colour alone. One correction to my own row: I first asserted that the *text inside* the
cell differs, and `textContent` is empty for both by design — the tick and the filled diamond are
painted, not typed. That row read as a red against a product that names the state twice over, and it
now asserts the accessible name, which is the channel that carries it.

## S2-042, focus half — still red, and now settled by measurement

37 tab stops on `/` at both 375 and 1280, signed in and signed out. Three of them have no visible
focus indicator, all three on `date-input`. The other three routes are clean.

The cause is now determinate from the outside, and it is not the one the stylesheet can reach:

    stop 6  date-input  matches(':focus') true   outline solid 3px rgb(140, 59, 18)  offset 1px
    stop 7  date-input  matches(':focus') true   outline solid 3px rgb(140, 59, 18)  offset 1px
    stop 8  date-input  matches(':focus') true   outline solid 3px rgb(140, 59, 18)  offset 1px
    stop 9  date-input  matches(':focus') FALSE  outline none                        offset 0px

`document.activeElement` **is** the date input and there is exactly one such element on the page, yet
`:focus` does not match it at that stop. So `input:focus { outline: 3px solid … }` cannot paint
there: the rule does not apply because the selector does not match. This is Chromium's own handling
of an inner segment of a native `input[type=date]`, and no `:focus` or `:focus-visible` rule can cover
it.

A screenshot of the field at each stop settles what computed style alone left open. At stops 6-8 the
field carries a warm 1px border, a 3px ring and a highlighted segment. At stop 9 there is **no ring,
no border change and no segment highlight** — the field is painted exactly as an unfocused field.
So a keyboard user loses the indication entirely at that stop. That is the row's requirement
("keyboard focus must be apparent") failing on measurement, and per the standing ruling it becomes a
defect now rather than a candidate.

Product-side options, for whoever takes it: stop using a native `input[type=date]` for this field,
or drive the affordance from a `focus`/`focusin` listener on a wrapper rather than from a `:focus`
selector. I am not prescribing which — I can only say the selector route is closed, because the
selector does not match.

## Everything else, re-measured at this hash

- **Closed day**, signed in and out: grid absent from the document, `no-slots` present and visible,
  `booking-form` absent, text says **closed** and names Tuesday 8 December 2026. The **short-window**
  day is still covered: reset 204, `slots` length 0, same four values, same sentence.
- **Open day on load**: grid present and visible with non-empty empty-state text, `no-slots` absent.
- **Fully-booked day**: 90 cells, all 90 `data-available="false"`, `no-slots` absent.
- **Presence containers**: `booking-form` and `confirmation` absent on load signed in and out; the
  form is built when a table is chosen and taken out when a search abandons the attempt;
  `reservation-detail` absent until there is one.
- **Inertness**: an unavailable cell is `disabled` with `aria-disabled="true"`; a scripted click
  opens nothing and leaves the grid byte-identical.
- **Out-of-order**: after the late first response the grid shows 45 of the second search's cells and
  the date field shows the second search's date; the region stays present and visible in flight.
- **Lost response / retry / refusal**: uncertain message with the booking committed server-side, the
  retry carrying the same key and a byte-identical body and showing the original reference with
  exactly one reservation, and a refusal showing `booking-error` alone.
- **Contrast**: 12-17 text nodes per route, four routes, both sign-in states, lowest **5.08:1**.
- **No sideways scrolling** at 375 and 1280 on all four routes.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-8aa02aa
    cd /tmp/check-8aa02aa && git checkout -q 8aa02aa && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2g -e PORT=8080 -p 8085:8080 tablekeeper
    for p in states_set closed_day presence inert_and_widths out_of_order_lost contrast_focus; do
      BASE=http://127.0.0.1:8085 python verification/probes/s2/$p.py
    done
