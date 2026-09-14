const view = (label, groups, direction, extra = {}) => ({ label, groups, isolate: groups, direction, ...extra });

// Pure review metadata: importing these views never constructs vegetation.
export const gardenVegetationViews = {
  overview: view('园林小样总览', [], [.7, .46, 1]),
  willow: view('垂柳 · 全株', ['garden-willow'], [.68, .28, 1]),
  'willow-spray': view('柳梢与叶面', ['willow-detail-spray'], [.35, .16, 1], { margin: 1.18 }),
  pine: view('古松 · 全株', ['garden-pine'], [.62, .25, 1]),
  'pine-bark': view('松干与根盘', ['pine-trunk-and-roots'], [.7, .15, 1]),
  'pine-bark-close': view('松干近看 · 裂隙与剥片', ['pine-trunk-and-roots'], [.7, .12, 1], { crop: { min: [.29, .36, .23], max: [.73, .59, .76] }, margin: 1.08 }),
  'pine-needles': view('松梢与成对针叶', ['pine-detail-spray'], [.7, .35, 1], { margin: 1.18 }),
  juniper: view('五层圆柏', ['garden-juniper'], [.7, .25, 1]),
  'juniper-tier': view('圆柏层剪枝叶', ['juniper-tier-02'], [.7, .4, 1]),
  'juniper-spray': view('圆柏鳞叶与短针叶', ['juniper-detail-spray'], [.3, .16, 1], { margin: 1.16 }),
  lotus: view('荷叶与花 · 俯看', ['garden-lotus'], [.25, 1, .65]),
  'lotus-low': view('荷梗与叶底', ['garden-lotus'], [.8, .16, 1]),
  'lotus-flower': view('荷花 · 花瓣与花蕊', ['lotus-flower-01'], [.32, .72, 1], { margin: 1.12 }),
  'lotus-leaf': view('荷叶 · 叶脉与起伏', ['lotus-leaf-01'], [.24, .95, .75], { margin: 1.10 }),
  'rock-front': view('湖石正面 · 溶蚀与透孔', ['garden-lake-rock'], [.12, .14, 1]),
  'rock-side': view('湖石侧面 · 连通的空隙', ['garden-lake-rock'], [1, .17, .18]),
  'rock-detail': view('湖石折脊与溶沟', ['garden-lake-rock'], [-.15, .23, 1], { crop: { min: [.02, .55, .08], max: [.86, .95, .98] }, margin: 1.08 }),
  'rock-back': view('湖石背面 · 曲面与凹穴', ['garden-lake-rock'], [-.7, .23, -1]),
};
