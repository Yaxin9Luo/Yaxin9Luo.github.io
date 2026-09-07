# World content sources and editorial decisions

Content audit: 7 September 2026. Base repository content was inspected at `d74149b` (`Update homepage research interests`). The interactive world is a fictional presentation of an actual research portfolio. Game ranks, spell names, locations, and collectibles are not academic credentials or research results.

## Local source coverage

| Source | Information used |
| --- | --- |
| `_pages/about.md` | Current PhD affiliation and advisor; collaboration with Xiaofu Chen; two main research directions; long-horizon design focus; LongCat internship; MBZUAI research assistantship; earlier educational and business journey; three dated news items; AutoDesign and selected publications; original author lists and links. |
| `_pages/about-cn.md` | Existing Chinese terminology and translations; corroborates the current research interests, two research roles, and selected publications. |
| `_pages/cv.md` | Exact education dates, expected PhD completion, DTU degree and thesis advisor, Edinburgh withdrawal, conference service, 2019 Peking University internship, CV link. |
| `_config.yml` | Name, portrait, academic email, Google Scholar, GitHub, LinkedIn, and Twitter handles. |
| `_data/navigation.yml` | The historical long-horizon-thoughts route; see the missing-page note below. |
| `_publications/APL.md` | APL title, ECCV 2024 venue, publisher link. |
| `_publications/gamma-MoD.md` | γ-MoD title, ICLR 2025 venue, arXiv link. |
| `_publications/DViN.md` | DViN title, CVPR 2025 venue, official proceedings link. |
| `_publications/DRAG.md` | DRAG title, ACL 2025 venue, arXiv link. |
| `_publications/OpenCaptchaWorld.md` | Open CaptchaWorld title and arXiv link; venue superseded by the newer homepage. |
| `_publications/NextGen-CAPTCHAs.md` | Next-Gen CAPTCHAs title and arXiv link; venue refreshed from its current author project page. |
| `images/Yaxin.JPG` | Existing portrait, unchanged. |
| `images/autodesign.webp`, `images/nextgen-captchas.png`, `images/opencaptchaworld.png`, `images/APL.png`, `images/MoD.png`, `images/DViN.png` | Existing project/paper images, unchanged. |
| `files/CV_YaxinLuo.pdf` | Existing downloadable CV, unchanged. |

`_posts/`, `_portfolio/`, example papers under `files/paper*.pdf`, and generic AcademicPages demonstrations were not treated as personal achievements. No template publication was imported.

## Primary sources used to complete or refresh publications

The seven identifiable works in the local publication/homepage collection were retained. Four additional papers were confirmed using primary publication records. This is a source-backed portfolio collection, not a claim to an exhaustive, live Google Scholar synchronization.

