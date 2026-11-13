"""The bridge writing a closed Excel file (v1.35) : only the written cells change, inside the file's own XML — the
formatting, conditional formats, drop-down lists, formulas and table of the shared files stay as they were.
    python tests/xlsx_patch_test.py
Needs PowerShell (pwsh); set PWSH to its path if it is not on PATH. Skipped (exit 0) when PowerShell is absent.
"""
import json, os, pathlib, shutil, subprocess, sys, tempfile, zipfile
from openpyxl import Workbook, load_workbook
from openpyxl.formatting.rule import CellIsRule, DataBarRule
from openpyxl.styles import PatternFill
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table

failures = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: failures.append(m)

PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
if not PWSH:
    print("PowerShell absent : skipped"); sys.exit(0)
ROOT = pathlib.Path(__file__).resolve().parent.parent
work = pathlib.Path(tempfile.mkdtemp()); f = work / "Suivi.xlsx"

wb = Workbook(); cst = wb.active; cst.title = "Cst"
for i, v in enumerate(["OUI", "NON", "N/A"], 1): cst.cell(i, 1, v)
ws = wb.create_sheet("BDD Agrégation")
ws["A1"] = "Suivi (titre)"
for c, h in enumerate(["Nom_prod", "Statut", "FG_Fixe_P1", "Double"], 1): ws.cell(3, c, h)
green = PatternFill("solid", fgColor="C6EFCE")
for r, (p, st, fg) in enumerate([("SOLEO", "OUI", 4.2), ("VENTUS", "NON", 3.1), ("AGRI", "OUI", 5.0)], 4):
    ws.cell(r, 1, p).fill = green; ws.cell(r, 2, st); c = ws.cell(r, 3, fg); c.number_format = "0.00"; ws.cell(r, 4, f"=C{r}*2")
ws.add_table(Table(displayName="BDD", ref="A3:D6"))
ws.conditional_formatting.add("A4:A6", CellIsRule(operator="equal", formula=['"VENTUS"'], fill=PatternFill("solid", fgColor="FFC7CE")))
ws.conditional_formatting.add("C4:C6", DataBarRule(start_type="min", end_type="max", color="638EC6"))
dv = DataValidation(type="list", formula1="=Cst!$A$1:$A$3"); ws.add_data_validation(dv); dv.add("B4:B6")
wb.save(f)
before = {n: zipfile.ZipFile(f).read(n) for n in zipfile.ZipFile(f).namelist()}

spec = work / "spec.json"
spec.write_text(json.dumps({"file": str(f), "sheet": "BDD Agregation", "cells": [
    {"r": 4, "c": 1, "v": "SOLEO NEUF"}, {"r": 5, "c": 3, "v": 4.4}, {"r": 6, "c": 2, "v": None}, {"r": 4, "c": 2, "v": "=texte"},
    {"r": 8, "c": 1, "v": "hors tableau"}, {"r": 4, "c": 6, "v": 12}]}, ensure_ascii=False), encoding="utf-8")
shutil.copy(ROOT / "bridge" / "pont-excel.ps1", work / "pont-excel.ps1")
p = subprocess.run([PWSH, "-NoProfile", "-File", str(work / "pont-excel.ps1"), "-PatchTest", str(spec)], cwd=work, capture_output=True, timeout=120)
check(p.returncode == 0, f"the bridge writes the cells ({p.stdout.decode(errors='replace')[-400:]} {p.stderr.decode(errors='replace')[-800:]})")

after = {n: zipfile.ZipFile(f).read(n) for n in zipfile.ZipFile(f).namelist()}
changed = sorted(n for n in set(before) | set(after) if before.get(n) != after.get(n))
check(set(changed) <= {"xl/worksheets/sheet2.xml", "xl/workbook.xml"}, f"only the written sheet (and the recalculation flag) changed in the file ({changed})")

w2 = load_workbook(f); s2 = w2["BDD Agrégation"]
check([s2["A4"].value, s2["C5"].value, s2["B6"].value, s2["B4"].value, s2["A8"].value, s2["F4"].value] == ["SOLEO NEUF", 4.4, None, "=texte", "hors tableau", 12],
      f"the values written, a cleared cell empty, a text starting with « = » kept as text ({[s2[x].value for x in ['A4', 'C5', 'B6', 'B4', 'A8', 'F4']]})")
check(s2["A4"].fill.fgColor.rgb in ("00C6EFCE", "FFC6EFCE") and s2["C5"].number_format == "0.00", "the written cells keep their colour and number format")
check(s2["D4"].value == "=C4*2" and s2["D6"].value == "=C6*2", "the formulas untouched")
check(len(list(s2.conditional_formatting)) == 2, "the conditional formats still there")
check(len(s2.data_validations.dataValidation) == 1 and "Cst" in s2.data_validations.dataValidation[0].formula1, "the drop-down list still there")
check("BDD" in s2.tables and s2.tables["BDD"].ref == "A3:D6", "the table untouched")
print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
