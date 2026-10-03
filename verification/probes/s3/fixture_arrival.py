#!/usr/bin/env python3
"""Stage-3 fixture arrival-path rows at `a69e6ba`, measured. The seed door and the import door, side
by side, because the defect this file exists for was never in either path: it was in their ability to
disagree.

    BASE=http://127.0.0.1:8107 python verification/probes/s3/fixture_arrival.py

Clauses restated at the top of the file because they do not travel into new files by themselves:

 1. assert the injected fault or the setup step actually happened before asserting the reaction;
 4. the service you measure must be the service you started;
 7. assert shape, not value, where the specification names a shape;
 9. distinguish refusal from absence;
11. before reporting a miss, establish that the mutant or the path is reachable;
12. a fixture must express what the row needs and refuse what it cannot;
17. assert the reason a design exists, not only its behaviour;
18. a row that iterates a subset and reports agreement over it is green about a population it never
    touched -- assert the population, not the sample;
20. a fixture that reports success for state it did not seed is worse than one that lacks the
    capability.

Every expected accepted-terms object here is recomputed from the fixture's own restaurant rules by
this file, never read back out of a response, so a row cannot pass by echoing the service's answer.
"""

import copy
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8107")

GOOD = []
BAD = []

TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]
HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]


def derived_policy_zero_terms(restaurant):
    """The terms a booking created under policy 0 accepts, derived HERE from the fixture's own rules.

    `effective_from` is excluded because it chose the policy rather than being a term, and
    `capacities` come from the table list rather than from anything the service computed.
    """
    capacities = {t["id"]: t["capacity"] for t in restaurant["tables"]}
    return {
        "policy_version": 0,
        "slot_minutes": restaurant["slot_minutes"],
        "reservation_duration_minutes": restaurant["reservation_duration_minutes"],
        "cancellation_cutoff_minutes": restaurant["cancellation_cutoff_minutes"],
        "opening_hours": [dict(d) for d in restaurant["opening_hours"]],
        "capacities": capacities,
    }


def base_fixture():
    return {
        "users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                   "display_name": "Ada"}],
        "restaurants": [{
            "id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
            "manager_user_ids": ["u_ada"], "slot_minutes": 30,
            "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
            "opening_hours": HOURS, "tables": copy.deepcopy(TABLES),
        }],
        "reservations": [],
    }


def seeded_fixture(reservation_overrides=None):
    fx = base_fixture()
    restaurant = fx["restaurants"][0]
    fx["reservations"] = [{
        "id": "res_seed", "reference": "SEED0001", "user_id": "u_ada",
        "restaurant_id": "r_anker", "table_ids": ["t_1"], "party_size": 2,
        "starts_at_local": "2026-09-28T18:00",
    }]
    if reservation_overrides:
        fx["reservations"][0].update(reservation_overrides)
    return fx


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


def message_of(body):
    return body.get("error", {}).get("message", "") if isinstance(body, dict) else ""


def rows():
    for rid, ev in GOOD + BAD:
        print("ROW " + rid + (" PASS " if (rid, ev) in GOOD else " FAIL ") + ev)
    print("SUMMARY %d/%d passed" % (len(GOOD), len(GOOD) + len(BAD)))
    return 0 if not BAD else 1


