"""The app and the real bridge together (bridge/pont-excel.ps1 -Mock: an in-memory table, no Excel), in a browser.

Checks that the two understand each other: what the app sends lands in the right columns of « Pipe Agrégation » and
« BDD Agrégation », a second send changes nothing, a colleague's change is shown and the two questions work both ways,
and the Suivi is read on its real key columns (AF « Nom_prod », AH « Nom_Installation_prod »).
    python tests/bridge_e2e.py
Needs PowerShell (pwsh); skipped (exit 0) when it is absent.
"""
import json, os, pathlib, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
if not PWSH:
    print("PowerShell absent: skipped"); sys.exit(0)
failures = []
def relire(page):
    """« ↻ Relire ». This test checks the cell-by-cell grid : run with the Pipe import off (team mode « supabase » in the seed,
    the import itself is tests/pipe_import_test.py) ; should the import's first question show anyway, « Plus tard »"""
    page.click("#tab-excel .xs-read")
    try:
        page.wait_for_selector("#choice-overlay:not(.hidden) >> text=Lignes de l’Excel à importer", timeout=4000)
        page.click("#choice-btns button:has-text('Plus tard')")
    except Exception:
        pass


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond: failures.append(msg)

work = pathlib.Path(tempfile.mkdtemp()); shutil.copy(ROOT / "bridge" / "pont-excel.ps1", work / "pont-excel.ps1")
with socket.socket() as s_:
    s_.bind(("127.0.0.1", 0)); PORT = s_.getsockname()[1]
log = open(work / "bridge.log", "wb")
proc = subprocess.Popen([PWSH, "-NoProfile", "-File", str(work / "pont-excel.ps1"), "-Mock", "-Port", str(PORT)], cwd=work, stdout=log, stderr=subprocess.STDOUT)
def call(method, path, body=None):
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (PORT, path), method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "X-Bridge-Token": "mocktoken"})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read().decode())
for _ in range(60):
    try: call("GET", "/status"); break
    except Exception: time.sleep(0.5)

PH = ["C%d" % (i + 1) for i in range(37)]
for i, h in {0: "Année", 1: "New", 3: "Date entrée pipe", 6: "Nom Producteur", 16: "CR", 18: "CR2", 19: "Nom Centrale", 30: "Stade", 35: "Commentaires", 36: "Qualification"}.items(): PH[i] = h
BH = ["B%d" % (i + 1) for i in range(91)]
for i, h in {1: "Année", 3: "Date entrée BDD", 6: "Développeur", 7: "Ref_Watt.ee", 24: "Statut", 29: "Renouvellement", 30: "Commentaire", 31: "Nom_prod", 33: "Nom_Installation_prod"}.items(): BH[i] = h
other = [""] * 37; other[6] = "AUTRE PROD"; other[19] = "Autre toit"; other[30] = "En attente"
call("POST", "/mock/seed/pipe", {"headers": PH, "rows": [other], "formulas": [], "checkboxes": [2, 17, 19, 37]})
call("POST", "/mock/seed/bdd", {"headers": BH, "rows": [], "formulas": [30], "checkboxes": []})
dump = lambda k: call("GET", "/mock/dump/" + k)["rows"]

