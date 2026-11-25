// How much the great moments may cost: always tier 2 (all of it). The baseline is a recent machine (the lead, 2026-11-25:
// smooth on an M2 Pro class machine at dpr 2; old integrated GPUs no longer matter), so nothing is chosen from measured time.
// The lower tiers stay for profiling only: ?fxq=1 (less cloud, fewer simulation steps and debris), ?fxq=0 (one row of cloud,
// no rays, no dust noise, the fewest steps and debris).
export function createQuality() {
  const q = new URLSearchParams(globalThis.location ? location.search : '').get('fxq');
  const tier = q != null && /^[012]$/.test(q) ? +q : 2;
  return { get tier() { return tier; }, get why() { return tier === 2 ? 'full' : 'forced'; }, frame() {} };
}
