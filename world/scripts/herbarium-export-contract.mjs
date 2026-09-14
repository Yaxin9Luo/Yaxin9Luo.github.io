import {createHash} from 'node:crypto';

const hash=array=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const sameNumbers=(a,b)=>a.length===b.length&&a.every((value,i)=>Number.isFinite(value)&&Math.abs(value-b[i])<1e-6);

/** Inspect only the visible Mesh batches; the exporter still receives the complete group. */
export function verifyHerbariumExport(group,verification,label=group.name){
  const meshes=[],lights=[];
  group.updateMatrixWorld(true);
  group.traverseVisible(object=>{if(object.isMesh)meshes.push(object);if(object.isLight)lights.push(object);});
  if(meshes.length!==verification.geometry.length)throw new Error(`${label}: exported mesh batch count changed.`);
  for(const [i,mesh]of meshes.entries()){
    const expected=verification.geometry[i].primitives[0];
    for(const [name,attribute]of Object.entries(mesh.geometry.attributes)){
      const semantic={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0',uv1:'TEXCOORD_1',color:'COLOR_0',tangent:'TANGENT'}[name]||name.toUpperCase();
      if(expected.attributes[semantic]?.sha256!==hash(attribute.array))throw new Error(`${label}/${mesh.name}/${name}: exporter changed actual runtime attribute bytes.`);
    }
  }
  if(!Array.isArray(verification.lights)||lights.length!==verification.lights.length)throw new Error(`${label}: exported light count changed.`);
  const tags=new Set();
  for(const light of lights){
    const tag=light.userData.herbariumLamp,expected=verification.lights.find(entry=>entry.tag===tag);
    if(!light.isPointLight||light.decay!==2||!tag||tags.has(tag)||!expected||expected.type!=='point')throw new Error(`${label}: invalid or duplicate authored point light.`);
    tags.add(tag);
    if(expected.intensity!==light.intensity||expected.range!==(light.distance>0?light.distance:null)||
      JSON.stringify(expected.color)!==JSON.stringify(light.color.toArray())||expected.extras.authoredIntensity!==light.userData.authoredIntensity||
      !sameNumbers(expected.matrix,light.matrix.toArray())||!sameNumbers(expected.worldMatrix,light.matrixWorld.toArray()))
      throw new Error(`${label}/${tag}: exporter changed runtime point-light parameters or transform.`);
  }
  verification.runtimeAttributeBytesVerified=true;verification.runtimeLightsVerified=true;
  return {batches:meshes.length,triangles:meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3,0),lights:lights.length};
}

