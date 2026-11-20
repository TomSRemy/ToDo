"""ToDo Entreprise: the bridge keeps the data, the browser only shows them (js/app.js storeGet/storePut, bridge Handle-Store).

What is promised: a browser emptied (or another browser) finds everything again; two windows writing at the same time
lose nothing; with the bridge stopped the app goes on and hands its changes over when the bridge is back; a write cut
in the middle never leaves half a file; a write from an older version is refused; only the local page with the key
can read or write.
    python tests/bridge_store_test.py
Needs PowerShell (pwsh); skipped (exit 0) when it is absent.
"""
import http.client, json, os, pathlib, shutil, socket, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
if not PWSH:
    print("PowerShell absent: skipped"); sys.exit(0)
fails = []
def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

app = pathlib.Path(tempfile.mkdtemp()) / "ToDo"
shutil.copytree(ROOT, app, ignore=shutil.ignore_patterns(".git", ".agents", ".claude", "__pycache__", "node_modules", "tests"))
(app / "profil.json").write_text(json.dumps({"edition": "entreprise", "marche": False}), encoding="utf-8")
STORE = app / "bridge" / "mock-store"
with socket.socket() as s_:
    s_.bind(("127.0.0.1", 0)); PORT = s_.getsockname()[1]
BASE = f"http://127.0.0.1:{PORT}"
proc = log = None
def start():
    global proc, log
    log = open(app / "bridge.log", "ab")
    proc = subprocess.Popen([PWSH, "-NoProfile", "-File", str(app / "bridge" / "pont-excel.ps1"), "-Mock", "-Port", str(PORT)], cwd=app / "bridge", stdout=log, stderr=subprocess.STDOUT)
    for _ in range(80):
        try: raw("GET", "/status"); return
        except Exception: time.sleep(0.5)
def stop():
    proc.terminate()
    try: proc.wait(10)
    except Exception: proc.kill()
    log.close()
def raw(method, path, body=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=30)
    h = {"Host": f"127.0.0.1:{PORT}"}; h.update(headers or {})
    c.request(method, path, body=body, headers=h); r = c.getresponse(); data = r.read(); c.close()
    return r.status, {k.lower(): v for k, v in r.getheaders()}, data
TOKEN = {"X-Bridge-Token": "mocktoken"}
def stored_titles():
    st, _, data = raw("GET", "/store?f=tasks.json", headers=TOKEN)
    return [t.get("title") for t in json.loads(data) if not t.get("deleted")] if st == 200 else []
