# Yaxin Luo · Interactive Portfolio

An original magical academy for Yaxin Luo's bilingual research portfolio. The requested work is authorized on `codex/enchanted-research-world`; the existing production branch stays available for review before integration.

## Experience and art direction

Reflective water under a muted HDR sky, weathered limestone, oxidized copper spires, warm lancet windows, mossy cliffs, natural pine and ash trees, and restrained brass accents. An elevated cinematic arrival becomes an approachable broom-flight game. Six locations map to the scholar, publications, projects, research, journey and contact. Visible map/menu controls and portkeys follow the accessibility lessons in Bruno Simon's devlog, especially 1:00–4:50.

The referenced repository is https://github.com/brunosimon/folio-2025 (MIT). Its README documents separated input/player/render phases, location interactions, map, atmosphere and asset compression. This implementation uses original code and procedural geometry; no vehicle, branding, Blender assets or backend copied.

## Functional scope

- Free broom flight, keyboard and touch controls, orbit camera, altitude, sprint, boundary recovery.
- Three distinct spells, shield, animated wisps, non-graphic combat and renewable energy.
- Ordered flight-ring time trial, collectible stardust, six discoveries and local achievements.
- Unified bilingual grimoire, instant access to factual content, map portkeys and visible traditional entrance.
- Optional synthesized ambient audio, reduced motion, graphics settings, pause and restart.
- Validated local save, no sign-in, network service, public leaderboard, or multiplayer required.

## Implementation

The new application is isolated in `world/`, built with Vite and Three.js. Simulation, world geometry, content, UI and persisted progress live in separate modules. The complete original Jekyll site builds at `/traditional/`; combined static output is `dist/`. Content carries source notes. Unknown scholarly statistics are omitted. Fiction exists in game framing only.

## Completion gates

Build both experiences; verify real HTTP asset paths. Play travel, spell combat, ring ordering, pause/resume, bilingual content and navigation. Verify mobile layout and actual touch controls. Test save validation and game state contracts. Inspect representative rendered views for readability, geometry, light and clipping. Record measured local performance without claiming untested device performance. Push the feature branch and create a reviewable draft PR; retain the live traditional site until merge.
