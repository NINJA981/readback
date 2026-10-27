"""
Subsets the two faces the Gmail overlay needs into tiny woff2 files that the
content script embeds (no network, no web_accessible_resources). Run by hand
when the glyph set or weights change; the output is committed.

  python scripts/subset-overlay-fonts.py

Needs fonttools + brotli. Source: the Fontsource packages already in node_modules.
Glyphs: printable ASCII plus the punctuation the overlay copy uses.
Weights: Mona Sans 420-650 (DESIGN.md UI scale), Geist Mono 450 only.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
FILES = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "src" / "assets" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)

# ASCII + curly quotes, ellipsis, middle dot, arrows, en/em dash, return arrow, check, x.
UNICODES = list(range(0x20, 0x7F)) + [
    0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x00B7, 0x2192, 0x2013, 0x2014,
    0x21B5, 0x2318, 0x00A0, 0x20AC, 0x00A3, 0x00A5,
]

def build(src: Path, dest: Path, limits: dict) -> None:
    font = TTFont(src, lazy=False)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "case"]
    opts.name_IDs = [1, 2]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, limits)
    font.flavor = "woff2"
    font.save(dest)
    print(dest.name, dest.stat().st_size, "bytes")

build(
    FILES / "mona-sans" / "files" / "mona-sans-latin-wght-normal.woff2",
    OUT / "mona-sans-overlay.woff2",
    {"wght": (420, 650)},
)
build(
    FILES / "geist-mono" / "files" / "geist-mono-latin-wght-normal.woff2",
    OUT / "geist-mono-overlay.woff2",
    {"wght": 450},
)
