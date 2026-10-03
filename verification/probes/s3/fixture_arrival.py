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
    # Group 1 -- the four stage-3 keys are SEEDED at 1e56016+, not refused.
    #
    # Re-worded at the stage-4 fixture door. These rows were written against the door that REFUSED
    # them (a69e6ba) and they went red when option 1 made them seedable -- which is the ruled change,
    # not a defect. A row that outlives its subject is a row asserting a shape nothing produces, so
    # they now assert the thing that IS true and that the stage-4 rows need: a fixture that declares
    # stage-3 state seeds it, and the state is then really there. The refusal rows moved to Group 2,
    # which is where the refusal set now lives.
    payloads = {
        "policies": [{"restaurant_id": "r_anker", "policy_version": 7,
                      "effective_from": "2026-06-01", "slot_minutes": 15,
                      "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 60,
                      "opening_hours": HOURS, "capacities": {"t_1": 2, "t_2": 4, "t_3": 6}}],
        # A series' occurrence references must be SEEDED reservations -- discovered by being refused
        # with "the booking reference you entered is not valid" for a series whose occurrences named
        # references no booking carried. The door composes state rather than inventing it, which is
        # the right way round and is not written down anywhere.
        "series": [{"series_id": "ser_x", "user_id": "u_ada", "restaurant_id": "r_anker",
                    "anchor_reference": "SEED0001", "count": 2, "interval_weeks": 1,
                    "revision": 1,
                    "occurrences": [{"index": 0, "reference": "SEED0002", "exception": False},
                                    {"index": 1, "reference": "SEED0003", "exception": False}]}],
        # shapes read off the door's own reader: `changes` is an ARRAY, the event is one of
        # created/changed/cancelled, and every identifier is fixtureId-shaped.
        "history": [{"reference": "SEED0001", "seq": 1, "at": "2026-09-28T10:00:00.000Z",
                     "event": "created", "changes": [{"table_ids": ["t_1"]}], "revision": 1,
                     "accepted_terms": derived_policy_zero_terms(
                         base_fixture()["restaurants"][0])}],
        "batch_counters": {"r_anker": 7},
    }
    def fixture_with_occurrences():
        """A fixture whose bookings include the two the series below names.

        Two payload faults cost time here and both are recorded in the rows: the occurrence references
        must be SEEDED reservations (a series naming references no booking carries is refused), and the
        bookings need unique ids AND a well-formed start time -- "1%d:00" % 10 produced "T110:00", and
        the door's refusal named the start time rather than the series under test.
        """
        fx = base_fixture()
        fx["reservations"] = [{
            "id": "res_seed_%s" % hour,
            "reference": ref,
            "user_id": "u_ada",
            "restaurant_id": "r_anker",
            "table_ids": ["t_1"],
            "party_size": 2,
            "starts_at_local": "2026-09-28T%s:00" % hour,
        } for hour, ref in zip(["18", "19", "20"], ["SEED0001", "SEED0002", "SEED0003"])]
        return fx

    for key, value in payloads.items():
        if key == "history":
            fx = seeded_fixture()
        elif key == "series":
            fx = fixture_with_occurrences()
        else:
            fx = base_fixture()
        fx[key] = value
        st, body = call("POST", "/_test/reset", fx)
        st_x, doc_after = call("GET", "/_test/export")
        after = doc_after.get("state", {}) if st_x == 200 else {}
        held = st_x == 200 and key in after and len(after.get(key, []) if isinstance(
            after.get(key), list) else [after.get(key)]) >= 1
        check("S3-301-" + key, st == 204 and held,
              f"a fixture declaring {key} now SEEDS it -> reset {st} code={code_of(body)} "
              f"message={message_of(body)!r}, and the export carries {key}={after.get(key)!r} "
              f"(expected 204 and the store really populated; asserted against a state that holds "
              f"the thing, never against an empty one -- clause 23)")

    # policy_version must be preserved verbatim, not renumbered by position: a row asserting that a
    # tie on effective_from goes to the greater version cannot be written otherwise.
    fx = base_fixture()
    fx["policies"] = payloads["policies"]
    st_r, _ = call("POST", "/_test/reset", fx)
    st, body = call("GET", "/restaurants/r_anker/policies")
    versions = [p.get("policy_version") for p in body.get("policies", [])]
    check("S3-305", st == 200 and versions == [7],
          f"the seeded policy's version reads back as declared -> {versions} (expected [7]; a door "
          f"that renumbered by position would make S4-112 unwriteable rather than merely untested)")

    # And the grid the policy implies must be the policy's, not the fixture's: this is the positive
    # control S4-151 asks for -- a 15-minute policy must produce a 15-minute grid.
    st, avail = call("GET", "/availability?restaurant_id=r_anker&date=2026-12-05&party_size=2")
    starts = [sl.get("starts_at_local") for sl in avail.get("slots", [])] if isinstance(
        avail.get("slots"), list) else []
    minutes = sorted({int(s.split("T")[1][:2]) * 60 + int(s.split("T")[1][3:5]) for s in starts
                      if "T" in s})
    grid_is_15 = len(minutes) > 1 and (minutes[1] - minutes[0]) == 15
    check("S4-151-control", st == 200 and grid_is_15,
          f"a fixture declaring a 15-minute policy yields a 15-minute grid -> {len(starts)} slots, "
          f"first transitions {minutes[:3]} (expected 15-minute steps; the failure this exists for is "
          f"a 204 that seeds nothing and a row that silently asserts policy 0 instead)")

    # The export carries the four stores once they hold something, and is silent while empty: both
    # halves asserted, because the empty half alone cannot be told from a door that ignores them.
    call("POST", "/_test/reset", base_fixture())
    st, empty_doc = call("GET", "/_test/export")
    empty_state = empty_doc.get("state", {}) if st == 200 else {}
    empty_values = {k: empty_state.get(k) for k in payloads}
    all_empty = st == 200 and all(
        (empty_values[k] in ([], {}, None)) for k in payloads)
    check("S3-302a", all_empty,
          f"the four stores are present but EMPTY in an export of an untouched state -> "
          f"{ {k: v for k, v in empty_values.items()} } (expected four empty collections; asserted "
          f"together with S3-302b so an empty store cannot be read as a store that was dropped, and "
          f"NOT as an absent key -- at this build the keys are always present, which is a change from "
          f"a69e6ba and is why the row was re-worded rather than kept)")

    fx = base_fixture()
    fx["batch_counters"] = payloads["batch_counters"]
    call("POST", "/_test/reset", fx)
    st, doc2 = call("GET", "/_test/export")
    state2 = doc2.get("state", {}) if st == 200 else {}
    check("S3-302b", st == 200 and "batch_counters" in state2
          and state2.get("batch_counters", {}).get("r_anker") == 7,
          f"and present once it holds something -> batch_counters={state2.get('batch_counters')!r} "
          f"(expected r_anker=7; the two halves together are what make absence mean absence)")

    # A document still carries the stores, and a document carrying them at the TOP level still imports
    # without seeding -- the same 204-for-state-not-read as before, now on the import door only.
    misplaced = {"track": doc2.get("track"), "format_version": doc2.get("format_version"),
                 "state": copy.deepcopy(state2),
                 "policies": payloads["policies"]}
    st, body = call("POST", "/_test/import", misplaced)
    st_mis, after_mis_doc = call("GET", "/_test/export")
    after_mis = after_mis_doc.get("state", {}) if st_mis == 200 else {}
    check("S3-303a", not (st == 204 and len(after_mis.get("policies", [])) == 1),
          f"a document carrying `policies` at the TOP level rather than under `state` -> import "
          f"{st}, policies={len(after_mis.get('policies', [])) if st_mis == 200 else '?'} (recorded, "
          f"not a defect claim: unknown top-level fields are ignored -- but it is the same shape as "
          f"the 204 that seeded nothing, and I found it by making the mistake myself)")

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

    # Re-worded at 549a104. These two rows were written to test that the gate was canonical; the
    # gate no longer exists, so asserting canonicality would be asserting a shape nothing produces
    # (clause 16). They now assert the thing that IS true: a declared terms object is refused, and
    # refused for its own sake rather than for how it happens to be spelled.
    st, body = call("POST", "/_test/reset", seeded_fixture({"accepted_terms": derived}))
    check("S3-321", st == 422 and code_of(body) == "fixture_unsupported",
          f"a fixture declaring accepted_terms identical to the derived ones -> {st} "
          f"code={code_of(body)} (expected 422 fixture_unsupported; there is no equality surface "
          f"left to be canonical, so this row asserts the refusal rather than a comparison)")

    reordered = {k: derived[k] for k in sorted(derived.keys(), reverse=True)}
    st, body = call("POST", "/_test/reset", seeded_fixture({"accepted_terms": reordered}))
    check("S3-322", st == 422 and code_of(body) == "fixture_unsupported",
          f"the same terms with the keys in another order -> {st} code={code_of(body)} (expected 422; "
          f"the outcome no longer depends on spelling in either direction, which is the property "
          f"worth asserting -- NOT the canonicality of a comparison that no longer exists)")

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
    check("S3-323", st == 422 and code_of(body) == "fixture_unsupported",
          f"a fixture declaring terms derived from DIFFERENT restaurant rules -> {st} "
          f"code={code_of(body)} (expected 422; terms are derived, so declaring them is asserting a "
          f"second claim about the same booking and is refused whether or not it happens to match)")

    # No declared terms at all: the assertion is that the rules in force decide the stored terms.
    # Declaring them is refused (S3-323), so this row cannot pass by echoing a declared object.
    call("POST", "/_test/reset", seeded_fixture_with_rules(other_rules))
    st, seeded_other = call("GET", "/reservations/SEED0001", token=login())
    check("S3-324", st == 200 and seeded_other.get("accepted_terms") == other_rules_derived,
          f"with NO declared terms, the stored terms equal this file's derivation for the rules "
          f"actually in force -> "
          f"equal={st == 200 and seeded_other.get('accepted_terms') == other_rules_derived} "
          f"stored={json.dumps(seeded_other.get('accepted_terms'), sort_keys=True) if st == 200 else None} "
          f"derived={json.dumps(other_rules_derived, sort_keys=True)} (expected the 15-minute / 45 "
          f"derivation; the declared object is refused, so the stored terms can only have come from "
          f"the rules in force -- this row is what makes the refusal mean derivation rather than "
          f"absence, and it is why S3-323 alone would not have been enough)")

    # Canonical comparison must reach inside the terms, not just the top level.
    nested = copy.deepcopy(other_rules_derived)
    nested["opening_hours"] = [dict(reversed(list(d.items()))) for d in nested["opening_hours"]]
    nested["capacities"] = {k: nested["capacities"][k] for k in reversed(list(nested["capacities"]))}
    st, body = call("POST", "/_test/reset",
                    seeded_fixture_with_rules(other_rules, {"accepted_terms": nested}))
    check("S3-325", st == 422 and code_of(body) == "fixture_unsupported",
          f"the same terms with the keys of every nested object also reordered -> {st} "
          f"code={code_of(body)} (expected 422; this row was the false-refusal probe at 3538cda and "
          f"is kept because a nested-only spelling difference must be refused for the same reason, "
          f"not by a top-level key comparison that happens to notice)")

    st, body = call("POST", "/_test/reset",
                    seeded_fixture_with_rules(other_rules, {"accepted_terms": nested,
                                                             "revision": 3}))
    check("S3-326", st == 422 and code_of(body) == "fixture_unsupported",
          f"declared terms alongside a refused revision are still refused -> {st} "
          f"code={code_of(body)} (expected 422; the removal of the comparison must not have made the "
          f"door permissive, and this is the row that would catch a removal that over-reached)")

    extra_field = copy.deepcopy(derived)
    extra_field["seasonal_surcharge"] = 5
    st, body = call("POST", "/_test/reset", seeded_fixture({"accepted_terms": extra_field}))
    check("S3-327", st == 422 and code_of(body) == "fixture_unsupported",
          f"terms carrying a field the code does not derive at all -> {st} code={code_of(body)} "
          f"(expected 422; an unrecognised field in a declared terms object must be refused rather "
          f"than stripped, because stripping is how a second claim gets half-honoured)")

    st, body = call("POST", "/_test/reset", seeded_fixture({"series_id": None,
                                                             "series_index": None}))
    check("S3-328", st in (204, 422),
          f"an explicit null series_id/series_index -> {st} (recorded, not asserted: whether an "
          f"explicit null is the same as saying nothing is not a question this row has an opinion "
          f"about, and it is written down so a reader can see the build's reading rather than mine)")

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
    # Re-pointed at 1e56016: the refusal set is now the two DERIVED claims -- a declared
    # accepted_terms and a declared non-1 revision -- because the four store keys became the
    # capability. Both are driven, so "each key alone" still holds at the new size of the set.
    derived = copy.deepcopy(derived)
    derived["cancellation_cutoff_minutes"] += 1
    refusable = {
        "declared-terms": {"accepted_terms": derived},
        "declared-revision": {"revision": 5},
    }
    for key, override in refusable.items():
        fx = seeded_fixture(override)
        st, body = call("POST", "/_test/reset", fx)
        st_now, now = call("GET", "/_test/export")
        check("S3-340-" + key,
              st == 422 and st_now == 200
              and json.dumps(now, sort_keys=True) == json.dumps(baseline, sort_keys=True),
              f"a fixture refused for {key} leaves the whole state byte-equal -> reset {st}, "
              f"export unchanged={json.dumps(now, sort_keys=True) == json.dumps(baseline, sort_keys=True)} "
              f"(a refusal that half-applies is worse than no refusal)")

    st, body = call("POST", "/_test/reset",
                    seeded_fixture({"revision": 2, "accepted_terms": derived}))
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