#!/usr/bin/env python3
"""The mountain brushwork judged in its place: over a stand-in for the page's wash, with the ridge drawn on top.
    node mountains.gen.mjs ridge > ridge.json ; python3 context.py mountains.color.webp ridge.json out.png
The stand-in is not the page: a soft fall of each phase colour under the ridge, fading to white at the foot."""
import sys, json
from PIL import Image, ImageDraw, ImageFilter
col, rj, out = sys.argv[1:4]
g = json.load(open(rj)); R = g['ridge']; foot = g['foot'] + 12; e = g['edge']; S = 2
paint = Image.open(col).convert('RGBA'); W, H = paint.size
PH = [(92, 108, 230), (240, 150, 96), (70, 190, 160)]
def ry(x):
    for a, b in list(zip(R, R[1:])) + list(zip(g['ext'], g['ext'][1:])):
        if b[0] >= x >= a[0] and b[0] > a[0]: return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])
    return None
wash = Image.new('RGB', (W, H), (250, 250, 252)); px = wash.load()
for X in range(W):
    x = X / S; y0 = ry(x)
    if y0 is None: continue
    t = [1, 0, 0] if x < e[0] - 30 else [0, 1, 0] if e[0] + 30 <= x < e[1] - 30 else [0, 0, 1] if x >= e[1] + 30 else None
    if t is None:
        i = 0 if abs(x - e[0]) <= 30 else 1; k = (x - e[i] + 30) / 60; t = [0, 0, 0]; t[i] = 1 - k; t[i + 1] = k
    c = [sum(PH[j][n] * t[j] for j in range(3)) for n in range(3)]
    for Y in range(int(y0 * S), int(foot * S)):
        f = 1 - (Y / S - y0) / max(1, foot - y0); a = .34 * f ** 1.3
        px[X, Y] = tuple(int(250 + (c[n] - 250) * a) for n in range(3))
wash = wash.filter(ImageFilter.GaussianBlur(5))
r, gg, b, a = paint.split()
from PIL import ImageChops
base = ImageChops.multiply(wash, Image.merge('RGB', [ImageChops.invert(a)] * 3)); base = ImageChops.add(base, Image.merge('RGB', (r, gg, b)))
d = ImageDraw.Draw(base); d.line([(p[0] * S, p[1] * S) for p in R], fill=(22, 30, 80), width=9, joint='curve')
d.line([(8 * S, (foot) * S), (W - 8 * S, foot * S)], fill=(150, 150, 160), width=2)
E = g['ext']; L = g['loop']                                   # the continuation in dots, the loop's disc, its two names
for i in range(40):
    t = i / 40 * (len(E) - 1); j = min(len(E) - 2, int(t)); k = t - j; x = E[j][0] + (E[j + 1][0] - E[j][0]) * k; y = E[j][1] + (E[j + 1][1] - E[j][1]) * k
    if (x - L['x']) ** 2 + (y - L['y']) ** 2 > L['R'] ** 2: d.ellipse([x * S - 2, y * S - 2, x * S + 2, y * S + 2], fill=(90, 96, 130))
d.ellipse([(L['x'] - L['R']) * S, (L['y'] - L['R']) * S, (L['x'] + L['R']) * S, (L['y'] + L['R']) * S], outline=(120, 124, 150), width=2)
d.rectangle([v * S for v in g['names']], outline=(170, 170, 185))
for b4 in json.loads(sys.argv[4]) if len(sys.argv) > 4 else []: d.rectangle([v * S for v in b4], outline=(120, 120, 130))
base.resize((W * 3 // 4, H * 3 // 4), Image.LANCZOS).save(out)
