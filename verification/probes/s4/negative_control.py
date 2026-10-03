#!/usr/bin/env python3
"""Negative control: prove that the stage-4 rows in this directory CAN fail.

    BASE=http://127.0.0.1:8116 python verification/probes/s4/negative_control.py

A green surface is a count, and a count is not a coverage claim. The Foreman asked for one row declared
unable to fail rather than a green surface described as thorough — so this file takes the same requests the
positive rows make and asserts the WRONG answer, and the test is that each one is reported FAIL. If any of
these passed, the corresponding positive row would be a row that cannot fail and the surface would be
describing agreement rather than behaviour.

It asserts nothing about the product: it asserts about my own probes.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8116")

HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]
SPEC_BODY = {"table_id": "t_2",
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


def expect_fail(rid, description, condition_that_should_be_false):
    ok = not condition_that_should_be_false
    RESULTS.append((rid, ok))
    print(("ROW " + rid + " ") + ("PASS " if ok else "FAIL ")
          + ("a deliberately wrong expectation was reported FAIL as it must be: " + description))


def main():
    fx = {"users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                     "display_name": "Ada"}],
          "restaurants": [{"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
                           "manager_user_ids": ["u_ada"], "slot_minutes": 30,
                           "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
                           "opening_hours": HOURS, "tables": TABLES}],
          "reservations": []}
    st, _ = call("POST", "/_test/reset", fx)
    if st != 204:
        print("setup failed: reset -> %s" % st)
        return 1
    st, body = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    token = body.get("token")
    if not token:
        print("setup failed: login -> %s" % st)
        return 1

    # 1. The status write_family asserts. If 404 were what this request produced, its row would be
    #    vacuous -- so assert 404 is false and require the negative to hold.
    st, resp = call("POST", "/restaurants/r_anker/replans", SPEC_BODY, token=token, key="nc-1")
    expect_fail("NC-001", "the documented replans body was NOT refused as 404 (got %s)" % st,
                st == 404)

    # 2. The 201 body key set, mis-specified on purpose.
    st, resp = call("POST", "/restaurants/r_anker/replans", SPEC_BODY, token=token, key="nc-2")
    keys = sorted(resp.keys()) if isinstance(resp, dict) and "error" not in resp else []
    # A deliberately wrong key set -- the shape the pre-conformance build actually returned, with
    # `moves` and `policy_version` in place of `assignments` and `restaurant_revision`. Asserting that
    # this build returns THAT would be the vacuous version of the shape row.
    wrong = sorted(["plan_id", "closure", "moves", "policy_version", "created_at"])
    expect_fail("NC-002", "the 201 body does NOT carry the pre-conformance shape %s (got %s)"
                % (wrong, keys), keys == wrong)

    # 3. The validation rows: the wrong expectations are that all three refusals are 400.
    codes = {}
    for name, override in (("naive", {"from": "2026-09-28T18:00:00", "to": "2026-09-28T23:00:00"}),
                           ("reversed", {"from": "2026-09-28T23:00:00+02:00",
                                         "to": "2026-09-28T18:00:00+02:00"}),
                           ("unknown", {"table_id": "t_nope"})):
        b = dict(SPEC_BODY)
        b.update(override)
        s, r = call("POST", "/restaurants/r_anker/replans", b, token=token, key="nc-" + name)
        codes[name] = s
    expect_fail("NC-003", "the three specified refusals are not all 400 (got %s) -- if they were, the "
                          "422/422/404 rows would be vacuous" % codes,
                codes["naive"] == 400 and codes["reversed"] == 400 and codes["unknown"] == 400)

    # 4. day_state: the discriminator's rows distinguish states; assert that a shut day is NOT open.
    narrow = {"restaurant_id": "r_anker", "policy_version": 3, "effective_from": "2026-06-01",
              "slot_minutes": 15, "reservation_duration_minutes": 90,
              "cancellation_cutoff_minutes": 60,
              "opening_hours": [{"weekday": w, "opens": "00:00", "closes": "23:30"}
                                for w in ["mon", "tue", "wed", "thu", "fri", "sat"]],
              "capacities": {"t_1": 2, "t_2": 4, "t_3": 6}}
    fx2 = dict(fx)
    fx2["policies"] = [narrow]
    call("POST", "/_test/reset", fx2)
    st, av = call("GET", "/availability?restaurant_id=r_anker&date=2026-12-06&party_size=2&explain=true")
    expect_fail("NC-004", "a day whose policy omits Sunday is NOT reported open (got %r)"
                % av.get("day_state"), av.get("day_state") == "open")

    good = [r for r, ok in RESULTS if ok]
    bad = [r for r, ok in RESULTS if not ok]
    print("SUMMARY %d/%d passed" % (len(good), len(RESULTS)))
    print("NEGATIVE CONTROL: %d rows proven capable of failing" % len(good))
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
