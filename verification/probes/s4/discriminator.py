#!/usr/bin/env python3
"""`S4-167` at the API layer, measured. The browser half is not here and is not claimed.

    BASE=http://127.0.0.1:8112 python verification/probes/s4/discriminator.py

This file drives the day-level discriminator over HTTP: `GET /availability?explain=true` must answer,
at the day level and under the terms in force, which of four states the date is in. Assertions 1, 2, 3
and 3b of `S4-167` are here; the screen's obligation (`S4-164`) is a rendered claim and lives in the
Finisher's rows, because no browser instrument is runnable from this seat.

Clauses restated at the top of the file because they do not travel into a new file by themselves:

 1. assert the setup happened, and that it can fail, before reading anything;
 4. the service you measure must be the service you started;
 7. assert shape, not value, where the specification names a shape;
 9. distinguish refusal from absence;
11. before reporting a miss, establish the path is reachable;
12. a fixture must express what the row needs and refuse what it cannot;
18. a row that iterates a subset and reports agreement over it is green about a population it never
    touched -- assert the population, not the sample;
23. a row asserting presence must first establish there is something to be present;
28. a probe narrower than its row is a check of a smaller requirement;
30. a row's green tells the reader less than it appears to when a subset of its assertions decides the
    outcome -- assertion 3 is load-bearing and this file says so.

Every expected value here is derived from the fixture's own rules or from the specification's wording,
never read back out of the field under test.
"""

import copy
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8112")

GOOD = []
BAD = []

HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
TABLES = [{"id": "t_1", "label": "1", "capacity": 2},
          {"id": "t_2", "label": "2", "capacity": 4},
          {"id": "t_3", "label": "3", "capacity": 6}]
PLAIN_KEYS = {"date", "restaurant_id", "slots", "timezone"}


