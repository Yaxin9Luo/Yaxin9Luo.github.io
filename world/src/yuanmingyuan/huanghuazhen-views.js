// Subject-to-camera vectors. These independent presets do not register the
// study with the formal scene or assert a successful native review.
export const huanghuazhenStudyViews = {
  threequarter: { label: '迷阵与园门 · Maze and garden gate', groups: [], direction: [.56, .70, 1] },
  front: { label: '花园正面 · Historic front', groups: ['huanghuazhen-traced-brick-maze', 'huanghuazhen-central-octagonal-pavilion', 'huanghuazhen-north-small-hall'], direction: [0, .51, 1] },
  aerial: { label: '四门路径 · Four entry routes', groups: ['huanghuazhen-traced-brick-maze', 'huanghuazhen-central-octagonal-pavilion'], direction: [.02, 1, .04], margin: 1.06 },
  pavilion: { label: '高台八方亭 · Raised octagonal pavilion', groups: ['huanghuazhen-central-octagonal-pavilion'], isolate: ['huanghuazhen-central-octagonal-pavilion'], direction: [.42, .30, 1] },
  passage: { label: '亭内开口 · Pavilion passage', groups: ['huanghuazhen-pavilion-screens-and-open-passages', 'huanghuazhen-central-round-platform'], isolate: ['huanghuazhen-central-octagonal-pavilion'], direction: [0, .02, 1], margin: 1.04 },
  roof: { label: '穹顶与雕冠 · Dome and crown', groups: ['huanghuazhen-pavilion-complete-dome'], isolate: ['huanghuazhen-central-octagonal-pavilion'], direction: [.4, .36, 1] },
  brick: { label: '青砖迷墙 · Carved brick wall', groups: ['huanghuazhen-wall-outer-southwest'], isolate: ['huanghuazhen-traced-brick-maze', 'huanghuazhen-south-maze-gate'], direction: [.1, .20, 1], crop: { min: [.58, 0, .87], max: [.90, 1, 1] }, margin: 1.05 },
  gate: { label: '花园门北面 · Garden gate north', groups: ['huanghuazhen-garden-gate-masonry', 'huanghuazhen-garden-gate-curved-crown'], isolate: ['huanghuazhen-garden-gate-north-elevation'], direction: [0, .12, -1], margin: 1.1 },
  'gate-detail': { label: '门庭石雕 · Garden gate stonework', groups: ['huanghuazhen-garden-gate-curved-crown'], isolate: ['huanghuazhen-garden-gate-north-elevation'], direction: [.23, .08, -1] },
  bridge: { label: '园门水桥 · Garden gate water bridge', groups: ['huanghuazhen-garden-gate-bridge'], isolate: ['huanghuazhen-garden-gate-bridge', 'huanghuazhen-garden-gate-channel'], direction: [-.55, .47, -1] },
};
