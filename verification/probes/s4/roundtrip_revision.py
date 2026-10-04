#!/usr/bin/env python3
"""The measurement the Builder named and declined to run, against `stage-4.md:105` / `:107`.

    BASE=http://127.0.0.1:8137 python verification/probes/s4/roundtrip_revision.py

The Builder reported, from reading the source, that an export->import round-trip resets every restaurant's
replan concurrency token to 0 and offered the measurement without running it. This file runs it.

Measured, not argued:
  A. the gate is ARMED before the round-trip (control) -- two previews from the same expected revision,
     the second apply is refused `stale_plan`;
  B. `restaurant_revision` observed across the round-trip -- the token itself;
  C. what happens to a plan that existed before the round-trip;
  D. which stores the round-trip carries, read off the export, against what `snapshot.js` emits;
  E. whether the reassignment survives in `history` while the closure that explains it does not.

Setup is asserted before every reaction. The tree is named by the caller; this file states only what it drove.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8137")

HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]
CLOSURE = {"table_id": "t_2",
           "from": "2026-09-28T18:00:00+02:00",
           "to": "2026-09-28T23:00:00+02:00"}

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
    print("ROW %-10s %s  %s" % (rid, "PASS" if ok else "FAIL", text))


def code_of(body):
    if isinstance(body, dict):
        return (body.get("error") or {}).get("code")
    return None


def main():
    print("service under measurement: %s" % BASE)

    # ---- setup, asserted before any reaction is asserted -------------------------
    fx = {"users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                     "display_name": "Ada"}],
          "restaurants": [{"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
                           "manager_user_ids": ["u_ada"], "slot_minutes": 30,
                           "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
                           "opening_hours": HOURS, "tables": TABLES}],
          "reservations": []}
    st, body = call("POST", "/_test/reset", fx)
    if st != 204:
        print("SETUP FAILED: reset -> %s %s" % (st, body))
        return 1
    st, body = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    token = body.get("token")
    if st != 200 or not token:
        print("SETUP FAILED: login -> %s %s" % (st, body))
        return 1
    print("setup: reset 204, login 200, token acquired")

    # a real booking on t_2 inside the closure window, so a plan does real work
    st, body = call("POST", "/reservations",
                    {"restaurant_id": "r_anker", "table_id": "t_2",
                     "starts_at_local": "2026-09-28T18:30", "party_size": 4},
                    token=token, key="rt-book-1")
    if st != 201:
        print("SETUP FAILED: reservation on t_2 -> %s %s" % (st, body))
        return 1
    print("setup: one booking created on t_2 inside the closure window")

    # ---- A. is the gate armed BEFORE the round-trip? ----------------------------
    st, p1 = call("POST", "/restaurants/r_anker/replans", CLOSURE, token=token, key="rt-p1")
    if st != 201:
        print("SETUP FAILED: preview 1 -> %s %s" % (st, p1))
        return 1
    st, p2 = call("POST", "/restaurants/r_anker/replans", CLOSURE, token=token, key="rt-p2")
    if st != 201:
        print("SETUP FAILED: preview 2 -> %s %s" % (st, p2))
        return 1
    rev_at_preview = p1.get("restaurant_revision")
    print("A. preview 1 -> %s  restaurant_revision=%s" % (p1.get("plan_id"), rev_at_preview))
    print("A. preview 2 -> %s  restaurant_revision=%s" % (p2.get("plan_id"), p2.get("restaurant_revision")))

    st, a1 = call("POST", "/restaurants/r_anker/replans/%s/apply" % p1["plan_id"], {},
                  token=token, key="rt-a1")
    rev_after_apply = a1.get("restaurant_revision")
    print("A. apply plan 1 -> %s  restaurant_revision=%s" % (st, rev_after_apply))

    st, a2 = call("POST", "/restaurants/r_anker/replans/%s/apply" % p2["plan_id"], {},
                  token=token, key="rt-a2")
    print("A. apply plan 2 (same expected revision) -> %s code=%s" % (st, code_of(a2)))

    row("RT-A", st == 409 and code_of(a2) == "stale_plan",
        "control: before the round-trip, a second apply from the same expected revision is refused "
        "stale_plan (got %s %s) -- the concurrency gate is armed" % (st, code_of(a2)))

    # ---- B. the token across the round-trip -------------------------------------
    st, exp = call("GET", "/_test/export")
    if st != 200:
        print("SETUP FAILED: export -> %s %s" % (st, exp))
        return 1
    print("B. export -> %s  top-level keys: %s" % (st, sorted(exp.get("state", {}).keys())))

    st, imp = call("POST", "/_test/import", exp)
    print("B. import -> %s" % st)
    row("RT-B0", st in (200, 204), "the round-trip the specification requires stage 4 to accept is accepted "
        "(import -> %s)" % st)

    st, p3 = call("POST", "/restaurants/r_anker/replans", CLOSURE, token=token, key="rt-p3")
    rev_after_rt = p3.get("restaurant_revision")
    print("B. fresh preview after round-trip -> %s  restaurant_revision=%s (was %s before)"
          % (st, rev_after_rt, rev_after_apply))

    row("RT-B", rev_after_rt == 0 and rev_after_apply not in (None, 0),
        "the replan concurrency token does NOT survive the round-trip: restaurant_revision reads %s "
        "after a round-trip where it was %s before" % (rev_after_rt, rev_after_apply))

    # ---- C. a plan that existed before the round-trip ---------------------------
    st, c = call("POST", "/restaurants/r_anker/replans/%s/apply" % p2["plan_id"], {},
                 token=token, key="rt-c")
    print("C. apply pre-round-trip plan %s after import -> %s code=%s"
          % (p2.get("plan_id"), st, code_of(c)))
    row("RT-C", True, "recorded, not asserted: a plan previewed before the round-trip answers %s %s on "
        "apply afterwards -- plans live in state.replans, which snapshot.js never emits"
        % (st, code_of(c)))

    # ---- D. what the export carries --------------------------------------------
    keys = sorted(exp.get("state", {}).keys())
    for k in ("replans", "closures", "restaurant_revisions"):
        row("RT-D-%s" % k[:4], k not in keys,
            "state.%s is absent from the export (%s in state: %s)" % (k, k in keys, k in keys))
    for k in ("history", "series", "idempotency"):
        row("RT-D-%s" % k[:4], k in keys,
            "state.%s survives the round-trip (present: %s), as the Builder scoped it" % (k, k in keys))

    # ---- E. a move whose explanation does not survive ---------------------------
    hist = exp.get("state", {}).get("history", [])
    reassigned = [h for h in hist if "reassign" in json.dumps(h).lower()]
    print("E. history entries after the round-trip: %d total, %d recording a reassignment"
          % (len(hist), len(reassigned)))
    row("RT-E", len(reassigned) > 0 and "closures" not in keys,
        "the imported state records the reassignment in history (%d entries) while state.closures is not "
        "exported -- the imported state asserts a move its own closure record no longer explains"
        % len(reassigned))

    bad = [r for r, ok in RESULTS if not ok]
    print("\n%d rows, %d failed: %s" % (len(RESULTS), len(bad), ", ".join(bad) if bad else "none"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
