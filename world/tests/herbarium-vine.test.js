import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {Box3,CatmullRomCurve3,Triangle,Vector3,SRGBColorSpace,NoColorSpace} from 'three';
import {createArcade,cloneHerbariumAsset,disposeHerbariumAsset,getHerbariumMaterials,loadHerbariumIvyAssets} from '../src/herbarium-assets.js';

const digest=geometry=>Object.fromEntries([...Object.entries(geometry.attributes),['index',geometry.index]].map(([name,attribute])=>[name,createHash('sha256').update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength)).digest('hex')]));

test('scanned ivy binds original complete maps with retry, cancellation and shared decode cache',async()=>{
  assert.throws(()=>createArcade({vine:'outer-left'}),/await loadHerbariumIvyAssets/);
  const previous={fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap},requests=[],decoded=[];let rejectOpacity=true;
  globalThis.fetch=async url=>{requests.push(url);if(url.includes('Opacity')&&rejectOpacity)return new Response(null,{status:404});return new Response(await readFile(new URL('../public'+url,import.meta.url)));};
  globalThis.createImageBitmap=async(blob,options)=>{assert.equal(options.imageOrientation,'flipY');assert.equal(options.premultiplyAlpha,'none');const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).flip().ensureAlpha().raw().toBuffer({resolveWithObject:true});decoded.push(info);return {data:new Uint8Array(data),width:info.width,height:info.height,close(){}};};
  try{
    await assert.rejects(loadHerbariumIvyAssets(),/preload failed/);assert.equal(getHerbariumMaterials().ivyBlade,undefined,'an incomplete source set cannot become the active material');
    rejectOpacity=false;const first=await loadHerbariumIvyAssets(),versions=[first.version,...['map','normalMap','alphaMap','roughnessMap'].map(key=>first[key].version)],second=await loadHerbariumIvyAssets();assert.equal(first,second);assert.deepEqual([second.version,...['map','normalMap','alphaMap','roughnessMap'].map(key=>second[key].version)],versions,'cached selections do not trigger redundant GPU texture uploads');assert.equal(requests.length,5);assert.equal(decoded.length,4,'successful map decodes are shared across retry and subsequent selections');
    const controller=new AbortController();controller.abort();await assert.rejects(loadHerbariumIvyAssets({signal:controller.signal}),/cancelled/);assert.equal(requests.length,5);
    for(const key of ['map','normalMap','alphaMap','roughnessMap']){assert.equal(first[key].image.width,4096);assert.equal(first[key].image.height,4096);assert.equal(first[key].flipY,false);assert.equal(first[key].colorSpace,key==='map'?SRGBColorSpace:NoColorSpace);}
    assert.equal(first.alphaTest,.5);assert.equal(first.alphaToCoverage,true);assert.equal(first.transparent,false);assert.equal(first.depthWrite,true);assert.deepEqual(first.normalScale.toArray(),[1,1]);assert.equal(first.roughness,1);
    const source=JSON.parse(await readFile(new URL('../public/models/herbarium/ivy-leafset029/source.json',import.meta.url),'utf8'));
    assert.equal(source.license,'CC0-1.0');for(const file of source.files){const bytes=await readFile(new URL('../public/models/herbarium/ivy-leafset029/'+file.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert.equal(bytes.length,file.bytes);}
  }finally{globalThis.fetch=previous.fetch;globalThis.createImageBitmap=previous.createImageBitmap;}
});

test('outer ivy retains every original stone/support triangle and shared material',()=>{
  const baseline=createArcade();
  for(const vine of ['outer-left','outer-right']){
    const candidate=createArcade({vine});
    for(const mesh of baseline.children.filter(m=>m.name!=='darkLeaf')){
      const changed=candidate.getObjectByName(mesh.name);assert.ok(changed);assert.deepEqual(digest(changed.geometry),digest(mesh.geometry),mesh.name);assert.equal(changed.material,mesh.material);
    }
    assert.deepEqual(candidate.userData.colliders,baseline.userData.colliders);assert.deepEqual(candidate.userData.clearPassages,baseline.userData.clearPassages);
    const clone=cloneHerbariumAsset(candidate),geometry=candidate.getObjectByName('ivyBlade').geometry;let disposed=0;geometry.addEventListener('dispose',()=>disposed++);disposeHerbariumAsset(candidate);assert.equal(disposed,0);disposeHerbariumAsset(clone);assert.equal(disposed,1);
  }
  disposeHerbariumAsset(baseline);
});

test('actual ivy triangles retain all full-width 3.6 m passages and static wind envelope',()=>{
  for(const vine of ['outer-left','outer-right']){
    const group=createArcade({vine});
    assert.equal(group.userData.vineComposition.maxWindDisplacement,0);
    const boxes=group.userData.clearPassages.map(passage=>new Box3(new Vector3(...passage.min),new Vector3(...passage.max)));
    // Back arches are also real openings, though the original contract only
    // enumerated the continuous aisle and the front approaches.
    for(const x of [-4.32,-1.44,1.44,4.32])boxes.push(new Box3(new Vector3(x-1.1,.03,-1.71),new Vector3(x+1.1,3.6,-1.05)));
    for(const mesh of group.children.filter(m=>m.name==='ivyBlade'||m.name==='ivyBark')){const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<index.count;i+=3){
      const triangle=new Triangle(...[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,index.getX(i+k))));
      for(const box of boxes)assert.equal(box.intersectsTriangle(triangle),false,`${vine} ivy crosses a standing corridor`);
    }
    }
    disposeHerbariumAsset(group);
  }
});

