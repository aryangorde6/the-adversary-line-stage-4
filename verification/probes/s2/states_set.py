#!/usr/bin/env python3
"""S2-043 — the seven states must be visually distinct, asserted as a SET.

Committed to run before the next stage-2 verdict. Writes nothing; drives only a running service.

    BASE=http://127.0.0.1:8083 python verification/probes/s2/states_set.py

Seven states: available cell, unavailable cell, selected cell, in-flight submit, confirmation,
booking-error, booking-uncertain. For each, resolve the computed (background-color, color,
border-color) and assert the seven triples are seven distinct values — `len(set) == 7`, not a
pairwise visual comparison, because seven states rendered identically is the failure this row
exists for and a set-level assertion cannot be argued with.

Backgrounds are resolved against the FIRST NON-TRANSPARENT ancestor, never the page root: two of
the seven states sit on a form host rather than on the page background.
"""

import json
import os
import sys
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8081")

FIXTURE = {
    "users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
               "display_name": "Ada"}],
    "restaurants": [{
        "id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
        "slot_minutes": 30, "reservation_duration_minutes": 90,
        "tables": [{"id": "t_1", "label": "Window", "capacity": 4},
                   {"id": "t_2", "label": "Corner", "capacity": 4},
                   {"id": "t_3", "label": "Garden", "capacity": 8}],
        "combinable": [["t_1", "t_2"]],
        "opening_hours": [{"weekday": w, "opens": "00:00", "closes": "23:30"}
                          for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]],
    }],
    "reservations": [],
}

TRIPLE = """
(el) => {
  const transparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const cs = getComputedStyle(el);
  let node = el, bg = cs.backgroundColor;
  while (transparent(bg) && node.parentElement) { node = node.parentElement; bg = getComputedStyle(node).backgroundColor; }
  return [bg, cs.color, cs.borderTopColor].join(' | ');
}
"""


def rows(ok_rows, bad_rows):
    for rid, ok, ev in ok_rows + bad_rows:
        print(("ROW %s PASS " if ok else "ROW %s FAIL ") % rid + ev)
    return 0 if not bad_rows else 1


