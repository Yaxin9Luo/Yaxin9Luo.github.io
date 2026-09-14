import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Triangle,Raycaster} from 'three';
import {createArcade,createConservatory,createWaterGarden,createGardenBorder,cloneHerbariumAsset,disposeHerbariumAsset,getHerbariumSupportGeometries} from '../src/herbarium-assets.js';
import {createSurfaceSupport} from '../src/surface-support.js';
const sourceScenes=new Map();
before(async()=>{
  const {readFile}=await import('node:fs/promises'),{default:sharp}=await import('sharp'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{bindHerbariumBotanicalSource}=await import('../src/herbarium-assets.js'),previous={self:globalThis.self,createImageBitmap:globalThis.createImageBitmap};
  globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>{const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8Array(data),width:info.width,height:info.height,close(){}};};
  try{for(const id of ['fern_02','periwinkle_plant','potted_plant_01']){const bytes=await readFile(new URL(`../public/models/herbarium/botanical/${id}.glb`,import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bindHerbariumBotanicalSource(id,gltf.scene);sourceScenes.set(id,gltf);}}finally{globalThis.self=previous.self;globalThis.createImageBitmap=previous.createImageBitmap;}
});


function eachTriangle(group,fn){
  group.updateMatrixWorld(true);const a=new Vector3(),b=new Vector3(),c=new Vector3();
  group.traverse(object=>{if(!object.isMesh)return;const p=object.geometry.attributes.position,index=object.geometry.index,count=index?.count||p.count;
    for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(object.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(object.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(object.matrixWorld);fn(new Triangle(a,b,c),object);}
  });
}
function clear(group,box){let hits=0;eachTriangle(group,(triangle)=>{if(box.intersectsTriangle(triangle))hits++;});assert.equal(hits,0,`${hits} real triangles obstruct the locomotion volume`);}

test('authored mesh families are finite and remain inside audited placement envelopes',()=>{
  for(const[make,envelope]of[[createArcade,[12,3.4,5.4]],[createConservatory,[16,9,9.8]],[createWaterGarden,[20,11.5,1.2]],[createGardenBorder,[12,2.2,1.2]]]){
    const group=make();let triangles=0;eachTriangle(group,t=>{triangles++;for(const p of[t.a,t.b,t.c])assert.ok(p.toArray().every(Number.isFinite));});
    assert.ok(triangles>1000,'actual detailed geometry, not an empty advertised envelope');
    const box=new Box3().setFromObject(group);assert.ok(box.min.x>=-envelope[0]/2-1e-4&&box.max.x<=envelope[0]/2+1e-4,`${group.name} X ${box.min.x}…${box.max.x}`);assert.ok(box.min.z>=-envelope[1]/2-1e-4&&box.max.z<=envelope[1]/2+1e-4,`${group.name} Z ${box.min.z}…${box.max.z}`);assert.ok(box.max.y<=envelope[2]+1e-4,`${group.name} height ${box.max.y}`);
    assert.ok(group.children.length<60,'static material batching preserves quality with bounded draw calls');disposeHerbariumAsset(group);
  }
});

test('full rectangular arcade and conservatory openings clear player and delivered companion walk sweeps',()=>{
  const arcade=createArcade(),house=createConservatory();
  clear(arcade,new Box3(new Vector3(-6,.04,-1.1),new Vector3(6,3.6,1.1)));
  for(const x of[-4.32,-1.44,1.44,4.32])clear(arcade,new Box3(new Vector3(x-1.1,.04,1.05),new Vector3(x+1.1,3.6,1.71)));
  clear(house,new Box3(new Vector3(-1.1,.04,-3.75),new Vector3(1.1,3.6,4.51)));
  // Elizabeth walks at width 1.98444 and height 3.02751; Sadaharu width
  // 1.68807/top 3.00065. The player controls the 3.28 m vertical envelope.
  const ray=new Raycaster(new Vector3(0,1.7,5),new Vector3(0,0,-1),0,8.7);assert.equal(ray.intersectObject(house,true).length,0);
  disposeHerbariumAsset(arcade);disposeHerbariumAsset(house);
});

test('real finished floor triangles support translated and rotated placement',()=>{
  for(const make of[createArcade,createConservatory]){
    const group=make();group.position.set(11,7.2,18);group.rotation.y=.37;const support=createSurfaceSupport(()=>-10);
    const geometries=getHerbariumSupportGeometries(group);assert.ok(geometries.length);for(const geometry of geometries){support.addGeometry(geometry);geometry.dispose();}
    for(const p of[new Vector3(0,0,0),new Vector3(0,0,1),new Vector3(.8,0,2)]){if(make===createArcade&&p.z>1.6)continue;p.applyMatrix4(group.matrixWorld);assert.ok(Math.abs(support.heightAt(p.x,p.z)-7.2)<1e-5);}
    assert.equal(support.heightAt(100,100),-10);disposeHerbariumAsset(group);
  }
});

test('asset clones keep transform independence and reference-count geometry while preserving shared PBR textures',()=>{
  const a=createConservatory(),b=cloneHerbariumAsset(a);b.position.x=20;b.updateMatrixWorld(true);assert.equal(a.position.x,0);assert.ok(new Box3().setFromObject(b).min.x>11);
  let geometryDisposals=0,materialDisposals=0;const mesh=a.children.find(o=>o.isMesh);mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);mesh.material.addEventListener('dispose',()=>materialDisposals++);
  disposeHerbariumAsset(a);disposeHerbariumAsset(a);assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);disposeHerbariumAsset(b);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,0);
});

