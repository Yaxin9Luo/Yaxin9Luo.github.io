import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWesternGardenPlantingSourceLoader} from '../src/yuanmingyuan/western-garden-planting-sources.js';
import {createWesternGardenPlantingRegion,westernGardenPlantingSpec} from '../src/yuanmingyuan/western-garden-planting.js';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';

const noYield=async()=>{};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const rootNames={juniper:'juniper-visible-trunk',willow:'willow-trunk-and-roots','lake-rock':'lake-rock-main'};
function fixture(){
  const created=[],calls=[],events=[],counts={vegetationImports:0,understoryImports:0,stonePrepares:0};
  // Tiny raw, lower-left pixel arrays are passed through injected factories.
  // The production pixel API alone performs actual 2048px SHA validation.
  const stone=Object.fromEntries(['color','normal','roughness'].map((id,i)=>[id,{data:new Uint8Array([74+i,123,79,255]),width:1,height:1,channels:4,origin:'lower-left'}]));
  function create(id,family,options){
    const resources=[],disposedCounts=new Map(),track=r=>{resources.push(r);disposedCounts.set(r,0);r.addEventListener('dispose',()=>disposedCounts.set(r,disposedCounts.get(r)+1));return r;};
    const group=new THREE.Group(),part=new THREE.Group();part.userData.id=id;part.name='original-'+id;group.add(part);
    const maps=id==='lake-rock'?Object.fromEntries(Object.entries(options.texturePixels.stone).map(([channel,p])=>{
      const texture=track(new THREE.DataTexture(p.data,p.width,p.height,THREE.RGBAFormat));
      texture.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;
      return [{color:'map',normal:'normalMap',roughness:'roughnessMap'}[channel],texture];
    })):{};
    const material=track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74,side:THREE.DoubleSide,...maps}));
    const geometry=track(new THREE.BoxGeometry(.12,.24,.12));geometry.translate(0,.08,0);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:geometry.attributes.position.count},()=>[.35,.61,.22]).flat(),3));
    const mesh=new THREE.Mesh(geometry,material);mesh.name=rootNames[id]??id+'-root';mesh.castShadow=mesh.receiveShadow=true;part.add(mesh);
    const leafGeometry=track(new THREE.SphereGeometry(.018,6,4)),leaves=track(new THREE.InstancedMesh(leafGeometry,material,2));
    for(let i=0;i<2;i++){leaves.setMatrixAt(i,new THREE.Matrix4().makeTranslation(.05*i,.26,.03*i));leaves.setColorAt(i,new THREE.Color(.3+i*.1,.7,.2));}
    leaves.computeBoundingBox();leaves.computeBoundingSphere();part.add(leaves);group.updateMatrixWorld(true);
    let disposed=false;const updates=[];
    const diagnostics={id:family==='vegetation'?'fixture-original-vegetation':'fixture-original-understory',triangles:12+leafGeometry.index.count/3*2};
    const owner={group,[family==='vegetation'?'specimens':'parts']:[part],diagnostics,
      update(t){assert.equal(disposed,false);updates.push(t);},
      dispose(){assert.equal(disposed,false,'source dispose invoked more than once');disposed=true;events.push('dispose:'+id);for(const r of resources)r.dispose();group.clear();},
      get disposed(){return disposed;}};
    const record={id,owner,part,geometry,material,leaves,resources,disposedCounts,updates,options};created.push(record);return owner;
  }
  const deps={
    loadVegetation:async()=>{counts.vegetationImports++;return {createGardenVegetationStudy:options=>{calls.push({family:'vegetation',...options});return create(options.specimens[0],'vegetation',options);}};},
    loadUnderstory:async()=>{counts.understoryImports++;return {createGardenUnderstoryStudy:options=>{calls.push({family:'understory',...options});return create(options.specimens[0],'understory',options);}};},
    prepareStone:async({signal})=>{signal.throwIfAborted();counts.stonePrepares++;return stone;},
    yieldControl:noYield,
  };
  return {deps,created,calls,events,counts,stone,create};
}
function assertReleased(records){for(const r of records){assert.equal(r.owner.disposed,true);for(const count of r.disposedCounts.values())assert.equal(count,1);}}

