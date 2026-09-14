import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {groundMaterial} from '../src/landscape.js';
import * as layout from '../src/herbarium-layout.js';

function compile(material){
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.rootedSoilMap,'ground material must bind the accepted-footprint-only mask');return shader;
}
const square=(x,z,r=2,strength=1)=>({loop:[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]],strength});
function sample(texture,x,z){
  const {width,height,data}=texture.image,u=(x+144)/288*width-.5,v=(z+144)/288*height-.5,ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz;
  const at=(i,j)=>data[Math.max(0,Math.min(height-1,j))*width+Math.max(0,Math.min(width-1,i))]/255;
  return (at(ix,iz)*(1-fx)+at(ix+1,iz)*fx)*(1-fz)+(at(ix,iz+1)*(1-fx)+at(ix+1,iz+1)*fx)*fz;
}
function sceneWith(...materials){const scene=new THREE.Scene();for(const material of materials)scene.add(new THREE.Mesh(new THREE.BufferGeometry(),material));return scene;}
const loam=()=>import('../src/rooted-loam.js');

test('progressive rooted soil uses only occupied cells and keeps low plants after one owner releases',async()=>{
  const material=groundMaterial();let releaseA,releaseB;
  try{
    const shader=compile(material),texture=shader.uniforms.rootedSoilMap.value,{getRootedLoamState}=await loam(),scene=sceneWith(material);
    assert.equal(texture.image.width,1024);assert.equal(texture.image.data.byteLength,1048576);assert.equal(texture.format,THREE.RedFormat);assert.equal(texture.colorSpace,THREE.NoColorSpace);assert.equal(texture.generateMipmaps,false);
    assert.equal(getRootedLoamState(scene).mask.sampledTexels,0,'ground before plants performs no full-domain hull sampling');
    assert.equal(sample(texture,-10,60),0);assert.equal(sample(texture,65,10),0);
    releaseA=layout.registerHerbariumCommunityFootprints([square(-10,60,2,.82)]);releaseB=layout.registerHerbariumCommunityFootprints([square(65,10)]);
    assert.equal(compile(material).uniforms.rootedSoilMap.value,texture,'progressive refresh retains the same texture');
    assert.ok(Math.abs(sample(texture,-10,60)-209/255)<1e-12,'low-plant strength is retained, not filtered by generic humus');assert.equal(sample(texture,65,10),1);assert.equal(sample(texture,-130,0),0);
    const state=getRootedLoamState(scene);assert.ok(state.mask.sampledTexels<5000,'two tiny occupied regions do not scan one million texels');assert.ok(state.mask.nonzeroTexels>0);
    releaseA();assert.equal(sample(texture,-10,60),0);assert.equal(sample(texture,65,10),1,'another owner stays rooted');
    releaseB();assert.equal(sample(texture,65,10),0);assert.equal(getRootedLoamState(scene).mask.sampledTexels,0);
  }finally{releaseA?.();releaseB?.();material.dispose();}
});

test('bilinear mask filtering cannot tint protected arrival, actor or path interiors',()=>{
  const material=groundMaterial();let release;
  try{
    const texture=compile(material).uniforms.rootedSoilMap.value;
    release=layout.registerHerbariumCommunityFootprints([square(26,65,4),square(-6,45,4),square(54.2,29,4)]);
    for(const [x,z] of [[15,65],[25.999,65],[26,65],[-6.001,45],[-6,45],[54.2,29],[54.2,30.199]])assert.equal(sample(texture,x,z),0,`protected point ${x},${z}`);
    assert.ok(sample(texture,28,65)>.8,'root soil outside the arrival guard remains present');
    assert.ok(sample(texture,-4,45)>.8,'root soil outside the actor guard remains present');
    assert.ok(sample(texture,57,31)>.8,'root soil beyond the path guard remains present');
    let previous=0;for(let x=26;x<=27.6;x+=.01){const value=sample(texture,x,65);assert.ok(value>=previous-1e-12);assert.ok(value-previous<.04,'the protected edge is a continuous fade');previous=value;}
  }finally{release?.();material.dispose();}
});

test('rooted-loam controls change the same uniforms without replacing maps, programs or other worlds',async()=>{
  const a=groundMaterial(),b=groundMaterial({transition:true}),other=groundMaterial();
  try{
    const sa=compile(a),sb=compile(b),so=compile(other),{setRootedLoamStrength,getRootedLoamState}=await loam(),scene=sceneWith(a,b),outside=sceneWith(other);
    const keys=[a.customProgramCacheKey(),b.customProgramCacheKey()],versions=[a.version,b.version],uniform=sa.uniforms.rootedLoamStrength,texture=sa.uniforms.rootedSoilMap.value;
    assert.equal(uniform.value,1);assert.equal(sb.uniforms.rootedLoamStrength.value,1);assert.equal(getRootedLoamState(scene).reviewStatus,'accepted-r12');
    assert.equal(setRootedLoamStrength(scene,0),2);assert.equal(uniform.value,0);assert.equal(sb.uniforms.rootedLoamStrength.value,0);assert.equal(so.uniforms.rootedLoamStrength.value,1,'UI scope does not change another world');
    const again=compile(a);assert.equal(again.uniforms.rootedLoamStrength,uniform);assert.equal(again.uniforms.rootedSoilMap.value,texture);
    for(const [name,binding]of Object.entries(sa.uniforms))assert.equal(again.uniforms[name].value,binding.value,`borrowed ${name}`);
    assert.equal(again.fragmentShader,sa.fragmentShader);assert.equal(again.vertexShader,sa.vertexShader);assert.deepEqual([a.version,b.version],versions);assert.deepEqual([a.customProgramCacheKey(),b.customProgramCacheKey()],keys);
    assert.equal(setRootedLoamStrength(scene,.5),2);assert.equal(uniform.value,.5);assert.equal(setRootedLoamStrength(scene,1),2);
    for(const value of[-1,1.1,NaN,Infinity])assert.throws(()=>setRootedLoamStrength(scene,value),RangeError);
    assert.equal(uniform.value,1);assert.equal(getRootedLoamState(outside).materials[0].strength,1);
  }finally{a.dispose();b.dispose();other.dispose();}
});

