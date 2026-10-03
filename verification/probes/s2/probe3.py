import json, urllib.request
from playwright.sync_api import sync_playwright
B="http://127.0.0.1:8081"
FIX=json.load(open("/tmp/opencode/s2/fixture.json"))
def reset(fx):
    r=urllib.request.Request(B+"/_test/reset",data=json.dumps(fx).encode(),headers={"content-type":"application/json"},method="POST")
    with urllib.request.urlopen(r) as resp: return resp.status
def out(i,ok,ev): print(("ROW %s PASS " if ok else "ROW %s FAIL ")%i+ev)
def pres(page,testid):
    e=page.query_selector('[data-testid="%s"]'%testid)
    return (e is not None, e is not None and e.is_visible())
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={"width":1280,"height":900})
    st=reset(FIX); out("R-setup",st==204,"reset %s"%st)
    page.goto(B+"/login",wait_until="domcontentloaded")
    page.fill('[data-testid="login-email"]',"ada@example.com"); page.fill('[data-testid="login-password"]',"correct horse")
    page.click('[data-testid="login-submit"]'); page.wait_for_load_state("domcontentloaded")
    page.fill('[data-testid="date-input"]',"2026-12-08"); page.fill('[data-testid="party-size-input"]',"6")
    page.click('[data-testid="search-button"]')
    page.wait_for_selector('[data-testid="availability-grid"] table',timeout=8000)
    # unavailable cell: t_1 capacity 4, party 6 -> only pair t_1+t_2 capacity 8 qualifies
    cells=page.eval_on_selector_all('[data-testid="grid-body"] tr','els=>els.length')
    out("R-cells",cells>0,"grid rows=%s"%cells)
    cell=page.query_selector('[data-testid^="slot-"]')
    tid=cell.get_attribute("data-testid"); avail=cell.get_attribute("data-available")
    out("R-first-cell",True,"first cell testid=%s data-available=%s"%(tid,avail))
    page.click('[data-testid="%s"]'%tid,force=True)
    page.wait_for_timeout(600)
    pv,vis=pres(page,"booking-form")
    out("R-unavailable-no-form", (not vis), "clicked an unavailable cell (%s available=%s): booking-form present=%s visible=%s"%(tid,avail,pv,vis))
    # now a real booking, then have a thief take the table -> booking-error
    page.goto(B+"/",wait_until="domcontentloaded")
    page.fill('[data-testid="date-input"]',"2026-12-08"); page.fill('[data-testid="party-size-input"]',"4")
    page.click('[data-testid="search-button"]'); page.wait_for_selector('[data-testid="availability-grid"] table',timeout=8000)
    page.click('[data-testid="slot-t_2-19:00"]'); page.wait_for_selector('[data-testid="booking-form"]',timeout=8000)
    out("R-form-opens",pres(page,"booking-form")[1],"booking-form visible after clicking an available cell")
    # thief takes t_2 at 19:00
    tok=json.loads(urllib.request.urlopen(urllib.request.Request(B+"/auth/login",data=json.dumps({"email":"bob@example.com","password":"correct horse"}).encode(),headers={"content-type":"application/json"},method="POST")).read().decode()).get("token") if False else None
    req=urllib.request.Request(B+"/auth/signup",data=json.dumps({"email":"thief@example.com","password":"hunter22","display_name":"Thief"}).encode(),headers={"content-type":"application/json"},method="POST")
    tok=json.loads(urllib.request.urlopen(req).read().decode())["token"]
    req=urllib.request.Request(B+"/reservations",data=json.dumps({"restaurant_id":"r_anker","table_id":"t_2","starts_at_local":"2026-12-08T19:00","party_size":4}).encode(),headers={"content-type":"application/json","authorization":"Bearer "+tok,"idempotency-key":"thief-1"},method="POST")
    st=urllib.request.urlopen(req).status
    out("R-thief",st==201,"thief booking status %s"%st)
    page.click('[data-testid="booking-submit"]')
    page.wait_for_selector('[data-testid="booking-error"]',timeout=8000)
    ev,evi=pres(page,"booking-error"); cv,cvi=pres(page,"confirmation"); uv,uvi=pres(page,"booking-uncertain")
    out("R-error-state", ev and evi and not uvi and not cvi, "after the refusal: booking-error present=%s visible=%s ; confirmation present=%s visible=%s ; booking-uncertain present=%s visible=%s"%(ev,evi,cv,cvi,uv,uvi))
    n_err=page.query_selector_all('[data-testid="booking-error"]'); n_conf=page.query_selector_all('[data-testid="confirmation"]')
    out("R-exactly-once", len(n_err)==1 and len(n_conf)==1, "booking-error count=%d confirmation count=%d (both must be exactly 1 in the document)"%(len(n_err),len(n_conf)))
    b.close()
