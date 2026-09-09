import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AnimationMixer,Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import sharp from 'sharp';
import {loadCompanionAssets,createCompanionActor,companionAssetDiagnostics} from '../src/companion-assets.js';
import {companionManifest} from '../src/companion-manifest.js';

// Preserve the accepted static identity reference alongside actual runtime tests.
let gltf,review,bytes;
const runtimeGLTF=new Map(),runtimeBytes=new Map();
before(async()=>{
  review=JSON.parse(await readFile(new URL('../../docs/art/living-v8/companions/elizabeth-static-review.json',import.meta.url),'utf8'));
  bytes=await readFile(new URL(`../../${review.archived_model||review.model}`,import.meta.url));
  gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);
  // Node has no canvas/WebGL. Decode real image bytes with sharp; the bitmap and
  // canvas shims test ownership only. Text layout and pixels are a browser gate.
  globalThis.self=globalThis;
  globalThis.createImageBitmap=async blob=>{
    const buffer=Buffer.from(await blob.arrayBuffer()),metadata=await sharp(buffer).metadata();
    await sharp(buffer).raw().toBuffer();
    return {width:metadata.width,height:metadata.height,close(){}};
  };
  globalThis.OffscreenCanvas=class {
    constructor(width,height){this.width=width;this.height=height;}
    getContext(){return {fillRect(){},fillText(){},measureText:text=>({width:text.length*90})};}
  };
  const nativeFetch=globalThis.fetch;
  globalThis.fetch=async (url,...options)=>{
    if(String(url).startsWith('/models/companions/'))return new Response(await readFile(new URL(`../public${url}`,import.meta.url)));
    return nativeFetch(url,...options);
  };
  try{
    await loadCompanionAssets({deadline:performance.now()+30000});
    for(const [kind,asset] of Object.entries(companionManifest)){
      const data=await readFile(new URL(`../public${asset.url}`,import.meta.url));
      runtimeBytes.set(kind,data);
      runtimeGLTF.set(kind,await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),''));
    }
  }finally{globalThis.fetch=nativeFetch;}
});

function connectedComponents(geometry){
  const positions=geometry.getAttribute('position'),index=geometry.index;
  const key=i=>[positions.getX(i),positions.getY(i),positions.getZ(i)].map(n=>n.toFixed(5)).join(',');
  const edges=new Map();
  const connect=(a,b)=>{
    if(!edges.has(a))edges.set(a,new Set());
    if(!edges.has(b))edges.set(b,new Set());
    edges.get(a).add(b);edges.get(b).add(a);
  };
  for(let i=0;i<(index?.count??positions.count);i+=3){
    const triangle=[0,1,2].map(j=>key(index?index.getX(i+j):i+j));
    connect(triangle[0],triangle[1]);connect(triangle[1],triangle[2]);connect(triangle[2],triangle[0]);
  }
  const unseen=new Set(edges.keys());let components=0;
  while(unseen.size){
    components++;const stack=[unseen.values().next().value];
    while(stack.length){
      const vertex=stack.pop();if(!unseen.delete(vertex))continue;
      for(const neighbor of edges.get(vertex))if(unseen.has(neighbor))stack.push(neighbor);
    }
  }
  return components;
}

test('static review evidence identifies the exact real decoded GLB',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),review.sha256);
  assert.equal(gltf.animations.length,0,'static art gate must not conceal premature animations');
  for(const render of Object.values(review.renders))assert.equal(render.asset_sha256,review.sha256);
  assert.ok(gltf.scene.getObjectByName('Elizabeth'));
  assert.equal(gltf.scene.getObjectByName('REVIEW_floor'),undefined,'studio geometry is not exported');
});

test('all real export geometry, indices and transforms are finite',()=>{
  let meshes=0;
  gltf.scene.traverse(object=>{
    assert.ok(object.matrixWorld.elements.every(Number.isFinite),`${object.name} world matrix`);
    if(!object.isMesh)return;
    meshes++;
    const geometry=object.geometry,position=geometry.getAttribute('position');
    assert.ok(position.count>0);
    for(const attribute of Object.values(geometry.attributes)){
      assert.ok(Array.from(attribute.array).every(Number.isFinite),`${object.name} finite attributes`);
    }
    if(geometry.index)assert.ok(Array.from(geometry.index.array).every(i=>i>=0&&i<position.count),`${object.name} valid indices`);
    assert.ok(object.material?.name,`${object.name} preserves authored material`);
  });
  assert.ok(meshes>=12);
  const size=new Box3().setFromObject(gltf.scene).getSize(new Vector3());
  assert.ok(size.y>2.95&&size.y<3.02,'authored 3 m height survives glTF axes');
});

