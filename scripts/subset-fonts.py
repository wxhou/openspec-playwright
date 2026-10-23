#!/usr/bin/env python3
"""Regenerate the CJK subsets in docs/fonts/ from the page's charset.

The landing page self-hosts Noto Serif SC 400 (hero emphasis) and Noto Sans
SC 400/600 (Chinese body + display), subset to exactly the CJK characters
used in docs/index.html + docs/script.js (including the CLAUDE_MD_*
copy-button embeds). Editing landing copy can introduce characters a subset
lacks — re-run this script after any copy change:

    npm run fonts:subset

Requires: python3 with `fonttools` and `brotli` (`python3 -m pip install fonttools brotli`),
plus `npm` (fetches the @fontsource packages). Latin fonts in docs/fonts.css are
full-coverage variable files and never need re-subsetting.
"""
import glob
import os
import re
import subprocess
import sys
import tarfile
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(REPO, "docs")
FONTS = [
    {
        "family": "Noto Serif SC",
        "package": "@fontsource/noto-serif-sc",
        "weight": "400",
        "slug": "noto-serif-sc",
    },
    {
        "family": "Noto Sans SC",
        "package": "@fontsource/noto-sans-sc",
        "weight": "400",
        "slug": "noto-sans-sc",
    },
    {
        "family": "Noto Sans SC",
        "package": "@fontsource/noto-sans-sc",
        "weight": "600",
        "slug": "noto-sans-sc",
    },
]
CJK_MARKER = "/* ── CJK subsets"
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


def fetch_source(work: str, package: str, slot: str) -> str:
    """npm pack the fontsource package, return the extracted package dir."""
    dest = os.path.join(work, slot)
    os.makedirs(dest)
    subprocess.run(
        ["npm", "pack", package, "--pack-destination", dest],
        check=True,
        capture_output=True,
    )
    tgz = glob.glob(os.path.join(dest, "*.tgz"))[0]
    with tarfile.open(tgz) as tar:
        tar.extractall(dest)
    return os.path.join(dest, "package")


def select_slices(pkg_dir: str, charset: str, weight: str) -> list[tuple[str, str]]:
    """Return (slice filename, @font-face block) pairs whose unicode-range
    intersects the charset."""
    with open(os.path.join(pkg_dir, f"{weight}.css"), encoding="utf-8") as fh:
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


def build_font(
    pkg_dir: str, charset: str, spec: dict, work: str, index: int, text_path: str
) -> str:
    weight = spec["weight"]
    out_path = os.path.join(DOCS, "fonts", f"{spec['slug']}-subset-{weight}.woff2")
    slices = select_slices(pkg_dir, charset, weight)
    if not slices:
        fail(f"no source slices matched the charset for {spec['family']} {weight}")
    print(f"source slices: {len(slices)} ({spec['family']} {weight} from {spec['package']})")

    merged = os.path.join(work, f"merged-{index}.ttf")
    merge_slices(pkg_dir, [name for name, _ in slices], work, merged)
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", merged,
            f"--text-file={text_path}",
            "--flavor=woff2", f"--output-file={out_path}",
            "--layout-features=*", "--desubroutinize", "--name-IDs=1,2",
        ],
        check=True,
    )
    return out_path


def main() -> None:
    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        fail("fonttools/brotli missing — run: python3 -m pip install fonttools brotli")

    charset = collect_charset()
    print(f"charset: {len(charset)} CJK chars (+{len(ASCII_TAIL)} ASCII tail)")

    with tempfile.TemporaryDirectory(prefix="ospw-fonts-") as work:
        text_path = os.path.join(work, "subset-text.txt")
        with open(text_path, "w", encoding="utf-8") as fh:
            fh.write(charset + ASCII_TAIL)

        packages: dict[str, str] = {}
        outputs = []
        for index, spec in enumerate(FONTS):
            pkg_dir = packages.get(spec["package"])
            if pkg_dir is None:
                pkg_dir = fetch_source(work, spec["package"], f"pkg-{index}")
                packages[spec["package"]] = pkg_dir
            outputs.append(build_font(pkg_dir, charset, spec, work, index, text_path))

    # Rewrite the fonts.css CJK section deterministically.
    css_path = os.path.join(DOCS, "fonts.css")
    with open(css_path, encoding="utf-8") as fh:
        css = fh.read()
    head = re.split(r"/\* ── (?:CJK subsets|Noto Serif SC|Noto Sans SC)", css)[0].rstrip()
    blocks = []
    for spec in FONTS:
        blocks.append(
            "@font-face {\n"
            f"  font-family: '{spec['family']}';\n"
            "  font-style: normal;\n"
            f"  font-weight: {spec['weight']};\n"
            "  font-display: swap;\n"
            f"  src: url(fonts/{spec['slug']}-subset-{spec['weight']}.woff2) format('woff2');\n"
            "}\n"
        )
    section = (
        f"\n\n{CJK_MARKER} (page charset, {len(charset)} CJK chars + ASCII) ── */\n"
        + "\n".join(blocks)
    )
    with open(css_path, "w", encoding="utf-8") as fh:
        fh.write(head + section)

    for spec, out_path in zip(FONTS, outputs):
        size = os.path.getsize(out_path)
        print(f"written: {os.path.relpath(out_path, REPO)} ({size / 1024:.0f} KB)")
    print("done — commit docs/fonts/ + docs/fonts.css if changed")


if __name__ == "__main__":
    main()
