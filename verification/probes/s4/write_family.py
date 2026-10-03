#!/usr/bin/env python3
"""The write family's REQUEST SHAPE, measured from outside at a pinned hash.

    BASE=http://127.0.0.1:8114 python verification/probes/s4/write_family.py

This file exists because of a finding at `2a88cc6`: the service answered `400 malformed_request` to the
body shape the stage-4 specification prints, and `201` to a shape nobody had written down. Nothing in this
file reads a supplied check — the specification is the source, and a wrong payload is observable by anyone
with a running service.

Clauses restated at the top of the file because they do not travel into new files by themselves:

 1. assert the setup happened, and that it can fail, before reading anything;
 4. the service you measure must be the service you started;
 7. assert shape, not value, where the specification names a shape;
 9. distinguish refusal from absence -- a 400 on a body is not a missing route;
11. before reporting a miss, establish the path is reachable;
34b. a route's request shape is specified in the stage's own specification.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8114")

GOOD = []
BAD = []

HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]


def fixture():
    return {"users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                       "display_name": "Ada"}],
            "restaurants": [{"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
                             "manager_user_ids": ["u_ada"], "slot_minutes": 30,
                             "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
                             "opening_hours": HOURS, "tables": TABLES}],
            "reservations": []}


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


SPEC_BODY = {"table_id": "t_2",
             "from": "2026-09-28T18:00:00+02:00",
             "to": "2026-09-28T23:00:00+02:00"}


def main():
    st, _ = call("POST", "/_test/reset", fixture())
    check("S4-150-setup", st == 204,
          "POST /_test/reset -> %s (expected 204; asserted before anything is read)" % st)
    if st != 204:
        return rows()
    st, body = call("POST", "/auth/login", {"email": "ada@example.com",
                                            "password": "correct horse"})
    token = body.get("token") if st == 200 else None
    check("S4-150-setup", st == 200 and token, "manager signs in -> %s" % st)
    if not token:
        return rows()

    # The specification's shape, verbatim. A 400 here is a defect against a documented requirement,
    # not a disagreement about taste -- so the row asserts the status AND that the route was reached,
    # because a 404 would mean something else entirely and the two were once confused in this project.
    st, body = call("POST", "/restaurants/r_anker/replans", SPEC_BODY, token=token, key="sp-1")
    reached = st != 404
    check("S4-150-shape", st in (200, 201) and reached,
          "the body the specification prints (table_id, from, to) -> %s code=%s reached=%s (expected "
          "2xx; a 404 would mean the route is missing, a 400 that the documented body is unreadable)"
          % (st, code_of(body), reached))

    # Found by the walk (question 1) against my own file: this row used to be CONDITIONAL on the plan
    # succeeding, so the documented apply body was only asserted when the preview happened to work -- a row
    # that vanishes when the thing it checks is broken, which is the coverage-debt shape in miniature.
    # It now fails when there is no plan to apply.
    check("S4-150-plan", isinstance(body, dict) and bool(body.get("plan_id")),
          "the preview returned a plan_id -> %r (expected one; without it the apply rows below cannot "
          "run, and a row that cannot run must fail rather than be skipped)" % (body or {}).get("plan_id"))
    plan_id = (body or {}).get("plan_id")
    if plan_id:
        st2, applied = call("POST", "/restaurants/r_anker/replans/%s/apply" % plan_id,
                            {}, token=token, key="ap-1")
        check("S4-150-apply-shape", st2 in (200, 201),
              "apply with the specification's empty body -> %s code=%s (expected 2xx; the apply body is "
              "`{}` and nothing else)" % (st2, code_of(applied)))
        keys = sorted(applied.keys()) if isinstance(applied, dict) else []
        expected_keys = sorted(["plan_id", "restaurant_revision", "reservations"])
        check("S4-150-apply-keys", keys == expected_keys,
              "the 201 body's key set -> %s (expected exactly plan_id, restaurant_revision, "
              "reservations -- asserted as a shape because the specification names a shape; the "
              "expected list is sorted too, because a probe that sorts the actual and not the expected "
              "fails on the alphabet rather than on the shape)" % keys)

    # The validation the specification names, on the documented body: no offset, reversed interval.
    for name, override in (("naive-instants", {"from": "2026-09-28T18:00:00",
                                               "to": "2026-09-28T23:00:00"}),
                           ("reversed", {"from": "2026-09-28T23:00:00+02:00",
                                         "to": "2026-09-28T18:00:00+02:00"})):
        bad = dict(SPEC_BODY)
        bad.update(override)
        st, resp = call("POST", "/restaurants/r_anker/replans", bad, token=token, key="v-" + name)
        check("S4-150-invalid-" + name, st == 422 and code_of(resp) == "validation_failed",
              "%s interval -> %s code=%s (expected 422 validation_failed; the specification says the "
              "instants carry explicit offsets and from < to)" % (name, st, code_of(resp)))

    st, resp = call("POST", "/restaurants/r_anker/replans",
                    dict(SPEC_BODY, table_id="t_unknown"), token=token, key="v-unknown")
    check("S4-150-unknown-table", st == 404,
          "unknown table -> %s code=%s (expected 404; a refusal about the table, not the body)"
          % (st, code_of(resp)))

    return rows()


def rows():
    for rid, ev in GOOD + BAD:
        print("ROW " + rid + (" PASS " if (rid, ev) in GOOD else " FAIL ") + ev)
    print("SUMMARY %d/%d passed" % (len(GOOD), len(GOOD) + len(BAD)))
    return 0 if not BAD else 1


if __name__ == "__main__":
    sys.exit(main())