test('constructor is lazy; invalid, empty and unsupported regions perform no import or construction',async()=>{
  const f=fixture(),loader=createWesternGardenPlantingSourceLoader(f.deps);
  assert.deepEqual(f.counts,{vegetationImports:0,understoryImports:0,stonePrepares:0});assert.equal(f.created.length,0);
  await assert.rejects(loader.prepareRegion('unknown'),/Unknown or invalid/);loader.dispose();loader.dispose();
  for(const placements of [[],[{species:'pine'}],[{species:'__proto__'}]]){
    const bad=createWesternGardenPlantingSourceLoader({...f.deps,plantingLayout:{regions:[{id:'bad',placements}]}});
    await assert.rejects(bad.prepareRegion('bad'),/invalid|unsupported/);bad.dispose();
  }
  assert.equal(f.created.length,0);assert.equal(f.counts.vegetationImports+f.counts.understoryImports,0);
});

test('north region loads exactly five single unplaced originals, with full stone pixels and unchanged buffers',async()=>{
  const f=fixture(),loader=createWesternGardenPlantingSourceLoader(f.deps);
  try{
    const prepared=await loader.prepareRegion('xieqiqu-north');
    assert.equal(prepared.owner,loader);
    assert.deepEqual(Object.keys(prepared.sources),['juniper','lake-rock','fern','flower-shrub','sedge']);
    assert.deepEqual(f.created.map(r=>r.id),Object.keys(prepared.sources));
    assert.deepEqual(f.counts,{vegetationImports:1,understoryImports:1,stonePrepares:1});
    for(const call of f.calls){
      assert.equal(call.specimens.length,1);assert.ok(!['pine','lotus','willow'].includes(call.specimens[0]));
      if(call.family==='vegetation'){assert.equal(call.arrange,false);assert.equal('arrangement'in call,false);}
      else {assert.equal(call.arrangement,'specimens');assert.ok(call.signal instanceof AbortSignal);}
      assert.equal('texturePixels'in call,call.specimens[0]==='lake-rock');
    }
    for(const r of f.created){
      const binding=prepared.sources[r.id];assert.equal(binding.part,r.part);assert.equal(binding.owner,loader);
      assert.equal(binding.review,r.id==='juniper'?'work/yuanmingyuan/vegetation-native-review-r2.json':westernGardenPlantingSpec.sourceReviews[r.id==='lake-rock'?'vegetation':'understory']);
      assert.equal(r.part.parent,r.owner.group);assert.equal(r.owner.group.parent,null);
      assert.deepEqual(r.part.position.toArray(),[0,0,0]);assert.deepEqual(r.part.scale.toArray(),[1,1,1]);
      assert.equal(r.part.children[0].geometry,r.geometry);assert.equal(r.part.children[0].material,r.material);
      assert.equal(r.part.children[1].instanceMatrix,r.leaves.instanceMatrix);assert.ok(r.leaves.instanceColor);
    }
    const rock=f.created.find(r=>r.id==='lake-rock');
    assert.equal(rock.options.texturePixels.stone,f.stone);assert.equal(rock.material.map.image.data,f.stone.color.data);
    assert.equal(rock.material.normalMap.image.data,f.stone.normal.data);assert.equal(rock.material.roughnessMap.image.data,f.stone.roughness.data);
    assert.equal(rock.material.map.colorSpace,THREE.SRGBColorSpace);assert.equal(rock.material.normalMap.colorSpace,THREE.NoColorSpace);
    assert.equal(loader.snapshot().nativeCompositionReviewed,false);assert.equal(loader.snapshot().sources.length,5);
  }finally{loader.dispose();}
  assertReleased(f.created);
});

test('later regions share each species by identity, build willow only on demand and forward updates once',async()=>{
  const f=fixture(),loader=createWesternGardenPlantingSourceLoader(f.deps);
  try{
    const a=await loader.prepareRegion('xieqiqu-north'),b=await loader.prepareRegion('yangquelong-west'),c=await loader.prepareRegion('fangwaiguan-front');
    assert.equal(f.created.length,5);assert.equal(a.sources.juniper,b.sources.juniper);assert.equal(a.sources.fern,c.sources.fern);
    const d=await loader.prepareRegion('lake-west-pair'),e=await loader.prepareRegion('lake-east-single');
    assert.equal(f.created.length,6);assert.equal(d.sources.willow,e.sources.willow);assert.equal(d.sources['lake-rock'],a.sources['lake-rock']);
    assert.deepEqual(f.counts,{vegetationImports:1,understoryImports:1,stonePrepares:1});
    loader.update(10);loader.update(10);for(const r of f.created)assert.deepEqual(r.updates,[10,10]);
    assert.throws(()=>loader.update(NaN),/finite/);assert.equal(loader.snapshot().updateCalls,12);
  }finally{loader.dispose();loader.dispose();}
  assertReleased(f.created);assert.equal(loader.update(11),false);assert.deepEqual(loader.snapshot().sources,[]);
});