test('last compiled material releases the mask listener without disposing source PBR resources',async()=>{
  const a=groundMaterial(),b=groundMaterial();let release,late,next;
  try{
    const sa=compile(a),sb=compile(b),texture=sa.uniforms.rootedSoilMap.value,{getRootedLoamState}=await loam();assert.equal(sb.uniforms.rootedSoilMap.value,texture);
    let maskDisposals=0,pbrDisposals=0;texture.addEventListener('dispose',()=>maskDisposals++);sa.uniforms.humusMap.value.addEventListener('dispose',()=>pbrDisposals++);
    a.dispose();assert.equal(maskDisposals,0);const before=texture.version;
    release=layout.registerHerbariumCommunityFootprints([square(-10,60)]);assert.equal(texture.version,before+1,'one shared mask listener refreshes once');
    b.dispose();b.dispose();assert.equal(maskDisposals,1);assert.equal(pbrDisposals,0);const disposedVersion=texture.version;
    release();assert.equal(texture.version,disposedVersion,'disposed textures no longer subscribe');
    late=layout.registerHerbariumCommunityFootprints([square(65,10)]);next=groundMaterial();const fresh=compile(next).uniforms.rootedSoilMap.value;assert.notEqual(fresh,texture);assert.equal(sample(fresh,65,10),1,'a later world reads current registrations');
    compile(next);const current=fresh.version;late();assert.equal(fresh.version,current+1,'recompilation did not add listeners');
    next.dispose();assert.equal(getRootedLoamState(sceneWith(next)).materials.length,0);
  }finally{release?.();late?.();a.dispose();b.dispose();next?.dispose();}
});

test('occupied-cell bounds are independent snapshots and cover a narrow diagonal plant',()=>{
  assert.equal(typeof layout.herbariumCommunitySoilCellBounds,'function','the rasterizer needs a read-only spatial-index view');
  const release=layout.registerHerbariumCommunityFootprints([{loop:[[-9.9,59.9],[-7.9,61.9],[-8.1,62.1],[-10.1,60.1]],strength:.82}]);
  try{
    const bounds=layout.herbariumCommunitySoilCellBounds(),copy=layout.herbariumCommunitySoilCellBounds();assert.notEqual(bounds,copy);assert.notEqual(bounds[0],copy[0]);
    bounds[0][0]=-9999;assert.deepEqual(layout.herbariumCommunitySoilCellBounds(),copy,'callers cannot mutate the registry');
    assert.ok(copy.some(([x,z,X,Z])=>-8.1>=x&&-8.1<X&&61.9>=z&&61.9<Z));assert.ok(copy.length<12);
  }finally{release();}
});

test('empty QA groups and precompile controls allocate no mask and retain the requested first-frame strength',async()=>{
  const {setRootedLoamStrength,getRootedLoamState}=await loam();
  for(const root of[new THREE.Scene(),new THREE.Group()]){
    assert.equal(setRootedLoamStrength(root,0),0);assert.deepEqual(getRootedLoamState(root).materials,[]);assert.equal(getRootedLoamState(root).mask,null);
  }
  const material=groundMaterial(),scene=sceneWith(material);
  try{
    const before=getRootedLoamState(scene);assert.equal(before.mask,null);assert.equal(before.materials[0].compiled,false);
    assert.equal(setRootedLoamStrength(scene,0),1);assert.equal(getRootedLoamState(scene).mask,null,'UI setup does not trigger texture allocation');
    assert.equal(compile(material).uniforms.rootedLoamStrength.value,0,'the first render uses the QA selection');
  }finally{material.dispose();}
});

test('occupied bounds restrict work without painting the empty area beside an oblique hull',()=>{
  const material=groundMaterial();let release;
  try{
    const texture=compile(material).uniforms.rootedSoilMap.value;
    release=layout.registerHerbariumCommunityFootprints([{loop:[[-12,58],[-8,62],[-8.3,62.3],[-12.3,58.3]],strength:.82}]);
    assert.ok(sample(texture,-10.1,60.1)>.3);assert.equal(sample(texture,-11.8,62.1),0,'a hull bounding rectangle is not the soil shape');
    assert.equal(sample(texture,-8.2,58.2),0);
  }finally{release?.();material.dispose();}
});

test('an incompatible shader fails before acquiring the mask and disposal removes the pending binding',async()=>{
  const {bindRootedLoamMaterial,getRootedLoamState}=await loam(),material=new THREE.MeshStandardMaterial(),scene=sceneWith(material),apply=bindRootedLoamMaterial(material);
  try{
    assert.equal(bindRootedLoamMaterial(material),apply,'rebinding does not add another owner');
    assert.throws(()=>apply({uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader}),/requires the current terrain shader/);
    assert.equal(getRootedLoamState(scene).mask,null);assert.equal(getRootedLoamState(scene).materials[0].compiled,false);
    material.dispose();assert.equal(getRootedLoamState(scene).materials.length,0);
    assert.throws(()=>apply({uniforms:{},fragmentShader:''}),/disposed/);
  }finally{material.dispose();}
});
