"""ToDo in local mode: the Excel bridge serves the app from the PC (bridge/ToDo-local.bat, http://127.0.0.1:<port>/app/).

Checks what the IT department is promised: only the app's own files are served (never the bridge, the tests or anything
else on the disk), the page gets the bridge's strict rules (this PC, the GitHub API and PowerKlock's public data, nothing
else), nothing loads from the Internet, the bridge's key reaches the app without copying it, and the app works.
    python tests/local_mode_test.py
Needs PowerShell (pwsh); skipped (exit 0) when it is absent.
"""
import http.client, json, os, pathlib, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
if not PWSH:
    print("PowerShell absent: skipped"); sys.exit(0)
fails = []
def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

# a copy of the app as it is downloaded (the bridge serves the folder above bridge\), plus files that must never be served
app = pathlib.Path(tempfile.mkdtemp()) / "ToDo"
shutil.copytree(ROOT, app, ignore=shutil.ignore_patterns(".git", ".agents", ".claude", "__pycache__", "node_modules"))
(app / "secret.txt").write_text("not for the browser", encoding="utf-8")
with socket.socket() as s_:
    s_.bind(("127.0.0.1", 0)); PORT = s_.getsockname()[1]
log = open(app / "bridge.log", "wb")
proc = subprocess.Popen([PWSH, "-NoProfile", "-File", str(app / "bridge" / "pont-excel.ps1"), "-Mock", "-Port", str(PORT)], cwd=app / "bridge", stdout=log, stderr=subprocess.STDOUT)

def raw(method, path, host=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=30)
    h = dict(headers or {}); h["Host"] = host or f"127.0.0.1:{PORT}"
    c.request(method, path, headers=h); r = c.getresponse(); body = r.read(); c.close()
    return r.status, {k.lower(): v for k, v in r.getheaders()}, body
for _ in range(80):
    try: raw("GET", "/status"); break
    except Exception: time.sleep(0.5)