test('concurrent requests remain serial and canceled queued requests never import or build their species',async()=>{
  const f=fixture(),gate=deferred(),entered=deferred();let first=true,active=0,maxActive=0;
  const original=f.deps.loadVegetation;
  f.deps.loadVegetation=async()=>{
    const m=await original();return {createGardenVegetationStudy:async options=>{
      active++;maxActive=Math.max(maxActive,active);
      if(first){first=false;entered.resolve();await gate.promise;}
      try{return m.createGardenVegetationStudy(options);}finally{active--;}
    }};
  };
  const loader=createWesternGardenPlantingSourceLoader(f.deps),cancel=new AbortController();
  const a=loader.prepareRegion('yangquelong-west');await entered.promise;
  const b=loader.prepareRegion('lake-west-pair',{signal:cancel.signal}),rejected=assert.rejects(b,{name:'AbortError'});
  const c=loader.prepareRegion('xieqiqu-north');cancel.abort();gate.resolve();
  try{
    const [firstResult,lastResult]=await Promise.all([a,c]);await rejected;
    assert.equal(firstResult.sources.juniper,lastResult.sources.juniper);
    assert.equal(f.created.some(r=>r.id==='willow'),false);assert.equal(maxActive,1);
    assert.equal(loader.snapshot().pending,0);assert.equal(loader.snapshot().failed,1);
  }finally{loader.dispose();}
  assertReleased(f.created);
});

test('a source failure rolls back only new owners and retry retains previous live region bindings',async()=>{
  const f=fixture(),original=f.deps.loadUnderstory;let fail=false;
  f.deps.loadUnderstory=async()=>{const m=await original();return {createGardenUnderstoryStudy:options=>{
    if(fail&&options.specimens[0]==='fern')throw new Error('fixture fern failure');return m.createGardenUnderstoryStudy(options);
  }};};
  const loader=createWesternGardenPlantingSourceLoader(f.deps);
  try{
    const a=await loader.prepareRegion('yangquelong-west');fail=true;
    await assert.rejects(loader.prepareRegion('xieqiqu-north'),/fixture fern failure/);
    assert.equal(f.created.find(r=>r.id==='lake-rock').owner.disposed,true);
    assert.equal(loader.snapshot().sources.length,3);assert.equal(a.sources.juniper.owner.disposed,false);
    for(const r of f.created.filter(r=>r.id!=='lake-rock'))assert.equal(r.owner.disposed,false);
    fail=false;const b=await loader.prepareRegion('xieqiqu-north');
    assert.equal(a.sources.juniper,b.sources.juniper);assert.equal(f.created.filter(r=>r.id==='lake-rock').length,2);
    const rocks=f.created.filter(r=>r.id==='lake-rock');
    assert.notEqual(rocks[0].material.map,rocks[1].material.map);assert.equal(rocks[0].material.map.image.data,rocks[1].material.map.image.data);
  }finally{loader.dispose();}
  assertReleased(f.created);
});

test('abort propagates into stone preparation and rolls back before any stone factory',async()=>{
  const f=fixture(),entered=deferred(),cancel=new AbortController();
  f.deps.prepareStone=({signal})=>new Promise((resolve,reject)=>{
    entered.resolve(signal);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  });
  const loader=createWesternGardenPlantingSourceLoader(f.deps),pending=loader.prepareRegion('xieqiqu-north',{signal:cancel.signal});
  const rejected=assert.rejects(pending,{name:'AbortError'}),stoneSignal=await entered.promise;cancel.abort();await rejected;
  assert.equal(stoneSignal.aborted,true);assert.deepEqual(f.created.map(r=>r.id),['juniper']);assertReleased(f.created);
  assert.equal(loader.disposed,false);assert.equal(loader.snapshot().sources.length,0);loader.dispose();
});

test('a failed stone channel cancels its sibling channel requests and retains the original error',async()=>{
  const f=fixture(),failure=new Error('fixture color channel hash failure');let canceled=0,stoneSignal;
  f.deps.prepareStone=({signal})=>{
    stoneSignal=signal;
    const siblings=Array.from({length:2},()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{canceled++;reject(signal.reason);},{once:true})));
    return Promise.all([Promise.reject(failure),...siblings]);
  };
  const loader=createWesternGardenPlantingSourceLoader(f.deps);
  await assert.rejects(loader.prepareRegion('xieqiqu-north'),error=>error===failure);
  assert.equal(stoneSignal.aborted,true);assert.equal(canceled,2);assert.equal(f.created.length,1);assertReleased(f.created);
  assert.equal(loader.disposed,false);loader.dispose();
});

