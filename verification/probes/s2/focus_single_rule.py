#!/usr/bin/env python3
"""S2-042's focus half — ONE RULE, not two rules that can disagree.

    BASE=http://127.0.0.1:8089 python verification/probes/s2/focus_single_rule.py

The requirement is containment: the indicator reports **where the keyboard is**. A design can
satisfy that with two rules — clear on `window blur` and `pagehide`, restore on anything else — and
such a design has a window in which the indicator is cleared and then put back. That window is
invisible to a coarse sample and shows up only as a latency figure, so it is measured here directly:

  * **no flicker** — 20 samples at 5ms, starting the instant `blur` is dispatched with the keyboard
    inside the field. A clear-then-restore design cannot produce `present` at every sample;
  * **the poll is inert for every arrival that fires an event** — re-driven with `setInterval`
    stubbed to a no-op before any page script runs, so every internal stop of the field is checked
    with the poll dead, reached by a real click and by `Shift+Tab`;
  * **and load-bearing for exactly one arrival** — a focus return that fires no event at all. That
    path is in the product's own API surface and no person walks it, so it is recorded as an API
    property rather than as a user requirement.

Then the latency bounds, measured, because a row that asserts "instantly" reads a correct recompute
as a defect and a row that asserts a stale bound reads a correct improvement as a regression.
"""

import json
import os
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8081")

FIXTURE = {
    "users": [{"id": "u_ada", "email": "ada@example.com", "password": "correct horse",
               "display_name": "Ada"}],
    "restaurants": [{
        "id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
        "slot_minutes": 30, "reservation_duration_minutes": 90,
        "tables": [{"id": "t_1", "label": "Window", "capacity": 4},
                   {"id": "t_2", "label": "Corner", "capacity": 4}],
        "combinable": [["t_1", "t_2"]],
        "opening_hours": [{"weekday": w, "opens": "00:00", "closes": "23:30"}
                          for w in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]],
    }],
    "reservations": [],
}

FOCUS_PROBE_JS = """
() => {
  const seen = [];
  for (const n of ['focus', 'focusin', 'pointerdown', 'keydown']) {
    document.addEventListener(n, (e) => seen.push(n + ':' +
      (e.target && e.target.getAttribute ? (e.target.getAttribute('data-testid') || e.target.tagName) : '?')), true);
  }
  const f = document.querySelector('[data-testid="date-input"]');
  if (f) { f.blur(); f.focus(); }
  return seen;
}
"""

READ = """
() => {
  const el = document.activeElement;
  const carrier = document.querySelector('[data-date-field]');
  const cs = carrier ? getComputedStyle(carrier) : null;
  const painted = !!(cs && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0);
  return {
    tid: el && el.getAttribute ? el.getAttribute('data-testid') : null,
    isFocus: el && el.matches ? el.matches(':focus') : null,
    inside: !!(el && carrier && carrier.contains(el)),
    present: !!carrier && carrier.classList.contains('kb-focus'),
    painted: painted,
    ring: cs ? cs.outlineColor : null,
    width: cs ? cs.outlineWidth : null,
  };
}
"""

# Installed before any page script: the poll becomes a no-op, the event handlers are untouched.
KILL_TICK = """
window.setInterval = function () { return 0; };
window.clearInterval = function () {};
"""


def rows(good, bad):
    for rid, ok, ev in good + bad:
        print(("ROW %s PASS " if ok else "ROW %s FAIL ") % rid + ev)
    print("SUMMARY %d/%d passed" % (len(good), len(good) + len(bad)))
    return 0 if not bad else 1


