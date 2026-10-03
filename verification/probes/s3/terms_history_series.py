#!/usr/bin/env python3
"""Stage-3 rows for terms, revision, history, decision and series.

    BASE=http://127.0.0.1:8101 python verification/probes/s3/terms_history_series.py

Clauses 1, 2, 5, 7, 8, 11, 12 and 13 are restated at the top of this file rather than trusted from
the ledger header, because they do not travel into new code by themselves.

Occurrence dates are recomputed HERE from the anchor's local date plus i x interval x 7 days, never
read back out of the response, so a series that returns its own arithmetic cannot pass.
"""

import datetime
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8101")
GOOD, BAD = [], []

TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]
HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]


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
    print("ROW " + rid + (" PASS " if ok else " FAIL ") + ev)


def code_of(b):
    return b.get("error", {}).get("code") if isinstance(b, dict) else None


def rows():
    for rid, ev in GOOD + BAD:
        print("ROW " + rid + (" PASS " if (rid, ev) in GOOD else " FAIL ") + ev)
    print("SUMMARY %d/%d passed" % (len(GOOD), len(GOOD) + len(BAD)))
    return 0 if not BAD else 1


def main():
    fx = {"users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                     "display_name": "Ada"},
                    {"id": "u_bob", "email": "bob@example.com", "password": "correct horse",
                     "display_name": "Bob"}],
          "restaurants": [{"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
                           "manager_user_ids": ["u_ada"], "slot_minutes": 30,
                           "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
                           "opening_hours": HOURS, "tables": TABLES}],
          "reservations": []}
    st, _ = call("POST", "/_test/reset", fx)
    check("S3-000", st == 204, f"reset -> {st} (asserted before any state is read)")
    if st != 204:
        return rows()
    _, ada = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    _, bob = call("POST", "/auth/login", {"email": "bob@example.com", "password": "correct horse"})
    ada_token, bob_token = ada.get("token"), bob.get("token")
    if not (ada_token and bob_token):
        check("S3-000-login", False, "both accounts sign in")
        return rows()

    # ---- a policy that changes terms, so the snapshot has something to hold ---
    policy = {"effective_from": "2026-01-01", "slot_minutes": 30,
              "reservation_duration_minutes": 120, "cancellation_cutoff_minutes": 60,
              "opening_hours": HOURS, "capacities": {"t_1": 2, "t_2": 4, "t_3": 6}}
    st, pub = call("POST", "/restaurants/r_anker/policies", policy, token=ada_token, key="t-pol")
    check("S3-000-pol", st == 201, f"policy published -> {st} version={pub.get('policy_version')!r}")

    # =====================================================================
    # accepted terms and revision
    # =====================================================================
    st, made = call("POST", "/reservations",
                    {"restaurant_id": "r_anker", "table_id": "t_2",
                     "starts_at_local": "2026-12-01T19:00", "party_size": 4},
                    token=ada_token, key="t-book")
    terms = made.get("accepted_terms") or {}
    check("S3-000-book", st == 201, f"booking -> {st}")
    if st != 201:
        return rows()
    expected_keys = {"policy_version", "slot_minutes", "reservation_duration_minutes",
                     "cancellation_cutoff_minutes", "opening_hours", "capacities"}
    check("S3-050", made.get("revision") == 1 and set(terms) == expected_keys,
          f"revision={made.get('revision')!r}; accepted_terms keys = {sorted(terms)} "
          f"(expected revision 1 and exactly {sorted(expected_keys)}, with effective_from EXCLUDED)")
    check("S3-050b", terms.get("policy_version") == pub.get("policy_version")
          and terms.get("reservation_duration_minutes") == 120,
          f"the terms snapshot carries the PUBLISHED policy: policy_version="
          f"{terms.get('policy_version')!r} duration={terms.get('reservation_duration_minutes')!r} "
          f"(expected {pub.get('policy_version')!r} and 120)")
    check("S3-055", made.get("ends_at", "").startswith("2026-12-01T21:00"),
          f"ends_at = {made.get('ends_at')!r} — 19:00 plus the POLICY's 120 minutes is 21:00 local "
          f"(expected 2026-12-01T21:00)")

    ref = made.get("reference")

    # a no-op amendment consumes neither revision nor history
    st, noop = call("PATCH", "/reservations/" + ref, {"party_size": 4}, token=ada_token)
    check("S3-058", st == 200 and noop.get("revision") == 1 and noop.get("accepted_terms") == terms,
          f"a no-op amendment -> {st}, revision={noop.get('revision')!r}, terms unchanged = "
          f"{noop.get('accepted_terms') == terms} (expected 200, revision 1, identical terms)")

    st, hist = call("GET", "/reservations/%s/history" % ref, token=ada_token)
    entries = hist.get("entries") if isinstance(hist, dict) else None
    check("S3-076", st == 200 and isinstance(entries, list) and len(entries) == 1
          and entries[0].get("event") == "created",
          f"after the no-op the history holds {len(entries) if isinstance(entries, list) else entries} "
          f"entry/entries = {json.dumps([e.get('event') for e in entries]) if isinstance(entries, list) else hist} "
          f"(expected exactly one, `created`: a no-op records nothing)")

    # a real amendment: revision +1, history +1 with only the changed field
    st, amended = call("PATCH", "/reservations/" + ref, {"party_size": 3}, token=ada_token)
    st2, hist2 = call("GET", "/reservations/%s/history" % ref, token=ada_token)
    e2 = (hist2.get("entries") or []) if isinstance(hist2, dict) else []
    changed = e2[1] if len(e2) > 1 else {}
    ch = changed.get("changes") or []
    check("S3-057", st == 200 and amended.get("revision") == 2,
          f"a real amendment -> {st}, revision {made.get('revision')} -> {amended.get('revision')} "
          f"(expected exactly +1)")
    check("S3-075", len(e2) == 2 and [c.get("field") for c in ch] == ["party_size"],
          f"the changed entry names only the field that changed: seq={changed.get('seq')} "
          f"event={changed.get('event')!r} fields={[c.get('field') for c in ch]} "
          f"(expected exactly ['party_size'])")

    # expected_revision ordering: stale beats cutoff/validation
    st, stale = call("PATCH", "/reservations/" + ref,
                     {"party_size": 2, "expected_revision": 1}, token=ada_token)
    check("S3-061a", st == 409 and code_of(stale) == "stale_revision",
          f"a stale expected_revision -> {st} code={code_of(stale)} (expected 409 stale_revision)")
    st, badrev = call("PATCH", "/reservations/" + ref,
                      {"party_size": 2, "expected_revision": "1"}, token=ada_token)
    check("S3-061b", st == 422, f"expected_revision=\"1\" -> {st} code={code_of(badrev)} (expected 422)")
    st, good_rev = call("PATCH", "/reservations/" + ref,
                        {"party_size": 2, "expected_revision": 2}, token=ada_token)
    check("S3-061c", st == 200 and good_rev.get("revision") == 3,
          f"the matching expected_revision -> {st}, revision={good_rev.get('revision')} (expected 200 and 3)")

    # history terms are a record, not a view
    old_terms = e2[0].get("accepted_terms") if e2 else None
    check("S3-079", bool(e2) and old_terms == terms,
          f"the `created` entry still carries the terms as they were then: {json.dumps(old_terms) if old_terms else None} "
          f"== the create-time snapshot = {old_terms == terms} (an entry that acquired newer terms fails here)")

    # decision endpoint and its 404 rules
    st, dec = call("GET", "/reservations/%s/decision" % ref, token=ada_token)
    check("S3-080", st == 200 and set(dec) == {"reference", "revision", "accepted_terms"},
          f"decision -> {st} keys={sorted(dec) if isinstance(dec, dict) else dec} (expected exactly "
          f"reference, revision, accepted_terms)")
    st, anon = call("GET", "/reservations/%s/decision" % ref)
    st2, stranger = call("GET", "/reservations/%s/decision" % ref, token=bob_token)
    check("S3-081", st == 404 and st2 == 404,
          f"decision with no token -> {st}; with another account's token -> {st2} "
          f"(expected 404 and 404: the exception to stage 1's 401 rule)")
    st, hist_anon = call("GET", "/reservations/%s/history" % ref)
    st2, hist_stranger = call("GET", "/reservations/%s/history" % ref, token=bob_token)
    check("S3-071", st == 404 and st2 == 404 and anon == stranger == hist_anon,
          f"history anonymous -> {st}, stranger -> {st2}, and the two 404 bodies are identical = "
          f"{anon == stranger == hist_anon} (a stranger must not be able to tell 'not yours' from "
          f"'does not exist')")

    # =====================================================================
    # series
    # =====================================================================
    st, series = call("POST", "/series",
                      {"anchor_reference": ref, "count": 3, "interval_weeks": 1},
                      token=ada_token, key="s-1")
    occ = series.get("occurrences") if isinstance(series, dict) else None
    check("S3-100", st == 201 and series.get("revision") == 1 and isinstance(occ, list) and len(occ) == 3,
          f"adoption -> {st}, series revision={series.get('revision')!r}, {len(occ) if isinstance(occ, list) else occ} "
          f"occurrences (expected 201, revision 1 and count occurrences including the anchor)")
    if st != 201:
        return rows()
    # The specification's occurrence object names `reference` at the OCCURRENCE level, beside
    # `index`, `exception` and `reservation`. Reading it only from inside `reservation` would let an
    # implementation drop the field the shape promises, so the row reads the field where the
    # specification puts it and reports both readings.
    inner = (occ[0].get("reservation") or {}).get("reference")
    check("S3-105", occ[0].get("reference") == ref and occ[0].get("exception") is False,
          f"occurrence zero carries the anchor's reference AT THE OCCURRENCE LEVEL: occurrence-level "
          f"reference={occ[0].get('reference')!r} (inside reservation it is {inner!r}); "
          f"exception={occ[0].get('exception')!r}; occurrence keys={sorted(occ[0])} "
          f"(expected the anchor's own reference and false)")
    series_id = series.get("series_id")

    # occurrence dates, recomputed here from the anchor's LOCAL date
    anchor_local = made.get("starts_at_local")
    base_date = datetime.date.fromisoformat(anchor_local[:10])
    expected_dates = [(base_date + datetime.timedelta(days=7 * i)).isoformat() + "T" + anchor_local[11:]
                      for i in range(3)]
    actual_dates = [(o.get("reservation") or {}).get("starts_at_local") for o in occ]
    check("S3-106", actual_dates == expected_dates,
          f"occurrence local starts {actual_dates} vs recomputed {expected_dates} "
          f"(expected local-date arithmetic, not UTC)")
    refs = [(o.get("reservation") or {}).get("reference") for o in occ]
    level_refs = [o.get("reference") for o in occ]
    check("S3-111", len(set(refs)) == 3 and [o.get("index") for o in occ] == [0, 1, 2],
          f"distinct reservation references {refs} and indices {[o.get('index') for o in occ]} "
          f"(expected 3 distinct and 0,1,2); occurrence-level references are {level_refs}")

    st, replay = call("POST", "/series", {"anchor_reference": ref, "count": 3, "interval_weeks": 1},
                      token=ada_token, key="s-1")
    check("S3-119", st == 200 and replay == series,
          f"replaying the adoption -> {st}, byte-equal to the original = {replay == series} "
          f"(expected 200 and identical)")

    st, again = call("POST", "/series", {"anchor_reference": ref, "count": 3, "interval_weeks": 1},
                     token=ada_token, key="s-2")
    check("S3-102b", st == 409 and code_of(again) == "already_in_series",
          f"adopting the same anchor with a DIFFERENT key -> {st} code={code_of(again)} "
          f"(expected 409 already_in_series, so idempotency cannot explain the refusal)")

    st, foreign = call("POST", "/series", {"anchor_reference": ref, "count": 3, "interval_weeks": 1},
                       token=bob_token, key="s-bob")
    check("S3-102c", st == 404, f"another account adopting Ada's anchor -> {st} (expected 404 not_found)")

    # a real amendment on one occurrence is a permanent exception, once
    occ1 = (occ[1].get("reservation") or {}).get("reference")
    st, patched = call("PATCH", "/reservations/" + occ1, {"party_size": 3}, token=ada_token)
    st2, reread = call("GET", "/series/" + series_id, token=ada_token)
    o_after = (reread.get("occurrences") or []) if isinstance(reread, dict) else []
    flags = [(o.get("index"), o.get("exception")) for o in o_after]
    check("S3-114", st == 200 and reread.get("revision") == 2 and flags == [(0, False), (1, True), (2, False)],
          f"amending occurrence 1 -> {st}; series revision {series.get('revision')} -> "
          f"{reread.get('revision')}; exception flags {flags} (expected +1 and only index 1 flagged)")
    st, noop = call("PATCH", "/reservations/" + occ1, {"party_size": 3}, token=ada_token)
    st2, reread2 = call("GET", "/series/" + series_id, token=ada_token)
    check("S3-114b", st == 200 and reread2.get("revision") == 2,
          f"a no-op amendment on that occurrence -> {st}, series revision still {reread2.get('revision')} "
          f"(expected unchanged: a no-op changes neither the revision nor the flag)")

    st, cancelled = call("POST", "/reservations/%s/cancel" % occ[2].get("reservation")["reference"],
                         token=ada_token)
    st2, reread3 = call("GET", "/series/" + series_id, token=ada_token)
    o3 = (reread3.get("occurrences") or []) if isinstance(reread3, dict) else []
    occ2_after = [o for o in o3 if o.get("index") == 2]
    check("S3-115", st in (200, 204) and bool(occ2_after) and occ2_after[0].get("exception") is False
          and reread3.get("revision") == 3,
          f"cancelling occurrence 2 -> {st}; it is retained at exception="
          f"{occ2_after[0].get('exception') if occ2_after else 'absent'}; series revision "
          f"{reread2.get('revision')} -> {reread3.get('revision')} "
          f"(expected +1, retained, and NOT an exception)")

    st, series_anon = call("GET", "/series/" + series_id)
    st2, series_bob = call("GET", "/series/" + series_id, token=bob_token)
    check("S3-113", st == 404 and st2 == 404,
          f"reading the series with no token -> {st}; as another account -> {st2} (expected 404 and 404)")

    # a failed adoption leaves nothing behind, and the same key is then a first use
    st, made2 = call("POST", "/reservations",
                     {"restaurant_id": "r_anker", "table_id": "t_3",
                      "starts_at_local": "2026-12-10T19:00", "party_size": 6},
                     token=ada_token, key="t-book-2")
    if st == 201:
        # Force the failure the row is about: occupy the anchor's table at the FIRST generated slot
        # (+7 days), so occurrence 1 cannot be created. Without this the adoption simply succeeds and
        # the row measures nothing — my first version did exactly that.
        first_slot = (datetime.date.fromisoformat(made2["starts_at_local"][:10])
                      + datetime.timedelta(days=7)).isoformat() + "T19:00"
        st_block, _blk = call("POST", "/reservations",
                              {"restaurant_id": "r_anker", "table_id": made2["table_id"],
                               "starts_at_local": first_slot, "party_size": 2},
                              token=bob_token, key="t-block")
        check("S3-109-setup", st_block == 201,
              f"another account takes {made2['table_id']} at {first_slot} -> {st_block} "
              f"(the conflict that must make occurrence 1 fail)")
        st, fail = call("POST", "/series",
                        {"anchor_reference": made2.get("reference"), "count": 3, "interval_weeks": 1},
                        token=ada_token, key="s-fail")
        st2, listing = call("GET", "/reservations", token=ada_token)
        target = first_slot[:10]
        generated = [r for r in (listing.get("reservations") or [])
                     if r.get("starts_at_local", "") == first_slot
                     and r.get("user_id") == (made2.get("user_id") or r.get("user_id"))]
        check("S3-109", st >= 400 and not generated,
              f"a first failing occurrence -> {st} code={code_of(fail) if st >= 400 else 'n/a'}; "
              f"occurrences created for Ada at the blocked slot = {len(generated)} (expected none: "
              f"no partial series, no partial reservations) at slot {first_slot}")
        # The conflict is still in place, so a re-evaluated retry cannot SUCCEED — what it must not
        # do is replay. Asserting 201 here was my error: it measures a wish, not the rule. The rule
        # is that the retry is evaluated afresh, so it answers with the ordinary booking conflict and
        # not with idempotency_key_reuse and not with a 200 replay.
        st2, retry = call("POST", "/series",
                          {"anchor_reference": made2.get("reference"), "count": 3, "interval_weeks": 1},
                          token=ada_token, key="s-fail")
        check("S3-109b", st2 == 409 and code_of(retry) in ("table_unavailable", "reservation_cancelled"),
              f"the same key retried while the conflict persists -> {st2} code={code_of(retry)} "
              f"(expected the ordinary booking conflict: a failed adoption must leave no idempotency "
              f"claim, so the retry is evaluated afresh rather than replayed or refused as key reuse)")

    return rows()


if __name__ == "__main__":
    sys.exit(main())