test('shell and flippers are one connected surface; attached webbed feet are supported',()=>{
  assert.equal(connectedComponents(gltf.scene.getObjectByName('ContinuousShell').geometry),1);
  for(const side of ['L','R']){
    const foot=gltf.scene.getObjectByName(`WebFoot${side}`);
    assert.equal(connectedComponents(foot.geometry),1,`${side} foot and root form one surface`);
    const bounds=new Box3().setFromObject(foot);
    assert.ok(bounds.min.y>=-.002&&bounds.min.y<.015,`${side} sole is on the ground`);
    assert.ok(bounds.max.y>.26,`${side} foot root reaches inside the hem`);
    assert.ok(bounds.max.z-bounds.min.z>.5,`${side} web has a real forward footprint`);
  }
});

test('TV face retains three lashes per eye, dot pupils and a two-part broad bill',()=>{
  const lashes=[];
  gltf.scene.traverse(object=>{if(/^UpperLash[LR][1-3]$/.test(object.name))lashes.push(object);});
  assert.equal(lashes.length,6);
  for(const side of ['L','R']){
    for(const n of [1,2,3])assert.ok(gltf.scene.getObjectByName(`UpperLash${side}${n}`));
    const eye=new Box3().setFromObject(gltf.scene.getObjectByName(`EyeWhite${side}`)).getSize(new Vector3());
    const pupil=new Box3().setFromObject(gltf.scene.getObjectByName(`Pupil${side}`)).getSize(new Vector3());
    assert.ok(pupil.x/eye.x>=.07&&pupil.x/eye.x<=.13,'pupil remains a centered dot');
  }
  const upper=new Box3().setFromObject(gltf.scene.getObjectByName('BeakUpper'));
  const lower=new Box3().setFromObject(gltf.scene.getObjectByName('BeakLower'));
  assert.ok(upper.max.y>lower.max.y&&lower.min.y<upper.min.y);
  assert.ok(upper.getSize(new Vector3()).x>.6,'beak remains broad');
  assert.ok(gltf.scene.getObjectByName('BeakSeam'));
});

function poseSnapshot(actor){
  actor.group.updateMatrixWorld(true);
  const values=[];
  actor.model.traverse(object=>{if(object.isBone)values.push(...object.matrixWorld.elements);});
  return values;
}
function closePose(a,b,tolerance=1e-5){
  assert.equal(a.length,b.length);
  assert.ok(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<tolerance,'bone transforms remain continuous');
}
function evaluate(gltf,clip,time){
  const mixer=new AnimationMixer(gltf.scene),action=mixer.clipAction(gltf.animations.find(c=>c.name===clip));
  action.play();action.time=time;mixer.update(0);gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(object=>object.skeleton?.update());
  return mixer;
}

test('runtime files preserve identity, finite skin data and exact authored action times',()=>{
  for(const [kind,asset] of Object.entries(companionManifest)){
    const decoded=runtimeGLTF.get(kind);
    assert.equal(createHash('sha256').update(runtimeBytes.get(kind)).digest('hex'),asset.sha256);
    assert.deepEqual(decoded.animations.map(clip=>clip.name).sort(),[...asset.actions].sort());
    for(const clip of decoded.animations){
      assert.ok(Math.abs(clip.duration-asset.durations[clip.name])<1e-6);
      assert.ok(clip.tracks.length>0);
      for(const track of clip.tracks){
        assert.equal(track.times[0],0,`${kind}/${clip.name} starts at t=0`);
        assert.ok(Array.from(track.times).every(Number.isFinite));
        assert.ok(Array.from(track.values).every(Number.isFinite));
        for(let i=1;i<track.times.length;i++)assert.ok(track.times[i]>track.times[i-1]);
      }
    }
    decoded.scene.updateMatrixWorld(true);
    decoded.scene.traverse(object=>{
      assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      if(!object.isMesh)return;
      for(const attribute of Object.values(object.geometry.attributes))assert.ok(Array.from(attribute.array).every(Number.isFinite),object.name);
      if(!object.isSkinnedMesh)return;
      assert.ok(object.skeleton.bones.length>1);
      const weights=object.geometry.getAttribute('skinWeight'),indices=object.geometry.getAttribute('skinIndex');
      for(let i=0;i<weights.count;i++){
        assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<2e-4);
        for(let j=0;j<4;j++)assert.ok(indices.getComponent(i,j)<object.skeleton.bones.length);
      }
    });
  }
});

