# Resume and portfolio refresh — 8 September 2026

The supplied `罗亚鑫_简历.html`, `罗亚鑫_简历.pdf`, and `Yaxin_Luo_Resume.html` are the editorial sources for this update. Original attachments were preserved. Updated editable copies live in `files/`; both website entrances now use their current content.

## Resume files and GitHub snapshot

GitHub's repository API was rechecked before the v4 publication on 2026-09-09 (Asia/Shanghai); FigMirror increased from 509 to 510 since the initial resume refresh:

| Project | Repository | Stars |
| --- | --- | ---: |
| AutoDesign | https://github.com/Yaxin9Luo/AutoDesign | 197 |
| FigMirror | https://github.com/VILA-Lab/FigMirror | 510 |

The canonical project spelling is **FigMirror**. `_data/open-source.json` stores the count and timestamp. Both editable resumes, PDF exports, traditional pages, and interactive project readers show this dated snapshot. These are verified snapshot counts, not a continuously polled live counter.

The supplied Chinese PDF was used as a two-page layout reference. Both updated HTMLs were exported to two-page A4 PDFs after refreshing the star badges. The English source was HTML only.

```sh
weasyprint -s scripts/resume-print.css 'files/罗亚鑫_简历.html' files/CV_YaxinLuo_zh.pdf
weasyprint -s scripts/resume-print.css files/Yaxin_Luo_Resume.html files/CV_YaxinLuo.pdf
```

Export used WeasyPrint 69.0. The print-only stylesheet fixes header-column widths and page breaks for this renderer; it does not alter the editable HTML screen layout. PDF regeneration is an editorial task, not a deployment dependency.

The English compatibility URL remains `/files/CV_YaxinLuo.pdf`; Chinese uses `/files/CV_YaxinLuo_zh.pdf`. Interactive CV links follow the selected language. Traditional CV pages expose both PDFs and both editable HTMLs at `/traditional/cv/` and `/traditional/zh/cv/`.

## Content synchronized

- Current research: native multimodal systems, production-grade multimodal agentic design, and automated iteration of long-horizon agent harnesses.
- Meituan M17 LongCat internship: execution, tool calls, rollout recording, evaluation, component updates, acceptance gates, and trajectories for subsequent model training. Harness iteration at a fixed model capability boundary is distinguished from model training.
- AutoDesign: Designer–Critic and Meta-Harness Optimization, editable deliverables, and the resume's PosterBench results. The numerical results are attributed to poster evaluation; examples in other formats are not presented as additional benchmark results.
- FigMirror: reference-driven scientific plotting, editable Matplotlib outputs, the supplied resume's contribution description, and a real image from the [official showcase](https://github.com/VILA-Lab/FigMirror/blob/d37edebbc7cb80acecfd949d3a3615f44c13929a/docs/assets/showcase/primary-generated.jpg). It is labeled an open-source project, not an invented paper or sole-author achievement. The exhibit and reader reuse the existing presentation system.
- MBZUAI research assistantship, research summaries, contact details, education dates, traditional sidebar/footer research terms, and publication venue labels were refreshed.

Four collaborative papers from the new resume were added to the existing eleven. Canonical titles, author lists, dates, and short summaries were checked against primary arXiv metadata:

| Work | Primary source |
| --- | --- |
| DARTree | https://arxiv.org/abs/2608.13524 |
| VideoCoCo | https://arxiv.org/abs/2607.27380 |
| Fine-Grained Detail Targeting | https://arxiv.org/abs/2602.17645 |
| Dynamic Pyramid Network | https://arxiv.org/abs/2503.20322 |

No images were invented for these papers. Existing verified equal-contribution marks remain. The robustness paper has only a high-level research description. The 15-paper list is a curated resume-backed collection, not a claim of live Google Scholar synchronization.

The new source supplies the Chinese name 罗亚鑫, DTU completion in April 2025, Edinburgh study through April 2021, and an ongoing PhD. The website preserves the previous explicit statement that Edinburgh studies did not result in a completed degree; the supplied resume files' wording is otherwise retained. The old expected PhD end date is no longer displayed as the current timeline endpoint.

`world/src/content.js` and `world/src/exhibition-content.js` are the shared editorial source. `scripts/sync-portfolio-data.mjs` exports reviewed facts to `_data/portfolio.json` for Jekyll and runs during `npm run build:site`. Tests detect drift between the generated snapshot and interactive content.

## Verification

- All 216 existing and extended Node tests passed, including language-dependent CV downloads, dated star badges, shared-content consistency, and FigMirror software/project routing.
- Full Vite + Jekyll build passed; both website entrances and 44 legacy redirects were generated.
- Both PDFs have two A4 pages and 21 link annotations. Text extraction confirms both project names and updated counts. All four rendered PDF pages were visually inspected.
- Local HTTP checks returned 200 for both homepages, both CV pages, the publication list, both PDFs, both editable HTMLs, and the FigMirror image.
- Browser checks exercised the FigMirror detail page, Chinese-to-English switching, matching CV URLs, image enlargement, and traditional CV layout. No world-page warning/error logs appeared during these checks. The expanded download row was refined after visual inspection.
- The world geometry, materials, animation, lighting, and quality defaults are unchanged. This release does not claim a new M4 performance measurement.

Local review evidence is under the ignored `work/resume-refresh/` directory. Production verification is recorded there separately after the exact commit's GitHub Pages deployment completes.
