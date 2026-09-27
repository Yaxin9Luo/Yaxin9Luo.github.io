// A stone approach joins a fixed building landing to the actual ground mesh.
// This is opt-in; ordinary authored paths retain their original linear section.
export function createGroundPathProfile(path,sampleSoil){
 const dx=path.to[0]-path.from[0],dz=path.to[2]-path.from[2],length=Math.hypot(dx,dz),count=Math.ceil(length/.5);
 if(!Number.isFinite(length)||length<=0||typeof sampleSoil!=='function')throw new Error('A terrain path needs a finite run and the actual soil sampler.');
 const nx=-dz/length*path.width/2,nz=dx/length*path.width/2,lip=.025;
 const sections=Array.from({length:count+1},(_,i)=>{
  const t=i/count,x=path.from[0]+dx*t,z=path.from[2]+dz*t;
  const soil=[-1,0,1].map(side=>sampleSoil(x+nx*side,z+nz*side)?.height);
  if(!soil.every(Number.isFinite))throw new Error('Missing triangle support beneath terrain path '+path.id);
  return {t,x,z,soil,groundTop:Math.max(...soil)};
 });
 const endY=sections.at(-1).groundTop+lip;
 for(const section of sections)section.y=Math.max(path.from[1]+(endY-path.from[1])*section.t,section.groundTop+lip);
 if(Math.abs(sections[0].y-path.from[1])>1e-5)throw new Error('Ground obstructs the fixed building landing of '+path.id);
 return {sections,endY,lip,source:'actual-soil-triangles',maximumSectionLength:length/count};
}