test('clones have independent skeletons, mixers and disposable localized sign resources',()=>{
  const a=createCompanionActor('elizabeth'),b=createCompanionActor('elizabeth');
  const aFoot=a.model.getObjectByName('WebFootL'),bFoot=b.model.getObjectByName('WebFootL');
  const faceA=a.model.getObjectByName('SignFace'),faceB=b.model.getObjectByName('SignFace');
  assert.notEqual(a.mixer,b.mixer);assert.notEqual(aFoot.skeleton,bFoot.skeleton);
  assert.notEqual(aFoot.skeleton.bones[0],bFoot.skeleton.bones[0]);
  assert.equal(aFoot.geometry,bFoot.geometry);assert.equal(aFoot.material,bFoot.material);
  assert.notEqual(a.model.getObjectByName('SignSocket'),b.model.getObjectByName('SignSocket'));
  assert.notEqual(faceA.material,faceB.material);assert.notEqual(faceA.material.map,faceB.material.map);
  const bPose=poseSnapshot(b);a.setAction('sign');a.update(.5);closePose(bPose,poseSnapshot(b));assert.equal(b.time,0);
  const texture=faceA.material.map;a.setLanguage('en');a.setSign({en:'A different message.'});assert.equal(faceA.material.map,texture);assert.equal(b.language,'zh');
  let textureDisposed=0,materialDisposed=0,geometryDisposed=0,boneTextureDisposed=0;
  texture.addEventListener('dispose',()=>textureDisposed++);faceA.material.addEventListener('dispose',()=>materialDisposed++);
  aFoot.geometry.addEventListener('dispose',()=>geometryDisposed++);
  aFoot.skeleton.computeBoneTexture();aFoot.skeleton.boneTexture.addEventListener('dispose',()=>boneTextureDisposed++);
  a.dispose();a.dispose();assert.equal(textureDisposed,1);assert.equal(materialDisposed,1);assert.equal(boneTextureDisposed,1);assert.equal(geometryDisposed,0);
  b.update(.1);assert.ok(b.time>0);b.dispose();
  for(let i=0;i<12;i++){const actor=createCompanionActor('elizabeth');actor.dispose();}
  assert.equal(companionAssetDiagnostics().liveActors,0);
});

test('pause, walk speed, reduced motion and sign sequence have observable runtime behavior',()=>{
  const actor=createCompanionActor('elizabeth');
  actor.setAction('walk');actor.update(.3,{speed:.64/1.2});assert.ok(Math.abs(actor.time-.3)<1e-6);
  const pose=poseSnapshot(actor);actor.update(.7,{paused:true});assert.equal(actor.time,.3);closePose(pose,poseSnapshot(actor));
  actor.update(.2,{speed:0});assert.equal(actor.time,.3);
  actor.update(.2,{speed:2*.64/1.2});assert.ok(Math.abs(actor.time-.7)<1e-6);
  actor.update(.1,{reducedMotion:true});const still=poseSnapshot(actor);actor.update(3,{reducedMotion:true});closePose(still,poseSnapshot(actor));assert.equal(actor.clip,'idle');
  actor.setAction('sign');actor.update(.60);assert.equal(actor.clip,'sign_hold');assert.ok(Math.abs(actor.time-.05)<1e-6);
  actor.update(2.50);assert.equal(actor.clip,'sign_lower');assert.ok(Math.abs(actor.time-.05)<1e-6);
  actor.update(.55);assert.equal(actor.clip,'idle');
  actor.setAction('sign');actor.update(0,{reducedMotion:true});assert.equal(actor.clip,'sign_hold');
  actor.dispose();
});