test('parameter validation prevents impossible or non-finite construction',()=>{
  for(const args of[{bays:0},{bays:5},{bays:Infinity}])assert.throws(()=>createArcade(args),RangeError);
  for(const args of[{length:NaN},{length:-2},{seed:Infinity}])assert.throws(()=>createGardenBorder(args),RangeError);
});

test('plant crowns originate on real continuous soil or container soil, including wet-garden borders',()=>{
  for(const make of[createConservatory,createGardenBorder,createWaterGarden]){
    const group=make(),soil=group.children.filter(m=>m.name==='soil'),ray=new Raycaster();assert.ok(soil.length||group.userData.parts.some(p=>p.role==='substrate'));
    for(const root of group.userData.plantRoots){const p=new Vector3(...root.root);ray.set(p.clone().add(new Vector3(0,.045,0)),new Vector3(0,-1,0));ray.far=.1;let surfaces=soil,copy=null;
      if(root.supportPart){const part=group.userData.parts.find(p=>p.name===root.supportPart);assert.ok(part,`${root.species} source substrate part exists`);const batch=group.children.find(m=>m.name===part.batch);copy=batch.clone();copy.geometry=batch.geometry.clone();copy.geometry.setDrawRange(part.firstIndex,part.indexCount);surfaces=[copy];}
      const hits=ray.intersectObjects(surfaces);assert.ok(hits.length,`${root.species} at ${p.toArray()} has no physical soil/substrate within 5 cm`);assert.ok(Math.abs(hits[0].point.y-p.y)<.05);copy?.geometry.dispose();}

    disposeHerbariumAsset(group);
  }
});

test('batched part ranges still select actual original triangles and support contacts',()=>{
  const group=createConservatory(),batches=new Map(group.children.map(m=>[m.name,m])),point=new Vector3();
  for(const part of group.userData.parts){const mesh=batches.get(part.batch),geometry=mesh.geometry,index=geometry.index;assert.ok(index);assert.ok(part.indexCount>0&&part.firstIndex+part.indexCount<=index.count);const box=new Box3();for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i++)box.expandByPoint(point.fromBufferAttribute(geometry.attributes.position,index.getX(i)));assert.ok(box.min.distanceTo(new Vector3(...part.bounds.min))<1e-5&&box.max.distanceTo(new Vector3(...part.bounds.max))<1e-5,`${part.name} lost batching provenance`);}
  const parts=group.userData.parts,frames=parts.filter(p=>p.role==='structure');
  for(const glass of parts.filter(p=>p.role==='glass')){const bounds=new Box3(new Vector3(...glass.bounds.min),new Vector3(...glass.bounds.max));bounds.expandByScalar(.09);assert.ok(frames.some(frame=>bounds.intersectsBox(new Box3(new Vector3(...frame.bounds.min),new Vector3(...frame.bounds.max)))),`${glass.name} detached from all actual frame geometry`);}
  // Rainwater pipes stand on the continuous plinth, not outside the rounded ends.
  for(const pipe of parts.filter(p=>p.name==='Attached rainwater downpipe')){const base=new Vector3((pipe.bounds.min[0]+pipe.bounds.max[0])/2,.32,(pipe.bounds.min[2]+pipe.bounds.max[2])/2);assert.ok(parts.some(p=>p.name==='Stone plinth block'&&new Box3(new Vector3(...p.bounds.min),new Vector3(...p.bounds.max)).expandByScalar(.04).containsPoint(base)));}
  disposeHerbariumAsset(group);
});

