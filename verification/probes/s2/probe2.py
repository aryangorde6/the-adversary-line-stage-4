import json, urllib.request
from playwright.sync_api import sync_playwright
B="http://127.0.0.1:8081"
FIX=json.load(open("/tmp/opencode/s2/fixture.json"))
def reset(fx):
    r=urllib.request.Request(B+"/_test/reset",data=json.dumps(fx).encode(),headers={"content-type":"application/json"},method="POST")
    with urllib.request.urlopen(r) as resp: return resp.status
def out(i,ok,ev): print(("ROW %s PASS " if ok else "ROW %s FAIL ")%i+ev)
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={"width":1280,"height":900})
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    # signed OUT, closed day, date near today (2026-10-10 is a Saturday)
    date="2026-10-10"
    wd="sat"
    fx=json.loads(json.dumps(FIX)); fx["restaurants"][0]["opening_hours"]=[h for h in fx["restaurants"][0]["opening_hours"] if h["weekday"]!=wd]
    st=reset(fx); out("Q-setup",st==204,"reset %s"%st)
    page.goto(B+"/",wait_until="domcontentloaded")
    page.fill('[data-testid="date-input"]',date)
    page.click('[data-testid="search-button"]')
    try:
        page.wait_for_selector('[data-testid="availability-grid"], [data-testid="no-slots"]',timeout=8000); to=False
    except Exception: to=True
    ns=page.query_selector('[data-testid="no-slots"]'); g=page.query_selector('[data-testid="availability-grid"]')
    out("Q-closed-signedout", to is False, "wait timed out=%s ; no-slots present=%s visible=%s ; grid present=%s visible=%s ; errors=%s"%(to,ns is not None,ns is not None and ns.is_visible(),g is not None,g is not None and g.is_visible(),errs[:2]))
    # what does the panel actually contain?
    html=page.query_selector('[data-testid="availability-panel"]').inner_text()[:200].replace("\n"," | ")
    out("Q-panel-text", bool(html.strip()), "availability-panel text: %r"%html)
    b.close()
