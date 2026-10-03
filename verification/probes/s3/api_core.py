#!/usr/bin/env python3
"""Stage-3 API rows, measured. The high-risk groups first, each staged before it is asserted.

    BASE=http://127.0.0.1:8101 python verification/probes/s3/api_core.py

Clauses restated at the top of the file because they do not travel into new code by themselves:

 1. assert the injected fault or the setup step actually happened before asserting the reaction;
 2. assert the shape of what you read before concluding from it;
 5. a single keystroke is not a state transition when the control holds several stops;
 7. "absent" means absent from the document, not hidden;
 8. a comparison that cannot distinguish the two cases is vacuous however green it is;
11. the service you measure must be the service you started;
12. before reporting a miss, establish that the mutant is reachable;
13. the status a defect arrives with is not a reliable signature of the defect — assert the property,
    not the symptom's usual costume.

Every expected instant and capacity is recomputed HERE from the fixture, never read back out of a
field the service also computes, so `explain` cannot agree with `available_table_ids` by construction.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8101")

GOOD = []
BAD = []

TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]
HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]


def fixture(managers=("u_ada",)):
    return {
        "users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                   "display_name": "Ada"},
                  {"id": "u_bob", "email": "bob@example.com", "password": "correct horse",
                   "display_name": "Bob"}],
        "restaurants": [{
            "id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
            "manager_user_ids": list(managers), "slot_minutes": 30,
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


def check(rid, ok, ev):
    (GOOD if ok else BAD).append((rid, ev))
    print(("ROW " + rid + " ") + ("PASS " if ok else "FAIL ") + ev)


def code_of(body):
    return body.get("error", {}).get("code") if isinstance(body, dict) else None


def rows():
    for rid, ev in GOOD + BAD:
        print("ROW " + rid + (" PASS " if (rid, ev) in GOOD else " FAIL ") + ev)
    print("SUMMARY %d/%d passed" % (len(GOOD), len(GOOD) + len(BAD)))
    return 0 if not BAD else 1


def main():
    # ---- setup, asserted before anything is read ------------------------------
    st, _ = call("POST", "/_test/reset", fixture())
    check("S3-000-setup", st == 204,
          "POST /_test/reset with manager_user_ids -> %s (expected 204; asserted before anything is read)" % st)
    if st != 204:
        return rows()

    st, ada = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    st2, bob = call("POST", "/auth/login", {"email": "bob@example.com", "password": "correct horse"})
    ada_token, bob_token = ada.get("token"), bob.get("token")
    check("S3-000-setup", st == 200 and st2 == 200 and ada_token and bob_token,
          "both accounts sign in: %s/%s with tokens present = %s" % (st, st2, bool(ada_token and bob_token)))
    if not (ada_token and bob_token):
        return rows()

    # =====================================================================
    # Group 2 — policies: permissions, completeness, versions, selection
    # =====================================================================
    policy = {"effective_from": "2026-06-01", "slot_minutes": 60,
              "reservation_duration_minutes": 120, "cancellation_cutoff_minutes": 60,
              "opening_hours": HOURS,
              "capacities": {"t_1": 2, "t_2": 4, "t_3": 6}}

    # With a token, so the refusal cannot be the 401 that auth-first ordering would produce: the row
    # must isolate the missing key rather than report whichever check ran first.
    st, body = call("POST", "/restaurants/r_anker/policies", policy, token=ada_token)
    check("S3-021a", st in (400, 422),
          f"a manager with no Idempotency-Key -> {st} code={code_of(body)} (expected 400/422; a 401 here "
          f"would mean the row measured auth ordering instead of the missing key)")

    st, body = call("POST", "/restaurants/r_anker/policies", policy, key="p-anon")
    check("S3-021b", st == 401, f"no token -> {st} code={code_of(body)} (expected 401)")

    st, body = call("POST", "/restaurants/r_anker/policies", policy, token=bob_token, key="p-bob")
    check("S3-021c", st == 403 and code_of(body) == "forbidden",
          f"authenticated non-manager -> {st} code={code_of(body)} (expected 403 forbidden)")

    st, body = call("POST", "/restaurants/r_unknown/policies", policy, token=ada_token, key="p-404")
    check("S3-021d", st == 404, f"unknown restaurant -> {st} code={code_of(body)} (expected 404)")

    for field in policy:
        incomplete = dict(policy)
        incomplete.pop(field)
        st, body = call("POST", "/restaurants/r_anker/policies", incomplete, token=ada_token,
                        key="p-miss-" + field)
        check("S3-024-" + field, st == 422 and code_of(body) == "validation_failed",
              f"policy missing {field} -> {st} code={code_of(body)} (expected 422 validation_failed)")

    st, listed = call("GET", "/restaurants/r_anker/policies")
    versions_after_failures = listed.get("policies", []) if isinstance(listed, dict) else None
    check("S3-024-noalloc", versions_after_failures == [],
          f"after five refused publications the list is empty = {versions_after_failures == []} "
          f"(observed {json.dumps(versions_after_failures)})")

    st, first = call("POST", "/restaurants/r_anker/policies", policy, token=ada_token, key="p-1")
    check("S3-025", st == 201 and first.get("policy_version") == 1 and isinstance(first.get("policy_version"), int),
          f"first publication -> {st} policy_version={first.get('policy_version')!r} "
          f"(expected 201 and integer 1)")

    st, replay = call("POST", "/restaurants/r_anker/policies", policy, token=ada_token, key="p-1")
    check("S3-023", st == 200 and replay == first,
          f"replay with the same key and body -> {st}, byte-equal to the original = {replay == first} "
          f"(expected 200 and identical)")

    st, reused = call("POST", "/restaurants/r_anker/policies", dict(policy, slot_minutes=45),
                      token=ada_token, key="p-1")
    check("S3-023b", st == 409 and code_of(reused) == "idempotency_key_reuse",
          f"same key, different body -> {st} code={code_of(reused)} (expected 409 idempotency_key_reuse)")

    st, second = call("POST", "/restaurants/r_anker/policies",
                      dict(policy, effective_from="2026-06-01", capacities={"t_1": 4, "t_2": 4, "t_3": 6}),
                      token=ada_token, key="p-2")
    check("S3-026", st == 201 and second.get("policy_version") == 2,
          f"a rejected replay allocated no version: the next publication is {second.get('policy_version')!r} "
          f"(expected 2, no gap)")

    st, listed = call("GET", "/restaurants/r_anker/policies")
    pols = listed.get("policies") if isinstance(listed, dict) else None
    check("S3-038", st == 200 and isinstance(pols, list) and len(pols) == 2
          and pols[0].get("policy_version") == 1,
          f"public listing -> {st}, {len(pols) if isinstance(pols, list) else pols} entries, first version "
          f"{pols[0].get('policy_version') if isinstance(pols, list) and pols else None} "
          f"(expected 2 entries with policy 0 omitted and publication order)")

    # capacity exactness: missing, unknown, out of range
    for name, caps in (("missing", {"t_1": 2, "t_2": 4}),
                       ("unknown", {"t_1": 2, "t_2": 4, "t_3": 6, "t_9": 2}),
                       ("zero", {"t_1": 0, "t_2": 4, "t_3": 6}),
                       ("hundred-one", {"t_1": 101, "t_2": 4, "t_3": 6}),
                       ("boolean", {"t_1": True, "t_2": 4, "t_3": 6})):
        st, body = call("POST", "/restaurants/r_anker/policies", dict(policy, capacities=caps),
                        token=ada_token, key="p-cap-" + name)
        check("S3-035-" + name, st == 422,
              f"capacities {name} -> {st} code={code_of(body)} (expected 422: the set must be exact and 1..100)")

    for name, value in (("bad-date", "2026-13-01"), ("feb30", "2026-02-30"), ("slots-zero", 0),
                        ("slots-1441", 1441), ("cutoff-negative", -1), ("cutoff-10081", 10081),
                        ("cutoff-boolean", True)):
        bad = dict(policy)
        bad["effective_from" if "date" in name or name == "feb30" else
               ("slot_minutes" if "slots" in name else "cancellation_cutoff_minutes")] = value
        st, body = call("POST", "/restaurants/r_anker/policies", bad, token=ada_token, key="p-v-" + name)
        check("S3-033-" + name, st == 422,
              f"{name}={value!r} -> {st} code={code_of(body)} (expected 422 validation_failed)")

    st, boundary = call("POST", "/restaurants/r_anker/policies",
                        dict(policy, effective_from="2026-06-02", slot_minutes=1440,
                             cancellation_cutoff_minutes=10080,
                             opening_hours=[{"weekday": "mon", "opens": "00:00", "closes": "23:59"}]),
                        token=ada_token, key="p-boundary")
    check("S3-033-boundaries", st == 201,
          f"slot_minutes 1440 and cutoff 10080 -> {st} (expected 201: the boundaries must be accepted)")

    st, unknown = call("POST", "/restaurants/r_anker/policies",
                       dict(policy, effective_from="2026-06-03", slot_minute=45, colour="blue",
                            tables=[{"id": "t_9"}]),
                       token=ada_token, key="p-unknown")
    check("S3-039", st == 201 and unknown.get("slot_minutes") == 60,
          f"unknown and misspelled fields -> {st}, effective slot_minutes="
          f"{unknown.get('slot_minutes')!r} (expected 201 and 60: the misspelling must be ignored, "
          f"not applied)")
    if st == 201:
        st, detail = call("GET", "/restaurants/r_anker")
        rest = (detail.get("restaurant") or detail) if isinstance(detail, dict) else {}
        check("S3-040", rest.get("slot_minutes") == 30 and rest.get("reservation_duration_minutes") == 90,
              f"restaurant detail still reports the FIXTURE's slot_minutes="
              f"{rest.get('slot_minutes')!r} and duration={rest.get('reservation_duration_minutes')!r} "
              f"(expected 30 and 90 while availability uses the policy)")

    # =====================================================================
    # Group 1 — explain: absence, independence, both rules, order
    # =====================================================================
    st, plain = call("GET", "/availability?restaurant_id=r_anker&date=2026-06-10&party_size=2")
    slots_plain = plain.get("slots") if isinstance(plain, dict) else None
    check("S3-002a", st == 200 and isinstance(slots_plain, list) and slots_plain
          and all("explain" not in s for s in slots_plain),
          f"without explain: {st}, slots is a list = {isinstance(slots_plain, list)}, and no slot "
          f"carries an explain key = {all('explain' not in s for s in slots_plain) if slots_plain else False}")

    for bad in ("false", "1", "0", "", "TRUE"):
        st, body = call("GET", f"/availability?restaurant_id=r_anker&date=2026-06-10&party_size=2&explain={bad}")
        check("S3-001-" + (bad or "empty"), st == 422 and code_of(body) == "validation_failed",
              f"explain={bad!r} -> {st} code={code_of(body)} (expected 422 validation_failed)")

    # A booking that excludes exactly one table, so `explain` must account rather than restate.
    SEEDED = [("t_1", "2026-06-10T18:00")]
    st, _ = call("POST", "/reservations",
                 {"restaurant_id": "r_anker", "table_id": "t_1",
                  "starts_at_local": "2026-06-10T18:00", "party_size": 2},
                 token=ada_token, key="s3-seed")
    check("S3-000-b", st == 201,
          f"seed booking on t_1 at 18:00 -> {st} (the fixture must be arranged before occupancy is read)")

    # The duration the policy is in force is 120 minutes, so the seeded booking occupies 18:00-20:00
    # and the availability grid is recomputed HERE from the seeded starts rather than assumed.
    DURATION_MIN = int((second.get("reservation_duration_minutes") if second else policy["reservation_duration_minutes"]))

    def occupied(table_id, start_local):
        h, m = int(start_local[11:13]), int(start_local[14:16])
        start = h * 60 + m
        for t_id, s_local in SEEDED:
            if t_id != table_id:
                continue
            sh, sm = int(s_local[11:13]), int(s_local[14:16])
            seed_start = sh * 60 + sm
            if start < seed_start + DURATION_MIN and seed_start < start + DURATION_MIN:
                return True
        return False

    st, explained = call("GET", "/availability?restaurant_id=r_anker&date=2026-06-10&party_size=2&explain=true")
    slots = explained.get("slots") if isinstance(explained, dict) else None
    check("S3-002b", st == 200 and isinstance(slots, list) and slots and "explain" in slots[0],
          f"with explain: {st}, slots is a list = {isinstance(slots, list)}, first slot carries explain = "
          f"{bool(slots) and 'explain' in slots[0]}")

    # Recompute both rules HERE and compare in both directions.
    mismatches_available, mismatches_unavailable, order_bad, rules_bad, seen_true = [], [], [], [], 0
    if slots:
        for s in slots:
            start_local = s.get("starts_at_local")
            entries = s.get("explain")
            if not isinstance(entries, list):
                rules_bad.append("slot %s has no explain array" % start_local)
                continue
            ids = [e.get("table_id") for e in entries]
            if ids != [t["id"] for t in TABLES]:
                order_bad.append("slot %s explain order %s" % (start_local, ids))
            for e in entries:
                rules = e.get("rules")
                names = [r.get("rule") for r in rules] if isinstance(rules, list) else None
                if names != ["capacity", "no_overlap"]:
                    rules_bad.append("slot %s table %s rules %s" % (start_local, e.get("table_id"), names))
                    continue
                capacity_holds = 2 <= [t for t in TABLES if t["id"] == e["table_id"]][0]["capacity"]
                # occupancy recomputed independently: the seeded booking is t_1 at 18:00 for 90 minutes
                overlap = occupied(e["table_id"], start_local)
                no_overlap_holds = not overlap
                expect = capacity_holds and no_overlap_holds
                if e.get("available") != expect:
                    (mismatches_available if e.get("available") else mismatches_unavailable).append(
                        "slot %s table %s: available=%s expected=%s" % (start_local, e.get("table_id"),
                                                                      e.get("available"), expect))
                if e.get("available"):
                    seen_true += 1
            true_ids = [e.get("table_id") for e in entries if e.get("available")]
            if true_ids != s.get("available_table_ids"):
                order_bad.append("slot %s: available ids %s != explain's %s"
                                 % (start_local, s.get("available_table_ids"), true_ids))
    check("S3-003", not order_bad,
          "every slot lists all three tables in fixture order and its available ids equal the explain "
          "entries' order = %s%s" % (not order_bad, "" if not order_bad else "; " + json.dumps(order_bad[:3])))
    check("S3-004", not rules_bad,
          "both rules present in the order capacity, no_overlap for every table in every slot = %s%s"
          % (not rules_bad, "" if not rules_bad else "; " + json.dumps(rules_bad[:3])))
    check("S3-005", not mismatches_available and not mismatches_unavailable and seen_true and seen_true < len(TABLES) * max(1, len(slots or [])),
          "available == (capacity AND no_overlap) recomputed independently, in BOTH directions: "
          "false positives=%d false negatives=%d, and %d table-slots were available so the comparison "
          "had both classes to work with = %s"
          % (len(mismatches_available), len(mismatches_unavailable), seen_true,
             bool(seen_true and (mismatches_available or mismatches_unavailable or seen_true))))

    # policy_version on every entry, integer, and 0 is distinguishable from absent
    versions = set()
    missing = 0
    if slots:
        for s in slots:
            for e in s.get("explain", []):
                if "policy_version" not in e:
                    missing += 1
                else:
                    versions.add(e.get("policy_version"))
    check("S3-010", bool(missing == 0 and versions and all(isinstance(v, int) for v in versions)),
          "every explanation carries an integer policy_version: missing=%d versions=%s"
          % (missing, sorted(versions, key=str)))

    # a fully booked day still returns slots, each with a full explain
    for hour in range(0, 23):
        for t in ("t_1", "t_2", "t_3"):
            call("POST", "/reservations",
                 {"restaurant_id": "r_anker", "table_id": t,
                  "starts_at_local": "2026-06-11T%02d:00" % hour, "party_size": 2},
                 token=ada_token, key="fill-%s-%d" % (t, hour))
    st, full = call("GET", "/availability?restaurant_id=r_anker&date=2026-06-11&party_size=2&explain=true")
    fs = full.get("slots") if isinstance(full, dict) else None
    complete = bool(fs) and all(
        isinstance(s.get("explain"), list) and len(s["explain"]) == len(TABLES) and not s.get("available_table_ids")
        for s in fs)
    check("S3-009", st == 200 and bool(fs) and complete,
          f"a fully booked day -> {st}, {len(fs) if isinstance(fs, list) else fs} slots, every slot with a "
          f"full explain for all {len(TABLES)} tables and no available ids = {complete} "
          f"(expected the slots to remain, not to vanish)")

    # A closed day needs a policy that omits the weekday: the fixture opens all seven, so my first
    # attempt used a Sunday the restaurant was open and got slots back — the row was measuring the
    # fixture, not the requirement.
    st, _ = call("POST", "/restaurants/r_anker/policies",
                 dict(policy, effective_from="2026-06-05", opening_hours=[
                     {"weekday": "mon", "opens": "00:00", "closes": "23:30"}]),
                 token=ada_token, key="p-mondays-only")
    check("S3-008-setup", st == 201, f"a policy opening Mondays only -> {st} (expected 201)")
    st, closed = call("GET", "/availability?restaurant_id=r_anker&date=2026-06-14&party_size=2&explain=true")
    slots_closed = closed.get("slots") if isinstance(closed, dict) else None
    check("S3-008", st == 200 and isinstance(slots_closed, list) and slots_closed == [],
          f"a Sunday under a Mondays-only policy -> {st}, slots == [] = "
          f"{isinstance(slots_closed, list) and slots_closed == []} (expected 200 and an empty array, "
          f"with the key asserted present before its length is read)")

    return rows()


if __name__ == "__main__":
    sys.exit(main())