test('water-garden east arrival has full rectangular access and real ground support',()=>{
  const group=createWaterGarden();clear(group,new Box3(new Vector3(7.55,.04,-1.1),new Vector3(9.35,3.6,1.1)));
  const support=createSurfaceSupport(()=>-10);for(const g of getHerbariumSupportGeometries(group)){support.addGeometry(g);g.dispose();}assert.ok(Math.abs(support.heightAt(9.1,0))<1e-6);assert.equal(support.heightAt(0,0),-10,'pool water is not a walkable floor');disposeHerbariumAsset(group);
});

test('photographed source GLBs preserve actual geometry, 4K alpha pixels and complete potted-node transforms',async()=>{
  const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto'),{createHerbariumBotanicalSpecimen}=await import('../src/herbarium-assets.js');
    const records=JSON.parse(await readFile(new URL('../public/models/herbarium/botanical/sources.json',import.meta.url),'utf8'));
    for(const record of records){
      const bytes=await readFile(new URL(`../public/models/herbarium/botanical/${record.id}.glb`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
      const gltf=sourceScenes.get(record.id);gltf.scene.updateMatrixWorld(true);const originals=[];gltf.scene.traverse(o=>{if(o.isMesh)originals.push(o);});
      const first=createHerbariumBotanicalSpecimen(record.id);assert.equal(first.userData.botanicalSource.sha256,record.sha256);const n=first.userData.botanicalSource.variants.length;disposeHerbariumAsset(first);
      assert.equal(n,record.id==='potted_plant_01'?1:originals.length);
      for(let i=0;i<n;i++){
        const group=createHerbariumBotanicalSpecimen(record.id,{variant:i}),source=record.id==='potted_plant_01'?originals:[originals[i]],tris=source.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);assert.equal(group.children.reduce((s,m)=>s+m.geometry.index.count/3,0),tris,'every original source triangle survives batching');
        assert.ok(group.userData.actualBounds.min[1]>-1e-6&&group.userData.actualBounds.min[1]<1e-6);
        for(const m of group.children){
          const image=m.material.map.image;assert.equal(image.width,4096);assert.equal(image.height,4096);let lo=255,hi=0,masked=0,opaque=0;for(let j=0;j<image.data.length;j+=4){lo=Math.min(lo,image.data[j]);hi=Math.max(hi,image.data[j]);masked+=image.data[j+3]<128;opaque+=image.data[j+3]>240;}
          assert.ok(hi-lo>100,'real varied source pixels, not flat/fake export');if(m.material.alphaTest){assert.ok(masked>image.width*image.height*.15&&opaque>1000,'foliage alpha is physically present in the packed full-resolution texture');}
        }
        if(record.id==='potted_plant_01'){
          assert.equal(group.userData.parts.length,4);assert.equal(group.children.length,2);assert.equal(group.children.find(m=>m.material.name.endsWith('_pot')).material.alphaTest,0);
          const box=new Box3().setFromObject(gltf.scene),offset=box.getCenter(new Vector3()).multiplyScalar(-1);offset.y=-box.min.y;
          for(const sourceMesh of source){const actual=group.userData.parts.find(p=>p.name===sourceMesh.name),expected=new Box3().setFromObject(sourceMesh).translate(offset);assert.ok(expected.min.distanceTo(new Vector3(...actual.bounds.min))<1e-6);assert.ok(expected.max.distanceTo(new Vector3(...actual.bounds.max))<1e-6);}
        }
        const clone=cloneHerbariumAsset(group);let disposed=0;const geometry=group.children[0].geometry;geometry.addEventListener('dispose',()=>disposed++);disposeHerbariumAsset(group);assert.equal(disposed,0);disposeHerbariumAsset(clone);assert.equal(disposed,1);
      }
      assert.throws(()=>createHerbariumBotanicalSpecimen(record.id,{variant:n}),RangeError);
    }
});

test('support and solid bounds include unflushed parent placement transforms',async()=>{
  const {Group}=await import('three'),{getHerbariumColliders}=await import('../src/herbarium-assets.js');const parent=new Group(),group=createArcade();parent.position.set(-18,5.4,31);parent.rotation.y=.61;parent.add(group);group.position.set(2,.8,-3);group.rotation.y=-.23;
  const support=createSurfaceSupport(()=>-100),geometries=getHerbariumSupportGeometries(group);for(const g of geometries){support.addGeometry(g);g.dispose();}
  const local=new Vector3(.23,0,.47),world=local.clone().applyMatrix4(group.matrixWorld);assert.ok(Math.abs(support.heightAt(world.x,world.z)-6.2)<1e-5);
  const actual=getHerbariumColliders(group);assert.ok(actual.length);for(let i=0;i<actual.length;i++){const source=group.userData.colliders[i],expected=new Box3(new Vector3(...source.min),new Vector3(...source.max)).applyMatrix4(group.matrixWorld),box=actual[i];assert.ok(expected.min.distanceTo(new Vector3(...box.min))<1e-6);assert.ok(expected.max.distanceTo(new Vector3(...box.max))<1e-6);}
  disposeHerbariumAsset(group);
});

test('waterlily geometry forms thin curved surface leaves at the actual water datum',()=>{
  const group=createWaterGarden(),pads=group.userData.parts.filter(p=>p.name==='Smooth notched floating waterlily lamina');assert.ok(pads.length>=20);for(const pad of pads){assert.ok(pad.indexCount/3>5000);assert.ok(pad.bounds.min[1]<group.userData.water.height+.01);assert.ok(pad.bounds.min[1]>group.userData.water.height-.006);assert.ok(pad.bounds.max[1]<group.userData.water.height+.026);assert.ok(pad.bounds.max[1]-pad.bounds.min[1]>.007);}
  assert.ok(group.userData.parts.some(p=>p.name==='Curved waterlily petal'));assert.ok(group.userData.parts.filter(p=>p.name==='Fine waterlily stamen').length>150);assert.ok(!group.userData.parts.some(p=>p.name==='Lily radial vein'||p.name==='Waterlily stamens'));disposeHerbariumAsset(group);
});

test('independent preload consumers preserve cancellation, deadline and retry semantics with real resources',async()=>{
  const {readFile}=await import('node:fs/promises'),{default:sharp}=await import('sharp'),{loadHerbariumAssets}=await import('../src/herbarium-assets.js?loader-contract');
  const previous={fetch:globalThis.fetch,self:globalThis.self,createImageBitmap:globalThis.createImageBitmap};let release;const barrier=new Promise(resolve=>{release=resolve;}),requests=new Map();
  globalThis.self=globalThis;globalThis.createImageBitmap=async(blob,options)=>{let pipeline=sharp(Buffer.from(await blob.arrayBuffer()));if(options?.imageOrientation==='flipY')pipeline=pipeline.flip();const {data,info}=await pipeline.ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8Array(data),width:info.width,height:info.height,close(){}};};
  globalThis.fetch=async url=>{if(String(url).startsWith('blob:'))return previous.fetch(url);requests.set(url,(requests.get(url)||0)+1);await barrier;const data=await readFile(new URL(`../public${url}`,import.meta.url));return new Response(data,{status:200,headers:{'content-length':String(data.length)}});};
  try{
    const first=new AbortController(),second=new AbortController(),deadline=performance.now()+60000,events=[];
    const a=loadHerbariumAssets({regional:false,signal:first.signal,deadline}),b=loadHerbariumAssets({regional:false,signal:second.signal,deadline,onProgress:event=>events.push(event)});
    const results=Promise.allSettled([a,b]);first.abort();release();const [cancelled,ready]=await results;
    assert.equal(cancelled.status,'rejected');assert.equal(ready.status,'fulfilled','one consumer cancelling must not cancel another consumer');assert.ok(events.some(event=>event.phase==='ready'));assert.equal(ready.value['source-potted_plant_01-0'].map.image.width,4096);assert.equal(ready.value['source-fern_02-0'].map.image.height,4096);
    assert.ok([...requests.values()].every(count=>count===1),'resource coordinator deduplicates actual transfers');
    await assert.rejects(loadHerbariumAssets({regional:false,signal:first.signal,deadline}));await assert.rejects(loadHerbariumAssets({regional:false,deadline:performance.now()-1}));
    const count=requests.size;await loadHerbariumAssets({regional:false,deadline});assert.equal(requests.size,count,'retry after cancellation reuses successfully decoded resources');
  }finally{release();Object.assign(globalThis,previous);}
});