test('loop seams and sign transitions preserve bone pose and physical socket contact',()=>{
  const actor=createCompanionActor('elizabeth');
  for(const name of ['idle','walk','sign_hold']){
    actor.setAction(name);actor.seek(0);const start=poseSnapshot(actor);actor.seek(actor.duration-1e-6);closePose(start,poseSnapshot(actor),2e-5);
  }
  for(const [outgoing,incoming] of [['sign_raise','sign_hold'],['sign_hold','sign_lower'],['sign_lower','idle']]){
    actor.setAction(outgoing);actor.seek(actor.duration);const previous=poseSnapshot(actor);actor.setAction(incoming);actor.seek(0);closePose(previous,poseSnapshot(actor),2e-4);
  }
  const grip=actor.model.getObjectByName('GripR'),socket=actor.model.getObjectByName('SignSocket');
  actor.setAction('sign_raise');
  for(let i=0;i<=22;i++){
    actor.seek(.55*i/22);
    const end=grip.localToWorld(new Vector3(0,.055009,0)),held=socket.getWorldPosition(new Vector3());
    assert.ok(Math.abs(end.distanceTo(held)-.024)<.002,`shaft remains in contact at ${i}`);
  }
  const sign=actor.model.getObjectByName('SignFace').geometry,uv=sign.getAttribute('uv');
  assert.ok(Math.min(...Array.from(uv.array))>=-1e-5&&Math.max(...Array.from(uv.array))<=1.00001);
  assert.ok(Math.max(...Array.from(uv.array).filter((_,i)=>i%2===0))>.99,'sign canvas covers full board width');
  actor.dispose();
});

test('decoded and skinned walk sweep keeps each webbed sole above ground',()=>{
  const decoded=runtimeGLTF.get('elizabeth'),feet=['WebFootL','WebFootR'].map(name=>decoded.scene.getObjectByName(name));
  const mixer=evaluate(decoded,'walk',0),clip=decoded.animations.find(c=>c.name==='walk'),action=mixer.clipAction(clip),vertex=new Vector3();
  let minimum=Infinity;
  for(let sample=0;sample<=120;sample++){
    action.time=clip.duration*sample/120;mixer.update(0);decoded.scene.updateMatrixWorld(true);
    for(const foot of feet){
      foot.skeleton.update();const position=foot.geometry.getAttribute('position');let sole=Infinity;
      for(let i=0;i<position.count;i++){
        vertex.fromBufferAttribute(position,i);foot.applyBoneTransform(i,vertex);vertex.applyMatrix4(foot.matrixWorld);sole=Math.min(sole,vertex.y);
      }
      minimum=Math.min(minimum,sole);assert.ok(sole>=-.0001,`${foot.name} penetrates ground at phase ${sample/120}: ${sole}`);
    }
  }
  assert.ok(minimum>=.0079&&minimum<=.0081,'authored sole clearance survives export');mixer.stopAllAction();
});

test('bounded planted-foot support is stable on repeat updates and clears when removed',()=>{
  const actor=createCompanionActor('elizabeth');actor.setAction('idle');actor.seek(0);
  const sole=actor.model.getObjectByName('SoleL'),original=sole.getWorldPosition(new Vector3()).y;
  actor.update(0,{getSupportHeight:()=>.03});assert.ok(Math.abs(sole.getWorldPosition(new Vector3()).y-.038)<1e-5);
  actor.update(0,{getSupportHeight:()=>.03});assert.ok(Math.abs(sole.getWorldPosition(new Vector3()).y-.038)<1e-5,'correction does not accumulate');
  actor.update(0);assert.ok(Math.abs(sole.getWorldPosition(new Vector3()).y-original)<1e-5);
  actor.update(0,{getSupportHeight:()=>2});assert.equal(actor.footStates.get('SoleL').correction,.08);
  actor.setAction('walk');actor.seek(.9);let callbacks=0;actor.update(0,{getSupportHeight:()=>{callbacks++;return .02;}});
  assert.equal(callbacks,1,'only stance foot accepts terrain correction');actor.dispose();
});

test('Sadaharu keeps connected anatomy and fine normals without the rejected card layer',()=>{
  const decoded=runtimeGLTF.get('sadaharu'),body=decoded.scene.getObjectByName('SadaharuCoat');
  assert.equal(connectedComponents(body.geometry),1,'head/neck/trunk/limbs/tail form continuous anatomy');
  assert.ok(body.material.normalMap,'fine directional relief survives GLB export');
  assert.equal(decoded.scene.getObjectByName('FineDirectionalFurCards'),undefined,'the GPU-rejected layer is retained only in editable source');
  assert.equal(body.material.normalMap.image.width,2048);assert.equal(body.material.normalMap.image.height,2048);
});