insts = [{"id": "e%d" % i, "kind": "installation", "company": "SCEA Essai", "producteur": "SCEA Essai", "centrale": "Toit %d" % i, "title": "Toit %d" % i,
          "stage": "pricing_indicatif" if i < 3 else "collecte", "kwc": str(100 + i), "new": i % 2 == 0, "qualification": True, "commentaires": "Note appli" if i == 2 else "",
          "createdAt": 1, "updatedAt": 1, "deleted": False} for i in range(12)]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_page(viewport={"width": 1400, "height": 900}, bypass_csp=True); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("**/fonts.g*/**", lambda r: r.abort())
        page.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-opportunities', %s); localStorage.setItem('todo_bridge-config', %s); localStorage.setItem('team-mode', 'supabase'); sessionStorage.setItem('s','1'); } }catch(e){}"
                             % (json.dumps(json.dumps(insts)), json.dumps(json.dumps({"port": PORT, "token": "mocktoken"}))))
        page.goto(URL); page.click('[data-tab="pipeline"]'); page.click("#pipe-more-btn"); page.click("#pipe-xs-btn")
        page.wait_for_selector("#tab-excel .xs-send[data-k=pipe]:not([disabled])", timeout=20000)
        page.click("#tab-excel .xs-send[data-k=pipe]")
        page.wait_for_function("document.querySelector('#tab-excel .xs-send[data-k=pipe]').textContent.startsWith('Envoyer')", timeout=60000)
        sent_msg = page.evaluate("(document.getElementById('bridge-msg')||{}).textContent||''")
        rows = dump("pipe")
        mine = [r for r in rows if r[6] == "SCEA Essai"]
        if len(rows) != 13: print("app message after the send:", sent_msg)
        check(len(rows) == 13 and len(mine) == 12 and rows[0][6] == "AUTRE PROD", f"12 lines added after the colleague's one, nothing else moved ({len(rows)} lines: {[r[19] for r in rows]})")
        if len(rows) != 13: print((work / "bridge.log").read_text(encoding="utf-8", errors="replace")[-3000:])
        r0 = next(r for r in mine if r[19] == "Toit 0")
        check(r0[22] == "100" and r0[1] == "True" and r0[36] == "True", f"each value in its column (kWc in W, New in B, Qualification in AK): {r0[22]!r} {r0[1]!r} {r0[36]!r}")
        snap = dump("pipe")
        relire(page); page.wait_for_timeout(1500)
        check(page.locator("#tab-excel .xl-tag.todo").count() == 0, "after the send and a new reading: no cell left to decide")
        # a colleague writes a comment in two lines (the panel is a grid per card since nov. 2: open the card, pick
        # « Excel » (the default) or « Appli » per cell, then the card's button)
        idx = {r[19]: i for i, r in enumerate(rows)}
        call("POST", "/mock/edit/pipe", {"op": "set", "row": idx["Toit 1"] + 1, "col": 36, "value": "Vu par Paul"})
        call("POST", "/mock/edit/pipe", {"op": "set", "row": idx["Toit 2"] + 1, "col": 36, "value": "Rappeler en mars"})
        c1, c2 = "#tab-excel .xl-lot[data-rid='solo-e1']", "#tab-excel .xl-lot[data-rid='solo-e2']"
        relire(page); page.wait_for_selector(c1 + " .xl-tag.todo", timeout=20000)
        # Toit 1: the app had no comment, a colleague wrote one → keeping the Excel (default) brings it into the app
        page.click(c1 + " .xl-head")
        check("Vu par Paul" in page.inner_text(c1 + " .xl-grid"), "a colleague's comment shows up in its card")
        page.click(c1 + " .xl-foot button")
        e1 = lambda: next(o for o in json.loads(page.evaluate("window.storage.peek('todo-widget-opportunities')")) if o["id"] == "e1")
        ok = False
        for _ in range(60):
            if e1().get("commentaires") == "Vu par Paul": ok = True; break
            page.wait_for_timeout(100)
        check(ok, f"keeping the Excel: the app takes the colleague's comment ({e1().get('commentaires')!r})")
        # Toit 2: the app wrote « Note appli », a colleague replaced it → picking « Appli » writes it back (the value seen is still there)
        page.wait_for_selector(c2 + " .xl-head", timeout=10000)
        page.click(c2 + " .xl-head")
        page.click(c2 + " .xl-cell button:has-text('Note appli')")
        page.click(c2 + " .xl-foot button")
        t2 = lambda: next(r for r in dump("pipe") if r[19] == "Toit 2")[35]
        for _ in range(60):
            if t2() == "Note appli": break
            page.wait_for_timeout(100)
        check(t2() == "Note appli", f"picking the app's value: it is back in the Excel ({t2()!r})")
        # the Suivi: from the pricing on; read back on its real key columns
        page.click("#tab-excel .xs-send[data-k=bdd]"); page.wait_for_timeout(3000)
        brows = dump("bdd")
        check(len(brows) == 3 and all(r[31] == "SCEA Essai" for r in brows) and sorted(r[33] for r in brows) == ["Toit 0", "Toit 1", "Toit 2"], f"Suivi: the 3 lines at the pricing step, keys in AF / AH ({[(r[31], r[33]) for r in brows]})")
        relire(page); page.wait_for_timeout(2000)
        body = page.inner_text("#tab-excel .xs-body") if page.locator("#tab-excel .xs-body table").count() else ""
        check("Absent du fichier" not in body, "Suivi read back on its key columns: no line wrongly « absent »")
        check(not errors, f"no page errors ({errors})")
        b.close()
finally:
    proc.terminate()
    try: proc.wait(timeout=10)
    except Exception: proc.kill()
print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
