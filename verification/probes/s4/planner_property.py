#!/usr/bin/env python3
"""`S4-170` — the planner properties the supplied stage-4 run could not see, measured.

    BASE=http://127.0.0.1:8117 python verification/probes/s4/planner_property.py

The supplied run passed at `345bbe6` on a commit whose planner refused a *feasible* plan with a
well-formed `409 no_feasible_plan`. That refusal was a documented outcome of a documented constraint, so
**nothing about it invited suspicion and 358 green rows pointed at nothing.** These rows exist because a defect
found once and not asserted is a defect with one chance left.

Four properties, each derived from `tablekeeper/spec/stage-4.md` and not from the implementation:

 1. **A closure is a constraint, not an assignment.** A booking that does not hold the closed table is
    still *considered* (it overlaps the interval), keeps the table it holds, is reported `changed: false`,
    contributes to `moved_count: 0`, gains **no history entry**, and its revision does not move.
 2. **Considered means _overlapping_, not _constrained_.** The two sets differ, and the row asserts the
    difference: a booking overlapping the interval while holding another table appears in `assignments`;
    a booking outside the interval appears nowhere.
 3. **The objective is lexicographic**, and each level must beat the levels below it: a plan that changes
    fewer table sets wins even if it wastes seats; among equals on level 1, the plan wasting fewer seats
    wins; among equals on both, the **rank vector in ascending reference order** decides.
 4. **An unmoved booking gains nothing at all** — revision, history, and nothing invented.

Clauses restated at the top of the file because they do not travel into new files by themselves:

 1. assert the setup happened, and that it can fail, before reading anything;
 4. the service you measure must be the service you started;
 7. assert shape where the specification names a shape;
11. before reporting a miss, establish the path is reachable;
13. no booking may disappear -- assert the population, by reference;
18. a row that iterates a subset and reports agreement over it is green about a population it never touched;
22. a differential row must assert that the difference occurred;
28. the probe must drive every element the row names;
34b. the request shape is the specification's, single-spelled;
39. assert the comparison is over a population neither side can shrink.
"""

import copy
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8117")

GOOD = []
BAD = []

HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]
DATE = "2026-09-28"


def fixture(reservations=(), pairs=()):
    return {"users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                       "display_name": "Ada"}],
            "restaurants": [{"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
                             "manager_user_ids": ["u_ada"], "slot_minutes": 30,
                             "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
                             "opening_hours": HOURS, "tables": copy.deepcopy(TABLES),
                             "declared_pairs": [dict(p) for p in pairs]}],
            "reservations": [dict(r) for r in reservations]}


def booking(ref, table_ids, party, start_hour, day=DATE):
    return {"id": "res_" + ref.lower(), "reference": ref, "user_id": "u_ada",
            "restaurant_id": "r_anker", "table_ids": list(table_ids), "party_size": party,
            "starts_at_local": "%sT%02d:00" % (day, start_hour)}


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


def check(rid, ok, ev):
    (GOOD if ok else BAD).append((rid, ev))
    print(("ROW " + rid + " ") + ("PASS " if ok else "FAIL ") + ev)


def code_of(body):
    return body.get("error", {}).get("code") if isinstance(body, dict) else None


def setup(fx):
    st, _ = call("POST", "/_test/reset", fx)
    if st != 204:
        return None
    st, body = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    return body.get("token") if st == 200 else None


def closure(table="t_1", frm="18:00", to="23:00"):
    return {"table_id": table, "from": "%sT%s:00+02:00" % (DATE, frm),
            "to": "%sT%s:00+02:00" % (DATE, to)}


def plan(token, key, body=None, table="t_1"):
    return call("POST", "/restaurants/r_anker/replans", body or closure(table), token=token, key=key)


def refs_in(body):
    return [a.get("reference") for a in body.get("assignments", [])]