try:
    # ---- what the bridge serves, and what it refuses
    st, h, _ = raw("GET", "/")
    check(st == 302 and h.get("location") == "/app/", f"/ sends to /app/ ({st}, {h.get('location')})")
    st, h, body = raw("GET", "/app/")
    page_csp = h.get("content-security-policy", "")
    check(st == 200 and h.get("content-type", "").startswith("text/html") and b'name="todo-local"' in body, f"/app/ is the app, marked local ({st})")
    check(b'content="mocktoken"' in body and b"cdnjs.cloudflare.com" not in body and b"anthropic" not in body.split(b"<body")[0],
          "the page carries the bridge's key and the local rules instead of the web ones")
    for d in ["script-src 'self' 'wasm-unsafe-eval';", "connect-src 'self' http://127.0.0.1:", "https://api.github.com https://tomsremy.github.io data: blob:;", "img-src 'self' data: blob:;"]:
        check(d in page_csp, f"local rules: {d}")
    for bad in ["cdnjs", "jsdelivr", "anthropic", "supabase", "tessdata", "https: "]:
        check(bad not in page_csp, f"local rules: nothing from {bad}")
    check(h.get("x-content-type-options") == "nosniff" and h.get("referrer-policy") == "no-referrer", "security headers on every file")
    for path in ["/app/js/app.js", "/app/vendor/exceljs-4.4.0.min.js", "/app/vendor/pptxgenjs-3.12.0.bundle.js", "/app/icons/icon-192.png", "/app/sw.js", "/app/manifest.json", "/app/index.html?lite"]:
        st, h, _ = raw("GET", path)
        check(st == 200, f"served: {path} ({st}, {h.get('content-type')})")
    for path in ["/app/bridge/pont-excel.ps1", "/app/tests/local_mode_test.py", "/app/secret.txt", "/app/../secret.txt", "/app/%2e%2e/secret.txt",
                 "/app/js/../bridge/pont-excel.ps1", "/app/js%2f..%2fbridge%2fpont-excel.ps1", "/app/supabase/schema.sql", "/app/README.md", "/app/.git/config", "/app/bridge.log"]:
        st, _, body = raw("GET", path)
        check(st == 404 and b"not for the browser" not in body and b"param(" not in body, f"refused: {path} ({st})")
    st, _, body = raw("GET", "/app/", host="evil.example:%d" % PORT)
    check(st == 404 and b"mocktoken" not in body, f"another host name (DNS rebinding) gets nothing ({st})")
    st, h, _ = raw("GET", "/status", headers={"Origin": f"http://127.0.0.1:{PORT}"})
    check(st == 200 and h.get("access-control-allow-origin") == f"http://127.0.0.1:{PORT}", "the local page's address is allowed by the bridge")
    st, h, _ = raw("GET", "/status", headers={"Origin": "https://evil.example"})
    check(st == 403, f"any other site is still refused by the bridge ({st})")

    # ---- the app in a browser, at its local address
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1400, "height": 900})
        ctx.add_init_script("window.__csp=[]; document.addEventListener('securitypolicyviolation', e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI+' '+(e.sourceFile||'')+':'+e.lineNumber+' '+(e.sample||'')));")
        outside = []
        def note(req):
            if not req.url.startswith(f"http://127.0.0.1:{PORT}/") and not req.url.startswith(("data:", "blob:")): outside.append(req.url)
        ctx.on("request", note)
        ctx.route("https://api.github.com/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body="{}"))
        ctx.route("https://tomsremy.github.io/**", lambda r: r.fulfill(status=200, content_type="text/html", headers={"access-control-allow-origin": "*"}, body="<!doctype html><p>PK</p>"))
        ctx.route("**/vendor/pptxgenjs-*.js", lambda r: r.fulfill(status=200, content_type="application/javascript",
                  body="window.PptxGenJS=function(){ this.addSlide=()=>({ addText(){}, addShape(){}, addTable(){}, set background(v){} }); this.writeFile=()=>Promise.resolve(); };"))
        pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        def wait_for(expr, timeout=15000):
            for _ in range(timeout // 100):
                if pg.evaluate(expr): return True
                pg.wait_for_timeout(100)
            raise TimeoutError(expr)
        blocked = lambda: pg.evaluate("window.__csp||[]")
        pg.goto(f"http://127.0.0.1:{PORT}/app/"); wait_for("document.querySelector('.tab.active')")
        check(pg.evaluate("window.TODO_LOCAL===true && document.documentElement.classList.contains('local')"), "the app knows it runs locally")
        cfg = pg.evaluate("JSON.parse(localStorage.getItem('todo_bridge-config')||'{}')")
        check(cfg.get("token") == "mocktoken" and cfg.get("port") == PORT, f"the bridge's key and port are set without copying them ({cfg})")
        for tab in ["today", "tasks", "inbox", "archive", "contacts", "pipeline", "parc", "network", "market", "lists"]:
            pg.click(f'[data-tab="{tab}"]'); pg.wait_for_timeout(250)
        check(not blocked(), f"every tab opens, nothing blocked ({blocked()})")
        st = pg.evaluate(f"fetch('http://127.0.0.1:{PORT}/status',{{headers:{{'X-Bridge-Token':'mocktoken'}}}}).then(r=>r.json())")
        check(st.get("authorized") is True, "the app reaches the bridge with its key")
        pg.click('[data-tab="contacts"]')
        check(not pg.is_visible("#card-scan-btn") and not pg.is_visible("#ai-section"), "features that need the Internet are hidden (card reading, Claude)")
        hidden_sb = pg.evaluate("(()=>{ const i=document.querySelector('input[name=team-mode][value=supabase]'); return !i || getComputedStyle(i.closest('.tm-opt')).display==='none'; })()")
        check(hidden_sb, "the Supabase team option is hidden")
        res = pg.evaluate("""async()=>{ const out={}; for(const u of ['https://api.github.com/repos/x/y','https://tomsremy.github.io/PowerKlock/data/prices.json','https://example.org/x','https://cdnjs.cloudflare.com/x.js','https://api.anthropic.com/v1/messages','https://abc.supabase.co/rest/v1/x']){
            try{ await fetch(u); out[u]='ok'; }catch(e){ out[u]='blocked'; } } return out; }""")
        allowed = ("api.github.com", "tomsremy.github.io")
        check(all((v == "ok") == any(a in k for a in allowed) for k, v in res.items()), f"only GitHub and PowerKlock are reachable from the page ({res})")
        pg.evaluate("window.__csp=[]")
        # an outside script cannot be loaded, even by the app's own loader
        r = pg.evaluate("""()=>new Promise(res=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js';
            s.onload=()=>res('loaded'); s.onerror=()=>res('refused'); document.head.appendChild(s); })""")
        check(r == "refused", f"a script from a CDN is refused ({r})")
        pg.evaluate("window.__csp=[]")
        # PowerPoint export: the library kept with the app
        seed = [{"id": f"m{i}", "kind": "installation", "company": f"SOC {i}", "centrale": f"C{i}", "title": f"C{i}", "stage": "collecte", "kwc": "500", "createdAt": 1, "updatedAt": 1, "deleted": False} for i in range(3)]
        pg.evaluate("s=>{ localStorage.setItem('todo_todo-widget-opportunities', s); }", json.dumps(seed)); pg.reload(); wait_for("document.querySelector('.tab.active')")
        pg.click('[data-tab="pipeline"]'); pg.click("#pipe-meet-toggle"); pg.click(".meet-present-btn"); pg.click("#present-overlay .ps-pptx")
        wait_for("document.querySelector('#present-overlay .ps-pptx').textContent!=='Préparation…' && document.querySelector('#present-overlay .ps-pptx').textContent!=='PowerPoint'")
        check(pg.inner_text("#present-overlay .ps-pptx") == "Téléchargé ✓" and not blocked(), f"PowerPoint export works from the local library ({pg.inner_text('#present-overlay .ps-pptx')!r}, {blocked()})")
        pg.keyboard.press("Escape")
        # phone version and widget, same address
        for path, test in [("index.html?lite", "window.TODO_LITE===true"), ("mobile.html", "location.search.includes('lite')"), ("index.html?widget", "window.TODO_WIDGET===true")]:
            pg.goto(f"http://127.0.0.1:{PORT}/app/{path}"); pg.wait_for_timeout(800)
            check(pg.evaluate(test) and pg.evaluate("window.TODO_LOCAL===true") and not blocked(), f"{path} opens locally ({blocked()})")
        unexpected = [u for u in outside if not any(a in u for a in allowed + ("example.org", "cdnjs.cloudflare.com", "anthropic", "supabase.co"))]
        check(not unexpected, f"no request to the Internet besides the ones above ({unexpected[:5]})")
        check(not errors, f"no page errors ({errors})")
        b.close()
finally:
    proc.terminate()
    try: proc.wait(10)
    except Exception: proc.kill()
    log.close()
    if fails: print((app / "bridge.log").read_text(encoding="utf-8", errors="replace")[-3000:])
print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
