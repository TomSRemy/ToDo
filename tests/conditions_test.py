"""The Suivi's own lines for an offer in a sheet (exact names, the Cst lists), the pricing request counting everything but
the pricing's answer, and a « Caractéristiques Centrales » file dropped on a sheet filling it after a look.
    python tests/conditions_test.py
"""
import json, pathlib, sys, tempfile
import openpyxl
from playwright.sync_api import sync_playwright
failures = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: failures.append(m)
URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
o1 = {"id": "o1", "kind": "installation", "company": "VENTUS", "producteur": "VENTUS", "centrale": "Parc des Crêtes", "kwc": "1200", "mwh": "1280", "dept": "08 - Ardennes",
      "stage": "pricing_indicatif", "createdAt": 1, "updatedAt": 1, "deleted": False}
# the producer's « Caractéristiques Centrales » file : the lines down column A, the plant in column B
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Données"
for r in [["", "Centrale 1"], ["Nom Installation", "Parc des Crêtes"], ["SIRET SPV", "912 345 678 00011"], ["Commune", "Rocroi"], ["Puissance installée (kWc)", 1200],
          ["Type d'injection", "Injection totale"], ["P50 annuel (indicatif) (MWh/an)", 1310], ["GRD", "Enedis"], ["Pas de temps", "Quart-horaire"]]:
    ws.append(r)