test('Sadaharu has independent quadruped motion, supported paws and a grounded seated body',t=>{
  const a=createCompanionActor('sadaharu'),b=createCompanionActor('sadaharu'),body=a.model.getObjectByName('SadaharuCoat');
  assert.notEqual(body.skeleton,b.model.getObjectByName('SadaharuCoat').skeleton);
  assert.equal(body.geometry,b.model.getObjectByName('SadaharuCoat').geometry);
  const untouched=poseSnapshot(b),position=body.geometry.getAttribute('position'),vertex=new Vector3();
  const soleVertices={FrontL:[],FrontR:[],HindL:[],HindR:[]};
  for(let i=0;i<position.count;i++){
    vertex.fromBufferAttribute(position,i).applyMatrix4(body.matrixWorld);
    if(vertex.y<.0205)soleVertices[(vertex.z>-.5?'Front':'Hind')+(vertex.x<0?'L':'R')].push(i);
  }
  const swingHeights=Object.fromEntries(Object.keys(soleVertices).map(key=>[key,0]));
  for(const clip of a.asset.actions){
    a.setAction(clip);
    for(let sample=0;sample<=80;sample++){
      a.seek(a.duration*sample/80);a.update(0);
      for(const [key,indices] of Object.entries(soleVertices)){
        let minimum=Infinity;
        for(const i of indices){vertex.fromBufferAttribute(position,i);body.applyBoneTransform(i,vertex);vertex.applyMatrix4(body.matrixWorld);minimum=Math.min(minimum,vertex.y);}
        assert.ok(minimum>=-.0001,`${clip} ${key} sole at ${sample/80}: ${minimum}`);
        if(clip==='walk')swingHeights[key]=Math.max(swingHeights[key],minimum);
      }
      // The original sit passed paw tests but put the rump 7.4 cm below ground.
      if((clip==='sit'||clip==='stand')&&sample%4===0){
        for(let i=0;i<position.count;i++){
          vertex.fromBufferAttribute(position,i);body.applyBoneTransform(i,vertex);vertex.applyMatrix4(body.matrixWorld);
          assert.ok(vertex.y>=-.0001,`${clip} body penetrates at phase ${sample/80}, vertex ${i}: ${vertex.y}`);
        }
      }
    }
  }
  for(const [key,height] of Object.entries(swingHeights))assert.ok(height>.12,`${key} has a genuine swing phase`);
  a.setAction('walk');a.seek(.10);const sole=a.model.getObjectByName('FrontSoleL'),start=sole.getWorldPosition(new Vector3());
  a.seek(.20);const end=sole.getWorldPosition(new Vector3());
  assert.ok(Math.abs((end.z-start.z)/.1+a.asset.walk.stride/a.asset.walk.duration)<.015,'stance motion matches authored root travel');
  closePose(untouched,poseSnapshot(b));
  a.setAction('sit');a.update(0,{reducedMotion:true});assert.equal(a.clip,'sit');assert.ok(Math.abs(a.time-a.duration)<1e-5);
  const still=poseSnapshot(a);a.update(2,{reducedMotion:true});closePose(still,poseSnapshot(a));
  // Exercise actual actor crossfades too; seek-only checks bypass that path.
  a.setAction('idle');a.seek(0);
  const transitionMinima={};
  for(const clip of ['sit','stand','idle']){
    a.setAction(clip);let minimum=Infinity;
    for(let frame=0;frame<Math.ceil(a.duration*40);frame++){
      a.update(.025);
      if(frame%4!==0)continue;
      for(let i=0;i<position.count;i++){
        vertex.fromBufferAttribute(position,i);body.applyBoneTransform(i,vertex);vertex.applyMatrix4(body.matrixWorld);
        minimum=Math.min(minimum,vertex.y);
      }
    }
    assert.ok(minimum>=-.0001,`${clip} live transition body minimum ${minimum}`);
    transitionMinima[clip]=minimum;
  }
  t.diagnostic(`Decoded live transition body minima: ${JSON.stringify(transitionMinima)}`);
  a.dispose();b.dispose();assert.equal(companionAssetDiagnostics().liveActors,0);
});
