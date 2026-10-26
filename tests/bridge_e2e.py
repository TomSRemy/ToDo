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
        b = p.chromium.launch(); page = b.new_page(viewport={"width": 1400, "height": 900}); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("**/fonts.g*/**", lambda r: r.abort())
        page.add_init_script("if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-opportunities', %s); localStorage.setItem('todo_bridge-config', %s); sessionStorage.setItem('s','1'); }"
                             % (json.dumps(json.dumps(insts)), json.dumps(json.dumps({"port": PORT, "token": "mocktoken"}))))
        page.goto(URL); page.click('[data-tab="pipeline"]'); page.click("#pipe-more-btn"); page.click("#pipe-xs-btn")
        page.wait_for_selector("#xs-overlay .xs-send[data-k=pipe]:not([disabled])", timeout=20000)
        page.click("#xs-overlay .xs-send[data-k=pipe]")
        page.wait_for_function("document.querySelector('#xs-overlay .xs-send[data-k=pipe]').textContent.startsWith('Envoyer')", timeout=60000)
        rows = dump("pipe")
        mine = [r for r in rows if r[6] == "SCEA Essai"]
        check(len(rows) == 13 and len(mine) == 12 and rows[0][6] == "AUTRE PROD", f"12 lines added after the colleague's one, nothing else moved ({len(rows)} lines)")
        r0 = next(r for r in mine if r[19] == "Toit 0")
        check(r0[22] == "100" and r0[1] == "True" and r0[36] == "True", f"each value in its column (kWc in W, New in B, Qualification in AK): {r0[22]!r} {r0[1]!r} {r0[36]!r}")
        snap = dump("pipe")
        page.click("#xs-overlay .xs-read"); page.wait_for_timeout(1500)
        check("Tout est à jour" in page.inner_text("#xs-overlay .xs-body") or page.locator("#xs-overlay .xs-diff").count() == 0, "after the send and a new reading: nothing left to do on the Pipe")
        # a colleague writes a comment in two lines
        idx = {r[19]: i for i, r in enumerate(rows)}
        call("POST", "/mock/edit/pipe", {"op": "set", "row": idx["Toit 1"] + 1, "col": 36, "value": "Vu par Paul"})
        call("POST", "/mock/edit/pipe", {"op": "set", "row": idx["Toit 2"] + 1, "col": 36, "value": "Rappeler en mars"})
        page.click("#xs-overlay .xs-read"); page.wait_for_selector("#xs-overlay .xs-diff:has-text('Vu par Paul')", timeout=20000)
        # Toit 1: the app has no comment → « reprendre … dans l'appli » (never an empty value written over the colleague's)
        d1 = "#xs-overlay tr:has-text('Toit 1') .xs-diff"
        check("L’appli n’a rien ici" in page.inner_text(d1) and page.locator(d1 + " .xs-choice:has-text('l’appli «')").count() == 0, "the app has nothing: no « keep the app (empty) » choice")
        page.click(d1 + " .xs-choice:has-text('reprendre')"); page.wait_for_timeout(500)
        e1 = next(o for o in json.loads(page.evaluate("window.storage.peek('todo-widget-opportunities')")) if o["id"] == "e1")
        check(e1.get("commentaires") == "Vu par Paul", f"« reprendre … dans l'appli »: the app takes the colleague's comment ({e1.get('commentaires')!r})")
        # Toit 2: the app wrote « Note appli », a colleague replaced it → « Garder l'appli » writes it back (the value seen is still there)
        d2 = "#xs-overlay tr:has-text('Toit 2') .xs-diff"
        page.click(d2 + " .xs-choice:has-text('l’appli «')"); page.wait_for_timeout(3000)
        t2 = next(r for r in dump("pipe") if r[19] == "Toit 2")
        check(t2[35] == "Note appli", f"« Garder l'appli »: the app's value is back in the Excel ({t2[35]!r})")
        # the Suivi: from the pricing on; read back on its real key columns
        page.click("#xs-overlay .xs-send[data-k=bdd]"); page.wait_for_timeout(3000)
        brows = dump("bdd")
        check(len(brows) == 3 and all(r[31] == "SCEA Essai" for r in brows) and sorted(r[33] for r in brows) == ["Toit 0", "Toit 1", "Toit 2"], f"Suivi: the 3 lines at the pricing step, keys in AF / AH ({[(r[31], r[33]) for r in brows]})")
        page.click("#xs-overlay .xs-read"); page.wait_for_timeout(2000)
        body = page.inner_text("#xs-overlay .xs-body") if page.locator("#xs-overlay .xs-body table").count() else ""
        check("Absent du fichier" not in body, "Suivi read back on its key columns: no line wrongly « absent »")
        check(not errors, f"no page errors ({errors})")
        b.close()
finally:
    proc.terminate()
    try: proc.wait(timeout=10)
    except Exception: proc.kill()
print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
