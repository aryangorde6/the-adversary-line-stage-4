# Stage-2 acceptance at `6f056f4d2af5cd1f0a3c4d6fc34871674271635d`

Verdict: **BLOCKED**, on two rows that are both pre-existing at `bacee63` and neither of which is
in the Finisher's path. Everything the fix claimed is reproduced. The supplied suite is fully
green: **stage 1 120/120, stage 2 25/25, highest contiguous stage 2.**

## The sanctioned command

Clean clone at `6f056f4` in `/tmp/check-6f056f4`, built and started as `stage-2/RUN.md` says.
`GET /health` -> `{"status":"ok"}`, `GET /` -> 200, 8402 bytes.

    cd /home/aryan/band_hack/dark-factory-wearedevs
    .venv/bin/python -m harness run --track tablekeeper --repo /tmp/check-6f056f4 \
      --stage 2 --mode isolated \
      --out /home/aryan/band_hack/band-work/checks/tablekeeper5/s2-accept-6f056f4

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

## Every claim in the handoff, reproduced

### Closed day, both halves, and the sentence — `closed_day.py`, 26/26

Signed out and signed in, every weekday except the booking day's, searched `2026-12-08`, `slots`
length read directly from `/availability` and printed in every row:

    availability-grid in document = False        (absent, not hidden)
    no-slots present=True visible=True
    text = "Zum Anker is closed on Tuesday 8 December 2026, so there is nothing to book that day.
             Try another date, or a smaller party on a day it is open."
    names the day as a person reads it = True
    booking-form in document = False

**The claim that a short opening window cannot be arranged is false at this hash.** Reported:
"an opening window shorter than the reservation duration is rejected by `POST /_test/reset` with
400, so it can never be shown." Measured: `opens 18:00`, `closes 18:30` against a 90-minute
reservation -> **reset 204**, and `/availability` returns **`slots` length 0**. So it is a second
closed day, not an impossible state, and the row now covers it as one: same four values, same
sentence, both sign-in states. This *adds* a case rather than removing a row, and it is the
fourth time a reported measurement has turned out to be about the check rather than the build.

### Open day on load, and a fully-booked day — same probe

Signed in and out: `availability-grid` present and visible with non-empty empty-state text and
`no-slots` absent. A day tiled with 24 legal reservations (singles and the declared pair only; a
set of three is refused by the fixture, so it can never be seeded) renders **90 cells, all 90
`data-available="false"`**, and `no-slots` is absent from the document. The blocking item is not
regressed.

### Presence, not visibility, for all three containers — `presence.py`, 7/7

    signed out on load      booking-form False   confirmation False
    signed in on load       booking-form False   confirmation False
    after choosing a table  booking-form True    confirmation False
    after a new search      booking-form False   (an abandoned attempt is taken out)
    /lookup before search   reservation-detail False
    /lookup after search    reservation-detail True

### The booking path is alive end to end — `presence.py`

Driven, not inferred from rows passing: choose a free cell, submit, and the confirmation shows
`1NR7M5AT`; `GET /reservations/1NR7M5AT` returns that reference with `status: confirmed`. The
stale-`hide(confirmation)` regression the Finisher caught in its own first fix build is not
present here, and the booking flow is not merely "not throwing" — it commits and reads back.

### An unavailable cell is genuinely inert — `inert_and_widths.py`

    data-available='false'  disabled=True  aria-disabled='true'  tag=BUTTON

`el.click()` from script opens nothing and leaves the grid byte-identical. `aria-disabled` is
present, which is what a keyboard or assistive-technology user meets, so this is inertness and not
merely a removed listener.

### Out-of-order, lost response, retry, refusal — `out_of_order_lost.py`, 12/12

Search A delayed 2s behind search B: after A lands late the grid shows **45 of B's cells** and the
date field shows B's date — B positively asserted, not merely "A absent", since a grid emptied by
the late response would satisfy the weaker row. The results region stays present and visible
**while a search is in flight**, which is the case the Finisher flagged as newly changed.
Lost response: `booking-uncertain` visible with non-empty text, no `booking-error`, no
`confirmation`, and the booking **did** commit (shape asserted before the count). Retry: one
request, same key, byte-identical body, both message elements gone, the original reference, and
exactly one reservation at that slot before and after. Refusal: `booking-error` visible and
non-empty with `booking-uncertain` and `confirmation` absent.

### Contrast and focus, and the seven states

Text contrast, resolved against the first non-transparent **ancestor**: 12-17 text nodes per
route, four routes, signed in and out, lowest **5.08:1** — above AA everywhere. No sideways
scrolling: `scrollWidth <= innerWidth` on all four routes at 375 and 1280, signed in and out.

## The two failing rows

### S2-043 — `selected` and `available` are the same triple

    available    rgb(227, 242, 233) | rgb(31, 107, 69)  | rgb(169, 211, 187)
    selected     rgb(227, 242, 233) | rgb(31, 107, 69)  | rgb(169, 211, 187)
    unavailable  rgb(255, 255, 255) | rgb(111, 95, 78) | rgb(227, 215, 198)
    in_flight    rgb(140,  59,  18) | rgb(255, 255, 255)| rgb(140,  59,  18)
    confirmation rgb(253, 250, 245) | rgb( 43,  33,  24)| rgb( 43,  33,  24)
    error        rgb(251, 233, 229) | rgb(154,  44,  28)| rgb(232, 195, 186)
    uncertain    rgb(253, 241, 218) | rgb(138,  90,   6)| rgb(236, 214, 164)

    7 of 7 states observed, 6 distinct triples

Requirement: "Available, unavailable, selected, loading, successful, refused and uncertain states
must be visually distinct." Six distinct triples out of seven. Unchanged from `bacee63`, so not a
regression from the fix — it was red before the fix and is red after it.

### S2-042, focus half — the date input loses its ring

37 tab stops on `/`, 3 of them with no visible focus indicator, all three on `date-input`, whose
computed outline is `none` at those stops and `solid 3px rgb(140, 59, 18)` at the other three.
The other three routes are clean at 35-37 stops each, signed in and out.

Stated as a candidate rather than a verdict, for the reason given last time and unchanged: I cannot
tell from outside whether the cause is the stylesheet using `:focus-visible` where `:focus` is
needed, or Chromium's own handling of the inner segments of `input[type=date]`. What is certain is
that at three of the stops a keyboard user has no visible indication of where they are, which is
the property the row asks for. It is also unchanged from `bacee63`.

## Two of my own instruments were wrong again, and both produced confident reds

1. **`OL-order-shows-b`** asserted that B's date appears in the grid's HTML. A cell testid carries
   the table and the **time**, not the date, so the string is not there by design and the row read
   as a failure while 45 of B's cells were on screen. Rewritten to assert B's cells and the date
   field — what the page actually shows.
2. **`CD-unarrangeable`** asserted the reported claim that a short opening window is refused at
   reset. It is not refused, so the row asserted a claim rather than a requirement. Rewritten to
   measure the arrangement and cover it.

Neither is a product defect. Both are the fourth and fifth instances of the same rule, and the
second one is the clearest case yet of a row that would have shipped a false red into a verdict.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-6f056f4
    cd /tmp/check-6f056f4 && git checkout -q 6f056f4 && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2f -e PORT=8080 -p 8084:8080 tablekeeper
    for p in closed_day presence inert_and_widths out_of_order_lost states_set contrast_focus; do
      BASE=http://127.0.0.1:8084 python verification/probes/s2/$p.py
    done
