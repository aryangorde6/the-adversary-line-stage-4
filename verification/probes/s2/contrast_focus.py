#!/usr/bin/env python3
"""S2-042 — text contrast against the first non-transparent ancestor, and focus-ring contrast
measured with real Tab presses.

Committed to run before the next stage-2 verdict.

    BASE=http://127.0.0.1:8083 python verification/probes/s2/contrast_focus.py

Two halves, both measured rather than eyeballed:

* every visible text node on all four routes is checked against the first NON-TRANSPARENT
  ancestor background, never the page root — two of the seven states sit on a form host, and
  resolving the page root would read the wrong background for exactly those.
* the focus indicator is driven by real `keyboard.press("Tab")`, never `locator.focus()`: calling
  .focus() on a button can report a failure against a correct `:focus-visible` stylesheet. The
  ring's colour must reach 3:1 against the nearest non-transparent ancestor background.

WCAG relative luminance and contrast ratio, computed here rather than imported.
"""

import json
import os
import re
import sys
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8081")
ROUTES = ["/", "/signup", "/login", "/lookup"]

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

# Walk every element that renders text, resolve the first non-transparent ancestor background,
# and hand both colours back as rgb() strings for the ratio to be computed on this side.
COLLECT = """
() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const bgOf = (el) => {
    let node = el;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = Array.from(el.childNodes)
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const fg = parse(cs.color);
    const bg = bgOf(el);
    if (!fg) continue;
    out.push({ tag: el.tagName.toLowerCase(), testid: el.getAttribute('data-testid') || '',
               text: text.slice(0, 40), fg: [fg.r, fg.g, fg.b], bg: [bg.r, bg.g, bg.b] });
  }
  return out;
}
"""

FOCUS = """
() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const bgOf = (el) => {
    let node = el;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  // The ring may be drawn as an outline or as a box-shadow; take whichever is visible.
  let ring = null;
  const shadow = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow : '';
  const colours = (shadow + ' , ' + (cs.outlineStyle === 'none' ? '' : cs.outlineColor)).match(/rgba?\([^)]+\)/g) || [];
  for (const c of colours) {
    const p = parse(c);
    if (p && p.a > 0) { ring = p; break; }
  }
  const width = parseFloat(cs.outlineWidth) || 0;
  const hasShadow = shadow !== '';
  // An outline and a box-shadow are drawn OUTSIDE the element's own box, so the ring must be
  // compared against the nearest non-transparent ANCESTOR background, never the element's own.
  // Reading bgOf(el) compares the ring with the button it surrounds and reports 1.00:1 for a
  // perfectly visible focus ring -- which is how this probe first reported eight false failures.
  const bg = bgOf(el.parentElement || el);
  const label = el.getAttribute('data-testid') || el.getAttribute('name') || el.id || el.tagName.toLowerCase();
  if (!ring && !hasShadow) return { label, indicator: false,
                                    outline: cs.outlineStyle + ' ' + cs.outlineWidth,
                                    shadow: cs.boxShadow };
  return { label, indicator: true, ring: ring ? [ring.r, ring.g, ring.b] : null,
           width, hasShadow, bg: [bg.r, bg.g, bg.b] };
}
"""


def channel(v):
    v = v / 255.0
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def main():
    good, bad = [], []
    req = urllib.request.Request(BASE + "/_test/reset", data=json.dumps(FIXTURE).encode(),
                                 headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        status = resp.status
    if status != 204:
        print("ROW CF-setup FAIL reset status %s, so no state below is trustworthy" % status)
        return 1
    good.append(("CF-setup", True, "reset status 204"))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for signed_in in (False, True):
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            if signed_in:
                page.goto(BASE + "/login", wait_until="domcontentloaded")
                page.fill('[data-testid="login-email"]', "ada@example.com")
                page.fill('[data-testid="login-password"]', "correct horse")
                page.click('[data-testid="login-submit"]')
                page.wait_for_load_state("domcontentloaded")
            for route in ROUTES:
                page.goto(BASE + route, wait_until="domcontentloaded")
                page.wait_for_timeout(150)
                nodes = page.evaluate(COLLECT)
                low = [(n, ratio(n["fg"], n["bg"])) for n in nodes if ratio(n["fg"], n["bg"]) < 4.5]
                tag = "%s%s" % (route.strip("/") or "home", "-in" if signed_in else "-out")
                (good if not low else bad).append(
                    ("CF-contrast-" + tag, not low,
                     "%d text nodes on %s %s, lowest %.2f:1%s" % (
                         len(nodes), route, "signed in" if signed_in else "signed out",
                         min([ratio(n["fg"], n["bg"]) for n in nodes], default=99),
                         "" if not low else "; below AA: " + json.dumps(
                             [{"t": n["text"], "r": round(r, 2)} for n, r in low][:4]))))

                # Focus: real Tab presses only.
                page.goto(BASE + route, wait_until="domcontentloaded")
                page.keyboard.press("Tab")
                stops, failures = 0, []
                for _ in range(40):
                    info = page.evaluate(FOCUS)
                    if info:
                        stops += 1
                        if not info.get("indicator"):
                            failures.append("%s: no visible indicator (outline %s, shadow %s)" % (
                                info["label"], info.get("outline"), info.get("shadow")))
                        elif info.get("ring"):
                            r = ratio(info["ring"], info["bg"])
                            if r < 3.0:
                                failures.append("%s: ring %.2f:1 against its background" % (info["label"], r))
                        elif not info.get("hasShadow"):
                            failures.append("%s: indicator claims neither a ring colour nor a shadow" % info["label"])
                    page.keyboard.press("Tab")
                (good if (stops > 0 and not failures) else bad).append(
                    ("CF-focus-" + tag, stops > 0 and not failures,
                     "%d tab stops on %s, %d ring-contrast failures %s" % (
                         stops, route, len(failures), json.dumps(failures[:4]))))
            page.close()
        browser.close()

    for rid, ok, ev in good + bad:
        print(("ROW %s PASS " if ok else "ROW %s FAIL ") % rid + ev)
    print("SUMMARY %d/%d passed" % (len(good), len(good) + len(bad)))
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
