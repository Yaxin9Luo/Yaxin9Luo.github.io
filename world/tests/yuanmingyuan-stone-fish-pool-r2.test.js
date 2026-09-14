import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {sampleStoneFishSurface} from '../src/yuanmingyuan/xieqiqu-fish-surface.js';
import {createStoneFishBellySeat,createXieqiquStoneFishPoolFromSource} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-study.js';
import {createStoneFishCarvedWaveGeometry,createStoneFishRolledWaveCrests} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r2-geometry.js';
import {createXieqiquStoneFishPoolR2FromBase} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r2-study.js';
import {stoneFishPoolR2StudyViews} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r2-views.js';

const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const geometryHash=g=>Object.fromEntries([['index',g.index],...Object.entries(g.attributes)].map(([k,a])=>[k,a?hash(a.array):null]));
function fixtureBody(){
  const rows=96,columns=64,positions=[],uv=[],indices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){const p=sampleStoneFishSurface(.20+i/rows*.40,Math.PI+.36+j/columns*(Math.PI-.72)).position;positions.push(...p.toArray());uv.push(i/rows,j/columns);}
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const a=i*(columns+1)+j,b=a+1,d=a+columns+1,c=d+1;indices.push(a,d,b,b,d,c);}
  const geometry=new THREE.BufferGeometry();geometry.name='partial-real-source-belly-for-r2-fixture';geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.userData.bellySamplingGrid={firstVertex:0,stride:columns+1,rowCount:rows+1,columnCount:columns+1,quadColumns:columns,firstTriangle:0,tStart:.20,tStep:.40/rows,angleStart:Math.PI+.36,angleStep:(Math.PI-.72)/columns};return geometry;
}
function topology(g){
  const p=g.attributes.position,n=g.attributes.normal,ids=g.index,keys=new Map(),welded=[],edges=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3(),average=new THREE.Vector3();let volume=0,degenerate=0,nonfinite=0,shortNormals=0,opposingNormals=0;
  for(let i=0;i<p.count;i++){const tuple=[p.getX(i),p.getY(i),p.getZ(i)],key=tuple.join(',');if(!keys.has(key))keys.set(key,keys.size);welded.push(keys.get(key));if(!tuple.every(Number.isFinite))nonfinite++;const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(!Number.isFinite(length)||length<.99||length>1.01)shortNormals++;}
  for(let i=0;i<ids.count;i+=3){const face=[ids.getX(i),ids.getX(i+1),ids.getX(i+2)];a.fromBufferAttribute(p,face[0]);b.fromBufferAttribute(p,face[1]);c.fromBufferAttribute(p,face[2]);volume+=a.dot(cross.crossVectors(b,c))/6;if(cross.crossVectors(b.clone().sub(a),c.clone().sub(a)).lengthSq()===0)degenerate++;else{cross.normalize();average.set(0,0,0);for(const id of face)average.add(new THREE.Vector3().fromBufferAttribute(n,id));if(cross.dot(average)<=0)opposingNormals++;}
    for(let j=0;j<3;j++){const x=welded[face[j]],y=welded[face[(j+1)%3]],key=x<y?x+':'+y:y+':'+x,e=edges.get(key);if(e){e.count++;e.balance+=x<y?1:-1;}else edges.set(key,{count:1,balance:x<y?1:-1});}}
  return {volume,degenerate,nonfinite,shortNormals,opposingNormals,badEdges:[...edges.values()].filter(e=>e.count!==2||e.balance!==0).length};
}
function fixtureOwners(){
  const body=fixtureBody(),geometries=[body,...Array.from({length:5},()=>new THREE.BoxGeometry(.02,.02,.02).translate(0,.9,0))],material=new THREE.MeshStandardMaterial(),group=new THREE.Group(),maps=Object.fromEntries(['color','normal','roughness'].map(k=>[k,new THREE.DataTexture(new Uint8Array(16).fill(160),2,2,THREE.RGBAFormat)]));let disposed=false,texturesDisposed=false;
  geometries.forEach((g,i)=>{const mesh=new THREE.Mesh(g,material);mesh.userData.body=i===0?'continuous-body':i>=4?'eye-'+i:'part-'+i;group.add(mesh);});
  const source={group,diagnostics:{partialFixture:true},get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();material.dispose();group.clear();}},textures={maps,fullResolutionVerified:false,get disposed(){return texturesDisposed;},dispose(){if(texturesDisposed)return;texturesDisposed=true;for(const t of Object.values(maps))t.dispose();}};
  return {source,textures,dispose(){source.dispose();textures.dispose();}};
}

