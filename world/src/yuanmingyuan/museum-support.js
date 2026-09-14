// Prefer the actual highest supporting surface, while retaining the landscape's
// water datum. A model's submerged stone floor is not dry walking ground.
export function museumSupport(ground,building){
  const hit=building&&(!ground||building.height>=ground.height)?building:ground;
  if(!hit)return null;
  const waterY=Math.max(ground?.waterY??-Infinity,building?.waterY??-Infinity),surface=Array.isArray(hit.normal)?{...hit,normal:{x:hit.normal[0],y:hit.normal[1],z:hit.normal[2]}}:hit;
  if(Number.isFinite(waterY)&&hit.height<=waterY+.03)return {...surface,waterY,walkable:false};
  return surface;
}
