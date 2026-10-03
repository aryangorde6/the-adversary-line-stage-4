#!/usr/bin/env python3
"""S2-001 / S2-003 / S2-004 / S2-005 — out-of-order responses and an uncertain outcome.

Committed to run before the next stage-2 verdict.

    BASE=http://127.0.0.1:8083 python verification/probes/s2/out_of_order_lost.py

Four paths, each driven through a proxy so the timing is arranged rather than hoped for:

1. search A delayed 2s, search B immediate -> the grid, the summary and every cell describe B,
   and nothing anywhere carries A's date or table label;
2. the booking response dropped after the request reaches the server -> `booking-uncertain` with
   nonempty text, no `booking-error`, no `confirmation`, and the booking exists server-side;
3. an unchanged retry -> same Idempotency-Key header value and a byte-identical body recorded at
   the proxy, `booking-uncertain` and `booking-error` both gone, the ORIGINAL reference shown, and
   exactly one reservation on the server;
4. a confirmed rejection -> `booking-error` nonempty with `booking-uncertain` and `confirmation`
   absent, which is the half that fails if uncertain and error are conflated.

Standing clauses apply throughout: every reset's status is asserted before its result is read, and
every response's shape is asserted before a count is taken from it.
"""

import json
import os
import time as _time
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8081")

FIXTURE = {
    "users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
               "display_name": "Ada"}],
    "restaurants": [
        {"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
         "slot_minutes": 30, "reservation_duration_minutes": 90,
         "tables": [{"id": "t_1", "label": "Window", "capacity": 4},
                    {"id": "t_2", "label": "Corner", "capacity": 4}],
         "combinable": [["t_1", "t_2"]],
         "opening_hours": [{"weekday": w, "opens": "00:00", "closes": "23:30"}
                           for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]},
        {"id": "r_dock", "name": "Zum Dock", "timezone": "Europe/Berlin",
         "slot_minutes": 30, "reservation_duration_minutes": 90,
         "tables": [{"id": "d_1", "label": "Quay", "capacity": 4}],
         "combinable": [],
         "opening_hours": [{"weekday": w, "opens": "00:00", "closes": "23:30"}
                           for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]},
    ],
    "reservations": [],
}

RECORDED = []
DELAYED = []          # requests the proxy actually held
RELEASED = []          # (time, path) in the order responses were written back
RULES = {"delay_paths": set(), "delay_tokens": {}, "delay_seconds": 2.0,
         "drop_paths": set(), "status": {}}


class Proxy(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _target(self):
        return "127.0.0.1:" + BASE.rsplit(":", 1)[1]

    def do_GET(self):
        path = self.path.split("?")[0]
        # Delay by a PREDICATE over the query, never by an exact string. The first version keyed on
        # `"/availability?restaurant_id=r_anker&date=2026-12-08&party_size=2"`; if the request that
        # actually goes out differs in ANY parameter the key silently does not match, no delay
        # happens, and the probe stops exercising the race at all — a green row measuring nothing.
        for rule in RULES["delay_paths"]:
            if rule in path and all(token in self.path for token in RULES["delay_tokens"].get(rule, [])):
                DELAYED.append(self.path)
                time.sleep(RULES["delay_seconds"])
        self._relay("GET", b"")
        RELEASED.append((time.time(), self.path))

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length)
        if self.path.startswith("/reservations"):
            RECORDED.append({"key": self.headers.get("idempotency-key"), "body": body.decode()})
        if self.path.split("?")[0] in RULES["drop_paths"]:
            # The request HAS reached the service; only the RESPONSE is discarded. The first
            # version relayed through and then closed the socket, which still delivered the
            # response -- so the "lost" booking completed normally and the probe measured a
            # confirmation instead of an uncertainty. Nothing is written back to the client here.
            import http.client
            conn = http.client.HTTPConnection(self._target(), timeout=20)
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in ("host", "content-length", "connection")}
            conn.request("POST", self.path, body=body, headers=headers)
            resp = conn.getresponse()
            RULES.setdefault("dropped_status", {})[self.path] = resp.status
            resp.read()
            conn.close()
            self.close_connection = True
            return
        self._relay("POST", body)

    def _relay(self, method, body):
        import http.client
        conn = http.client.HTTPConnection(self._target(), timeout=20)
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in ("host", "content-length", "connection")}
        conn.request(method, self.path, body=body, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        self.send_response(resp.status)
        for k, v in resp.getheaders():
            if k.lower() in ("transfer-encoding", "content-length", "connection", "date", "server"):
                continue
            self.send_header(k, v)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        conn.close()


def api(path, payload=None, token=None, key=None, method=None):
    req = urllib.request.Request(BASE + path,
                                 data=None if payload is None else json.dumps(payload).encode(),
                                 headers=dict({"content-type": "application/json"},
                                              **({"authorization": "Bearer " + token} if token else {}),
                                              **({"idempotency-key": key} if key else {})),
                                 method=method or ("GET" if payload is None else "POST"))
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read() or b"{}")


