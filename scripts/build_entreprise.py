"""Builds ToDo-Entreprise.zip : the app, the bridge and the company profile, nothing else (no tests, no GitHub
workflow, no Supabase schema). Run by .github/workflows/entreprise.yml for each release ; locally :
    python scripts/build_entreprise.py [--epplus path/to/EPPlus.dll] [--out dist]
With --epplus, the bridge's Excel library is shipped in bridge/lib : the bridge then never downloads it.
"""
import argparse, json, pathlib, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOP_FILES = ["index.html", "widget.html", "mobile.html", "share-target.html", "app.css", "sw.js", "manifest.json", "manifest-lite.json",
             "fr-map.js", "fr-map-hd.js"]
DIRS = ["js", "vendor", "icons", "outlook-vba"]
BRIDGE = ["pont-excel.ps1", "Lancer-pont-excel.bat", "Reconfigurer-pont-excel.bat", "ToDo-local.bat", "Creer-raccourci-ToDo.bat", "ToDoPont.bas"]
EPPLUS_NOTE = ("EPPlus 4.5.3.3 (https://github.com/JanKallman/EPPlus), licence LGPL 2.1 : "
               "https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html. Fichier non modifie, tel que publie sur nuget.org.\r\n")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--epplus"); ap.add_argument("--out", default="dist"); ap.add_argument("--profile", default="profils/entreprise.json")
    a = ap.parse_args()
    profile = json.loads((ROOT / a.profile).read_text(encoding="utf-8"))
    if profile.get("edition") != "entreprise": sys.exit("the profile is not a company one")
    try: version = subprocess.run(["git", "describe", "--tags", "--always"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except Exception: version = ""
    profile["version"] = version or "dev"
    files = [ROOT / f for f in TOP_FILES] + [p for d in DIRS for p in sorted((ROOT / d).rglob("*")) if p.is_file()] + [ROOT / "bridge" / f for f in BRIDGE]
    missing = [str(f.relative_to(ROOT)) for f in files if not f.is_file()]
    if missing: sys.exit(f"missing: {missing}")
    # every file the service worker keeps for offline use must be in the package, or it would not install
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    names = {str(f.relative_to(ROOT)).replace("\\", "/") for f in files}
    import re
    for asset in re.findall(r"'\./([^'?]+)", sw):
        if asset and asset not in names: sys.exit(f"sw.js keeps {asset}, not in the package")
    out = ROOT / a.out; out.mkdir(exist_ok=True)
    z = out / "ToDo-Entreprise.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files: zf.write(f, "ToDo/" + str(f.relative_to(ROOT)).replace("\\", "/"))
        zf.writestr("ToDo/profil.json", json.dumps(profile, ensure_ascii=False, indent=2))
        zf.write(ROOT / "profils" / "LISEZMOI-entreprise.txt", "ToDo/LISEZMOI.txt")
        if a.epplus:
            zf.write(a.epplus, "ToDo/bridge/lib/EPPlus.dll"); zf.writestr("ToDo/bridge/lib/LICENCE-EPPlus.txt", EPPLUS_NOTE)
    print(f"{z} : {len(files) + 2 + (2 if a.epplus else 0)} files, version {profile['version']}")

if __name__ == "__main__":
    main()
