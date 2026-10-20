"""Smoke tests for index.html, run in a real headless Chromium.

    pip install playwright && python -m playwright install --with-deps chromium
    python tests/smoke_test.py

GitHub is mocked (no network, no real token); Google Fonts is blocked so the
tests don't depend on the network either.
"""
import base64
import tempfile

import openpyxl
import datetime
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
TODAY = datetime.date.today()
TOMORROW = (TODAY + datetime.timedelta(days=1)).isoformat()
failures = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


def task(tid, title, archived=False, updated=1000, **kw):
    t = {"id": tid, "title": title, "description": "", "client": "", "project": "", "urgency": "moyenne",
         "status": "a_faire", "due": "", "reminder": "", "link": "", "recur": None,
         "subtasks": [{"text": "a", "done": False}], "archived": archived, "archivedAt": None,
         "deleted": False, "createdAt": 1, "updatedAt": updated}
    t.update(kw)
    return t


def new_page(browser, seed=None, **ctx):
    page = browser.new_page(**ctx)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    if seed:
        page.add_init_script(
            "if(!sessionStorage.getItem('seeded')){ for (const [k,v] of Object.entries(" + json.dumps(seed) + ")) localStorage.setItem(k,v); sessionStorage.setItem('seeded','1'); }")
    return page, errors


def stored(page, key):
    return page.evaluate(f"JSON.parse(localStorage.getItem('todo_{key}')||'null')")


def mock_github(page, files, put_ok=True, large=()):
    """files: {'tasks.json': [...], ...} — server state, updated on successful PUTs.
    large: files GitHub reports as > 1 MB (metadata without content, raw fetch needed)."""
    state = {"puts": 0, "large": large}

    def handler(route, request):
        name = request.url.rsplit("/", 1)[-1]
        if name not in files:
            return route.fulfill(status=404, body="{}")
        if request.method == "GET":
            if "raw" in request.headers.get("accept", ""):
                return route.fulfill(status=200, content_type="application/vnd.github.raw", body=json.dumps(files[name]))
            if name in state.get("large", ()):  # > 1 MB: GitHub sends the metadata without content
                body = {"sha": "sha-" + name, "content": "", "encoding": "none"}
            else:
                body = {"sha": "sha-" + name, "encoding": "base64", "content": base64.b64encode(json.dumps(files[name]).encode()).decode()}
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        state["puts"] += 1
        if not put_ok:
            return route.fulfill(status=500, body="{}")
        files[name] = json.loads(base64.b64decode(json.loads(request.post_data)["content"]).decode())
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"content": {"sha": "s" + str(state["puts"])}}))

    page.route("**/api.github.com/repos/o/r/contents/data/*", handler)
    return state


SYNC_ON = {"todo_sync-config": json.dumps({"owner": "o", "repo": "r", "token": "t", "enabled": True})}

