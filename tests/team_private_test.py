"""A private contact never reaches the team base (Supabase is replaced by a recorder in the page).

Checks: a shared contact is pushed, a private one is not; a contact made private is removed from the team base;
the team base does not overwrite my private copy; a contact a colleague made private disappears here; the lock
in the Contacts list switches it; the « Privés » filter.
    python tests/team_private_test.py
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
failures = []
def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond: failures.append(msg)

def ct(i, first, private=False, upd=1000):
    return {"id": i, "firstName": first, "lastName": "Test", "company": "", "createdAt": 1, "updatedAt": upd, "deleted": False, **({"private": True} if private else {})}

local = [ct("c1", "Alice"), ct("c2", "Bob", private=True), ct("c3", "Chloé")]
# what the team base holds: c2 (from before it was made private, newer), c3, and c9 (seen before, now gone: c4 a colleague made private)
server = {"contacts": [ct("c2", "Bob-serveur", upd=9000), ct("c3", "Chloé")]}
STUB = """
window.__team = { pushed: [], removed: [], server: %s };
window.TodoTeam = {
  init: async()=>{}, loadConfig: async()=>({ url:'x', anonKey:'y' }), saveConfig: async()=>{}, isConfigured: ()=>true, isSignedIn: ()=>true,
  currentUser: ()=>({ email:'t@x' }), signIn: async()=>{}, signOut: async()=>{},
  pullAll: async t=>JSON.parse(JSON.stringify(window.__team.server[t]||[])),
  pushItem: async (t, it)=>{ window.__team.pushed.push([t, it.id]); (window.__team.last=window.__team.last||{})[it.id]=JSON.parse(JSON.stringify(it)); return true; },
  getItem: async (t, id)=>{ const now=(window.__team.now||{})[id]; if(now) return JSON.parse(JSON.stringify(now)); const r=(window.__team.server[t]||[]).find(x=>x.id===id); return r ? JSON.parse(JSON.stringify(r)) : null; },
  removeItem: async (t, id)=>{ window.__team.removed.push([t, id]); return (window.__team.refuse||[]).includes(id) ? 'refused' : 'deleted'; },
  teamErrors: async ()=>[{ at:'2026-11-11T10:00:00Z', where_:'synchro', message:'Échec réseau', who:'Paul' }, { at:'2026-11-11T09:00:00Z', where_:'synchro', message:'Échec réseau', who:'Paul' }, { at:'2026-11-10T09:00:00Z', where_:'page', message:'x is undefined', who:'Toi' }],
  history: async (t, id)=>[{ field:'phone1', old_value:'0600', new_value:'0611', who:'Paul', changed_at:'2026-11-10T13:32:00Z' }, { field:'(création)', who:'Toi', changed_at:'2026-11-01T09:00:00Z' }],
    subscribe: (t, fn)=>{ (window.__subs=window.__subs||{})[t]=fn; return ()=>{}; }, migrateFromLocal: async()=>({})
};
Object.defineProperty(window, 'TodoTeam', { value: window.TodoTeam, writable: false });
""" % json.dumps(server)

with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page(viewport={"width": 1300, "height": 850}, bypass_csp=True); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/fonts.g*/**", lambda r: r.abort()); page.route("**/cdn.jsdelivr.net/**", lambda r: r.abort())
    page.add_init_script("try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('todo_todo-widget-contacts', %s); localStorage.setItem('todo_team-seen-contacts', %s); localStorage.setItem('team-errors-asked', String(Date.now())); sessionStorage.setItem('s','1'); } }catch(e){}"
                         % (json.dumps(json.dumps(local + [ct("c4", "Damien")])), json.dumps(json.dumps(["c2", "c3", "c4"]))))
    page.add_init_script(STUB)
    page.goto(URL); page.wait_for_timeout(1500)
    contacts = lambda: {c["id"]: c for c in json.loads(page.evaluate("window.storage.peek('todo-widget-contacts')")) if not c.get("deleted")}
    cs = contacts()
    check(cs.get("c2", {}).get("firstName") == "Bob", f"the team base does not overwrite my private copy ({cs.get('c2')})")
    check("c4" not in cs, "a contact a colleague made private (gone from the team base) disappears here")
    # a save pushes: shared ones go, the private one is taken out of the team base
    page.click('[data-tab="contacts"]'); page.wait_for_timeout(300)
    page.locator(".contact-row[data-cid='c1'] .ct-share").click(); page.wait_for_timeout(800)
    t = page.evaluate("window.__team")
    check(["contacts", "c2"] in t["removed"] and ["contacts", "c2"] not in t["pushed"], f"the private contact is removed from the team base, never pushed ({t})")
    check(["contacts", "c1"] not in t["pushed"] and ["contacts", "c1"] not in t["removed"] and contacts()["c1"].get("private") is True,
          "the lock in the list makes a contact private; never sent, nothing to take back")
    page.locator(".contact-row[data-cid='c1'] .ct-share").click(); page.wait_for_timeout(800)
    t = page.evaluate("window.__team")
    check(["contacts", "c1"] in t["pushed"] and contacts()["c1"].get("private") is False, "clicking the lock again shares it: it goes to the team base")
    page.locator(".contact-row[data-cid='c1'] .ct-share").click(); page.wait_for_timeout(800)
    t = page.evaluate("window.__team")
    check(["contacts", "c1"] in t["removed"], "made private once shared: it is taken out of the team base")
    page.locator(".contact-row[data-cid='c1'] .ct-share").click(); page.wait_for_timeout(800)
    # a colleague's contact (the base refuses the delete) : the lock is taken back, it stays shared, and the user is told
    page.evaluate("window.__team.refuse=['c3']")
    page.locator(".contact-row[data-cid='c3'] .ct-share").click(); page.wait_for_timeout(800)
    check(contacts()["c3"].get("private") is False and "collègue" in page.inner_text("#app-toast"), f"a colleague's contact can't be made private : it stays shared, with a message ({contacts()['c3'].get('private')!r})")
    # two people, two fields, one sheet : a colleague changed c3's phone on the base, I change its comment here -> both stay
    page.evaluate("window.__team.now={ c3:{ id:'c3', firstName:'Chloé', lastName:'Test', company:'', phone1:'0699', createdAt:1, updatedAt:5000, deleted:false } }")
    page.evaluate("(()=>{ const all=JSON.parse(window.storage.peek('todo-widget-contacts')); })()")
    page.locator(".contact-row[data-cid='c3'] .contact-main").click(); page.wait_for_timeout(200)
    page.evaluate("""(()=>{ const btn=[...document.querySelectorAll('.contact-detail-links button')].find(b=>/Modifier/.test(b.textContent)); if(btn) btn.click(); })()"""); page.wait_for_timeout(200)
    if page.is_visible("#contact-form"):
        page.fill("#ct-comment", "Vu au salon"); page.click("#contact-save-btn"); page.wait_for_timeout(800)
        last = page.evaluate("window.__team.last && window.__team.last.c3")
        check(bool(last) and last.get("phone1") == "0699" and last.get("comment") == "Vu au salon", f"two people, two fields : the colleague's phone and my comment both reach the base ({last!r})")
        check(contacts()["c3"].get("phone1") == "0699", "… and the colleague's phone shows up here too")
    else:
        check(False, "the contact form opened to edit c3")
    page.select_option("#contacts-type-filter", "__private"); page.wait_for_timeout(300)
    names = page.locator("#contacts-list .contact-row").all_inner_texts()
    check(len(names) == 1 and "Bob" in names[0], f"the « Privés » filter lists only the private ones ({names})")
    # a colleague changes a contact I keep private: my copy stays
    page.evaluate("window.__subs.contacts({ id:'c2', firstName:'Bob-collègue', lastName:'Test', updatedAt: 99999 }, 'UPDATE')"); page.wait_for_timeout(300)
    check(contacts()["c2"]["firstName"] == "Bob", "a live change from the team does not touch my private copy")
    page.evaluate("window.__subs.contacts({ id:'c3' }, 'DELETE')"); page.wait_for_timeout(300)
    check("c3" not in contacts(), "a contact removed from the team base live disappears here")
    page.select_option("#contacts-type-filter", ""); page.wait_for_timeout(200)
    page.locator(".contact-row[data-cid='c1'] .contact-avatar").click(); page.wait_for_timeout(200)
    page.locator(".hist-block summary").first.click(); page.wait_for_timeout(400)
    hist = page.inner_text(".hist-block")
    check("Paul" in hist and "Téléphone : 0600 → 0611" in hist and "création" in hist, f"a shared contact's card shows who changed what ({hist!r})")
    page.locator(".hist-row", has_text="Téléphone").hover(); page.locator(".hist-row", has_text="Téléphone").locator(".hist-back").click()
    page.click("#choice-btns button:has-text('Revenir')"); page.wait_for_timeout(500)
    check(contacts()["c1"].get("phone1") == "0600" and ["contacts", "c1"] in page.evaluate("window.__team").get("pushed", []), f"« Revenir à cette valeur » puts the old value back and sends it to the team ({contacts()['c1'].get('phone1')!r})")
    check(page.locator(".hist-row", has_text="création").locator(".hist-back").count() == 0, "no way back on a creation line")
    page.click('[data-tab="lists"]'); page.wait_for_timeout(400)
    page.wait_for_selector("#errlog-team-list .hist-row", timeout=5000)
    te = page.inner_text("#errlog-team-list")
    check("2 × [synchro] Échec réseau" in te and "Paul" in te and "x is undefined" in te, f"Réglages lists the team's errors, the same one grouped ({te!r})")
    check("1 contact privé" in page.inner_text("#team-share-summary"), f"Réglages says what is shared and what stays mine ({page.inner_text('#team-share-summary')!r})")
    check(not errors, f"no page errors ({errors})")
    b.close()
print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