test('the curved wave core preserves every real contact coordinate and closes onto both actual pool depths',()=>{
  const body=fixtureBody(),before=geometryHash(body),seat=createStoneFishBellySeat(body),seatBefore=geometryHash(seat.geometry),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  try{for(const size of [1,.72]){
    const bottomY=(-.45-.14)/size,waterY=(.13-.14)/size,core=createStoneFishCarvedWaveGeometry({contactGeometry:seat.geometry,contactInfo:seat.diagnostics,bottomY,waterY,bodyMinimumY:body.boundingBox.min.y});
    try{const result=topology(core.geometry);assert.equal(result.badEdges,0);assert.equal(result.degenerate,0);assert.equal(result.nonfinite,0);assert.equal(result.shortNormals,0);assert.equal(result.opposingNormals,0);assert(result.volume>0);assert.equal(core.validate().maximumContactDrift,0);
      const sourceMesh=new THREE.Mesh(body,material),coreMesh=new THREE.Mesh(core.geometry,material);sourceMesh.updateMatrixWorld();coreMesh.updateMatrixWorld();
      for(const x of [-.11,0,.11])for(const z of [-.10,.20,.48]){const lower=new THREE.Raycaster(new THREE.Vector3(x,.31,z),new THREE.Vector3(0,1,0)).intersectObject(sourceMesh)[0],upper=new THREE.Raycaster(new THREE.Vector3(x,.70,z),new THREE.Vector3(0,-1,0)).intersectObject(coreMesh)[0];assert(lower&&upper);assert(Math.abs(upper.point.y-lower.point.y-.003)<2e-7);}
      assert(Math.abs(core.geometry.boundingBox.min.y*size+.14+.45)<2e-7);
      const p=core.geometry.attributes.position;let outward=0;for(let i=seat.diagnostics.sourceVertices;i<p.count;i++)if(Math.abs(p.getX(i))>.35&&p.getY(i)>.0)outward++;assert(outward>100,'the actual wave side spreads outside the narrow belly column');
    }finally{core.geometry.dispose();}
  }assert.deepEqual(geometryHash(body),before);assert.deepEqual(geometryHash(seat.geometry),seatBefore);
  }finally{seat.dispose();body.dispose();material.dispose();}
});

test('curled crests are closed volumes, clear the body and have real roots inside the curved support',()=>{
  const body=fixtureBody(),seat=createStoneFishBellySeat(body),core=createStoneFishCarvedWaveGeometry({contactGeometry:seat.geometry,contactInfo:seat.diagnostics,bottomY:-.59,waterY:-.01,bodyMinimumY:body.boundingBox.min.y}),crests=createStoneFishRolledWaveCrests(body.boundingBox.min.y),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(core.geometry,material);mesh.updateMatrixWorld();
  try{assert.equal(crests.length,6);for(const crest of crests){const proof=topology(crest);assert(proof.volume>0);assert.equal(proof.badEdges,0);assert.equal(proof.degenerate,0);assert.equal(proof.shortNormals,0);assert.equal(proof.opposingNormals,0);assert(crest.boundingBox.max.y<body.boundingBox.min.y-.012);const origin=new THREE.Vector3(...crest.userData.root),hits=new THREE.Raycaster(origin,new THREE.Vector3(.93,.137,.251).normalize()).intersectObject(mesh);assert.equal(hits.length%2,1,'the actual curled crest starts inside the solid core');}}
  finally{for(const g of crests)g.dispose();core.geometry.dispose();seat.dispose();body.dispose();material.dispose();}
});

