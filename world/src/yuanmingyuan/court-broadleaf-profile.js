export const courtBroadleafReview='work/yuanmingyuan/court-low-broadleaf-r1/freeze.json';
export const courtBroadleafProfile=Object.freeze({
 id:'court-low-broadleaf-r1',triangles:1020245,meshes:3,
 rootMinY:-.03000451624393463,rootRadius:.07579315283474522,
 min:Object.freeze([-.49993962049484253,-.03000451624393463,-.5045164823532104]),
 max:Object.freeze([.5083619356155396,.6475418210029602,.4442823529243469]),
 meshNames:Object.freeze(['low-broadleaf-scanned-sprays','low-broadleaf-branch-skeleton','low-broadleaf-ground-roots']),
});
const identity=node=>node.position.x===0&&node.position.y===0&&node.position.z===0&&node.quaternion.x===0&&node.quaternion.y===0&&node.quaternion.z===0&&node.quaternion.w===1&&node.scale.x===1&&node.scale.y===1&&node.scale.z===1&&
 (node.matrixAutoUpdate||node.matrix.elements.every((v,i)=>v===(i%5===0?1:0)));
export function assertCourtBroadleafRecord(record){
 const {part,owner,review}=record??{};
 if(review!==courtBroadleafReview||!part?.isGroup||part.userData.id!=='low-broadleaf'||!owner?.group?.isGroup||owner.group.parent||owner.group.children.length!==1||part.parent!==owner.group||
  !identity(owner.group)||!identity(part)||owner.disposed||typeof owner.dispose!=='function'||owner.diagnostics?.id!==courtBroadleafProfile.id||owner.diagnostics.triangles!==courtBroadleafProfile.triangles||owner.diagnostics.fullResolutionVerified!==true)
  throw new Error('A complete independently owned frozen low broadleaf source is required');
 return true;
}
export function assertCourtBroadleafGeometry(part,profile){
 if(profile.triangles!==courtBroadleafProfile.triangles||profile.records.length!==3||part.userData.windAmplitude!==0)
  throw new Error('The complete static low broadleaf geometry profile changed');
 for(const [i,record]of profile.records.entries()){
  if(record.node.name!==courtBroadleafProfile.meshNames[i]||record.node.isInstancedMesh||Array.isArray(record.node.material))
   throw new Error('The three original low broadleaf meshes are required');
 }
 const close=(actual,expected)=>actual.every((v,i)=>Number.isFinite(v)&&Math.abs(v-expected[i])<1e-5);
 if(!close(profile.bounds.min.toArray(),courtBroadleafProfile.min)||!close(profile.bounds.max.toArray(),courtBroadleafProfile.max)||Math.abs(Math.min(...profile.roots.map(p=>p.y))-courtBroadleafProfile.rootMinY)>1e-6)
  throw new Error('Actual low broadleaf crown or root bounds changed');
 const material=profile.records[0].node.material;
 if(!material.isMeshStandardMaterial||!material.vertexColors||material.alphaTest!==.5||material.transparent||material.side!==2||
  ['map','normalMap','roughnessMap','alphaMap'].some(slot=>!material[slot]?.isTexture||material[slot].image?.width!==4096||material[slot].image?.height!==4096))
  throw new Error('Low broadleaf requires original opaque alpha-tested four-channel 4K material');
 return true;
}

// Existing R3 replay keeps the original scanned-source contract by default.
// A separately reviewed source supplies this whole contract to both callers.
export const courtBroadleafContract=Object.freeze({
 profile:courtBroadleafProfile,review:courtBroadleafReview,
 assertRecord:assertCourtBroadleafRecord,assertGeometry:assertCourtBroadleafGeometry,
});
export function assertCourtBroadleafContract(contract){
 if(!contract?.profile||typeof contract.profile.id!=='string'||!contract.profile.id.trim()||
  !Number.isFinite(contract.profile.rootMinY)||contract.profile.rootMinY>.005||
  typeof contract.review!=='string'||!contract.review.trim()||
  typeof contract.assertRecord!=='function'||typeof contract.assertGeometry!=='function')
  throw new Error('A complete explicit broadleaf contract with a finite root minimum is required');
 return contract;
}
