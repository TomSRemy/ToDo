"""The corrections of the cold audit (2026-10-26), kept from coming back: one check per correction, fictitious data only.

    python tests/audit_test.py
"""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright

URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
DAY = 864e5
failures = []
def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond: failures.append(msg)

def eventually(page, cond, timeout=4000):
    end = time.time() + timeout / 1000
    while time.time() < end:
        try:
            if cond(): return True
        except Exception: pass
        page.wait_for_timeout(60)
    return False

now = int(time.time() * 1000)
def opp(i, company, centrale, stage, **kw):
    o = {"id": i, "kind": "installation", "company": company, "producteur": company, "centrale": centrale, "title": centrale, "kwc": "1200", "mwh": "1400",
         "stage": stage, "dept": "44 - Loire-Atlantique", "createdAt": now - 60 * DAY, "updatedAt": now - 20 * DAY, "deleted": False,
         "stageLog": [{"stage": stage, "at": now - 20 * DAY}]}
    o.update(kw); return o
SEED = {
    "todo-widget-opportunities": [opp("o1", "Solaris Ouest", "Toit Est", "negociation"), opp("o2", "Watt Sud", "Hangar Nord", "offre_remise", dateOffre=""),
                                  opp("o3", "Vent du Nord", "Parc Nord", "kyc", install="Eolien"), opp("o4", "GAEC Test", "Toit Bas", "onboarding", stageLog=[{"stage": "onboarding", "at": now - 30 * DAY}]),
                                  opp("o5", "Hélio Loire", "Ombrière Sud", "pricing_indicatif"),
                                  opp("o6", "Breizh Test", "Toit Neuf", "collecte", stageLog=[{"stage": "a_qualifier", "at": now - 30 * DAY}, {"stage": "collecte", "at": now - 2 * DAY}]),
                                  opp("o7", "Nouvelle SAS", "Toit Frais", "a_qualifier", createdAt=now - DAY),
                                  opp("o8", "Perdue SAS", "Toit Perdu", "perdu", lostAt=now - 3 * DAY, stageBeforeExit="offre_attente")],
    "todo-widget-contacts": [{"id": "p1", "firstName": "Claire", "lastName": "MARTIN", "company": "Solaris Ouest", "email": "claire@exemple.fr", "phone1": "06 12 34 56 00",
                              "role": "Gérante", "createdAt": 1, "updatedAt": 1, "deleted": False}],
    "todo-widget-companies": [{"id": "c1", "name": "Solaris Ouest", "type": "Producteur", "createdAt": 1, "updatedAt": 1, "deleted": False}],
    "parc-data": {"fileName": "Suivi test.xlsx", "importedAt": now, "objectives": {"2026": 10, "2027": 20},
                "items": [{"statut": "Gagné", "inst": "Signé 1", "prod": "Prod A", "dev": "Prod A", "kwc": 1000, "vols": {"2026": 4000, "2027": 5000}, "fin": "2040-01-01", "enr": "PV", "dept": "44"}]},
}
def seed_js(seed):
    return "if(!sessionStorage.getItem('s')){ for (const [k,v] of Object.entries(" + json.dumps({"todo_" + k: json.dumps(v) for k, v in seed.items()}) + ")) localStorage.setItem(k,v); sessionStorage.setItem('s','1'); }"