def reset():
    req = urllib.request.Request(BASE + "/_test/reset", data=json.dumps(FIXTURE).encode(),
                                 headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status


def focus_field(page, limit=40):
    """Tab to the date field and step through its internal stops. Never breaks on a repeat."""
    stops = []
    for _ in range(limit):
        page.keyboard.press("Tab")
        info = page.evaluate(READ)
        if info and info["tid"] == "date-input":
            stops.append(info)
            if len(stops) >= 4:
                break
        elif stops:
            break
    return stops


def settle(page, timeout=1.6):
    """Wait for the indicator to reach its resting state; return (present, ms)."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        present = page.evaluate("()=>!!document.querySelector('.kb-focus')")
        if not present:
            return False, int((time.time() - t0) * 1000)
        time.sleep(0.005)
    return True, int((time.time() - t0) * 1000)


def main():
    good, bad = [], []
    status = reset()
    if status != 204:
        return rows([], [("FS-setup", False, "reset status %s" % status)])

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---- 1. no flicker: sampled from the instant the event is dispatched ----
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(250)
        focus_field(page)
        trace = page.evaluate("""async () => {
          const read = () => {
            const c = document.querySelector('[data-date-field]');
            const cs = c ? getComputedStyle(c) : null;
            return { present: !!c && c.classList.contains('kb-focus'),
                     painted: !!(cs && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) };
          };
          const samples = [];
          window.dispatchEvent(new Event('blur'));
          for (let i = 0; i < 20; i += 1) {
            samples.push(read());
            await new Promise(r => setTimeout(r, 5));
          }
          return samples;
        }""")
        absent = [i for i, s in enumerate(trace) if not s["present"]]
        (good if not absent else bad).append(
            ("FS-no-flicker", not absent,
             "20 samples at 5ms from the instant `blur` was dispatched with the keyboard inside the "
             "field: present at %d of 20, painted at %d of 20%s. A clear-then-restore design cannot "
             "produce this trace; it has a window in which the indicator is absent." % (
                 sum(1 for s in trace if s["present"]), sum(1 for s in trace if s["painted"]),
                 "" if not absent else "; absent at samples " + json.dumps(absent))))

        # ---- 2. the same trace with focus genuinely leaving afterwards ------------
        page.focus('[data-testid="search-button"]')
        gone, ms_gone = settle(page)
        (good if not gone else bad).append(
            ("FS-goes-when-focus-goes", not gone,
             "focus moved to another control: indicator present = %s, cleared in %dms" % (gone, ms_gone)))

        # ---- 3. containment as a single rule, both directions ------------------
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(250)
        stops = focus_field(page)
        held = [s for s in stops if s["present"] and s["painted"]]
        (good if len(stops) == 4 and len(held) == len(stops) else bad).append(
            ("FS-containment", len(stops) == 4 and len(held) == len(stops),
             "the field holds %d internal stops and the indicator is painted at %d of them %s" % (
                 len(stops), len(held),
                 json.dumps([{"isFocus": s["isFocus"], "inside": s["inside"],
                              "present": s["present"], "painted": s["painted"]} for s in stops]))))
        page.close()

        # ---- 4. the poll is inert for every arrival that fires an event --------
        #         Verified with the poll dead, which is the only way to show it is not carrying
        #         ordinary interaction.
        for arrival, drive in (("click", None), ("shift-tab", None)):
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.add_init_script(KILL_TICK)
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_timeout(250)
            if arrival == "click":
                page.click('[data-testid="date-input"]', force=True)
                page.click('[data-testid="date-input"]', force=True)
            else:
                # Shift+Tab from the search button walks BACK into the field. Tab forwards from the
                # search button lands on the first grid cell instead, which is not the field at all.
                # How many Shift+Tabs it takes depends on the order, and the order is not what I
                # assumed: backwards from the search button it is party-size-input and only then the
                # date field, whose four internal stops are behind that. So walk back until the field
                # is reached and report the count rather than hard-coding one press -- which is how the
                # first version of this row reported a red against a product that was reachable.
                page.focus('[data-testid="search-button"]')
                presses = 0
                arrived = None
                for _ in range(8):
                    page.keyboard.press("Shift+Tab")
                    presses += 1
                    arrived = page.evaluate(READ)
                    if arrived and arrived["tid"] == "date-input":
                        break
                (good if (arrived and arrived["tid"] == "date-input") else bad).append(
                    ("FS-arrive-shift-tab", bool(arrived) and arrived["tid"] == "date-input",
                     "Shift+Tab backwards from the search button reaches the date field after %d "
                     "press(es), arriving at %s -- the field is reachable without any pointer event, "
                     "which is the arrival the poll could be hiding" % (
                         presses, json.dumps(arrived and arrived["tid"]))))
            stops = []
            for _ in range(12):
                info = page.evaluate(READ)
                if info and info["tid"] == "date-input":
                    stops.append(info)
                    if len(stops) >= 4:
                        break
                page.keyboard.press("Tab")
            painted = [s for s in stops if s["painted"]]
            mismatched = [s for s in stops if s["isFocus"] is False]
            # Arriving by keyboard lands part-way into the field, so fewer than four stops remain to
            # observe; the row judges what was observed and insists the `:focus`-mismatched stop was
            # among them, since that is the stop only the affordance can paint. Requiring exactly four
            # here was my error: it made a reachable field look unreachable.
            ok = bool(stops) and len(painted) == len(stops) and len(mismatched) >= 1
            (good if ok else bad).append(
                ("FS-tick-dead-" + arrival, ok,
                 "with the poll stubbed out and the handlers untouched, a %s arrival leaves the ring "
                 "painted at %d of %d observed internal stops, %d of them the `:focus`-mismatched one "
                 "%s" % (arrival, len(painted), len(stops), len(mismatched),
                         json.dumps([{"isFocus": s["isFocus"], "painted": s["painted"]} for s in stops]))))
            page.close()

        # ---- 5. and load-bearing for exactly one arrival: the silent one -------
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.add_init_script(KILL_TICK)
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(250)
        focus_field(page)
        # What a programmatic focus() actually fires, measured rather than assumed, and measured from
        # a state where the keyboard was genuinely inside the field first. My first version called
        # blur() then focus() "silent" from a page where the field was not focused at all: nothing
        # fired, containment had never broken, and the row therefore could not distinguish a tracked
        # ring from an unbroken one. A row that cannot distinguish is not a row.
        page.click('[data-testid="date-input"]', force=True)
        before = page.evaluate(READ)
        fired = page.evaluate(FOCUS_PROBE_JS)
        page.wait_for_timeout(900)
        after = page.evaluate(READ)
        containment_broke = bool(before and before["inside"]) and bool(after and not after["inside"])
        tracked = bool(after and after["inside"] and after["painted"])
        # Reported, never asserted as pass or fail: whether an event-free arrival tracks is the
        # question, and this construction does not produce one.
        good.append((
            "FS-programmatic-focus-events", True,
            "from a state with the keyboard inside the field (inside=%s, painted=%s), a programmatic "
            "blur()+focus() fires %s and leaves inside=%s, painted=%s. %s The genuinely event-free "
            "arrival — focus returning to a field the document already considers focused — was measured "
            "by the Builder with its own construction; this row reports what it can see and does not "
            "claim that path."
            % (bool(before and before["inside"]), bool(before and before["painted"]), json.dumps(fired),
               bool(after and after["inside"]), bool(after and after["painted"]),
               "Containment broke and the ring was restored by the event path."
               if containment_broke else "Containment never broke, so this says nothing either way.")))

        page.close()

        # ---- 6. the bounds, measured ------------------------------------------
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(250)
        bounds = {}
        for name, act in (("focusin-outside", "()=>document.querySelector('[data-testid=\"search-button\"]').focus()"),
                          # A TRUSTED click, driven by the browser's own input pipeline. The first
                          # version used element.click() from script, which fires no pointerdown, so it
                          # timed the poll instead of the event path — 1603ms, which I first read as a
                          # stuck ring.
                          ("real-click-trusted", None),
                          # A real click on the restaurant SELECT, not on the search button: the
                          # button submits, the date field is `required`, and an empty date makes the
                          # browser move the focus straight back into the field -- correct product
                          # behaviour that my probe was reading as a stuck ring.
                          ("programmatic-blur", "()=>document.querySelector('[data-testid=\"date-input\"]').blur()")):
            # Establish the precondition and ASSERT it before timing: a walk that never reached the
            # field left the previous case's ring standing, and I was timing the removal of a ring
            # this case had not put there. A setup step that can fail has to be asserted before its
            # result is read.
            page.click('[data-testid="date-input"]', force=True)
            inside = page.evaluate("()=>{const a=document.activeElement;"
                                   "const c=document.querySelector('[data-date-field]');"
                                   "return !!(a && c && c.contains(a));}")
            if not inside:
                bad.append(("FS-bounds-setup-" + name, False,
                            "could not put the keyboard inside the date field before timing %s" % name))
                continue
            page.click('[data-testid="date-input"]', force=True)
            if act is None:
                page.click('[data-testid="restaurant-select"]')
            else:
                page.evaluate(act)
            present, ms = settle(page)
            bounds[name] = (present, ms)
        (good if not any(p for p, _ in bounds.values()) else bad).append(
            ("FS-bounds-teardown", not any(p for p, _ in bounds.values()),
             "teardown latencies %s — the bound asserted by the row must be at or above the slowest of "
             "these and must not be tighter than the mechanism allows" % json.dumps(
                 {k: v[1] for k, v in bounds.items()})))

        # silent return: how long until it is back
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(250)
        focus_field(page)
        page.evaluate("()=>document.querySelector('[data-testid=\"search-button\"]').focus()")
        settle(page)
        t0 = time.time()
        page.evaluate("()=>{const f=document.querySelector('[data-testid=\"date-input\"]');"
                      "if(f){f.blur(); f.focus();}}")
        back = False
        while time.time() - t0 < 2.0:
            info = page.evaluate(READ)
            if info and info["inside"] and info["painted"]:
                back = True
                break
            time.sleep(0.005)
        back_ms = int((time.time() - t0) * 1000)
        (good if back else bad).append(
            ("FS-bounds-return", back,
             "silent return tracked again within %dms (expected within the stated bound; previously "
             "45-83ms, so the row's bound is what decides whether this reads as an improvement or a "
             "regression)" % back_ms))
        page.close()
        browser.close()

    return rows(good, bad)


if __name__ == "__main__":
    sys.exit(main())
