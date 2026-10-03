import json, urllib.request
from playwright.sync_api import sync_playwright
B="http://127.0.0.1:8081"
FIX=json.load(open("/tmp/opencode/s2/fixture.json"))
def reset(fx):
    r=urllib.request.Request(B+"/_test/reset",data=json.dumps(fx).encode(),headers={"content-type":"application/json"},method="POST")
    with urllib.request.urlopen(r) as resp: return resp.status
def out(i,ok,ev): print(("ROW %s PASS " if ok else "ROW %s FAIL ")%i+ev)
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (375,1280):
        page=b.new_page(viewport={"width":w,"height":800}); reset(FIX)
        for route in ("/","/signup","/login","/lookup"):
            page.goto(B+route,wait_until="domcontentloaded"); page.wait_for_timeout(200)
            m=page.evaluate("()=>[document.documentElement.scrollWidth, window.innerWidth]")
            out("S-%s%s"%(route.strip("/") or "home",w), m[0]<=m[1]+1, "%s at %d: scrollWidth=%d innerWidth=%d"%(route,w,m[0],m[1]))
        page.close()
    b.close()
