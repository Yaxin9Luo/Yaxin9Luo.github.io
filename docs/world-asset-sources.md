# World material sources / 魔法世界材质来源

The browser assets in `world/public/textures/` are real downloadable PBR material maps from Poly Haven and ambientCG. They are self-hosted, so opening the portfolio does not contact either provider. The acquisition script and manifest retain authorship, exact source URLs, physical dimensions where published, source verification, transformation settings, and SHA-256 hashes of every delivered file.

The complete set contains **35 WebP maps and two RGBE HDR environments**, totaling **22,220,066 bytes / 21.19 MiB**. This retains 2K masonry and slate normals, two complete 1K character material sets (2.56 MiB), and a photographic 2K pure-sky background (4.23 MiB). The remaining material maps are also 1K. Download size does not equal GPU memory usage: decoded textures and mipmaps need substantially more memory, so materials should be shared and loaded only when needed.

## Sources and scale

All material paths below use `/textures/<directory>/{color,normal,roughness}.webp`, except the additional maps described in the last column. Source dimensions are converted from the Poly Haven API's millimeters to meters without inferring missing values.

| Directory | Original asset and author | Delivered resolution | One full UV tile | Additional maps / notes |
| --- | --- | --- | --- | --- |
| `castle-masonry` | [Old Stone Wall 02](https://polyhaven.com/a/old_stone_wall_02), Charlotte Baglioni | 2048² | 2.085 × 2.085 m | Aged stone blocks and mortar; provider roughness is nearly uniform. |
| `slate-roof` | [Roof Slates 02](https://polyhaven.com/a/roof_slates_02), Rob Tuytel | 2048² | 3 × 3 m | Individual weathered slate tiles. |
| `mossy-rock` | [Mossy Rock](https://polyhaven.com/a/mossy_rock), Rob Tuytel | 1024² | 3 × 3 m | Cracks, lichen and moss. |
| `forest-ground` | [Forest Floor](https://polyhaven.com/a/forest_floor), eye-candy.xyz | 1024² | 2.14 × 2.14 m | Brown earth with orange/yellow fallen leaves; intended for understory. |
| `meadow` | [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock), Rob Tuytel | 1024² | 15 × 15 m | Olive grass and exposed stone for open ground. |
| `aged-wood` | [Weathered Planks](https://polyhaven.com/a/weathered_planks), Dario Barresi (processing), Dimitrios Savva (photography) | 1024² | 2 × 2 m | Dark wood grain and plank seams. |
| `pine-bark` | [Pine Bark](https://polyhaven.com/a/pine_bark), Dimitrios Savva | 1024² | 2 × 2 m | Scaly trunk bark. |
| `wool-cloth` | [Poly Wool Herringbone](https://polyhaven.com/a/poly_wool_herringbone), colormass (photography), Rico Cilliers (processing) | 1003 × 1024 | 0.2701 × 0.2757 m | Gray wool-polyester blend with fine herringbone weave for coats and robes. |
| `dark-leather` | [Brown Leather](https://polyhaven.com/a/brown_leather), Rob Tuytel | 1024² | 0.4 × 0.4 m | Matte brown leather grain and shallow wrinkles for boots, belts and gloves. |
| `oxidized-copper` | [Metal058C](https://ambientcg.com/a/Metal058C), ambientCG / Lennart Demes | 1024² | Unknown | `metalness.webp`; provider classifies this as `PBRProcedural`, not a measured scan. A ~1 m tile is an artistic starting point. |
| `foliage` | [LeafSet001](https://ambientcg.com/a/LeafSet001), ambientCG / Lennart Demes | 1024² | Unknown | `alpha.webp`; the color image also embeds opacity. Six leaves in a 3-column × 2-row atlas. Provider classification: `PBRApproximated`. |
| `environment/night.hdr` | [Moonless Golf](https://polyhaven.com/a/moonless_golf), Greg Zaal | 1024 × 512 | — | Unmodified Radiance RGBE night environment, 1,672,754 bytes. |
| `environment/sky.hdr` | [Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky), Greg Zaal (original), Jarod Guest (sky edits) | 2048 × 1024 | — | Unmodified Radiance RGBE, 4,434,394 bytes. Soft low sun, warm horizon, cool blue upper sky and separate cloud layers; ground objects removed by the provider. |

## Licenses and provenance

[Poly Haven's asset license](https://polyhaven.com/license) grants CC0 use and redistribution for its downloadable textures and HDRIs. The site separately excludes its preview/example renders and editorial material from that asset license. Only the downloadable maps and HDRI are shipped here.

[ambientCG's license](https://docs.ambientcg.com/license/) applies CC0 1.0 to its downloadable files and preview renders. The production directory contains asset maps, not preview renders. Both providers permit modification and inclusion in a distributed website. The common license is [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

The acquisition script uses the official public APIs and a project-specific User-Agent, following [Poly Haven's API terms](https://github.com/Poly-Haven/Public-API/blob/master/ToS.md). No proprietary game assets are extracted or redistributed. The magical architecture and characters are separate project geometry; these files supply surface detail and lighting.

`world/public/textures/manifest.json` is the detailed asset ledger. For Poly Haven it records the official API URLs, asset author fields, download URLs, provider MD5, source byte size, source SHA-256, and delivered SHA-256. For ambientCG it records the canonical download URL, archive SHA-256, declared archive size, each archive member, and extracted member SHA-256. The ambientCG API used here does not publish a cryptographic checksum, so its proof is declared size plus all ZIP CRC checks; locally calculated SHA-256 is recorded without claiming upstream authentication.

## Reproduce and verify

The ordinary Vite/site build consumes the committed assets and needs no provider API access. Regeneration requires Python 3, curl, and Pillow with WebP support. The verified environment used Python 3.14, Pillow 12.3.0, and libwebp 1.6.0.

```sh
python3 -m venv work/asset-tools
work/asset-tools/bin/pip install Pillow==12.3.0
work/asset-tools/bin/python scripts/fetch-world-assets.py
work/asset-tools/bin/python scripts/fetch-world-assets.py --verify
```

The source cache is `work/asset-acquisition/downloads/`, which is ignored by Git. The script checks source sizes and available provider checksums before conversion, checks archive CRCs before extraction, and verifies delivered hashes, dimensions, nonconstant color/normal data and foliage opacity. It publishes image files atomically so a running local preview does not see partially written images. Re-encoding with another Pillow/libwebp version can change output hashes; the committed manifest remains the reference for the delivered set.

Some local macOS routes terminated TLS 1.3 handshakes to the providers' storage hosts. The script uses curl with TLS 1.2 and normal certificate validation. This successfully downloaded the original official URLs without modifying system proxy settings or disabling HTTPS verification.

## Rendering contract

- Set `color.webp` to `THREE.SRGBColorSpace`. Normal, roughness, metalness and alpha are numeric data and use `THREE.NoColorSpace`.
- Normals use OpenGL **+Y**. Do not invert the green channel. Apply world-scale UVs using the physical tile sizes above; a tower should not stretch one tiny stone-wall tile over its entire facade.
- Cloth weave must stay small: one full herringbone tile covers about 27 cm, so a 1 m coat panel spans approximately 3.7 horizontal repeats. A full leather tile covers 40 cm. Material tint can recolor the gray cloth while preserving its actual weave; these scale values come from source metadata rather than an arbitrary 0.5 m approximation.
- Use the copper `metalness.webp` with its roughness map. The bright turquoise patina is intentional source color; restrained material tint and scene lighting can adapt it to the evening palette.
- Treat the leaf sheet as an atlas: crop/select one of six cells when constructing an individual leaf. For dense foliage, prefer `alphaTest` and two-sided leaf geometry to sorting many blended quads. Opacity is present both separately and in the color map.
- Load HDR files through Three.js `HDRLoader`. `environment/night.hdr` is a real night panorama and includes distant golf-course lamps; the current moonlit scene uses it for low-strength image-based lighting. `environment/sky.hdr` is retained from the earlier photographic-lighting iteration. The visible background now uses the blue night panorama documented in [night-garden-art.md](night-garden-art.md).
- Color is WebP quality 90; normal/scalar delivery is quality 95. These are lossy derivatives of the providers' 8-bit source images. Alpha remains lossless. The manifest reports sampled normal angular error against the decoded source at an 8-pixel stride; it does not call the normal compression lossless. Source and delivered resolutions remain identical.

All eleven actual color maps were inspected together. The visual check confirmed mortar, slate seams, rock fissures, ground foliage, olive grass, wood grain, bark, copper patina, fine cloth weave, brown leather grain and genuine leaf silhouettes. The offline audit checks file integrity and image data; full scene lighting, tiling, frame rate and browser rendering are evaluated by the main world QA.

After acquisition, all 37 resources returned HTTP 200 through the project's Vite preview at `http://127.0.0.1:4190`, with response SHA-256 matching the manifest. Both HDRs were decoded using the installed Three.js loaders to confirm finite HDR sample data, beyond their file headers.

## Earlier photographic sky selection and calibration

The actual provider thumbnails for Kloppenheim 06 and Kloofendal 48d were inspected before choosing the sky. Kloppenheim 06 has muted blue upper sky, several cloud layers, and a warm low horizon. Kloofendal 48d has stronger midday contrast and bright cloud tops. The selected source is photographed low-sun light; the provider describes sunrise, so a late-afternoon interpretation is an artistic use of its palette rather than a claim about capture time. Provider selection previews remain in ignored scratch storage and are not published as website assets.

With the current renderer's ACES tone mapping and exposure 1.13, start at `scene.backgroundIntensity = 0.75` and `scene.backgroundBlurriness = 0`. These are initial artistic settings for scene review. If using this sky for lighting as well, an `environmentIntensity` around 0.15–0.25 avoids overwhelming the existing hemisphere and key lights; the night environment may instead be retained for the established lighting.

The actual 2K HDR has upper-hemisphere median luminance 0.569, 99th-percentile luminance 3.67, and a brightest-region luminance of 33.13 in its stored linear units. Its brightest pixel is near `(1255, 485)`, corresponding to about 4.66° elevation and unrotated Three.js equirectangular world direction `[0.756, 0.081, 0.650]` (+X/+Z). This provides a starting direction for aligning the warm key light. It is measured from the downloaded map, not an asserted geographic bearing. The background and lighting rotations should be coordinated if the scene rotates the panorama.

## Terrain and foliage library review

[THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain) is an MIT-licensed procedural terrain library. Its current upstream supports Three.js r160+, ES modules, deterministic seeds, slope/elevation texture blending, and instanced grass with distance updates. Its documented blended material is based on `MeshLambertMaterial`. The useful ideas for this project are seeded scattering and slope-aware material weights; replacing the existing PBR terrain with that Lambert material would discard the newly acquired normal/roughness behavior. No additional terrain engine was integrated by this asset task.

[EZ Tree](https://github.com/dgreenheck/ez-tree) supplies procedural tree geometry, bark and leaf textures under MIT. The project has already installed `@dgreenheck/ez-tree` **1.1.0**; its local source and package license were checked. The current upstream README describes features newer than the installed version, so methods such as `generateLODs` must not be assumed available in 1.1.0. The main world integration imports the installed source and shares geometry/materials across instances. The optional CC0 leaf atlas here is independent of the library and can be used for additional plant varieties.
