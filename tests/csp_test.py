"""The app under the security headers of _headers (Cloudflare Pages), served over HTTP like in production.

Every page and the features that reach outside (Excel reader, PowerPoint export, business-card reading, PowerKlock,
GitHub, the Excel bridge) are run; any request the rules block is a failure. Outside services are faked locally:
the rules check the address, not the answer.
    python tests/csp_test.py
"""
import http.server, json, pathlib, socketserver, tempfile, threading, sys
import openpyxl
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
fails = 0
def check(ok, msg):
    global fails
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: fails += 1

# _headers: "path" lines, then indented "Name: value" lines
rules, cur = {}, None
for line in (ROOT / "_headers").read_text(encoding="utf-8").splitlines():
    if not line.strip() or line.lstrip().startswith("#"): continue
    if not line.startswith((" ", "\t")): cur = line.strip(); rules[cur] = {}
    else:
        k, v = line.strip().split(":", 1); rules[cur][k.strip()] = v.strip()
csp = rules["/*"]["Content-Security-Policy"]

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def end_headers(self):
        for k, v in rules["/*"].items(): self.send_header(k, v)
        if self.path.split("?")[0] in rules:
            for k, v in rules[self.path.split("?")[0]].items(): self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass

srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{port}/"

WATCH = """window.__csp=[]; document.addEventListener('securitypolicyviolation', e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));"""
JS = "application/javascript"
def fake(route):
    u = route.request.url
    if "pptxgen" in u: route.fulfill(status=200, content_type=JS, body="window.PptxGenJS=function(){ this.addSlide=()=>({ addText(){}, addShape(){}, addTable(){}, set background(v){} }); this.writeFile=()=>Promise.resolve(); };")
    elif "tesseract" in u: route.fulfill(status=200, content_type=JS, body="window.Tesseract={ recognize: async()=>({ data:{ text:'Claire Test\\nclaire@test.fr' } }) };")
    elif "exceljs" in u: route.fulfill(status=200, content_type=JS, body="window.ExcelJS={};")
    elif "PowerKlock" in u: route.fulfill(status=200, content_type="text/html", body="<!doctype html><p>PK</p>")
    else: route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body="{}")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1400, "height": 900})
    ctx.add_init_script(WATCH)
    for host in ["https://cdn.jsdelivr.net/**", "https://cdnjs.cloudflare.com/**", "https://tomsremy.github.io/**", "https://api.github.com/**",
                 "http://127.0.0.1:8765/**", "https://tessdata.projectnaptha.com/**", "https://example.org/**"]:
        ctx.route(host, fake)
    ctx.route("**/fonts.g*/**", lambda r: r.abort())
    pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    def wait_for(expr, timeout=10000):   # Playwright's wait_for_function evaluates a string, which these rules forbid: poll instead
        for _ in range(timeout // 100):
            if pg.evaluate(expr): return True
            pg.wait_for_timeout(100)
        raise TimeoutError(expr)
    blocked = lambda: pg.evaluate("window.__csp||[]")

    r = pg.goto(BASE + "index.html"); wait_for("document.querySelector('.tab.active')")
    check(r.headers.get("content-security-policy") == csp and r.headers.get("x-content-type-options") == "nosniff", "the page is served with the rules of _headers")
    check(pg.evaluate("window.TODO_LITE===false && !!window.storage"), "start-up script (js/boot.js) and storage run")
    for tab in ["today", "tasks", "inbox", "archive", "contacts", "pipeline", "parc", "network", "market", "lists"]:
        pg.click(f'[data-tab="{tab}"]'); pg.wait_for_timeout(250)
    check(pg.locator(".mk-frame").count() == 1, "Marché: the PowerKlock dashboard frame is there")
    check(not blocked(), f"every tab opens, nothing blocked ({blocked()})")

    # Excel reader (kept with the app)
    wb = openpyxl.Workbook(); ws = wb.active
    for row in [["", "Centrale 1"], ["Nom Installation", "Les Vignes"], ["Puissance installée (MWc)", 2.4]]: ws.append(row)
    xl = pathlib.Path(tempfile.mkdtemp()) / "c.xlsx"; wb.save(xl)
    pg.click('[data-tab="pipeline"]'); pg.click("#opp-add-btn"); pg.fill("#pq1-company", "SCEA X"); pg.click("#pq-next-btn")
    pg.set_input_files("#pq-file", str(xl)); wait_for("document.getElementById('pq-files-info').textContent.includes('installation')", 20000)
    check(pg.input_value("#pq-0-centrale") == "Les Vignes" and not blocked(), f"Excel reader loads and reads a file ({blocked()})")
    pg.keyboard.press("Escape"); pg.goto(BASE + "index.html"); wait_for("document.querySelector('.tab.active')")

    # business card (Tesseract from cdnjs)
    pg.click('[data-tab="contacts"]'); pg.set_input_files("#card-scan-input", files=[{"name": "c.jpg", "mimeType": "image/jpeg", "buffer": b"x"}]); pg.wait_for_timeout(600)
    check(pg.input_value("#ct-first") == "Claire" and not blocked(), f"business card reader loads ({blocked()})")
    pg.goto(BASE + "index.html"); wait_for("document.querySelector('.tab.active')")

    # outside requests the app makes, one per allowed place; and one the rules must stop (proof they are on)
    res = pg.evaluate("""async()=>{ const out={}; for(const u of ['https://api.github.com/repos/x/y','http://127.0.0.1:8765/status','https://tomsremy.github.io/PowerKlock/data/prices.json','https://tessdata.projectnaptha.com/x','https://example.org/x']){
        try{ await fetch(u); out[u]='ok'; }catch(e){ out[u]='blocked'; } } return out; }""")
    check(all(v == "ok" for k, v in res.items() if "example.org" not in k) and res["https://example.org/x"] == "blocked", f"GitHub, bridge, PowerKlock reachable; anything else refused ({res})")
    check(any("example.org" in x for x in blocked()) and all("example.org" in x for x in blocked()), f"only the unknown address was blocked ({blocked()})")
    pg.evaluate("window.__csp=[]")
    # an injected inline script or handler does not run
    ran = pg.evaluate("""()=>{ window.__x=0; const d=document.createElement('div'); d.innerHTML='<img src=x onerror=\"window.__x=1\">'; document.body.appendChild(d);
        const s=document.createElement('script'); s.textContent='window.__x=2'; document.body.appendChild(s); return new Promise(r=>setTimeout(()=>r(window.__x),300)); }""")
    check(ran == 0, f"an injected script or event handler is refused ({ran})")
    pg.evaluate("window.__csp=[]")

    # PowerPoint export (jsdelivr) from the meeting view
    seed = [{"id": f"m{i}", "kind": "installation", "company": f"SOC {i}", "centrale": f"C{i}", "title": f"C{i}", "stage": "collecte", "kwc": "500", "createdAt": 1, "updatedAt": 1, "deleted": False} for i in range(3)]
    pg.evaluate("s=>{ localStorage.setItem('todo_todo-widget-opportunities', s); }", json.dumps(seed)); pg.reload(); wait_for("document.querySelector('.tab.active')")
    pg.click('[data-tab="pipeline"]'); pg.click("#pipe-meet-toggle"); pg.click(".meet-present-btn"); pg.click("#present-overlay .ps-pptx")
    wait_for("document.querySelector('#present-overlay .ps-pptx').textContent!=='Préparation…' && document.querySelector('#present-overlay .ps-pptx').textContent!=='PowerPoint'")
    check(pg.inner_text("#present-overlay .ps-pptx") == "Téléchargé ✓" and not blocked(), f"PowerPoint export loads and runs ({pg.inner_text('#present-overlay .ps-pptx')!r}, {blocked()})")

    # the other pages: phone version, widget, mobile.html, share target
    for path, test in [("index.html?lite", "window.TODO_LITE===true"), ("index.html?widget", "window.TODO_WIDGET===true"), ("mobile.html", "location.search.includes('lite')"), ("widget.html", "location.search.includes('widget')")]:
        pg.goto(BASE + path); pg.wait_for_timeout(700)
        check(pg.evaluate(test) and not blocked(), f"{path} opens ({blocked()})")
    pg.goto(BASE + "share-target.html?title=Rappeler%20Paul"); pg.wait_for_timeout(1500)
    check("index.html" in pg.url and not blocked(), f"share target adds and goes back to the app ({pg.url}, {blocked()})")
    check(not errors, f"no page errors ({errors})")
    b.close()
srv.shutdown()
print(f"\n{fails} failure(s)")
sys.exit(1 if fails else 0)
