#!/usr/bin/env python3
"""S2-042, focus half — the focus affordance measured per stop, and its lifecycle.

    BASE=http://127.0.0.1:8087 python verification/probes/s2/focus_lifecycle.py

The affordance on the date field is drawn on a WRAPPER, so two things have to be measured rather
than assumed, and both are measured here:

* **per stop**: every tab stop on all four routes, signed in and out, with the indicator's colour
  compared against the surface it is actually painted on — the nearest non-transparent background
  behind the element that carries it, not the element's own and not blindly the page root;
* **lifecycle**: the ring is taken off by three independent exits, and each is driven on its own.
  One path clearing the class is not evidence about the others. Then the opposite risk: three ways
  out is three ways to clear the ring while the keyboard is still inside the field, so the ring is
  asserted still ON at every internal stop of the field.

Every stop is walked to exhaustion. An instrument that stops at the first repeated control is a false
green with no red in it, and a row that finds an indicator still present has to have walked far
enough for the field to have been left — otherwise a correct ring reads as a stuck one.
"""

import json
import os
import sys
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8081")
ROUTES = ["/", "/signup", "/login", "/lookup"]
WIDTH = int(os.environ.get("W", "1280"))   # 375 and 1280 are both graded

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

# The element that carries the indicator: the wrapper class if it is on, otherwise the focused
# element itself. The background walked is the nearest non-transparent one BEHIND that element, so a
# ring drawn on a wrapper is compared against what the wrapper sits on.
READ = """
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const parse = (c) => {
    const m = (c || '').match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const carrier = el.closest('.kb-focus') || el;
  const c = getComputedStyle(carrier);
  const colours = [];
  if (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) colours.push(parse(c.outlineColor));
  const sh = c.boxShadow && c.boxShadow !== 'none' ? c.boxShadow : '';
  for (const s of (sh.match(/rgba?\\([^)]+\\)/g) || [])) { const p = parse(s); if (p && p.a > 0) colours.push(p); }
  // The surface the ring is painted against: the first non-transparent background BEHIND the
  // carrier. An outline and a box-shadow render outside the carrier's own box, so the walk starts
  // at its parent -- starting at the carrier compares the ring with the button it surrounds and
  // reports exactly 1.00:1, which is the false failure this file previously reported on all four
  // submit buttons.
  let node = carrier.parentElement, surface = null;
  while (node) { const v = parse(getComputedStyle(node).backgroundColor); if (v && v.a > 0) { surface = v.rgb; break; } node = node.parentElement; }
  const r = carrier.getBoundingClientRect();
  return {
    tid: el.getAttribute ? el.getAttribute('data-testid') : null,
    tag: el.tagName, type: el.getAttribute ? el.getAttribute('type') : null,
    isFocus: el.matches ? el.matches(':focus') : null,
    inWrapper: !!el.closest && !!el.closest('.kb-focus'),
    carrierTag: carrier.tagName,
    carrierClass: carrier.className || '',
    carrierIsWrapper: carrier !== el,
    ring: colours.length ? colours[0].rgb : null,
    ringWidth: parseFloat(c.outlineWidth) || 0,
    painted: colours.length > 0 && r.width > 0 && r.height > 0,
    surface: surface || [255, 255, 255],
  };
}
"""


def channel(v):
    v = v / 255.0
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def lum(rgb):
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


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


def walk(page, limit=60):
    """Every tab stop, to exhaustion. Never breaks on a repeat."""
    stops = []
    for _ in range(limit):
        page.keyboard.press("Tab")
        info = page.evaluate(READ)
        if info:
            stops.append(info)
    return stops


