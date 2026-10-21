"""Tests of the Excel bridge's writing rules (bridge/pont-excel.ps1 -Mock: an in-memory table, no Excel needed).

Runs the real PowerShell script on a free port and replays the situations of the shared-workbook review:
new plant, filling empty cells, one's own deal moving on, a colleague's change, re-pricing a lost or a won plant,
a row being typed by someone else, duplicates, comments merged on request, backups kept to 3.
Needs PowerShell (pwsh); set PWSH to its path if it is not on PATH. Skipped (exit 0) when PowerShell is absent.
"""
import datetime
import json
import os
import pathlib
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
if not PWSH:
    print("PowerShell absent : test du pont ignoré.")
    sys.exit(0)

failures = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


work = pathlib.Path(tempfile.mkdtemp())
shutil.copy(ROOT / "bridge" / "pont-excel.ps1", work / "pont-excel.ps1")
with socket.socket() as s_:
    s_.bind(("127.0.0.1", 0)); PORT = s_.getsockname()[1]
proc = subprocess.Popen([PWSH, "-NoProfile", "-File", str(work / "pont-excel.ps1"), "-Mock", "-Port", str(PORT)],
                        cwd=work, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def call(method, path, body=None):
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (PORT, path), method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-Bridge-Token": "mocktoken", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode() or "null")


for _ in range(120):
    try:
        call("GET", "/status"); break
    except Exception:
        time.sleep(0.5)
else:
    print(proc.stdout.read().decode(errors="replace")); sys.exit("le pont ne démarre pas")

H = ["Nom Producteur", "Nom Centrale", "Statut", "Prix", "Date entrée", "Commentaires", "Formule"]
TODAY = datetime.date.today()
fr = lambda d: d.strftime("%d/%m/%Y")
iso = lambda d: {"d": d.isoformat()}


def seed(rows, closed=False):
    call("POST", "/mock/seed/pipe", {"headers": H, "rows": rows, "formulas": [7], "closed": closed})


def dump():
    return call("GET", "/mock/dump/pipe")["rows"]


def send(*rows):
    return call("POST", "/pipe/upsert", {"rows": list(rows)})


def row(values, **kw):
    return dict(values=values, **kw)


try:
    # 1. a new plant: added at the end
    seed([["SOLARIS", "Autre", "En attente", 50, "", "", "=x"]])
    r = send(row(["SOLARIS", "Toit Durand", "En préparation", 61, iso(TODAY), "", None]))["results"][0]
    check(r["action"] == "ajoutée" and dump()[1][:4] == ["SOLARIS", "Toit Durand", "En préparation", "61"], "new plant: line added")

    # 2. filling an empty cell, nothing else moves
    seed([["SOLARIS", "Toit Durand", "En préparation", "", "", "Rappeler en mars", "=x"]])
    r = send(row(["SOLARIS", "Toit Durand", "En préparation", 61, None, None, "nope"]))["results"][0]
    d = dump()[0]
    check(r["action"] == "mise à jour" and d[3] == "61" and d[5] == "Rappeler en mars" and d[6] == "=x", "empty cell filled, comment and formula untouched")

    # 3. one's own deal moving on: the cell still holds what the app wrote → updated without a question
    seed([["SOLARIS", "Toit Durand", "En préparation", 61, "", "", ""]])
    r = send(row(["SOLARIS", "Toit Durand", "En attente", 61], prev=["SOLARIS", "Toit Durand", "En préparation", 61]))["results"][0]
    check(dump()[0][2] == "En attente" and not r["conflicts"], "own value updated (nobody else changed it)")

    # 4. a colleague changed the price and the comment → kept and reported
    seed([["SOLARIS", "Toit Durand", "En attente", 60, "", "Refus partiel (Marie)", ""]])
    vals = ["SOLARIS", "Toit Durand", "En attente", 62, None, "Relancer lundi"]
    prev = ["SOLARIS", "Toit Durand", "En attente", 61, None, ""]
    r = send(row(vals, prev=prev))["results"][0]
    d = dump()[0]
    heads = sorted(c["header"] for c in r["conflicts"])
    check(d[3] == "60" and d[5] == "Refus partiel (Marie)" and heads == ["Commentaires", "Prix"]
          and [c["comment"] for c in sorted(r["conflicts"], key=lambda c: c["header"])] == [True, False],
          f"colleague's values kept and reported ({heads})")
    # … then « Remplacer » the price, « Fusionner » the comment
    r = send(row(vals, prev=prev, force={"3": "replace", "5": "merge"}))["results"][0]
    d = dump()[0]
    check(d[3] == "62" and d[5].startswith("Refus partiel (Marie)\nRelancer lundi (") and not r["conflicts"], "replace and merge on request")
    # … or « Garder » remembered: the same Excel value is not asked again
    seed([["SOLARIS", "Toit Durand", "En attente", 60, "", "", ""]])
    r = send(row(["SOLARIS", "Toit Durand", "En attente", 62], prev=prev, keep={"3": 60}))["results"][0]
    check(dump()[0][3] == "60" and not r["conflicts"], "a kept value is not asked again")

    # 5. re-pricing a plant lost long ago → the lost line stays, a new line is added
    seed([["SOLARIS", "CS du Moulin", "Perdu", 52, "15/01/2025", "Perdu face à un concurrent", ""]])
    r = send(row(["SOLARIS", "CS du Moulin", "En préparation", 58, iso(TODAY)]))["results"][0]
    d = dump()
    check(r["action"] == "ajoutée" and d[0][2] == "Perdu" and d[0][3] == "52" and d[1][2] == "En préparation" and "conservée" in r["note"],
          "old lost line untouched, new line for the new price")
    # … lost recently → question, then the answer is applied
    seed([["SOLARIS", "CS du Moulin", "Perdu", 52, fr(TODAY - datetime.timedelta(days=40)), "", ""]])
    r = send(row(["SOLARIS", "CS du Moulin", "En préparation", 58]))["results"][0]
    check(r["action"] == "en attente" and r["question"]["type"] == "recent-closed" and len(dump()) == 1, "recently lost: nothing written, the app asks")
    r = send(row(["SOLARIS", "CS du Moulin", "En préparation", 58], target=r["question"]["rows"][0]["row"]))["results"][0]
    check(r["action"] == "mise à jour" and dump()[0][3] == "52" and r["conflicts"], "« reprendre la ligne » goes through the same protections")
    seed([["SOLARIS", "CS du Moulin", "Résilié", 52, fr(TODAY - datetime.timedelta(days=400)), "", ""]])
    r = send(row(["SOLARIS", "CS du Moulin", "En préparation", 58]))["results"][0]
    check(r["action"] == "ajoutée" and dump()[0][2] == "Résilié", "« Résilié » is a closed line too")

    # 6. renewal of a won contract → new line; the same won deal → updated
    seed([["SOLARIS", "CS Allan", "Gagné", 49, "01/03/2023", "A renouveler", ""]])
    r = send(row(["SOLARIS", "CS Allan", "En préparation", 56]))["results"][0]
    d = dump()
    check(r["action"] == "ajoutée" and d[0][2:4] == ["Gagné", "49"] and "Contrat gagné conservé" in r["note"], "renewal: signed contract kept, new line")
    seed([["SOLARIS", "CS Allan", "Gagné", "", "01/03/2023", "", ""]])
    r = send(row(["SOLARIS", "CS Allan", "Gagné", 49], won=True))["results"][0]
    check(r["action"] == "mise à jour" and dump()[0][3] == "49", "the same won deal is completed in place")

    # 7. a line being typed by a colleague is never taken; a really empty line is reused
    seed([["SOLARIS", "Autre", "", "", "", "", ""], ["", "", "", "", "", "Nouveau lead salon (Paul)", ""]])
    send(row(["SOLARIS", "Toit Durand", "En préparation", 61]))
    d = dump()
    check(len(d) == 3 and d[1][5] == "Nouveau lead salon (Paul)" and d[1][0] == "" and d[2][1] == "Toit Durand", "Paul's line untouched, new line added")
    seed([["SOLARIS", "Autre", "", "", "", "", ""], ["", "", "", "", "", "", ""]])
    send(row(["SOLARIS", "Toit Durand", "En préparation", 61]))
    check(len(dump()) == 2 and dump()[1][1] == "Toit Durand", "a completely empty line is reused")

    # 8. duplicates → nothing written, the app asks which one
    seed([["SOLARIS", "Toit Durand", "En attente", 61, "", "", ""], ["SOLARIS", "Toit Durand", "En préparation", "", "", "doublon ?", ""]])
    r = send(row(["SOLARIS", "Toit Durand", "Gagné", 61]))["results"][0]
    check(r["action"] == "en attente" and r["question"]["type"] == "duplicate" and [x["row"] for x in r["question"]["rows"]] == [2, 3]
          and dump()[0][2] == "En attente", "duplicate: nothing written, both lines offered")
    r = send(row(["SOLARIS", "Toit Durand", "En attente", 61], target=3))["results"][0]
    check(dump()[1][2] == "En préparation" and dump()[1][3] == "61" and r["row"] == 3, "the chosen duplicate is completed")

    # 9. BDD: the business code (Ref_Watt.ee) tells two contracts of one plant apart
    HB = ["Ref_Watt.ee", "Nom_prod", "Nom_Installation_prod", "Statut", "Date entrée BDD", "Commentaire", "P50"]
    def bseed(rows, **kw):
        call("POST", "/mock/seed/bdd", dict({"headers": HB, "rows": rows, "formulas": []}, **kw))
    bdump = lambda: call("GET", "/mock/dump/bdd")["rows"]
    bsend = lambda *rows: call("POST", "/bdd/upsert", {"rows": list(rows)})
    bseed([["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En attente", "", "", ""], ["2830 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", "", "", ""]])
    r = bsend(row(["2830 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", None, None, 400]))["results"][0]
    d = bdump()
    check(r["action"] == "mise à jour" and d[1][6] == "400" and d[0][6] == "", "two open lines of one plant: the business code picks the right one, no question")
    bseed([["2126 - URBA_158_C213 - A", "SOLARIS", "Toit", "En attente", "", "", ""]])
    r = bsend(row(["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", None, None, 400]))["results"][0]
    check(r["action"] == "en attente" and r["question"]["type"] == "other-contract" and bdump()[0] == ["2126 - URBA_158_C213 - A", "SOLARIS", "Toit", "En attente", "", "", ""],
          "the only line carries another contract's code: nothing written, the app asks")
    bseed([["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", "", "", 300]])
    r = bsend(row(["27(06)30 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En attente", None, None, 400], prev=["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", None, None, 300]))["results"][0]
    check(bdump()[0][0] == "27(06)30 - SOLARIS_Toit - A" and bdump()[0][3] == "En attente" and not r["conflicts"], "the app's own code follows its new dates on its own line")
    bseed([["", "SOLARIS", "Toit", "En préparation", "", "", ""]])
    bsend(row(["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation"]))
    check(bdump()[0][0] == "2729 - SOLARIS_Toit - A", "an empty code is filled")
    # 10. « Remplacer » only replaces the value the user saw
    bseed([["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En attente", "", "Vu par Marie", ""]])
    r = bsend(row(["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En attente", None, "Relancer"], force={"5": "replace"}, seen={"5": "Ancien texte"}))["results"][0]
    check(bdump()[0][5] == "Vu par Marie" and [c["header"] for c in r["conflicts"]] == ["Commentaire"], "the cell changed since it was shown: not replaced, asked again")
    r = bsend(row(["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En attente", None, "Relancer"], force={"5": "replace"}, seen={"5": "Vu par Marie"}))["results"][0]
    check(bdump()[0][5] == "Relancer", "the value seen is still there: replaced")
    # 11. a colleague inserts a line while the bridge writes: nothing lands on the wrong line
    bseed([["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", "", "", ""]], shiftOnWrite=True)
    r = bsend(row(["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", None, "Note", 400]))["results"][0]
    d = bdump()
    check(not r["ok"] and "bougé" in r["message"] and d[0] == [""] * 7 and d[1] == ["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", "", "", ""],
          "table moved during the write: nothing written, the app is told")
    bseed([["2126 - Autre - A", "AUTRE", "Hangar", "Gagné", "", "", ""]], shiftOnWrite=True)
    r = bsend(row(["2729 - SOLARIS_Toit - A", "SOLARIS", "Toit", "En préparation", None, None, 400]))["results"][0]
    d = bdump()
    check(not r["ok"] and d[1] == ["2126 - Autre - A", "AUTRE", "Hangar", "Gagné", "", "", ""] and all(x == "" for x in d[0]), "new line + moved table: the colleague's line is not touched")
    # 12. every written cell is in the journal, with its old value
    j = (work / "Sauvegardes pont" / "journal-pont.csv").read_text(encoding="utf-8-sig")
    check(j.startswith("Date;Fichier;Ligne;Colonne") and '"Vu par Marie";"Relancer";"Remplacer (choisi dans l\'app)"' in j and '"2729 - SOLARIS_Toit - A";"27(06)30 - SOLARIS_Toit - A"' in j,
          "journal: each written cell with its old value and the reason")

    # older app (plain lists) still works
    seed([])
    r = send(["SOLARIS", "Vieux format", "En préparation", 10])["results"][0]
    check(r["action"] == "ajoutée", "plain list rows from an older app still work")

    # backups: one copy per writing request, only the last 3 kept; the closed-file warning
    seed([], closed=True)
    res = None
    for k in range(5):
        res = send(row(["SOLARIS", "Sauvegarde %d" % k, "En préparation", k + 1])); time.sleep(1.1)
    kept = sorted(p.name for p in (work / "Sauvegardes pont").glob("mock-pipe-*.json"))
    check(len(kept) == 3 and res["backup"] in kept and res["fileWasClosed"] is True, f"backup before writing, 3 kept ({len(kept)}), closed file reported")
finally:
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except Exception:
        proc.kill()

print()
print(f"{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
