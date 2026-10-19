"""Smoke tests for index.html, run in a real headless Chromium.

    pip install playwright && python -m playwright install --with-deps chromium
    python tests/smoke_test.py

GitHub is mocked (no network, no real token); Google Fonts is blocked so the
tests don't depend on the network either.
"""
import base64
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


def mock_github(page, files, put_ok=True):
    """files: {'tasks.json': [...], ...} — server state, updated on successful PUTs."""
    state = {"puts": 0}

    def handler(route, request):
        name = request.url.rsplit("/", 1)[-1]
        if name not in files:
            return route.fulfill(status=404, body="{}")
        if request.method == "GET":
            body = {"sha": "sha-" + name, "content": base64.b64encode(json.dumps(files[name]).encode()).decode()}
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
    page.wait_for_timeout(800)
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

    # --- XSS: conflict values are shown as text
    conflicts = [{"id": "cf1", "entityType": "task", "entityId": "t1", "entityName": "T", "field": "title", "fieldLabel": "Titre",
                  "localValue": "<img src=x onerror=\"window.__xss=1\">", "remoteValue": "ok", "resolvedValue": "ok"}]
    page, errors = new_page(browser, {"todo_sync-conflicts": json.dumps(conflicts)})
    page.goto(URL); page.click('[data-tab="lists"]')
    check(page.evaluate("window.__xss") is None, "conflict panel doesn't execute HTML")
    page.close()

    browser.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
