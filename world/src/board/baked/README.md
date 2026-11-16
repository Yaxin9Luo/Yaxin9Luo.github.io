# Baked paintings for the board

Three pieces painted with PaintSim in Node (the vendored copy in `../vendor/`) and kept as textures.
`preview.webp` shows each one over the light board colour and over the dark one, with a rough lamp.
`mountains-context.webp` shows the mountain paint over a stand-in for the page's wash with the ridge drawn on top
(`context.py` makes it; the stand-in is not the page).

| file | pixels | drawn at | what |
| --- | --- | --- | --- |
| `peony-bloom.color.webp` / `.relief.webp` | 780 × 810 | 260 × 270 CSS px (3x) | the open bloom, the top of its stem, three leaves under it |
| `peony-branch.color.webp` / `.relief.webp` | 2880 × 270 | 960 × 90 CSS px (3x) | the band under the buttons: a heavy stem running left, peony leaves, one half-open bud, a twig at the end |
| `mountains.color.webp` / `.relief.webp` | 2200 × 1280 | 1100 × 640 CSS px (2x) | brushwork for the three mountains of the research map |

## Channels

- `*.color.webp`: **premultiplied** RGB, cover in alpha. Composite with `ONE, ONE_MINUS_SRC_ALPHA`
  (or `UNPACK_PREMULTIPLY_ALPHA_WEBGL = false` and treat the texture as premultiplied).
- `*.relief.webp`: R = paint thickness (255 = 3.2 PaintSim units; the impasto lights reach about 3.1, most paint is 0.3 to 1.2),
  G = gloss × cover, B = metal × cover (only the gold touches in the heart of the bloom). Height for the lamp is R.

## Peony: one space for both parts

The two parts were laid out in one space of 1160 × 400 units, one unit = one CSS px at the size they were painted for
(bloom about 210 px across). Keep one scale for both and they join by themselves.

- bloom image: origin (900, 0), size 260 × 270. Centre of the flower (1028, 130), radius about 100. Heart at (1021, 118).
- branch image: origin (0, 255), size 960 × 90.
- The stem leaves the bloom image through its bottom edge at local (60, 270) and enters the branch image through its
  right edge at local (960, 15). Both are the point (960, 270) of the shared space. The stem is about 8 px thick there.
- In the branch image the paint lies between local y = 9 and y = 83 and from x = 29 to the right edge. The stem runs
  at y = 58 to 64 for most of its length (8 px thick and woody at the right, thinning to a 2 px twig at the left).
- The top 28 px are free of paint for x < 640 (checked on the baked alpha: nothing at all there), so the four buttons
  can hang over that part. Right of x = 640 the bud (x 685 to 715, y 12 to 50), two leaves and the rising stem use the
  whole height.
- Light is from the upper left in both.

## Mountains: the reference box

Painted in the space of `mapSVG(1100, 640)` from `../../landing/landing.js` (the generator imports it, so the ridge is
the page's own). Draw the texture over the whole map box and let it stretch with the box; the soft wash stays under it
and the ridge line and nodes go on top.

**No pauses: the page thins the paint under labels.** The brushwork is continuous over each mass, through where the
node names sit; nothing here knows about the node labels. Each mass is built from broad planes (one touch, one colour and
value) laid at different angles round a few spurs that run down from the summit: faces left of a spur are light,
faces right of it darker and cooler, the whole left of a mountain lighter than its right. Small livelier planes sit
hard under the ridge, thick pale lights under the summits and along the spurs, thin dark clefts beside them. Nothing
is painted above the ridge (marks stop 4 to 15 px short of it, by their width) or below y = 594 (the baseline is at
606); the foot is uneven, long down the spurs and bitten back between them, with a few level pale drags.

**The third mountain goes on past the ridge.** The mint mass does not stop at x = 900 where the drawn ridge ends: it
climbs behind the loop and runs to the right edge of the box (x = 1100), under an undrawn slope through
(900, 363), (960, 262), (1040, 205), (1100, 170) (exported as EXT; there is no ridge line there, the page draws
its own dotted continuation). It is unfinished on purpose: fully painted low and to the left, thinning up and to the
right into a transparent lay-in with bare ground between the strokes, and six loose marks near the top right. The
loop's disc plus 14 px (centre and radius from mapSVG's loop: 956.5, 304.8, R 80.6) and the box of its two names
above it (869 to 1045 in x, 173 to 222 in y) carry no body paint; only thin lay-in passes behind the lower half of the disc.

Colour: blue left of x = 365, peach to x = 735, mint after it; a neighbour's colour enters only within 35 px of a boundary.

## Painting them again

```
OUT=/tmp/baked node peony.gen.mjs bake        # also: look [--scale n] [--dark], LOOK=dir for where the pictures go
OUT=/tmp/baked node mountains.gen.mjs bake
python3 encode.py /tmp/baked                  # WebP files and preview.webp, written here (needs Pillow with WebP)
node mountains.gen.mjs ridge > /tmp/ridge.json && python3 context.py mountains.color.webp /tmp/ridge.json /tmp/ctx.png
```

`kit.mjs` loads PaintSim, paints each piece over black and over white, and takes the paint alone from the difference
(cover = 1 − (white − black); colour = the one over black). Each generator is seeded, so a run gives the same picture.
