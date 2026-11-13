"""Pipe Excel → the app (team mode « Excel ») : the bridge is stubbed. A line typed in the Pipe by a colleague becomes a
sheet (the list asked the first time), its step from the Stade (or the Suivi's Statut once transferred) ; a cell a
colleague changed is taken when the sheet hadn't changed it ; changed on both sides, the sheet keeps its value.
    python tests/pipe_import_test.py
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
failures = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: failures.append(m)
URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
HP = ["Année", "New", "Chargé d'affaires", "Date entrée pipe", "Origine du lead", "Crédit Agricole", "Nom Producteur", "Région", "Département", "Type de marché", "Nom contact", "Prénom contact", "Qualité", "Tel", "Mail",
      "RDV 1", "CR", "RDV 2", "CR2", "Nom Centrale", "Type installation", "Type contrat", "Puissance (kWc)", "P50 (MWh/an)", "MES prévisionnelle", "MES effective", "Date début", "Date fin", "Durée (année)", "Particularités",
      "Stade", "Date remise 1ère offre", "Nature offre", "Type d'action à réaliser", "Date relance", "Commentaires", "Qualification"]
def line(**kw):
    r = [None] * 37
    for k, v in kw.items(): r[{"charge": 2, "prod": 6, "dept": 8, "plant": 19, "kwc": 22, "stade": 30, "comment": 35}[k]] = v
    return r
pipe = {"rows": []}
bdd_rows = [[None] * 91]
def bridge(route):
    req = route.request; path = req.url.split("8765", 1)[1]
    h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    if req.method == "OPTIONS": return route.fulfill(status=204, headers={**h, "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Token"})
    if path == "/status": out = {"ok": True, "version": "1.35", "authorized": True, "who": "Tom", "pipe": {"name": "Pipe.xlsx", "found": True}, "bdd": {"name": "Suivi.xlsx", "found": True}, "contacts": {"name": "", "found": False}}
    elif path == "/pipe/read": out = {"ok": True, "sheets": {"Pipe agrégation": [HP] + pipe["rows"]}, "allNames": ["Pipe agrégation"]}
    elif path == "/bdd/read":
        hb = [None] * 91; hb[31] = "Nom_prod"; hb[33] = "Nom_Installation_prod"; hb[24] = "Statut"
        out = {"ok": True, "sheets": {"BDD Agrégation": [hb] + bdd_rows}, "allNames": ["BDD Agrégation"]}
    elif path == "/backup/write": out = {"ok": True, "dir": "C:\\x", "file": {"name": "t.json", "size": 1}}
    elif path == "/inbox/list": out = {"ok": True, "tasks": [], "contacts": []}
    else: out = {"ok": True}
    route.fulfill(status=200, headers=h, body=json.dumps(out))

o2 = {"id": "o2", "kind": "installation", "company": "SCEA Les Prés", "producteur": "SCEA Les Prés", "centrale": "Hangar Nord", "kwc": "300", "dept": "51 - Marne", "stage": "collecte", "createdAt": 1, "updatedAt": 1, "deleted": False}
o3 = {"id": "o3", "kind": "installation", "company": "Solaire Durand SARL", "producteur": "Solaire Durand SARL", "centrale": "Toit atelier", "kwc": "99", "dept": "35 - Ille-et-Vilaine", "stage": "prise_contact", "createdAt": 1, "updatedAt": 1, "deleted": False}
o4 = {"id": "o4", "kind": "installation", "company": "ANCIEN", "producteur": "ANCIEN", "centrale": "Toit vieux", "stage": "a_qualifier", "createdAt": 1, "updatedAt": 1, "deleted": True}
o1 = {"id": "o1", "kind": "installation", "company": "SOLARIS", "producteur": "SOLARIS", "centrale": "Toit", "kwc": "250", "commentaires": "Vu au salon", "stage": "a_qualifier", "createdAt": 1, "updatedAt": 1, "deleted": False}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1300, "height": 850}, bypass_csp=True); err = []
    pg.on("pageerror", lambda e: err.append(str(e)))
    pg.route("**/fonts.g*/**", lambda r: r.abort()); pg.route("https://tomsremy.github.io/PowerKlock/**", lambda r: r.abort())
    pg.route("http://127.0.0.1:8765/**", bridge)
    pg.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-opportunities', %s); localStorage.setItem('todo_bridge-config', JSON.stringify({ port:8765, token:'k' })); localStorage.setItem('local-backup-at', String(Date.now())); sessionStorage.setItem('s','1'); } }catch(e){}"
                       % json.dumps(json.dumps([o1, o2, o3, o4])))
    pg.goto(URL); pg.wait_for_timeout(1500)
    # o1 was sent to the Pipe before : what the app wrote is what the Pipe holds
    sent = pg.evaluate("(()=>{ const all=JSON.parse(window.storage.peek('todo-widget-opportunities')); const o=all.find(x=>x.id==='o1'); const v=window.TodoExcelSync.xsAppValues('pipe', o); o.excelPrev={ pipe:v }; window.storage.set('todo-widget-opportunities', JSON.stringify(all)); return v; })()")
    pipe["rows"] = [sent, line(charge="Paul", prod="VENTUS", plant="Parc des Crêtes", kwc=1200, stade="Qualification en cours"),
                    line(charge="Marie", prod="HÉLIO", plant="Hangar", stade="Transféré BDD"),
                    line(charge="Paul", prod="LES PRES", plant="Hangar Nord - extension", kwc=300, stade="Collecte d'informations"),
                    line(charge="Paul", prod="SOLAIRE DURAND", plant="Atelier toiture", kwc=99, dept="35 - Ille-et-Vilaine", stade="Prise en contact"),
                    line(charge="Marie", prod="AGRI SOL", plant="Grange", stade="No Go"),
                    line(charge="Paul", prod="ANCIEN", plant="Toit vieux", stade="A qualifier")]
    hel = [None] * 91; hel[31] = "HÉLIO"; hel[33] = "Hangar"; hel[24] = "En attente"; bdd_rows.append(hel)
    def bline(prod, plant, statut, **kw):
        r = [None] * 91; r[6] = prod; r[31] = prod; r[33] = plant; r[24] = statut
        for i, v in kw.items(): r[int(i[1:])] = v
        bdd_rows.append(r)
    bline("BIOGAZ NORD", "Méthaniseur", "En attente", c2="Marie", c38=500)   # a deal past the Go with no Pipe line
    bline("VIEUX PARC", "Toit A", "Gagné")                                     # signed : stays in Portefeuille
    bline("OLD", "Hangar B", "Perdu")                                          # closed
    pg.reload(); pg.wait_for_timeout(4000)
    opps = lambda: [o for o in json.loads(pg.evaluate("window.storage.peek('todo-widget-opportunities')")) if not o.get("deleted")]
    check(len(opps()) == 3, f"the very first import is never done unasked ({len(opps())})")
    o3now = next(o for o in opps() if o["id"] == "o3")
    check(o3now.get("producteur") == "SOLAIRE DURAND" and o3now.get("centrale") == "Atelier toiture", f"renamed in the Pipe, same producer + power + department : linked by itself, no double ({o3now.get('producteur')}, {o3now.get('centrale')})")
    pg.click('[data-tab="excel"]'); pg.wait_for_timeout(600); pg.click("#tab-excel .xs-read"); pg.wait_for_timeout(1500)
    same = pg.inner_text("#choice-overlay") if pg.is_visible("#choice-overlay") else ""
    check("Même installation ?" in same and "Hangar Nord - extension" in same and "SCEA Les Prés · Hangar Nord" in same and "même producteur" in same and "même puissance" in same,
          f"likely the same (same producer, close plant name, same power) : asked ({same!r})")
    pg.click("#choice-btns button:has-text('Oui, les relier')"); pg.wait_for_timeout(600)
    ask = pg.inner_text("#choice-overlay") if pg.is_visible("#choice-overlay") else ""
    check("5 lignes du Pipe et du Suivi" in ask and "3 ouvertes, 2 fermées" in ask and "BIOGAZ NORD · Méthaniseur — Suivi : En attente (Marie)" in ask and "Le contrat signé (Gagné) du Suivi reste dans le Portefeuille" in ask and "VENTUS · Parc des Crêtes — Qualification en cours (Paul)" in ask and "SOLARIS" not in ask and "Toit vieux" not in ask,
          f"« Relire » : the Pipe's unknown lines are listed first, open and closed counted, a sheet in the bin not offered ({ask!r})")
    pg.click("#choice-btns button:has-text('Seulement les ouvertes (3)')"); pg.wait_for_timeout(1200)
    allc = lambda: [o.get("centrale") for o in json.loads(pg.evaluate("window.storage.peek('todo-widget-opportunities')"))]
    check("Grange" not in allc() and "Hangar B" not in allc() and "Toit A" not in allc() and allc().count("Toit vieux") == 1, "« Seulement les ouvertes » : closed lines (Pipe and Suivi) stay out, signed ones too ; the binned sheet doesn't come back")
    by = {o["centrale"]: o for o in opps()}
    check(set(by) == {"Toit", "Parc des Crêtes", "Hangar", "Hangar Nord - extension", "Atelier toiture", "Méthaniseur"} and len(opps()) == 6, f"two sheets created, the known and the linked ones not doubled ({sorted(by)})")
    check(by["Hangar Nord - extension"]["id"] == "o2", "« Oui, les relier » : the sheet takes the Pipe's names")
    check(by["Parc des Crêtes"]["stage"] == "qualif_en_cours" and by["Parc des Crêtes"].get("charge") == "Paul" and by["Parc des Crêtes"].get("kwc") == "1200", f"its step from the Stade, its cells from the line ({by['Parc des Crêtes']})")
    check(by["Hangar"]["stage"] == "offre_attente", f"transferred to the Suivi : the step from its Statut ({by['Hangar']['stage']})")
    m = by["Méthaniseur"]
    check(m["stage"] == "offre_attente" and m.get("charge") == "Marie" and m.get("kwc") == "500" and m.get("bddOnly"), f"a Suivi line with no Pipe line : a sheet at its Statut's step, its cells from the Suivi ({m})")
    pg.click('[data-tab="excel"]'); pg.wait_for_timeout(600)
    todo = pg.inner_text("#tab-excel .xs-body")
    check("Méthaniseur" not in todo, f"a sheet from the Suivi alone is never offered for sending to the Pipe ({todo[:120]!r})")
    # a colleague changes o1's comment in the Pipe (the sheet unchanged since) ; then both change the power
    pipe["rows"][0] = list(pipe["rows"][0]); pipe["rows"][0][35] = "Rappeler en janvier (Marie)"
    pg.evaluate("location.hash='excel'"); pg.click("#tab-excel .xs-read"); pg.wait_for_timeout(1500)
    check(next(o for o in opps() if o["id"] == "o1").get("commentaires") == "Rappeler en janvier (Marie)", "a colleague's change in the Pipe comes into the sheet")
    pg.evaluate("(()=>{ const all=JSON.parse(window.storage.peek('todo-widget-opportunities')); all.find(o=>o.id==='o1').kwc='300'; window.storage.set('todo-widget-opportunities', JSON.stringify(all)); })()")
    pipe["rows"][0][22] = 280
    pg.reload(); pg.wait_for_timeout(4000); pg.click('[data-tab="excel"]'); pg.wait_for_timeout(500); pg.click("#tab-excel .xs-read"); pg.wait_for_timeout(1500)
    check(next(o for o in opps() if o["id"] == "o1").get("kwc") == "300", "changed on both sides : the sheet keeps its value (Synchro Excel asks)")
    # a new line later : arrives by itself
    pipe["rows"].append(line(charge="Paul", prod="SCEA ESSAI", plant="Toit 2", stade="A qualifier"))
    pg.click('[data-tab="pipeline"]'); pg.wait_for_timeout(1500)
    check(any(o["centrale"] == "Toit 2" for o in opps()) and "Grange" not in allc(), "after the first time, a new Pipe line arrives by itself ; the closed one left out stays out")
    board = pg.inner_text("#tab-pipeline")
    check(all(n in board for n in ["Parc des Crêtes", "Hangar", "Toit 2"]), "the imported sheets show on the Pipeline board")
    new = next(o for o in opps() if o["centrale"] == "Toit 2")
    pg.evaluate(f"location.hash='fiche/{new['id']}'"); pg.wait_for_timeout(800)
    check("Arrivée du Pipe Excel" in pg.inner_text("#opp-detail-body") and "Paul" in pg.inner_text("#opp-detail-body"), "the sheet says it came from the Pipe, and whose it is")
    check(not err, f"no page errors ({err})")
    b.close()
print(f"\n{len(failures)} failure(s)"); sys.exit(1 if failures else 0)
