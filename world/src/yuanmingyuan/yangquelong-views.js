export const yangquelongStudyViews = {
  threequarter: { label: '两面门庭 · Two gateway façades', groups: [], direction: [-1, .45, .64] },
  west: { label: '养雀笼西面 · Chinese west gate', groups: ['yangquelong-west-chinese-gate', 'yangquelong-west-paired-fountains', 'yangquelong-north-south-bird-rooms'], direction: [-1, .15, 0] },
  east: { label: '养雀笼东面 · European east gate', groups: ['yangquelong-east-european-gate', 'yangquelong-north-south-bird-rooms'], direction: [1, .14, 0] },
  aerial: { label: '门庭与鸟室 · Passage and bird rooms', groups: ['yangquelong-main-through-passage', 'yangquelong-west-chinese-gate', 'yangquelong-east-european-gate', 'yangquelong-north-south-bird-rooms'], direction: [.28, 1, .20] },
  passage: { label: '东西穿行 · East–west passage', groups: ['yangquelong-main-through-passage'], isolate: ['yangquelong-main-through-passage', 'yangquelong-west-chinese-gate', 'yangquelong-east-european-gate'], direction: [-1, .02, 0], margin: 1.03 },
  roof: { label: '西门重檐 · West gate roof tiles', groups: ['yangquelong-west-high-central-roof', 'yangquelong-west-side-roof--1', 'yangquelong-west-side-roof-1'], isolate: ['yangquelong-west-chinese-gate'], direction: [-1, .44, .31] },
  eastcarving: { label: '东门曲栏 · East gate stone carving', groups: ['yangquelong-east-central-scroll-crest', 'yangquelong-east-curving-balustrade'], isolate: ['yangquelong-east-european-gate'], direction: [1, .14, -.18] },
  fountain: { label: '东门壁泉 · East wall fountain', groups: ['yangquelong-east-niche-north', 'yangquelong-east-bowl-north'], isolate: ['yangquelong-east-european-gate'], direction: [1, .13, .22] },
  grille: { label: '实格栅与窗深 · Grille and window depth', groups: ['yangquelong-west-large-grille--1'], isolate: ['yangquelong-west-chinese-gate'], direction: [-1, .06, .20] },
  birdroom: { label: '北养鸟室 · North bird room', groups: ['yangquelong-north-bird-room'], isolate: ['yangquelong-north-bird-room'], direction: [-1, .22, -.32] },
  bridge: { label: '东水桥 · East bridge', groups: ['yangquelong-east-arched-stone-bridge'], isolate: ['yangquelong-east-arched-stone-bridge', 'yangquelong-east-water-channel'], direction: [1, .45, .52] },
};