test('R2 shares all source fish geometry and marble maps, replaces support drawing and leaves actual pool/water buffers intact',()=>{
  const sources=fixtureOwners(),base=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures}),before=sources.source.group.children.map(n=>geometryHash(n.geometry)),pool=base.group.getObjectByName('xieqiqu-south-haitang-pool'),poolBefore=pool.children.filter(n=>n.isMesh).map(n=>({node:n,geometry:n.geometry,proof:geometryHash(n.geometry),material:n.material})),owner=createXieqiquStoneFishPoolR2FromBase({baseOwner:base});
  try{
    assert.equal(owner.diagnostics.supportStudy.uniqueWaveCoreGeometries,2);assert.equal(owner.diagnostics.supportStudy.sharedCrestGeometries,6);assert.equal(owner.diagnostics.supportStudy.newTextures,0);assert.equal(owner.diagnostics.supportStudy.newMaterials,10);
    assert.equal(owner.supports[0].core.geometry,owner.supports[1].core.geometry);assert.equal(owner.supports[2].core.geometry,owner.supports[3].core.geometry);assert.notEqual(owner.supports[0].core.geometry,owner.supports[2].core.geometry);
    for(const support of owner.supports){assert.equal(support.mount.plinth.children.length,7);assert.equal(support.mount.plinth.getObjectByName(support.mount.group.name+'-fitted-belly-seat'),undefined);assert.equal(support.crestMeshes[0].geometry,owner.supports[0].crestMeshes[0].geometry);}
    for(const original of poolBefore){assert.equal(original.node.geometry,original.geometry);assert.deepEqual(geometryHash(original.geometry),original.proof);if(original.material.userData.category==='water'){assert.notEqual(original.node.material,original.material);assert.equal(original.node.material.userData.studyId,'xieqiqu-pool-water-r1');assert.equal(original.node.material.normalMap,original.material.normalMap);original.node.material.addEventListener('dispose',()=>assert.equal(original.node.material,original.material,'water bindings restore before their clones are disposed'));}}
    const camera=new THREE.PerspectiveCamera(40,1,.04,1200);camera.position.set(19,9,35);camera.lookAt(0,0,26);camera.updateMatrixWorld();const states=[];
    for(const support of owner.supports){const mesh=support.coreMesh,m=mesh.material[0],shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader);mesh.onBeforeRender(null,null,camera,mesh.geometry,m);states.push(shader.uniforms.fishMetricNormalToView);assert.equal(m.map,sources.textures.maps.color);assert.equal(m.normalMap,sources.textures.maps.normal);assert.equal(m.roughnessMap,sources.textures.maps.roughness);assert.equal(shader.uniforms.fishTileMetres.value,1.5);}
    assert.equal(new Set(states).size,4);assert.notDeepEqual(states[0].value.elements,states[1].value.elements);owner.update(.55);assert.deepEqual(sources.source.group.children.map(n=>geometryHash(n.geometry)),before);assert.equal(owner.validate().retiredNodesDrawn,0);
    for(const view of Object.values(stoneFishPoolR2StudyViews))for(const name of view.groups)assert(owner.group.getObjectByName(name));
  }finally{owner.dispose();owner.dispose();assert.equal(owner.waterOwner.disposed,true);assert.equal(base.disposed,true);assert.equal(sources.source.disposed,false);assert.equal(sources.textures.disposed,false);sources.dispose();}
});

test('abort consumes and cleans the private base; added materials and geometry are each released once',()=>{
  const sources=fixtureOwners(),base=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures}),owner=createXieqiquStoneFishPoolR2FromBase({baseOwner:base}),resources=new Map();
  owner.group.traverse(n=>{if(!n.isMesh)return;for(const r of [n.geometry,...[].concat(n.material)])if(!resources.has(r)){resources.set(r,0);r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1));}});
  try{owner.dispose();owner.dispose();for(const [resource,count] of resources){const borrowed=sources.source.group.children.some(n=>n.geometry===resource);assert.equal(count,borrowed?0:1);}
    const second=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures}),controller=new AbortController();controller.abort();assert.throws(()=>createXieqiquStoneFishPoolR2FromBase({baseOwner:second,signal:controller.signal}),{name:'AbortError'});assert.equal(second.disposed,true);
  }finally{owner.dispose();sources.dispose();}
});

