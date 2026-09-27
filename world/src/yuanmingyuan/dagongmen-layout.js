// Metres are authored proportional dimensions unless explicitly marked otherwise.
export const DAGONGMEN_ID = 'dagongmen-entrance-reconstruction-r2';
export const dagongmenLayout = Object.freeze({
  id: DAGONGMEN_ID, coordinates: Object.freeze({up:'+Y',north:'-Z',east:'+X'}),
  date: 'late-Qing-before-1860-study; earlier type and later repair evidence distinguished',
  gate: Object.freeze({bayWidths:Object.freeze([3.8,4.2,4.8,4.2,3.8]), width:20.8,
    depth:8.2, floor:.48, columnHeight:4.16, columnRadius:.225,
    roofWidth:23.2, roofDepth:10.8, eaveY:5.06, rise:2.08}),
  wings: Object.freeze({joinX:10.4, endX:27.8, startZ:0, endZ:8.7,
    doorFraction:.68, doorWidth:2.32, wallHeight:2.88, wallThickness:.54}),
  road: Object.freeze({width:3.2, frontZ:201.9, rearZ:-8.4, slabLength:1.6,
    forecourtWidth:55.6, apronRear:5.8, apronFront:14.4}),
  screen: Object.freeze({centerZ:205, length:41.6, thickness:1.70,
    baseHeight:.73, bodyTop:3.93, roofWidth:42.7, roofDepth:3.18, rise:.64}),
  evidence: Object.freeze({
    fiveBays:'DPM 2011 p24; south-facing five-bay Dagongmen',
    screenDistance:'DPM 2011 p33: circa 205 m survey relation; 64 zhang comparison',
    screenLength:'DPM 2011 p36: sample-001-1 annotation 13 zhang; author converts to 41.6 m',
    otherDimensions:'proportional reconstruction; not recovered Dagongmen measured dimensions',
    roof:'grey rolled hip-gable comparison and institutional reconstruction image; curvature inferred',
    doorState:'three middle passages opened for spatial study; operation angle inferred',
  }),
});
export function dagongmenColumnXs() {
  let x=-dagongmenLayout.gate.width/2;return [x,...dagongmenLayout.gate.bayWidths.map(w=>(x+=w))];
}