def main():
    derived = derived_policy_zero_terms(base_fixture()["restaurants"][0])

    # ---- setup, asserted before anything is read -----------------------------
    st, _ = call("POST", "/_test/reset", base_fixture())
    check("S3-300-setup", st == 204,
          "POST /_test/reset with no stage-3 keys -> %s (expected 204; asserted first)" % st)
    if st != 204:
        return rows()

    st, before = call("GET", "/_test/export")
    check("S3-300-setup", st == 200,
          "GET /_test/export for the byte-equality baseline -> %s (expected 200)" % st)
    if st != 200:
        return rows()

    # =====================================================================
    # Group 1 -- the four stage-3 keys are refusals, and the door the refusal
    # names is a door that works
    # =====================================================================
    payloads = {
        "policies": [{"effective_from": "2026-06-01", "slot_minutes": 15,
                      "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 60,
                      "opening_hours": HOURS, "capacities": {"t_1": 2, "t_2": 4, "t_3": 6}}],
        "series": [{"id": "ser_x", "restaurant_id": "r_anker", "owner_user_id": "u_ada",
                    "local_time": "20:00", "party_size": 2, "table_ids": ["t_1"],
                    "weekdays": ["mon"], "count": 2, "effective_from": "2026-06-01"}],
        "history": [{"reservation_id": "res_seed", "kind": "created", "table_ids": ["t_1"]}],
        "batch_counters": {"r_anker": 7},
    }
    for key, value in payloads.items():
        fx = base_fixture()
        fx[key] = value
        st, body = call("POST", "/_test/reset", fx)
        named = key in json.dumps(body)
        mentions_import = "import" in message_of(body).lower()
        check("S3-301-" + key,
              st == 422 and code_of(body) == "fixture_unsupported" and named and mentions_import,
              f"fixture declaring {key} -> {st} code={code_of(body)} key named in body={named} "
              f"names the import door={mentions_import} (expected 422 fixture_unsupported)")

    # The refusal must point at a working alternative, not close the capability. A document carrying
    # the four stores still imports, and the export carries them once they hold something -- the
    # stores are absent while empty, so this row is asserted AFTER the import that seeds them and
    # never against an empty state where absence would be indistinguishable from silence.
    st, doc = call("GET", "/_test/export")
    store_keys = ["policies", "series", "history", "batch_counters"]
    check("S3-302a", st == 200 and all(k not in doc for k in store_keys),
          f"the four stores are absent from an export while empty -> {st} absent="
          f"{[k for k in store_keys if k not in doc] if st == 200 else 'no document'} (expected all "
          f"four absent; this is why S3-302b is asserted after the import and not before it)")

    # A document nests its state under `state`. Putting these three stores at the top level instead
    # imports 204 and seeds nothing -- recorded as S3-303a, because a 204 for state that was not read
    # is the same shape as the 204 this file was written about, one level up.
    misplaced = dict(doc)
    misplaced["policies"] = payloads["policies"]
    misplaced["series"] = payloads["series"]
    misplaced["batch_counters"] = payloads["batch_counters"]
    st, body = call("POST", "/_test/import", misplaced)
    st_mis, after_mis_doc = call("GET", "/_test/export")
    after_mis = after_mis_doc.get("state", {}) if st_mis == 200 else {}
    seeded_misplaced = st == 204 and st_mis == 200 and len(after_mis.get("policies", [])) == 1
    check("S3-303a", not seeded_misplaced,
          f"a document carrying the three stores at the TOP level rather than under `state` -> "
          f"import {st}, seeded={seeded_misplaced} policies="
          f"{len(after_mis.get('policies', [])) if st_mis == 200 else '?'} (recorded, not a defect "
          f"claim: unknown top-level fields are ignored, so the 204 is defensible -- but a 204 for "
          f"state that was not read is the same shape as the one a fixture used to give, and a probe "
          f"author placing a key in the wrong place gets the same silence)")

    call("POST", "/_test/reset", base_fixture())
    st, doc = call("GET", "/_test/export")
    importable = copy.deepcopy(doc)
    importable["state"].setdefault("users", [])
    importable["state"].setdefault("restaurants", [])
    importable["state"].setdefault("reservations", [])
    importable["state"]["policies"] = payloads["policies"]
    importable["state"]["series"] = payloads["series"]
    importable["state"]["batch_counters"] = payloads["batch_counters"]
    st, body = call("POST", "/_test/import", importable)
    check("S3-303", st == 204,
          f"a document carrying the state the fixture cannot seed imports -> {st} "
          f"(expected 204; the refusal must name a door that works)")

    st, after_doc = call("GET", "/_test/export")
    after = after_doc.get("state", {}) if st == 200 else {}
    seeded_by_import = st == 200 and len(after.get("policies", [])) == 1 \
        and len(after.get("series", [])) == 1 \
        and after.get("batch_counters", {}).get("r_anker") == 7
    check("S3-304", seeded_by_import,
          f"and that import really seeded the three stores the fixture refused to -> policies="
          f"{len(after.get('policies', []))} series={len(after.get('series', []))} "
          f"batch_counters.r_anker={after.get('batch_counters', {}).get('r_anker')} "
          f"(expected 1 / 1 / 7; a 204 that seeded nothing is the defect this file exists for)")

    carried = st == 200 and all(k in after for k in store_keys if k != "history")
    check("S3-302b", carried,
          f"the export carries the four stores once they hold something -> present="
          f"{[k for k in store_keys if k in after]} (expected policies, series, batch_counters; "
          f"history has no entry to carry, so its absence is not asserted here -- S3-301 already "
          f"asserted the refusal for it)")

    # =====================================================================
    # Group 2 -- the seed path cannot express the booking the import path refuses
    # =====================================================================
    refusable = [
        ("revision-5-null-terms", {"revision": 5, "accepted_terms": None}),
        ("revision-2", {"revision": 2}),
        ("revision-0", {"revision": 0}),
        ("series-id", {"series_id": "ser_x"}),
        ("series-index", {"series_index": 0}),
    ]
    for name, overrides in refusable:
        st, body = call("POST", "/_test/reset", seeded_fixture(overrides))
        check("S3-310-" + name,
              st == 422 and code_of(body) == "fixture_unsupported",
              f"fixture seeding {name} -> {st} code={code_of(body)} (expected 422 "
              f"fixture_unsupported; this is the state the import path was fixed to refuse)")

    bad_terms = copy.deepcopy(derived)
    bad_terms["cancellation_cutoff_minutes"] = derived["cancellation_cutoff_minutes"] + 1
    st, body = call("POST", "/_test/reset",
                    seeded_fixture({"accepted_terms": bad_terms}))
    check("S3-311", st == 422 and code_of(body) == "fixture_unsupported",
          f"fixture whose accepted_terms differ from the derived policy-0 terms by one field -> {st} "
          f"code={code_of(body)} (expected 422; refusing rather than coercing is the requirement)")

    # =====================================================================
    # Group 3 -- what is still accepted, and whether acceptance is on equality
    # or on derivation. These differ the moment the fixture's own rules change.
    # =====================================================================
    st, body = call("POST", "/_test/reset", seeded_fixture({"revision": 1}))
    check("S3-320", st == 204,
          f"a fixture declaring revision 1 explicitly is still accepted -> {st} (expected 204)")

    st, body = call("POST", "/_test/reset", seeded_fixture({"accepted_terms": derived}))
    accepted_identical = st == 204
    check("S3-321", accepted_identical,
          f"a fixture declaring accepted_terms identical to the derived ones -> {st} (expected 204)")

    # Same terms, different key order. The build compares with JSON.stringify, so this is the row
    # that tells us whether acceptance is on equality of the object or on equality of the terms.
    reordered = {k: derived[k] for k in sorted(derived.keys(), reverse=True)}
    st, body = call("POST", "/_test/reset", seeded_fixture({"accepted_terms": reordered}))
    check("S3-322", st == 204,
          f"a fixture declaring the identical terms with the keys in another order -> {st} "
          f"(expected 204; the same terms are the same terms, and a probe author writing them in a "
          f"different order must not be refused for it)")

    # The gate decides only whether to refuse; the derivation is unconditional. The decisive test is
    # to change the rules the terms would be derived from and confirm the stored terms follow the new
    # rules rather than the object the fixture declared -- because a declared object that merely
    # equals yesterday's derivation is the only way this could diverge.
    other_rules = base_fixture()
    other_rules["restaurants"][0]["slot_minutes"] = 15
    other_rules["restaurants"][0]["cancellation_cutoff_minutes"] = 45
    other_rules_derived = derived_policy_zero_terms(other_rules["restaurants"][0])

    def seeded_fixture_with_rules(rules_fixture, reservation_overrides=None):
        """A seeded fixture whose RESTAURANT carries the given rules.

        Deriving terms for one restaurant's rules and offering them against another is the Builder's
        cross-restaurant case; this is the same comparison inside one restaurant, which is the only
        way to change what the derivation IS rather than which restaurant it came from.
        """
        fx = copy.deepcopy(rules_fixture)
        fx["reservations"] = [{
            "id": "res_seed", "reference": "SEED0001", "user_id": "u_ada",
            "restaurant_id": "r_anker", "table_ids": ["t_1"], "party_size": 2,
            "starts_at_local": "2026-09-28T18:00",
        }]
        if reservation_overrides:
            fx["reservations"][0].update(reservation_overrides)
        return fx
    st, body = call("POST", "/_test/reset",
                    seeded_fixture_with_rules(other_rules,
                                              {"accepted_terms": other_rules_derived}))
    accepted_new_rules = st == 204
    check("S3-323", accepted_new_rules,
          f"a fixture declaring terms derived from DIFFERENT restaurant rules -> {st} "
          f"(expected 204; the gate refuses only what disagrees with the derivation it just "
          f"computed, so the declared object must be measured against the current rules)")

    call("POST", "/_test/reset",
         seeded_fixture_with_rules(other_rules, {"accepted_terms": other_rules_derived}))
    st, seeded_other = call("GET", "/reservations/SEED0001", token=login())
    check("S3-324", st == 200 and seeded_other.get("accepted_terms") == other_rules_derived,
          f"the stored terms equal this file's derivation for the rules that were actually in force -> "
          f"equal={st == 200 and seeded_other.get('accepted_terms') == other_rules_derived} "
          f"stored={json.dumps(seeded_other.get('accepted_terms'), sort_keys=True) if st == 200 else None} "
          f"derived={json.dumps(other_rules_derived, sort_keys=True)} (expected the 15-minute / 45 "
          f"derivation; if the declared object were the source, the stored terms would be the old ones "
          f"and this row would be red while every other row stayed green)")

    # Canonical comparison must reach inside the terms, not just the top level.
    nested = copy.deepcopy(other_rules_derived)
    nested["opening_hours"] = [dict(reversed(list(d.items()))) for d in nested["opening_hours"]]
    nested["capacities"] = {k: nested["capacities"][k] for k in reversed(list(nested["capacities"]))}
    st, body = call("POST", "/_test/reset",
                    seeded_fixture_with_rules(other_rules, {"accepted_terms": nested}))
    check("S3-325", st == 204,
          f"the same terms with the keys of every nested object also reordered -> {st} (expected 204; "
          f"a canonical comparison that only sorted the top level would refuse a correct fixture, "
          f"which is the false refusal this file recorded at a69e6ba)")

    st, body = call("POST", "/_test/reset",
                    seeded_fixture_with_rules(other_rules, {"accepted_terms": nested,
                                                             "revision": 3}))
    check("S3-326", st == 422 and code_of(body) == "fixture_unsupported",
          f"canonicalisation did not weaken the refusal -> {st} code={code_of(body)} (expected 422; "
          f"the fix must make the comparison key-order independent WITHOUT making it permissive)")

    # =====================================================================
    # Group 4 -- an ordinary seeded booking carries the DERIVED terms, and the
    # seed door and the import door agree about it. This is the differential row:
    # equality against my own recomputation cannot pass by echo, and the import
    # comparison is what makes "derived" observable rather than asserted.
    # =====================================================================
    st, _ = call("POST", "/_test/reset", seeded_fixture())
    if st != 204:
        check("S3-330-setup", False, f"ordinary seeded fixture -> {st} (expected 204)")
        return rows()
    check("S3-330-setup", True, "ordinary seeded fixture resets 204")

    st, seeded = call("GET", "/reservations/SEED0001", token=login())
    check("S3-330", st == 200 and isinstance(seeded, dict) and "reference" in seeded,
          f"the seeded reservation reads back by reference -> {st} keys="
          f"{sorted(seeded.keys()) if isinstance(seeded, dict) else None} (expected 200 with a "
          f"reservation object; a 404 here would be a refusal row, not a lookup row)")

    st_list, listing = call("GET", "/reservations", token=login())
    listed = st_list == 200 and any(r.get("reference") == "SEED0001"
                                    for r in listing.get("reservations", []))
    check("S3-330b", listed,
          f"and it appears in the owner's listing -> {st_list} listed={listed} (expected 200 and "
          f"listed; two doors to the same booking, so neither alone is the population)")

    if seeded is not None:
        check("S3-331", seeded.get("revision") == 1,
              f"a seeded booking starts at revision 1, read from the service -> "
              f"{seeded.get('revision')} (expected 1)")

        terms = seeded.get("accepted_terms")
        check("S3-332", terms == derived,
              f"the seeded booking's accepted_terms equal this file's own derivation from the "
              f"fixture rules -> equal={terms == derived} service={json.dumps(terms, sort_keys=True)} "
              f"derived={json.dumps(derived, sort_keys=True)}")

        check("S3-333", terms is not None and "effective_from" not in terms,
              f"effective_from is absent from accepted_terms -> "
              f"{terms is not None and 'effective_from' not in terms} (it chose the policy; it is "
              f"not a term the diner accepted)")

    st, doc = call("GET", "/_test/export")
    if st == 200:
        st2, _ = call("POST", "/_test/reset", base_fixture())
        st3, body = call("POST", "/_test/import", doc)
        imported = None
        if st3 == 204:
            st4, imported = call("GET", "/reservations/SEED0001", token=login())
            if st4 != 200:
                imported = None
        agree = imported is not None and seeded is not None \
            and imported.get("accepted_terms") == seeded.get("accepted_terms") \
            and imported.get("revision") == seeded.get("revision")
        check("S3-334", st3 == 204 and agree,
              f"the same booking through the other door -> import {st3}, seed vs import "
              f"terms agree={imported is not None and seeded is not None and imported.get('accepted_terms') == seeded.get('accepted_terms')} "
              f"revision agree={imported is not None and seeded is not None and imported.get('revision') == seeded.get('revision')} "
              f"(expected 204 and equality; the two arrival paths computing the same derived value "
              f"is the requirement, and a differential row must also assert that both were reached)")
    else:
        check("S3-334", False, f"GET /_test/export for the import comparison -> {st} (expected 200)")

    # =====================================================================
    # Group 5 -- a refused fixture changes nothing at all
    # =====================================================================
    st, _ = call("POST", "/_test/reset", seeded_fixture())
    st, baseline = call("GET", "/_test/export")
    for key in ("policies", "batch_counters"):
        fx = seeded_fixture()
        fx[key] = payloads[key]
        st, body = call("POST", "/_test/reset", fx)
        st_now, now = call("GET", "/_test/export")
        check("S3-340-" + key,
              st == 422 and st_now == 200
              and json.dumps(now, sort_keys=True) == json.dumps(baseline, sort_keys=True),
              f"a fixture refused for {key} leaves the whole state byte-equal -> reset {st}, "
              f"export unchanged={json.dumps(now, sort_keys=True) == json.dumps(baseline, sort_keys=True)} "
              f"(a refusal that half-applies is worse than no refusal)")

    st, body = call("POST", "/_test/reset", seeded_fixture({"revision": 2, "policies": []}))
    st_now, now = call("GET", "/_test/export")
    check("S3-341", st == 422 and st_now == 200
          and json.dumps(now, sort_keys=True) == json.dumps(baseline, sort_keys=True),
          f"a fixture carrying two refusable faults is refused once and changes nothing -> reset {st}, "
          f"export unchanged={json.dumps(now, sort_keys=True) == json.dumps(baseline, sort_keys=True)}")

    return rows()


def login():
    st, body = call("POST", "/auth/login",
                    {"email": "ada@example.com", "password": "correct horse"})
    return body.get("token") if st == 200 else None


if __name__ == "__main__":
    sys.exit(main())