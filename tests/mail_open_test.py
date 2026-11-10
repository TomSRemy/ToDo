"""« Ouvrir le mail » : the PowerShell command copied for a task captured from Outlook (raw EntryID + StoreID, or an older « outlook: » link).
    python tests/mail_open_test.py
"""
import json, pathlib, sys
failures=[]
def check(c, m):
    print(("ok   " if c else "FAIL ")+m)
    if not c: failures.append(m)
URL=(pathlib.Path(__file__).resolve().parent.parent/'index.html').as_uri()
got={}
from playwright.sync_api import sync_playwright
E="00000000A1B2C3D4E5F60718293A4B5C6D7E8F900700ABCDEF0123456789ABCDEF"
tasks=[{"id":"t1","title":"Nouvelle tâche","mailEntryId":E,"mailStoreId":"0000000038A1BB10","link":"outlook:"+E,"status":"a_faire","urgency":"haute","createdAt":1,"updatedAt":1,"deleted":False,"archived":False},
       {"id":"t2","title":"Ancienne tâche","link":"outlook:"+E,"status":"a_faire","urgency":"haute","createdAt":1,"updatedAt":1,"deleted":False,"archived":False},
       {"id":"t3","title":"Lien piégé","link":"outlook:abc\"; Remove-Item C:\\ -Recurse","status":"a_faire","urgency":"haute","createdAt":1,"updatedAt":1,"deleted":False,"archived":False}]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1300,"height":800}, bypass_csp=True); ctx.grant_permissions(["clipboard-read","clipboard-write"]); pg=ctx.new_page(); err=[]
    pg.on("pageerror", lambda e: err.append(str(e)))
    pg.route("**/fonts.g*/**", lambda r: r.abort()); pg.route("https://tomsremy.github.io/PowerKlock/**", lambda r: r.abort())
    pg.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-tasks', %s); sessionStorage.setItem('s','1'); } }catch(e){}" % json.dumps(json.dumps(tasks)))
    pg.goto(URL); pg.wait_for_timeout(800); pg.click('[data-tab="tasks"]'); pg.wait_for_timeout(400)
    for t in ("t1","t2"):
        pg.locator(f".task-line[data-id='{t}'] .mail-open-btn, [data-id='{t}'] .mail-open-btn").first.click(); pg.wait_for_timeout(300)
        got[t]=pg.evaluate("navigator.clipboard.readText()")
    check(got["t1"].endswith('GetItemFromID("'+E+'", "0000000038A1BB10").Display()') and got["t1"].startswith("$ol = New-Object -ComObject Outlook.Application"), f"new task: the command uses the EntryID and the StoreID ({got['t1']!r})")
    check(got["t2"].endswith('GetItemFromID("'+E+'").Display()'), f"older task: the ID is read from « outlook:… » ({got['t2']!r})")
    check("Commande copiée" in pg.inner_text("#app-toast"), "a toast says the command is copied")
    check(pg.locator("[data-id='t3'] .mail-open-btn").count() == 0, "a link that is not a hex ID never becomes a command")
    check(not err, f"no page errors ({err})"); b.close()
print(f"\n{len(failures)} failure(s)"); sys.exit(1 if failures else 0)
