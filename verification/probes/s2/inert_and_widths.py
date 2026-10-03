import json, urllib.request
from playwright.sync_api import sync_playwright
import os
B=os.environ.get("BASE","http://127.0.0.1:8081")
FX=json.load(open("/home/aryan/band_hack/band-work/tablekeeper5/verification/probes/s2/closed_day.py".replace(".py",".py"))) if False else None
import sys; sys.path.insert(0,"/home/aryan/band_hack/band-work/tablekeeper5/verification/probes/s2")
import closed_day as cd
RESULTS=[]
def out(i,ok,ev):
    print(("ROW %s PASS " if ok else "ROW %s FAIL ")%i+ev)
    RESULTS.append(bool(ok))
    return ok
def reset(fx):
    r=urllib.request.Request(B+"/_test/reset",data=json.dumps(fx).encode(),headers={"content-type":"application/json"},method="POST")
    return urllib.request.urlopen(r).status
with sync_playwright() as p:
    b=p.chromium.launch()
    # widths
    for w in (375,1280):
        page=b.new_page(viewport={"width":w,"height":800}); reset(cd.FIXTURE)
        for route in ("/","/signup","/login","/lookup"):
            page.goto(B+route,wait_until="domcontentloaded"); page.wait_for_timeout(150)
            m=page.evaluate("()=>[document.documentElement.scrollWidth, window.innerWidth]")
            out("W-%s%s"%(route.strip("/") or "home",w), m[0]<=m[1]+1, "%s at %d: scrollWidth=%d innerWidth=%d"%(route,w,m[0],m[1]))
        page.close()
    # unavailable cell inertness on a fully-booked day
    print("reset",reset(cd.FIXTURE))
    tok=json.loads(urllib.request.urlopen(urllib.request.Request(B+"/auth/login",data=json.dumps({"email":"ada@example.com","password":"correct horse"}).encode(),headers={"content-type":"application/json"},method="POST")).read())["token"]
    for hour in (0,2,4,6,8,10,12,14,16,18,20,22):
        for t in ("t_1","t_2"):
            r=urllib.request.Request(B+"/reservations",data=json.dumps({"restaurant_id":"r_anker","table_id":t,"starts_at_local":"2026-12-08T%02d:00"%hour,"party_size":2}).encode(),headers={"content-type":"application/json","authorization":"Bearer "+tok,"idempotency-key":"t-%s-%d"%(t,hour)},method="POST")
            try: urllib.request.urlopen(r)
            except Exception: pass
    page=b.new_page(viewport={"width":1280,"height":900})
    page.goto(B+"/login",wait_until="domcontentloaded")
    page.fill('[data-testid="login-email"]',"ada@example.com");page.fill('[data-testid="login-password"]',"correct horse")
    page.click('[data-testid="login-submit"]'); page.wait_for_selector('[data-testid="current-user"]',timeout=10000)
    page.goto(B+"/",wait_until="domcontentloaded")
    page.fill('[data-testid="date-input"]',"2026-12-08"); page.click('[data-testid="search-button"]')
    page.wait_for_selector('[data-testid="availability-grid"] table',timeout=10000); page.wait_for_timeout(800)
    info=page.eval_on_selector('[data-testid="slot-t_1-17:00"]',"e=>({avail:e.getAttribute('data-available'),disabled:e.disabled,aria:e.getAttribute('aria-disabled'),tag:e.tagName})")
    out("I-props", info["avail"]=="false" and info["disabled"] is True and info["aria"]=="true",
        "an unavailable cell: data-available=%r disabled=%r aria-disabled=%r tag=%s"%(info["avail"],info["disabled"],info["aria"],info["tag"]))
    before=page.inner_html('[data-testid="availability-grid"]')
    page.eval_on_selector('[data-testid="slot-t_1-17:00"]',"e=>e.click()")
    page.wait_for_timeout(800)
    after=page.inner_html('[data-testid="availability-grid"]')
    bf=page.query_selector('[data-testid="booking-form"]')
    out("I-inert", (not bf.is_visible()) if bf else True,
        "after e.click() on the unavailable cell: booking-form present=%s visible=%s ; grid unchanged=%s"%(bf is not None, bf is not None and bf.is_visible(), before==after))
    b.close()
print("SUMMARY %d/%d passed" % (sum(1 for x in RESULTS if x), len(RESULTS)))
sys.exit(0 if all(RESULTS) else 1)
