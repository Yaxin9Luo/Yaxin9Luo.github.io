import {botanicalManifest,botanicalFamilies} from './botanical-manifest.js';

// This leaf registry never imports the procedural factory. Engine parsing is loaded on request.
const partsByVariant=new Map();
export const botanicalKey=(kind,seed,level='near')=>`botanical/${kind}/${seed}/${level}`;
export function getBotanicalParts(kind,seed,level='near'){return partsByVariant.get(botanicalKey(kind,seed,level))||null;}
export function botanicalReady(kind,seed,level='near'){return partsByVariant.has(botanicalKey(kind,seed,level));}
export function registerBotanicalParts(kind,seed,level,parts){
  if(!parts?.branches?.isBufferGeometry||!parts?.leaves?.isBufferGeometry)throw new Error('Botanical variant needs branch and leaf geometries');
  const key=botanicalKey(kind,seed,level),existing=partsByVariant.get(key);if(existing)return existing;
  parts.branches.userData.sharedAsset=true;parts.leaves.userData.sharedAsset=true;
  const entry={...parts,botanicalDetail:{...parts.botanicalDetail}};partsByVariant.set(key,entry);return entry;
}

export async function loadBotanicalVariant(kind,seed,level='near',context={}){
  const {manifest=botanicalManifest,loadGLTFImpl,...options}=context;
  options.signal?.throwIfAborted();
  const existing=getBotanicalParts(kind,seed,level);if(existing)return existing;
  const asset=manifest[botanicalKey(kind,seed,level)];
  if(!asset)throw new Error(`Missing botanical manifest variant: ${kind}/${seed}/${level}`);
  const {loadGLTF,mutableGeometry}=await import('./gltf-resource.js');
  options.signal?.throwIfAborted();
  const gltf=await (loadGLTFImpl||loadGLTF)(asset,options);options.signal?.throwIfAborted();
  // Shared resourceLoader work may have completed for another consumer during the await.
  const ready=getBotanicalParts(kind,seed,level);if(ready)return ready;
  gltf.scene.updateMatrixWorld(true);
  const geometries={};
  try{
    for(const part of['branches','leaves']){
      const mesh=gltf.scene.getObjectByName(part);
      if(!mesh?.geometry)throw new Error(`Botanical asset is missing ${part}: ${asset.id}`);
      // Bake quantization node transforms once. Instanced foliage expects tree-local metres.
      geometries[part]=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);
      geometries[part].computeBoundingBox();geometries[part].computeBoundingSphere();
    }
    options.signal?.throwIfAborted();
    return registerBotanicalParts(kind,seed,level,{...geometries,name:gltf.scene.userData.name,botanicalDetail:gltf.scene.userData.botanicalDetail});
  }catch(error){for(const geometry of Object.values(geometries))geometry.dispose();throw error;}
}

/** Await a single region/family before assembly. Failures reject, never invoke a source factory. */
export async function loadBotanicalAssets(context={}){
  const {families=botanicalFamilies.filter(family=>family.defaultLoad!==false),levels,...options}=context;
  const result=[];
  // Keep parse/bake memory bounded; callers can independently request a later family.
  for(const family of families){
    if(family.placements&&family.placements.length===0)continue;
    for(const level of levels||family.levels||['near','mid','far']){
      const parts=await loadBotanicalVariant(family.kind,family.seed,level,options);
      result.push({kind:family.kind,seed:family.seed,level,parts});
    }
  }
  return result;
}
