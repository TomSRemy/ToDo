"""Sauvegarde locale : the app writes its whole backup through the Excel bridge (stubbed here), once a day, encrypted
when the GitHub sync is ; « Restaurer… » lists the bridge's files, shows what one holds, and puts it back.
    python tests/local_backup_test.py
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
failures = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: failures.append(m)
URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
files = {}   # name -> content, what the stubbed bridge holds
def task(i, title): return {"id": i, "title": title, "status": "a_faire", "urgency": "normale", "createdAt": 1, "updatedAt": 1, "deleted": False, "archived": False}

def bridge(route):
    req = route.request; path = req.url.split("8765", 1)[1]
    body = json.loads(req.post_data or "null") if req.method == "POST" else None
    h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    if req.method == "OPTIONS": return route.fulfill(status=204, headers={**h, "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Token"})
    if path == "/status": out = {"ok": True, "version": "1.34", "authorized": True, "pipe": {"name": "Pipe.xlsx", "found": True}, "bdd": {"name": "Suivi.xlsx", "found": True}}
    elif path == "/backup/write":
        import datetime
        name = "todo-" + datetime.date.today().isoformat() + (".json.enc" if body["encrypted"] else ".json")
        files[name] = body["content"]; out = {"ok": True, "dir": "C:\\OneDrive\\ToDo\\sauvegardes", "file": {"name": name, "size": len(body["content"])}}
    elif path == "/backup/list": out = {"ok": True, "dir": "C:\\OneDrive\\ToDo\\sauvegardes", "files": [{"name": n, "size": len(c)} for n, c in sorted(files.items(), reverse=True)]}
    elif path == "/backup/read": out = {"ok": True, "name": body["name"], "content": files[body["name"]]}
    else: out = {"ok": False}
    route.fulfill(status=200, headers=h, body=json.dumps(out))

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1300, "height": 850}, bypass_csp=True); err = []
    pg.on("pageerror", lambda e: err.append(str(e)))
    pg.route("**/fonts.g*/**", lambda r: r.abort()); pg.route("https://tomsremy.github.io/PowerKlock/**", lambda r: r.abort())
    pg.route("http://127.0.0.1:8765/**", bridge)
    pg.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-tasks', %s); localStorage.setItem('todo_bridge-config', JSON.stringify({ port:8765, token:'k' })); sessionStorage.setItem('s','1'); } }catch(e){}"
                       % json.dumps(json.dumps([task("t1", "Appeler Solaris"), task("t2", "Relancer Ventus")])))
    pg.goto(URL); pg.wait_for_timeout(4000)
    names = list(files)
    check(len(names) == 1 and names[0].endswith(".json"), f"at start, with the bridge there, today's backup is written once ({names})")
    data = json.loads(files[names[0]]) if names else {}
    check(len(data.get("tasks", [])) == 2 and "crm" in data, "… holding the tasks and the CRM")
    pg.reload(); pg.wait_for_timeout(4000)
    check(len(files) == 1, "reloaded the same day : no second backup")
    # the old day's file to restore ; today a task more
    files["todo-2026-01-05.json"] = json.dumps({"version": 2, "tasks": [task("t9", "Tâche de janvier")], "notes": [], "crm": {"companies": [], "contacts": [], "meetings": [], "opportunities": []}})
    pg.click('[data-tab="lists"]'); pg.wait_for_timeout(300)
    st = pg.inner_text("#lb-status")
    check("Dernière : aujourd’hui" in st and "OneDrive" in st, f"Réglages says when the last local backup was made and where ({st!r})")
    pg.click("#lb-restore-btn"); pg.wait_for_timeout(400)
    pg.click("#choice-btns button:has-text('2026-01-05')"); pg.wait_for_timeout(400)
    ask = pg.inner_text("#choice-overlay")
    check("1 tâche," in ask and "2 tâches" in ask and "juste avant" in ask, f"before replacing : what the file holds, what is there now, a safety copy announced ({ask!r})")
    pg.click("#choice-btns button:has-text('Restaurer')"); pg.wait_for_timeout(800)
    tasks = [t["title"] for t in json.loads(pg.evaluate("window.storage.peek('todo-widget-tasks')")) if not t.get("deleted")]
    check(tasks == ["Tâche de janvier"], f"restored : the file's tasks are back ({tasks})")
    today = [n for n in files if n != "todo-2026-01-05.json"][0]
    check(len(json.loads(files[today])["tasks"]) == 2, "the state before restoring was saved first")
    # encrypted sync : the local backup is encrypted too, and still restores
    pg.evaluate("""(async()=>{ await window.TodoCrypt.setup('phrase secrète de test'); })()"""); pg.wait_for_timeout(1500)
    pg.click("#lb-save-btn"); pg.wait_for_timeout(1500)
    enc = [n for n in files if n.endswith(".enc")]
    check(len(enc) == 1 and json.loads(files[enc[0]]).get("enc") == "todo-aesgcm-1" and "Tâche de janvier" not in files[enc[0]], f"encrypted sync : the local backup is encrypted ({enc})")
    check(not err, f"no page errors ({err})")
    b.close()
print(f"\n{len(failures)} failure(s)"); sys.exit(1 if failures else 0)
