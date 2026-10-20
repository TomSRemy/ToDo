"""Measures the email reader (parsePipeMail in index.html) on tests/mail_corpus.py, field by field.

    python tests/mail_accuracy.py            # summary + every mismatch
    python tests/mail_accuracy.py --min 0.9  # exit 1 if overall accuracy is below 90 %
    python tests/mail_accuracy.py --heldout  # only the mails written after tuning (honest measure)
    python tests/mail_accuracy.py --hard     # replies, quotes, pasted tables
    python tests/mail_accuracy.py --all
"""
import json
import pathlib
import sys
import unicodedata

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mail_corpus import CASES, HARD, HELDOUT  # noqa: E402

URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()


def norm(field, v):
    v = "" if v is None else str(v).strip()
    if field == "tel":
        v = v.split(" / ")[0]
    if field in ("producteur", "qualite", "centrale", "mesPrev"):
        v = unicodedata.normalize("NFC", v).lower().replace("’", "'")
    return v


def main():
    minimum = float(sys.argv[sys.argv.index("--min") + 1]) if "--min" in sys.argv else None
    cases = HELDOUT if "--heldout" in sys.argv else HARD if "--hard" in sys.argv else CASES + HELDOUT + HARD if "--all" in sys.argv else CASES
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.route("**/fonts.g*/**", lambda r: r.abort())
        page.add_init_script("window.TODO_TEST_HOOKS=true;")
        page.goto(URL)
        results = page.evaluate("cases => cases.map(c => ({ fields: window.__todo.parsePipeMail(c.mail), installs: window.__todo.parsePipeMailInstallations ? window.__todo.parsePipeMailInstallations(c.mail) : [] }))",
                                [{"mail": c["mail"]} for c in cases])
        browser.close()

    per_field, misses, total, good = {}, [], 0, 0
    for case, res in zip(cases, results):
        got = res["fields"]
        for field, want in case["expect"].items():
            ok = norm(field, got.get(field)) == norm(field, want)
            s = per_field.setdefault(field, [0, 0]); s[1] += 1; s[0] += ok
            total += 1; good += ok
            if not ok:
                misses.append(f"  [{case['name']}] {field}: attendu {want!r}, lu {got.get(field)!r}")
        if "installs" in case:
            # every field listed for each expected installation is compared
            keys = sorted({k for i in case["installs"] for k in i})
            want = [tuple(norm("centrale", i.get(k)) for k in keys) for i in case["installs"]]
            have = [tuple(norm("centrale", i.get(k)) for k in keys) for i in res["installs"]]
            ok = want == have
            s = per_field.setdefault("installations", [0, 0]); s[1] += 1; s[0] += ok
            total += 1; good += ok
            if not ok:
                misses.append(f"  [{case['name']}] installations: attendu {want}, lu {have}")

    print(f"Exactitude globale : {good}/{total} = {good / total:.0%}\n")
    for field, (g, n) in sorted(per_field.items(), key=lambda kv: kv[1][0] / kv[1][1]):
        print(f"  {field:<14} {g:>2}/{n:<2} {g / n:.0%}")
    if misses:
        print("\nÉcarts :")
        print("\n".join(misses))
    if minimum is not None and good / total < minimum:
        sys.exit(1)


if __name__ == "__main__":
    main()
