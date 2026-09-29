#!/usr/bin/env python3
"""Regenerate docs/fonts/noto-serif-sc-subset-600.woff2 from the page's charset.

The landing page self-hosts Noto Serif SC 600 subset to exactly the CJK
characters used in docs/index.html + docs/script.js (including the
CLAUDE_MD_* copy-button embeds). Editing landing copy can introduce
characters the subset lacks — re-run this script after any copy change:

    npm run fonts:subset

Requires: python3 with `fonttools` and `brotli` (`python3 -m pip install fonttools brotli`),
plus `npm` (fetches the @fontsource/noto-serif-sc source slices). Latin fonts in
docs/fonts.css are full-coverage variable files and never need re-subsetting.
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(REPO, "docs")
FONT_OUT = os.path.join(DOCS, "fonts", "noto-serif-sc-subset-600.woff2")
FONT_SOURCE_PACKAGE = "@fontsource/noto-serif-sc"
CJK_MARKER = "/* ── Noto Serif SC 600"
ASCII_TAIL = (
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    " .,;:!?()[]{}-–—·「」『』、。！？：；\"\"\n"
)


def fail(msg: str):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def collect_charset() -> str:
    chars: set[str] = set()
    for name in ("index.html", "script.js"):
        with open(os.path.join(DOCS, name), encoding="utf-8") as fh:
            chars.update(fh.read())
    cjk = "".join(sorted(c for c in chars if ord(c) > 0x2E80))
    if not cjk:
        fail("no CJK characters found in docs/ — nothing to subset")
    return cjk


def fetch_source(work: str) -> str:
    """npm pack the fontsource package, return the extracted package dir."""
    subprocess.run(
        ["npm", "pack", FONT_SOURCE_PACKAGE, "--pack-destination", work],
        check=True,
        capture_output=True,
    )
    tgz = glob.glob(os.path.join(work, "*.tgz"))[0]
    with tarfile.open(tgz) as tar:
        tar.extractall(work)
    return os.path.join(work, "package")


def select_slices(pkg_dir: str, charset: str) -> list[tuple[str, str]]:
    """Return (slice filename, @font-face block) pairs whose unicode-range
    intersects the charset."""
    with open(os.path.join(pkg_dir, "600.css"), encoding="utf-8") as fh:
        css = fh.read()
    used = {ord(c) for c in charset}
    picked: list[tuple[str, str]] = []
    for block in re.findall(r"@font-face\s*\{[^}]+\}", css):
        m_url = re.search(r"url\(\./files/([^)]+\.woff2)\)", block)
        m_range = re.search(r"unicode-range:\s*([^;]+);", block)
        if not (m_url and m_range):
            continue
        for part in m_range.group(1).split(","):
            part = part.strip().upper().replace("U+", "")
            lo, _, hi = part.partition("-")
            hi = hi or (part.replace("?", "F") if "?" in part else part)
            lo_int = int(lo.replace("?", "0"), 16)
            hi_int = int(hi, 16)
            if any(lo_int <= c <= hi_int for c in used):
                picked.append((m_url.group(1), block))
                break
    return picked


def merge_slices(pkg_dir: str, slices: list[str], work: str, out_ttf: str) -> None:
    from fontTools.merge import Merger
    from fontTools.ttLib import TTFont

    ttfs = []
    for i, name in enumerate(slices):
        font = TTFont(os.path.join(pkg_dir, "files", name))
        font.flavor = None
        path = os.path.join(work, f"slice_{i}.ttf")
        font.save(path)
        ttfs.append(path)
    Merger().merge(ttfs).save(out_ttf)


def main() -> None:
    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        fail("fonttools/brotli missing — run: python3 -m pip install fonttools brotli")

    charset = collect_charset()
    print(f"charset: {len(charset)} CJK chars (+{len(ASCII_TAIL)} ASCII tail)")

    with tempfile.TemporaryDirectory(prefix="ospw-fonts-") as work:
        pkg_dir = fetch_source(work)
        slices = select_slices(pkg_dir, charset)
        if not slices:
            fail("no source slices matched the charset — package layout changed?")
        print(f"source slices: {len(slices)} (from {FONT_SOURCE_PACKAGE})")

        merged = os.path.join(work, "merged.ttf")
        merge_slices(pkg_dir, [name for name, _ in slices], work, merged)
        text_path = os.path.join(work, "subset-text.txt")
        with open(text_path, "w", encoding="utf-8") as fh:
            fh.write(charset + ASCII_TAIL)
        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", merged,
                f"--text-file={text_path}",
                "--flavor=woff2", f"--output-file={FONT_OUT}",
                "--layout-features=*", "--desubroutinize", "--name-IDs=1,2",
            ],
            check=True,
        )

    # Rewrite the fonts.css tail (CJK section) deterministically.
    css_path = os.path.join(DOCS, "fonts.css")
    with open(css_path, encoding="utf-8") as fh:
        css = fh.read()
    head = css.split(CJK_MARKER)[0].rstrip()
    section = (
        f"\n\n{CJK_MARKER} (subset to the page's charset, {len(charset)} CJK chars + ASCII) ── */\n"
        "@font-face {\n"
        "  font-family: 'Noto Serif SC';\n"
        "  font-style: normal;\n"
        "  font-weight: 600;\n"
        "  font-display: swap;\n"
        "  src: url(fonts/noto-serif-sc-subset-600.woff2) format('woff2');\n"
        "}\n"
    )
    with open(css_path, "w", encoding="utf-8") as fh:
        fh.write(head + section)

    size = os.path.getsize(FONT_OUT)
    print(f"written: {os.path.relpath(FONT_OUT, REPO)} ({size / 1024:.0f} KB)")
    print("done — commit docs/fonts/ + docs/fonts.css if changed")


if __name__ == "__main__":
    main()