test('a pre-aborted request builds nothing and a factory cannot return another region\'s retained owner',async()=>{
  const f=fixture(),cancel=new AbortController();cancel.abort();
  assert.throws(()=>createWesternGardenPlantingSourceLoader({...f.deps,signal:cancel.signal}),{name:'AbortError'});
  const original=f.deps.loadVegetation;
  f.deps.loadVegetation=async()=>{const m=await original();return {createGardenVegetationStudy:options=>
    options.specimens[0]==='lake-rock'?f.created.find(r=>r.id==='juniper').owner:m.createGardenVegetationStudy(options)};};
  const loader=createWesternGardenPlantingSourceLoader(f.deps);
  await assert.rejects(loader.prepareRegion('xieqiqu-north',{signal:cancel.signal}),{name:'AbortError'});assert.equal(f.created.length,0);
  const prepared=await loader.prepareRegion('yangquelong-west');
  await assert.rejects(loader.prepareRegion('xieqiqu-north'),/reused a live source owner/);
  assert.equal(prepared.sources.juniper.owner.disposed,false);assert.equal(loader.snapshot().sources.length,3);
  for(const r of f.created)assert.equal(r.owner.disposed,false);loader.dispose();assertReleased(f.created);
});

test('dispose during an uncooperative pending factory releases its late owner and prevents following construction',async()=>{
  const f=fixture(),gate=deferred(),entered=deferred(),original=f.deps.loadVegetation;
  f.deps.loadVegetation=async()=>{const m=await original();return {createGardenVegetationStudy:async options=>{
    entered.resolve();await gate.promise;return m.createGardenVegetationStudy(options);
  }};};
  const loader=createWesternGardenPlantingSourceLoader(f.deps),pending=loader.prepareRegion('xieqiqu-north');
  const rejected=assert.rejects(pending,{name:'AbortError'});await entered.promise;loader.dispose();
  assert.equal(loader.disposed,true);gate.resolve();await rejected;await loader.whenIdle();
  assert.deepEqual(f.created.map(r=>r.id),['juniper']);assertReleased(f.created);
  assert.equal(loader.snapshot().pending,0);assert.equal(loader.snapshot().disposedSources,1);
  await assert.rejects(loader.prepareRegion('xieqiqu-north'),{name:'AbortError'});loader.dispose();
});

test('cancel after source construction before publication releases all staged owners and allows retry',async()=>{
  const f=fixture(),cancel=new AbortController();let yields=0;
  f.deps.yieldControl=async()=>{if(++yields===2)cancel.abort();};
  const loader=createWesternGardenPlantingSourceLoader(f.deps);
  try{
    await assert.rejects(loader.prepareRegion('xieqiqu-north',{signal:cancel.signal}),{name:'AbortError'});
    assert.deepEqual(f.created.map(r=>r.id),['juniper','lake-rock']);assertReleased(f.created);
    assert.equal(loader.snapshot().sources.length,0);
    const result=await loader.prepareRegion('xieqiqu-north');assert.equal(Object.keys(result.sources).length,5);
  }finally{loader.dispose();}
  assertReleased(f.created);
});

test('a non-isolated or moved factory output is rejected and disposed, without moving its source',async()=>{
  for(const kind of ['extra-part','translated']){
    const f=fixture(),original=f.deps.loadVegetation;
    f.deps.loadVegetation=async()=>{const m=await original();return {createGardenVegetationStudy:options=>{
      const study=m.createGardenVegetationStudy(options);
      if(kind==='extra-part')study.group.add(new THREE.Group());else study.specimens[0].position.x=4;
      return study;
    }};};
    const loader=createWesternGardenPlantingSourceLoader(f.deps);
    await assert.rejects(loader.prepareRegion('xieqiqu-north'),/one unplaced/);
    assert.equal(loader.snapshot().sources.length,0);assertReleased(f.created);
    if(kind==='translated')assert.equal(f.created[0].part.position.x,4);loader.dispose();
  }
});

test('validation before commit is atomic even if an earlier staged source changed during a yield',async()=>{
  const f=fixture();let yields=0;
  f.deps.yieldControl=async()=>{if(++yields===5)f.created[0].part.position.x=3;};
  const loader=createWesternGardenPlantingSourceLoader(f.deps);
  await assert.rejects(loader.prepareRegion('xieqiqu-north'),/one unplaced/);
  assert.equal(f.created.length,5);assert.equal(loader.snapshot().sources.length,0);assertReleased(f.created);loader.dispose();
});

