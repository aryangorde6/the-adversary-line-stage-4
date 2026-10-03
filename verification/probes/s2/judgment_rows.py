import os,json,sys,re,urllib.request
sys.path.insert(0,"/home/aryan/band_hack/band-work/tablekeeper5/verification/probes/s2")
from playwright.sync_api import sync_playwright
import os
B=os.environ.get("BASE","http://127.0.0.1:8081")
import closed_day as cd
urllib.request.urlopen(urllib.request.Request(B+"/_test/reset",data=json.dumps(cd.FIXTURE).encode(),headers={"content-type":"application/json"},method="POST"))
RESULTS=[]
def out(i,ok,ev):
    print(("ROW %s PASS " if ok else "ROW %s FAIL ")%i+ev)
    RESULTS.append(bool(ok))
IDS=re.compile(r'\b[tr]_[a-z0-9_]+\b')
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={"width":1280,"height":900})
    texts={}
    for route in ("/","/signup","/login","/lookup"):
        page.goto(B+route,wait_until="domcontentloaded"); page.wait_for_timeout(200)
        t=page.inner_text("body"); texts[route]=t
        out("J-%s-nonempty"%route.strip("/"), len(t.strip())>40, "%s visible text %d chars"%(route,len(t.strip())))
    joined="\n".join(texts.values())
    found=sorted(set(IDS.findall(joined)))
    out("J-no-ids", not found, "raw identifiers in visible text across four routes: %s"%found)
    # pair booking
    page.goto(B+"/login",wait_until="domcontentloaded")
    page.fill('[data-testid="login-email"]',"ada@example.com");page.fill('[data-testid="login-password"]',"correct horse")
    page.click('[data-testid="login-submit"]');page.wait_for_selector('[data-testid="current-user"]',timeout=10000)
    page.goto(B+"/",wait_until="domcontentloaded")
    page.fill('[data-testid="date-input"]',"2026-12-08");page.fill('[data-testid="party-size-input"]',"5")
    page.click('[data-testid="search-button"]');page.wait_for_selector('[data-testid="availability-grid"] table',timeout=10000)
    page.wait_for_timeout(500)
    pair=page.query_selector('[data-testid^="slot-t_1+t_2-"]')
    out("J-pair-exists", pair is not None, "a declared pair cell exists for a party of 5: %s"%(pair.get_attribute('data-testid') if pair else None))
    celltext=page.inner_text(pair.get_attribute and '[data-testid="%s"]'%pair.get_attribute('data-testid')) if pair else ""
    page.click('[data-testid="%s"]'%pair.get_attribute('data-testid')); page.wait_for_selector('[data-testid="booking-form"]',timeout=10000)
    summary=page.inner_text('[data-testid="booking-summary"]')
    page.click('[data-testid="booking-submit"]'); page.wait_for_selector('[data-testid="confirmation"]',timeout=10000)
    tables=page.inner_text('[data-testid="confirmation-tables"]');details=page.inner_text('[data-testid="confirmation-details"]')
    for name,val in (("cell",celltext),("booking-summary",summary),("confirmation-tables",tables),("confirmation-details",details)):
        ids=sorted(set(IDS.findall(val)))
        out("J-pair-%s"%name, not ids and "+" not in val and "combined" not in val.lower(),
            "%s = %r ; identifiers=%s plus-sign=%s"%(name,val.strip()[:90],ids,"+" in val))
    # explanatory words: text that tells the reader how the system works
    jargon=["test id","data-testid","api","endpoint","json","idempotency","http","debug","stub","mock"]
    low="\n".join([celltext,summary,tables,details]).lower()
    hits=[w for w in jargon if w in low]
    out("J-no-explainer", not hits, "system-explaining words in the diner-facing booking text: %s"%hits)
    b.close()
print("SUMMARY %d/%d passed" % (sum(RESULTS), len(RESULTS)))
sys.exit(0 if all(RESULTS) else 1)
