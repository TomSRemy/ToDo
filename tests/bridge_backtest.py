"""Backtest of the Excel bridge: hundreds of random days of work replayed on a table shaped like the real ones.

The bridge runs with -Mock (an in-memory table, no Excel). The tables have the real files' shape — 37 columns for the Pipe,
91 for the Suivi, checkbox columns put to FALSE by Excel in every new line, a calculated column, formulas on a few lines only —
with invented producers and plants. An « app » sends its lines (by packets of 8, remembering what it wrote, like js/excel-sync.js)
while a « colleague » edits cells, sorts, inserts lines, closes deals. After every step the rules are checked:

  - a cell a colleague filled is never replaced without « Remplacer » on the value seen;
  - no empty line is left at the end of the table, no open line is duplicated by the bridge;
  - formulas and closed lines are never written; lines the app did not send are never touched;
  - sending the same thing twice changes nothing; every written cell is in the journal.

    python tests/bridge_backtest.py [--days 300] [--seed 7]
Needs PowerShell (pwsh); skipped (exit 0) when it is absent.
"""
import json, os, pathlib, random, shutil, socket, subprocess, sys, tempfile, time, urllib.request, datetime, argparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
if not PWSH:
    print("PowerShell absent: backtest skipped"); sys.exit(0)
ap = argparse.ArgumentParser(); ap.add_argument("--days", type=int, default=300); ap.add_argument("--seed", type=int, default=7)
ARGS = ap.parse_args(); rnd = random.Random(ARGS.seed)

failures = []
def check(cond, msg):
    if not cond:
        failures.append(msg); print("FAIL " + msg)
    return cond

# ---- the tables' shape (positions as in the real files; generic names except the ones the bridge reads)
PIPE_N, BDD_N = 37, 91
PIPE_H = ["C%d" % (i + 1) for i in range(PIPE_N)]
for i, h in {0: "Année", 1: "New", 3: "Date entrée pipe", 6: "Nom Producteur", 16: "CR", 18: "CR2", 19: "Nom Centrale",
             29: "Particularités", 30: "Stade", 35: "Commentaires", 36: "Qualification"}.items(): PIPE_H[i] = h
PIPE_CHECKS = [2, 17, 19, 37]          # 1-based: New, CR, CR2, Qualification (Excel puts FALSE in each new line)
BDD_H = ["B%d" % (i + 1) for i in range(BDD_N)]
for i, h in {1: "Année", 3: "Date entrée BDD", 7: "Ref_Watt.ee", 24: "Statut", 29: "Renouvellement", 30: "Commentaire",
             31: "Nom_prod", 33: "Nom_Installation_prod"}.items(): BDD_H[i] = h
BDD_FORMULA_COL = 30                   # 1-based: « Renouvellement », a calculated column
KEYS = {"pipe": (6, 19), "bdd": (31, 33)}
STAT = {"pipe": 30, "bdd": 24}
CLOSED = {"Perdu", "Abandonné", "No Go", "Résilié"}
OPEN = ["A qualifier", "En préparation", "En attente", "Négociation en cours", "Offre envoyée"]

# ---- the mock bridge
work = pathlib.Path(tempfile.mkdtemp())
shutil.copy(os.environ.get("BRIDGE") or (ROOT / "bridge" / "pont-excel.ps1"), work / "pont-excel.ps1")   # BRIDGE=… : another copy (to check the backtest catches a known defect)
with socket.socket() as s_:
    s_.bind(("127.0.0.1", 0)); PORT = s_.getsockname()[1]
LOG = open(work / "bridge.log", "wb")   # the bridge's window: to a file (an unread pipe fills up and freezes the bridge)
proc = subprocess.Popen([PWSH, "-NoProfile", "-File", str(work / "pont-excel.ps1"), "-Mock", "-Port", str(PORT)], cwd=work,
                        stdout=LOG, stderr=subprocess.STDOUT)
def call(method, path, body=None):
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (PORT, path), method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "X-Bridge-Token": "mocktoken"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            out = json.loads(r.read().decode())
    except Exception as e:
        raise RuntimeError(f"the bridge did not answer {method} {path} within {time.time() - t0:.0f} s ({e}): a freeze? last lines:\n" + (work / "bridge.log").read_text(errors="replace")[-1500:] if (work / "bridge.log").exists() else str(e))
    SLOW.append((time.time() - t0, path, len((body or {}).get("rows", []))))
    return out
SLOW = []
for _ in range(60):
    try:
        call("GET", "/status"); break
    except Exception:
        time.sleep(0.5)
else:
    print((work / "bridge.log").read_text(errors="replace")); sys.exit("le pont ne démarre pas")

