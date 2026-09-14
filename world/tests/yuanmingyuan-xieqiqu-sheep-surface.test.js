import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSheepSectionProfile} from '../src/yuanmingyuan/xieqiqu-sheep-anatomy.js';
import {createSheepFleeceField,sculptSheepFleece,subdivideSheepSkin,redistributeSheepSkinSamples,sheepFleeceDirectionAt,computeSheepCarvingNormals} from '../src/yuanmingyuan/xieqiqu-sheep-fleece.js';
import {createCopperSheepEarGeometry,copperSheepEarSides} from '../src/yuanmingyuan/xieqiqu-copper-sheep.js';
import {sheepShoulderAxisZ} from '../src/yuanmingyuan/xieqiqu-sheep-detail.js';

test('anatomical section radii and centres are continuous across authored joints, without capsule rings',()=>{
  const controls=[[.26,.12,.54,.044,.043],[.26,.20,.53,.049,.054],[.25,.40,.53,.034,.043],[.25,.52,.52,.061,.070],[.25,.65,.49,.049,.060],[.23,.80,.46,.08,.09]],profile=createSheepSectionProfile(controls),eps=1e-6;
  for(const p of controls){const at=profile(p[1]);for(const [field,column]of [['x',0],['z',2],['rx',3],['rz',4]])assert.ok(Math.abs(at[field]-p[column])<1e-12);}
  for(const p of controls.slice(1,-1))for(const field of ['x','z','rx','rz']){
    const a=profile(p[1]-eps)[field],b=profile(p[1])[field],c=profile(p[1]+eps)[field];assert.ok(Math.abs((b-a)/eps-(c-b)/eps)<.0002,field+' has no derivative break at a joint');
  }
  for(let i=0;i<=1000;i++){const p=profile(.12+i*.68/1000);assert.ok(p.rx>=.034&&p.rx<=.080001);assert.ok(p.rz>=.043&&p.rz<=.090001);}
  assert.throws(()=>createSheepSectionProfile([[0,1,0,.1,.1],[0,1,0,.1,.1]]));
});

test('a finite S-shaped sculpted lock has a visible crest and tapers to the original surface',()=>{
  const points=Array.from({length:65},(_,i)=>{const t=i/64;return [.024*Math.sin(t*Math.PI*2),.15*(.5-t),0];}),field=createSheepFleeceField([{id:'actual-S-lock',points,height:.018,width:.023}]);
  assert.ok(field.heightAt(...points[32])>.0179);assert.ok(field.heightAt(...points[0])<.002);assert.equal(field.heightAt(.10,0,0),0);assert.equal(field.heightAt(0,0,.05),0);
  assert.ok(field.heightAt(.017,0,0)<field.heightAt(0,0,0));assert.ok(field.diagnostics.segments===64);
});

test('projected carving retains its full height while excluding the opposite side of a thin fold',()=>{
  const points=Array.from({length:33},(_,i)=>[0,.10-.20*i/32,0]),field=createSheepFleeceField([{id:'front-carving',points,height:.023,width:.027,direction:[0,0,1]}]);
  const height=field.sampleAt(0,0,0,new THREE.Vector3(.8,0,.6));assert.ok(height>.0229);
  assert.equal(field.sampleAt(0,0,0,new THREE.Vector3(0,0,-1)),0,'front-carved relief must not bleed through to the back of a folded skin');
  const back=new THREE.Vector3(-.98,-.14,-.14).normalize(),direction=sheepFleeceDirectionAt(-.15,1.15,.53,back);assert.ok(direction.dot(back)>.95&&direction.z<0,'the rear shoulder expands outward instead of being pushed toward the front');
});

test('carving normals follow the actual corner fan regardless of adjacent triangle area',()=>{
  const expected=new THREE.Vector3(Math.sin(Math.PI/8),0,Math.cos(Math.PI/8));
  for(const radius of [.01,1,100]){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,radius,0,0,0,1,0,-1,0,1],3));g.setIndex([0,1,2,0,2,3]);const original=g.attributes.position.array.slice(),index=g.index.array.slice();
    try{computeSheepCarvingNormals(g);assert.ok(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,0).distanceTo(expected)<1e-7);assert.deepEqual(g.attributes.position.array,original);assert.deepEqual(g.index.array,index);}finally{g.dispose();}
  }
});

test('fleece moves real vertices while preserving the index topology and the caller-owned original',()=>{
  const source=new THREE.SphereGeometry(.2,80,48),original=source.attributes.position.array.slice(),geometry=subdivideSheepSkin(source),before=geometry.attributes.position.array.slice(),index=geometry.index.array.slice(),points=Array.from({length:33},(_,i)=>{const t=i/32,y=.10-.20*t,x=.020*Math.sin(Math.PI*2*t);return [x,y,Math.sqrt(.04-x*x-y*y)];});
  try{
    const result=sculptSheepFleece(geometry,[{id:'curved-surface-lock',points,height:.018,width:.027}]);assert.ok(result.maximumDisplacement>.017);assert.ok(result.displacedVertices>80);assert.deepEqual(geometry.index.array,index);assert.deepEqual(source.attributes.position.array,original);
    let maximum=0;const p=geometry.attributes.position,n=geometry.attributes.normal;for(let i=0;i<p.count;i++){maximum=Math.max(maximum,Math.hypot(p.getX(i)-before[i*3],p.getY(i)-before[i*3+1],p.getZ(i)-before[i*3+2]));assert.ok(Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i)));}assert.ok(maximum>.017&&maximum<.01801);
  }finally{source.dispose();geometry.dispose();}
});

