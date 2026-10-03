# Stage-2 acceptance run — commit bacee63928f60f570ae06de32f467c931dfabb3c

Verdict: **BLOCKED**. Three supplied stage-2 checks fail, and all three have the same cause, which
my own probes reproduce from the outside.

## What was graded

Clean clone of the result repository at `bacee63` (`/tmp/check-bacee63`), built and started exactly
as `stage-2/RUN.md` says (`docker build -t tablekeeper .` then `docker run -d --name adv-s2 -e
PORT=8080 -p 8081:8080`). `GET /health` returned `{"status":"ok"}` and `GET /` returned 200, so the
build starts.

Supplied checks, run only through the given command, isolated mode, fresh `--out`:

    cd /home/aryan/band_hack/dark-factory-wearedevs
    .venv/bin/python -m harness run --track tablekeeper --repo /tmp/check-bacee63 \
      --stage 2 --mode isolated \
      --out /home/aryan/band_hack/band-work/checks/tablekeeper5/s2-accept-bacee63

| suite | collected | passed | failed |
|---|---|---|---|
| stage 1 (regression) | 120 | 120 | 0 |
| stage 2 | 25 | 22 | 3 |

    FAILED stage_2/test_ui.py::test_closed_day_shows_no_slots
      Page.wait_for_selector: Timeout 10000ms exceeded, waiting for
      "[data-testid='availability-grid'], [data-testid='no-slots']"
    FAILED stage_2/test_ui.py::test_clicking_an_unavailable_cell_does_nothing
      AssertionError: an unavailable cell must not open the booking form
    FAILED stage_2/test_ui.py::test_booking_error_is_shown_when_the_booking_fails
      AssertionError: assert query_selector("[data-testid='confirmation']") is None

## The one cause behind all three, reproduced by my own probe

State containers stay in the document while their state does not exist. The removal ruling was
applied to the five message elements and never to the screens' own state containers, so
`booking-form`, `confirmation` and (on a no-slots day) `availability-grid` are present in the DOM
with their section hidden. A diner cannot see them; a `query_selector` finds them anyway.

My probe `probe2.py`, signed out, closed day, which is the case the first failure names:

    ROW Q-closed-signedout FAIL wait timed out=True ; no-slots present=True visible=True ;
        grid present=True visible=False

`no-slots` is correct — present, visible, with the right sentence, and the grid's table hidden. The
failure is that `availability-grid` is still in the document, so a waiter looking for either state
by testid finds neither *visible* and times out. "`no-slots` shown instead of the grid" is not
satisfied by hiding the grid while leaving it in the document.

`probe1.py`, on load, signed out:

    ROW P-form-absent-load FAIL booking-form in document on load: True (visible=False)
    ROW P-conf-absent-load FAIL confirmation in document on load: True (visible=False)
    ROW P-grid PASS availability-grid present=True visible=True
    ROW P-empty-text PASS empty-state text present and nonempty
    ROW P-noslots-load PASS no-slots absent on load

The blocker item itself is met: the grid is visible on load with nonempty empty-state text and
`no-slots` is absent. That part of the claim is confirmed.

`probe3.py`, driving the two interactions the other two failures name:

    ROW R-unavailable-no-form PASS clicked an unavailable cell (slot-t_1-00:00 available=false):
        booking-form present=True visible=False
    ROW R-form-opens PASS booking-form visible after clicking an available cell
    ROW R-error-state PASS after the refusal: booking-error present=True visible=True ;
        confirmation present=True visible=False ; booking-uncertain present=False visible=False
    ROW R-exactly-once PASS booking-error count=1 confirmation count=1

So the **behaviour** is right in all three cases: an unavailable cell opens nothing visible, and a
refused booking shows `booking-error` with no confirmation and no uncertainty message. Each message
appears exactly once, and its host is in the document when it is raised, so both halves of the
lookup convention hold. What fails is presence in the document, which is exactly what the two
supplied checks assert, and what the room's own ruling says a diner cannot produce.

## Rows this violates

- **S2-018** — "`no-slots` | Shown instead of the grid when the day has no slots". The grid must not
  be in the document in that state, not merely hidden.
- **S2-014 / S2-017 family**, specifically the "only the actions that apply in each state" half of
  the screen contract: `booking-form` is in the document when no booking is being made.
- **S2-002** — "Do not show a confirmation for that attempt". `confirmation` is in the document after
  a refused booking.

No ledger change is requested: all three rows already say what they say. The defect is in the
product, not in the rows. One addition I would make to the row text, because the grader's phrasing
made it concrete: for a state container, **"absent" means absent from the document, not `hidden`** —
`hidden` satisfies visibility and fails presence, and only a driven check finds that.

## Also checked, and passing

`probe4.py`, `scrollWidth <= innerWidth` on all four routes at 375 and 1280, signed in and out:
8 of 8, no sideways scrolling. Zero console errors on load and on a closed-day search.

## Not measured in this run

The seven-states set assertion for S2-043, focus-ring contrast under real `Tab` presses, text
contrast against the first non-transparent ancestor, and the out-of-order and lost-response paths.
The run is already BLOCKED on three rows and I would rather report three reproduced failures than
a longer list of unverified claims.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-bacee63
    cd /tmp/check-bacee63 && git checkout -q bacee63 && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2 -e PORT=8080 -p 8081:8080 tablekeeper
    python verification/probes/s2/probe1.py   # TK base is hardcoded to 127.0.0.1:8081
