import json, sys, datetime
from playwright.sync_api import sync_playwright
B = "http://127.0.0.1:8081"
with open("/tmp/opencode/s2/fixture.json") as f: FIX = json.load(f)

def reset(fixture):
    import urllib.request
    r = urllib.request.Request(B + "/_test/reset", data=json.dumps(fixture).encode(), headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(r) as resp: return resp.status

def out(id, ok, ev): print(("ROW %s PASS " if ok else "ROW %s FAIL ") % id + ev)

with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page(viewport={"width":1280,"height":900})
    errs = []; page.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type=="error" else None)
    page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))

    # --- load state: grid visible, no stale booking form/confirmation -----------
    st = reset(FIX); out("P-setup", st == 204, "reset status %s" % st)
    page.goto(B + "/", wait_until="domcontentloaded")
    grid = page.query_selector('[data-testid="availability-grid"]')
    out("P-grid", grid is not None and grid.is_visible(), "availability-grid present=%s visible=%s" % (grid is not None, grid is not None and grid.is_visible()))
    out("P-empty-text", page.query_selector('[data-testid="grid-empty"]') is not None and bool(page.query_selector('[data-testid="grid-empty"]').inner_text().strip()), "empty-state text present and nonempty")
    out("P-noslots-load", page.query_selector('[data-testid="no-slots"]') is None, "no-slots absent on load")
    bf = page.query_selector('[data-testid="booking-form"]')
    out("P-form-absent-load", bf is None, "booking-form in document on load: %s (visible=%s)" % (bf is not None, bf is not None and bf.is_visible()))
    cf = page.query_selector('[data-testid="confirmation"]')
    out("P-conf-absent-load", cf is None, "confirmation in document on load: %s (visible=%s)" % (cf is not None, cf is not None and cf.is_visible()))

    # --- sign in -------------------------------------------------------------
    page.goto(B + "/login", wait_until="domcontentloaded")
    page.fill('[data-testid="login-email"]', "ada@example.com")
    page.fill('[data-testid="login-password"]', "correct horse")
    page.click('[data-testid="login-submit"]')
    page.wait_for_load_state("networkidle")
    out("P-signed-in", page.query_selector('[data-testid="current-user"]') is not None, "current-user after login: %s url=%s" % (page.query_selector('[data-testid="current-user"]') is not None, page.url))

    # --- closed day ----------------------------------------------------------
    date = "2026-12-08"   # a Tuesday
    closed = [h for h in FIX["restaurants"][0]["opening_hours"] if h["weekday"] != "tue"]
    fx2 = json.loads(json.dumps(FIX)); fx2["restaurants"][0]["opening_hours"] = closed
    st = reset(fx2); out("P-setup2", st == 204, "closed-day reset status %s" % st)
    page.goto(B + "/", wait_until="domcontentloaded")
    page.fill('[data-testid="restaurant-input"]', "r_anker") if page.query_selector('[data-testid="restaurant-input"]') else None
    page.fill('[data-testid="date-input"]', date)
    page.click('[data-testid="search-button"]')
    try:
        page.wait_for_selector('[data-testid="no-slots"], [data-testid="availability-grid"] table', timeout=5000)
        timedout = False
    except Exception as e:
        timedout = True
    ns = page.query_selector('[data-testid="no-slots"]')
    tbl = page.query_selector('[data-testid="availability-grid"] table')
    out("P-closed-day", (ns is not None and ns.is_visible()) and (tbl is None or not tbl.is_visible()),
        "closed day: no-slots present=%s visible=%s ; grid table visible=%s ; timedout=%s" % (
            ns is not None, ns is not None and ns.is_visible(), tbl is not None and tbl.is_visible(), timedout))
    out("P-console", len(errs) == 0, "console errors: %s" % errs[:3])
    b.close()
