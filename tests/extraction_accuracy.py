"""Measures the signature reader and the producer-Excel reader of index.html, field by field.

    python tests/extraction_accuracy.py               # signatures + Excel, every mismatch listed
    python tests/extraction_accuracy.py --min 0.95    # exit 1 below 95 % (used by CI)
    python tests/extraction_accuracy.py --old-sig     # the former Contacts signature reader, for comparison
    python tests/extraction_accuracy.py --heldout     # only the signatures written after tuning
    python tests/extraction_accuracy.py --all
"""
import pathlib
import sys
import unicodedata

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from signature_corpus import SIGNATURES, SIGNATURES_HELDOUT  # noqa: E402

try:
    from excel_corpus import EXCELS  # noqa: E402
except ImportError:
    EXCELS = []

URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()


def norm(v):
    v = "" if v is None else str(v)
    return unicodedata.normalize("NFC", " ".join(v.split())).lower().replace("’", "'")


def score(title, cases, results, misses, per_field):
    good = total = 0
    for case, got in zip(cases, results):
        for field, want in case["expect"].items():
            ok = norm(got.get(field)) == norm(want)
            s = per_field.setdefault(title + "." + field, [0, 0]); s[1] += 1; s[0] += ok
            good += ok; total += 1
            if not ok:
                misses.append(f"  [{title}: {case['name']}] {field}: attendu {want!r}, lu {got.get(field)!r}")
    return good, total


def main():
    global SIGNATURES
    minimum = float(sys.argv[sys.argv.index("--min") + 1]) if "--min" in sys.argv else None
    if "--heldout" in sys.argv:
        SIGNATURES = SIGNATURES_HELDOUT
    elif "--all" in sys.argv:
        SIGNATURES = SIGNATURES + SIGNATURES_HELDOUT
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.route("**/fonts.g*/**", lambda r: r.abort())
        page.add_init_script("window.TODO_TEST_HOOKS=true;")
        page.goto(URL)
        if "--old-sig" in sys.argv:
            sig = page.evaluate("""cases => cases.map(t => { const r = window.__todo.parseSignatureTextOld(t);
                return { prenom:r.firstName, nom:(r.lastName||'').toUpperCase(), qualite:r.role, societe:r.company, mail:r.email, tel:r.phone1, tel2:r.phone2 }; })""",
                                [c["text"] for c in SIGNATURES])
        else:
            sig = page.evaluate("cases => cases.map(t => window.__todo.parseSignatureBlock(t))", [c["text"] for c in SIGNATURES])
        xl = page.evaluate("cases => cases.map(c => window.__todo.xlsxToInstallations(c))", [c["sheets"] for c in EXCELS]) if EXCELS else []
        browser.close()

    misses, per_field = [], {}
    g1, t1 = score("signature", SIGNATURES, sig, misses, per_field)
    g2 = t2 = 0
    for case, got in zip(EXCELS, xl):
        want = case["installs"]
        for i, w in enumerate(want):
            have = got[i] if i < len(got) else {}
            for field, v in w.items():
                ok = norm(have.get(field)) == norm(v)
                s = per_field.setdefault("excel." + field, [0, 0]); s[1] += 1; s[0] += ok
                g2 += ok; t2 += 1
                if not ok:
                    misses.append(f"  [excel: {case['name']}] installation {i + 1} {field}: attendu {v!r}, lu {have.get(field)!r}")
        ok = len(got) == len(want)
        s = per_field.setdefault("excel.nombre", [0, 0]); s[1] += 1; s[0] += ok
        g2 += ok; t2 += 1
        if not ok:
            misses.append(f"  [excel: {case['name']}] {len(want)} installations attendues, {len(got)} lues")

    print(f"Signatures : {g1}/{t1} = {g1 / t1:.0%}")
    if t2:
        print(f"Excel      : {g2}/{t2} = {g2 / t2:.0%}")
    print()
    for k, (g, n) in sorted(per_field.items(), key=lambda kv: kv[1][0] / kv[1][1]):
        print(f"  {k:<22} {g:>3}/{n:<3} {g / n:.0%}")
    if misses:
        print("\nÉcarts :")
        print("\n".join(misses))
    if minimum is not None and (g1 + g2) / (t1 + t2) < minimum:
        sys.exit(1)


if __name__ == "__main__":
    main()
