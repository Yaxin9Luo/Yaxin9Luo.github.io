# Actual browser interaction evidence

2026-09-08, root-controlled Codex in-app browser, http://127.0.0.1:4197/ .

- English Projects → first View in the atelier: opened the real AutoDesign physical exhibit, actual output 1/6, project selector, source link and return visible.
- Actual canvas click on the opened method folio: opened AutoDesign reader; DOM focus was the `data-project-section="method"` container with the correct meta-harness/PosterBench description.
- Reader language switch to Chinese retained AutoDesign, six real media entries, publication provenance, author list and correct Chinese traditional link `/traditional/zh/`.
- Reader Return: returned to same AutoDesign physical exhibit and selected media in Chinese.
- Actual canvas click on the author plaque: DOM focus reached `data-project-section="role"`, Co-first author and complete team.
- Return then actual canvas click on output screen: opened accessible image viewer with the true AutoDesign poster and source link.

This validates actual raycast-to-reader/media wiring, not merely an isolated component API. No third-party forms or external destinations were submitted.

## Narrow viewport

The in-app viewport override 390×844 produced actual DOM CSS dimensions 312×675 and renderer 390×843 (browser scale 1.25). `documentElement.scrollWidth` was 312: no document-level horizontal overflow. Real Chinese project cards and the physical atelier were opened; the output screen, full desk, media controls, project switch and return fit the narrow composition. This is browser responsive testing, not a physical iPhone/GPU measurement.

## Settings on actual main page

Opened Settings from the visible homepage after closing nested reader history. Sound changed from muted to loading to ready after checking the opt-in control. Selected daytime through the actual time selector; high quality remained selected, with 4× MSAA shown. Restored sound off and automatic time at the end. The UI exposes independent music/effects volume, reduced motion, optional gameplay, and a stable explicit high/balanced/light selector. No user exploration progress was reset.

## Complete production build and traditional site

On the combined production build at `http://127.0.0.1:4200/`, followed the actual Traditional → Chinese homepage → CV navigation. The English research profile, Chinese article content and CV education/publications rendered with the original stylesheet. The CV page exposes `/traditional/files/CV_YaxinLuo.pdf` as both a download and embedded preview. Final HTTP availability and file sizes are recorded in `verification.json`.