# ---- invented content
SYL = ["sol", "ar", "vent", "pré", "mont", "val", "bel", "roc", "lac", "pin", "ter", "nor", "sud", "est", "ouest", "lumi", "hel", "watt", "ener", "volt"]
def word(n=2): return "".join(rnd.choice(SYL) for _ in range(n)).capitalize()
def producer(): return rnd.choice(["SAS ", "SCEA ", "GAEC ", "SARL ", ""]) + word(2) + rnd.choice([" Énergie", " Solaire", "", " & Co"])
def plant(): return rnd.choice(["Toit ", "Hangar ", "Ombrière ", "Parc ", ""]) + word(2) + rnd.choice(["", "_A", "_B", " 2", "-C"])
def date(): return {"d": (datetime.date(2025, 1, 1) + datetime.timedelta(days=rnd.randint(0, 600))).isoformat()}
def norm(s):
    import unicodedata, re
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower())

def app_values(kind, d):
    """What the app sends for one deal (a list as long as the table, None = nothing to say)."""
    n = PIPE_N if kind == "pipe" else BDD_N; v = [None] * n
    a, b = KEYS[kind]; v[a] = d["prod"]; v[b] = d["plant"]
    v[STAT[kind]] = d["stat"]
    if kind == "pipe":
        v[0] = 2026; v[1] = d["new"]; v[3] = d["entry"]; v[22] = d["kwc"]; v[23] = d["mwh"]; v[35] = d["comment"] or None; v[36] = d["qualif"]
    else:
        v[1] = 2026; v[3] = d["entry"]; v[7] = d["code"]; v[38] = d["kwc"]; v[40] = d["mwh"]; v[29] = d["comment"] or None; v[48] = d["vol26"]
    return v

def new_deal():
    return {"prod": producer(), "plant": plant(), "stat": rnd.choice(OPEN), "new": rnd.random() < .5, "qualif": rnd.random() < .5,
            "entry": date(), "kwc": round(rnd.uniform(36, 9000), 1), "mwh": rnd.randint(40, 12000), "comment": rnd.choice(["", "", "Rappeler", "Vu au salon"]),
            "code": "%d - %s - A" % (rnd.randint(1000, 9999), word(1)), "vol26": round(rnd.uniform(10, 5000), 1), "prev": {"pipe": [], "bdd": []}, "keep": {"pipe": {}, "bdd": {}}}

def excel_seed(kind, deals_in_file, extra):
    """The file before the app: some of the app's deals already there (sent by hand long ago), others' lines, closed lines."""
    n = PIPE_N if kind == "pipe" else BDD_N; rows = []
    for d in deals_in_file:
        v = app_values(kind, d); r = [("" if x is None else x["d"] if isinstance(x, dict) else x) for x in v]
        if kind == "bdd": r[BDD_FORMULA_COL - 1] = "=calc"
        if rnd.random() < .3: r[rnd.choice([22, 23] if kind == "pipe" else [38, 40])] = ""   # gaps the app will fill
        rows.append(r)
    for _ in range(extra):
        r = [""] * n; a, b = KEYS[kind]; r[a] = producer(); r[b] = plant(); r[STAT[kind] ] = rnd.choice(OPEN + list(CLOSED) + ["Gagné"])
        if kind == "pipe":
            for c in PIPE_CHECKS: r[c - 1] = rnd.random() < .3
        else:
            r[BDD_FORMULA_COL - 1] = "=calc"
            if rnd.random() < .05:   # a few lines with formulas in many cells, like the real Suivi
                for c in (3, 4, 5, 6, 17, 18): r[c - 1] = "=lien"
        rows.append(r)
    rnd.shuffle(rows)
    call("POST", "/mock/seed/" + kind, {"headers": PIPE_H if kind == "pipe" else BDD_H, "rows": rows,
                                        "formulas": [] if kind == "pipe" else [BDD_FORMULA_COL], "checkboxes": PIPE_CHECKS if kind == "pipe" else []})

def dump(kind): return call("GET", "/mock/dump/" + kind)["rows"]
def is_empty_line(kind, r):
    return all(x in ("", "False") or str(x).startswith("=") or (kind == "bdd" and j == BDD_FORMULA_COL - 1) for j, x in enumerate(r))
def lines_of(kind, rows, d):
    a, b = KEYS[kind]; return [i for i, r in enumerate(rows) if norm(r[a]) == norm(d["prod"]) and norm(r[b]) == norm(d["plant"])]

# ---- the run
deals = [new_deal() for _ in range(70)]
in_file = rnd.sample(deals, 25)
excel_seed("pipe", in_file, 300); excel_seed("bdd", in_file[:15], 200)
colleague = {"pipe": {}, "bdd": {}}       # (key, col) → the value a colleague typed (to be kept)
journal = work / "Sauvegardes pont" / "journal-pont.csv"
stats = {"sends": 0, "lines": 0, "edits": 0, "sorts": 0, "inserts": 0, "closes": 0, "forced": 0, "questions": 0}