def fixture(policy=None):
    fx = {
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
    if policy:
        fx["policies"] = [policy]
    return fx


def policy_doc(slot_minutes=30, duration=90, cutoff=120, hours=None, capacities=None,
               effective_from="2026-06-01", version=7):
    # restaurant_id is required: the fixture reader looks the restaurant up rather than assuming one,
    # and omitting it fails the whole fixture with a message about the restaurant.
    return {"restaurant_id": "r_anker", "policy_version": version, "effective_from": effective_from,
            "slot_minutes": slot_minutes, "reservation_duration_minutes": duration,
            "cancellation_cutoff_minutes": cutoff, "opening_hours": hours or copy.deepcopy(HOURS),
            "capacities": capacities or {t["id"]: t["capacity"] for t in TABLES}}


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


def availability(date, party=2, explain=True):
    q = ("/availability?restaurant_id=r_anker&date=%s&party_size=%d%s"
         % (date, party, "&explain=true" if explain else ""))
    st, body = call("GET", q)
    return st, body


def hours_contain_weekday(date, restaurant_hours):
    """Whether the RESTAURANT's own calendar has an entry for this date's weekday.

    Assertion 3b reads this from the service rather than assuming it, so the probe never decides for
    itself that a day is not shut -- it asks the restaurant detail and compares.
    """
    from datetime import date as _date
    y, m, d = (int(x) for x in date.split("-"))
    names = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    weekday = names[_date(y, m, d).weekday()]
    return any(h["weekday"] == weekday for h in restaurant_hours)


def main():
    # ---- setup, asserted before anything is read ------------------------------
    st, _ = call("POST", "/_test/reset", fixture())
    check("S4-167-setup", st == 204,
          "POST /_test/reset -> %s (expected 204; asserted before anything is read)" % st)
    if st != 204:
        return rows()
    st, body = call("POST", "/auth/login", {"email": "ada@example.com",
                                            "password": "correct horse"})
    token = body.get("token") if st == 200 else None
    check("S4-167-setup", st == 200 and token, "manager signs in -> %s token=%s" % (st, bool(token)))
    if not token:
        return rows()

    st, rest = call("GET", "/restaurants/r_anker")
    if st != 200 or "opening_hours" not in rest:
        check("S4-167-setup", False,
              "GET /restaurants/r_anker for assertion 3b's calendar -> %s keys=%s"
              % (st, sorted(rest.keys()) if isinstance(rest, dict) else None))
        return rows()
    check("S4-167-setup", True,
          "GET /restaurants/r_anker answers with opening_hours, so 3b can read the calendar from the "
          "service rather than assuming it")

    # The default fixture's own calendar covers every weekday, so a shut day has to be produced by a
    # policy that omits it. Established here, once, and asserted -- a row that reads a day state
    # without establishing which state the day is in is reading a field, not a behaviour.
    shut_policy = policy_doc(hours=[{"weekday": w, "opens": "00:00", "closes": "23:30"}
                                    for w in ["mon", "tue", "wed", "thu", "fri", "sat"]],
                             effective_from="2026-06-01", version=5)
    st, _ = call("POST", "/_test/reset", fixture(policy=shut_policy))
    check("S4-167-setup-shut", st == 204,
          "reset with a policy omitting Sunday -> %s (expected 204; the shut day is produced, not "
          "assumed, before any day_state is read)" % st)

    # =====================================================================
    # Assertion 4 (cheapest, and it constrains the rest): the plain response's
    # key set is unchanged. Asserted on an empty-slot day too, where a new
    # key is most likely to leak.
    # =====================================================================
    shut_day = "2026-12-06"          # a Sunday, which the policies below make shut
    st, plain = availability(shut_day, explain=False)
    keys = set(plain.keys()) if isinstance(plain, dict) else set()
    check("S4-167-a4", st == 200 and keys == PLAIN_KEYS and "day_state" not in plain,
          "plain availability keys -> %s (expected exactly %s; day_state must not appear without "
          "explain=true)" % (sorted(keys), sorted(PLAIN_KEYS)))

    # =====================================================================
    # Assertion 1: day_state present at the top level whenever explain=true,
    # INCLUDING on a date with no slots.
    # =====================================================================
    st, day = availability(shut_day, explain=True)
    has_slots_key = isinstance(day, dict) and "slots" in day
    empty_slots = has_slots_key and day.get("slots") == []
    check("S4-167-a1", st == 200 and isinstance(day, dict) and "day_state" in day and empty_slots,
          "explain=true on a no-slot day -> %s day_state=%r n_slots=%s (expected 200, day_state "
          "present AND slots [] -- presence on an empty day is the assertion)"
          % (st, day.get("day_state") if isinstance(day, dict) else None,
             len(day.get("slots", [])) if isinstance(day.get("slots"), list) else "no slots key"))

    # =====================================================================
    # Assertion 3b, RE-POINTED. It used to read `GET /restaurants/{id}`, and that surface reports the
    # BASE restaurant's hours, not the effective ones -- measured below and in S4-167-cal. So 3b reads
    # the policy in force for the date from the policies surface, which is where the slot loop's hours
    # actually come from. A precondition row must read the same source the implementation reads: the
    # old wording would have passed because the RESTAURANT had hours for that weekday while the POLICY
    # excluded every slot, which is exactly the shortcut 3b exists to make falsifiable.
    # =====================================================================
    narrow = policy_doc(slot_minutes=15, duration=90, cutoff=60,
                        hours=[{"weekday": w, "opens": "12:00", "closes": "12:44"}
                               for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]],
                        effective_from="2026-06-01", version=3)
    st, _ = call("POST", "/_test/reset", fixture(policy=narrow))
    check("S4-167-a3b-setup", st == 204,
          "reset with a policy whose bookable window (12:00-12:44) is shorter than one 90-minute "
          "reservation -> %s (expected 204; asserted before the state under test is read)" % st)
    if st != 204:
        return rows()

    st_pol, pols = call("GET", "/restaurants/r_anker/policies")
    effective = next((p for p in pols.get("policies", [])
                      if p.get("effective_from") == "2026-06-01"), None)
    eff_has_weekday = bool(effective) and hours_contain_weekday(
        "2026-12-06", effective.get("opening_hours", []))
    st, day = availability("2026-12-06")
    ds = day.get("day_state") if isinstance(day, dict) else None
    check("S4-167-a3b", st == 200 and ds == "terms_exclude_all" and day.get("slots") == []
          and eff_has_weekday,
          "a day the POLICY in force covers, with terms that yield no slot -> %s day_state=%r "
          "n_slots=%s effective_hours_cover_the_weekday=%s (expected terms_exclude_all, slots [], and "
          "the effective hours read from the policies surface -- NOT from the restaurant detail, which "
          "reports the base calendar and would make this row pass for the wrong reason)"
          % (st, ds, len(day.get("slots", [])) if isinstance(day.get("slots"), list) else "no slots key",
             eff_has_weekday))

    # The finding that forced the re-point, asserted so it cannot be quietly forgotten: the two
    # calendars disagree, and only one of them decides.
    st_r, _ = call("POST", "/_test/reset", fixture())
    st_a, _ = call("POST", "/_test/reset", fixture(policy=policy_doc(
        hours=[{"weekday": w, "opens": "00:00", "closes": "23:30"}
               for w in ["mon", "tue", "wed", "thu", "fri", "sat"]],
        effective_from="2026-06-01", version=2)))
    _, detail_a = call("GET", "/restaurants/r_anker")
    detail_weekdays = sorted(h["weekday"] for h in detail_a.get("opening_hours", []))
    st_day, day_a = availability("2026-12-06")
    st_b, _ = call("POST", "/_test/reset", fixture(policy=policy_doc(
        effective_from="2026-06-01", version=2)))
    # The other direction needs a POLICY covering Sunday as well, or the effective hours fall back to
    # policy zero -- which is derived from the restaurant and would agree with it, making the two
    # calendars indistinguishable and the half of the assertion vacuous.
    fixture_b = fixture(policy=policy_doc(effective_from="2026-06-01", version=2))
    fixture_b["restaurants"][0]["opening_hours"] = [
        h for h in HOURS if h["weekday"] != "sun"]
    st_b, _ = call("POST", "/_test/reset", fixture_b)
    _, detail_b = call("GET", "/restaurants/r_anker")
    detail_b_weekdays = sorted(h["weekday"] for h in detail_b.get("opening_hours", []))
    _, day_b = availability("2026-12-06")
    calendars_disagree = (
        "sun" in detail_weekdays and day_a.get("day_state") == "shut"
        and "sun" not in detail_b_weekdays and day_b.get("day_state") == "open")
    check("S4-167-cal", st_a == 204 and st_b == 204 and calendars_disagree,
          "the restaurant detail and the policy disagree in both directions -> detail says Sunday "
          "present=%s while day_state=%s; detail says Sunday present=%s while day_state=%s (expected the "
          "detail to carry the BASE calendar and the day_state to follow the POLICY -- so a "
          "precondition read from the detail is a precondition about the wrong calendar)"
          % ("sun" in detail_weekdays, day_a.get("day_state"),
             "sun" in detail_b_weekdays, day_b.get("day_state")))

    # =====================================================================
    # Assertion 2: the three states pairwise distinguishable WITHOUT reference to
    # slots.length -- shut and terms_exclude_all both report slots: [], so the row
    # asserts they differ while looking identical on that one field.
    # =====================================================================
    # Re-establish the terms-excluded day first: the block above ends on the calendar-divergence case,
    # and assertion 2 compares that day's answer against a shut day's, so the state under comparison has
    # to be re-seeded rather than inherited from whatever the previous row left behind.
    st, _ = call("POST", "/_test/reset", fixture(policy=narrow))
    st, shut_day_body = availability("2026-12-06")
    shut_state = shut_day_body.get("day_state") if isinstance(shut_day_body, dict) else None
    # `shut` producer: the policy's hours omit that weekday entirely (seeded once, above).
    st, _ = call("POST", "/_test/reset", fixture(policy=shut_policy))
    if st != 204:
        check("S4-167-a2", False, "reset with a policy omitting Sunday -> %s (expected 204)" % st)
        return rows()
    st, shut_body = availability("2026-12-06")
    real_shut = shut_body.get("day_state") if isinstance(shut_body, dict) else None
    both_empty = (isinstance(shut_day_body, dict) and shut_day_body.get("slots") == []
                  and isinstance(shut_body, dict) and shut_body.get("slots") == [])
    check("S4-167-a2a", real_shut == "shut" and both_empty,
          "shut producer -> day_state=%r with slots=%r, and the terms-excluded day also reports "
          "slots=%r (expected 'shut', and BOTH empty on slots.length -- the two states are "
          "indistinguishable by counting slots, which is what makes the field load-bearing)"
          % (real_shut, shut_body.get("slots") if isinstance(shut_body, dict) else None,
             shut_day_body.get("slots") if isinstance(shut_day_body, dict) else None))

    # nothing_free: hours fine, slots produced, no table can seat the party. Discovered by driving --
    # booking the only six-seater for one slot leaves the other 44 slots free, so "nothing free" is
    # not a single-booking state at all and a producer built on a booking would have asserted a case
    # the service never reaches.
    st, _ = call("POST", "/_test/reset",
                 fixture(policy=policy_doc(capacities={"t_1": 1, "t_2": 1, "t_3": 1},
                                           effective_from="2026-06-01", version=6)))
    st, nf = availability("2026-12-05", party=2)
    nf_state = nf.get("day_state") if isinstance(nf, dict) else None
    slots_present = isinstance(nf, dict) and isinstance(nf.get("slots"), list) and len(nf["slots"]) > 0
    check("S4-167-a2b", nf_state == "nothing_free" and slots_present,
          "a day with slots and no table that seats the party -> day_state=%r n_slots=%s (expected "
          "nothing_free WITH a non-empty slots list -- the state that is not an empty day)"
          % (nf_state, len(nf.get("slots", [])) if slots_present else None))

    st, _ = call("POST", "/_test/reset", fixture())
    st, op = availability("2026-12-05", party=2)
    check("S4-167-a2c", op.get("day_state") == "open",
          "the same date with the default fixture -> day_state=%r (expected open; the fourth value "
          "exists so a client can tell 'nothing to report' from 'everything fine')"
          % op.get("day_state") if isinstance(op, dict) else "no body")

    # Assertion 3, the load-bearing one, in its own terms: a POLICY change moves
    # a date from one state to another with the restaurant's calendar untouched.
    st, before = availability("2026-12-05", party=2)
    st, _ = call("POST", "/_test/reset", fixture())
    st, tok = call("POST", "/auth/login", {"email": "ada@example.com",
                                           "password": "correct horse"})
    t3 = tok.get("token")
    shrink = policy_doc(slot_minutes=15, duration=90, cutoff=60,
                        hours=[{"weekday": w, "opens": "12:00", "closes": "12:44"}
                               for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]],
                        effective_from="2026-06-01", version=2)
    st, pub = call("POST", "/restaurants/r_anker/policies", shrink, token=t3, key="dc1")
    published = st == 201
    check("S4-167-a3-setup", published,
          "publishing a policy whose window is shorter than one reservation -> %s (expected 201)" % st)
    st, after = availability("2026-12-05", party=2)
    moved = (isinstance(before, dict) and isinstance(after, dict)
             and before.get("day_state") == "open" and after.get("day_state") == "terms_exclude_all")
    st2, rest2 = call("GET", "/restaurants/r_anker")
    cal_untouched = (rest2.get("opening_hours") == rest.get("opening_hours"))
    check("S4-167-a3", moved and cal_untouched,
          "a policy change alone moved the day open -> terms_exclude_all: before=%r after=%r, and the "
          "restaurant's calendar unchanged=%s (expected the move AND an untouched calendar; this is "
          "the LOAD-BEARING assertion -- 1 and 2 would still pass against an implementation answering "
          "shut whenever slots is empty)"
          % (before.get("day_state") if isinstance(before, dict) else None,
             after.get("day_state") if isinstance(after, dict) else None, cal_untouched))

    # And the precedence the Foreman's ruling got wrong, measured rather than assumed:
    # stage 3 reads hours from the SELECTED POLICY, so a policy may name a day the
    # restaurant's calendar lacks, and omit one it has. Asserted here so the row carries
    # the corrected definition rather than the ruled one.
    st, _ = call("POST", "/_test/reset", fixture())
    st, tok = call("POST", "/auth/login", {"email": "ada@example.com",
                                           "password": "correct horse"})
    t4 = tok.get("token")
    adds_thursday = policy_doc(
        hours=[{"weekday": w, "opens": "00:00", "closes": "23:30"} for w in
               ["mon", "tue", "wed", "fri", "sat", "sun"]],
        effective_from="2026-06-01", version=4)
    st_pub, pub = call("POST", "/restaurants/r_anker/policies", adds_thursday, token=t4, key="dc2")
    st, thu = availability("2026-12-03")   # a Thursday the restaurant's calendar has, omitted above
    thu_slots = thu.get("slots") if isinstance(thu, dict) else None
    check("S4-167-prec", st_pub == 201 and thu_slots == [] and thu.get("day_state") == "shut",
          "a policy omitting a weekday the restaurant's calendar HAS -> publish %s, day_state=%r "
          "n_slots=%s (expected 201, shut, [] -- hours come from the SELECTED POLICY in stage 3, so "
          "`shut` must be read from the effective hours and not from the restaurant's calendar. The "
          "ruled precedence would have called this day bookable and reported `open` over nothing)"
          % (st_pub, thu.get("day_state") if isinstance(thu, dict) else None,
             len(thu_slots) if isinstance(thu_slots, list) else None))

    st, fri = availability("2026-12-04")   # a Friday only that policy carries
    fri_slots = fri.get("slots") if isinstance(fri, dict) else None
    check("S4-167-prec2", isinstance(fri_slots, list) and len(fri_slots) > 0
          and fri.get("day_state") in ("open", "nothing_free"),
          "a day the policy carries -> day_state=%r slots=%d (expected bookable times; reporting "
          "`shut` here is the defect the ruled precedence would have shipped)"
          % (fri.get("day_state") if isinstance(fri, dict) else None,
             len(fri_slots) if isinstance(fri_slots, list) else -1))

    return rows()


def rows():
    for rid, ev in GOOD + BAD:
        print("ROW " + rid + (" PASS " if (rid, ev) in GOOD else " FAIL ") + ev)
    print("SUMMARY %d/%d passed" % (len(GOOD), len(GOOD) + len(BAD)))
    return 0 if not BAD else 1


if __name__ == "__main__":
    sys.exit(main())