test('lifetime abort disposes committed sources and cleanup failure still attempts every owner once',async()=>{
  const f=fixture(),cancel=new AbortController(),loader=createWesternGardenPlantingSourceLoader({...f.deps,signal:cancel.signal});
  await loader.prepareRegion('xieqiqu-north');
  const first=f.created[0],original=first.owner.dispose;
  first.owner.dispose=()=>{original();throw new Error('fixture cleanup diagnostic');};
  cancel.abort();await loader.whenIdle();
  assert.equal(loader.disposed,true);assertReleased(f.created);assert.deepEqual(loader.snapshot().cleanupErrors,['fixture cleanup diagnostic']);
  loader.dispose();assertReleased(f.created);assert.equal(loader.snapshot().disposedSources,5);
});

test('prepared real Three sources assemble into the frozen region API and one region cleanup does not dispose shared owners',async()=>{
  const f=fixture(),loader=createWesternGardenPlantingSourceLoader(f.deps);
  const geometry=new THREE.PlaneGeometry(300,300);geometry.rotateX(-Math.PI/2);geometry.translate(450,4,-600);geometry.computeVertexNormals();
  const sampler=createTriangleSampler([geometry]),terrain={paths:[],courtFootprints:[],waterSurfaces:[],surfaceAt(x,z){
    const hit=sampler.sample(x,z);return hit&&{...hit,kind:'land',walkable:true,supportSource:'terrain-triangle'};
  }};
  const architecture=createArchitectureSurface(new THREE.Group());let a,b;
  try{
    const first=await loader.prepareRegion('xieqiqu-north'),next=await loader.prepareRegion('yangquelong-west');
    a=await createWesternGardenPlantingRegion({regionId:first.regionId,terrain,architecture,sources:first.sources,yieldControl:noYield});
    b=await createWesternGardenPlantingRegion({regionId:next.regionId,terrain,architecture,sources:next.sources,yieldControl:noYield});
    assert.equal(a.parts.length,11);assert.equal(b.parts.length,9);assert.equal(a.assertCurrent(),true);assert.equal(b.assertCurrent(),true);
    const original=f.created.find(r=>r.id==='juniper'),aMesh=a.parts[0].children[0].children[0],bMesh=b.parts[0].children[0].children[0];
    assert.equal(aMesh.geometry,original.geometry);assert.equal(bMesh.geometry,aMesh.geometry);assert.equal(aMesh.material,original.material);
    a.dispose();for(const r of f.created)for(const count of r.disposedCounts.values())assert.equal(count,0);
    assert.equal(b.assertCurrent(),true);b.dispose();loader.dispose();assertReleased(f.created);
  }finally{a?.dispose();b?.dispose();loader.dispose();architecture.dispose();sampler.dispose();geometry.dispose();}
});

test('plant source materials use bounded centroid color/normal interpolation and retain authored hooks',async()=>{
  const f=fixture(),calls=[];
  for(const [method,factoryName] of [['loadVegetation','createGardenVegetationStudy'],['loadUnderstory','createGardenUnderstoryStudy']]){
    const load=f.deps[method];
    f.deps[method]=async()=>{
      const module=await load();
      return {[factoryName]:options=>{
        const study=module[factoryName](options),id=options.specimens[0],record=f.created.at(-1);
        record.material.onBeforeCompile=function(shader,renderer){assert.equal(this,record.material);calls.push(id);shader.vertexShader+='\n// original-plant-hook';};
        record.material.customProgramCacheKey=function(){assert.equal(this,record.material);return 'original-'+id;};
        return study;
      }};
    };
  }
  const loader=createWesternGardenPlantingSourceLoader(f.deps);
  try{
    await loader.prepareRegion('xieqiqu-north');
    await loader.prepareRegion('lake-west-pair');
    for(const record of f.created){
      const material=record.material,shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
      material.onBeforeCompile(shader,null);
      assert.ok(shader.vertexShader.includes('// original-plant-hook'));
      assert.equal(calls.filter(id=>id===record.id).length,1,'original shader callback runs once');
      assert.ok(material.customProgramCacheKey().startsWith('original-'+record.id));
      assert.equal(material.roughness,.74);assert.equal(material.metalness,0);
      assert.equal(record.part.children[0].geometry,record.geometry);
      assert.equal(record.part.children[1].material,material);
      for(const stage of ['vertexShader','fragmentShader']){
        if(record.id==='lake-rock')assert.doesNotMatch(shader[stage],/centroid varying/);
        else for(const name of ['vColor','vNormal','vTangent','vBitangent'])assert.match(shader[stage],new RegExp('centroid varying vec[234] '+name+'\\s*;'),record.id+' '+stage+' '+name);
      }
      if(record.id!=='lake-rock')assert.equal(material.version,1,'shared source material is patched once');
    }
  }finally{loader.dispose();}
  assertReleased(f.created);
});