test('the assembled real loft flow clones preserve all source arrays and restore their geometry before either owner releases it',()=>{
  const sources=fixtureOwners(),base=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures}),originals=[];
  // These are the actual context Builder's nonindexed/merged fountain lofts,
  // including repeated cap-centre vertices. Only the fish fixture is bounded.
  for(const mount of base.context.mounts){const endpoint=base.context.diagnostics.waterEndpoints.find(e=>e.id===mount.group.name+'-jet');mount.flow.traverse(mesh=>{if(mesh.isMesh&&mesh.material.userData.role==='flow')originals.push({mesh,geometry:mesh.geometry,proof:geometryHash(mesh.geometry),world:mesh.matrixWorld.toArray(),endpoint,sourceDisposals:0,viewDisposals:0});});}
  assert.equal(originals.length,4);for(const original of originals)original.geometry.addEventListener('dispose',()=>{original.sourceDisposals++;assert.equal(original.viewDisposals,1,'owned water clone must be released before the original context source');});
  let owner;try{
    owner=createXieqiquStoneFishPoolR2FromBase({baseOwner:base});const copies=new Set();
    for(const original of originals){
      const {mesh,geometry:source,endpoint}=original,view=mesh.geometry,t=view.attributes.poolStreamT,p=view.attributes.position,point=new THREE.Vector3(),a=new THREE.Vector3(...endpoint.start),b=new THREE.Vector3(...endpoint.end);copies.add(view);
      assert.notEqual(view,source);assert.equal(source.index,null,'production Builder supplies real nonindexed faces');assert.equal(view.index,null);assert.equal(source.attributes.poolStreamT,undefined);assert.equal(t.count,p.count);assert.deepEqual(mesh.matrixWorld.toArray(),original.world);
      assert.notEqual(mesh.material.customProgramCacheKey(),'xieqiqu-pool-water-r1-moving-stream','the attribute-based shader must not reuse the old UV-only program key');
      for(const [key,attribute] of Object.entries(source.attributes)){assert.notEqual(view.attributes[key].array,attribute.array);assert.equal(hash(view.attributes[key].array),original.proof[key]);}assert.deepEqual(geometryHash(source),original.proof);
      let mouthCentres=0,landingCentres=0,capFaces=0;
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i);const mouth=point.distanceToSquared(a)<1e-12,landing=point.distanceToSquared(b)<1e-12;
        if(mouth||landing){assert.equal(source.attributes.uv.getY(i),.5);assert.equal(t.getX(i),mouth?0:1);if(mouth)mouthCentres++;else landingCentres++;
          const face=Math.floor(i/3)*3;for(let j=face;j<face+3;j++)assert.equal(t.getX(j),mouth?0:1,'the entire actual cap face has the endpoint phase, without a residual centre disc');capFaces++;
        }else assert.equal(t.getX(i),source.attributes.uv.getY(i));
      }
      assert(mouthCentres>0&&landingCentres>0&&capFaces>2);view.addEventListener('dispose',()=>{original.viewDisposals++;assert.equal(mesh.geometry,source,'flow restores its original geometry before releasing its clone');assert.equal(original.sourceDisposals,0);});
    }
    assert.equal(copies.size,4);owner.update(.77);for(const original of originals){assert.deepEqual(geometryHash(original.geometry),original.proof);assert.deepEqual(original.mesh.matrixWorld.toArray(),original.world);}
    owner.dispose();owner.dispose();for(const original of originals){assert.equal(original.sourceDisposals,1);assert.equal(original.viewDisposals,1);}
  }finally{owner?.dispose();base.dispose();sources.dispose();}
});