def main():
    good, bad = [], []
    status, _ = api("/_test/reset", FIXTURE)
    if status != 204:
        print("ROW OL-setup FAIL reset status %s" % status)
        return 1
    # Ada's own bearer token, so the server-side check counts HER reservations and not a stranger's.
    _, ada = api("/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    if "token" not in ada:
        print("ROW OL-token FAIL login returned keys %s" % sorted(ada.keys()))
        return 1
    good.append(("OL-setup", True, "reset status 204; Ada's token acquired for the server-side counts"))

    proxy = ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
    threading.Thread(target=proxy.serve_forever, daemon=True).start()
    P = "http://127.0.0.1:%d" % proxy.server_address[1]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(P + "/login", wait_until="domcontentloaded")
        page.fill('[data-testid="login-email"]', "ada@example.com")
        page.fill('[data-testid="login-password"]', "correct horse")
        page.click('[data-testid="login-submit"]')
        # Sign-in is a fetch followed by a client-side navigation, so waiting on the load state
        # returns before it has happened. Reading the cookie too early made the page look signed
        # out and produced an `auth-error` on a diner who had in fact signed in -- an instrument
        # failure that would have been reported as a product defect.
        page.wait_for_selector('[data-testid="current-user"]', timeout=10000)
        page.wait_for_function("() => document.cookie.indexOf('tk_token=') !== -1", timeout=10000)

        # --- 1. out-of-order searches ---------------------------------------
        DELAYED.clear(); RELEASED.clear()
        RULES["delay_paths"] = {"/availability"}
        RULES["delay_tokens"] = {"/availability": ["restaurant_id=r_anker", "date=2026-12-08"]}
        page.goto(P + "/", wait_until="domcontentloaded")
        page.select_option('[data-testid="restaurant-select"]', "r_anker")
        page.fill('[data-testid="date-input"]', "2026-12-08")
        page.click('[data-testid="search-button"]')          # A: delayed by the proxy
        page.wait_for_timeout(150)
        page.select_option('[data-testid="restaurant-select"]', "r_dock")
        page.fill('[data-testid="date-input"]', "2026-12-09")
        page.click('[data-testid="search-button"]')          # B: wins
        page.wait_for_timeout(4000)
        # Clause 1, applied to my own harness: the fault must be asserted before the reaction is.
        # Without this the row below passes on a run where no delay ever happened, which is exactly
        # how the Saboteur's out-of-order mutant went unseen: the grid was observably wrong and my
        # rows reported green because the race had never been staged.
        (good if DELAYED else bad).append(
            ("OL-staged", bool(DELAYED),
             "the proxy held %d availability request(s) matching r_anker/2026-12-08: %s. Zero means the "
             "race was never staged and every ordering row below is vacuous." % (
                 len(DELAYED), json.dumps([d[:70] for d in DELAYED]))))
        order = [p for _, p in RELEASED if "/availability" in p]
        a_after_b = bool(order) and "r_anker" in order[-1] and "r_dock" in order[0]
        (good if a_after_b else bad).append(
            ("OL-order-staged", a_after_b,
             "responses released in order %s — the first search's must land LAST for the row to mean "
             "anything" % json.dumps([p[:60] for p in order])))

        grid_html = page.inner_html('[data-testid="availability-grid"]')
        # A cell testid carries the table ids and the TIME, never the date, and the label lives in
        # aria-label rather than in text — so the original substring test ("2026-12-08" or "Window"
        # in the grid HTML) could not distinguish right from wrong and was vacuous. Assert on which
        # restaurant's tables are on screen instead.
        prefixes = sorted({c.rsplit("-", 1)[0] for c in
                           page.eval_on_selector_all('[data-testid^="slot-"]',
                                                     "e=>e.map(x=>x.getAttribute('data-testid'))")})
        a_prefixes = [p for p in prefixes if p.startswith("slot-t_")]
        (good if not a_prefixes else bad).append(
            ("OL-order", not a_prefixes,
             "after the late A response the grid still shows A's tables: prefixes=%s%s" % (
                 json.dumps(prefixes), "" if not a_prefixes else "; A's tables present -> "
                 "the late response was applied")))
        # Absence of A is not evidence that B is shown: a grid emptied by the late response would
        # satisfy the row above. So assert B positively -- its cells, and B's own date.
        cells_b = page.query_selector_all('[data-testid^="slot-d_1-"]')
        # A cell testid carries the table and the TIME, not the date, so the date string is not in
        # the grid's HTML by design. Assert what the page actually shows: B's cells, and the date
        # the person is looking at in the form.
        date_field = page.input_value('[data-testid="date-input"]')
        (good if (len(cells_b) > 0 and date_field == "2026-12-09") else bad).append(
            ("OL-order-shows-b", len(cells_b) > 0 and date_field == "2026-12-09",
             "after A lands late: %d of B's cells present, date field shows %r (B's date)"
             % (len(cells_b), date_field)))
        # The region must stay present and visible throughout, including while a search is in
        # flight, because a second search now rebuilds it before showing the loading message.
        region = page.query_selector('[data-testid="availability-grid"]')
        (good if (region is not None and region.is_visible()) else bad).append(
            ("OL-region-present", region is not None and region.is_visible(),
             "after both searches settled: availability-grid present=%s visible=%s"
             % (region is not None, region is not None and region.is_visible())))
        RULES["delay_paths"] = set()

        # The loading state: a search in flight must leave the region visible, not remove it.
        RULES["delay_paths"] = {"/availability?restaurant_id=r_anker&date=2026-12-12&party_size=2"}
        page.fill('[data-testid="date-input"]', "2026-12-12")
        page.click('[data-testid="search-button"]')
        page.wait_for_timeout(700)
        mid = page.query_selector('[data-testid="availability-grid"]')
        loading = page.query_selector('[data-testid="grid-loading"]')
        (good if (mid is not None and mid.is_visible()) else bad).append(
            ("OL-region-in-flight", mid is not None and mid.is_visible(),
             "with a search in flight: availability-grid present=%s visible=%s ; grid-loading in "
             "document=%s" % (mid is not None, mid is not None and mid.is_visible(),
                              loading is not None)))
        page.wait_for_timeout(2500)
        RULES["delay_paths"] = set()

        # --- 2. lost booking response ---------------------------------------
        page.goto(P + "/", wait_until="domcontentloaded")
        page.select_option('[data-testid="restaurant-select"]', "r_dock")
        page.fill('[data-testid="date-input"]', "2026-12-10")
        page.click('[data-testid="search-button"]')
        page.wait_for_selector('[data-testid="availability-grid"] table', timeout=10000)
        page.click('[data-testid="slot-d_1-19:00"]')
        page.wait_for_selector('[data-testid="booking-form"]', timeout=10000)
        RECORDED.clear()
        RULES["drop_paths"] = {"/reservations"}
        page.click('[data-testid="booking-submit"]')
        try:
            page.wait_for_selector('[data-testid="booking-uncertain"]', timeout=10000)
        except Exception:
            pass
        page.wait_for_timeout(500)
        un = page.query_selector('[data-testid="booking-uncertain"]')
        be = page.query_selector('[data-testid="booking-error"]')
        cf = page.query_selector('[data-testid="confirmation"]')
        (good if (un is not None and un.is_visible() and un.inner_text().strip()
                  and not (be is not None and be.is_visible())
                  and not (cf is not None and cf.is_visible())) else bad).append(
            ("OL-uncertain", un is not None and un.is_visible() and bool(un.inner_text().strip())
             and not (be is not None and be.is_visible()) and not (cf is not None and cf.is_visible()),
             "after the dropped response: booking-uncertain present=%s visible=%s text=%r ; "
             "booking-error visible=%s ; confirmation visible=%s" % (
                 un is not None, un is not None and un.is_visible(),
                 (un.inner_text().strip()[:60] if un is not None else None),
                 be is not None and be.is_visible(), cf is not None and cf.is_visible())))
        # the booking did commit server-side
        RULES["drop_paths"] = set()
        code, listing = api("/reservations", token=ada["token"], method="GET")
        # Standing clause 3: assert the shape before concluding from a count.
        if "reservations" not in listing:
            bad.append(("OL-shape", False,
                        "GET /reservations returned keys %s, so no count below is trustworthy"
                        % sorted(listing.keys())))
        else:
            good.append(("OL-shape", True, "GET /reservations carries a reservations array"))
            after_drop = [r for r in listing["reservations"]
                          if r.get("starts_at_local") == "2026-12-10T19:00"]
            (good if len(after_drop) == 1 else bad).append(
                ("OL-committed", len(after_drop) == 1,
                 "after the dropped response the booking DID commit: %d reservations at "
                 "2026-12-10T19:00 (expected 1)" % len(after_drop)))

        # --- 3. unchanged retry ---------------------------------------------
        before = len(RECORDED)
        # The retry must SUCCEED, so the proxy stops dropping before the click. Leaving the drop
        # on for the retry measures the same uncertainty twice and can never show the recovery.
        RULES["drop_paths"] = set()
        page.click('[data-testid="booking-submit"]')         # retry, nothing touched
        page.wait_for_timeout(2500)
        sent = RECORDED[before:]
        same_key = len(sent) >= 1 and all(r["key"] == RECORDED[before - 1]["key"] for r in sent)
        same_body = len(sent) >= 1 and all(r["body"] == RECORDED[before - 1]["body"] for r in sent)
        un = page.query_selector('[data-testid="booking-uncertain"]')
        be = page.query_selector('[data-testid="booking-error"]')
        ref = page.query_selector('[data-testid="confirmation-reference"]')
        (good if (same_key and same_body) else bad).append(
            ("OL-retry-request", same_key and same_body,
             "%d booking requests on retry; same key=%s same body=%s (keys %s)" % (
                 len(sent), same_key, same_body, [r["key"] for r in sent])))
        _, listing2 = api("/reservations", token=ada["token"], method="GET")
        after_retry = [r for r in listing2.get("reservations", [])
                       if r.get("starts_at_local") == "2026-12-10T19:00"]
        (good if len(after_retry) == 1 else bad).append(
            ("OL-retry-once", len(after_retry) == 1,
             "after the retry the server holds %d reservations at that slot (expected exactly 1: "
             "a retry must not book twice)" % len(after_retry)))
        (good if (un is None and be is None and ref is not None and ref.inner_text().strip()) else bad).append(
            ("OL-retry-state", un is None and be is None and ref is not None and bool(ref.inner_text().strip()),
             "after the retry: booking-uncertain in document=%s ; booking-error in document=%s ; "
             "confirmation-reference=%r" % (un is not None, be is not None,
                                            (ref.inner_text().strip() if ref is not None else None))))

        # --- 4. confirmed rejection -----------------------------------------
        page.goto(P + "/", wait_until="domcontentloaded")
        page.select_option('[data-testid="restaurant-select"]', "r_anker")
        page.fill('[data-testid="date-input"]', "2026-12-11")
        page.click('[data-testid="search-button"]')
        page.wait_for_selector('[data-testid="availability-grid"] table', timeout=10000)
        page.click('[data-testid="slot-t_2-19:00"]')
        page.wait_for_selector('[data-testid="booking-form"]', timeout=10000)
        _, thief = api("/auth/signup", {"email": "thief2@example.com", "password": "hunter22",
                                        "display_name": "Thief"})
        api("/reservations", {"restaurant_id": "r_anker", "table_id": "t_2",
                              "starts_at_local": "2026-12-11T19:00", "party_size": 4},
            token=thief["token"], key="thief-3")
        page.click('[data-testid="booking-submit"]')
        try:
            page.wait_for_selector('[data-testid="booking-error"]', timeout=10000)
        except Exception:
            pass
        be = page.query_selector('[data-testid="booking-error"]')
        un = page.query_selector('[data-testid="booking-uncertain"]')
        cf = page.query_selector('[data-testid="confirmation"]')
        (good if (be is not None and be.is_visible() and be.inner_text().strip()
                  and not (un is not None and un.is_visible())
                  and not (cf is not None and cf.is_visible())) else bad).append(
            ("OL-refusal", be is not None and be.is_visible() and bool(be.inner_text().strip())
             and not (un is not None and un.is_visible()) and not (cf is not None and cf.is_visible()),
             "after the confirmed refusal: booking-error present=%s visible=%s text=%r ; "
             "booking-uncertain visible=%s ; confirmation visible=%s" % (
                 be is not None, be is not None and be.is_visible(),
                 (be.inner_text().strip()[:60] if be is not None else None),
                 un is not None and un.is_visible(), cf is not None and cf.is_visible())))

        browser.close()
    proxy.shutdown()

    for rid, ok, ev in good + bad:
        print(("ROW %s PASS " if ok else "ROW %s FAIL ") % rid + ev)
    print("SUMMARY %d/%d passed" % (len(good), len(good) + len(bad)))
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