def new_page(b, seed=None, **ctx):
    c = b.new_context(**ctx); page = c.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/fonts.g*/**", lambda r: r.abort()); page.route("https://tomsremy.github.io/PowerKlock/**", lambda r: r.abort())
    if seed: page.add_init_script(seed_js(seed))
    return page, errors

def confirm(page):   # the app's own confirmation window: first button
    page.wait_for_selector("#choice-overlay:not(.hidden) #choice-btns button"); page.locator("#choice-btns button").first.click()

with sync_playwright() as p:
    b = p.chromium.launch()

    # 1. an empty app says what it is and where to start
    page, errors = new_page(b, viewport={"width": 1400, "height": 900})
    page.goto(URL)
    check(eventually(page, lambda: page.is_visible("#welcome")), "empty app: the welcome block shows")
    txt = page.inner_text("#welcome")
    check("Bienvenue" in txt and "Ajouter ma première tâche" in txt and "autre appareil" in txt, "welcome: what it is, first steps, and where the data of another device is")
    check("ToDo Agrégation" in page.title() and page.evaluate("document.querySelector('meta[name=robots]').content") == "noindex", "page title says the tool; not indexed")
    page.click("#welcome >> text=Ajouter ma première tâche")
    check(eventually(page, lambda: page.evaluate("document.activeElement.id") == "quick-add-input"), "« Ajouter ma première tâche » opens Tâches on the add field")
    page.fill("#quick-add-input", "Appeler Solaris"); page.press("#quick-add-input", "Enter"); page.click('[data-tab="today"]')
    check(eventually(page, lambda: not page.is_visible("#welcome")), "the welcome goes as soon as there is a task")
    check(not errors, f"no page errors ({errors})"); page.context.close()

    page, errors = new_page(b, SEED, viewport={"width": 1400, "height": 900})
    page.goto(URL); page.wait_for_selector(".tab.active")
    # 2. an address typed while the app is open
    page.evaluate("location.hash='#parc'")
    check(eventually(page, lambda: page.evaluate("document.querySelector('.tab.active').dataset.tab") == "parc"), "#parc typed in the open tab opens the Portefeuille")
    page.evaluate("location.hash='#fiche/o1'")
    check(eventually(page, lambda: page.is_visible("#opp-detail-overlay")), "#fiche/<id> typed in the open tab opens that sheet")
    # 3. the sheet shows the company's contact when it has none itself
    side = page.inner_text("#opp-detail-overlay .sp-side")
    check("Claire MARTIN" in side and "contact de Solaris Ouest" in side and "Aucun contact" not in side, f"sheet: the company's contact instead of « Aucun contact » ({side[:120]!r})")
    page.click("#opp-detail-overlay .sp-side >> text=Lier à la fiche")
    o1 = next(o for o in json.loads(page.evaluate("window.storage.peek('todo-widget-opportunities')")) if o["id"] == "o1")
    check(o1.get("nom") == "MARTIN" and o1.get("mail") == "claire@exemple.fr", "« Lier à la fiche » writes the contact on the sheet")
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    # 4. delete, undo, and the bin
    page.evaluate("location.hash='#fiche/o2'"); page.wait_for_selector("#opp-detail-overlay:not(.hidden)")
    page.locator("#opp-detail-overlay summary", has_text="Plus").last.click()
    page.locator("#opp-detail-overlay button", has_text="Supprimer").last.click(); confirm(page)
    check(eventually(page, lambda: page.is_visible("#app-toast.show") and "supprimée" in page.inner_text("#app-toast")), "deleting a deal says so, with « Annuler »")
    page.click("#app-toast button")
    check(eventually(page, lambda: not next(o for o in json.loads(page.evaluate("window.storage.peek('todo-widget-opportunities')")) if o["id"] == "o2")["deleted"]), "« Annuler » brings the deal back")
    page.evaluate("location.hash='#fiche/o2'"); page.wait_for_selector("#opp-detail-overlay:not(.hidden)")
    page.locator("#opp-detail-overlay summary", has_text="Plus").last.click()
    page.locator("#opp-detail-overlay button", has_text="Supprimer").last.click(); confirm(page)
    page.wait_for_timeout(600); page.goto(URL); page.wait_for_selector('.tab.active'); page.click('[data-tab="archive"]'); page.click('.filter-chip[data-filter="corbeille"]')
    check(eventually(page, lambda: "Hangar Nord" in page.inner_text("#archive-list")), "after a reload, the deleted deal is in Archive › Corbeille")
    page.locator("#archive-list .trash-row", has_text="Hangar Nord").locator("button").click()
    check(eventually(page, lambda: not next(o for o in json.loads(page.evaluate("window.storage.peek('todo-widget-opportunities')")) if o["id"] == "o2")["deleted"]), "« Remettre » restores it")
    # 5. moving a deal on is confirmed, and the follow-up counts from the offer date when known
    page.evaluate("location.hash='#fiche/o2'"); page.wait_for_selector("#opp-detail-overlay:not(.hidden)")
    page.click("#opp-detail-overlay .sp-next")
    page.wait_for_selector("#stage-advance-overlay:not(.hidden)")
    check("en attente" not in page.inner_text("#stage-advance-text"), "the offer step does not promise an « en attente » task it does not make")
    page.locator("#stage-advance-overlay button", has_text="Passer").first.click()
    check(eventually(page, lambda: "Passée à" in page.inner_text("#app-toast") and "relance créée" in page.inner_text("#app-toast")), "a move says where the deal went and when the follow-up is")
    # 6. meeting: the follow-up shows as next deadline; columns named as on the sheet; scope and weights said
    page.keyboard.press("Escape"); page.click('[data-tab="pipeline"]'); page.click("#pipe-meet-toggle")
    page.wait_for_selector(".meet-table")
    heads = page.eval_on_selector_all(".meet-table thead th", "els=>els.map(e=>e.textContent)")
    check("Dates du contrat" in heads and "Mécanisme" in heads and "Contrat" not in heads, f"meeting columns: « Dates du contrat » and « Mécanisme » ({heads})")
    row = page.locator(".meet-table tr", has_text="Hangar Nord").inner_text()
    check("Relancer" in row, f"meeting: the automatic follow-up is the next deadline ({row[:160]!r})")
    viz = page.inner_text("#pipeline-board")
    ch = page.inner_text(".meet-changes")
    check("Breizh Test — Toit Neuf : À qualifier → Collecte" in ch and "Nouveau : Nouvelle SAS" in ch and "Perdu : Perdue SAS" in ch, f"meeting: what changed since the last meeting, first ({ch[:200]!r})")
    page.click(".meet-changes >> text=Réunion faite aujourd")
    check(eventually(page, lambda: "0 dossier a avancé" in page.inner_text(".meet-changes")), "« Réunion faite aujourd'hui » starts the next comparison from now")
    check("hors onboarding" in viz and "pricing 25 %" in viz and "même étape > 15 j" in viz, "meeting: the scope, the weights of « probables » and the meaning of « bloquées » are written")
    # 6b. dashboard: the GWh objective with the likely offers
    page.click("#pipe-dash-toggle"); page.wait_for_timeout(400)
    dash = page.inner_text("#pipeline-board")
    check("Avec les offres probables" in dash and "% de l’objectif" in dash and "4 + " in dash and "/ 10 GWh" in dash, f"dashboard: signed + likely GWh against the objective ({dash[dash.find('Avec les offres'):dash.find('Avec les offres')+160]!r})")
    page.click("#pipe-meet-toggle"); page.wait_for_timeout(300)
    # 7. units keep their case; wind in MW; KYC
    page.click("#pipe-list-toggle"); page.wait_for_timeout(300)
    heads = page.eval_on_selector_all("#pipeline-board .th-col, #pipeline-board th", "els=>els.map(e=>e.innerText)")
    check(any("MWh" in h for h in heads) and not any("MWH" in h for h in heads), f"units keep their case in headers ({[h for h in heads if 'MW' in h.upper()]})")
    page.click("#pipe-cols-toggle"); page.wait_for_timeout(300)
    board = page.inner_text("#pipeline-board")
    import re
    check("kYC" not in board and "KYC" in board, "« KYC » keeps its capitals")
    check(re.search(r"1,2 MW(?!c)", board) is not None, "a wind farm is in MW, not MWc")
    # 7b. a short list to paste in Teams on a phone
    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.click("#pipe-meet-toggle"); page.wait_for_selector(".meet-table")
    page.locator(".meet-actions button", has_text="liste courte").click(); page.wait_for_timeout(300)
    short = page.evaluate("navigator.clipboard.readText()")
    check("• Watt Sud — Hangar Nord" in short and "\t" not in short and "prochaine échéance" in short, f"meeting: « Copier en liste courte », one line per installation ({short[:160]!r})")
    # 7c. Offres: who has each deal, since when, the offer's version and price, the follow-ups ready
    page.click("#pipe-offers-toggle"); page.wait_for_selector(".of-sec")
    ofs = page.inner_text("#pipeline-board")
    check("Chez Ops" in ofs and "À toi" in ofs and "Chez le producteur" in ofs and "Hangar Nord" in ofs, "offers view: the three « who has it » sections")
    page.locator(".of-sec[data-k=client] tr", has_text="Hangar Nord").locator("button", has_text="offre").click()
    page.wait_for_selector("#choice-overlay:not(.hidden) #choice-input"); page.fill("#choice-input", "52 €/MWh"); page.locator("#choice-btns button").first.click()
    check(eventually(page, lambda: "Offre 1 · 52 €/MWh" in page.inner_text(".of-sec[data-k=client]")), "offers view: an offer is recorded with its version and price")
    page.locator(".of-sec[data-k=client] tr", has_text="Hangar Nord").locator("button", has_text="offre").click()
    page.wait_for_selector("#choice-overlay:not(.hidden) #choice-input"); page.fill("#choice-input", "49 €/MWh"); page.locator("#choice-btns button").first.click()
    check(eventually(page, lambda: "Offre 2 · 49 €/MWh" in page.inner_text(".of-sec[data-k=client]")), "offers view: the next one is « Offre 2 »")
    page.locator(".of-acts button", has_text="Copier le mail aux Ops").click(); page.wait_for_timeout(300)
    om = page.evaluate("navigator.clipboard.readText()")
    check("Hélio Loire — Ombrière Sud" in om and "il y a 20 jours" in om and "pricing indicatif" in om, f"offers view: one grouped mail to Ops with each request, its date and its delay ({om[:200]!r})")
    page.click("#pipe-cols-toggle"); page.wait_for_timeout(200)
    # 8. a search with no result says so
    page.click("#pipe-cols-toggle"); page.wait_for_timeout(200)
    page.fill("#opp-search", "zzzz")
    check(eventually(page, lambda: "Rien pour « zzzz »" in page.inner_text("#pipeline-board")), "pipeline search with no result: a message and a way out")
    page.click("#pipeline-board .pipe-noresult button")
    check(eventually(page, lambda: page.input_value("#opp-search") == ""), "« Effacer la recherche » clears it")
    # 8b. a task being typed survives a reload
    page.click('[data-tab="tasks"]'); page.click("#quick-add-more"); page.fill("#f-title", "Rappeler Hélio Loire"); page.fill("#f-description", "pour le RDV 2"); page.wait_for_timeout(700)
    page.goto(URL); page.wait_for_selector(".tab.active")
    check(eventually(page, lambda: "Une tâche en cours de saisie" in page.inner_text("#app-toast")), "after a reload: the task being typed is offered back")
    page.click("#app-toast button")
    check(eventually(page, lambda: page.input_value("#f-title") == "Rappeler Hélio Loire" and page.input_value("#f-description") == "pour le RDV 2"), "the typed task is back in the form")
    page.click("#cancel-task"); page.wait_for_timeout(200)
    check(page.evaluate("localStorage.getItem('draft-task')") is None, "cancelling the form drops the draft")
    check(not errors, f"no page errors ({errors})"); page.context.close()

    # 9. a phone opening the usual address gets the phone version; ?full keeps the complete one
    phone = dict(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
    page, errors = new_page(b, SEED, **phone)
    page.goto(URL); page.wait_for_selector(".tab.active", state="attached")
    check(page.evaluate("document.documentElement.classList.contains('lite')"), "phone: the usual address opens the phone version")
    check(page.is_visible(".lite-full-link a"), "phone: « Version complète » is offered")
    page.goto(URL + "?full"); page.wait_for_timeout(500)
    check(not page.evaluate("document.documentElement.classList.contains('lite')"), "phone: ?full keeps the complete version")
    page.goto(URL + "?lite#fiche/o1"); page.wait_for_selector("#opp-detail-overlay:not(.hidden)")
    check(page.locator("#opp-detail-overlay .sp-next").count() >= 1, "phone version: the sheet has its « move on » button")
    check(not errors, f"no page errors ({errors})"); page.context.close()
    b.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
