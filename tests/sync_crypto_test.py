"""The GitHub sync encrypted on the device: GitHub only ever holds ciphertext, another device opens it with the passphrase
or with the recovery code (the « kit de secours »), a wrong secret opens nothing, a locked device never overwrites the data.
    python tests/sync_crypto_test.py
"""
import base64, json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
failures = []
def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond: failures.append(msg)

SECRET_TITLE = "Négocier le contrat SECRET-42"
files = {"tasks.json": [{"id": "t1", "title": SECRET_TITLE, "status": "a_faire", "urgency": "haute", "createdAt": 1, "updatedAt": 1, "deleted": False, "archived": False}]}
puts = []
def handler(route, request):
    name = request.url.split("?")[0].rsplit("/", 1)[-1]
    if request.method == "GET":
        if name not in files: return route.fulfill(status=404, body="{}")
        if "raw" in request.headers.get("accept", ""): return route.fulfill(status=200, body=json.dumps(files[name]))
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"sha": "sha-" + name, "encoding": "base64", "content": base64.b64encode(json.dumps(files[name]).encode()).decode()}))
    puts.append(name)
    files[name] = json.loads(base64.b64decode(json.loads(request.post_data)["content"]).decode())
    route.fulfill(status=200, content_type="application/json", body=json.dumps({"content": {"sha": "s%d" % len(puts)}}))
SYNC_ON = {"todo_sync-config": json.dumps({"owner": "o", "repo": "r", "token": "t", "enabled": True})}

def device(browser, seed):
    page = browser.new_page(viewport={"width": 1300, "height": 900}, bypass_csp=True); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    for u in ("**/fonts.g*/**", "https://tomsremy.github.io/**", "http://127.0.0.1:8765/**"): page.route(u, lambda r: r.abort())
    page.route("**/api.github.com/repos/o/r", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"private": True})))
    page.route("**/api.github.com/repos/o/r/contents/data/*", handler)
    page.add_init_script("try{ if(!sessionStorage.getItem('s')){ for (const [k,v] of Object.entries(%s)) localStorage.setItem(k,v); sessionStorage.setItem('s','1'); } }catch(e){}" % json.dumps(seed))
    page.goto(URL); page.wait_for_timeout(2500)
    return page, errors
def tasks_of(page): return json.loads(page.evaluate("window.storage.peek('todo-widget-tasks')") or "[]")

with sync_playwright() as p:
    b = p.chromium.launch()
    # device A : turns the encryption on
    a, ea = device(b, SYNC_ON)
    a.click('[data-tab="lists"]'); a.wait_for_timeout(300)
    check(a.is_visible("#sync-crypt-btn"), "Réglages offers to encrypt the sync")
    a.click("#sync-crypt-btn"); a.fill("#sync-crypt-pass", "court"); a.fill("#sync-crypt-pass2", "court"); a.click("#sync-crypt-go"); a.wait_for_timeout(300)
    check("12 caractères" in a.inner_text("#sync-crypt-status"), "a short passphrase is refused")
    a.click("#sync-crypt-btn"); a.fill("#sync-crypt-pass", "ma phrase secrète très longue"); a.fill("#sync-crypt-pass2", "ma phrase secrète très longue"); a.click("#sync-crypt-go")
    a.wait_for_selector("#sync-crypt-kit:not([hidden])", timeout=20000); a.wait_for_timeout(5000)
    code = a.inner_text("#sync-crypt-code").strip()
    check(len(code.replace("-", "")) == 25, f"a recovery code is shown ({code})")
    with a.expect_download() as dl: a.click("#sync-crypt-dl")
    check(dl.value.suggested_filename == "kit-de-secours-todo.txt", "the recovery kit downloads")
    dump = json.dumps(files)
    check("keyring.json" in files and "pass" in files["keyring.json"] and "recovery" in files["keyring.json"], "GitHub holds the keyring (the data key, wrapped twice)")
    check(isinstance(files["tasks.json"], dict) and files["tasks.json"].get("enc") == "todo-aesgcm-1", "tasks.json on GitHub is now ciphertext")
    check(SECRET_TITLE not in dump and "SECRET-42" not in dump, "nothing in clear on GitHub")
    check(not ea, f"no page errors ({ea})"); a.close()

    # device B : no key -> locked, writes nothing ; the passphrase opens it
    n_puts = len(puts)
    bb, eb = device(b, SYNC_ON)
    bb.click('[data-tab="lists"]'); bb.wait_for_timeout(400)
    check(bb.is_visible("#sync-crypt-unlock") and "déverrouille" in bb.inner_text("#sync-crypt-text").lower(), "another device without the key : locked, asks the secret")
    check(len(puts) == n_puts, "a locked device writes nothing to GitHub")
    bb.fill("#sync-crypt-pass", "pas la bonne phrase"); bb.click("#sync-crypt-go"); bb.wait_for_timeout(3000)
    check("incorrect" in bb.inner_text("#sync-crypt-status"), "a wrong secret opens nothing")
    bb.fill("#sync-crypt-pass", "ma phrase secrète très longue"); bb.click("#sync-crypt-go"); bb.wait_for_timeout(5000)
    check(any(t["title"] == SECRET_TITLE for t in tasks_of(bb)), "the passphrase unlocks : the tasks come in")
    check(not eb, f"no page errors ({eb})"); bb.close()

    # device C : the recovery code alone (passphrase forgotten)
    c, ec = device(b, SYNC_ON)
    c.click('[data-tab="lists"]'); c.wait_for_timeout(400)
    c.fill("#sync-crypt-pass", code.lower().replace("-", " ")); c.click("#sync-crypt-go"); c.wait_for_timeout(5000)
    check(any(t["title"] == SECRET_TITLE for t in tasks_of(c)), "the recovery code unlocks too (typed in lower case, with spaces)")
    check(not ec, f"no page errors ({ec})"); c.close()
    b.close()
print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