def reset(fixture):
    req = urllib.request.Request(BASE + "/_test/reset", data=json.dumps(fixture).encode(),
                                 headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status


def main():
    good, bad = [], []
    status = reset(FIXTURE)
    if status != 204:                       # standing clause 2: never read past a failed setup
        return rows([], [("S043-setup", False, "reset status %s, so no state below is trustworthy" % status)])

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        page.goto(BASE + "/login", wait_until="domcontentloaded")
        page.fill('[data-testid="login-email"]', "ada@example.com")
        page.fill('[data-testid="login-password"]', "correct horse")
        page.click('[data-testid="login-submit"]')
        page.wait_for_load_state("domcontentloaded")

        page.fill('[data-testid="date-input"]', "2026-12-08")
        page.fill('[data-testid="party-size-input"]', "2")
        page.click('[data-testid="search-button"]')
        page.wait_for_selector('[data-testid="availability-grid"] table', timeout=10000)

        triples = {}

        # available cell
        el = page.query_selector('[data-testid^="slot-"][data-available="true"]')
        triples["available"] = page.eval_on_selector('[data-testid^="slot-"][data-available="true"]', TRIPLE) if el else None

        # unavailable cell (party of 2 fits t_3 only after t_1/t_2 go; use a party that overflows)
        page.fill('[data-testid="party-size-input"]', "6")
        page.click('[data-testid="search-button"]')
        page.wait_for_timeout(800)
        el = page.query_selector('[data-testid^="slot-"][data-available="false"]')
        triples["unavailable"] = page.eval_on_selector('[data-testid^="slot-"][data-available="false"]', TRIPLE) if el else None

        # selected cell: click an available one
        page.fill('[data-testid="party-size-input"]', "2")
        page.click('[data-testid="search-button"]')
        page.wait_for_timeout(800)
        slot = page.query_selector('[data-testid^="slot-"][data-available="true"]')
        tid = slot.get_attribute("data-testid") if slot else None
        if tid:
            page.click('[data-testid="%s"]' % tid)
            page.wait_for_timeout(300)
        sel = page.query_selector('[data-testid="%s"]' % tid) if tid else None
        triples["selected"] = page.eval_on_selector('[data-testid="%s"]' % tid, TRIPLE) if sel else None

        # in-flight submit: hold the request open at the proxy
        page.route("**/reservations", lambda route: (page.wait_for_timeout(1500), route.continue_()))
        page.click('[data-testid="booking-submit"]')
        page.wait_for_timeout(400)
        sub = page.query_selector('[data-testid="booking-submit"]')
        triples["in_flight"] = page.eval_on_selector('[data-testid="booking-submit"]', TRIPLE) if sub else None
        page.wait_for_timeout(2000)
        page.unroute("**/reservations")

        # confirmation
        conf = page.query_selector('[data-testid="confirmation"]')
        triples["confirmation"] = page.eval_on_selector('[data-testid="confirmation"]', TRIPLE) if conf else None

        # booking-error: a thief takes the table, then the form is resubmitted with a fresh key
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.fill('[data-testid="date-input"]', "2026-12-09")
        page.fill('[data-testid="party-size-input"]', "4")
        page.click('[data-testid="search-button"]')
        page.wait_for_selector('[data-testid="availability-grid"] table', timeout=10000)
        page.click('[data-testid="slot-t_2-19:00"]')
        page.wait_for_selector('[data-testid="booking-form"]', timeout=10000)
        tok = json.loads(urllib.request.urlopen(urllib.request.Request(
            BASE + "/auth/signup",
            data=json.dumps({"email": "thief@example.com", "password": "hunter22",
                             "display_name": "Thief"}).encode(),
            headers={"content-type": "application/json"}, method="POST")).read())["token"]
        urllib_request = urllib.request.Request(
            BASE + "/reservations",
            data=json.dumps({"restaurant_id": "r_anker", "table_id": "t_2",
                             "starts_at_local": "2026-12-09T19:00", "party_size": 4}).encode(),
            headers={"content-type": "application/json", "authorization": "Bearer " + tok,
                     "idempotency-key": "thief-2"}, method="POST")
        urllib.request.urlopen(urllib_request)
        page.click('[data-testid="booking-submit"]')
        page.wait_for_selector('[data-testid="booking-error"]', timeout=10000)
        be = page.query_selector('[data-testid="booking-error"]')
        triples["booking_error"] = page.eval_on_selector('[data-testid="booking-error"]', TRIPLE) if be else None

        # booking-uncertain: drop the response entirely
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.fill('[data-testid="date-input"]', "2026-12-10")
        page.fill('[data-testid="party-size-input"]', "4")
        page.click('[data-testid="search-button"]')
        page.wait_for_selector('[data-testid="availability-grid"] table', timeout=10000)
        page.click('[data-testid="slot-t_2-19:00"]')
        page.wait_for_selector('[data-testid="booking-form"]', timeout=10000)
        page.route("**/reservations", lambda route: route.abort())
        page.click('[data-testid="booking-submit"]')
        try:
            page.wait_for_selector('[data-testid="booking-uncertain"]', timeout=10000)
        except Exception:
            pass
        bu = page.query_selector('[data-testid="booking-uncertain"]')
        triples["booking_uncertain"] = page.eval_on_selector('[data-testid="booking-uncertain"]', TRIPLE) if bu else None

        for name, value in triples.items():
            (good if value else bad).append(
                (("S043-" + name), bool(value),
                 ("%s triple = %s" % (name, value)) if value else "%s state was never observed, so it cannot be compared" % name))

        observed = [v for v in triples.values() if v]
        distinct = len(set(observed))
        (good if (len(observed) == 7 and distinct == 7) else bad).append(
            ("S043-set", len(observed) == 7 and distinct == 7,
             "%d of 7 states observed, %d distinct triples %s" % (
                 len(observed), distinct, json.dumps(observed, indent=None))))

        browser.close()

    code = rows(good, bad)
    print("SUMMARY %d/%d passed" % (len(good), len(good) + len(bad)))
    return code


if __name__ == "__main__":
    sys.exit(main())
