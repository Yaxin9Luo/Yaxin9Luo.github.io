import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createWorld} from '../src/world.js';
import {cliffScanBounds} from '../src/environment-composition.js';
import {loadScannedRockAssets,scannedRockSource,addScannedRocks} from '../src/rock-scans.js';
import {placementMatrix} from '../src/foliage-lod.js';
import {bridges,locations} from '../src/locations.js';
import {readScanGeometry} from './helpers/scan-geometry.js';

// Real GLB triangles and the actual clipped coast. Only browser image decoding
// is substituted; the regression must never pass using empty source bounds.
const load=GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync=async url=>readScanGeometry(url);
try{await loadScannedRockAssets();}finally{GLTFLoader.prototype.loadAsync=load;}
const world=createWorld(new THREE.Scene()),rocks=world.composition.stats.placements.filter(p=>p.type==='cliff-refine');

test('cliff support uses full volumetric scans without modifying source topology or UVs',()=>{
  const source=readScanGeometry('/models/environment/scans/rock_moss_set_02.glb').scene.children;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const piece of new Set(rocks.map(p=>p.piece))){
    const geometry=scannedRockSource('moss',piece).geometry,position=geometry.attributes.position,index=geometry.index;
    assert.deepEqual(index.array,source[piece].geometry.index.array);
    assert.deepEqual(geometry.attributes.uv.array,source[piece].geometry.attributes.uv.array);
    assert.equal(position.count,source[piece].geometry.attributes.position.count);
    assert.ok(index.count/3>=7900,'full source geometry is retained');
    let volume=0;for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(position,index.getX(i));b.fromBufferAttribute(position,index.getX(i+1));c.fromBufferAttribute(position,index.getX(i+2));volume+=a.dot(b.cross(c))/6;}
    const size=geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(Math.abs(volume)/(size.x*size.y*size.z)>.22,'the source encloses substantial volume, not an open face');
  }
  assert.ok(rocks.every(p=>p.kind==='moss'&&!p.mountedCliff));
});

test('all added cliff rocks meet the waterline and leave the middle and upper wall clear',()=>{
  const regions=new Set(rocks.map(p=>p.region));
  assert.deepEqual([...regions].sort(),['contact-approach','east-channel','observatory-front','post-front','research-approach']);
  assert.ok(rocks.length>=15&&rocks.length<=24,'only small groups at the waterline are retained');
  for(const region of regions){
    const pieces=rocks.filter(p=>p.region===region);
    assert.ok(pieces.some(p=>p.tier==='waterline-base'),`${region} has an underwater base`);
    assert.ok(pieces.every(p=>p.bounds.min[1]<-15&&p.bounds.max[1]>-15),'every complete rock volume intersects the lake surface');
    assert.ok(pieces.every(p=>p.bounds.max[1]<=-9.2+1e-6),'middle and upper wall stay clear of isolated rocks');
  }
  const widths=rocks.map(p=>Math.max(p.bounds.max[0]-p.bounds.min[0],p.bounds.max[2]-p.bounds.min[2]));
  assert.ok(widths.every(w=>w>5),'the silhouette is made from substantial rock bodies');
  assert.ok(new Set(rocks.map(p=>p.sx.toFixed(2))).size>12,'unequal widths avoid a tiled rock ring');
});

test('transformed source vertices preserve water and conservative bridge and portal clearance',()=>{
  const point=new THREE.Vector3();
  for(const rock of rocks){
    const {corners,box}=cliffScanBounds(rock);
    for(const [name,[a,b]]of Object.entries(bridges)){
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
      const along=corners.map(p=>(p.x-a[0])*dx+(p.z-a[1])*dz),across=corners.map(p=>(p.x-a[0])*dz-(p.z-a[1])*dx);
      const intersects=Math.min(...along)<length+3&&Math.max(...along)>-3&&Math.min(...across)<3.8&&Math.max(...across)>-3.8;
      assert.equal(intersects,false,`${rock.region}/${rock.tier} clips ${name} bridge or landing`);
    }
    for(const l of locations){const clips=box.max.y>l.y-.25&&box.min.x<l.x+4.6&&box.max.x>l.x-4.6&&box.min.z<l.z+l.radius+5.7&&box.max.z>l.z+l.radius+.3;assert.equal(clips,false,`${l.id} portal entry`);}
    const shore=rock.shore,position=scannedRockSource('moss',rock.piece).geometry.attributes.position,matrix=placementMatrix(rock);let reach=-Infinity;
    for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(matrix);reach=Math.max(reach,(point.x-shore.x)*shore.nx+(point.z-shore.z)*shore.nz);}
    assert.ok(reach<=shore.waterWidth*.4+1e-6,'vertices leave the centre of the channel open');
    assert.ok(Math.abs(reach-shore.reach)<1e-6);
  }
});

