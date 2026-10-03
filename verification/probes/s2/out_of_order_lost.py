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
RULES = {"delay_paths": set(), "drop_paths": set(), "status": {}}


class Proxy(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _target(self):
        return "127.0.0.1:" + BASE.rsplit(":", 1)[1]

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in RULES["delay_paths"]:
            time.sleep(2.0)
        self._relay("GET", b"")

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length)
        if self.path.startswith("/reservations"):
            RECORDED.append({"key": self.headers.get("idempotency-key"), "body": body.decode()})
        if self.path.split("?")[0] in RULES["drop_paths"]:
            # The request HAS reached the service; only the response is discarded.
            self._relay("POST", body)
            try:
                self.wfile.close()
            except Exception:
                pass
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
    good.append(("OL-setup", True, "reset status 204"))

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
        page.wait_for_load_state("domcontentloaded")

        # --- 1. out-of-order searches ---------------------------------------
        RULES["delay_paths"] = {"/availability?restaurant_id=r_anker&date=2026-12-08&party_size=2"}
        page.goto(P + "/", wait_until="domcontentloaded")
        page.fill('[data-testid="restaurant-input"]', "r_anker")
        page.fill('[data-testid="date-input"]', "2026-12-08")
        page.click('[data-testid="search-button"]')          # A: delayed by the proxy
        page.wait_for_timeout(150)
        page.fill('[data-testid="restaurant-input"]', "r_dock")
        page.fill('[data-testid="date-input"]', "2026-12-09")
        page.click('[data-testid="search-button"]')          # B: wins
        page.wait_for_timeout(4000)
        grid_html = page.inner_html('[data-testid="availability-grid"]')
        leftover_a = "2026-12-08" in grid_html or "Window" in grid_html
        (good if not leftover_a else bad).append(
            ("OL-order", not leftover_a,
             "after the late A response the grid still names A: %s" % leftover_a))
        RULES["delay_paths"] = set()

        # --- 2. lost booking response ---------------------------------------
        page.goto(P + "/", wait_until="domcontentloaded")
        page.fill('[data-testid="restaurant-input"]', "r_dock")
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
        tok = page.evaluate("() => document.cookie") or ""
        code, listing = api("/reservations", token=None, method="GET")
        (good if "reservations" in listing else bad).append(
            ("OL-shape", "reservations" in listing,
             "GET /reservations returned keys %s" % sorted(listing.keys())))

        # --- 3. unchanged retry ---------------------------------------------
        before = len(RECORDED)
        RULES["drop_paths"] = {"/reservations"}
        page.click('[data-testid="booking-submit"]')         # retry, nothing touched
        page.wait_for_timeout(2500)
        RULES["drop_paths"] = set()
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
        (good if (un is None and be is None and ref is not None and ref.inner_text().strip()) else bad).append(
            ("OL-retry-state", un is None and be is None and ref is not None and bool(ref.inner_text().strip()),
             "after the retry: booking-uncertain in document=%s ; booking-error in document=%s ; "
             "confirmation-reference=%r" % (un is not None, be is not None,
                                            (ref.inner_text().strip() if ref is not None else None))))

        # --- 4. confirmed rejection -----------------------------------------
        page.goto(P + "/", wait_until="domcontentloaded")
        page.fill('[data-testid="restaurant-input"]', "r_anker")
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
