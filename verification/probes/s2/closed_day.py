#!/usr/bin/env python3
"""S2-018 — the closed day, the fully-booked day and the open day, with the SENTENCE asserted.

    BASE=http://127.0.0.1:8084 python verification/probes/s2/closed_day.py

Four rows per arrangement, and every one of them queries its element DIRECTLY:

  * the results region is absent from the document (`query_selector` is None), not hidden —
    a `hidden` container satisfies a visibility check and fails a presence check;
  * `no-slots` is present and visible;
  * the text says the restaurant is **closed** and names the day the way a person reads it;
  * `booking-form` is absent from the document.

Presence and wording are separate failures, so both are asserted separately: a check that only
asks "did some element become visible" passes while a diner is told to try a smaller party on a
day the restaurant never opens.

Every run prints the date it searched and the `slots` length it read, in every arrangement and
both sign-in states. Three seats once measured one hash and disagreed about whether `no-slots`
renders on a closed day; the disagreement was an inference from a Playwright timeout, and it was
only settleable because a later sweep printed what it had asked for. Hence the two extra values,
always.

The closed day is arranged ONE way — every weekday except the booking day's — because
`opening_hours: []` behaves identically, and because an opening window shorter than the
reservation duration is refused by `POST /_test/reset` with 400 and so can never be shown. That
refusal is asserted here rather than taken on report.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8081")
DATE = "2026-12-08"          # a Tuesday
WEEKDAY_LONG = "Tuesday"

FIXTURE = {
    "users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
               "display_name": "Ada"}],
    "restaurants": [{
        "id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
        "slot_minutes": 30, "reservation_duration_minutes": 90,
        "tables": [{"id": "t_1", "label": "Window", "capacity": 4},
                   {"id": "t_2", "label": "Corner", "capacity": 4}],
        "combinable": [["t_1", "t_2"]],
        "opening_hours": [{"weekday": w, "opens": "00:00", "closes": "23:30"}
                          for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]],
    }],
    "reservations": [],
}


def rows(good, bad):
    for rid, ok, ev in good + bad:
        print(("ROW %s PASS " if ok else "ROW %s FAIL ") % rid + ev)
    print("SUMMARY %d/%d passed" % (len(good), len(good) + len(bad)))
    return 0 if not bad else 1


def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"content-type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}


def get(path, token=None):
    req = urllib.request.Request(BASE + path, method="GET",
                                 headers={"authorization": "Bearer " + token} if token else {})
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read() or b"{}")


def main():
    good, bad = [], []

    # --- a second way to arrange a day with no slots ---------------------------
    # An opening window shorter than the reservation duration was reported to be impossible:
    # "rejected by POST /_test/reset with 400, so it can never be shown". Measured, the reset
    # accepts it (204). Asserted here as what it is rather than as what it was reported to be: if
    # the arrangement exists, then it is a second closed day and the row must cover it, and if a
    # future build refuses it the row says so instead of failing.
    short_window = json.loads(json.dumps(FIXTURE))
    for h in short_window["restaurants"][0]["opening_hours"]:
        if h["weekday"] == "tue":
            h["opens"], h["closes"] = "18:00", "18:30"
    status, _ = post("/_test/reset", short_window)
    if status == 204:
        _, availability = get("/availability?restaurant_id=r_anker&date=%s&party_size=2" % DATE)
        slots_len = len(availability.get("slots", [])) if "slots" in availability else None
        (good if slots_len == 0 else bad).append(
            ("CD-window-unarrangeable", slots_len == 0,
             "an 18:00-18:30 window on a 90-minute reservation: reset 204, slots length %s "
             "(0 means this is a second closed day and the rows below cover it too)" % slots_len))
    else:
        (good if status >= 400 else bad).append(
            ("CD-window-unarrangeable", status >= 400,
             "an 18:00-18:30 window on a 90-minute reservation -> reset %s, so the service refuses "
             "to create this state and no closed-day row should try to arrange it" % status))

    # --- `opening_hours: []` behaves identically to the no-entry-per-weekday shape ---
    empty = json.loads(json.dumps(FIXTURE))
    empty["restaurants"][0]["opening_hours"] = []
    st_empty, _ = post("/_test/reset", empty)
    per_weekday = json.loads(json.dumps(FIXTURE))
    per_weekday["restaurants"][0]["opening_hours"] = [
        h for h in per_weekday["restaurants"][0]["opening_hours"] if h["weekday"] != "tue"]
    st_weekday, _ = post("/_test/reset", per_weekday)
    (good if (st_empty == 204 and st_weekday == 204) else bad).append(
        ("CD-arrangements", st_empty == 204 and st_weekday == 204,
         "opening_hours [] -> reset %s ; every weekday except the booking day's -> reset %s"
         % (st_empty, st_weekday)))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for signed_in in (False, True):
            tag = "in" if signed_in else "out"
            page = browser.new_page(viewport={"width": 1280, "height": 900})

            # ---- the closed day -------------------------------------------------
            status, _ = post("/_test/reset", per_weekday)
            if status != 204:                # standing clause 2
                bad.append(("CD-setup-" + tag, False, "reset status %s" % status))
                page.close()
                continue
            if signed_in:
                page.goto(BASE + "/login", wait_until="domcontentloaded")
                page.fill('[data-testid="login-email"]', "ada@example.com")
                page.fill('[data-testid="login-password"]', "correct horse")
                page.click('[data-testid="login-submit"]')
                page.wait_for_selector('[data-testid="current-user"]', timeout=10000)

            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.fill('[data-testid="date-input"]', DATE)
            page.click('[data-testid="search-button"]')
            page.wait_for_timeout(1500)

            # What the API said, read directly rather than inferred from the page.
            _, availability = get("/availability?restaurant_id=r_anker&date=%s&party_size=2" % DATE)
            slots_len = len(availability.get("slots", [])) if "slots" in availability else None

            grid = page.query_selector('[data-testid="availability-grid"]')
            ns = page.query_selector('[data-testid="no-slots"]')
            bf = page.query_selector('[data-testid="booking-form"]')
            text = ns.inner_text().strip() if ns is not None else None
            where = ("signed %s, searched %s, slots length %s" % (tag, DATE, slots_len))

            (good if grid is None else bad).append(
                ("CD-grid-absent-" + tag, grid is None,
                 "%s: availability-grid in document = %s (must be absent, not hidden)"
                 % (where, grid is not None)))
            (good if (ns is not None and ns.is_visible()) else bad).append(
                ("CD-message-" + tag, ns is not None and ns.is_visible(),
                 "%s: no-slots present=%s visible=%s" % (where, ns is not None,
                                                          ns is not None and ns.is_visible())))
            says_closed = bool(text) and "closed" in text.lower()
            (good if says_closed else bad).append(
                ("CD-wording-closed-" + tag, says_closed,
                 "%s: text = %r" % (where, (text or "")[:120])))
            names_day = bool(text) and WEEKDAY_LONG.lower() in text.lower()
            (good if names_day else bad).append(
                ("CD-wording-day-" + tag, names_day,
                 "%s: names the day as a person reads it = %s (text %r)"
                 % (where, names_day, (text or "")[:120])))
            (good if bf is None else bad).append(
                ("CD-form-absent-" + tag, bf is None,
                 "%s: booking-form in document = %s" % (where, bf is not None)))

            # ---- the same day closed by a window shorter than the duration -----
            status, _ = post("/_test/reset", short_window)
            if status == 204:
                page.goto(BASE + "/", wait_until="domcontentloaded")
                page.fill('[data-testid="date-input"]', DATE)
                page.click('[data-testid="search-button"]')
                page.wait_for_timeout(1500)
                _, availability = get("/availability?restaurant_id=r_anker&date=%s&party_size=2" % DATE)
                slots_len = len(availability.get("slots", [])) if "slots" in availability else None
                grid = page.query_selector('[data-testid="availability-grid"]')
                ns = page.query_selector('[data-testid="no-slots"]')
                text = ns.inner_text().strip() if ns is not None else None
                where = ("signed %s, short-window day, searched %s, slots length %s"
                         % (tag, DATE, slots_len))
                (good if slots_len == 0 and grid is None and ns is not None and ns.is_visible()
                 and bool(text) and "closed" in text.lower() else bad).append(
                    ("CD-short-window-" + tag,
                     slots_len == 0 and grid is None and ns is not None and ns.is_visible()
                     and bool(text) and "closed" in text.lower(),
                     "%s: grid in document=%s ; no-slots present=%s visible=%s ; text=%r"
                     % (where, grid is not None, ns is not None,
                        ns is not None and ns.is_visible(), (text or "")[:90])))

            # ---- the open day, on load: the blocking item ------------------------
            status, _ = post("/_test/reset", FIXTURE)
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_timeout(400)
            grid = page.query_selector('[data-testid="availability-grid"]')
            empty_text = page.query_selector('[data-testid="grid-empty"]')
            ns = page.query_selector('[data-testid="no-slots"]')
            (good if (grid is not None and grid.is_visible()) else bad).append(
                ("CD-load-grid-" + tag, grid is not None and grid.is_visible(),
                 "signed %s on load: availability-grid present=%s visible=%s"
                 % (tag, grid is not None, grid is not None and grid.is_visible())))
            (good if (empty_text is not None and empty_text.inner_text().strip()) else bad).append(
                ("CD-load-text-" + tag, empty_text is not None and bool(empty_text.inner_text().strip()),
                 "signed %s on load: empty-state text = %r"
                 % (tag, (empty_text.inner_text().strip()[:70] if empty_text is not None else None))))
            (good if ns is None else bad).append(
                ("CD-load-noslots-" + tag, ns is None,
                 "signed %s on load: no-slots in document = %s" % (tag, ns is not None)))

            # ---- a fully-booked day: the grid stays, no message -----------------
            # Tiled with legal sets only (singles and the declared pair), because a set of three
            # is refused by the fixture before storage and the reset would fail with 422.
            token = json.loads(urllib.request.urlopen(urllib.request.Request(
                BASE + "/auth/login",
                data=json.dumps({"email": "ada@example.com", "password": "correct horse"}).encode(),
                headers={"content-type": "application/json"}, method="POST")).read())["token"]
            tiled = 0
            for hour in (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22):
                for table in ("t_1", "t_2"):
                    start = "%sT%02d:00" % (DATE, hour)
                    req = urllib.request.Request(
                        BASE + "/reservations",
                        data=json.dumps({"restaurant_id": "r_anker", "table_id": table,
                                         "starts_at_local": start, "party_size": 2}).encode(),
                        headers={"content-type": "application/json",
                                 "authorization": "Bearer " + token,
                                 "idempotency-key": "tile-%s-%s" % (table, hour)},
                        method="POST")
                    try:
                        with urllib.request.urlopen(req) as resp:
                            tiled += 1 if resp.status == 201 else 0
                    except urllib.error.HTTPError:
                        pass
            _, availability = get("/availability?restaurant_id=r_anker&date=%s&party_size=2" % DATE)
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.fill('[data-testid="date-input"]', DATE)
            page.click('[data-testid="search-button"]')
            page.wait_for_timeout(1500)
            cells = page.query_selector_all('[data-testid^="slot-"]')
            unavailable = [c for c in cells if c.get_attribute("data-available") == "false"]
            ns = page.query_selector('[data-testid="no-slots"]')
            _, day_slots = get("/availability?restaurant_id=r_anker&date=%s&party_size=2" % DATE)
            (good if (tiled == 24 and len(day_slots.get("slots", [])) > 0) else bad).append(
                ("CD-tiled-" + tag, tiled == 24,
                 "tiled the day with %d legal reservations (expected 24); slots length %s"
                 % (tiled, len(day_slots.get("slots", [])))))
            (good if (len(cells) > 0 and len(unavailable) == len(cells)) else bad).append(
                ("CD-full-grid-" + tag, len(cells) > 0 and len(unavailable) == len(cells),
                 "signed %s, fully-booked day: %d cells, %d data-available=false"
                 % (tag, len(cells), len(unavailable))))
            (good if ns is None else bad).append(
                ("CD-full-noslots-" + tag, ns is None,
                 "signed %s, fully-booked day: no-slots in document = %s (the grid must stay and "
                 "the message must not appear)" % (tag, ns is not None)))
            page.close()
        browser.close()

    return rows(good, bad)


if __name__ == "__main__":
    sys.exit(main())
