"""Contacts équipe in an Excel file (team mode « Excel », the default) : the bridge is stubbed with the same writing
rules as the real one (an empty cell filled, a cell still holding what the app wrote replaced, a colleague's cell kept and
reported, « replace » forced). Checks: a row typed by hand in Excel arrives, a contact of mine goes out, a colleague's
change comes in, both changed → asked, a private contact never goes, Supabase stays asleep.
    python tests/team_excel_test.py
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
failures = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: failures.append(m)
URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
H = ["Prénom", "Nom", "Société", "Fonction", "Email", "Téléphone", "Téléphone 2", "Commentaire", "ID", "Modifié le", "Modifié par"]
sheet = [H, ["Claire", "Martin", "Solaris", "", "c.martin@solaris.fr", "", "", "", "", "", ""]]
state = {"upserts": 0, "supabase": 0}
def norm(v): return "" if v is None else str(v).strip()

def upsert(rows):
    out = []
    for r in rows:
        v, prev, force, seen = r["values"], r.get("prev") or [], r.get("force") or {}, r.get("seen") or {}
        line = next((x for x in sheet[1:] if norm(x[0]).lower() == norm(v[0]).lower() and norm(x[1]).lower() == norm(v[1]).lower()), None)
        action = "mise à jour"
        if line is None: line = [""] * len(H); sheet.append(line); action = "ajoutée"
        mine, conflicts = [], []
        for i, val in enumerate(v):
            if val in (None, ""): continue
            e = norm(line[i])
            if e == "" or e == norm(val): line[i] = val; mine.append(i); continue
            f = force.get(str(i)); s = seen.get(str(i))
            if f == "replace" and (s is None or norm(s) == e): line[i] = val; mine.append(i); continue
            p = norm(prev[i]) if i < len(prev) else None
            if p is not None and p == e: line[i] = val; mine.append(i); continue
            conflicts.append({"i": i, "header": H[i], "excel": e, "app": norm(val)})
        out.append({"ok": True, "action": action, "mine": mine, "conflicts": conflicts})
    return out

def bridge(route):
    req = route.request; path = req.url.split("8765", 1)[1]
    body = json.loads(req.post_data or "null") if req.method == "POST" else None
    h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    if req.method == "OPTIONS": return route.fulfill(status=204, headers={**h, "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Token"})
    if path == "/status": out = {"ok": True, "version": "1.34", "authorized": True, "who": "Tom", "pipe": {"name": "Pipe.xlsx", "found": True}, "bdd": {"name": "Suivi.xlsx", "found": True}, "contacts": {"name": "Contacts équipe.xlsx", "found": True}}
    elif path == "/contacts/read": out = {"ok": True, "sheets": {"Contacts": sheet}}
    elif path == "/contacts/upsert": state["upserts"] += 1; out = {"ok": True, "results": upsert(body["rows"])}
    elif path == "/backup/write": out = {"ok": True, "dir": "C:\\x", "file": {"name": "todo.json", "size": 1}}
    else: out = {"ok": True}
    route.fulfill(status=200, headers=h, body=json.dumps(out))

def ct(i, first, last, **kw): return {"id": i, "firstName": first, "lastName": last, "company": kw.pop("company", ""), "createdAt": 1, "updatedAt": 1, "deleted": False, **kw}
local = [ct("c1", "Paul", "Durand", company="Ventus", phone1="0611"), ct("c2", "Secret", "Privé", private=True), ct("c3", "Claire", "Martin", company="Solaris", role="Directrice")]

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1300, "height": 850}, bypass_csp=True); err = []
    pg.on("pageerror", lambda e: err.append(str(e)))
    pg.route("**/fonts.g*/**", lambda r: r.abort()); pg.route("https://tomsremy.github.io/PowerKlock/**", lambda r: r.abort())
    pg.route("http://127.0.0.1:8765/**", bridge)
    pg.route("**/supabase.co/**", lambda r: (state.__setitem__("supabase", state["supabase"] + 1), r.abort()))
    pg.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-contacts', %s); localStorage.setItem('todo_bridge-config', JSON.stringify({ port:8765, token:'k' })); localStorage.setItem('local-backup-at', String(Date.now())); sessionStorage.setItem('s','1'); } }catch(e){}"
                       % json.dumps(json.dumps(local)))
    pg.goto(URL); pg.wait_for_timeout(3500)
    contacts = lambda: {c["id"]: c for c in json.loads(pg.evaluate("window.storage.peek('todo-widget-contacts')")) if not c.get("deleted")}
    pg.click('[data-tab="lists"]'); pg.wait_for_timeout(500)
    check(pg.is_checked("input[name='team-mode'][value='excel']") and not pg.is_visible("#team-section"), "the team mode is « Excel » by default, the Supabase settings hidden")
    pg.click("#xc-sync-btn"); pg.wait_for_timeout(1500)
    rows = {(r[0], r[1]): r for r in sheet[1:]}
    check(("Paul", "Durand") in rows and rows[("Paul", "Durand")][5] == "0611" and rows[("Paul", "Durand")][8] == "c1" and rows[("Paul", "Durand")][10] == "Tom",
          f"a shared contact of mine goes to the file, with its ID, signed ({rows.get(('Paul', 'Durand'))})")
    check(("Secret", "Privé") not in rows, "a private contact never goes to the file")
    check(rows[("Claire", "Martin")][3] == "Directrice" and rows[("Claire", "Martin")][8] == "c3", "a row typed by hand in Excel is matched by name : my role fills its empty cell, my ID too")
    # a colleague types a new row, and changes Paul's phone, in Excel
    sheet.append(["Léa", "Bernard", "Hélio", "", "", "0700", "", "", "", "12/11/2026", "Marie"])
    rows[("Paul", "Durand")][5] = "0699"; rows[("Paul", "Durand")][10] = "Marie"
    pg.click("#xc-sync-btn"); pg.wait_for_timeout(1500)
    cs = contacts(); lea = [c for c in cs.values() if c.get("firstName") == "Léa"]
    check(len(lea) == 1 and lea[0].get("phone1") == "0700" and lea[0].get("company") == "Hélio", f"a row added in Excel by a colleague arrives as a contact ({lea})")
    check(cs["c1"].get("phone1") == "0699", f"a colleague's change in Excel comes in ({cs['c1'].get('phone1')})")
    # both change the same field : asked
    rows[("Paul", "Durand")][7] = "Rappeler mardi"; rows[("Paul", "Durand")][10] = "Marie"
    pg.evaluate("(()=>{ const all=JSON.parse(window.storage.peek('todo-widget-contacts')); const c=all.find(x=>x.id==='c1'); c.comment='Vu au salon'; window.storage.set('todo-widget-contacts', JSON.stringify(all)); })()")
    pg.reload(); pg.wait_for_timeout(3500); pg.click('[data-tab="lists"]'); pg.wait_for_timeout(300)
    pg.click("#xc-sync-btn"); pg.wait_for_timeout(1200)
    ask = pg.inner_text("#choice-overlay") if pg.is_visible("#choice-overlay") else ""
    check("Paul Durand" in ask and "Rappeler mardi" in ask and "Vu au salon" in ask and "Marie" in ask, f"the same field changed in Excel and here : asked, with who changed it ({ask!r})")
    pg.click("#choice-btns button:has-text('Garder la mienne')"); pg.wait_for_timeout(1200)
    check(rows[("Paul", "Durand")][7] == "Vu au salon" and contacts()["c1"].get("comment") == "Vu au salon", "« Garder la mienne » writes mine in the file")
    n = state["upserts"]; pg.click("#xc-sync-btn"); pg.wait_for_timeout(1200)
    check(state["upserts"] == n, f"nothing changed since : nothing sent ({state['upserts'] - n} call(s))")
    check(state["supabase"] == 0, "Supabase stays asleep in Excel mode")
    check(not err, f"no page errors ({err})")
    b.close()
print(f"\n{len(failures)} failure(s)"); sys.exit(1 if failures else 0)
