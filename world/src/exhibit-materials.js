import * as THREE from 'three';
import {loadPBRTexture} from './asset-cache.js';

/** Same local PBR cache and tint/roughness treatment as the authored gardens. */
export function createAtelierMaterials({loadTexture=typeof document==='undefined'?null:loadPBRTexture}={}){
  let disposed=false;const jobs=[],errors=[],materials={};
  const pbr=(key,set,color,{metres,normal=.3,albedo=.6,floor=.6,...options})=>{
    const material=new THREE.MeshStandardMaterial({color,roughness:.86,normalScale:new THREE.Vector2(normal,normal),...options});
    material.name=`Atelier ${key}`;Object.assign(material.userData,{surface:set,metresPerRepeat:metres,albedoStrength:albedo,roughnessFloor:floor});
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 authoredBase=diffuseColor.rgb;\n#include <map_fragment>\ndiffuseColor.rgb=mix(authoredBase,diffuseColor.rgb,${albedo.toFixed(3)});`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;
        #ifdef USE_ROUGHNESSMAP
          roughnessFactor=mix(${floor.toFixed(3)},roughness,texture2D(roughnessMap,vRoughnessMapUv).g);
        #endif`);
    };
    material.customProgramCacheKey=()=>`atelier-pbr-${set}-${albedo}-${floor}`;
    if(loadTexture)for(const [channel,property]of [['color','map'],['normal','normalMap'],['roughness','roughnessMap']]){
      jobs.push(Promise.resolve().then(()=>loadTexture(set,channel)).then(texture=>{if(!disposed){material[property]=texture;material.needsUpdate=true;}}).catch(error=>errors.push({set,channel,message:String(error?.message||error)})));
    }
    materials[key]=material;return material;
  };
  pbr('wood','aged-wood','#a58a67',{metres:2,normal:.42,albedo:.64,floor:.59,roughness:.86});
  pbr('tabletop','aged-wood','#916d50',{metres:2,normal:.42,albedo:.88,floor:.60,roughness:.82});
  pbr('edge','aged-wood','#655346',{metres:2,normal:.32,albedo:.45,floor:.60,roughness:.82});
  pbr('endgrain','aged-wood','#c2a580',{metres:.9,normal:.36,albedo:.61,floor:.65});
  pbr('brass','oxidized-copper','#d2b477',{metres:1,normal:.17,albedo:.38,floor:.37,metalness:.8,roughness:.64});
  pbr('brightBrass','oxidized-copper','#e4c991',{metres:1,normal:.10,albedo:.18,floor:.29,metalness:.82,roughness:.48});
  pbr('stone','castle-masonry','#c1c0af',{metres:2.085,normal:.18,albedo:.38,floor:.81,roughness:.96});
  pbr('leather','dark-leather','#74908b',{metres:.38,normal:.48,albedo:.36,floor:.73,roughness:.93});
  materials.ink=new THREE.MeshStandardMaterial({name:'Atelier blue enamel',color:'#344c53',roughness:.46,metalness:.08});
  materials.cream=new THREE.MeshStandardMaterial({name:'Atelier cotton paper',color:'#eee2c6',roughness:.98});
  materials.pageEdge=new THREE.MeshStandardMaterial({name:'Atelier page shadows',color:'#b7a990',roughness:.99});
  materials.stitch=new THREE.MeshStandardMaterial({name:'Atelier linen stitching',color:'#c9b99a',roughness:1});
  return {materials,errors,ready:Promise.all(jobs).then(()=>({errors})),dispose(){if(disposed)return;disposed=true;Object.values(materials).forEach(material=>material.dispose());}};
}
