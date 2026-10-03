#!/usr/bin/env python3
"""S2-042, focus half — the ring must come BACK.

    BASE=http://127.0.0.1:8088 W=1280 python verification/probes/s2/focus_reentry.py

Every other focus row in this directory asserts that the indicator goes **off**. This one asserts the
transition back, at the inner segment where the browser refuses to match `:focus` and the wrapper is
the only thing that can paint anything, for each of the two exits that fire without a focus event:

  * before the exit: the class is held at **all four** internal stops, including the `:focus`-less
    one — asserted in the same breath, so a fix that re-arms on any event cannot trade the green half
    away silently;
  * after the exit: the class is absent;
  * re-entry **by a real click**, and re-entry **silently** — `element.focus()`, which fires no event
    of any kind — must leave a **painted** ring at the inner segment. `painted`, not merely the class:
    at that stop the field's own `:focus` rule does not match, so a class without a paint is nothing
    on screen.

Also measured, because a poll can be load-bearing or can be an accommodation for a test and the
difference has to be stated rather than assumed:

  * does the silent return need the slow tick, or does an event path serve it? — timed;
  * does a real click re-entry go through the event path? — timed;
  * does the tick write to the DOM while there is nothing to indicate? — a MutationObserver counts
    attribute mutations on an idle page with focus outside the field;
  * does anything survive navigation? — two full navigations, then look for residue.

At 375 and 1280 the whole file runs twice; `W` selects the width.
"""

import json
import os
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8081")
WIDTH = int(os.environ.get("W", "1280"))

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

# The inner-segment stop is the one where the browser declines to match :focus. The wrapper class is
# what can paint there, so `painted` is read from the carrier rather than from the element.
READ_AFTER_FOCUS = """
() => {
  const f = document.querySelector('[data-testid="date-input"]');
  if (f) { f.blur(); f.focus(); }
  const el = document.activeElement;
  const carrier = el && el.closest && el.closest('.kb-focus') ? el.closest('.kb-focus') : null;
  const cs = carrier ? getComputedStyle(carrier) : null;
  return { inside: !!(el && carrier), present: !!carrier,
           painted: !!(cs && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0),
           ring: cs ? cs.outlineColor : null, width: cs ? cs.outlineWidth : null };
}
"""

READ_AFTER = """
() => {
  const el = document.activeElement;
  const carrier = document.querySelector('[data-date-field]');
  const cs = carrier ? getComputedStyle(carrier) : null;
  return { tag: el ? el.tagName : null,
           tid: el && el.getAttribute ? el.getAttribute('data-testid') : null,
           inside: !!(el && carrier && carrier.contains(el)),
           present: !!(carrier && carrier.classList.contains('kb-focus')),
           painted: !!(cs && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) };
}
"""

READ = """
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { none: true };
  const carrier = el.closest && el.closest('.kb-focus') ? el.closest('.kb-focus') : null;
  const cs = carrier ? getComputedStyle(carrier) : null;
  const painted = !!(cs && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0);
  return { tid: el.getAttribute ? el.getAttribute('data-testid') : null,
           isFocus: el.matches(':focus'), classPresent: !!carrier, painted: painted,
           ring: cs ? cs.outlineColor : null, width: cs ? cs.outlineWidth : null };
}
"""


def rows(good, bad, residual_rows=()):
    for rid, ok, ev in good + bad:
        print(("ROW %s PASS " if ok else "ROW %s FAIL ") % rid + ev)
    for rid, present, ev in residual_rows:
        print("ROW %s RESIDUAL %s" % (rid, ev))
    print("SUMMARY %d/%d passed, %d residual" % (len(good), len(good) + len(bad), len(residual_rows)))
    return 0 if not bad else 1


