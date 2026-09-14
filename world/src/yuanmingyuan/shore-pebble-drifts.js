import * as THREE from 'three';

export const shorePebbleDriftId='drifts-r3';
export const shorePebbleDriftEvidence='Contemporary museum landscape study; not a surveyed Qing shore or named historical stone.';

/** Three short, unequal gravel fans leave the two existing water-view gaps
 * open. A principal stone and its smaller companions replace the old necklace
 * of equally visible pebbles. All heights are resolved by the real bank owner. */
export function shorePebbleDriftRecords(spec,{shorelineN}={}){
  if(spec.halfLength<12)throw new Error('Pebble drifts need the complete 24 m shore');
  if(shorelineN!==undefined&&typeof shorelineN!=='function')throw new Error('Pebble shoreline must be an actual intersection callback');
  let seed=319062;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},records=[];
  for(const [drift,centre,count,span,hand]of [[0,-8.8,43,3.2,-1],[1,-.65,27,2.1,1],[2,8.7,41,2.8,-1]]){
    for(let i=0;i<count;i++){
      const radius=i===0?.34+random()*.045:i===1?.21+random()*.04:i<5?.12+random()*.055:i%4===0?.07+random()*.055:.025+random()*.043;
      const scale=[radius*(1.05+random()*.25),radius*(.52+random()*.18),radius*(.77+random()*.17)];
      const s=centre+(i<2?hand*span*.26+(i===1?-.34*hand:0):(random()+random()-1)*span*.47);
      const offset=shorelineN===undefined?0:shorelineN(s);
      if(!Number.isFinite(offset)||offset>0)throw new Error('Pebble shoreline must remain in the existing lake');
      const n=offset-(.055+Math.max(scale[0],scale[2])*1.17+random()*(i<5?.075:.63));
      records.push({drift,s,n,radius,scale,yaw:random()*Math.PI*2,variant:i%3,tone:random(),burial:.009+radius*.035});
    }
  }
  return records;
}

/** Smooth, closed waterworn stones with actual relief and continuous normals
 * at the spherical UV seam. Existing photographic rock maps supply grain. */
export function createShoreDriftPebbleGeometry(seed=1){
  const geometry=new THREE.SphereGeometry(1,64,36),p=geometry.attributes.position,n=geometry.attributes.normal;
  const unit=new THREE.Vector3(),gradient=new THREE.Vector3(),normal=new THREE.Vector3(),phase=seed*.731;
  for(let i=0;i<p.count;i++){
    unit.fromBufferAttribute(p,i).normalize();const {x,y,z}=unit;
    const a=4*x+phase,b=3*y,c=5*z,d=11*y+3*z+phase;
    const f=1+.07*Math.sin(a)*Math.cos(b)*Math.sin(c)+.045*x*y-.055*z*z+.02*Math.sin(d);
    gradient.set(.28*Math.cos(a)*Math.cos(b)*Math.sin(c)+.045*y,-.21*Math.sin(a)*Math.sin(b)*Math.sin(c)+.045*x+.22*Math.cos(d),.35*Math.sin(a)*Math.cos(b)*Math.cos(c)-.11*z+.06*Math.cos(d));
    gradient.addScaledVector(unit,-gradient.dot(unit));normal.copy(unit).addScaledVector(gradient,-1/f);normal.set(normal.x,normal.y/.82,normal.z/.91).normalize();
    p.setXYZ(i,x*f,y*f*.82,z*f*.91);n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  geometry.name=`shore-drift-pebble-${seed}`;geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={body:'authored-waterworn-shore-stone',evidence:shorePebbleDriftEvidence,textureMapping:'one authored spherical tile per stone; not a geological scan'};
  return geometry;
}

export function createShoreDriftMaterial(source){
  if(!source?.isMeshStandardMaterial||![source.map,source.normalMap,source.roughnessMap].every(t=>t?.isTexture))throw new Error('Pebble drifts require the existing full photographic rock PBR material');
  const material=source.clone();material.name='shore-pebble-photographic-rock';material.vertexColors=false;material.color.set('#ffffff');material.normalScale.set(.45,.45);material.roughness=1;
  // Keep the photographed grain without the polished, almost metallic lobe
  // seen in the first native close-up. Pixel arrays and source maps stay intact.
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(0.72, 0.95, clamp(roughnessFactor, 0.0, 1.0));');};
  material.customProgramCacheKey=()=>'shore-drift-rock-matte-r2';
  material.userData={...source.userData,evidence:shorePebbleDriftEvidence,borrowedTextureMaps:true,sourceMaterial:source.name,roughnessCalibration:[.72,.95],nativeReviewed:false};
  return material;
}
