import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FAUNA_VERSION,createSwallow,setSwallowPose,createPaperLantern,createFirefly,setLanternEnvironment,fireflyFlightRig,fireflyWingMatrix} from './sky-fauna.js';
import {createFaunaMotion} from './fauna-population-motion.js';

const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const materialClone=material=>{
  const result=material.clone();result.onBeforeCompile=material.onBeforeCompile;result.customProgramCacheKey=material.customProgramCacheKey;return result;
};
function relativeMatrix(part,root){root.updateMatrixWorld(true);return root.matrixWorld.clone().invert().multiply(part.matrixWorld);}
function copiedPart(part,material=part.material){
  const object=new THREE.Mesh(part.geometry,material);object.name=part.name;object.position.copy(part.position);object.quaternion.copy(part.quaternion);object.scale.copy(part.scale);return object;
}
// Preserve every triangle, pigment and normal. UVs are unused by these insect
// PBR materials. Normalize attributes for the merge; do not simplify geometry.
function mergedBody(parts,root){
  const copies=parts.map(part=>{
    const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(relativeMatrix(part,root));g.deleteAttribute('uv');
    if(!g.attributes.color){const colors=new Float32Array(g.attributes.position.count*3);colors.fill(1);g.setAttribute('color',new THREE.BufferAttribute(colors,3));}
    return g;
  });
  const result=mergeGeometries(copies);copies.forEach(g=>g.dispose());return result;
}
function pulseGeometry(geometry,count){
  const result=geometry.clone();result.setAttribute('faunaGlow',new THREE.InstancedBufferAttribute(new Float32Array(count),1));return result;
}
function pulseAbdomen(material){
  const result=materialClone(material);result.emissiveIntensity=1;
  result.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float faunaGlow;varying float vFaunaGlow;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFaunaGlow=faunaGlow;');
    shader.fragmentShader='varying float vFaunaGlow;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=.08+1.8*vFaunaGlow;');
  };
  result.customProgramCacheKey=()=> 'fauna-instanced-abdomen-pulse-v1';return result;
}
function pulseAura(material){
  const result=materialClone(material);
  result.vertexShader='attribute float faunaGlow;varying float vFaunaGlow;\n'+result.vertexShader;
  result.vertexShader=result.vertexShader.replace('vUv=uv;','vUv=uv;vFaunaGlow=faunaGlow;');
  result.fragmentShader='varying float vFaunaGlow;\n'+result.fragmentShader;
  result.fragmentShader=result.fragmentShader.replace('*opacity;','*opacity*vFaunaGlow;');return result;
}

