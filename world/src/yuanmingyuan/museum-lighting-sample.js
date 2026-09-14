// Orient one museum scene after the shared clock has blended sun and moon.
// Colors, exposure, elevations, phase and the original clock sample stay unchanged.
export function rotateMuseumLightingSample(sample,degrees=-120){
  if(!sample||!Number.isFinite(degrees))throw new TypeError('Finite museum lighting sample rotation required');
  const names=['sunDirection','moonDirection','lightDirection'];
  for(const name of names){
    const v=sample[name];
    if(!v?.isVector3||typeof v.clone!=='function'||![v.x,v.y,v.z].every(Number.isFinite)){
      throw new TypeError('Invalid museum lighting direction: '+name);
    }
  }
  const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),rotated={...sample};
  for(const name of names){
    const v=sample[name];
    rotated[name]=v.clone().set(v.x*c+v.z*s,v.y,v.z*c-v.x*s);
  }
  return rotated;
}