def eventually(fn, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if fn(): return True
        except Exception: pass
        time.sleep(0.3)
    return False

start()
try:
    # ---- the bridge's rules
    st, _, _ = raw("GET", "/store?f=tasks.json")
    check(st == 401, f"no key : refused ({st})")
    st, _, _ = raw("GET", "/store?f=tasks.json", headers={**TOKEN, "Origin": "https://tomsremy.github.io"})
    check(st == 403, f"another site : refused ({st})")
    for bad in ["../x.json", "..%5Cx.json", "tasks.txt", "a%2Fb.json", ""]:
        st, _, _ = raw("GET", "/store?f=" + bad, headers=TOKEN)
        check(st == 400, f"file name {bad!r} refused ({st})")
    st, _, _ = raw("GET", "/store?f=tasks.json", headers=TOKEN)
    check(st == 404, f"nothing kept yet ({st})")
    st, _, data = raw("POST", "/store?f=essai.json&rev=", body=b'[{"id":"a"}]', headers=TOKEN)
    rev1 = json.loads(data).get("rev"); check(st == 200 and rev1, f"first write ({st})")
    st, _, data = raw("POST", "/store?f=essai.json&rev=", body=b'[{"id":"b"}]', headers=TOKEN)
    check(st == 409 and json.loads(data).get("rev") == rev1, f"a write that does not start from the current version is refused ({st})")
    st, h, data = raw("GET", "/store?f=essai.json", headers=TOKEN)
    check(st == 200 and h.get("x-store-rev") == rev1 and json.loads(data) == [{"id": "a"}], "the file is unchanged, with its version")
    st, _, data = raw("POST", f"/store?f=essai.json&rev={rev1}", body=b'[{"id":"c"}]', headers=TOKEN)
    check(st == 200 and json.loads((STORE / "essai.json.prev").read_text()) == [{"id": "a"}], "a write from the current version passes ; the previous one is kept (.prev)")
    st, _, _ = raw("POST", "/store?f=essai.json&rev=" + json.loads(data)["rev"], body=b'not json', headers=TOKEN)
    check(st == 400 and json.loads((STORE / "essai.json").read_text()) == [{"id": "c"}], f"something that is not data is refused, the file untouched ({st})")
    # a write cut in the middle : only the side file is half written, the data file stays whole
    (STORE / "essai.json.tmp").write_text('[{"id":"half', encoding="utf-8")
    st, _, data = raw("GET", "/store?f=essai.json", headers=TOKEN)
    check(st == 200 and json.loads(data) == [{"id": "c"}], "a write cut in the middle leaves the data whole")

    with sync_playwright() as p:
        b = p.chromium.launch()
        def window(errors):
            ctx = b.new_context(viewport={"width": 1300, "height": 850}); pg = ctx.new_page()
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(BASE + "/app/"); pg.wait_for_selector(".tab.active")
            return ctx, pg
        def add(pg, title):
            pg.click('[data-tab="tasks"]'); pg.fill("#quick-add-input", title); pg.press("#quick-add-input", "Enter")
        def shows(pg, title):
            pg.click('[data-tab="tasks"]'); return pg.locator(f"#task-list .task-line:has-text('{title}')").count() > 0
        errors = []
        c1, p1 = window(errors)
        add(p1, "Appeler la SEM")
        check(eventually(lambda: "Appeler la SEM" in stored_titles()), f"a task is kept by the bridge within seconds ({stored_titles()})")
        check(eventually(lambda: "Enregistré" in p1.inner_text("#sync-pill"), 5), f"the app says the data are kept on this PC ({p1.inner_text('#sync-pill')!r})")

        # ---- an emptied browser (a new one, nothing in it) finds everything again
        c2, p2 = window(errors)
        check(eventually(lambda: shows(p2, "Appeler la SEM"), 10), "a browser with nothing in it finds the tasks again")

        # ---- two windows at the same time : nothing lost
        add(p1, "Tâche fenêtre 1"); add(p2, "Tâche fenêtre 2")
        check(eventually(lambda: {"Tâche fenêtre 1", "Tâche fenêtre 2", "Appeler la SEM"} <= set(stored_titles()), 20), f"two windows writing at once : both kept ({stored_titles()})")
        p1.evaluate("window.todoSyncNow()"); p2.evaluate("window.todoSyncNow()")
        check(eventually(lambda: shows(p1, "Tâche fenêtre 2") and shows(p2, "Tâche fenêtre 1"), 15), "each window gets the other one's task")

        # ---- a task done in one window, still done after the other writes
        p1.evaluate("window.todoSyncNow()")
        before = set(stored_titles())

        # ---- the bridge stopped : the app goes on, hands over when it is back
        stop()
        add(p1, "Pendant la coupure")
        p1.wait_for_timeout(4500)
        check(shows(p1, "Pendant la coupure"), "bridge stopped : the app goes on")
        pill = p1.inner_text("#sync-pill")
        check("Pont arrêté" in pill, f"bridge stopped : the app says so ({pill!r})")
        start()
        p1.evaluate("window.todoSyncNow()")
        check(eventually(lambda: "Pendant la coupure" in stored_titles(), 20), f"bridge back : the change is handed over ({stored_titles()})")
        check(before <= set(stored_titles()), "nothing kept earlier was lost on the way")

        # ---- every part of the data is kept (tasks, contacts / pipeline, notes)
        check((STORE / "tasks.json").exists() and (STORE / "crm.json").exists() and (STORE / "notes.json").exists(), f"tasks, CRM and notes each have their file ({sorted(x.name for x in STORE.iterdir())})")
        check(not errors, f"no page errors ({errors})")
        b.close()
finally:
    try: stop()
    except Exception: pass
    if fails: print((app / "bridge.log").read_text(encoding="utf-8", errors="replace")[-3000:])
print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
