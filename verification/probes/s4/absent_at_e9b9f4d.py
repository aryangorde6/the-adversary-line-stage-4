#!/usr/bin/env python3
"""Which stage-4 behaviours are absent at the folder-only build, driven rather than read.

    BASE=http://127.0.0.1:8110 python verification/probes/s4/absent_at_e9b9f4d.py

The supplied stage-4 suite reports 4 passed / 2 failed at `e9b9f4d` but not which two, and the check
files must not be opened. So this file does not try to guess the checks: it drives each stage-4
requirement's entry point and records what the service actually does, which is the attribution the
ledger can state honestly. A check's identity is the Foreman's to supply; the behaviour is mine to
measure.

Clauses restated here because they do not travel into a new file by themselves:

 1. assert the setup happened before asserting the reaction;
 4. the service you measure must be the service you started;
 6. the status a defect arrives with is not a reliable signature of the defect -- assert the property,
    not the symptom's costume;
 9. distinguish refusal from absence;
11. before reporting a miss, establish reachability;
15. a stage's own suite is not evidence for the stage;
23. a row that asserts presence must first establish there is something to be present.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8110")

GOOD = []
BAD = []

HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]


def fixture():
    return {
        "users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                   "display_name": "Ada"}],
        "restaurants": [{
            "id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
            "manager_user_ids": ["u_ada"], "slot_minutes": 30,
            "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
            "opening_hours": HOURS, "tables": TABLES,
        }],
        "reservations": [],
    }


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
    except urllib.error.URLError as e:
        return 0, {"error": {"code": "unreachable", "detail": str(e)}}


def check(rid, ok, ev):
    (GOOD if ok else BAD).append((rid, ev))
    print(("ROW " + rid + " ") + ("PASS " if ok else "FAIL ") + ev)


def rows():
    for rid, ev in GOOD + BAD:
        print("ROW " + rid + (" PASS " if (rid, ev) in GOOD else " FAIL ") + ev)
    print("SUMMARY %d/%d passed" % (len(GOOD), len(GOOD) + len(BAD)))
    return 0 if not BAD else 1


def main():
    st, _ = call("POST", "/_test/reset", fixture())
    check("S4-000-setup", st == 204,
          "POST /_test/reset -> %s (expected 204; asserted before anything is read)" % st)
    if st != 204:
        return rows()

    st, body = call("POST", "/auth/login", {"email": "ada@example.com",
                                            "password": "correct horse"})
    token = body.get("token") if st == 200 else None
    check("S4-000-setup", st == 200 and token,
          "manager signs in -> %s token present=%s" % (st, bool(token)))
    if not token:
        return rows()

    # ---- the two stage-4 write families, each driven at its specified entry point ----
    replan = {"table_id": "t_2", "from": "2026-09-28T18:00:00+02:00",
              "to": "2026-09-28T23:00:00+02:00"}
    st, body = call("POST", "/restaurants/r_anker/replans", replan, token=token, key="rp-1")
    replan_absent = st in (404, 405)
    check("S4-001", replan_absent,
          "POST /restaurants/r_anker/replans -> %s code=%s (expected 404/405 at a folder-only build; "
          "the route does not exist yet, which is the expected state and not a defect)"
          % (st, body.get("error", {}).get("code")))

    st, body = call("POST", "/restaurants/r_anker/replans/plan_x/apply", {}, token=token, key="ap-1")
    apply_absent = st in (404, 405)
    check("S4-002", apply_absent,
          "POST /restaurants/r_anker/replans/{id}/apply -> %s code=%s (expected 404/405; the apply "
          "route is the same missing family as S4-001 and is listed separately because the "
          "specification gives it its own requirements)" % (st, body.get("error", {}).get("code")))

    amend = {"expected_revision": 1, "from_index": 0, "local_time": "20:00"}
    st, body = call("POST", "/series/ser_x/amend", amend, token=token, key="am-1")
    amend_absent = st in (404, 405)
    check("S4-003", amend_absent,
          "POST /series/{id}/amend -> %s code=%s (expected 404/405; a second missing family)"
          % (st, body.get("error", {}).get("code")))

    # ---- the carry-forward surface, so the absence above is attributed rather than assumed ----
    st, body = call("GET", "/restaurants/r_anker/policies")
    check("S4-010", st == 200 and isinstance(body.get("policies"), list),
          "GET /restaurants/r_anker/policies -> %s keys=%s (expected 200 with a policies array: the "
          "stage-3 surface is intact in this build, so the two absences above are stage-4's and not a "
          "broken folder)" % (st, sorted(body.keys()) if isinstance(body, dict) else None))

    st, body = call("GET", "/availability?restaurant_id=r_anker&date=2026-09-28&party_size=2")
    slots = body.get("slots") if isinstance(body, dict) else None
    check("S4-011", st == 200 and isinstance(slots, list),
          "GET /availability -> %s with slots[] present=%s (expected 200; the seam S4-160 depends on is "
          "measurable against this build even before stage 4 exists)" % (st, isinstance(slots, list)))

    st, body = call("GET", "/series/ser_x")
    check("S4-012", st == 404,
          "GET /series/ser_x on a series that does not exist -> %s (expected 404; recorded so the "
          "stage-3 optional-auth 404 shape is confirmed present in the stage-4 folder)"
          % st)

    return rows()


if __name__ == "__main__":
    sys.exit(main())