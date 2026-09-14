import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GardenGateBuilder} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {landscapeMaterials,moundGeometry,xianfaGate,spiralDeckGeometry,spiralParapetGeometry,pavilionDoorPediment,pavilionRoofSampler} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {xianfaPilasterPanel,xianfaOpenSideLeaves,xianfaPavilionPanel} from '../src/yuanmingyuan/xianfashan-details.js';
import {xianfashanTextureSources,decodeXianfashanTexturePixels,configureXianfashanMaterials,projectXianfashanStoneUVs,validateXianfashanTexturePixels} from '../src/yuanmingyuan/xianfashan-materials.js';
import {assertClosedWinding,assertGeometryNormals,ray,near} from './yuanmingyuan-garden-study-checks.js';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline=JSON.parse(readFileSync(new URL('./fixtures/xianfashan-r2-baseline.json',import.meta.url),'utf8'));
const bridgeJoinBaseline=JSON.parse(readFileSync(new URL('./fixtures/xianfaqiao-deck-join-r1.json',import.meta.url),'utf8'));
function sourceFunction(text,name){const start=text.indexOf(`export function ${name}(`);assert.ok(start>=0);const next=text.indexOf('\nexport ',start+1);return text.slice(start,next<0?undefined:next);}
function sourceSection(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return text.slice(a,b);}

test('the screen study, original screen/bridge core geometry and shared builders retain their frozen bytes',()=>{
  const current=readFileSync(new URL('../src/yuanmingyuan/xianfa-landscape-geometry.js',import.meta.url),'utf8');
  for(const [name,digest] of Object.entries(baseline.geometryFunctions))assert.equal(sha(sourceFunction(current,name)),digest,name);
  const study=readFileSync(new URL('../src/yuanmingyuan/xianfa-landscape-study.js',import.meta.url),'utf8');
  // The later bridge deck repair has its own source freeze and real component
  // regressions. Retain the original R2 baseline; guard the unchanged Fanghe
  // section independently instead of pretending the entire suffix is unchanged.
  assert.equal(bridgeJoinBaseline.originalOtherStudiesSHA256,baseline.otherStudiesSHA256);
  assert.equal(sha(sourceSection(study,'\nfunction fangheBasin(','\nexport function createXianfaqiaoStudy(')),bridgeJoinBaseline.unchangedFangheSHA256);
  const studio=readFileSync(new URL('../src/yuanmingyuan/studio-assets.js',import.meta.url),'utf8');
  assert.equal(sha(sourceSection(studio,"  'fanghe-xianfahua':", '  huanghuazhen:')),baseline.otherStudioEntriesSHA256);
  for(const [name,digest] of Object.entries(baseline.sharedBuilders))assert.equal(sha(readFileSync(new URL('../src/yuanmingyuan/'+name,import.meta.url))),digest,name);
});

test('mound keeps exact closed positions and normals but uses continuous metre UVs without periodic vertex colour',()=>{
  const g=moundGeometry(36);
  try{
    assertClosedWinding(g);assertGeometryNormals(g);assert.equal(g.attributes.color,undefined);
    const p=g.attributes.position,uv=g.attributes.uv;
    for(const [name,attribute]of Object.entries({position:p,normal:g.attributes.normal,index:g.index}))assert.equal(sha(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength)),baseline.mound36[name],`exact original ${name}`);
    for(let i=0;i<p.count;i++){near(uv.getX(i),p.getX(i),'metre U',1e-6);near(uv.getY(i),-p.getZ(i),'metre V',1e-6);}
    // Removing vertex colour is independent of the already checked road solids.
    for(const part of [spiralDeckGeometry(24),spiralParapetGeometry(-1,false,24)]){assertClosedWinding(part);part.dispose();}
  }finally{g.dispose();}
});

test('slender floral relief stays inside its pier instead of rotating long leaves across the opening',()=>{
  const b=new GardenGateBuilder('xianfa-pier-fixture'),root=new THREE.Group();
  try{
    const panel=xianfaPilasterPanel(b,root,0,0,0);const geometry=b.prototypes.get('xianfa-small-curved-petal');assertClosedWinding(geometry);assertGeometryNormals(geometry);
    b.flush();root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(panel);
    assert.ok(box.min.x>=-.266&&box.max.x<=.266,`actual relief X bounds ${box.min.x}…${box.max.x}`);
    assert.ok(box.min.y>=-1.942&&box.max.y<=1.942);assert.ok(box.max.z<.15,'a shallow carving, not projecting spikes');
    for(const mesh of panel.children.filter(node=>node.isMesh))assertGeometryNormals(mesh.geometry);
  }finally{b.dispose();root.clear();}
});

