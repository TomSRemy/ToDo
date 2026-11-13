"""« Pricing » : the installations waiting for their prices, grouped by request, edited like Excel (Enter moves down, a
range pasted from Excel fills the cells), the pricing's mail dropped filling every installation it names by business code.
    python tests/pricing_test.py
"""
import json, pathlib, sys, tempfile
from playwright.sync_api import sync_playwright
failures = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: failures.append(m)
URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
def inst(i, plant, **kw):
    base = {"id": i, "kind": "installation", "company": "IEL", "producteur": "IEL", "centrale": plant, "debut": "01/07/2027", "fin": "31/12/2029", "stage": "pricing_indicatif",
            "requestId": "r1", "createdAt": 1, "updatedAt": 1, "deleted": False, "stageLog": [{"stage": "pricing_indicatif", "at": 1}]}
    base.update(kw); return base
opps = [{"id": "r1", "kind": "request", "company": "IEL", "label": "IEL — demande de pricing", "stage": "pricing_indicatif", "createdAt": 1, "updatedAt": 1, "deleted": False},
        inst("a", "MOUTONNERIE", kwc="9000"), inst("b", "PLOUISY", kwc="2200"),
        inst("c", "TOIT", company="VENTUS", producteur="VENTUS", requestId=None, stage="offre_remise", c_fgP1="4,80"),
        inst("d", "GRANGE", company="AGRI", producteur="AGRI", requestId=None, stage="collecte"),
        {"id": "r2", "kind": "request", "company": "SOLEO", "label": "SOLEO — toitures", "stage": "pricing_indicatif", "createdAt": 1, "updatedAt": 1, "deleted": False},
        inst("e", "TOIT 1", company="SOLEO", producteur="SOLEO", requestId="r2", lot="Lot 1 toitures"), inst("f", "TOIT 2", company="SOLEO", producteur="SOLEO", requestId="r2", lot="Lot 1 toitures")]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 900}, bypass_csp=True); err = []
    pg.on("pageerror", lambda e: err.append(str(e)))
    pg.route("**/fonts.g*/**", lambda r: r.abort()); pg.route("https://tomsremy.github.io/PowerKlock/**", lambda r: r.abort())
    pg.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-opportunities', %s); sessionStorage.setItem('s','1'); } }catch(e){}" % json.dumps(json.dumps(opps)))
    pg.goto(URL); pg.wait_for_timeout(1200)
    check(pg.inner_text("#pricing-badge") == "4", f"the menu says how many installations wait for their prices ({pg.inner_text('#pricing-badge')!r})")
    pg.click('[data-tab="pricing"]'); pg.wait_for_timeout(400)
    page = pg.inner_text("#pricing-root")
    check("IEL — demande de pricing" in page and "MOUTONNERIE" in page and "PLOUISY" in page and "VENTUS" not in page and "GRANGE" not in page,
          "« En attente de prix » : the request's installations, grouped ; neither the priced one nor one before the pricing")
    check(all(x in page for x in ["FG_Fixe_P1 € / MWh", "Pu€/MWh (PPA)", "Pilotage (€/MWh)", "FG_%M0_P1"]) and "FG_ACC / An" not in page, "« Essentiel » : the main columns (€/MWh and % M0 side by side, a mixed fee), with the Suivi's names")
    # type, Enter : saved, the cell below
    a1 = "#pricing-root .pr-in[data-id='a'][data-k='c_fgP1']"
    pg.fill(a1, "5,99"); pg.press(a1, "Enter"); pg.wait_for_timeout(300)
    foc = pg.evaluate("document.activeElement.dataset.id+'/'+document.activeElement.dataset.k")
    by = lambda: {o["id"]: o for o in json.loads(pg.evaluate("window.storage.peek('todo-widget-opportunities')"))}
    check(by()["a"].get("c_fgP1") == "5,99" and foc == "b/c_fgP1", f"Enter saves and goes to the cell below ({foc})")
    # a range copied from Excel : two lines, two columns
    pg.evaluate("""(()=>{ const inp=document.querySelector("#pricing-root .pr-in[data-id='a'][data-k='c_fgP1']"); const dt=new DataTransfer(); dt.setData('text/plain', '6,10\\t4,80\\t31/12/2029\\n5,21\\t4,60\\t31/12/2029\\n');
      inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData:dt, bubbles:true, cancelable:true })); })()""")
    pg.wait_for_timeout(400)
    o = by()
    check(o["a"].get("c_fgP1") == "6,10" and o["a"].get("c_finP1") == "31/12/2029" and o["b"].get("c_fgP1") == "5,21" and o["b"].get("c_finP1") == "31/12/2029",
          f"a range pasted from Excel fills the cells from there, down and right ({ {k: (o[k].get('c_fgP1'), o[k].get('c_finP1')) for k in 'ab'} })")
    # a lot priced once : its line fills every plant of the lot
    check("Lot 1 toitures" in pg.inner_text("#pricing-root"), "a lot has its own line in its request")
    lot = "#pricing-root .pr-lot-in[data-k='c_fgP1']"
    pg.fill(lot, "4,40"); pg.press(lot, "Enter"); pg.wait_for_timeout(300)
    o = by()
    check(o["e"].get("c_fgP1") == "4,40" and o["f"].get("c_fgP1") == "4,40" and pg.input_value("#pricing-root .pr-in[data-id='f'][data-k='c_fgP1']") == "4,40", "a price typed on the lot's line goes to every plant of the lot")
    # the pricing's mail dropped on the page : each line found by its business code, whatever the sheet
    body = "\r\n".join(["Nom du marché", "Frais de gestion (€/MWh)", "Frais fixe (€/MWh)", "Marge (€/MWh)", "Frais d'agrégation (€/MWh)",
                        "27(07)29 – IEL_MOUTONNERIE – A", "2.93", "2.56", "0.5", "5.99", "27(07)29 – IEL_PLOUISY – A", "2.91", "1.80", "0.5", "5.21", "Lot 1 toitures – SOLEO", "2.10", "1.70", "0.5", "4.30", "", "On est à 0.4 €/MWh pour le pilotage"])
    eml = pathlib.Path(tempfile.mkdtemp()) / "Pricing.eml"
    eml.write_text("From: pricing@exemple.fr\r\nSubject: Pricing\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n" + body, encoding="utf-8")
    pg.set_input_files("#pricing-root .fill-drop input[type=file]", str(eml)); pg.wait_for_selector("#fill-overlay", timeout=8000)
    look = pg.inner_text("#fill-overlay")
    check("MOUTONNERIE" in look and "PLOUISY" in look and "5,99" in look and "0,4" in look, f"the mail : both plants found by their business code, shown before filling ({look[:200]!r})")
    check(not pg.locator("#fill-overlay tr.conf input").first.is_checked(), "a price already typed and different starts unticked")
    pg.locator("#fill-overlay tr.conf input").evaluate_all("l=>l.forEach(x=>{ x.checked=true; x.dispatchEvent(new Event('change', { bubbles:true })); })")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(700)
    o = by()
    check(o["a"].get("c_fgP1") == "5,99" and o["b"].get("c_fgP1") == "5,21" and o["a"].get("c_pilotage") == "0,4" and o["b"].get("c_fgGestion") == "2,91", "« Remplir » : every installation named in the mail gets its prices")
    check(o["e"].get("c_fgP1") == "4,30" and o["f"].get("c_fgP1") == "4,30" and o["f"].get("c_fgGestion") == "2,10", "a line of the mail priced for a lot : every plant of the lot gets it")
    check(pg.inner_text("#pricing-badge") == "" and "Aucune installation en attente de prix" in pg.inner_text("#pricing-root"), "no more waiting : the menu's count and the page say so")
    # a baseload offer indexed on the CAL, pasted as copied (tabs, a header over several lines), with a line for both plants together
    bl = "Nom du marché\tPuissance BL (MW)\nsur la base du P50\tFormule\tPlancher (€/MWh)\n\tExemple \nCAL = 60 €/MWh\nMoutonnerie - Baseload\t1.25\t38.5% x CAL - 1.7\t15\t21.40\nPlouisy - Baseload\t0.32\t77.5% x CAL - 1.8\t15\t44.70\nPlouisy + Moutonnerie - Baseload\t1.60\t48.9% x CAL - 1.6\t15\t27.74"
    pg.click("#pricing-root .fill-paste"); pg.fill("#paste-overlay textarea", bl); pg.click("#paste-overlay .paste-go"); pg.wait_for_selector("#fill-overlay", timeout=5000)
    look = pg.inner_text("#fill-overlay")
    check("38.5% x CAL - 1.7" in look and "77.5% x CAL - 1.8" in look and "Offre groupée" in look and "Plouisy + Moutonnerie" in look, f"a CAL-indexed baseload table : formulas, power, example, and the offer for both plants ({look[:220]!r})")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(600)
    o = by()
    check(o["a"].get("c_formule") == "38.5% x CAL - 1.7" and o["a"].get("c_blMW") == "1,25" and o["a"].get("c_exemple") == "21,40" and o["a"].get("c_exempleRef") == "CAL = 60 €/MWh"
          and o["b"].get("c_formule") == "77.5% x CAL - 1.8" and o["a"].get("c_grpNom") == "Plouisy + Moutonnerie" and o["b"].get("c_grpFormule") == "48.9% x CAL - 1.6",
          f"each plant gets its formula, both keep the group's offer ({ {k: o['a'].get(k) for k in ['c_formule', 'c_blMW', 'c_exemple', 'c_grpNom', 'c_grpFormule']} })")
    check((o["a"].get("pricingExtra") or {}).get("Plancher (€/MWh)") == "15", f"a column the app doesn't know is kept under its own header ({o['a'].get('pricingExtra')})")
    check(len(o["a"].get("pricingMails") or []) >= 1 and "38.5% x CAL" in o["a"]["pricingMails"][-1]["text"], "the pricing's mail (here pasted) is kept on the sheets it filled")
    # the pricing's table by lot, with €/MWh and %m0 columns and a variant line ; a lot nobody knows : chosen by hand
    pg.evaluate("""(()=>{ const all=JSON.parse(window.storage.peek('todo-widget-opportunities')); const add=(id, plant, lot)=>all.push({ id, kind:'installation', company:'SOLVEO', producteur:'SOLVEO', centrale:plant, lot, requestId:'r3', stage:'pricing_indicatif', createdAt:1, updatedAt:1, deleted:false });
      add('g', 'SITE A', 'Lot 1 – Brownfield'); add('h', 'SITE B', 'Lot 1 – Brownfield'); add('i', 'DECIZE TOIT', 'Decize'); add('j', 'SITE GREEN', 'Neuf');
      window.storage.set('todo-widget-opportunities', JSON.stringify(all)); })()""")
    pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-tab="pricing"]'); pg.wait_for_timeout(400)
    lots = "Nom du marché\tFrais de gestion (€/MWh)\tFrais fixe (€/MWh)\tMarge (€/MWh)\tFrais d'agrégation (€/MWh)\tFrais de gestion (%m0)\tFrais fixe (%m0)\tMarge (%m0)\tFrais d'agrégation (%m0)\nLot Brownfield\t2.68\t0.09\t0.5\t3.27\t3.9\t0.15\t0.73\t4.78\nLot Brownfield - 2028\t1.78\t0.06\t0.5\t2.34\t5.31\t0.11\t0.91\t6.33\nLot Decize\t2.92\t0.06\t0.5\t3.47\t4.23\t0.09\t0.72\t5.04\nLot Greenfield\t2.7\t0.19\t0.5\t3.29\t4.14\t0.15\t0.77\t5.06"
    pg.click("#pricing-root .fill-paste"); pg.fill("#paste-overlay textarea", lots); pg.click("#paste-overlay .paste-go"); pg.wait_for_selector("#assign-overlay", timeout=5000)
    check("Lot Greenfield" in pg.inner_text("#assign-overlay") and "Lot Brownfield" not in pg.inner_text("#assign-overlay"), "a line whose lot isn't found : asked what it is (the others found by their lot's words)")
    pg.select_option("#assign-overlay select", "lot:Neuf"); pg.click("#assign-overlay .as-go"); pg.wait_for_selector("#fill-overlay", timeout=5000)
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(600)
    o = by()
    check(o["g"].get("c_fgP1") == "3,27" and o["h"].get("c_m0P1") == "4,78" and o["g"].get("c_fgGestionPct") == "3,9" and o["i"].get("c_fgP1") == "3,47" and o["j"].get("c_fgP1") == "3,29",
          f"€/MWh and %m0 apart (the %m0 total in FG_%M0_P1), every plant of each lot, the one chosen by hand too ({ {k: (o[k].get('c_fgP1'), o[k].get('c_m0P1')) for k in 'ghij'} })")
    check((o["g"].get("pricingExtra") or {}).get("2028 · FG_Fixe_P1 € / MWh") == "2,34", f"the variant « Lot Brownfield - 2028 » kept apart under its name ({o['g'].get('pricingExtra')})")
    # a lot unknown to the app : its installations picked by hand, then kept as a lot (found on its own next time)
    pick = "Nom du marché\tFrais d'agrégation (€/MWh)\nLot Pommiers\t4,44"
    pg.click("#pricing-root .fill-paste"); pg.fill("#paste-overlay textarea", pick); pg.click("#paste-overlay .paste-go"); pg.wait_for_selector("#assign-overlay", timeout=5000)
    pg.select_option("#assign-overlay select", "pick"); pg.check("#assign-overlay .as-list input[value='b']"); pg.click("#assign-overlay .as-go"); pg.wait_for_selector("#fill-overlay", timeout=5000)
    pg.locator("#fill-overlay tbody input").evaluate_all("l=>l.forEach(x=>{ x.checked=true; x.dispatchEvent(new Event('change', { bubbles:true })); })")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(600)
    o = by()
    check(o["b"].get("lot") == "Pommiers" and o["b"].get("c_fgP1") == "4,44", f"lot picked by hand : filled and remembered ({o['b'].get('lot')}, {o['b'].get('c_fgP1')})")
    pg.click("#pricing-root .fill-paste"); pg.fill("#paste-overlay textarea", pick.replace("4,44", "4,55")); pg.click("#paste-overlay .paste-go"); pg.wait_for_selector("#fill-overlay", timeout=5000)
    check(pg.locator("#assign-overlay").count() == 0, "the next time, the lot is found on its own")
    pg.locator("#fill-overlay tbody input").evaluate_all("l=>l.forEach(x=>{ x.checked=true; x.dispatchEvent(new Event('change', { bubbles:true })); })")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(600)
    # the table for the pricing, plain words and only the columns needed, filled in and pasted back : each in its line of the Suivi
    cols = pg.evaluate("window.TodoConditions.templateCols(JSON.parse(window.storage.peek('todo-widget-opportunities')).filter(o=>o.requestId==='r1'))")
    check(len(cols) == 20 and cols[0] == "Nom du marché" and cols[-1] == "Commentaire", f"the full table, plain words ({cols})")
    vals = ["27(07)29 – IEL_MOUTONNERIE – A", "", "", "6,05", "4,80", "31/12/2029", "5,10", "4,20", "31/12/2032", "", "", "0,25", "0,4", "2,93", "1,10", "2,56", "0,95", "0,5", "0,20", "valable 1 mois"]
    back = "\t".join(cols) + "\n" + "\t".join(vals)
    pg.click("#pricing-root .fill-paste"); pg.fill("#paste-overlay textarea", back); pg.click("#paste-overlay .paste-go"); pg.wait_for_selector("#fill-overlay", timeout=5000)
    pg.locator("#fill-overlay tbody input").evaluate_all("l=>l.forEach(x=>{ x.checked=true; x.dispatchEvent(new Event('change', { bubbles:true })); })")
    pg.click("#fill-overlay .fill-go"); pg.wait_for_timeout(600)
    o = by()
    want = {"c_fgP1": "6,05", "c_m0P1": "4,80", "c_finP1": "31/12/2029", "c_fgP2": "5,10", "c_m0P2": "4,20", "c_finP2": "31/12/2032", "c_puGo": "0,25", "c_pilotage": "0,4", "c_fgGestion": "2,93", "c_fgFixe": "2,56", "c_fgMarge": "0,5", "c_fgGestionPct": "1,10", "c_fgFixePct": "0,95", "c_fgMargePct": "0,20"}
    got = {k: o["a"].get(k) for k in want}
    check(got == want and (o["a"].get("pricingExtra") or {}).get("Commentaire") == "valable 1 mois", f"filled and pasted back : every column in its line of the Suivi, the comment kept ({got})")
    rows = pg.evaluate("window.TodoPricing.templateRows(JSON.parse(window.storage.peek('todo-widget-opportunities')).filter(o=>o.requestId==='r3'))")
    check(rows == ["Lot 1 – Brownfield", "Lot Decize", "Lot Neuf"], f"the table for the pricing : a line per lot ({rows})")
    pg.click("#pricing-root .pr-seg[data-seg='view'] button[data-v='done']"); pg.wait_for_timeout(300)
    pg.click("#pricing-root .pr-mails-btn[data-id='a']"); pg.wait_for_selector("#pmail-overlay", timeout=3000)
    check("valable 1 mois" in pg.inner_text("#pmail-overlay"), "the ✉ button shows the last kept mail")
    pg.click("#pmail-overlay .pm-close")
    pg.click("#pricing-root .pr-seg[data-seg='view'] button[data-v='done']"); pg.wait_for_timeout(300)
    check(all(x in pg.inner_text("#pricing-root") for x in ["MOUTONNERIE", "PLOUISY", "TOIT"]), "« Prix reçus » : the priced ones, to correct")
    pg.click("#pricing-root .pr-seg[data-seg='cols'] button[data-v='all']"); pg.wait_for_timeout(300)
    check("FG_%M0_P1" in pg.inner_text("#pricing-root") and "Remu_prod" in pg.inner_text("#pricing-root") and "Plancher (€/MWh)" in pg.inner_text("#pricing-root"), "« Toutes les colonnes » : every line of the Retour pricing, and the pricing's own columns")
    pg.click("#pricing-root .pr-open[data-id='c']"); pg.wait_for_timeout(500)
    check(not pg.locator("#opp-detail-overlay").evaluate("e=>e.classList.contains('hidden')") and "TOIT" in pg.inner_text("#opp-detail-title"), "« Fiche » opens the installation's sheet")
    check(not err, f"no page errors ({err})")
    b.close()
print(f"\n{len(failures)} failure(s)"); sys.exit(1 if failures else 0)