/** Rendering consumes the same full accepted source meshes as the studio. */
export function createFaunaPopulation({heightAt,lanternCount=26,fireflyCount=90,birdCount=12}={}){
  const root=new THREE.Group();root.name='Authored garden and sky fauna';
  const motion=createFaunaMotion({heightAt,lanternCount,fireflyCount,birdCount});
  const sourceBird=createSwallow(),sourceLantern=createPaperLantern(),sourceInsect=createFirefly();
  const sources=[sourceBird,sourceLantern,sourceInsect],batches=[],paperObjects=[],releasedObjects=[],insectGroups=[],birdGroups=[];
  const matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),composed=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),bankQuaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),rollAxis=new THREE.Vector3(0,0,1),target=new THREE.Vector3();
  let night=1,disposed=false,releasedResources=false,ownedDisposed=false;
  const batch=(name,geometry,material,count,parent=root)=>{
    const object=new THREE.InstancedMesh(geometry,material,count);object.name=name;object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(object);batches.push(object);return object;
  };
  const finishBatch=object=>{object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();};
  const itemMatrix=item=>matrix.compose(item.position,quaternion.setFromEuler(item.rotation),scale.setScalar(item.scale??1));

  // Individual transparent shells retain renderer sorting. Only equivalent
  // opaque frame/fuel/flame structures are batched within three spatial groups.
  const paperPart=sourceLantern.children[0],framePart=sourceLantern.children[1],fuelPart=sourceLantern.children[2],flamePart=sourceLantern.userData.flame,auraPart=sourceLantern.userData.aura;
  const lanternGroups=[];
  for(let group=0;group<3;group++){
    const items=motion.lanterns.filter(item=>item.group===group);if(!items.length)continue;
    const parts=[framePart,fuelPart,flamePart,auraPart].map(part=>({part,local:relativeMatrix(part,sourceLantern),object:batch(`Lantern group ${group}: ${part.name}`,part.geometry,part.material,items.length)}));
    const papers=items.map(()=>{const object=copiedPart(paperPart);root.add(object);paperObjects.push(object);return object;});lanternGroups.push({items,parts,papers});
  }
  for(const item of motion.released){
    const object=new THREE.Group();object.name='Bounded released paper lantern';object.visible=false;const materialCopies=new Map();
    for(const part of sourceLantern.children){let material=materialCopies.get(part.material);if(!material){material=materialClone(part.material);materialCopies.set(part.material,material);}object.add(copiedPart(part,material));}
    object.userData.paper=object.children[0].material;object.userData.flame=object.children[3];object.userData.aura=object.children[4];root.add(object);releasedObjects.push({item,object});
  }

  // The same complete beetle anatomy is merged by shared material. Wings and
  // veins retain their authored attachment pivots and articulate separately.
  const movingNames=['Left membranous wing','Right membranous wing','Fine wing vein'];
  const staticParts=sourceInsect.children.filter(part=>!movingNames.includes(part.name)&&part!==sourceInsect.userData.aura&&part!==sourceInsect.userData.abdomen);
  const byMaterial=new Map();for(const part of staticParts){const parts=byMaterial.get(part.material)||[];parts.push(part);byMaterial.set(part.material,parts);}
  const bodies=[...byMaterial].map(([material,parts])=>({geometry:mergedBody(parts,sourceInsect),material}));
  const flightParts=fireflyFlightRig(sourceInsect);
  const abdomenMaterial=pulseAbdomen(sourceInsect.userData.abdomen.material),auraMaterial=pulseAura(sourceInsect.userData.aura.material);
  for(let group=0;group<3;group++){
    const items=motion.insects.filter(item=>item.group===group);if(!items.length)continue;
    const parent=new THREE.Group();parent.name=`Firefly habitat ${group}`;root.add(parent);
    const parts=bodies.map(({geometry,material})=>({object:batch('Complete beetle body batch',geometry,material,items.length,parent),local:new THREE.Matrix4()}));
    for(const descriptor of flightParts)parts.push({...descriptor,object:batch(descriptor.part.name,descriptor.part.geometry,descriptor.part.material,items.length,parent)});
    for(const [part,material] of [[sourceInsect.userData.abdomen,abdomenMaterial],[sourceInsect.userData.aura,auraMaterial]])parts.push({object:batch(part.name,pulseGeometry(part.geometry,items.length),material,items.length,parent),local:relativeMatrix(part,sourceInsect),pulse:true});
    insectGroups.push({items,parent,parts});
  }
  for(const flock of motion.flocks){const object=batch(flock.domain.name,sourceBird.geometry,materialClone(sourceBird.material),flock.birds.length);object.material.transparent=true;birdGroups.push({flock,object});}

  // Dispose construction-only materials/geometries now; rendered shared
  // resources remain attached for the scene's single Set-based disposal owner.
  const usedGeometry=new Set(),usedMaterial=new Set();root.traverse(object=>{if(object.geometry)usedGeometry.add(object.geometry);if(object.material)usedMaterial.add(object.material);});
  const orphanGeometry=new Set(),orphanMaterial=new Set();for(const source of sources)source.traverse(object=>{if(object.geometry&&!usedGeometry.has(object.geometry))orphanGeometry.add(object.geometry);if(object.material&&!usedMaterial.has(object.material))orphanMaterial.add(object.material);});
  // New merged/pulse resources with zero population likewise have no scene owner.
  for(const {geometry}of bodies)if(!usedGeometry.has(geometry))orphanGeometry.add(geometry);
  for(const material of [abdomenMaterial,auraMaterial])if(!usedMaterial.has(material))orphanMaterial.add(material);
  orphanGeometry.forEach(g=>g.dispose());orphanMaterial.forEach(m=>m.dispose());
  const materialStates=new Map([...usedMaterial].map(material=>[material,{opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite}]));

  function applyLight(){
    if(disposed)return;setLanternEnvironment(sourceLantern,night);
    for(const {item,object}of releasedObjects){
      object.visible=item.active;if(!item.active)continue;setLanternEnvironment(object,night,item.fade);
      for(const part of [object.children[1],object.children[2]]){part.material.transparent=item.fade<1;part.material.opacity=item.fade;part.material.depthWrite=item.fade===1;}
    }
    for(const {items,parent,parts}of insectGroups){
      parent.visible=night>.002;
      for(const {object,pulse}of parts){
        if(!object.material.isShaderMaterial){const state=materialStates.get(object.material);object.material.opacity=state.opacity*night;object.material.transparent=state.transparent||night<1;object.material.depthWrite=state.depthWrite&&night===1;}
        if(pulse){items.forEach((item,i)=>object.geometry.attributes.faunaGlow.setX(i,item.glow*night));object.geometry.attributes.faunaGlow.needsUpdate=true;}
      }
    }
    auraMaterial.uniforms.opacity.value=.36;
    for(const {flock,object}of birdGroups){const opacity=(1-smooth(.12,.55,night))*flock.visibility;object.visible=opacity>.002;object.material.opacity=opacity;}
  }
  function renderState(){
    if(disposed)return;
    for(const {items,parts,papers}of lanternGroups){
      items.forEach((item,i)=>{itemMatrix(item);papers[i].matrix.copy(matrix);papers[i].matrix.decompose(papers[i].position,papers[i].quaternion,papers[i].scale);for(const {object,local}of parts)object.setMatrixAt(i,composed.multiplyMatrices(matrix,local));});
      parts.forEach(({object})=>finishBatch(object));
    }
    for(const {item,object}of releasedObjects){
      object.visible=item.active;if(!item.active)continue;object.position.copy(item.position);object.rotation.copy(item.rotation);object.scale.setScalar(item.scale);
    }
    for(const {items,parts}of insectGroups){
      items.forEach((item,i)=>{
        itemMatrix(item);
        for(const descriptor of parts){
          const {object,pivot}=descriptor;
          if(pivot)fireflyWingMatrix(descriptor,item.wingAngle,local);
          else local.copy(descriptor.local);
          object.setMatrixAt(i,composed.multiplyMatrices(matrix,local));
        }
      });
      for(const {object}of parts)finishBatch(object);
    }
    for(const {flock,object}of birdGroups){
      flock.birds.forEach((bird,i)=>{
        setSwallowPose(sourceBird,motion.reduced?'glide':'flight',bird.poseTime);object.setMorphAt(i,sourceBird);
        target.copy(bird.position).add(bird.direction);local.lookAt(bird.position,target,up);quaternion.setFromRotationMatrix(local).multiply(bankQuaternion.setFromAxisAngle(rollAxis,bird.bank));
        matrix.compose(bird.position,quaternion,scale.setScalar(bird.scale));object.setMatrixAt(i,matrix);
      });
      if(object.morphTexture)object.morphTexture.needsUpdate=true;finishBatch(object);
    }
    root.updateMatrixWorld(true);applyLight();
  }
  renderState();
  return{root,motion,lanternCount:motion.lanterns.length,manualLanternCapacity:motion.released.length,
    setEnvironment(environment){if(disposed)return;night=environment.night;applyLight();},
    update(dt,reduced=false,context={}){if(disposed)return;motion.update(dt,reduced,context);renderState();},
    resetActivityForReview(time=0,reduced=false){if(disposed)return;motion.resetActivityForReview(time,reduced);renderState();},
    snapshot(){return{assetVersion:FAUNA_VERSION,activityTime:motion.time,reducedMotion:motion.reduced,night,counts:{ambientLanterns:motion.lanterns.length,releasedLanterns:motion.released.filter(item=>item.active).length,manualCapacity:motion.released.length,fireflies:motion.insects.length,visibleFireflies:night>.002?motion.insects.length:0,pulsingFireflies:motion.insects.filter(item=>item.glow*night>.05).length,birds:motion.flocks.reduce((sum,flock)=>sum+flock.birds.length,0),visibleBirds:birdGroups.filter(group=>group.object.visible).reduce((sum,group)=>sum+group.flock.birds.length,0)},samples:{bird:motion.flocks[0]?.birds[0]?{position:motion.flocks[0].birds[0].position.toArray(),bank:motion.flocks[0].birds[0].bank,poseTime:motion.flocks[0].birds[0].poseTime}:null,firefly:motion.insects[0]?{position:motion.insects[0].position.toArray(),wingAngle:motion.insects[0].wingAngle,glow:motion.insects[0].glow}:null,released:motion.released.filter(item=>item.active).map(item=>({position:item.position.toArray(),age:item.age,fade:item.fade}))}};},
    releaseLantern(position){if(disposed)return false;const result=motion.release(position);renderState();return result;},
    // Scene teardown owns attached geometry/materials. This hook handles the
    // extra InstancedMesh/morph textures only, once, before that scene traversal.
    releaseResources(){if(releasedResources)return;releasedResources=true;disposed=true;batches.forEach(object=>object.dispose());},
    dispose(){if(ownedDisposed)return;ownedDisposed=true;this.releaseResources();usedGeometry.forEach(g=>g.dispose());usedMaterial.forEach(m=>m.dispose());root.removeFromParent();},
  };
}