test('final packed GLBs decode with the runtime loader and preserve geometry, real pixels, support and source identity',async t=>{
  const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto'),{default:sharp}=await import('sharp'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js'),{disposeGLTF}=await import('../src/gltf-resource.js');
  const hash=data=>createHash('sha256').update(data).digest('hex'),manifest=JSON.parse(await readFile(new URL('../public/models/herbarium/manifest.json',import.meta.url),'utf8'));assert.equal(manifest.authoring.sha256,hash(await readFile(new URL('../src/herbarium-assets.js',import.meta.url))));
  const output=new URL('../../work/living-v8/exports/herbarium/',import.meta.url);try{await readFile(new URL('manifest.json',output));}catch(error){if(error.code==='ENOENT'){t.skip('Local editable exports are deliberately outside Git/public; run node scripts/export-herbarium-assets.mjs from world to reproduce this artifact gate.');return;}throw error;}
  const previous={self:globalThis.self,createImageBitmap:globalThis.createImageBitmap};globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>{const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8Array(data),width:info.width,height:info.height,close(){}};};
  try{for(const[kind,asset]of Object.entries(manifest.assets)){
    const bytes=await readFile(new URL(`${kind}.glb`,output)),packing=JSON.parse(await readFile(new URL(asset.losslessPacking,output),'utf8'));assert.equal(hash(bytes),asset.sha256);assert.equal(bytes.length,asset.bytes);
    const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.equal(meshes.length,packing.geometry.length);let triangles=0;
    for(let i=0;i<meshes.length;i++){const mesh=meshes[i],expected=packing.geometry[i].primitives[0];for(const[semantic,value]of Object.entries(expected.attributes)){const key={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv1',COLOR_0:'color',TANGENT:'tangent'}[semantic]||semantic.toLowerCase(),attribute=mesh.geometry.getAttribute(key);assert.ok(attribute,semantic);assert.equal(attribute.count,value.count);assert.equal(Boolean(attribute.normalized),value.normalized);const Type={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[value.type],data=new Type(attribute.count*attribute.itemSize),source=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array,stride=attribute.isInterleavedBufferAttribute?attribute.data.stride:attribute.itemSize,offset=attribute.isInterleavedBufferAttribute?attribute.offset:0;assert.ok(source instanceof Type);for(let k=0;k<attribute.count;k++)for(let j=0;j<attribute.itemSize;j++){const n=source[k*stride+offset+j];assert.ok(Number.isFinite(n));data[k*attribute.itemSize+j]=n;}assert.equal(hash(new Uint8Array(data.buffer)),value.sha256,`${kind}/${semantic} exact decoded attribute bytes`);}
      const indices=mesh.geometry.index,canonical=new Uint32Array(indices.count);for(let j=0;j<indices.count;j+=3){const t=[indices.getX(j),indices.getX(j+1),indices.getX(j+2)],start=t.indexOf(Math.min(...t));for(let k=0;k<3;k++)canonical[j+k]=t[(start+k)%3];}assert.equal(hash(new Uint8Array(canonical.buffer)),expected.triangles.cyclicWindingSHA256);triangles+=indices.count/3;
    }
    assert.equal(triangles,asset.triangles);const bounds=new Box3().setFromObject(gltf.scene);assert.ok(bounds.min.distanceTo(new Vector3(...asset.bounds.min))<1e-5);assert.ok(bounds.max.distanceTo(new Vector3(...asset.bounds.max))<1e-5);
    const group=gltf.scene.children.find(o=>o.userData.herbarium);assert.ok(group);if(kind==='conservatory')clear(group,new Box3(new Vector3(-1.1,.04,-3.75),new Vector3(1.1,3.6,4.5)));
    if(kind!=='flower-border'){const support=createSurfaceSupport(()=>-20);for(const geometry of getHerbariumSupportGeometries(group)){support.addGeometry(geometry);geometry.dispose();}assert.ok(Math.abs(support.heightAt(kind==='water-garden'?7.5:.23,.47))<1e-4);}
    const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength)),bin=bytes.subarray(28+jsonLength);assert.equal(json.images.length,packing.textures.length);
    for(let i=0;i<json.images.length;i++){const view=json.bufferViews[json.images[i].bufferView],encoded=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),{data,info}=await sharp(encoded).ensureAlpha().raw().toBuffer({resolveWithObject:true}),expected=packing.textures[i];assert.equal(info.width,expected.width);assert.equal(info.height,expected.height);assert.equal(hash(data),expected.sha256,`${kind} exact decoded RGBA, including alpha and hidden RGB`);}
    assert.equal(hash(await readFile(new URL(`${kind}.blend`,output))),asset.editableSha256);disposeGLTF(gltf);
  }}finally{globalThis.self=previous.self;globalThis.createImageBitmap=previous.createImageBitmap;}
});