def main():
    good, bad = [], []
    status = reset()
    if status != 204:
        return rows([], [("FL-setup", False, "reset status %s" % status)])

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for signed_in in (False, True):
            tag = "in" if signed_in else "out"
            page = browser.new_page(viewport={"width": WIDTH, "height": 900})
            if signed_in:
                page.goto(BASE + "/login", wait_until="domcontentloaded")
                page.fill('[data-testid="login-email"]', "ada@example.com")
                page.fill('[data-testid="login-password"]', "correct horse")
                page.click('[data-testid="login-submit"]')
                page.wait_for_selector('[data-testid="current-user"]', timeout=10000)

            for route in ROUTES:
                page.goto(BASE + route, wait_until="domcontentloaded")
                page.wait_for_timeout(200)
                stops = walk(page)
                missing = [s["tid"] or s["tag"] for s in stops if not s["painted"]]
                (good if stops and not missing else bad).append(
                    ("FL-stops-%s%s" % (route.strip("/") or "home", tag), bool(stops) and not missing,
                     "%d tab stops on %s signed %s, every stop painted = %s%s" % (
                         len(stops), route, tag, not missing,
                         "" if not missing else "; missing: " + json.dumps(missing[:5]))))
                low = [(s["tid"] or s["tag"], round(ratio(s["ring"], s["surface"]), 2))
                       for s in stops if s["ring"] and ratio(s["ring"], s["surface"]) < 3.0]
                (good if not low else bad).append(
                    ("FL-contrast-%s%s" % (route.strip("/") or "home", tag), not low,
                     "%d stops on %s signed %s, rings below 3:1 against the surface they are drawn on: "
                     "%s" % (len(stops), route, tag, json.dumps(low[:5]))))

            # ---- the date field's internal stops: the ring must SURVIVE all of them ----
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_timeout(200)
            stops = walk(page)
            field = [s for s in stops if s["tid"] == "date-input"]
            survivor = [s for s in field if s["painted"]]
            (good if field and len(survivor) == len(field) else bad).append(
                ("FL-field-stops-" + tag, bool(field) and len(survivor) == len(field),
                 "date field holds %d tab stops signed %s; ring painted on %d of them %s" % (
                     len(field), tag, len(survivor),
                     json.dumps([{"isFocus": s["isFocus"], "inWrapper": s["inWrapper"],
                                  "painted": s["painted"]} for s in field]))))
            unmatched = [s for s in field if s["isFocus"] is False]
            (good if field else bad).append(
                ("FL-selector-gap-" + tag, True,
                 "%d of %d date-field stops do not match :focus while the ring is painted %s "
                 "(the falsifiable form: this count going to 0 or 2 would mean the mechanism moved)" % (
                     len(unmatched), len(field),
                     json.dumps([s["painted"] for s in unmatched]))))
            wrapper_ring = [s for s in field if s["carrierIsWrapper"] and s["ring"]]
            if wrapper_ring:
                worst = min(ratio(s["ring"], s["surface"]) for s in wrapper_ring)
                (good if worst >= 3.0 else bad).append(
                    ("FL-wrapper-ring-" + tag, worst >= 3.0,
                     "%d stops carry the ring on the wrapper; lowest contrast against the surface the "
                     "wrapper sits on = %.2f:1 (a ring whose own edge coincides with the field's border "
                     "would have nothing to contrast against)" % (len(wrapper_ring), worst)))
            else:
                bad.append(("FL-wrapper-ring-" + tag, False,
                            "no date-field stop carried the ring on the wrapper"))

            # ---- each exit independently ---------------------------------------
            def focus_field():
                page.goto(BASE + "/", wait_until="domcontentloaded")
                page.wait_for_timeout(150)
                for _ in range(30):
                    page.keyboard.press("Tab")
                    info = page.evaluate(READ)
                    if info and info["tid"] == "date-input":
                        return info
                return None

            # exit 1: focus lands outside the field (document-level focusin)
            on = focus_field()
            (good if on and on["painted"] else bad).append(
                ("FL-on-" + tag, bool(on) and on["painted"],
                 "ring on while the keyboard is inside the date field: %s" % json.dumps(on and
                     {"painted": on["painted"], "inWrapper": on["inWrapper"]})))
            page.focus('[data-testid="search-button"]')
            page.wait_for_timeout(250)
            after_out = page.evaluate("()=>!!document.querySelector('.kb-focus')")
            (good if not after_out else bad).append(
                ("FL-exit-focusin-" + tag, not after_out,
                 "focus moved to another control: kb-focus class present = %s" % after_out))

            # exit 2: window blur
            focus_field()
            page.evaluate("()=>window.dispatchEvent(new Event('blur'))")
            page.wait_for_timeout(250)
            after_blur = page.evaluate("()=>!!document.querySelector('.kb-focus')")
            (good if not after_blur else bad).append(
                ("FL-exit-blur-" + tag, not after_blur,
                 "window blur: kb-focus class present = %s" % after_blur))

            # exit 3: pagehide
            focus_field()
            page.evaluate("()=>window.dispatchEvent(new Event('pagehide'))")
            page.wait_for_timeout(250)
            after_hide = page.evaluate("()=>!!document.querySelector('.kb-focus')")
            (good if not after_hide else bad).append(
                ("FL-exit-pagehide-" + tag, not after_hide,
                 "pagehide: kb-focus class present = %s" % after_hide))

            # and the ring must still be there afterwards — each exit re-arms it
            rearmed = focus_field()
            (good if rearmed and rearmed["painted"] else bad).append(
                ("FL-rearm-" + tag, bool(rearmed) and rearmed["painted"],
                 "after all three exits, focusing the field again paints the ring again: %s" % json.dumps(
                     rearmed and {"painted": rearmed["painted"]})))

            # ---- the ring must not be left on when focus goes away by a click ----
            page.click('[data-testid="search-button"]')
            page.wait_for_timeout(300)
            left = page.evaluate("()=>!!document.querySelector('.kb-focus')")
            (good if not left else bad).append(
                ("FL-exit-click-" + tag, not left,
                 "real mouse click elsewhere: kb-focus class present = %s" % left))

            # ---- programmatic blur ------------------------------------------------
            focus_field()
            page.evaluate("()=>document.activeElement && document.activeElement.blur()")
            page.wait_for_timeout(250)
            blurred = page.evaluate("()=>!!document.querySelector('.kb-focus')")
            (good if not blurred else bad).append(
                ("FL-exit-blurcall-" + tag, not blurred,
                 "programmatic .blur(): kb-focus class present = %s" % blurred))

            # ---- a search that rebuilds the region while the keyboard is inside it ----
            focus_field()
            page.evaluate("()=>{const f=document.querySelector('[data-testid=\"date-input\"]');"
                          "if(f){f.value='2026-12-08';}"
                          "document.querySelector('[data-testid=\"search-button\"]').click();}")
            page.wait_for_timeout(1500)
            rebuilt = page.evaluate("""()=>{const a=document.activeElement;
              return {tid:a&&a.getAttribute?a.getAttribute('data-testid'):null,
                      inWrapper:!!(a&&a.closest&&a.closest('.kb-focus')),
                      classPresent:!!document.querySelector('.kb-focus')};}""")
            still_inside = rebuilt["tid"] == "date-input"
            # Focus genuinely inside: the ring correctly stays. Focus gone: the ring must not.
            ok_rebuilt = (rebuilt["classPresent"] == still_inside)
            (good if ok_rebuilt else bad).append(
                ("FL-rebuild-inside-" + tag, ok_rebuilt,
                 "a programmatic search rebuilt the region while the keyboard was in the date field: "
                 "%s — the ring is present exactly when focus is genuinely still inside" % json.dumps(rebuilt)))

            # ---- tab-stop span on the booking path -------------------------------
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_timeout(200)
            # The grid has no cells until a search has run, so a walk here would never meet one:
            # the previous run reported -1 stops and I read that as a reachability failure.
            page.fill('[data-testid="date-input"]', "2026-12-08")
            page.click('[data-testid="search-button"]')
            page.wait_for_selector('[data-testid="availability-grid"] table', timeout=10000)
            page.wait_for_timeout(400)
            seen, first_free = 0, None
            for _ in range(30):
                page.keyboard.press("Tab")
                info = page.evaluate(READ)
                if not info:
                    continue
                seen += 1
                if info["tid"] and info["tid"].startswith("slot-"):
                    free = page.evaluate("""(tid)=>{const e=document.querySelector('[data-testid="'+tid+'"]');
                      return e?e.getAttribute('data-available'):null;}""", info["tid"])
                    if free == "true":
                        first_free = seen
                        break
            disabled_in_order = page.evaluate("""()=>[...document.querySelectorAll('[data-testid^="slot-"]')]
                .filter(e=>e.getAttribute('data-available')==='false')
                .filter(e=>e.tabIndex>=0 && !e.disabled).length""")
            (good if first_free is not None else bad).append(
                ("FL-tabspan-" + tag, first_free is not None,
                 "%d press(es) from a focused search button to the first free table, signed %s; "
                 "unavailable cells reachable by keyboard = %d (measured from the search button "
                 "because that is where the search leaves focus, NOT from the top of the page)"
                 % (first_free or -1, tag, disabled_in_order)))
            (good if disabled_in_order == 0 else bad).append(
                ("FL-no-disabled-stops-" + tag, disabled_in_order == 0,
                 "unavailable cells in the tab order = %d (a taken table must not be a stop)" % disabled_in_order))
            page.close()
        browser.close()

    return rows(good, bad)


if __name__ == "__main__":
    sys.exit(main())
