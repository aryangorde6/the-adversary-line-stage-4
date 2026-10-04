#!/usr/bin/env python3
"""Is a `restaurant_revisions` bump actually observable, or only present in the source?

    BASE=http://127.0.0.1:8143 python verification/probes/s4/s4_152_observability.py

`fixture.js:223-226` graded a `restaurant_revisions` bump INERT because the export omits the field, calling it
"live in the store and invisible from outside".  The Builder reported that premise as false -- `replans.js:339`
returns `planned_against_revision` on every preview and `replans.js:420` returns `restaurant_revision` on every
apply -- and that is verified in source.  **This probe exists because presence in the source is not the same claim as
observability from a client, and only driving settles it.**

It also settles the limit honestly: it demonstrates that the quantity IS on the wire, which is what makes the INERT
premise unsupportable.  It does **not** re-run the stage-3 mutant, so it does not claim the mutant is caught.

It REFUTES one path offered in support: the stale gate's 409 body was said to echo `current`/`planned_against`.
Measured, it does not -- `http.js:42-44` renders `{code, message}` and discards `apiError.context`, so the gate
fires on the revision without publishing it.  So the value is published on two surfaces (preview, apply) and hidden
on two (export, 409).
Tree: `stage-4/` at `334f8c2` (comments-only over behaviour `56e278a`).
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:8143")
HOURS = [{"weekday": w, "opens": "00:00", "closes": "23:30"}
         for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]
CLOSURE = {"table_id": "t_2", "from": "2026-09-28T18:00:00+02:00",
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


def main():
    print("service under measurement: %s" % BASE)
    fx = {"users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
                     "display_name": "Ada"}],
          "restaurants": [{"id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
                           "manager_user_ids": ["u_ada"], "slot_minutes": 30,
                           "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
                           "opening_hours": HOURS,
                           "tables": [{"id": "t_1", "label": "1", "capacity": 2},
                                      {"id": "t_2", "label": "2", "capacity": 4}]}],
          "reservations": []}
    st, _ = call("POST", "/_test/reset", fx)
    if st != 204:
        print("SETUP FAILED: reset -> %s" % st); return 1
    st, b = call("POST", "/auth/login", {"email": "ada@example.com", "password": "correct horse"})
    token = b.get("token")

    # ---- path 1: does a bump appear in the NEXT preview? ------------------------
    st, p1 = call("POST", "/restaurants/r_anker/replans", CLOSURE, token=token, key="o-p1")
    rev_preview_1 = p1.get("restaurant_revision")  # wire name per stage-4.md:41; replans.js:362 renames it
    st, ap = call("POST", "/restaurants/r_anker/replans/%s/apply" % p1["plan_id"], {}, token=token, key="o-a1")
    rev_apply = ap.get("restaurant_revision")
    st, p2 = call("POST", "/restaurants/r_anker/replans", CLOSURE, token=token, key="o-p2")
    rev_preview_2 = p2.get("restaurant_revision")

    print("preview 1 restaurant_revision       = %s   (wire name, stage-4.md:41)" % rev_preview_1)
    print("apply    restaurant_revision       = %s" % rev_apply)
    print("preview 2 restaurant_revision       = %s  <- the bump, seen by a client" % rev_preview_2)

    row("OBS-1", rev_preview_1 == 0, "a fresh preview reports the revision (got %s)" % rev_preview_1)
    row("OBS-2", rev_apply == 1, "apply returns the bumped value in its own response (got %s)" % rev_apply)
    row("OBS-3", rev_preview_2 == 1,
        "PATH 1 -- the bump is visible to a client that only ever previews: restaurant_revision went %s -> %s "
        "with no access to the export and no access to the store" % (rev_preview_1, rev_preview_2))

    # ---- path 2: independently, via the gate's own 409 body --------------------
    # The gate needs an INTERVENING bump: a preview changes nothing, so a plan previewed and then applied with
    # nothing in between is legitimately fresh.  Preview p3 at revision 1, bump via p2, then apply p3.
    st2, p3 = call("POST", "/restaurants/r_anker/replans", CLOSURE, token=token, key="o-p3")
    rev_preview_3 = p3.get("restaurant_revision")
    st_mid, _ = call("POST", "/restaurants/r_anker/replans/%s/apply" % p2["plan_id"], {}, token=token, key="o-a2")
    st3, g2 = call("POST", "/restaurants/r_anker/replans/%s/apply" % p3["plan_id"], {}, token=token, key="o-a3")
    print("   raw 409 body: %s" % json.dumps(g2)[:220])
    # MEASURED, and it CONTRADICTS the second path as stated: the 409 body does NOT echo the quantity.
    # replans.js:390 calls fail('stale_plan', {plan_id, planned_against, current}) -- the context IS carried --
    # but http.js:42-44 renders only {code, message} and DISCARDS apiError.context.  So the gate fires on the
    # revision without publishing it.  Recorded as measured, not as argued.
    err = g2.get("error") or {}
    row("OBS-4", st3 == 409 and err.get("code") == "stale_plan"
        and "current" not in json.dumps(g2) and "planned_against" not in json.dumps(g2),
        "PATH 2 -- REFUTED BY MEASUREMENT: the intervening bump did make the plan stale (409 stale_plan), but the "
        "body is %s with NO revision in it. http.js:42-44 renders {code, message} and drops apiError.context, so "
        "the gate FIRES on the revision without PUBLISHING it. The Builder's 'third place' does not exist on the "
        "wire -- so there are TWO surfaces that show the value (preview, apply) and TWO that hide it (export, 409)"
        % json.dumps(g2)[:110])
    row("OBS-3b", rev_preview_3 == 1 and rev_apply == 1,
        "and the plan that the gate refused was itself previewed at revision %s, so the count is readable "
        "monotonically across the session without a single successful apply" % rev_preview_3)

    # ---- and the export, for contrast: the one surface that hides it ------------
    st, exp = call("GET", "/_test/export")
    keys = sorted(exp.get("state", {}).keys())
    row("OBS-5", "restaurant_revisions" not in keys,
        "the export hides it (keys: %s) -- which is why grading against it produced a false INERT -- but see "
        "OBS-4: the 409 body hides it too, so it is TWO surfaces that hide the value and TWO that publish it, "
        "and 'the export is the only observable' was wrong in both directions" % ", ".join(keys))

    bad = [r for r, ok in RESULTS if not ok]
    print("\n%d rows, %d failed: %s" % (len(RESULTS), len(bad), ", ".join(bad) if bad else "none"))
    print("NOTE: this demonstrates the quantity is observable. It does NOT re-run the stage-3 mutant, so it does "
          "not claim the mutant is caught.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
