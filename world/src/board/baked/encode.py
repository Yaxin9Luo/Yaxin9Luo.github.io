#!/usr/bin/env python3
"""Turn the PNG files that the generators bake into the WebP files the board loads, and make the contact sheet.

    OUT=/some/tmp node peony.gen.mjs bake && OUT=/some/tmp node mountains.gen.mjs bake
    python3 encode.py /some/tmp            # writes *.color.webp, *.relief.webp and preview.webp beside this file

colour: premultiplied RGB with cover in alpha.  relief: R thickness (255 = 3.2 units of PaintSim), G gloss, B metal.
"""
import sys, os
from PIL import Image, ImageChops, ImageFilter, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '_png')
STEMS = ['peony-bloom', 'peony-branch', 'mountains']
BOARD = {'light': (246, 246, 250), 'dark': (14, 16, 32)}

def lamp(color, relief, ground):
    """The paint over a ground, with a rough lamp from the upper left read off the thickness. Only for judging by eye."""
    r, g, b, a = color.split()
    base = Image.new('RGB', color.size, ground)
    out = ImageChops.add(ImageChops.multiply(base, Image.merge('RGB', [ImageChops.invert(a)] * 3)), Image.merge('RGB', (r, g, b)))   # premultiplied over
    h = relief.split()[0].filter(ImageFilter.GaussianBlur(.8))
    lit = ImageChops.subtract(h, ImageChops.offset(h, -2, -2), scale=1, offset=0)      # slopes that face the lamp
    shade = ImageChops.subtract(ImageChops.offset(h, -2, -2), h, scale=1, offset=0)    # slopes that face away
    k = lambda im, f: ImageChops.multiply(im.point(lambda v: min(255, int(v * f))), a)
    out = ImageChops.add(out, Image.merge('RGB', [k(lit, 2.2)] * 3))
    out = ImageChops.subtract(out, Image.merge('RGB', [k(shade, 1.6)] * 3))
    return out

tiles, total = [], 0
for stem in STEMS:
    color = Image.open(os.path.join(src, stem + '.color.png')).convert('RGBA')
    relief = Image.open(os.path.join(src, stem + '.relief.png')).convert('RGB')
    color.save(os.path.join(here, stem + '.color.webp'), 'WEBP', quality=70 if stem == 'mountains' else 86, alpha_quality=92, method=6, exact=True)
    relief.save(os.path.join(here, stem + '.relief.webp'), 'WEBP', quality=78, method=6)
    for kind in ('color', 'relief'):
        n = os.path.getsize(os.path.join(here, f'{stem}.{kind}.webp')); total += n
        print(f'{stem}.{kind}.webp  {color.size[0]}x{color.size[1]}  {n / 1000:.0f} kB')
    back = Image.open(os.path.join(here, stem + '.color.webp')).convert('RGBA')         # judge what was written, not what was meant
    backr = Image.open(os.path.join(here, stem + '.relief.webp')).convert('RGB')
    tiles.append((stem, [lamp(back, backr, BOARD[m]) for m in ('light', 'dark')]))
print(f'total {total / 1000:.0f} kB')

# contact sheet: each asset over the light board and over the dark one, at half its baked size
W = 1500; rows = []
for stem, pair in tiles:
    w = min(W // 2 - 8, pair[0].size[0] // 2) if stem != 'peony-branch' else W - 8
    row = [im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS) for im in pair]
    rows.append((stem, row, stem == 'peony-branch'))
H = sum((r[0].size[1] * (2 if stack else 1)) + 34 for _, r, stack in rows) + 10
sheet = Image.new('RGB', (W, H), (128, 128, 134)); d = ImageDraw.Draw(sheet); y = 6
for stem, row, stack in rows:
    d.text((6, y), stem + '   (left / top: over #F6F6FA   right / bottom: over #0E1020)', fill=(255, 255, 255)); y += 18
    if stack:
        for im in row: sheet.paste(im, (4, y)); y += im.size[1]
    else:
        sheet.paste(row[0], (4, y)); sheet.paste(row[1], (W // 2 + 4, y)); y += row[0].size[1]
    y += 16
sheet.save(os.path.join(here, 'preview.webp'), 'WEBP', quality=84, method=6)
print('preview.webp', sheet.size, f'{os.path.getsize(os.path.join(here, "preview.webp")) / 1000:.0f} kB')
