import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createSwallow,setSwallowPose,createPaperLantern,lanternSurface,setLanternEnvironment,createFirefly,setFireflyGlow,disposeFaunaSpecimen} from '../src/sky-fauna.js';

test('swallow has full-dimensional body, tapered wings and actual short/long tail surfaces',()=>{
  const bird=createSwallow(),g=bird.geometry,p=g.attributes.position;assert.ok(p.count>10000);
  const body=new THREE.Box3(),wing=new THREE.Box3(),tail=new THREE.Box3();let centralTail=0,streamers=0;
  for(let i=0;i<p.count;i++){
    const v=new THREE.Vector3().fromBufferAttribute(p,i);assert.ok(v.toArray().every(Number.isFinite));
    if(Math.abs(v.x)<.04&&v.z<.11)body.expandByPoint(v);
    if(Math.abs(v.x)>.09&&v.z<.20)wing.expandByPoint(v);
    if(v.z>.21){tail.expandByPoint(v);if(Math.abs(v.x)<.025)centralTail++;if(v.z>.36&&Math.abs(v.x)>.05)streamers++;}
  }
  assert.ok(body.getSize(new THREE.Vector3()).y>.09,'the chest must retain thickness between the wings');
  assert.ok(wing.getSize(new THREE.Vector3()).x>.90,'complete left and right tapered flight wings');
  assert.ok(centralTail>100&&streamers>100,'short central fan and two long outer feather surfaces must coexist');
  assert.ok(tail.getSize(new THREE.Vector3()).x>.18);
  disposeFaunaSpecimen(bird);
});

test('upstroke and downstroke deform real wings and include matching finite unit normals',()=>{
  const bird=createSwallow(),g=bird.geometry,p=g.attributes.position;
  assert.equal(g.morphAttributes.position.length,2);assert.equal(g.morphAttributes.normal.length,2);
  const boxes=[];
  for(let pose=0;pose<2;pose++){
    const target=g.morphAttributes.position[pose],normals=g.morphAttributes.normal[pose];assert.equal(target.count,p.count);assert.equal(normals.count,p.count);
    let moved=0,stationary=0;const bounds=new THREE.Box3();
    for(let i=0;i<p.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(target,i),base=new THREE.Vector3().fromBufferAttribute(p,i),n=new THREE.Vector3().fromBufferAttribute(normals,i);
      assert.ok(v.toArray().every(Number.isFinite));assert.ok(n.toArray().every(Number.isFinite));
      assert.ok(n.length()>.95&&n.length()<1.05,'real shaded normals must survive morph baking');
      if(v.distanceTo(base)>.01)moved++;else stationary++;
      bounds.expandByPoint(v);
    }
    assert.ok(moved>1000&&stationary>1000,'wings articulate while the body remains stable');boxes.push(bounds);
  }
  assert.ok(boxes[0].max.y>.30);assert.ok(boxes[1].min.y<-.20);
  assert.ok(boxes[0].getSize(new THREE.Vector3()).x<g.boundingBox.getSize(new THREE.Vector3()).x*.8,'wrist fold narrows the upstroke silhouette');
  for(let i=0;i<=600;i++){setSwallowPose(bird,'flight',i/60);assert.ok(bird.morphTargetInfluences.every(w=>Number.isFinite(w)&&w>=0&&w<=1));assert.ok(bird.morphTargetInfluences.reduce((a,b)=>a+b,0)<=1+1e-8);}
  setSwallowPose(bird,'glide');assert.deepEqual(bird.morphTargetInfluences,[0,0]);assert.equal(bird.rotation.z,0);disposeFaunaSpecimen(bird);
});

test('lantern retains independently sortable translucent shell, open lower rim, full ribs and bounded emission',()=>{
  const lantern=createPaperLantern(),shell=lantern.getObjectByName('Continuous folded translucent paper shell'),frame=lantern.getObjectByName('Eight fine bamboo ribs, open double rim and crossed brace');
  assert.equal(shell.material.transparent,true);assert.equal(shell.material.side,THREE.DoubleSide);assert.equal(shell.material.depthWrite,false);assert.ok(frame.geometry.attributes.position.count>1000);
  const p=shell.geometry.attributes.position;let bottom=0;for(let i=0;i<p.count;i++)if(p.getY(i)<.015){bottom++;assert.ok(Math.hypot(p.getX(i),p.getZ(i))>.30,'the bottom is genuinely open, not a cap');}assert.ok(bottom>=48);
  setLanternEnvironment(lantern,1);const night=shell.material.emissiveIntensity;setLanternEnvironment(lantern,0);assert.ok(shell.material.emissiveIntensity<night);assert.equal(shell.material.opacity,.94,'daytime paper remains visible');
  setLanternEnvironment(lantern,1,.25);assert.ok(shell.material.opacity<.3);assert.equal(lantern.userData.aura.material.depthTest,true);assert.equal(lantern.userData.aura.material.depthWrite,false);
  disposeFaunaSpecimen(lantern);
});