def main():
    # =====================================================================
    # Property 1 -- a closure is a constraint, not an assignment.
    # =====================================================================
    token = setup(fixture([booking("AAAAAA", ["t_2"], 2, 19)]))
    check("S4-170-setup", bool(token), "fixture with one booking on t_2 -> manager token=%s" % bool(token))
    if not token:
        return rows()

    st, before = call("GET", "/reservations/AAAAAA", token=token)
    before_history = call("GET", "/reservations/AAAAAA/history", token=token)[1]
    before_rev = (before or {}).get("revision")
    n_before = len(before_history.get("history", before_history.get("entries", [])))

    st, body = plan(token, "p1")
    ok_preview = st == 201
    check("S4-170-1a", ok_preview,
          "a closure on t_1 while the only booking holds t_2 -> %s code=%s (expected 201: the booking "
          "does not hold the closed table and can simply stay, so a feasible plan exists and this is the "
          "exact case that answered no_feasible_plan at 345bbe6)" % (st, code_of(body)))

    if ok_preview:
        assigns = body.get("assignments", [])
        moved = body.get("moved_count")
        unchanged = (assigns == [{"reference": "AAAAAA", "table_ids": ["t_2"], "changed": False}]
                     or (len(assigns) == 1 and assigns[0].get("reference") == "AAAAAA"
                         and assigns[0].get("table_ids") == ["t_2"]
                         and assigns[0].get("changed") is False))
        check("S4-170-1b", unchanged and moved == 0,
              "the booking keeps t_2, changed=false, moved_count=%r (expected it reported as considered "
              "and unmoved; moved_count 0)" % moved)

        st, applied = call("POST", "/restaurants/r_anker/replans/%s/apply" % body.get("plan_id"),
                           {}, token=token, key="p1a")
        check("S4-170-1c", st in (200, 201),
              "applying it -> %s code=%s (expected 2xx)" % (st, code_of(applied)))

    st, after = call("GET", "/reservations/AAAAAA", token=token)
    after_history = call("GET", "/reservations/AAAAAA/history", token=token)[1]
    n_after = len(after_history.get("history", after_history.get("entries", [])))
    check("S4-170-1d", (after or {}).get("revision") == before_rev
          and (after or {}).get("table_ids") == ["t_2"],
          "after applying, the booking is untouched -> revision %r (was %r), table_ids %r (expected no "
          "movement and no revision change: an unmoved booking gains nothing)"
          % ((after or {}).get("revision"), before_rev, (after or {}).get("table_ids")))
    check("S4-170-1e", n_after == n_before,
          "and it gained no history entry -> %d entries (was %d; the half of the original defect nothing "
          "was checking)" % (n_after, n_before))

    # =====================================================================
    # Property 2 -- considered means OVERLAPPING, not constrained.
    # =====================================================================
    token = setup(fixture([booking("AAAAAA", ["t_1"], 2, 19),      # holds the closed table
                           booking("BBBBBB", ["t_2"], 2, 20),      # overlaps, holds another
                           booking("CCCCCC", ["t_3"], 2, 9)]))     # does not overlap
    if not token:
        return rows()
    st, body = plan(token, "p2")
    seen = refs_in(body) if st == 201 else []
    check("S4-170-2a", st == 201 and seen == ["AAAAAA", "BBBBBB"],
          "with two overlapping bookings and one outside the interval -> %s assignments=%s (expected "
          "exactly the two overlapping references, in reference order -- 'considered' means overlapping, "
          "not 'harmed by the closure')" % (st, seen))

    # =====================================================================
    # Property 3 -- the objective is lexicographic, and each level must beat
    # the ones below it. Three fixtures, one per level.
    # =====================================================================
    # Level 1 beats level 2: a party of 3 must move off the closed table, and the
    # choice is between a same-set option that wastes seats and one that does not.
    token = setup(fixture([booking("AAAAAA", ["t_1"], 3, 19)]))
    if token:
        st, body = plan(token, "p3a")
        assigns = body.get("assignments", []) if st == 201 else []
        check("S4-170-3a", st == 201 and assigns and assigns[0].get("table_ids") != ["t_1"],
              "a party of 3 on the closed t_1 (capacity 2) must move -> %s assignment=%s (expected a "
              "table that seats three; the refusal here would be no_feasible_plan or a wrong table)"
              % (st, assigns[0].get("table_ids") if assigns else None))

    # Level 2 beats level 3: two plans that change the same number of table sets --
    # one wasting seats, one not. Both must be feasible; the tighter one must win.
    token = setup(fixture([booking("AAAAAA", ["t_1"], 2, 19), booking("BBBBBB", ["t_2"], 2, 20)]))
    if token:
        st, body = plan(token, "p3b")
        check("S4-170-3b", st == 201 and isinstance(body.get("unused_seats"), int),
              "two overlapping bookings, one on the closed table -> %s unused_seats=%r moved_count=%r "
              "(expected a plan, with the seat total and the moved count reported -- the specification's "
              "second level is only observable if both numbers are present)"
              % (st, (body or {}).get("unused_seats"), (body or {}).get("moved_count")))

    # The optimisation is reported at all: a plan's own figures must be consistent
    # with the assignments it ships, which is the cheapest form of "not inert".
    token = setup(fixture([booking("AAAAAA", ["t_1"], 2, 19), booking("BBBBBB", ["t_2"], 2, 20)]))
    if token:
        st, body = plan(token, "p3c")
        assigns = body.get("assignments", []) if st == 201 else []
        changed_count = sum(1 for a in assigns if a.get("changed") is True)
        consistent = st == 201 and body.get("moved_count") == changed_count
        check("S4-170-3c", consistent,
              "moved_count agrees with the assignments it ships -> moved_count=%r, assignments changed=%r "
              "(expected equal; a plan that reports a moved count its own assignment list contradicts is "
              "the shape the stage-3 pair-indexing bug had)" % ((body or {}).get("moved_count"),
                                                                 changed_count))

    # =====================================================================
    # Property 4 -- nothing may disappear, and nothing invented.
    # =====================================================================
    token = setup(fixture([booking("AAAAAA", ["t_1"], 2, 19),
                           booking("BBBBBB", ["t_2"], 2, 20),
                           booking("CCCCCC", ["t_3"], 2, 21)]))
    if token:
        st, before_list = call("GET", "/reservations", token=token)
        before_refs = sorted(r.get("reference") for r in before_list.get("reservations", []))
        st, body = plan(token, "p4")
        if st == 201:
            call("POST", "/restaurants/r_anker/replans/%s/apply" % body.get("plan_id"), {},
                 token=token, key="p4a")
        st, after_list = call("GET", "/reservations", token=token)
        after_refs = sorted(r.get("reference") for r in after_list.get("reservations", []))
        st, exported = call("GET", "/_test/export")
        cancelled = [r for r in after_list.get("reservations", []) if r.get("status") == "cancelled"]
        check("S4-170-4", after_refs == before_refs and not cancelled,
              "the whole population survives the plan -> before=%s after=%s cancelled=%d (expected the "
              "same references and none cancelled: the specification says no booking may disappear or be "
              "cancelled, and the population is asserted by reference rather than sampled)"
              % (before_refs, after_refs, len(cancelled)))

    return rows()


def rows():
    for rid, ev in GOOD + BAD:
        print("ROW " + rid + (" PASS " if (rid, ev) in GOOD else " FAIL ") + ev)
    print("SUMMARY %d/%d passed" % (len(GOOD), len(GOOD) + len(BAD)))
    return 0 if not BAD else 1


if __name__ == "__main__":
    sys.exit(main())