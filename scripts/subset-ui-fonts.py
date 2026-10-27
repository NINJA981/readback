"""
Subsets the three faces the popup and options page use (src/styles/app.css) so
they stay under the DESIGN.md per-face font budget of 40 KB. Run by hand when
the glyph set or weights change; the outputs are committed.

  python scripts/subset-ui-fonts.py

Needs fonttools + brotli. Source: the Fontsource packages in node_modules.
Glyphs: printable ASCII, Latin-1, curly quotes, dashes, ellipsis, middle dot, arrows,
return arrow and command keycap. Hubot Sans is used only for h1/h2 at 600 with
wdth 104-106; Mona Sans 420-650; Geist Mono 450 (DESIGN.md UI scale).
"""
import io
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]
FILES = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "src" / "assets" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)

# Latin-1 is included because names the user ignores can carry accents ("José").
UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [
    0x20AC,
    0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026,
    0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2318, 0x21B5, 0x21E7, 0x2325,
]


def build(src: Path, dest: Path, limits: dict) -> None:
    font = TTFont(src)
    font = instancer.instantiateVariableFont(font, limits)
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    font = TTFont(buf)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "case", "ccmp", "locl", "mark", "mkmk"]
    opts.name_IDs = [1, 2]
    opts.notdef_outline = True
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(dest)
    print(dest.name, dest.stat().st_size, "bytes")


build(
    FILES / "hubot-sans" / "files" / "hubot-sans-latin-wdth-normal.woff2",
    OUT / "hubot-sans-ui.woff2",
    {"wdth": (104, 106), "wght": 600},
)
build(
    FILES / "mona-sans" / "files" / "mona-sans-latin-wdth-normal.woff2",
    OUT / "mona-sans-ui.woff2",
    {"wdth": 100, "wght": (420, 650)},
)
build(
    FILES / "geist-mono" / "files" / "geist-mono-latin-wght-normal.woff2",
    OUT / "geist-mono-ui.woff2",
    {"wght": 450},
)