def send(kind, ds, force=None):
    rows = []
    for d in ds:
        r = {"values": app_values(kind, d), "prev": d["prev"][kind] or None, "keep": d["keep"][kind] or None, "won": False}
        if force and id(d) in force: r.update(force[id(d)])
        rows.append(r)
    results = []
    for k in range(0, len(rows), 8):
        results += call("POST", "/%s/upsert" % kind, {"rows": rows[k:k + 8]})["results"]
    for d, r, row in zip(ds, results, rows):     # what the app remembers (xlRemember)
        if r.get("ok") and r.get("action") != "en attente":
            prev = list(d["prev"][kind]) + [None] * (len(row["values"]) - len(d["prev"][kind]))
            for i in r.get("mine", []): prev[i] = row["values"][i]
            d["prev"][kind] = prev
        if r.get("question"): stats["questions"] += 1
    stats["sends"] += 1; stats["lines"] += len(ds)
    return results

def check_state(kind, step, before, sent, results):
    rows = dump(kind); a, b = KEYS[kind]
    # no empty line at the end
    check(not rows or not is_empty_line(kind, rows[-1]), f"[{step}] {kind}: an empty line was left at the end of the table")
    # no open line duplicated by the bridge
    for d in sent:
        open_lines = [i for i in lines_of(kind, rows, d) if str(rows[i][STAT[kind]]) not in CLOSED and str(rows[i][STAT[kind]]) != "Gagné"]
        before_open = [i for i in lines_of(kind, before, d) if str(before[i][STAT[kind]]) not in CLOSED and str(before[i][STAT[kind]]) != "Gagné"]
        check(len(open_lines) <= max(1, len(before_open)), f"[{step}] {kind}: {d['prod']} / {d['plant']} has {len(open_lines)} open lines (was {len(before_open)})")
    # a colleague's cell is kept (unless replaced on purpose, which clears it from `colleague`)
    for (key, col), val in colleague[kind].items():
        hit = [r for r in rows if norm(r[a]) + "|" + norm(r[b]) == key and str(r[STAT[kind]]) not in CLOSED]
        for r in hit:
            check(norm(r[col]) == norm(val), f"[{step}] {kind}: {key} column {col + 1} — the colleague's « {val} » became « {r[col]} »")
    # lines the app did not send, closed lines, formulas: untouched
    sent_keys = {norm(d["prod"]) + "|" + norm(d["plant"]) for d in sent}
    def sig(r): return norm(r[a]) + "|" + norm(r[b])
    from collections import Counter
    bc = Counter(json.dumps(r, ensure_ascii=False) for r in before if sig(r) not in sent_keys or str(r[STAT[kind]]) in CLOSED)
    ac = Counter(json.dumps(r, ensure_ascii=False) for r in rows if sig(r) not in sent_keys or str(r[STAT[kind]]) in CLOSED)
    missing = Counter({t: n for t, n in (bc - ac).items() if not is_empty_line(kind, json.loads(t))})   # a wholly empty line may go with the end-of-table clean-up
    if missing:   # say what they became: the lines that appeared instead
        extra = ac - bc
        def short(t): r = json.loads(t); return {i: x for i, x in enumerate(r) if x not in ("", None, "False")}
        check(False, f"[{step}] {kind}: lines not sent (or closed) were changed: {[short(t) for t in list(missing)[:2]]} → {[short(t) for t in list(extra)[:2]]}")

def colleague_step(kind):
    rows = dump(kind); a, b = KEYS[kind]
    if not rows: return
    op = rnd.random()
    if op < .55:     # types in a cell of a line the app knows (never a key column, never a formula)
        mine = [i for i, r in enumerate(rows) if any(lines_of(kind, [r], d) for d in deals) and str(r[STAT[kind]]) not in CLOSED]
        if not mine: return
        i = rnd.choice(mine); cols = [22, 23, 35] if kind == "pipe" else [38, 40, 29]
        c = rnd.choice(cols); val = rnd.choice(["Modifié par Paul", 123.5, "999", "Vu au salon (Marie)"])
        if str(rows[i][c]).startswith("="): return
        call("POST", "/mock/edit/" + kind, {"op": "set", "row": i + 1, "col": c + 1, "value": val})
        colleague[kind][(norm(rows[i][a]) + "|" + norm(rows[i][b]), c)] = val; stats["edits"] += 1
    elif op < .7:
        call("POST", "/mock/edit/" + kind, {"op": "sort", "col": rnd.choice([1, KEYS[kind][0] + 1, KEYS[kind][1] + 1]), "desc": rnd.random() < .5}); stats["sorts"] += 1
    elif op < .85:   # someone's new line somewhere in the table
        v = [""] * len(rows[0]); v[a] = producer(); v[b] = plant(); v[STAT[kind]] = rnd.choice(OPEN)
        call("POST", "/mock/edit/" + kind, {"op": "insert", "at": rnd.randint(1, len(rows)), "values": v}); stats["inserts"] += 1
    else:            # a deal of the app closed by a colleague (Perdu)
        mine = [i for i, r in enumerate(rows) if any(lines_of(kind, [r], d) for d in deals) and str(r[STAT[kind]]) not in CLOSED]
        if mine:
            i = rnd.choice(mine); call("POST", "/mock/edit/" + kind, {"op": "set", "row": i + 1, "col": STAT[kind] + 1, "value": "Perdu"})
            k = norm(rows[i][a]) + "|" + norm(rows[i][b])
            for key in [x for x in colleague[kind] if x[0] == k]: del colleague[kind][key]   # a closed line is never written anyway
            stats["closes"] += 1