test('front and back triangle intersections show exposed relief with the body embedded in its host',()=>{
  const host=world.root.getObjectByName('shoreline-cliffs'),ray=new THREE.Raycaster(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const hostProbe=new THREE.Mesh(host.geometry,material);
  for(const region of new Set(rocks.map(p=>p.region))){
    const rock=rocks.find(p=>p.region===region&&p.tier==='waterline-base'),shore=rock.shore;
    const mesh=new THREE.Mesh(scannedRockSource('moss',rock.piece).geometry,material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(placementMatrix(rock));mesh.updateMatrixWorld(true);
    const {box}=cliffScanBounds(rock),size=box.getSize(new THREE.Vector3()),inward=new THREE.Vector3(-shore.nx,0,-shore.nz),depth=p=>(p.x-shore.x)*shore.nx+(p.z-shore.z)*shore.nz;
    const samples=[];
    for(const u of[-.24,0,.24])for(const v of[.3,.5,.7]){
      const tangent=(rock.x-shore.x)*shore.nz-(rock.z-shore.z)*shore.nx+u*Math.max(size.x,size.z),distance=Math.min(8,shore.waterWidth*.48);
      const origin=new THREE.Vector3(shore.x+shore.nz*tangent+shore.nx*distance,box.min.y+v*size.y,shore.z-shore.nx*tangent+shore.nz*distance);
      ray.set(origin,inward);const stone=ray.intersectObject(mesh,false),wall=ray.intersectObject(hostProbe,false)[0];
      if(stone.length>1&&wall)samples.push({front:depth(stone[0].point)-depth(wall.point),back:depth(stone.at(-1).point)-depth(wall.point)});
    }
    assert.ok(samples.length>=5,`${region} has real front/back samples`);
    assert.ok(samples.filter(p=>p.front>.08).length>=samples.length*.45,`${region} exposes a substantial part of its surface`);
    assert.ok(samples.every(p=>p.front<=1.45+1e-5),`${region} does not become an extruded plaque`);
    assert.ok(samples.every(p=>p.back<-.25+1e-5),`${region} embeds its body in the host cliff`);
  }
  material.dispose();
});

test('each upper stone has actual surface contact with its submerged base',()=>{
  const upperStones=rocks.filter(p=>p.tier==='waterline-crown');assert.ok(upperStones.length>=5);
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),ray=new THREE.Raycaster();
  for(const upper of upperStones){
    const lower=rocks.find(p=>p.cluster===upper.cluster&&p.tier==='waterline-base');assert.ok(lower);
    const meshes=[upper,lower].map(p=>{const mesh=new THREE.Mesh(scannedRockSource('moss',p.piece).geometry,material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(placementMatrix(p));mesh.updateMatrixWorld(true);return mesh;});
    const {box}=cliffScanBounds(upper),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());let contacts=0;
    for(const x of[-.2,0,.2])for(const z of[-.2,0,.2]){
      ray.set(new THREE.Vector3(center.x+x*size.x,box.max.y+1,center.z+z*size.z),new THREE.Vector3(0,-1,0));
      const a=ray.intersectObject(meshes[0],false),b=ray.intersectObject(meshes[1],false);
      if(a.length>1&&b.length>1&&a.at(-1).point.y<=b[0].point.y+.05&&a[0].point.y>b[0].point.y)contacts++;
    }
    assert.ok(contacts>=3,`${upper.cluster} has broad contact across actual rock faces`);
  }
  material.dispose();
});

test('scattered scan rocks cannot occupy the bridge deck, while submerged and adjacent stones remain allowed',()=>{
  const [a,b]=bridges.research,length=Math.hypot(b[0]-a[0],b[1]-a[1]),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
  const direction=new THREE.Vector2((b[1]-a[1])/length,-(b[0]-a[0])/length);
  const group=addScannedRocks(new THREE.Group(),[
    {kind:'moss',piece:3,x,y:6.82,z,s:.7},
    {kind:'moss',piece:3,x:x+direction.x*8,y:6.82,z:z+direction.y*8,s:.7},
    {kind:'moss',piece:3,x,y:-18,z,s:2},
  ]);
  assert.equal(group.userData.instanceCount,2);
  assert.ok(group.userData.placements.every(p=>p.y<0||Math.hypot(p.x-x,p.z-z)>7));
});

test('authored shoreline shrubs and flower batches also leave the bridge plane empty',()=>{
  const matrix=new THREE.Matrix4(),plants=world.composition.group.children.filter(o=>o.isInstancedMesh);assert.ok(plants.length>3);
  for(const mesh of plants)for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14];
    for(const [a,b]of Object.values(bridges)){
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,along=(x-a[0])*dx+(z-a[1])*dz,across=(x-a[0])*dz-(z-a[1])*dx;
      assert.ok(along<=-3||along>=length+3||Math.abs(across)>=4.5,`${mesh.name} places a plant on the bridge`);
    }
  }
});