test('outer colony has one grounded leader with connected shoots across a bounded cornice span',()=>{
  for(const vine of ['outer-left','outer-right']){
    const group=createArcade({vine}),composition=group.userData.vineComposition,roots=group.userData.plantRoots;
    assert.equal(roots.length,1);assert.ok(roots[0].root[1]<-.26,'root reaches below the local foundation/soil contact');assert.ok(composition.upperBays>=1&&composition.upperBays<=1.5);
    const previous=[];
    for(const stem of composition.stems){
      if(stem.parent){const root=new Vector3(...stem.points[0]),parents=previous.filter(p=>p.name===stem.parent);assert.ok(parents.length);assert.ok(parents.some(parent=>new CatmullRomCurve3(parent.points.map(p=>new Vector3(...p))).getPoints(2000).some(p=>p.distanceTo(root)<.009)),`${stem.name} is detached from its parent`);}
      previous.push(stem);
    }
    const ivy=group.getObjectByName('ivyBlade'),box=new Box3().setFromObject(ivy);assert.ok(box.max.y>5.4,'plant crown contributes to the upper silhouette');
    assert.ok(vine==='outer-left'?box.max.x<-.85:box.min.x>1.2,'the remaining upper bays stay uncovered');
    for(const part of ivy.userData.parts)if(part.name.includes('blade'))assert.equal(part.attachedTo,'rooted woody petiole');
    disposeHerbariumAsset(group);
  }
});

test('candidate scanned leaf detail is finite, textured, isolated from legacy and physically attached to stone',()=>{
  const legacy=createArcade(),before=legacy.getObjectByName('darkLeaf'),original={geometry:digest(before.geometry),color:before.material.color.toArray(),map:before.material.map,normal:before.material.normalMap};
  const candidate=createArcade({vine:'outer-right'}),leaf=candidate.getObjectByName('ivyBlade'),materials=getHerbariumMaterials();
  assert.notEqual(leaf.material,before.material);assert.notEqual(leaf.material.map,original.map);assert.equal(leaf.material.map.image.width,4096);assert.equal(leaf.material.map.image.height,4096);assert.equal(leaf.material.emissiveIntensity,1);assert.equal(leaf.material.emissive.getHex(),0,'leaf readability comes from albedo, not emission');
  assert.deepEqual(digest(before.geometry),original.geometry);assert.deepEqual(before.material.color.toArray(),original.color);assert.equal(before.material.map,original.map);assert.equal(before.material.normalMap,original.normal);
  assert.equal(materials.darkLeaf,before.material);
  const n=leaf.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'all actual curved leaf normals remain unit length');
  const image=leaf.material.map.image;let lo=255,hi=0;for(let i=1;i<image.data.length;i+=4){lo=Math.min(lo,image.data[i]);hi=Math.max(hi,image.data[i]);}assert.ok(hi-lo>45,'pale veins and intervein pigment remain in real source pixels');
  const stone=candidate.children.filter(m=>['stone','trim'].includes(m.name)),triangles=[];
  for(const mesh of stone){const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<index.count;i+=3)triangles.push(new Triangle(...[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,index.getX(i+k)))));}
  for(const holdfast of candidate.userData.vineComposition.stems.filter(s=>s.name==='Ivy stone holdfast')){const end=new Vector3(...holdfast.points.at(-1)),nearest=Math.min(...triangles.map(t=>t.closestPointToPoint(end,new Vector3()).distanceTo(end)));assert.ok(nearest<.0018,'holdfast must terminate on actual tapered column/riser triangles');}
  const later=createArcade();assert.deepEqual(digest(later.getObjectByName('darkLeaf').geometry),original.geometry,'creating a candidate cannot change subsequent default source');disposeHerbariumAsset(legacy);disposeHerbariumAsset(candidate);disposeHerbariumAsset(later);
});

test('scanned leaf UVs stay in six healthy cells and shadow silhouette uses the same opacity source',()=>{
  const group=createArcade({vine:'outer-left'}),mesh=group.getObjectByName('ivyBlade'),uv=mesh.geometry.attributes.uv;
  assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);assert.ok(mesh.material.alphaMap,'Three shadow material inherits the same alpha map/test from the casting material');
  const seen=new Set();for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);assert.ok(u>0&&u<1&&v>1/3&&v<1);seen.add(Math.floor((1-v)*3)*3+Math.floor(u*3));}assert.equal(seen.size,6);
  const map=mesh.material.alphaMap.image;let empty=0,solid=0;for(let i=1;i<map.data.length;i+=4){if(map.data[i]===0)empty++;if(map.data[i]===255)solid++;}assert.ok(empty>1000000&&solid>1000000,'actual scan includes transparent backgrounds and solid lobed leaf areas');
  assert.equal(group.userData.upperIvyClusters.length,3);assert.ok(group.userData.upperIvyClusters[0].shoots>group.userData.upperIvyClusters[1].shoots&&group.userData.upperIvyClusters[1].shoots>group.userData.upperIvyClusters[2].shoots);
  // Real basal pixels meet the woody petiole; flipY was already applied by decode.
  for(const [x,y]of [[316,711],[1555,690],[3070,683],[343,2042],[1509,2053],[3030,2042]])assert.ok(map.data[((4095-y)*4096+x)*4+1]>128,'a petiole cannot terminate in the atlas transparent background');
  // A shallow scan card must not reintroduce R2's strongly folded paper-star
  // profile: every normal on a physical blade stays close to its mean face.
  const normals=mesh.geometry.attributes.normal,index=mesh.geometry.index;
  for(const part of mesh.userData.parts){const mean=new Vector3();for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i++)mean.add(new Vector3().fromBufferAttribute(normals,index.getX(i)));mean.normalize();for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i++)assert.ok(mean.dot(new Vector3().fromBufferAttribute(normals,index.getX(i)))>.98);}
  disposeHerbariumAsset(group);
});