| Work | Primary source and use |
| --- | --- |
| AutoDesign | [arXiv](https://arxiv.org/abs/2608.13560): title, authors, 2026 preprint status, meta-harness/PosterBench summary. First-author asterisks are from the existing homepage. |
| Next-Gen CAPTCHAs | [Author project page](https://greenoso.github.io/NextGen-CAPTCHAs_webpage/): explicitly says “Accepted at ICML 2026”; matches the [official ICML 2026 event list](https://icml.cc/Downloads/2026). [arXiv](https://arxiv.org/abs/2602.09012) corroborates title/authors and abstract. The new world therefore uses ICML 2026 instead of the older local arXiv badge. |
| LLMSurgeon | [ACL Anthology proceedings](https://aclanthology.org/2026.acl-long.1964/): title, authors, ACL 2026, summary and official code link. [The proceedings PDF](https://aclanthology.org/2026.acl-long.1964.pdf) confirms equal contribution for Yaxin Luo and Jiacheng Cui. Added beyond the local collection. |
| Language-Pretraining-Induced Bias | [arXiv](https://arxiv.org/abs/2604.01833): exact title, both authors, bridge-training summary. [Published OpenReview PDF](https://openreview.net/pdf/898b36c4c66900cd8fd828804f300aaa1aabf4a6.pdf) is indexed with “Published in Transactions on Machine Learning Research (03/2026)” and the two authors. [OpenReview forum](https://openreview.net/forum?id=N7DSUbnzYo) is the canonical review link but direct browsing encountered a browser-verification page. This identifies the TMLR work already mentioned, without a title, in the original experience section. |
| Open CaptchaWorld | [arXiv](https://arxiv.org/abs/2505.24878): canonical spaced title and abstract; newer local homepage and CV supply NeurIPS 2025 status and equal-contribution marks. The project branding remains OpenCaptchaWorld in its links. |
| FADRM | [NeurIPS 2025 proceedings](https://papers.neurips.cc/paper_files/paper/2025/hash/5a733c79d35a9738dd52a22610baa2d0-Abstract-Conference.html): title, all six authors, venue, summary. [arXiv](https://arxiv.org/abs/2506.24125): official code link. Added beyond the local collection. |
| DRAG | [arXiv](https://arxiv.org/abs/2506.01954): full author list, abstract, ACL 2025 Main comment, official code link; [author repository](https://github.com/VILA-Lab/DRAG) corroborates venue and citation. |
| DViN | [CVPR proceedings](https://openaccess.thecvf.com/content/CVPR2025/html/Chen_DViN_Dynamic_Visual_Routing_Network_for_Weakly_Supervised_Referring_Expression_CVPR_2025_paper.html): authors, venue and abstract. [Official paper PDF](https://openaccess.thecvf.com/content/CVPR2025/papers/Chen_DViN_Dynamic_Visual_Routing_Network_for_Weakly_Supervised_Referring_Expression_CVPR_2025_paper.pdf) contains the public GitHub repository, replacing the anonymous link still present in the abstract page. |
| γ-MoD | [arXiv](https://arxiv.org/abs/2410.13859): authors and method summary; ICLR 2025 supplied by the local publication record and CV. |
| Dataset Distillation via Committee Voting | [arXiv](https://arxiv.org/abs/2501.07575): title, six authors, 2025 preprint status, summary and official code link. Added beyond the local collection. No conference acceptance is inferred. |
| APL | [Springer ECCV 2024 chapter](https://link.springer.com/chapter/10.1007/978-3-031-72624-8_12): authors, venue, summary, and official code link. |

No citation counts, h-index, GitHub stars, acceptance dates missing from the source, benchmark scores, or leadership claims beyond the author's original account were invented. Google Scholar was provided as a direct link; its contents were not successfully read during this audit. The publication list must not be labeled as Scholar-verified or exhaustive.

## Missing source and conflicts

- **Long-Horizon Research Thoughts:** `_data/navigation.yml` links `/long-horizon-research-thoughts/`, but no corresponding document exists in this checkout. A live GET on 7 September 2026 returned **HTTP 404** and the site's “Page Not Found” page. The research section therefore uses the explicit long-horizon research interests in `_pages/about.md` and `_pages/about-cn.md`, together with AutoDesign's actual method. It does not invent or attribute an essay to the author.
- **PhD year:** the homepage says “First-Year,” while the CV gives an August 2025 start. The world uses the durable “Machine Learning PhD Student” designation. It does not infer a current year of study.
- **PhD completion:** June 2029 is explicitly marked “expected”; it is not a completed degree.
- **Edinburgh:** the prose calls it a year of study; the CV records September 2020–March 2021 and withdrawal. The dated journey uses those exact CV dates and makes clear no degree was completed.
- **Queensland:** the source contains no dates or graduation claim. Its journey entry says dates were not recorded and does not invent a degree or medical-school admission. The short presentation preserves the business-to-research transition without amplifying the original account of an unsuccessful admission attempt.
- **Current experience:** the CV predates the LongCat internship; the newer English and Chinese homepages both support the April 2026–present internship and its two stated workstreams.
- **VILA affiliation:** the current advisor, original VILA research assistantship, and recent LLMSurgeon paper with Yaxin Luo's VILA Lab/MBZUAI affiliation support the profile's MBZUAI/VILA line.
- **Open CaptchaWorld venue:** the local publication front matter still says arXiv; the more recent homepage and CV say NeurIPS 2025. The world follows the newer records.
- **Next-Gen venue:** the author project page explicitly confirms ICML 2026, superseding the arXiv badge in the local homepage. The old February news item stays an announcement, rather than being retrospectively rewritten as an acceptance announcement.
- **News dates:** the local Next-Gen news date is 10 February 2026; arXiv's initial submission is 9 February UTC. The world preserves the author's announcement date and does not claim it is the submission timestamp.
- **Email:** `_config.yml` and the CV share the academic email used in the world. An older footer contains a different personal address. The primary academic email is used consistently.
- **Images:** five works have no dedicated original image in this repository (LLMSurgeon, language-bias, FADRM, DRAG, committee-voting). Their `image` is an empty string. The renderer should omit the image element or use an explicitly decorative generic treatment; it must not depict another paper's figure as theirs.
- **Live projects:** existing project/demo links are preserved as source links. This content audit does not claim the external services are operational; their behavior needs separate browser validation.

## Translation and data contract

- `world/src/content.js` exports exactly the requested named collections: `profile`, `research`, `publications`, `experience`, `journey`, `news`, and `links`.
- Human-readable prose is represented as `{ en, zh }`. Stable identifiers, canonical author strings, conference abbreviations, dates, image paths, and URLs remain language-independent as requested.
- The spelling **Yaxin Luo** is kept in both locales. No Chinese-character name was supplied by the source and none is guessed. Advisors' and collaborators' names also retain their published Latin spelling.
- Chinese paper titles are editorial translations for this website, not claims of official publisher translations. The English field preserves canonical published titles. The descriptions are short paraphrases, not copied abstracts.
- “Native multimodal foundation models” → “原生多模态基础模型”; “long-horizon” → “长程”; “recursive self-improvement” → “递归式自我改进”; “referring expression comprehension” → “指代表达理解”; “visual grounding” → “视觉定位.” Technical terms such as Harness, Meta-Harness, and rollout are retained where translating them would blur their meaning.
- Research intent uses “aim,” “explore,” “ongoing,” and the Chinese equivalents. Published results are attributed to the corresponding paper. A recursively self-improving general agent is not claimed as an achieved system.
- `venue` contains the conference/journal abbreviation or `arXiv`; `year` is a number representing the displayed publication venue year. Render these together. `authors` contains `*` only where equal contribution was verified in the local homepage or official paper.
- `links.cv` is the root-relative `/files/CV_YaxinLuo.pdf`, matching the existing local asset and working on the GitHub Pages root deployment.
- The dataset includes 11 publications, 6 research topics, 5 experience entries, 4 journey entries, and 3 original news items. Missing factual data is omitted or explicitly described as unrecorded. Fictional world-building remains outside these factual records.
