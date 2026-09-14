/** Geometry-only diagnostic variant. The unchanged water owner renders at
 * datum + .006; cap only the added sediment at the original datum so that
 * its Float32 triangles cannot form a detached emergent strip. */
export const shoreBankSubmergedR2=Object.freeze({
  id:'xianfa-shore-bank-study-submerged-r2',bedProfile:'submerged-r2',
  heightCeiling:'original-water-datum',materialVariant:'unchanged-r1',
});

export function validateShoreBankBedProfile(profile){
  if(profile!=='r1'&&profile!==shoreBankSubmergedR2.bedProfile)throw new Error('Shore bank: unknown bed profile');
  return profile;
}

export function capShoreBankSubmergedR2(sourceY,raisedY,waterY){
  if(![sourceY,raisedY,waterY].every(Number.isFinite))throw new Error('Shore bank: submerged profile requires finite source, candidate and water heights');
  // A pre-existing high source surface is never lowered by this experiment.
  return Math.min(raisedY,Math.max(sourceY,waterY));
}
