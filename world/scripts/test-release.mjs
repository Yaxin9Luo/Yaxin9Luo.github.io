import {spawnSync} from 'node:child_process';
const files=[
  "tests/content.test.js",
  "tests/ui.test.js",
  "tests/logic.test.js",
  "tests/environment-time.test.js",
  "tests/time-contract.test.js",
  "tests/resource-loader.test.js",
  "tests/loading-coordinator.test.js",
  "tests/collision.test.js",
  "tests/surface-support.test.js",
  "tests/ground-motion.test.js",
  "tests/ground-recovery.test.js",
  "tests/gltf-resource.test.js",
  "tests/mutable-geometry.test.js",
  "tests/game.test.js",
  "tests/game-resize.test.js",
  "tests/game-timestep.test.js",
  "tests/game-review-loading.test.js",
  "tests/audio.test.js",
  "tests/exhibition.test.js",
  "tests/companion-ui.test.js",
  "tests/yuanmingyuan-museum-content.test.js",
  "tests/yuanmingyuan-museum-sites.test.js",
  "tests/yuanmingyuan-guides.test.js",
  "tests/yuanmingyuan-asset-archive.test.js",
  "tests/yuanmingyuan-asset-overview.test.js",
  "tests/yuanmingyuan-museum-overview-layer.test.js",
  "tests/yuanmingyuan-museum-distance-layer.test.js",
  "tests/yuanmingyuan-museum-guide-lifetime.test.js",
  "tests/yuanmingyuan-museum-context-recovery.test.js",
  "tests/yuanmingyuan-museum-visit-recovery.test.js",
  "tests/yuanmingyuan-museum-audio.test.js",
  "tests/yuanmingyuan-museum-timing.test.js",
  "tests/public-asset-url.test.js"
];
const result=spawnSync(process.execPath,['--test','--test-concurrency=1','--test-timeout=180000',...files],{stdio:'inherit',cwd:new URL('../',import.meta.url),timeout:1200000});
if(result.error)throw result.error;
process.exit(result.status??1);