with sync_playwright() as p:
    browser = p.chromium.launch()

    # --- Tasks: create, validate (archive), delete -> Corbeille -> restore
    page, errors = new_page(browser)
    page.goto(URL)
    page.click('[data-tab="tasks"]')
    page.fill("#quick-add-input", "Tâche A"); page.press("#quick-add-input", "Enter")
    page.fill("#quick-add-input", "Tâche B"); page.press("#quick-add-input", "Enter")
    page.locator("#task-list .task-line", has_text="Tâche A").locator(".task-check").click()
    check([t["archived"] for t in stored(page, "todo-widget-tasks") if t["title"] == "Tâche A"] == [True], "validated task is archived")
    check(page.locator("#task-list .task-line", has_text="Tâche A").count() == 0, "validated task leaves the open list")
    page.on("dialog", lambda d: d.accept())
    page.click('[data-tab="archive"]')
    row = page.locator("#archive-list .task-line", has_text="Tâche A")
    row.hover(); row.locator(".del-btn").click()
    page.wait_for_timeout(300)
    check(page.locator("#archive-list .task-line", has_text="Tâche A").count() == 0, "deleted task leaves the archive")
    page.click('#archive-filters [data-filter="corbeille"]')
    check(page.locator("#archive-list .task-line", has_text="Tâche A").count() == 1, "deleted task shows in Archive > Corbeille")
    page.locator("#archive-list .task-line", has_text="Tâche A").locator(".task-check").click()
    check([t["deleted"] for t in stored(page, "todo-widget-tasks") if t["title"] == "Tâche A"] == [False], "Corbeille restore un-deletes")
    check(page.locator("#archive-list .task-line", has_text="Tâche A").count() == 0, "restored task leaves the Corbeille")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Sync: a validation made right before closing the app (never pushed) survives the next pulls
    for put_ok in (True, False):
        files = {"tasks.json": [task("t1", "X", archived=False)]}
        seed = dict(SYNC_ON, **{"todo_todo-widget-tasks": json.dumps([task("t1", "X", archived=True, updated=2000)]),
                                "todo_sync-tasks-base": json.dumps([task("t1", "X", archived=False)])})
        page, errors = new_page(browser, seed)
        state = mock_github(page, files, put_ok=put_ok)
        page.goto(URL)
        page.wait_for_timeout(4500)  # pull + 3s debounced push
        page.click('[data-tab="lists"]'); page.click("#sync-now-btn"); page.wait_for_timeout(1500)
        check(stored(page, "todo-widget-tasks")[0]["archived"] is True, f"unpushed validation survives sync (put_ok={put_ok})")
        if put_ok:
            check(files["tasks.json"][0]["archived"] is True, "unpushed validation reaches the server")
        check(not errors, f"no page errors ({errors})")
        page.close()

    # --- widget.html uses the same three-way sync (an older copy elsewhere must not bring a task back)
    files = {"tasks.json": [task("t1", "X", archived=False, updated=3000, title2="ignored")]}
    files["tasks.json"][0]["description"] = "edited on the phone"
    seed = dict(SYNC_ON, **{"todo_todo-widget-tasks": json.dumps([task("t1", "X", archived=True, updated=2000)]),
                            "todo_sync-tasks-base": json.dumps([task("t1", "X", archived=False)])})
    page, errors = new_page(browser, seed)
    mock_github(page, files)
    page.goto(URL.replace("index.html", "widget.html")); page.wait_for_timeout(4500)
    t1 = stored(page, "todo-widget-tasks")[0]
    check(t1["archived"] is True and t1["description"] == "edited on the phone", "widget: validation kept and remote edit merged")
    check(files["tasks.json"][0]["archived"] is True, "widget: merged result pushed")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Two tabs (app + widget): a change in one is picked up by the other, never overwritten
    ctx = browser.new_context()
    a = ctx.new_page(); b = ctx.new_page()
    for pg_ in (a, b):
        pg_.route("**/fonts.g*/**", lambda r: r.abort())
    a.goto(URL); a.click('[data-tab="tasks"]'); a.fill("#quick-add-input", "Onglet A"); a.press("#quick-add-input", "Enter")
    b.goto(URL); b.click('[data-tab="tasks"]'); b.fill("#quick-add-input", "Onglet B"); b.press("#quick-add-input", "Enter")
    a.wait_for_timeout(200)
    a.fill("#quick-add-input", "Encore A"); a.press("#quick-add-input", "Enter"); a.wait_for_timeout(200)
    titles = sorted(t["title"] for t in b.evaluate("JSON.parse(localStorage.getItem('todo_todo-widget-tasks'))"))
    check(titles == ["Encore A", "Onglet A", "Onglet B"], f"two open tabs don't overwrite each other ({titles})")
    ctx.close()

    # --- Reminders: a reminder already shown doesn't fire again after reopening the app
    past = (datetime.datetime.now() - datetime.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M")
    page, errors = new_page(browser, {"todo_todo-widget-tasks": json.dumps([task("r1", "Rappel test", reminder=past)])})
    page.add_init_script("window.__notifs=[]; window.Notification=function(t){ window.__notifs.push(t); }; Notification.permission='granted';")
    page.goto(URL); page.wait_for_timeout(500)
    first = page.evaluate("window.__notifs.length")
    page.reload(); page.wait_for_timeout(500)
    check(first == 1 and page.evaluate("window.__notifs.length") == 0, "reminder shown once, not again after reload")
    page.close()

    # --- Sync: a failed push must not make the next merge revert the change
    files = {"tasks.json": [task("t1", "X")]}
    seed = dict(SYNC_ON, **{"todo_todo-widget-tasks": json.dumps([task("t1", "X")]), "todo_sync-tasks-base": json.dumps([task("t1", "X")])})
    page, errors = new_page(browser, seed)
    mock_github(page, files, put_ok=False)
    page.goto(URL)
    page.click('[data-tab="tasks"]')
    page.locator("#task-list .task-check").first.click()
    page.wait_for_timeout(4000)
    page.click('[data-tab="lists"]'); page.click("#sync-now-btn"); page.wait_for_timeout(1500)
    check(stored(page, "todo-widget-tasks")[0]["archived"] is True, "failed push doesn't revert validation")
    page.close()

    # --- Post-it: type, persists, line -> task for tomorrow, minimise / reopen, legacy notes folded in
    legacy = [{"id": "n1", "text": "Rappeler Sophie", "kind": "demain", "forDate": TOMORROW, "createdAt": 1, "updatedAt": 1, "deleted": False}]
    page, errors = new_page(browser, {"todo_todo-widget-notes": json.dumps(legacy)}, viewport={"width": 1300, "height": 850})
    page.goto(URL)
    check(page.is_visible("#postit"), "post-it open by default on desktop")
    check(page.input_value("#postit-text") == "Demain : Rappeler Sophie", "old multi-post-it notes folded into the post-it")
    page.click("#postit-text"); page.keyboard.press("End")
    page.keyboard.type("\nEnvoyer offre PPA\nidée : webinar ACC")
    # the note is saved after a short pause in typing: wait for the save itself, not a fixed delay
    page.wait_for_function("(localStorage.getItem('todo_todo-widget-notes')||'').includes('webinar ACC')", timeout=10000)
    page.reload()
    check(page.input_value("#postit-text") == "Demain : Rappeler Sophie\nEnvoyer offre PPA\nidée : webinar ACC", "post-it text persists after reload")
    page.click("#postit-text")
    page.evaluate("const t=document.getElementById('postit-text'); const i=t.value.indexOf('Envoyer'); t.setSelectionRange(i+3,i+3);")
    page.click("#postit-to-task"); page.wait_for_timeout(300)
    tk = [t for t in stored(page, "todo-widget-tasks") if t["title"] == "Envoyer offre PPA"]
    check(len(tk) == 1 and tk[0]["due"] == TOMORROW and tk[0]["urgency"] == "haute", "line → task urgent for tomorrow")
    check("Envoyer offre PPA" not in page.input_value("#postit-text"), "converted line removed from post-it")
    page.click("#postit-min")
    check(not page.is_visible("#postit") and page.is_visible("#postit-tab"), "minimise shows the small tab")
    page.keyboard.press("p"); page.wait_for_timeout(100)
    check(page.is_visible("#postit") and page.evaluate("document.activeElement.id") == "postit-text", "'p' reopens the post-it with focus")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Post-it syncs between devices
    files = {"notes.json": [{"id": "scratchpad", "text": "écrit sur le téléphone", "createdAt": 1, "updatedAt": 5, "deleted": False}]}
    page, errors = new_page(browser, SYNC_ON, viewport={"width": 1300, "height": 850})
    mock_github(page, files)
    page.goto(URL); page.wait_for_timeout(800)
    check(page.input_value("#postit-text") == "écrit sur le téléphone", "post-it pulled from the other device")
    page.click("#postit-text"); page.keyboard.press("End"); page.keyboard.type(" + PC")
    page.wait_for_timeout(4500)
    check(files["notes.json"][0]["text"] == "écrit sur le téléphone + PC", "post-it edit pushed")
    page.close()

    # --- Sync: a data file over 1 MB is read through the raw media type
    big = [{"id": "c%d" % i, "firstName": "P%d" % i, "lastName": "N", "company": "", "email": "", "phone1": "", "phone2": "", "role": "",
            "relevance": 0, "comment": "x" * 200, "createdAt": 1, "updatedAt": 1, "deleted": False} for i in range(300)]
    files = {"crm.json": {"companies": [], "contacts": big, "meetings": [], "opportunities": []}, "tasks.json": [], "notes.json": []}
    page, errors = new_page(browser, SYNC_ON)
    mock_github(page, files, large=("crm.json",))
    page.goto(URL); page.wait_for_timeout(1500)
    check(len(stored(page, "todo-widget-contacts") or []) == 300, "sync reads a data file over 1 MB")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Contacts on a phone: no horizontal overflow, delete available in the card
    contacts = [{"id": "c1", "firstName": "Julien", "lastName": "Marchand", "role": "Directeur Commercial", "company": "Alpha Energy",
                 "email": "j@alpha.fr", "phone1": "0612345678", "phone2": "", "relevance": 4, "comment": "", "createdAt": 1, "updatedAt": 1, "deleted": False}]
    page, errors = new_page(browser, {"todo_todo-widget-contacts": json.dumps(contacts)},
                            viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page.goto(URL)
    check(not page.is_visible("#postit"), "post-it minimised by default on phone")
    page.tap('[data-tab="contacts"]')
    check(page.evaluate("document.documentElement.scrollWidth") <= 390, "contacts fit the phone screen")
    page.tap(".contact-main")
    check(page.locator(".contact-detail-links button", has_text="Supprimer").count() == 1, "delete reachable from the contact card")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Contacts: alphabetical by default, sortable columns, company info on demand, edit keeps scroll
    people = [("Zoé", "Martin", "Beta", 2), ("Adam", "Durand", "Beta", 5), ("Léa", "Bernard", "Alpha", 3), ("Hugo", "Petit", "", 1)]
    people += [(f"P{i}", f"Nom{i:02d}", "Gamma", 1) for i in range(40)]
    cts = [{"id": f"c{i}", "firstName": f, "lastName": l, "role": "", "company": co, "email": "", "phone1": "", "phone2": "",
            "relevance": r, "comment": "", "createdAt": 1, "updatedAt": 1, "deleted": False} for i, (f, l, co, r) in enumerate(people)]
    cos = [{"id": "co1", "name": "Alpha", "type": "Client", "whatTheyDo": "Producteur hors France", "marketScope": ["EU"], "website": "",
            "createdAt": 1, "updatedAt": 1, "deleted": False}]
    page, errors = new_page(browser, {"todo_todo-widget-contacts": json.dumps(cts), "todo_todo-widget-companies": json.dumps(cos)},
                            viewport={"width": 1300, "height": 700})
    page.goto(URL); page.click('[data-tab="contacts"]')
    names = lambda: page.eval_on_selector_all("#contacts-list .contact-name > span:first-child", "els=>els.map(e=>e.textContent)")
    check(names()[:3] == ["Léa Bernard", "Adam Durand", "Zoé Martin"], f"contacts alphabetical by default {names()[:3]}")
    check("Producteur hors France" not in page.inner_text("#contacts-list"), "company info hidden by default")
    page.locator(".company-group-header", has_text="Alpha").locator(".co-info-btn").click()
    check("Producteur hors France" in page.inner_text("#contacts-list"), "company info shown with the (i) button")
    page.click('.contacts-header-row .sort[data-sort="rel"]')
    # stars are the client's: Beta starts at 5 (best of its contacts), Alpha at 3, Gamma at 1
    check(names()[:3] == ["Adam Durand", "Zoé Martin", "Léa Bernard"], f"sort by Note puts the best-rated clients first ({names()[:3]})")
    rel = {c["name"]: c.get("relevance") for c in stored(page, "todo-widget-companies")}
    check(rel.get("Alpha") == 3 and not page.is_visible("#ct-relevance-picker"), f"client note starts from its best contact, none on the contact form ({rel})")
    page.locator(".company-group-header", has_text="Alpha").locator(".co-stars .co-star").nth(4).click()
    rel = {c["name"]: c.get("relevance") for c in stored(page, "todo-widget-companies")}
    check(rel.get("Alpha") == 5, "clicking the stars on the client line rates the client")
    page.click('#contacts-view-switch [data-view="liste"]')
    page.click('.contacts-header-row .sort[data-sort="name"]'); page.click('.contacts-header-row .sort[data-sort="name"]')
    check(names()[0] == "Hugo Petit", f"clicking Contact twice sorts Z→A {names()[:2]}")
    page.click('.contacts-header-row .sort[data-sort="name"]')
    page.evaluate("document.getElementById('tab-contacts').scrollTop=600")
    before = page.evaluate("document.getElementById('tab-contacts').scrollTop")
    row = page.locator("#contacts-list .contact-row", has_text="Nom20")
    row.locator(".contact-main").click()
    page.locator(".contact-detail-links button", has_text="Modifier la fiche").click()
    check(page.is_visible("#contact-form") and page.evaluate("document.getElementById('tab-contacts').scrollTop") == before, "opening the edit form keeps the list position")
    page.fill("#ct-role", "Acheteur"); page.click("#contact-save-btn")
    check(page.evaluate("document.getElementById('tab-contacts').scrollTop") == before, "saving a contact keeps the list position")
    check(page.evaluate("document.querySelector('.app-sidebar').getBoundingClientRect().top") == 0, "sidebar stays in place")
    page.evaluate("window.scrollTo(0, 2000)")
    check(page.evaluate("document.querySelector('.app-sidebar').getBoundingClientRect().top") == 0, "sidebar stays in place when the page scrolls")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Pipeline: client → contact → mail, installations grouped in a pricing request, Go, Excel rows
    MAIL = ("De : Pierre Lacombe <p.lacombe@vergersdulot.fr>\nObjet : Projet centrale PV\n\n"
            "Nous mettrons en service en juin 2027 une centrale photovoltaïque au sol de 2,4 MWc à Prayssac (46220), "
            "lauréate de l'appel d'offres simplifié de la CRE. Production attendue : environ 3 100 MWh par an.\n\n"
            "Cordialement,\nPierre Lacombe\nGérant\nSCEA LES VERGERS DU LOT\n06 71 23 45 89")
    legacy = [{"id": "o1", "company": "Solaris", "title": "AO Q3", "stage": "pricing", "taskId": None, "createdAt": 1, "updatedAt": 1, "deleted": False}]
    anne = [{"id": "c1", "firstName": "Anne", "lastName": "Roux", "role": "Asset manager", "company": "Solaris", "email": "anne@urba.fr",
             "phone1": "0611223344", "phone2": "", "relevance": 3, "comment": "", "createdAt": 1, "updatedAt": 1, "deleted": False}]
    page, errors = new_page(browser, {"todo_todo-widget-opportunities": json.dumps(legacy), "todo_todo-widget-contacts": json.dumps(anne),
                                      "todo_todo-widget-clients": json.dumps(["Solaris"])}, viewport={"width": 1300, "height": 850})
    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    opps = lambda: stored(page, "todo-widget-opportunities")
    page.goto(URL); page.click('[data-tab="pipeline"]')
    check("Demande de prix" in page.inner_text('[data-phase="offre"]'), "old opportunities move to the new stages")
    page.click("#opp-add-btn"); page.fill("#pq1-company", "solaris")
    check("Client existant" in page.inner_text("#pq1-company-hint"), "step 1 recognises a known client")
    page.click("#pq-next-btn")
    check(page.input_value("#pq-s-mail") == "anne@urba.fr", "its only contact is used by default")
    page.click("#pq-cancel-btn")
    page.click("#opp-add-btn"); page.fill("#pq1-company", "SCEA Les Vergers du Lot")
    check("Nouveau client" in page.inner_text("#pq1-company-hint"), "step 1 flags a new client")
    page.click("#pq-next-btn"); page.fill("#pq-mail", MAIL); page.wait_for_timeout(500)
    check(page.input_value("#pq-0-kwc") == "2400" and page.input_value("#pq-0-dept") == "46 - Lot" and page.input_value("#pq-s-prenom") == "Pierre",
          "pasted mail prefills the installation and the contact")
    page.click("#pq-add-inst"); page.fill("#pq-1-centrale", "Le Moulin"); page.fill("#pq-1-kwc", "1800")
    page.select_option("#pq-s-charge", "PGU"); page.click("#pq-save-btn")
    check(page.is_visible("#pq-overlay") and "nombre d" in page.inner_text("#pq-summary").lower(), "two installations: saving waits for the count to be confirmed")
    check("2 installations" in page.inner_text("#pq-count-box"), "the form shows the number of installations found")
    page.check("#pq-count-ok"); page.click("#pq-save-btn")
    inst = [o for o in opps() if o.get("kind") == "installation" and o["company"] == "SCEA Les Vergers du Lot"]
    req = [o for o in opps() if o.get("kind") == "request"]
    check(len(inst) == 2 and len(req) == 1 and all(o["requestId"] == req[0]["id"] for o in inst), "two installations grouped in one request")
    check(any(c["email"] == "p.lacombe@vergersdulot.fr" for c in stored(page, "todo-widget-contacts")), "contact created from the mail")
    t = [t for t in stored(page, "todo-widget-tasks") if t.get("opportunityId") == req[0]["id"]]
    check(len(t) == 1 and t[0]["title"].startswith("Appeler Pierre"), "one call task for the whole request")
    page.click(".pipe-req-card .pipe-card-title")
    check("Codes affaire" in page.input_value("#opp-mail-body") and "27(06)" in page.input_value("#opp-mail-body"), "pricing mail with business codes")
    page.click("#opp-detail-actions >> text=Copier lignes Pipe")
    rows = page.evaluate("navigator.clipboard.readText()").split("\n")
    check(len(rows) == 2 and all(len(r.split("\t")) == 37 for r in rows), "Pipe rows: one per installation, 37 columns")
    page.click("#opp-detail-actions >> text=Fermer")
    # validating the task offers the next stage for the whole request
    page.click('[data-tab="tasks"]'); page.locator(".task-line", has_text="Appeler Pierre").locator(".task-check").first.click()
    page.wait_for_timeout(200)
    check(page.is_visible("#stage-advance-overlay"), "validating a linked task offers the next stage")
    page.click("#stage-advance-confirm")
    check(all(o["stage"] == "prise_contact" for o in opps() if o.get("requestId") == req[0]["id"]), "the request's installations advance together")
    # Go from the installation sheet
    page.click('[data-tab="pipeline"]')
    page.locator('[data-phase="qualif"] .pipe-req-name', has_text="Le Moulin").click()
    page.click(".opp-stage-step:has-text('Qualification')")
    page.click("#opp-detail-actions >> text=Go"); page.click("#stage-advance-confirm")
    moulin = next(o for o in opps() if o.get("centrale") == "Le Moulin")
    check(moulin["stage"] == "demande_prix" and moulin.get("goDate"), "Go moves to the pricing request and records the date")
    check(page.is_visible("#opp-mail-body"), "after Go, the pricing request opens")
    page.click("#opp-detail-actions >> text=Fermer")
    page.locator('[data-phase="offre"] .pipe-card', has_text="Le Moulin").first.click()
    check("statut bdd" in page.inner_text("#opp-detail-body").lower() and "En préparation" in page.inner_text("#opp-detail-body"), "installation sheet shows the BDD status")
    page.click("#opp-detail-actions >> text=Copier ligne BDD")
    row = page.evaluate("navigator.clipboard.readText()").split("\t")
    check(len(row) == 91 and row[24] == "En préparation" and row[33] == "Le Moulin", "BDD row: 91 columns, status and plant")
    page.click("#opp-detail-actions >> text=Fermer")
    # pré-qualif → installation
    page.click("#prequal-add-btn"); page.fill("#prequal-company", "Ferme Dupont"); page.fill("#prequal-note", "Salon"); page.click("#prequal-save-btn")
    page.click('[data-phase="prequal"] .pipe-card'); page.click("#opp-detail-actions >> text=Projet identifié")
    check(page.input_value("#pq1-company") == "Ferme Dupont", "pré-qualif opens the form on its client")
    page.click("#pq-next-btn"); page.fill("#pq-0-centrale", "Toiture A"); page.click("#pq-save-btn")
    check(page.locator('[data-phase="prequal"] .pipe-card').count() == 0 and "Toiture A" in page.inner_text('[data-phase="qualif"]'), "pré-qualif becomes an installation")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Phone version (index.html?lite): bottom bar, fewer features, pipeline read-only
    page, errors = new_page(browser, {"todo_todo-widget-opportunities": json.dumps([{"id": "i3", "kind": "installation", "company": "Solaris",
        "centrale": "Moulin Neuf", "title": "Moulin Neuf", "stage": "negociation", "createdAt": 1, "updatedAt": 1, "deleted": False}])},
        viewport={"width": 390, "height": 800}, is_mobile=True, has_touch=True)
    page.goto(URL + "?lite")
    check(page.is_visible("#lite-nav") and not page.is_visible(".app-sidebar"), "phone version: bottom bar instead of the sidebar")
    check(page.get_attribute("#app-manifest", "href") == "manifest-lite.json", "phone version installs with its own manifest")
    page.click("#lite-nav [data-go=tasks]"); page.fill("#quick-add-input", "Depuis le téléphone"); page.press("#quick-add-input", "Enter")
    check(any(t["title"] == "Depuis le téléphone" for t in stored(page, "todo-widget-tasks")), "phone version: quick add works")
    page.click("#lite-nav [data-go=pipeline]")
    check(not page.is_visible("#opp-add-btn"), "phone version: no opportunity form")
    page.click(".pipe-card:has-text('Moulin Neuf')")
    visible = page.eval_on_selector_all("#opp-detail-actions button", "els=>els.filter(e=>e.offsetParent).map(e=>e.textContent)")
    check(visible == ["Fermer"], f"phone version: installation sheet is read-only ({visible})")
    check(page.evaluate("document.documentElement.scrollWidth") <= 390, "phone version fits the screen")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Contacts: « Coller une signature » pre-fills the contact form
    page, errors = new_page(browser)
    page.goto(URL); page.click('[data-tab="contacts"]'); page.click("#sig-paste-btn")
    page.fill("#sig-paste-text", "M. Jean DUPONT\nPrésident\nSAS SOLAIRE DU MIDI\nTél : 04 67 11 22 33 - Mob. : 06 12 34 56 78\njean.dupont@solairedumidi.fr")
    page.click("#sig-paste-analyze")
    got = [page.input_value(s_) for s_ in ("#ct-first", "#ct-last", "#ct-role", "#ct-company", "#ct-email", "#ct-phone1", "#ct-phone2")]
    check(got == ["Jean", "Dupont", "Président", "SAS SOLAIRE DU MIDI", "jean.dupont@solairedumidi.fr", "06 12 34 56 78", "04 67 11 22 33"], f"signature fills the contact form ({got})")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- New opportunity: pasting a signature in step 1 fills the client and the contact
    page, errors = new_page(browser)
    page.goto(URL); page.click('[data-tab="pipeline"]'); page.click("#opp-add-btn")
    page.click("#pq1-sig-box summary")
    page.fill("#pq1-sig", "Camille DUBOIS\nResponsable financement de projets\nRHÔNE ÉNERGIES SAS\nT. 04 75 00 00 06\nM. 06 77 00 00 06\ncamille.dubois@rhone-energies.fr")
    page.wait_for_timeout(500)
    got = [page.input_value(x) for x in ("#pq1-company", "#pq1-prenom", "#pq1-nom", "#pq1-qualite", "#pq1-tel", "#pq1-mail")]
    check(got == ["RHÔNE ÉNERGIES SAS", "Camille", "DUBOIS", "Responsable financement de projets", "06 77 00 00 06 / 04 75 00 00 06", "camille.dubois@rhone-energies.fr"],
          f"step 1: a pasted signature fills client and contact ({got})")
    # a second signature (another person) becomes an additional contact; the main one stays
    page.fill("#pq1-sig", "Marc LEROY\nDirecteur technique\nRHÔNE ÉNERGIES SAS\n06 11 11 11 11\nmarc.leroy@rhone-energies.fr"); page.wait_for_timeout(500)
    check(page.input_value("#pq1-prenom") == "Camille" and page.input_value("#pq1-extras input[data-xk='prenom']") == "Marc", "a second signature adds a second contact")
    page.click("#pq1-add-extra"); page.fill("#pq1-extras input[data-x='1'][data-xk='prenom']", "Lucie"); page.fill("#pq1-extras input[data-x='1'][data-xk='nom']", "Roy")
    page.click("#pq-next-btn")
    check(page.input_value("#pq-s-producteur") == "RHÔNE ÉNERGIES SAS" and page.input_value("#pq-s-prenom") == "Camille", "step 2 starts with the signature's client and contact")
    page.fill("#pq-0-centrale", "Toit A"); page.click("#pq-save-btn")
    names = sorted(c["firstName"] for c in stored(page, "todo-widget-contacts"))
    inst = [o for o in stored(page, "todo-widget-opportunities") if o.get("kind") == "installation"][0]
    check(names == ["Camille", "Lucie", "Marc"] and len(inst.get("otherContactIds", [])) == 2, f"three contacts created, two linked as other contacts ({names})")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Qualification: the number of plants announced by the mail is checked against the installations found
    page, errors = new_page(browser)
    page.goto(URL); page.click('[data-tab="pipeline"]'); page.click("#opp-add-btn"); page.fill("#pq1-company", "SEM"); page.click("#pq-next-btn")
    page.fill("#pq-mail", "De : H R <h@sem.fr>\nObjet : Nos centrales\n\nNous avons trois projets :\n- Gymnase : 250 kWc\n- École : 100 kWc\nSoit une puissance totale de 600 kWc.\nH R")
    page.wait_for_timeout(500)
    box = page.inner_text("#pq-count-box")
    check("annonce 3 installations" in box and "600 kWc" in box, f"missing plant flagged against the mail ({box!r})")
    page.click("#pq-add-inst"); page.fill("#pq-2-centrale", "Mairie"); page.fill("#pq-2-kwc", "250"); page.press("#pq-2-kwc", "Tab"); page.wait_for_timeout(200)
    check("conforme au mail" in page.inner_text("#pq-count-box"), "adding the missing plant makes the count match")
    page.check("#pq-count-ok"); page.click("#pq-save-btn")
    check(len([o for o in stored(page, "todo-widget-opportunities") if o.get("kind") == "installation"]) == 3, "three installations saved after confirmation")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Pipeline: a request whose installations are at different stages moves each one forward (never back)
    mixed = [{"id": "r9", "kind": "request", "company": "SEM", "title": "Demande de pricing", "createdAt": 1, "updatedAt": 1, "deleted": False},
             {"id": "a", "kind": "installation", "company": "SEM", "centrale": "A", "title": "A", "stage": "negociation", "requestId": "r9", "createdAt": 1, "updatedAt": 1, "deleted": False},
             {"id": "b", "kind": "installation", "company": "SEM", "centrale": "B", "title": "B", "stage": "collecte", "requestId": "r9", "createdAt": 1, "updatedAt": 1, "deleted": False}]
    page, errors = new_page(browser, {"todo_todo-widget-opportunities": json.dumps(mixed)})
    page.goto(URL); page.click('[data-tab="pipeline"]')
    page.locator('[data-phase="contrat"] .pipe-card', has_text="A").first.click()
    page.click("#opp-detail-body >> text=Fait partie de")
    page.click("#opp-detail-actions >> text=Avancer chaque installation"); page.click("#stage-advance-confirm")
    st = {o["id"]: o.get("stage") for o in stored(page, "todo-widget-opportunities")}
    check(st["a"] == "pricing_ferme" and st["b"] == "qualif_en_cours", f"mixed request: each installation to its own next stage ({st})")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Pipeline: a mail listing several plants gives one installation each; quotes in a mail never reach the HTML
    page, errors = new_page(browser)
    page.goto(URL); page.click('[data-tab="pipeline"]'); page.click("#opp-add-btn"); page.fill("#pq1-company", "HELIO OUEST SAS"); page.click("#pq-next-btn")
    page.fill("#pq-mail", "De : R C <r@helio.fr>\nObjet : x\n\nBonjour,\n- Centrale de Cholet (49) : 1,2 MWc, MES 03/2027\n- Centrale de Saumur (49) : 800 kWc\nCordialement,\nRomain Chevalier")
    page.wait_for_timeout(500)
    check(page.input_value("#pq-1-centrale") == "Centrale de Saumur" and page.input_value("#pq-0-mesPrev") == "Mars 2027", "mail listing two plants → two installations")
    page.fill("#pq-mail", "De\tObjet\tReçu\tTaille\tCatégories\t\nPierre Dupont;  Paul Guérin\tRE: Projets PV\tlun. 16:07\t318 Ko\tTodo-synced"); page.wait_for_timeout(400)
    check(page.is_visible("#pq-mail-warning"), "pasting the Outlook list line explains how to get the mail content")
    page.fill("#pq-0-centrale", 'x" autofocus onfocus="window.__xss=1" y="')
    page.select_option("#pq-0-install", "Eolien"); page.wait_for_timeout(300)  # re-renders the form with the value in an attribute
    check(page.evaluate("window.__xss") is None and page.input_value("#pq-0-centrale").startswith('x" autofocus'), "a quote in a field can't inject HTML")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Pipeline: producer Excel, one column per plant (SheetJS from cdnjs)
    wb = openpyxl.Workbook(); ws = wb.active
    for r in [["", "Centrale 1", "Centrale 2"], ["Nom Installation", "Les Vignes", "Le Moulin"], ["Département", "Lot (46)", "Gers (32)"],
              ["Puissance installée (MWc)", 2.4, 1.85], ["P50 (MWh/an)", 3100, 2300], ["Date de mise en service", "Juin 2027", "Mars 2028"]]:
        ws.append(r)
    xlsx = pathlib.Path(tempfile.mkdtemp()) / "carac.xlsx"; wb.save(xlsx)
    page, errors = new_page(browser)
    page.goto(URL); page.click('[data-tab="pipeline"]'); page.click("#opp-add-btn"); page.fill("#pq1-company", "SCEA X"); page.click("#pq-next-btn")
    page.set_input_files("#pq-file", str(xlsx)); page.wait_for_function("document.getElementById('pq-files-info').textContent.includes('installation')", timeout=20000)
    check(page.input_value("#pq-0-centrale") == "Les Vignes" and page.input_value("#pq-1-kwc") == "1850" and page.input_value("#pq-1-dept") == "32 - Gers",
          "producer Excel creates one installation per column")
    # the Selfee « Caractéristiques Centrales » template: SPV, SIRET, P90 reach the form, kVA/productible rows are not taken as power
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Données"
    for r in [["", "Centrale 1"], ["Nom Installation", "CS Bram"], ["Nom SPV", "BRAM SOLAIRE SAS"], ["SIRET SPV", "123 456 789 00012"], ["Département", "Aude (11)"],
              ["Puissance raccordement (kVA)", 4200], ["Puissance installée (kWc)", 4986.93], ["P50 (MWh/an)", 6650], ["P90 (MWh/an)", 6100], ["Productible P50 (kWh/kWc/an)", 1333]]:
        ws.append(r)
    tpl = pathlib.Path(tempfile.mkdtemp()) / "carac_selfee.xlsx"; wb.save(tpl)
    page.click("#pq-cancel-btn"); page.click("#opp-add-btn"); page.fill("#pq1-company", "SCEA Y"); page.click("#pq-next-btn")
    page.set_input_files("#pq-file", str(tpl)); page.wait_for_function("document.getElementById('pq-files-info').textContent.includes('installation')", timeout=20000)
    got = [page.input_value(s_) for s_ in ("#pq-0-centrale", "#pq-0-kwc", "#pq-0-spv", "#pq-0-siret", "#pq-0-p90", "#pq-0-dept")]
    check(got == ["CS Bram", "4986.93", "BRAM SOLAIRE SAS", "123 456 789 00012", "6100", "11 - Aude"], f"Selfee template read into the form ({got})")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Parc: Suivi Agrégation workbook → dashboard; contacts → phone (.vcf) without duplicates
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "BDD Agrégation"
    hdr = ["Vérification", "Année", "Chargé", "Date entrée BDD", "Source", "Crédit Agricole", "Développeur", "Ref", "Cadre juridique", "Type AO CRE",
           "Région", "Département", "Statut", "Date_fin", "Renouvellement", "Nom_prod", "Nom_Installation_prod", "Type_EnR", "P_installée (KWc)", "P50\n(MWh)",
           "Agrégation 2026", "Agrégation 2027", "Département 2", "Département2"]
    ws.append(["Date renouvellement"]); ws.append([]); ws.append(hdr)
    soon = (TODAY + datetime.timedelta(days=90))
    ws.append(["", 2021, "PGU", None, "Contact direct", "N/A", "SOLARIS", "", "CR", "AO CRE", "Occitanie", "34 - Hérault", "Gagné", soon, "A renouveler", "SOLARIS", "CS DU MOULIN", "PV", 2990, 4500, 4500, 0, "Hérault", "30 - Gard"])
    ws.append(["", 2022, "SMA", None, "Contact direct", "N/A", "VENTUS", "", "Marché", "", "Bretagne", "29 - Finistère", "Gagné", datetime.date(2028, 12, 31), "En cours", "VENTUS", "Parc B", "PV", 10000, 23000, 23000, 23000])
    ws.append(["", 2026, "PGU", None, "BOAMP", "N/A", "X", "", "CR", "", "Grand Est", "", "En attente", None, "", "X", "Toit", "PV", 500, 600, "", ""])
    d = wb.create_sheet("Dashboard"); d.append(["", "Désignation", "2026", "2027"]); d.append(["", "Object. Agrégation Vol.", 150, 300])
    parc = pathlib.Path(tempfile.mkdtemp()) / "suivi.xlsx"; wb.save(parc)
    dupes = [{"id": "c1", "firstName": "Anne", "lastName": "Roux", "role": "Asset", "company": "Solaris", "email": "anne@urba.fr", "phone1": "0611223344", "phone2": "",
              "relevance": 0, "comment": "", "createdAt": 1, "updatedAt": 1, "deleted": False},
             {"id": "c2", "firstName": "Anne", "lastName": "Roux", "role": "", "company": "Solaris", "email": "ANNE@urba.fr", "phone1": "", "phone2": "",
              "relevance": 0, "comment": "", "createdAt": 1, "updatedAt": 2, "deleted": False}]
    page, errors = new_page(browser, {"todo_todo-widget-contacts": json.dumps(dupes)}, accept_downloads=True)
    page.goto(URL); page.click('[data-tab="parc"]')
    page.set_input_files("#parc-file", str(parc)); page.wait_for_function("document.getElementById('parc-info').textContent.includes('lignes')", timeout=20000)
    years = page.eval_on_selector_all(".parc-years button:not(.parc-global)", "els=>els.map(e=>e.textContent)")
    check(years == [str(TODAY.year + i) for i in range(5)], f"portefeuille: 5 years from the current one ({years})")
    check(page.locator(".parc-map .dot").count() == 2 and page.locator(".parc-map .dep").count() == 96, "portefeuille: map of the 96 départements, one dot per signed plant")
    page.hover(".parc-map .dot[data-dep='30']"); page.wait_for_timeout(100)
    check(page.is_visible(".parc-map-wrap .parc-map-tip") and "CS DU MOULIN" in page.inner_text(".parc-map-wrap .parc-map-tip") and "Solaire PV" in page.inner_text(".parc-map-wrap .parc-map-tip"), "portefeuille: hovering a dot shows the plant and its technology")
    page.click(".parc-map .dot[data-dep='30']"); page.wait_for_timeout(100)
    check("gard" in page.inner_text(".parc-map-side").lower(), "portefeuille: a plant is placed where it is (Département2), not at the contract's département")
    vb0 = page.get_attribute(".parc-map", "viewBox")
    page.click(".map-zoom button >> nth=0"); page.wait_for_timeout(100)
    check(page.get_attribute(".parc-map", "viewBox") != vb0, "portefeuille: the map zooms in")
    page.click(".map-zoom button >> nth=2"); page.wait_for_timeout(100)
    check(page.get_attribute(".parc-map", "viewBox").startswith("0 0 "), "portefeuille: reset shows all France again")
    page.hover(".parc-kpis .stat-card >> nth=1"); page.wait_for_timeout(100)
    check(page.is_visible(".parc-kpis .chart-tip") and "Solaire PV" in page.inner_text(".parc-kpis .chart-tip"), "portefeuille: hovering a figure shows its detail")
    page.click(".parc-kpis .stat-card >> nth=2"); page.wait_for_timeout(150)
    check(page.is_visible(".parc-kpi-filter") and page.locator(".parc-map .dot").count() == 1 and page.locator(".parc-table tbody tr").count() == 1,
          "portefeuille: clicking « fins de contrat » filters the map and the table")
    page.click(".parc-kpi-filter button"); page.wait_for_timeout(150)
    check(not page.is_visible(".parc-kpi-filter") and page.locator(".parc-map .dot").count() == 2, "portefeuille: removing the filter shows everything again")
    page.click("#parc-source-btn"); page.fill("#parc-link", "https://example.sharepoint.com/sites/x/Suivi.xlsx"); page.click("#parc-link-save")
    check(page.get_attribute("#parc-open-link", "href") == "https://example.sharepoint.com/sites/x/Suivi.xlsx" and page.is_visible("#parc-open-link"), "portefeuille: Excel link saved, opens in one click")
    page.hover(".parc-chart .hz >> nth=0"); page.wait_for_timeout(100)
    check(page.is_visible(".parc-chart-wrap .chart-tip") and "GWh" in page.inner_text(".parc-chart-wrap .chart-tip"), "portefeuille: hovering a year of the chart shows its detail")
    page.click(".parc-years .parc-global"); k = page.inner_text(".parc-kpis")
    check("50,5 GWh" in k and "%d–%d" % (TODAY.year, TODAY.year + 4) in k, f"portefeuille: global view sums the 5 years ({k[:70]!r})")
    page.click(".parc-years button:text-is('2026')")
    k = page.inner_text(".parc-kpis")
    check("27,5 GWh" in k and "18 %" in k, f"parc: volume of won contracts vs objective ({k[:60]!r})")
    check("CS DU MOULIN" in page.inner_text("#parc-body") and page.locator(".parc-due").count() == 1, "parc: contract ending soon is listed")
    renew = [t for t in stored(page, "todo-widget-tasks") if t["id"].startswith("renew_")]
    check(len(renew) == 1 and "CS DU MOULIN" in renew[0]["title"] and renew[0]["urgency"] == "haute", "parc: renewal task created for the contract ending soon")
    page.set_input_files("#parc-file", str(parc)); page.wait_for_timeout(1500)
    check(len([t for t in stored(page, "todo-widget-tasks") if t["id"].startswith("renew_")]) == 1, "parc: reloading the file doesn't duplicate the renewal task")
    page.click(".parc-due .pq-link:has-text('Remettre dans le pipeline')"); page.wait_for_timeout(300)
    check(page.is_visible("#opp-detail-overlay") and "CS DU MOULIN" in page.inner_text("#opp-detail-title"), "parc: contract put back into the pipeline")
    page.click("#opp-detail-actions >> text=Fermer")
    page.click('[data-tab="contacts"]'); page.click("#vcf-btn")
    check(page.inner_text("#vcf-new") == "1", "vcf: duplicates inside the app count once")
    with page.expect_download() as dl:
        page.click("#vcf-go")
    card = pathlib.Path(dl.value.path()).read_text()
    check(card.count("BEGIN:VCARD") == 1 and "TEL;TYPE=CELL:0611223344" in card and "anne@urba.fr" in card, "vcf: merged card keeps phone and email")
    page.click("#vcf-close"); page.click("#vcf-btn")
    check(page.inner_text("#vcf-new") == "0", "vcf: a second export only sends new contacts")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Excel bridge (local PowerShell server, mocked here): typed rows sent, status shown
    sent = []
    def bridge(route, request):
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"})
        h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
        if request.url.endswith("/status"):
            ok = request.headers.get("x-bridge-token") == "k1"
            return route.fulfill(status=200, headers=h, body=json.dumps({"ok": True, "authorized": ok, "pipe": {"name": "Pipe.xlsx", "found": True}, "bdd": {"name": "Suivi.xlsx", "found": True}}))
        sent.append((request.url.rsplit("/", 2)[-2], json.loads(request.post_data)))
        return route.fulfill(status=200, headers=h, body=json.dumps({"ok": True, "results": [{"ok": True, "action": "ajoutée", "row": 12}]}))
    inst = [{"id": "i1", "kind": "installation", "company": "SCEA", "producteur": "SCEA", "centrale": "Les Vignes", "title": "Les Vignes", "stage": "demande_prix",
             "goDate": "2026-10-19", "dateEntree": "2026-10-12", "kwc": "2400", "new": True, "createdAt": 1, "updatedAt": 1, "deleted": False}]
    page, errors = new_page(browser, {"todo_todo-widget-opportunities": json.dumps(inst)})
    page.route("http://127.0.0.1:8765/**", bridge)
    page.goto(URL); page.click('[data-tab="lists"]'); page.fill("#bridge-token", "k1"); page.click("#bridge-save-btn")
    page.wait_for_function("document.getElementById('bridge-status').textContent.includes('Connecté')", timeout=5000)
    check(True, "bridge: status shows the connected files")
    page.click('[data-tab="pipeline"]'); page.click(".pipe-card:has-text('Les Vignes')")
    page.click("#opp-detail-actions >> text=Envoyer au Pipe Excel"); page.wait_for_timeout(300)
    page.click("#opp-detail-actions >> text=Envoyer à la BDD Excel"); page.wait_for_timeout(300)
    pipe_row = next(b["rows"][0] for k, b in sent if k == "pipe"); bdd_row = next(b["rows"][0] for k, b in sent if k == "bdd")
    check(len(pipe_row) == 37 and pipe_row[3] == {"d": "2026-10-12"} and pipe_row[22] == 2400 and pipe_row[1] is True and pipe_row[30] == "Transféré BDD",
          "bridge: Pipe row sent with real dates, numbers and booleans")
    check(len(bdd_row) == 91 and bdd_row[3] == {"d": "2026-10-19"} and bdd_row[33] == "Les Vignes" and bdd_row[24] == "En préparation", "bridge: BDD row sent")
    check("ajoutée" in page.inner_text("#bridge-msg"), "bridge: result shown")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- Réf. & data: clients grouped by company type, collapsed by default, search opens them
    cos = [{"id": f"co{i}", "name": n, "type": t, "whatTheyDo": "", "marketScope": [], "website": "", "createdAt": 1, "updatedAt": 1, "deleted": False}
           for i, (n, t) in enumerate([("Alpha", "Fournisseur"), ("Beta", "Client"), ("Gamma", "Client"), ("Delta", "")])]
    page, errors = new_page(browser, {"todo_todo-widget-clients": json.dumps(["Alpha", "Beta", "Gamma", "Delta"]),
                                      "todo_todo-widget-companies": json.dumps(cos)})
    page.goto(URL); page.click('[data-tab="lists"]')
    heads = page.eval_on_selector_all("#client-list-rows .client-type-head", "els=>els.map(e=>e.textContent)")
    check(heads == ["Client· 2", "Fournisseur· 1", "Sans type· 1"], f"client sections by type {heads}")
    check(page.locator("#client-list-rows .client-list-row:visible").count() == 0, "sections collapsed by default")
    page.locator("#client-list-rows .client-type-head", has_text="Client").click()
    check(page.locator("#client-list-rows .client-list-row:visible").count() == 2, "opening a section shows its clients")
    page.reload(); page.click('[data-tab="lists"]')
    check(page.locator("#client-list-rows .client-list-row:visible").count() == 2, "open sections remembered")
    page.fill("#client-list-search", "alp")
    check(page.locator("#client-list-rows .client-list-row:visible").count() == 1, "search opens matching sections")
    check(not errors, f"no page errors ({errors})")
    page.close()

    # --- XSS: conflict values are shown as text
    conflicts = [{"id": "cf1", "entityType": "task", "entityId": "t1", "entityName": "T", "field": "title", "fieldLabel": "Titre",
                  "localValue": "<img src=x onerror=\"window.__xss=1\">", "remoteValue": "ok", "resolvedValue": "ok"}]
    page, errors = new_page(browser, {"todo_sync-conflicts": json.dumps(conflicts)})
    page.goto(URL); page.click('[data-tab="lists"]')
    check(page.evaluate("window.__xss") is None, "conflict panel doesn't execute HTML")
    page.close()

    # --- Service worker (needs http): GitHub reads are never served from the cache
    import functools, http.server, threading
    root = pathlib.Path(__file__).resolve().parent.parent
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root)))
    srv.RequestHandlerClass.log_message = lambda *a: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    ctx = browser.new_context(service_workers="allow")
    reads = {"n": 0}
    def gh(route, req):
        reads["n"] += 1
        route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"},
                      body=json.dumps({"sha": "s%d" % reads["n"], "encoding": "base64", "content": base64.b64encode(b"[]").decode()}))
    ctx.route("**/api.github.com/**", gh)
    ctx.route("**/fonts.g*/**", lambda r: r.abort())
    page = ctx.new_page(); page.goto("http://127.0.0.1:%d/index.html" % srv.server_address[1])
    page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller", timeout=15000)
    shas = [page.evaluate("fetch('https://api.github.com/repos/o/r/contents/data/tasks.json').then(r=>r.json()).then(d=>d.sha)") for _ in range(3)]
    check(shas == ["s1", "s2", "s3"], f"service worker never serves sync data from its cache ({shas})")
    ctx.close(); srv.shutdown()

    # --- Service worker: a new version of the page shows at the first reload (pages are network first)
    import shutil
    site = pathlib.Path(tempfile.mkdtemp()) / "site"
    shutil.copytree(root, site, ignore=shutil.ignore_patterns(".git", "tests", "__pycache__"))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(site)))
    srv.RequestHandlerClass.log_message = lambda *a: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    ctx = browser.new_context(service_workers="allow")
    ctx.route("**/fonts.g*/**", lambda r: r.abort())
    page = ctx.new_page(); page.goto("http://127.0.0.1:%d/index.html" % srv.server_address[1])
    page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller", timeout=15000)
    html = (site / "index.html").read_text(encoding="utf-8")
    (site / "index.html").write_text(html.replace("</body>", "<div id='new-version-marker'></div></body>"), encoding="utf-8")
    page.reload()
    check(page.locator("#new-version-marker").count() == 1, "a published update shows at the first reload")
    # a new service worker version takes over by itself and the open page reloads once onto it
    sw = (site / "sw.js").read_text(encoding="utf-8")
    (site / "sw.js").write_text(sw.replace("todo-pwa-v", "todo-pwa-test-v"), encoding="utf-8")
    (site / "index.html").write_text(html.replace("</body>", "<div id='second-version-marker'></div></body>"), encoding="utf-8")
    page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
    page.wait_for_selector("#second-version-marker", state="attached", timeout=15000)
    check(page.locator("#second-version-marker").count() == 1, "an open page switches to a newly published version by itself")
    ctx.close(); srv.shutdown()

    browser.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