test('new side doors have true panel depth and preserve the entire original 1.75 m clear width',()=>{
  const b=new GardenGateBuilder('xianfa-leaf-fixture'),root=new THREE.Group();
  try{
    const doors=xianfaOpenSideLeaves(b,root,0);b.flush();root.updateMatrixWorld(true);
    for(const leaf of doors.children){const box=new THREE.Box3().setFromObject(leaf);assert.ok(box.max.x<=-.875||box.min.x>=.875,'all door mouldings and hinges stay outside the opening');assert.ok(box.max.z<=-.30);assert.ok(box.max.z-box.min.z>.7);}
    for(const x of [-.874,-.4,0,.4,.874])for(const y of [.12,1.7,3.65])assert.equal(ray([x,y,1],[0,0,-1],root,4).length,0);
  }finally{b.dispose();root.clear();}
});

test('complete decorated gate fixtures retain all three real through-openings and finite geometry',t=>{
  for(const east of [false,true]){
    const b=new GardenGateBuilder(`xianfa-gate-fixture-${east}`),root=new THREE.Group();let owner;
    try{
      const gate=xianfaGate(b,root,east);gate.position.set(0,0,0);gate.rotation.set(0,0,0);projectXianfashanStoneUVs(b);owner=b.finish(root,{id:'gate-fixture'});
      for(const x of [-4.48,0,4.48])for(const offset of [-.70,0,.70])for(const y of [.15,1.6,2.8])assert.equal(ray([x+offset,y,2],[0,0,-1],root,5).length,0,`${east?'east':'west'} ${x+offset},${y}`);
      root.traverse(node=>{if(node.isMesh)assertGeometryNormals(node.geometry);});
      assert.ok(owner.diagnostics.triangles<900000,'detail is confined to this gate; no blanket subdivision');
      assert.ok(root.getObjectByName(`${gate.name}-fine-entablature`));assert.ok(root.getObjectByName(`${gate.name}-open-panelled-leaves--4.48`));
      t.diagnostic(JSON.stringify({fixture:east?'east-gate':'west-gate',triangles:owner.diagnostics.triangles,meshes:owner.diagnostics.meshCount,resources:owner.diagnostics.resourceOwnership,passageRays:27}));
    }finally{owner?.dispose();b.dispose();}
  }
});

test('pavilion replacement panel has a continuous carved surround within its existing framed bay',()=>{
  const b=new GardenGateBuilder('xianfa-pavilion-panel-fixture'),root=new THREE.Group();
  try{
    const panel=xianfaPavilionPanel(b,root,[0,0,0]);b.flush();root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(panel);
    assert.ok(box.min.x>=-.806&&box.max.x<=.806);assert.ok(box.min.y>=-1.026&&box.max.y<=1.026);root.traverse(node=>{if(node.isMesh)assertGeometryNormals(node.geometry);});
  }finally{b.dispose();root.clear();}
});

test('the actual new pavilion pediment stays below the original roof soffit and above the open arch',()=>{
  const b=new GardenGateBuilder('xianfa-pediment-fixture'),root=new THREE.Group(),apothem=3.48*Math.cos(Math.PI/8);
  try{
    pavilionDoorPediment(b,root);b.flush();root.updateMatrixWorld(true);
    const a0=3*Math.PI/8,a1=5*Math.PI/8,det=Math.cos(a0)*Math.sin(a1)-Math.cos(a1)*Math.sin(a0),sample=pavilionRoofSampler(1,4.16,1.19,11.25,1.62);
    root.traverse(node=>{if(!node.isMesh)return;const p=node.geometry.attributes.position;for(let i=0;i<p.count;i++){
      const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld),x=point.x,z=point.z+apothem,c0=(x*Math.sin(a1)-z*Math.cos(a1))/det,c1=(z*Math.cos(a0)-x*Math.sin(a0))/det,r=c0+c1;
      const roofY=sample(c1/r,(r-1.19)/(4.16-1.19))[1]-.15;
      assert.ok(point.y<roofY-.009,`pediment ${point.y} below roof soffit ${roofY}`);
      if(Math.abs(x)<.87)assert.ok(point.y>8.04+1.82+.75*Math.sqrt(1-(x/.87)**2),'pediment does not close the upper arch');
    }});
  }finally{b.dispose();root.clear();}
});

