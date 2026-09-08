"""Build a small Three Font subset from the existing, OFL-licensed Inter file.

No new font source is downloaded. Licence: world/public/fonts/OFL-inter.txt.
Build dependencies: fonttools and skia-pathops (no runtime dependencies).
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.ttLib.removeOverlaps import removeOverlaps

ROOT = Path(__file__).resolve().parents[3]
font = TTFont(ROOT / 'world/public/fonts/inter.ttf')
if 'fvar' in font:
    from fontTools.varLib.instancer import instantiateVariableFont
    font = instantiateVariableFont(font, {'wght': 600}, inplace=False)
cmap = font.getBestCmap()
characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ?'
# TrueType's non-zero fill tolerates overlapping strokes. Three's polygon
# triangulator needs simple contours; notably Inter's V overlaps at its tip.
removeOverlaps(font, glyphNames=[cmap[ord(char)] for char in characters])
source = font.getGlyphSet()

def numbers(point):
    return ' '.join(str(round(v, 3)) for v in point)

class Outline(BasePen):
    def __init__(self):
        super().__init__(source)
        self.commands = []
        self.start = None
    def _moveTo(self, p):
        self.start = p
        self.commands.append('m ' + numbers(p))
    def _lineTo(self, p):
        self.commands.append('l ' + numbers(p))
    def _qCurveToOne(self, control, end):
        self.commands.append('q ' + numbers(end) + ' ' + numbers(control))
    def _curveToOne(self, a, b, end):
        self.commands.append('b ' + numbers(end) + ' ' + numbers(a) + ' ' + numbers(b))
    def _closePath(self):
        if self.start:
            self.commands.append('l ' + numbers(self.start))

glyphs = {}
for char in characters:
    name = cmap[ord(char)]
    outline = Outline()
    source[name].draw(outline)
    glyphs[char] = {'ha': source[name].width, 'x_min': 0, 'x_max': source[name].width, 'o': ' '.join(outline.commands)}
head = font['head']
data = {'familyName': 'Academy Signage Subset', 'resolution': head.unitsPerEm, 'boundingBox': {'yMin': head.yMin, 'yMax': head.yMax}, 'underlineThickness': font['post'].underlineThickness, 'glyphs': glyphs, 'source': 'Inter Project Authors; world/public/fonts/inter.ttf; SIL OFL 1.1, see world/public/fonts/OFL-inter.txt'}
(ROOT / 'world/src/signage-font.json').write_text(json.dumps(data, separators=(',', ':')) + '\n')
