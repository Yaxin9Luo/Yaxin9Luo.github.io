// Pure authoring data. No factory, browser or world placement is evaluated here.
export const XIANFA_EVIDENCE = Object.freeze({
  hill: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231503.html',
  screens: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231502.html',
  planDiscussion: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html',
  competingCount: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202203/t20220331_4517711.html',
  planImage: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/W020250506536672979362.jpg',
  bridgeCatalog: 'https://www.nlc.cn/migrated/www.nlc.cn/newhxjy/wjsy/wjls/wjqcsy/wjd20q/d20qysltdjs/201011/P020101123721209322961.pdf',
  bridgePhotographs: 'https://www.cpanet.org.cn/uploads/soft/141209/xtt1.pdf',
});

export const XIANFA_IDS = Object.freeze({
  hill: { assetId: 'xianfashan', groupId: 'xianfashan', museumEntryId: 'xianfashan' },
  screens: { assetId: 'fanghe-xianfahua', groupId: 'xianfahua', museumEntryId: 'fanghe-xianfahua' },
  bridge: { assetId: 'xianfaqiao-study', groupId: null, museumEntryId: null, locationEvidence: 'west of Xieqiqu; not part of the Xianfashan parcel', worldRegistration: 'unresolved' },
});

export const HILL = Object.freeze({
  height: 8, clearPathWidth: 1.5,
  heightEvidence: 'park institutional description: approximately 8 m',
  pathWidthEvidence: 'park institutional description: approximately 1.5 m',
  outerRadius: 24, summitRadius: 4, turns: 3, pathThickness: .14,
  parapetThickness: .18, parapetHeight: .64, westGateX: -38, eastGateX: 31,
  summitFloor: 8.04,
  proportionalEvidence: 'All other metres are modern authoring assumptions, not a measured Qing plan.',
  turnCountEvidence: 'Three full turns are an authoring interpretation; the source phrase 三折 does not establish three complete revolutions.',
});

function climbPhase(t) {
  // A long exit transition keeps the inner turning radius larger than the
  // complete 1.86 m deck width. A short final kink folds its offset edges.
  const flattenFrom = .70, integral = (1 + flattenFrom) / 2;
  if (t <= flattenFrom) return { value: t / integral, derivative: 1 / integral };
  const u = (t - flattenFrom) / (1 - flattenFrom);
  return { value: (flattenFrom + (1 - flattenFrom) / 2 * (2 * u - u * u)) / integral, derivative: (1 - u) / integral };
}

export function spiralPoint(t) {
  const radius = HILL.outerRadius + (HILL.summitRadius - HILL.outerRadius) * t;
  const phase = climbPhase(t), a = Math.PI + Math.PI * 2 * HILL.turns * phase.value;
  return [radius * Math.cos(a), .04 + HILL.height * phase.value, radius * Math.sin(a)];
}

export function spiralFrame(t) {
  const phase = climbPhase(t), a = Math.PI + Math.PI * 2 * HILL.turns * phase.value, radius = HILL.outerRadius - 20 * t, da = Math.PI * 2 * HILL.turns * phase.derivative;
  const dx = -20 * Math.cos(a) - radius * da * Math.sin(a);
  const dz = -20 * Math.sin(a) + radius * da * Math.cos(a), length = Math.hypot(dx, dz);
  return { point: spiralPoint(t), tangent: [dx / length, 0, dz / length], normal: [-dz / length, 0, dx / length], gradient: HILL.height * phase.derivative / length };
}

export function spiralOffset(t, offset = 0, height = 0) {
  const { point, normal } = spiralFrame(t);
  return [point[0] + normal[0] * offset, point[1] + height, point[2] + normal[2] * offset];
}

// The 2025 published figure is only 554 × 167 px. Its text says eleven walls;
// the institutional visitor page says seven arrangements; another article says
// ten walls in five pairs. Six pairs plus a rear screen is a provisional review
// variant, not a reconciliation of those conflicting historical claims.
export const SCREEN_LAYOUT = Object.freeze({
  water: { x0: -159, x1: -5, halfWidth: 19.8, level: -.30, floor: -1.10 },
  pairs: [
    { x: 0, z: 15.7, width: 8.4, height: 10.7, yaw: .12 },
    { x: 5.8, z: 13.6, width: 7.4, height: 9.5, yaw: .13 },
    { x: 12.8, z: 11.3, width: 7.0, height: 8.1, yaw: .14 },
    { x: 20.4, z: 8.8, width: 6.0, height: 6.8, yaw: .15 },
    { x: 29.0, z: 6.6, width: 5.1, height: 5.6, yaw: .16 },
    { x: 39.0, z: 4.6, width: 4.3, height: 4.4, yaw: .18 },
  ],
  back: { x: 51.0, width: 14.4, height: 4.8 },
  countStatus: 'disputed; provisional six pairs plus one rear screen',
  metricStatus: '154 × 39.6 m water uses the current coarse diagram envelope as an authored study size; it is not historical surveying',
  originalPlanUnitsStatus: '2025 table labels wall length × thickness in 丈尺; ambiguous dimensions retained in research, not converted to metres',
});

export function scenicWallSpec(row, side) {
  const p = SCREEN_LAYOUT.pairs[row];
  return { ...p, row, side, z: p.z * side, yaw: -Math.PI / 2 + side * p.yaw, depth: row === 0 ? .70 : .42, name: `xianfahua-wing-${side < 0 ? 'north' : 'south'}-${row + 1}` };
}

export function viewingRayToWall(row, side, localX = 0, eye = [-159, 1.65, 0]) {
  const p = scenicWallSpec(row, side), point = [p.x + Math.cos(p.yaw) * localX, p.height * .42, p.z - Math.sin(p.yaw) * localX];
  const v = point.map((value, index) => value - eye[index]), length = Math.hypot(...v);
  return { eye, point, direction: v.map(value => value / length) };
}