test('firefly is an insect mesh with a luminous abdomen and a circular pass-camera aura',()=>{
  const insect=createFirefly();assert.ok(insect.getObjectByName('Elongated thorax'));assert.ok(insect.getObjectByName('Left membranous wing'));assert.ok(insect.getObjectByName('Right membranous wing'));
  assert.equal(insect.children.filter(o=>o.name==='Fine articulated leg').length,6);assert.equal(insect.children.filter(o=>o.name==='Curved antenna').length,2);
  setFireflyGlow(insect,0);const base=insect.userData.abdomen.material.emissiveIntensity;setFireflyGlow(insect,1);assert.ok(insect.userData.abdomen.material.emissiveIntensity>base);
  const aura=insect.userData.aura;assert.match(aura.material.vertexShader,/modelViewMatrix\*center/);assert.match(aura.material.vertexShader,/instanceMatrix\*center/);assert.match(aura.material.fragmentShader,/length\(vUv-.5\)/);assert.equal(aura.onBeforeRender,THREE.Object3D.prototype.onBeforeRender,'a render pass cannot advance insect simulation');disposeFaunaSpecimen(insect);
});

test('every bamboo rib follows the actual folded shell outside its full tube radius',()=>{
  const lantern=createPaperLantern(),shell=lantern.getObjectByName('Continuous folded translucent paper shell'),raycaster=new THREE.Raycaster();lantern.updateMatrixWorld(true);
  for(const [k,rib] of lantern.userData.ribCenterlines.entries())for(let i=1;i<rib.length-1;i++){
    const point=new THREE.Vector3(...rib[i]),attachment=lanternSurface(i/100*.97,k/8*Math.PI*2);
    raycaster.set(point,attachment.sub(point).normalize());const hit=raycaster.intersectObject(shell)[0];assert.ok(hit,'rib must sit over a real triangulated shell surface');assert.ok(hit.distance>.005&&hit.distance<.010,`rib surface clearance ${hit.distance} m`);
  }disposeFaunaSpecimen(lantern);
});

test('the complete lower hoops stay outside the triangulated paper instead of crossing its folds',()=>{
  const lantern=createPaperLantern(),shell=lantern.getObjectByName('Continuous folded translucent paper shell'),frame=lantern.getObjectByName('Eight fine bamboo ribs, open double rim and crossed brace'),p=frame.geometry.attributes.position,raycaster=new THREE.Raycaster();lantern.updateMatrixWorld(true);
  const count=lantern.userData.hoopVertexCount??(2*11*65);let checked=0;
  for(let i=0;i<count;i++){const point=new THREE.Vector3().fromBufferAttribute(p,i);if(point.y<.001)continue;raycaster.set(point,new THREE.Vector3(-point.x,0,-point.z).normalize());const hit=raycaster.intersectObject(shell)[0];assert.ok(hit&&hit.distance<.045,`hoop vertex ${i} crosses the paper: ${hit?.distance}`);checked++;}
  assert.ok(checked>500);disposeFaunaSpecimen(lantern);
});

test('firefly distal appendages taper and membrane surface normals remain finite',()=>{
  const insect=createFirefly();for(const part of insect.children.filter(o=>['Fine articulated leg','Curved antenna'].includes(o.name))){const p=part.geometry.attributes.position;const radiusAt=row=>{const center=new THREE.Vector3();for(let j=0;j<10;j++)center.add(new THREE.Vector3().fromBufferAttribute(p,row*11+j));center.multiplyScalar(.1);return new THREE.Vector3().fromBufferAttribute(p,row*11).distanceTo(center);};assert.ok(radiusAt(28)<radiusAt(0)*.18,'rounded terminal limb is finer than its attached root');}
  for(const part of insect.children.filter(o=>o.isMesh)){const n=part.geometry.attributes.normal;for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert.ok(Number.isFinite(length)&&length>.94&&length<1.06,`${part.name} normal ${i}: ${length}`);}}
  disposeFaunaSpecimen(insect);
});

test('specimen disposal releases shared materials exactly once and is idempotent',()=>{
  for(const factory of[createSwallow,createPaperLantern,createFirefly]){
    const specimen=factory(),scene=new THREE.Scene(),resources=new Map();scene.add(specimen);
    specimen.traverse(o=>{for(const r of[o.geometry,...(Array.isArray(o.material)?o.material:[o.material])].filter(Boolean))if(!resources.has(r)){resources.set(r,0);r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1));}});
    disposeFaunaSpecimen(specimen);disposeFaunaSpecimen(specimen);assert.equal(scene.children.length,0);assert.ok([...resources.values()].every(count=>count===1));
  }
});

test('GLB exports and editable recipe match the actual source manifest',async()=>{
  const root=new URL('../public/models/fauna/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8')),source=await readFile(new URL('../src/sky-fauna.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),manifest.recipeSHA256);
  for(const asset of manifest.assets){const bytes=await readFile(new URL(asset.file,root));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.ok(json.meshes.length>0);if(asset.id==='firefly'){assert.equal(json.animations[0].channels.length,8);assert.ok(json.animations[0].samplers.every(s=>json.accessors[s.input].count===1201));}if(asset.id==='swallow'){assert.ok(json.meshes.some(m=>m.primitives.some(p=>p.targets?.length===2)));assert.ok(json.animations.length>0);}}
});