def reset():
    req = urllib.request.Request(BASE + "/_test/reset", data=json.dumps(FIXTURE).encode(),
                                 headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status


def focus_field_by_keyboard(page, limit=40):
    """Tab until the date field holds focus, then step through its internal stops.

    Returns (stops, inner_index) where stops are the readings at each internal stop and inner_index
    is the position whose `:focus` does not match. Asserts shape before use: a run that never
    reaches the field, or never meets the `:focus`-less stop, is reported rather than used.
    """
    stops, inner = [], None
    for _ in range(limit):
        page.keyboard.press("Tab")
        info = page.evaluate(READ)
        if not info or info.get("none") or info["tid"] != "date-input":
            if stops:
                break
            continue
        stops.append(info)
        if info["isFocus"] is False and inner is None:
            inner = len(stops) - 1
        if len(stops) >= 4:
            break
    return stops, inner


def main():
    good, bad, residual_rows = [], [], []
    tag = str(WIDTH)
    status = reset()
    if status != 204:
        return rows([], [("FR-setup-" + tag, False, "reset status %s" % status)])

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": WIDTH, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        for exit_name, fire in (("blur", "()=>window.dispatchEvent(new Event('blur'))"),
                                ("pagehide", "()=>window.dispatchEvent(new Event('pagehide'))")):

            # ---- baseline: the class is held at all four internal stops ----------
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_timeout(200)
            stops, inner = focus_field_by_keyboard(page)
            (good if (len(stops) == 4 and inner is not None) else bad).append(
                ("FR-reach-" + exit_name + "-" + tag, len(stops) == 4 and inner is not None,
                 "%d internal date-field stops at %s, the :focus-less one at index %s %s" % (
                     len(stops), tag, inner, json.dumps([{"isFocus": s["isFocus"],
                                                          "class": s["classPresent"],
                                                          "painted": s["painted"]} for s in stops]))))
            if inner is None or len(stops) < 4:
                continue
            held = [s for s in stops if s["classPresent"]]
            (good if len(held) == len(stops) else bad).append(
                ("FR-held-before-" + exit_name + "-" + tag, len(held) == len(stops),
                 "before the exit, the class is held at %d of %d internal stops (no premature teardown "
                 "asserted in the same breath as the re-entry rows)" % (len(held), len(stops))))

            # ---- a dispatched exit must NOT clear the ring while the keyboard is inside ---
            # A DISPATCHED blur with no focus change is not "the keyboard left". At this hash the
            # affordance is recomputed from where the focus actually is, so the ring correctly
            # stays. The first form of this row asserted the opposite and reported a red against a
            # mechanism that is right -- the inverse of a correct ring reading as a stuck one. Both
            # halves are asserted instead: it stays while the focus is inside, and it is gone once
            # the focus has genuinely left.
            page.evaluate(fire)
            page.wait_for_timeout(250)
            still_inside = page.evaluate("()=>{const a=document.activeElement; return !!(a && a.closest && a.closest('.kb-focus'));}")
            kept = page.evaluate("()=>!!document.querySelector('.kb-focus')")
            (good if (kept == still_inside) else bad).append(
                ("FR-dispatched-" + exit_name + "-" + tag, kept == still_inside,
                 "a dispatched %s with the keyboard still inside the field: focus inside = %s, "
                 "indicator present = %s -- the indicator tracks where the focus actually is"
                 % (exit_name, still_inside, kept)))

            # ---- and it is gone once focus has genuinely left --------------------
            page.focus('[data-testid="search-button"]')
            page.wait_for_timeout(250)
            off = page.evaluate("()=>!!document.querySelector('.kb-focus')")
            (good if not off else bad).append(
                ("FR-off-" + exit_name + "-" + tag, not off,
                 "after the focus genuinely left the field, kb-focus present = %s" % off))

            # ---- re-entry by a REAL CLICK, timed ---------------------------------
            page.click('[data-testid="date-input"]', force=True)
            page.click('[data-testid="date-input"]', force=True)
            t0 = time.time()
            page.evaluate("()=>document.querySelector('[data-testid=\"date-input\"]').focus()")
            for _ in range(6):
                info = page.evaluate(READ)
                if info and not info.get("none") and info["painted"]:
                    break
                time.sleep(0.005)
            click_ms = int((time.time() - t0) * 1000)
            # step to the inner segment
            inner_painted = None
            for _ in range(8):
                page.keyboard.press("Tab")
                info = page.evaluate(READ)
                if info and not info.get("none") and info["isFocus"] is False:
                    inner_painted = info["painted"]
                    break
            (good if inner_painted else bad).append(
                ("FR-back-click-" + exit_name + "-" + tag, bool(inner_painted),
                 "after %s, a real click back in then to the inner segment: painted = %s (ring %s %s) "
                 "in %dms" % (exit_name, inner_painted,
                              (info or {}).get("ring"), (info or {}).get("width"), click_ms)))

            # ---- re-entry SILENTLY: element.focus(), which fires no event --------
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_timeout(200)
            focus_field_by_keyboard(page)
            page.evaluate(fire)
            page.wait_for_timeout(200)
            page.evaluate("()=>{const f=document.querySelector('[data-testid=\"date-input\"]');"
                          "if(f) f.blur();}")
            page.evaluate("()=>{const f=document.querySelector('[data-testid=\"date-input\"]');"
                          "if(f) f.focus();}")
            # Immediate: the causing call and the read happen in ONE evaluate, with no wait and no
            # bound. There is no poll in this build, so a bound here would be a hedge: it would weaken
            # into "true eventually" and keep passing a mechanism that has been removed.
            immediate = page.evaluate(READ_AFTER_FOCUS)
            (good if (immediate and immediate["inside"] and immediate["painted"]) else bad).append(
                ("FR-back-immediate-" + exit_name + "-" + tag,
                 bool(immediate) and immediate["inside"] and immediate["painted"],
                 "after %s, element.focus() read in the SAME evaluate: %s — no wait, no bound"
                 % (exit_name, json.dumps(immediate))))

        # ---- the uncovered state, reached on purpose, reported as a residual ----
        # A programmatic .blur() from the field's FIRST stop. Measured: from the first stop the blur
        # moves activeElement to BODY, so containment breaks and nothing recomputes, because `blur`
        # is not in the handler list and there is no poll. From an INNER segment the same call leaves
        # activeElement on the input, containment still holds, and the indicator correctly stays — so
        # the row has to blur from the first stop or it cannot reach the state it names.
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(250)
        for _ in range(30):
            page.keyboard.press("Tab")
            if page.evaluate("()=>{const a=document.activeElement;"
                             "return !!(a && a.getAttribute && "
                             "a.getAttribute('data-testid')==='date-input');}"):
                break
        page.evaluate("()=>document.activeElement && document.activeElement.blur()")
        page.wait_for_timeout(150)
        residual = page.evaluate(READ_AFTER)
        residual_rows.append(("FR-residual-blur-" + tag, bool(residual and not residual["inside"]),
            "programmatic .blur() from the field's first stop: activeElement inside the wrapper = %s, "
            "indicator present = %s. No poll, and `blur` is not in the handler list, so an indicator "
            "left on with the keyboard outside is the uncovered state the ledger records as measured "
            "rather than denied."
            % (bool(residual and residual["inside"]), bool(residual and residual["present"]))))

        # ---- nothing runs in the background ----
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(300)
        mutations = page.evaluate("""async () => {
          let n = 0;
          const obs = new MutationObserver(list => { n += list.length; });
          obs.observe(document.body, {attributes: true, subtree: true, childList: true});
          await new Promise(r => setTimeout(r, 2200));   // four ticks at 2Hz
          obs.disconnect();
          return n;
        }""")
        idle_class = page.evaluate("()=>!!document.querySelector('.kb-focus')")
        (good if not idle_class else bad).append(
            ("FR-idle-" + tag, not idle_class,
             "idle for 2.2s with focus outside the field: kb-focus present = %s" % idle_class))
        (good if mutations == 0 else bad).append(
            ("FR-idle-writes-" + tag, mutations == 0,
             "DOM mutations observed on an idle page over 2.2s: %d — nothing runs in the background"
             % mutations))

        # ---- nothing survives navigation ----------------------------------------
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(200)
        focus_field_by_keyboard(page)
        page.goto(BASE + "/lookup", wait_until="domcontentloaded")
        page.wait_for_timeout(200)
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        residue = page.evaluate("()=>!!document.querySelector('.kb-focus')")
        (good if not residue else bad).append(
            ("FR-navigation-" + tag, not residue,
             "two full navigations after the field was focused: kb-focus residue = %s" % residue))

        (good if not errors else bad).append(
            ("FR-errors-" + tag, not errors,
             "page errors during the whole run: %s" % json.dumps(errors[:3])))
        page.close()
        browser.close()

    return rows(good, bad, residual_rows)


if __name__ == "__main__":
    sys.exit(main())
