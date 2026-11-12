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
    check(not err, f"no page errors ({err})")
    b.close()
print(f"\n{len(failures)} failure(s)"); sys.exit(1 if failures else 0)