xl = pathlib.Path(tempfile.mkdtemp()) / "251112_Caractéristiques_Centrales_VENTUS.xlsx"; wb.save(xl)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1300, "height": 900}, bypass_csp=True); err = []
    pg.on("pageerror", lambda e: err.append(str(e)))
    pg.route("**/fonts.g*/**", lambda r: r.abort()); pg.route("https://tomsremy.github.io/PowerKlock/**", lambda r: r.abort())
    pg.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-opportunities', %s); localStorage.setItem('req-compare-open', '1'); sessionStorage.setItem('s','1'); } }catch(e){}" % json.dumps(json.dumps([o1])))
    pg.goto(URL); pg.wait_for_timeout(1200)
    pg.evaluate("location.hash='fiche/o1'"); pg.wait_for_timeout(800)
    table = pg.text_content("#opp-detail-body .req-table")
    check(all(x in table for x in ["Demande de pricing · contrat", "Arrêt Prix Négatifs (PN)", "Durée période d'essai (Mois)", "Inscription_Registre GO", "Demande de pricing · exploitation", "Type_relève", "Retour pricing", "FG_Fixe_P1 € / MWh", "Pu€/MWh (PPA)", "Pu/Go"]),
          "the sheet's table shows the Suivi's own lines, with their exact names, in three parts")
    check("M0 − FG" in table and "GAPD" in table, "under the lines, the Suivi's own words above its headers (Période tarifaire, M0 − FG, GAPD…)")
    opts = pg.eval_on_selector("select[data-c='c_pnArret']", "s=>[...s.options].map(o=>o.textContent)")
    check(opts == ["", "NON", "Enchères", "Prix Fixe"], f"a line with a list in the Suivi offers the Cst values ({opts})")
    miss = pg.inner_text("#opp-detail-body .req-compare-h")
    check("à compléter" in miss, f"the pricing request counts what is missing ({miss!r})")
    back_need = pg.locator("select[data-c='c_pnArret']").evaluate("s=>s.closest('td').className")
    fg_cls = pg.locator("input[data-c='c_fgP1']").evaluate("i=>i.closest('tr').className")
    check("empty" in back_need and "opt" in fg_cls, f"needed for the request : marked to fill ; a pricing answer (FG) is never asked ({back_need!r}, {fg_cls!r})")
    pg.select_option("select[data-c='c_pnArret']", "Enchères"); pg.wait_for_timeout(400)
    opp = lambda: json.loads(pg.evaluate("window.storage.peek('todo-widget-opportunities')"))[0]
    check(opp().get("c_pnArret") == "Enchères", "a value chosen in the table is kept on the sheet")
    # a file dropped (here chosen) : the look first, nothing changed before « Remplir »
    pg.set_input_files("#opp-detail-body .fill-drop input[type=file]", str(xl)); pg.wait_for_selector("#fill-overlay", timeout=10000)
    look = pg.inner_text("#fill-overlay")
    check("SIRET SPV" in look and "912 345 678 00011" in look and "Surplus / Totalité" in look and "Totalité" in look and "GRD" in look and "Enedis" in look, f"the look : what the file brings, beside what the sheet has ({look[:300]!r})")
    conf = pg.locator("#fill-overlay tr.conf", has_text="P50").locator("input").is_checked()
    check(not conf and opp().get("mwh") == "1280", "a value already there and different starts unticked ; nothing changed yet")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(800)
    o = opp()
    check(o.get("siret") == "912 345 678 00011" and o.get("c_grd") == "Enedis" and o.get("c_surplus") == "Totalité" and o.get("c_pnPas") == "Quart-horaire" and o.get("commune") == "Rocroi",
          f"« Remplir » : the sheet takes the ticked values, the Suivi's lines included ({ {k: o.get(k) for k in ['siret', 'c_grd', 'c_surplus', 'c_pnPas', 'commune']} })")
    check(o.get("mwh") == "1280", "the unticked one stays as it was")
    cells = pg.evaluate("window.TodoConditions.bddCells({ c_pnArret:'Enchères', c_peDuree:'6', c_fgP1:'3,5', c_finP1:'31/12/2028' }, { numCell:v=>Number(String(v).replace(',', '.')), looseDateCell:v=>({ d:v }) })")
    check(cells.get("69") == "Enchères" and cells.get("64") == 6 and cells.get("77") == 3.5 and cells.get("78") == {"d": "31/12/2028"}, f"sent to the Suivi in its own columns (BR, BM, BZ, CA) ({cells})")
    # the pricing's answer by mail : a table « Nom du marché » (the business code) + columns in €/MWh, one cell per line
    pg.evaluate("""(()=>{ const all=JSON.parse(window.storage.peek('todo-widget-opportunities'));
      all.push({ id:'o2', kind:'installation', company:'SOLEO', producteur:'SOLEO', centrale:'TOIT A', kwc:'250', debut:'01/07/2027', fin:'31/12/2029', stage:'pricing_indicatif', createdAt:1, updatedAt:1, deleted:false });
      all.push({ id:'o3', kind:'installation', company:'SOLEO', producteur:'SOLEO', centrale:'HANGAR B', kwc:'180', debut:'01/07/2027', fin:'31/12/2029', stage:'pricing_indicatif', createdAt:1, updatedAt:1, deleted:false });
      window.storage.set('todo-widget-opportunities', JSON.stringify(all)); })()""")
    pg.reload(); pg.wait_for_timeout(1200)
    body = "\n".join(["Oui c'est ça !", "", "De : Tom", "On est à 0.4 €/MWh pour le pilotage c'est bien ça ?", "", "Bonjour Tom,", "", "Voici les frais d'agrégation pour les centrales de SOLEO.", "", "Nom du marché", "", "Frais de gestion (€/MWh)", "", "Frais fixe (€/MWh)", "", "Marge (€/MWh)", "",
                      "Frais d'agrégation (€/MWh)", "", "27(07)29 – SOLEO_TOIT A – A", "", "2.10", "", "1.70", "", "0.5", "", "4.30", "", "27(07)29 – SOLEO_HANGAR B – A", "", "2.20", "", "1.90", "", "0.5", "", "4.60", "", "Bon dépôt,"])
    eml = pathlib.Path(tempfile.mkdtemp()) / "RE Pricing Agrégation.eml"
    eml.write_text("From: pricing@exemple.fr\r\nSubject: Pricing Agregation\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n" + body.replace("\n", "\r\n"), encoding="utf-8")
    pg.evaluate("location.hash='fiche/o2'"); pg.wait_for_timeout(800)
    pg.set_input_files("#opp-detail-body .fill-drop input[type=file]", str(eml)); pg.wait_for_selector("#fill-overlay", timeout=10000)
    look = pg.inner_text("#fill-overlay")
    check("FG_Fixe_P1 € / MWh" in look and "4,30" in look and "Frais de gestion (€/MWh)" in look and "2,10" in look and "4,60" not in look, f"the pricing's mail : this plant's line (found by its business code) read into the Retour pricing lines ({look[:260]!r})")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(800)
    o2 = next(x for x in json.loads(pg.evaluate("window.storage.peek('todo-widget-opportunities')")) if x["id"] == "o2")
    check(o2.get("c_fgP1") == "4,30" and o2.get("c_fgGestion") == "2,10" and o2.get("c_fgFixe") == "1,70" and o2.get("c_fgMarge") == "0,5" and o2.get("c_pilotage") == "0,4",
          f"filled : the total in FG_Fixe_P1, the detail beside, the steering said in the thread noted apart ({ {k: o2.get(k) for k in ['c_fgP1', 'c_fgGestion', 'c_fgFixe', 'c_fgMarge', 'c_pilotage']} })")
    # the same mail's text pasted, on the other plant
    pg.evaluate("location.hash='fiche/o3'"); pg.wait_for_timeout(800)
    pg.click("#opp-detail-body .fill-paste"); pg.fill("#paste-overlay textarea", body.replace("\n\n", "\n")); pg.click("#paste-overlay .paste-go"); pg.wait_for_selector("#fill-overlay", timeout=5000)
    check("4,60" in pg.inner_text("#fill-overlay") and "4,30" not in pg.inner_text("#fill-overlay"), "the mail's text pasted : the other plant's line only")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(600)
    check(not err, f"no page errors ({err})")
    b.close()
print(f"\n{len(failures)} failure(s)"); sys.exit(1 if failures else 0)