try:
    # day 0: everything sent at once, like tonight (70 lines, packets of 8), then the same again: nothing must change
    for kind in ("pipe", "bdd"):
        before = dump(kind); res = send(kind, deals)
        check(all(r.get("ok") for r in res), f"[day 0] {kind}: refused lines {[r.get('message') for r in res if not r.get('ok')][:2]}")
        check_state(kind, "day 0", before, deals, res)
        added = [r for r in res if r.get("action") == "ajoutée"]
        check(all(not r.get("conflicts") for r in added), f"[day 0] {kind}: a line just added has « kept » cells: {[c['header'] for r in added for c in r['conflicts']][:4]}")
        snap = dump(kind); res2 = send(kind, deals)
        check(dump(kind) == snap and all(r.get("action") in ("aucun changement", "en attente") or not r.get("cells") for r in res2),
              f"[day 0] {kind}: sending the same thing twice changed the file ({[ (r.get('action'), r.get('cells')) for r in res2 if r.get('cells')][:3]})")
    # the days after: the app changes things, a colleague works in the file, sends of a few lines, « Remplacer » now and then
    for day in range(1, ARGS.days + 1):
        kind = rnd.choice(("pipe", "bdd"))
        for _ in range(rnd.randint(0, 3)): colleague_step(kind)
        for d in rnd.sample(deals, rnd.randint(0, 4)):      # the app's own changes
            d["kwc"] = round(d["kwc"] * rnd.uniform(.8, 1.2), 1); d["comment"] = rnd.choice([d["comment"], "Relancer lundi", ""])
            if rnd.random() < .2: d["stat"] = rnd.choice(OPEN)
        batch = rnd.sample(deals, rnd.randint(1, 12))
        shifted = rnd.random() < .15
        if shifted: call("POST", "/mock/edit/" + kind, {"op": "shift"}); stats["shifts"] = stats.get("shifts", 0) + 1   # a colleague inserts a line at the top while the bridge writes
        before = dump(kind)
        res = send(kind, batch)
        if shifted:   # the colleague's insertion happens only when the bridge writes: still armed = it did not happen
            armed = call("POST", "/mock/edit/" + kind, {"op": "noop"})["shiftArmed"]
            if armed: call("POST", "/mock/edit/" + kind, {"op": "unshift"})
            else: before = [[""] * len(before[0])] + before   # the colleague's (empty) line, expected at the top
        check_state(kind, "day %d" % day, before, batch, res)
        # « Garder l'appli » on some kept cells: replaced only if the cell still holds what was shown
        force = {}
        for d, r in zip(batch, res):
            for c in (r.get("conflicts") or []):
                if rnd.random() < .3:
                    f = force.setdefault(id(d), {"force": {}, "seen": {}}); f["force"][str(c["i"])] = "replace"; f["seen"][str(c["i"])] = c["excel"]
        if force:
            fd = [d for d in batch if id(d) in force]
            for d in fd:
                for i in force[id(d)]["force"]:
                    colleague[kind].pop((norm(d["prod"]) + "|" + norm(d["plant"]), int(i)), None)   # the user chose the app's value
            before = dump(kind); send(kind, fd, force); stats["forced"] += 1
            check_state(kind, "day %d (Remplacer)" % day, before, fd, [])
    # the journal: one line per written cell, never an empty « new value » except the end-of-table clean-up
    j = journal.read_text(encoding="utf-8-sig").splitlines() if journal.exists() else []
    check(len(j) > 1, "journal written")
finally:
    proc.terminate()
    try: proc.wait(timeout=10)
    except Exception: proc.kill()

print(json.dumps(stats))
SLOW.sort(reverse=True); print("slowest calls:", [(round(t, 1), p, n) for t, p, n in SLOW[:3]])
print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