test('redistribution improves a real thin sampling cell without deleting faces or moving along its normal',()=>{
  const geometry=new THREE.PlaneGeometry(.1,.1,8,8);geometry.translate(0,1,0);const p=geometry.attributes.position,centre=40,left=39,right=41;
  p.setXYZ(centre,p.getX(left)+.000015,p.getY(left),0);const original=geometry.index.array.slice(),before=p.getX(centre)-p.getX(left);
  try{const report=redistributeSheepSkinSamples(geometry);assert.deepEqual(geometry.index.array,original);assert.ok(p.getX(centre)-p.getX(left)>before*10);assert.ok(p.getX(right)>p.getX(centre));assert.ok(report.maximumNormalTravel<1e-8);for(let i=0;i<p.count;i++)assert.equal(p.getZ(i),0);assert.ok(report.maximumTravel<.017);}finally{geometry.dispose();}
});

test('both ears are closed positive-volume cupped solids with a real thin wall',()=>{
  for(const side of [-1,1]){
    const g=createCopperSheepEarGeometry(side),p=g.attributes.position,id=g.index.array,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    try{
      const vertices=new Map(),lookup=[],edges=new Map();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].join(',');if(!vertices.has(key))vertices.set(key,vertices.size);lookup.push(vertices.get(key));}
      for(let i=0;i<id.length;i+=3)for(let j=0;j<3;j++){const x=lookup[id[i+j]],y=lookup[id[i+(j+1)%3]],key=Math.min(x,y)+','+Math.max(x,y),edge=edges.get(key)??[0,0];edge[0]++;edge[1]+=x<y?1:-1;edges.set(key,edge);}assert.ok([...edges.values()].every(([count,winding])=>count===2&&winding===0),'actual rim and cap edges form a closed consistently wound solid');
      let volume=0;for(let i=0;i<id.length;i+=3){a.fromBufferAttribute(p,id[i]);b.fromBufferAttribute(p,id[i+1]);c.fromBufferAttribute(p,id[i+2]);volume+=a.dot(b.cross(c))/6;}assert.ok(volume>0&&volume<.001);
      const forward=new THREE.Vector3(0,.392,.92).normalize(),row=32*copperSheepEarSides,center=new THREE.Vector3(),rim=new THREE.Vector3();
      center.fromBufferAttribute(p,row+copperSheepEarSides/4);rim.fromBufferAttribute(p,row);assert.ok(rim.sub(center).dot(forward)>.015,'rim rises above the recessed inner face');
      a.fromBufferAttribute(p,row+copperSheepEarSides/4);b.fromBufferAttribute(p,row+3*copperSheepEarSides/4);assert.ok(a.distanceTo(b)>.013&&a.distanceTo(b)<.019,'inner and outer skin have actual thickness');
    }finally{g.dispose();}
  }
});

// These are actual failed sheep faces copied from the recorded CPU geometry,
// not coordinates invented to match the corrected result.
test('saved shoulder-hollow faces retain cross-section azimuth and height under full relief',async()=>{
  const input=JSON.parse(await readFile(new URL('./fixtures/xieqiqu-sheep-r3-sampling.json',import.meta.url),'utf8'));
  assert.equal(input.thinCells.faces.length,12);assert.equal(input.shoulderHollows.faces.length,7);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const face of input.shoulderHollows.faces){
    const points=face.vertices.map(v=>new THREE.Vector3(...v.before)),center=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/3),curve=Array.from({length:33},(_,i)=>[center.x,center.y+.05-.10*i/32,center.z]),field=createSheepFleeceField([{id:'front-hollow-carving',points:curve,height:.023,width:.04,direction:[0,0,1]}]);
    a.copy(points[0]);b.copy(points[1]).sub(a);c.copy(points[2]).sub(a);const before=b.cross(c).z;assert.ok(before>0,'actual shoulder is a front-visible graph');
    const moved=points.map(p=>{const direction=sheepFleeceDirectionAt(p.x,p.y,p.z,new THREE.Vector3(.5,-.5,.7071).normalize()),height=field.heightAt(p.x,p.y,p.z),next=p.clone().addScaledVector(direction,height);assert.ok(height>.01);assert.equal(next.y,p.y);assert.ok(Math.abs(Math.atan2(next.x,next.z-sheepShoulderAxisZ(next.y))-Math.atan2(p.x,p.z-sheepShoulderAxisZ(p.y)))<1e-14);return next;});
    const projected=ps=>ps.map(p=>new THREE.Vector3(Math.atan2(p.x,p.z-sheepShoulderAxisZ(p.y)),p.y,0)),first=projected(points),second=projected(moved);
    a.copy(first[0]);b.copy(first[1]).sub(a);c.copy(first[2]).sub(a);const orientation=b.cross(c).z;a.copy(second[0]);b.copy(second[1]).sub(a);c.copy(second[2]).sub(a);assert.ok(Math.abs(b.cross(c).z-orientation)<1e-15,'actual azimuth/Y orientation remains unchanged');
  }
  const normal=new THREE.Vector3(.3,.95,0).normalize();assert.ok(sheepFleeceDirectionAt(.15,1.3,-.5,normal).distanceTo(normal)<1e-14,'back keeps its continuous normal; it never changes axes with lock height');
});
