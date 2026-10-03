import json, os, sys, urllib.request
from playwright.sync_api import sync_playwright
import os
B=os.environ.get("BASE","http://127.0.0.1:8081")
FX={"users":[{"id":"u_ada","email":"ada@example.com","password":"correct horse","display_name":"Ada"}],
"restaurants":[{"id":"r_anker","name":"Zum Anker","timezone":"Europe/Berlin","slot_minutes":30,"reservation_duration_minutes":90,
"tables":[{"id":"t_1","label":"Window","capacity":4},{"id":"t_2","label":"Corner","capacity":4}],
"combinable":[["t_1","t_2"]],
"opening_hours":[{"weekday":w,"opens":"00:00","closes":"23:30"} for w in ["mon","tue","wed","thu","fri","sat","sun"]]}],
"reservations":[]}
def reset():
    r=urllib.request.Request(B+"/_test/reset",data=json.dumps(FX).encode(),headers={"content-type":"application/json"},method="POST")
    return urllib.request.urlopen(r).status
RESULTS=[]
def out(i,ok,ev):
    print(("ROW %s PASS " if ok else "ROW %s FAIL ")%i+ev)
    RESULTS.append(bool(ok))
    return ok
def q(page,t):
    e=page.query_selector('[data-testid="%s"]'%t); return e is not None
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={"width":1280,"height":900})
    print("reset",reset())
    # signed out, on load
    page.goto(B+"/",wait_until="domcontentloaded"); page.wait_for_timeout(300)
    out("X-load", (not q(page,"booking-form")) and (not q(page,"confirmation")),
        "signed out on load: booking-form in document=%s confirmation in document=%s"%(q(page,"booking-form"),q(page,"confirmation")))
    page.goto(B+"/login",wait_until="domcontentloaded")
    page.fill('[data-testid="login-email"]',"ada@example.com");page.fill('[data-testid="login-password"]',"correct horse")
    page.click('[data-testid="login-submit"]'); page.wait_for_selector('[data-testid="current-user"]',timeout=10000)
    page.wait_for_timeout(300)
    out("X-load-in", (not q(page,"booking-form")) and (not q(page,"confirmation")),
        "signed in on load: booking-form in document=%s confirmation in document=%s"%(q(page,"booking-form"),q(page,"confirmation")))
    # open an available cell -> form appears
    page.fill('[data-testid="date-input"]',"2026-12-08"); page.click('[data-testid="search-button"]')
    page.wait_for_selector('[data-testid="availability-grid"] table',timeout=10000)
    page.click('[data-testid="slot-t_2-19:00"]'); page.wait_for_timeout(400)
    out("X-open", q(page,"booking-form") and not q(page,"confirmation"),
        "after choosing a free table: booking-form in document=%s confirmation in document=%s"%(q(page,"booking-form"),q(page,"confirmation")))
    # a new search takes the form out
    page.fill('[data-testid="date-input"]',"2026-12-09"); page.click('[data-testid="search-button"]')
    page.wait_for_timeout(1500)
    out("X-search-clears", not q(page,"booking-form"),
        "after a new search: booking-form in document=%s (an abandoned attempt must be taken out)"%q(page,"booking-form"))
    # end-to-end booking, driven: form -> submit -> confirmation -> reference
    page.fill('[data-testid="date-input"]',"2026-12-08"); page.click('[data-testid="search-button"]')
    page.wait_for_selector('[data-testid="availability-grid"] table',timeout=10000)
    page.click('[data-testid="slot-t_2-19:00"]'); page.wait_for_selector('[data-testid="booking-form"]',timeout=10000)
    page.click('[data-testid="booking-submit"]'); page.wait_for_selector('[data-testid="confirmation"]',timeout=10000)
    ref=page.inner_text('[data-testid="confirmation-reference"]').strip()
    tok=json.loads(urllib.request.urlopen(urllib.request.Request(B+"/auth/login",data=json.dumps({"email":"ada@example.com","password":"correct horse"}).encode(),headers={"content-type":"application/json"},method="POST")).read())["token"]
    r=urllib.request.Request(B+"/reservations/"+ref,headers={"authorization":"Bearer "+tok},method="GET")
    st=json.loads(urllib.request.urlopen(r).read())
    out("X-booked", bool(ref) and st.get("reference")==ref and st.get("status")=="confirmed",
        "drove a booking end to end: confirmation shows %r and GET /reservations/%s -> status %s"%(ref,ref,st.get("status")))
    # lookup by that reference: the detail is built only when there is one
    page.goto(B+"/lookup",wait_until="domcontentloaded")
    out("X-lookup-empty", not q(page,"reservation-detail"),
        "on /lookup before searching: reservation-detail in document=%s"%q(page,"reservation-detail"))
    page.fill('[data-testid="lookup-reference-input"]',ref); page.click('[data-testid="lookup-submit"]')
    page.wait_for_timeout(1200)
    out("X-lookup-found", q(page,"reservation-detail"),
        "after looking up %r: reservation-detail in document=%s"%(ref,q(page,"reservation-detail")))
    b.close()
print("SUMMARY %d/%d passed" % (sum(1 for x in RESULTS if x), len(RESULTS)))
sys.exit(0 if all(RESULTS) else 1)
