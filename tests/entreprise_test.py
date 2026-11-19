"""ToDo Entreprise: the company package (profil.json « edition » : « entreprise »), served by the bridge from the PC.

What the company is promised: the page reaches this PC and nothing else (no GitHub, no PowerKlock unless the profile
turns Marché on, no CDN), the web addresses of ToDo cannot use the company bridge, GitHub sync and Marché are gone from
the screens, the bridge's own copies are not written into the shared app folder, the profile's internal domains apply.
    python tests/entreprise_test.py
Needs PowerShell (pwsh); skipped (exit 0) when it is absent.
"""
import http.client, json, os, pathlib, shutil, socket, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
if not PWSH:
    print("PowerShell absent: skipped"); sys.exit(0)
fails = []
def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

def start(profile):
    app = pathlib.Path(tempfile.mkdtemp()) / "ToDo"
    shutil.copytree(ROOT, app, ignore=shutil.ignore_patterns(".git", ".agents", ".claude", "__pycache__", "node_modules", "tests"))
    (app / "profil.json").write_text(json.dumps(profile), encoding="utf-8")
    with socket.socket() as s_:
        s_.bind(("127.0.0.1", 0)); port = s_.getsockname()[1]
    log = open(app / "bridge.log", "wb")
    proc = subprocess.Popen([PWSH, "-NoProfile", "-File", str(app / "bridge" / "pont-excel.ps1"), "-Mock", "-Port", str(port)], cwd=app / "bridge", stdout=log, stderr=subprocess.STDOUT)
    for _ in range(80):
        try: raw(port, "GET", "/status"); break
        except Exception: time.sleep(0.5)
    return app, port, proc, log

def raw(port, method, path, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
    h = dict(headers or {}); h.setdefault("Host", f"127.0.0.1:{port}")
    c.request(method, path, headers=h); r = c.getresponse(); body = r.read(); c.close()
    return r.status, {k.lower(): v for k, v in r.getheaders()}, body

def stop(proc, log):
    proc.terminate()
    try: proc.wait(10)
    except Exception: proc.kill()
    log.close()

PROFILE = {"edition": "entreprise", "nom": "ToDo Entreprise", "marche": False, "sauvegardeMinutes": 60, "domainesInternes": ["interne.test"]}
app, PORT, proc, log = start(PROFILE)
try:
    st, h, body = raw(PORT, "GET", "/app/")
    csp = h.get("content-security-policy", "")
    check(st == 200 and b'name="todo-profile"' in body, f"the page carries the company profile ({st})")
    check("connect-src 'self' http://127.0.0.1:" in csp and "github" not in csp and "frame-src 'none'" in csp and "https:" not in csp,
          f"company rules: this PC only, no GitHub, no frame ({csp})")
    for origin in ["https://tomsremy.github.io", "https://todo-tom.pages.dev", "http://localhost:8000"]:
        st, _, _ = raw(PORT, "GET", "/status", headers={"Origin": origin})
        check(st == 403, f"the web version cannot use the company bridge: {origin} ({st})")
    st, h, _ = raw(PORT, "GET", "/status", headers={"Origin": f"http://127.0.0.1:{PORT}"})
    check(st == 200 and h.get("access-control-allow-origin") == f"http://127.0.0.1:{PORT}", "the local page can")

    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1400, "height": 900})
        outside = []
        ctx.on("request", lambda r: outside.append(r.url) if not r.url.startswith((f"http://127.0.0.1:{PORT}/", "data:", "blob:")) else None)
        pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        def wait_for(expr, timeout=15000):
            for _ in range(timeout // 100):
                if pg.evaluate(expr): return True
                pg.wait_for_timeout(100)
            raise TimeoutError(expr)
        # a browser that had GitHub sync set up elsewhere on this address : ignored in the company edition
        pg.goto(f"http://127.0.0.1:{PORT}/app/"); wait_for("document.querySelector('.tab.active')")
        check(pg.evaluate("window.TODO_EDITION==='entreprise' && document.documentElement.classList.contains('entreprise')"), "the app knows it is the company edition")
        check(not pg.is_visible('[data-tab="market"]'), "Marché is not offered")
        for tab in ["today", "tasks", "inbox", "archive", "contacts", "pipeline", "parc", "network", "lists"]:
            pg.click(f'[data-tab="{tab}"]'); pg.wait_for_timeout(250)
        pg.evaluate("window.gsTab && window.gsTab('market')"); pg.wait_for_timeout(500)
        check(pg.evaluate("document.getElementById('sync-section') && getComputedStyle(document.getElementById('sync-section')).display==='none'"), "GitHub sync is gone from the settings")
        res = pg.evaluate("""async()=>{ const out={}; for(const u of ['https://api.github.com/repos/x/y','https://tomsremy.github.io/PowerKlock/data/prices.json','https://example.org/x']){
            try{ await fetch(u); out[u]='ok'; }catch(e){ out[u]='blocked'; } } return out; }""")
        check(all(v == "blocked" for v in res.values()), f"GitHub, PowerKlock and anything else are refused ({res})")
        check(pg.evaluate("window.TodoParse.pqIsInternal('a@interne.test') && !window.TodoParse.pqIsInternal('a@selfee.fr')"), "the profile's internal domain is known")
        made = [u for u in outside if "example.org" not in u and "api.github.com/repos/x" not in u and "prices.json" not in u]
        check(not made, f"the app itself sends no request outside this PC ({made[:5]})")
        st = pg.evaluate(f"fetch('http://127.0.0.1:{PORT}/status',{{headers:{{'X-Bridge-Token':'mocktoken'}}}}).then(r=>r.json())")
        check(st.get("authorized") is True, "the app reaches the bridge with its key")
        check(not errors, f"no page errors ({errors})")
        b.close()
finally:
    stop(proc, log)
    if fails: print((app / "bridge.log").read_text(encoding="utf-8", errors="replace")[-3000:])

# Marché turned on by the profile : PowerKlock's public prices only, still no GitHub
app2, PORT2, proc2, log2 = start(dict(PROFILE, marche=True))
try:
    st, h, _ = raw(PORT2, "GET", "/app/")
    csp = h.get("content-security-policy", "")
    check("https://tomsremy.github.io" in csp and "github.com" not in csp.replace("tomsremy.github.io", "") and "frame-src https://tomsremy.github.io" in csp,
          f"« marche » : true adds PowerKlock, nothing else ({csp})")
finally:
    stop(proc2, log2)
print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
