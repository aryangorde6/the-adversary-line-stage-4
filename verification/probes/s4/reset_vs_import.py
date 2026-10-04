#!/usr/bin/env python3
"""Is `POST /_test/import` "after reset"?  The one question standing between INFERENTIAL and VERBATIM.

    BASE=http://127.0.0.1:8141 python verification/probes/s4/reset_vs_import.py

`stage-4.md:47` is a DEFINITION, not an expectation:

    "A restaurant revision starts at 0 after reset and increments once for each successful
     new booking, real amendment, cancellation, policy publication or plan application."

Read literally, a revision of 0 is legal only in the state immediately after a reset.  So the
question is whether an imported state reporting 0 is such a state -- and it is answerable by driving,
because a REAL reset is available for comparison in the same process.

If import were "after reset", the imported state would be indistinguishable from a reset state.  It is
not, and the difference is the defect: **import keeps the events that `:47` says increment the counter
and discards the count.** A reset would have cleared those events too.

This file therefore measures whether the imported state is reachable by ANY legal sequence of the
operations `:47` names.  Tree: `stage-4/` at `334f8c2` (comments-only over behaviour `56e278a`).
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8141")

HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4}]

RESULTS = []


def call(method, path, body=None, token=None, key=None):
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = "Bearer " + token
    if key:
        headers["idempotency-key"] = key
    req = urllib.request.Request(BASE + path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {}


def row(rid, ok, text):
    RESULTS.append((rid, ok))
    print("ROW %-8s %s  %s" % (rid, "PASS" if ok else "FAIL", text))


def fixture(reservations):
    return {"users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                       "display_name": "Ada"}],
            "restaurants": [{"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
                             "manager_user_ids": ["u_ada"], "slot_minutes": 30,
                             "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
                             "opening_hours": HOURS, "tables": TABLES}],
            "reservations": reservations}


def revision_now(token, key):
    """`restaurant_revision` as the service reports it, read without changing anything."""
    st, p = call("POST", "/restaurants/r_anker/replans",
                 {"table_id": "t_2", "from": "2026-09-28T18:00:00+02:00",
                  "to": "2026-09-28T23:00:00+02:00"}, token=token, key=key)
    return (st, p.get("restaurant_revision"))


def main():
    print("service under measurement: %s" % BASE)

    # ---- setup: one booking, which `:47` names as an incrementing event ------------
    st, _ = call("POST", "/_test/reset", fixture([]))
    if st != 204:
        print("SETUP FAILED: reset -> %s" % st); return 1
    st, body = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    token = body.get("token")
    if not token:
        print("SETUP FAILED: login -> %s" % st); return 1
    st, bk = call("POST", "/reservations",
                  {"restaurant_id": "r_anker", "table_id": "t_1",
                   "starts_at_local": "2026-09-28T18:30", "party_size": 2},
                  token=token, key="rv-book-1")
    if st != 201:
        print("SETUP FAILED: booking -> %s %s" % (st, bk)); return 1
    st, rev_before = revision_now(token, "rv-p1")
    print("setup: reset 204, login 200, one booking created (a `:47` event)")
    print("      restaurant_revision after the booking = %s" % rev_before)
    row("RV-1", rev_before == 1,
        "`:47` baseline established: one successful new booking moved the revision 0 -> %s" % rev_before)

    # ---- the round trip, then read the quantity and the events together ----------
    st, exp = call("GET", "/_test/export")
    if st != 200:
        print("SETUP FAILED: export -> %s" % st); return 1
    st, imp = call("POST", "/_test/import", exp)
    if st not in (200, 204):
        print("SETUP FAILED: import -> %s %s" % (st, imp)); return 1
    st, rev_after = revision_now(token, "rv-p2")
    st, exp2 = call("GET", "/_test/export")
    kept = exp2.get("state", {}).get("reservations", [])
    print("after import: restaurant_revision = %s ; reservations carried = %d"
          % (rev_after, len(kept)))

    row("RV-2", rev_after == 0,
        "after the round trip the defined quantity reads %s" % rev_after)
    row("RV-3", len(kept) > 0,
        "and the events `:47` says increment it SURVIVED the round trip: %d reservation(s) still "
        "present in the imported state" % len(kept))

    # ---- what a REAL reset produces, in the same process -------------------------
    st, _ = call("POST", "/_test/reset", fixture([]))
    if st != 204:
        print("SETUP FAILED: second reset -> %s" % st); return 1
    st, exp3 = call("GET", "/_test/export")
    after_real_reset = exp3.get("state", {}).get("reservations", [])
    st, body = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    rev_reset = revision_now(body.get("token"), "rv-p3")
    print("after a REAL reset with an empty fixture: reservations = %d, revision = %s"
          % (len(after_real_reset), rev_reset[1]))

    row("RV-4", len(after_real_reset) == 0 and rev_reset[1] == 0,
        "a real reset yields the pair (reservations=0, revision=0) -- so that pair is what 'after reset' "
        "actually looks like: %d reservations, revision %s" % (len(after_real_reset), rev_reset[1]))

    # ---- the reachability question ------------------------------------------------
    row("RV-5", len(kept) > 0 and rev_after == 0 and len(after_real_reset) == 0,
        "the imported state is (reservations=%d, revision=%s): NOT producible by reset, which produces "
        "(0, 0), and NOT producible by reset-plus-events, because any booking present implies at least "
        "one increment under `:47`. Import is therefore NEITHER a reset NOR a faithful replacement -- it "
        "keeps the books and discards the count." % (len(kept), rev_after))

    bad = [r for r, ok in RESULTS if not ok]
    print("\n%d rows, %d failed: %s" % (len(RESULTS), len(bad), ", ".join(bad) if bad else "none"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
