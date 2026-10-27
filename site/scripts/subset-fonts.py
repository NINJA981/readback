"""
Subsets and axis-limits the three Fontsource variable fonts for the site
(DESIGN.md: bundled fonts only, small faces, metric-matched fallbacks).

  python scripts/subset-fonts.py

Reads node_modules/@fontsource-variable/*, writes src/fonts/*.woff2. The
outputs are committed so a build does not need Python. Fonts are SIL OFL 1.1.
"""
import io
import os
import sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "src", "fonts")
FF = os.path.join(ROOT, "node_modules", "@fontsource-variable")

# Basic Latin, Latin-1, general punctuation, currency, arrows used in the UI.
UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + list(range(0x2010, 0x2028))
    + list(range(0x2030, 0x203B))
    + [0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2318, 0x2325, 0x21E7, 0x21B5]
)

JOBS = [
    # name, source file, axis limits
    ("hubot-sans", "hubot-sans/files/hubot-sans-latin-wdth-normal.woff2", {"wdth": (104, 112), "wght": (550, 700)}),
    ("mona-sans", "mona-sans/files/mona-sans-latin-wdth-normal.woff2", {"wdth": 100, "wght": (400, 650)}),
    ("geist-mono", "geist-mono/files/geist-mono-latin-wght-normal.woff2", {"wght": (400, 600)}),
]

os.makedirs(OUT, exist_ok=True)
for name, rel, limits in JOBS:
    src = os.path.join(FF, rel)
    font = TTFont(src)
    font = instancer.instantiateVariableFont(font, limits)
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    font = TTFont(buf)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "case", "ccmp", "locl", "mark", "mkmk"]
    opts.name_IDs = [1, 2, 3, 4, 6]
    opts.notdef_outline = True
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    dest = os.path.join(OUT, f"{name}.woff2")
    font.flavor = "woff2"
    font.save(dest)
    print(f"{name}: {os.path.getsize(src)} -> {os.path.getsize(dest)} bytes", file=sys.stderr)