test('the reused complete CC0 texture files match their frozen encoded SHA and pixel dimensions',async()=>{
  const {default:sharp}=await import('sharp');
  for(const source of Object.values(xianfashanTextureSources))for(const file of Object.values(source.files)){
    const bytes=readFileSync(new URL('../public'+file.path,import.meta.url));assert.equal(sha(bytes),file.sha256);
    const meta=await sharp(bytes).metadata();assert.equal(meta.width,source.width);assert.equal(meta.height,source.height);
  }
});

test('a real small texture decodes unchanged, closes the bitmap, and abort or errors also close it',async()=>{
  const {default:sharp}=await import('sharp'),raw=Buffer.from([25,50,75,255,120,130,140,255,210,180,130,255,30,120,25,255]),bytes=await sharp(raw,{raw:{width:2,height:2,channels:4}}).webp({lossless:true}).toBuffer();
  const source={path:'small-real-fixture.webp',width:2,height:2,sha256:sha(bytes)};let closed=0;
  const createBitmap=async blob=>({width:2,height:2,bytes:Buffer.from(await blob.arrayBuffer()),close(){closed++;}});
  const readPixels=async bitmap=>new Uint8Array(await sharp(bitmap.bytes).flip().ensureAlpha().raw().toBuffer());
  const decoded=await decodeXianfashanTexturePixels(bytes,source,{createBitmap,readPixels});assert.deepEqual([...decoded.data],[...raw.subarray(8),...raw.subarray(0,8)]);assert.equal(decoded.decodedSha256,sha(decoded.data));assert.equal(closed,1);
  const controller=new AbortController();await assert.rejects(decodeXianfashanTexturePixels(bytes,source,{signal:controller.signal,createBitmap:async blob=>{const bitmap=await createBitmap(blob);controller.abort();return bitmap;},readPixels}));assert.equal(closed,2);
  await assert.rejects(decodeXianfashanTexturePixels(bytes,source,{createBitmap,readPixels:()=>{throw new Error('canvas read failed');}}),/canvas read/);assert.equal(closed,3);
  await assert.rejects(decodeXianfashanTexturePixels(bytes,{...source,sha256:'0'.repeat(64)},{createBitmap,readPixels}),/SHA/);assert.equal(closed,3);
});

test('repeated material owners borrow real complete CC0 pixels but never reuse disposed GPU texture objects',async t=>{
  const {readXianfashanTexturePixels}=await import('../scripts/prepare-xianfashan-texture-pixels.mjs'),pixels=await readXianfashanTexturePixels();
  assert.throws(()=>validateXianfashanTexturePixels(),/verified full-resolution/);
  const first=landscapeMaterials(new GardenGateBuilder('xianfa-material-a')),second=landscapeMaterials(new GardenGateBuilder('xianfa-material-b'));
  try{
    configureXianfashanMaterials(first,pixels);configureXianfashanMaterials(second,pixels);
    const a=first.m.earth.map,c=second.m.earth.map;assert.notEqual(a,c);assert.equal(a.image.data,c.image.data);assert.equal(a.colorSpace,THREE.SRGBColorSpace);assert.equal(first.m.earth.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(first.m.earth.vertexColors,false);near(a.repeat.x,1/15,'physical meadow repeat');
    const imagesA=[...first.textures].filter(texture=>texture.userData.encodedSha256),imagesB=[...second.textures].filter(texture=>texture.userData.encodedSha256),counts=new Map();assert.equal(imagesA.length,5);assert.equal(imagesB.length,5);
    for(const image of [...imagesA,...imagesB]){assert.equal(counts.has(image),false,'all five source/replacement GPU texture objects differ');counts.set(image,0);image.addEventListener('dispose',()=>counts.set(image,counts.get(image)+1));}
    first.dispose();first.dispose();for(const image of imagesA)assert.equal(counts.get(image),1);for(const image of imagesB)assert.equal(counts.get(image),0);second.dispose();for(const count of counts.values())assert.equal(count,1);
    t.diagnostic(JSON.stringify({pixels:Object.fromEntries(Object.entries(pixels).map(([name,channels])=>[name,Object.fromEntries(Object.entries(channels).map(([channel,entry])=>[channel,{width:entry.width,height:entry.height,bytes:entry.data.byteLength,decodedSHA256:entry.decodedSha256}]))])),distinctGPUTextureObjects:counts.size,disposeEvents:[...counts.values()]}));
  }finally{first.dispose();second.dispose();}
});