test('Blender Python failures and incomplete saves reject without certifying stale files or deleting inputs',async t=>{
  const {mkdtemp,readFile,writeFile,rm,access}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{pathToFileURL}=await import('node:url'),{createHash}=await import('node:crypto'),{runEditableBlender,completeEditableExport}=await import('../../docs/art/living-v8/herbarium/editable-runner.mjs');
  try{await access('/Applications/Blender.app/Contents/MacOS/Blender');}catch{t.skip('Blender is required for this actual subprocess failure regression.');return;}
  const directory=await mkdtemp(join(tmpdir(),'herbarium-blender-contract-')),scriptPath=join(directory,'save.py'),logPath=join(directory,'blender.log'),outputPath=join(directory,'specimen.blend'),manifestPath=join(directory,'manifest.json'),inputPath=join(directory,'specimen.authoring-tmp.glb'),out=pathToFileURL(directory+'/');
  const saveScript=`import bpy\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.mesh.primitive_cube_add()\nbpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(outputPath)},check_existing=False)\nprint('EDITABLE_SAVED specimen 1')\n`;
  const run=()=>completeEditableExport({scriptPath,logPath,out,manifest:{generation:'new',assets:{specimen:{}}},manifestPaths:[manifestPath]});
  try{
    await writeFile(scriptPath,saveScript);await runEditableBlender({scriptPath,logPath,expectedSaves:['specimen']});
    const original=await readFile(outputPath),sha=createHash('sha256').update(original).digest('hex'),oldManifest='{"generation":"previous"}\n';assert.ok(original.length>1000);await writeFile(manifestPath,oldManifest);await writeFile(inputPath,'new import input retained on failure');
    await writeFile(scriptPath,"raise RuntimeError('Intentional herbarium import/save regression')\n");
    await assert.rejects(run(),/Editable Blender export failed \(1\)/);assert.match(await readFile(logPath,'utf8'),/Intentional herbarium import\/save regression/);assert.equal(createHash('sha256').update(await readFile(outputPath)).digest('hex'),sha);assert.equal(await readFile(manifestPath,'utf8'),oldManifest,'failed Python must not certify stale .blend bytes in a new manifest');assert.equal(await readFile(inputPath,'utf8'),'new import input retained on failure');
    await writeFile(scriptPath,"print('No save was performed')\n");await assert.rejects(run(),/missing completed save: specimen/);assert.equal(createHash('sha256').update(await readFile(outputPath)).digest('hex'),sha);assert.equal(await readFile(manifestPath,'utf8'),oldManifest);await access(inputPath);
    await writeFile(scriptPath,saveScript);await run();const published=JSON.parse(await readFile(manifestPath,'utf8'));assert.equal(published.generation,'new');assert.equal(published.assets.specimen.editableSha256,createHash('sha256').update(await readFile(outputPath)).digest('hex'));await assert.rejects(access(inputPath),{code:'ENOENT'});assert.doesNotMatch(await readFile(logPath,'utf8'),/BlenderMCP/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
