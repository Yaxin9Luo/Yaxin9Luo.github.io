import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {sampleStoneFishSurface} from '../src/yuanmingyuan/xieqiqu-fish-surface.js';
import {createStoneFishBellySeat,createXieqiquStoneFishPoolFromSource} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-study.js';
import {createStoneFishCarvedWaveR3} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r3-geometry.js';
import {createXieqiquStoneFishPoolR2FromBase} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r2-study.js';
import {stoneFishPoolR3StudyId,stoneFishPoolR3StudyViews} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r3-views.js';

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
  const parent=Array.from({length:keys.size},(_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};for(let i=0;i<ids.count;i+=3){const a=root(welded[ids.getX(i)]);for(let k=1;k<3;k++)parent[root(welded[ids.getX(i+k)])]=a;}const components=new Set(parent.map((_,i)=>root(i))).size;
  return {components,volume,degenerate,nonfinite,shortNormals,opposingNormals,badEdges:[...edges.values()].filter(e=>e.count!==2||e.balance!==0).length};
}
function fixtureOwners(){
  const body=fixtureBody(),geometries=[body,...Array.from({length:5},()=>new THREE.BoxGeometry(.02,.02,.02).translate(0,.9,0))],material=new THREE.MeshStandardMaterial(),group=new THREE.Group(),maps=Object.fromEntries(['color','normal','roughness'].map(k=>[k,new THREE.DataTexture(new Uint8Array(16).fill(160),2,2,THREE.RGBAFormat)]));let disposed=false,texturesDisposed=false;
  geometries.forEach((g,i)=>{const mesh=new THREE.Mesh(g,material);mesh.userData.body=i===0?'continuous-body':i>=4?'eye-'+i:'part-'+i;group.add(mesh);});
  const source={group,diagnostics:{partialFixture:true},get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();material.dispose();group.clear();}},textures={maps,fullResolutionVerified:false,get disposed(){return texturesDisposed;},dispose(){if(texturesDisposed)return;texturesDisposed=true;for(const t of Object.values(maps))t.dispose();}};
  return {source,textures,dispose(){source.dispose();textures.dispose();}};
}


function horizontalSection(g,y,roleAt){
  const p=g.attributes.position,index=g.index,points=[];
  for(let i=0;i<index.count;i+=3){if(roleAt(i/3)!==0)continue;for(let k=0;k<3;k++){
    const a=index.getX(i+k),b=index.getX(i+(k+1)%3),ay=p.getY(a),by=p.getY(b);if((ay-y)*(by-y)>0||ay===by)continue;
    const t=(y-ay)/(by-ay);points.push([THREE.MathUtils.lerp(p.getX(a),p.getX(b),t),THREE.MathUtils.lerp(p.getZ(a),p.getZ(b),t)]);
  }}
  assert(points.length>20);return {width:Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),length:Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))};
}

test('each actual R3 support is one closed volume with no opposing normals; original cap and bottom remain exact at both fish sizes',()=>{
  const body=fixtureBody(),sourceBefore=geometryHash(body),seat=createStoneFishBellySeat(body),capBefore=geometryHash(seat.geometry),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  try{for(const size of [1,.72]){
    const bottomY=-.59/size,waterY=-.01/size,core=createStoneFishCarvedWaveR3({contactGeometry:seat.geometry,contactInfo:seat.diagnostics,bottomY,waterY,bodyMinimumY:body.boundingBox.min.y,worldScale:size});let releases=0;core.geometry.addEventListener('dispose',()=>releases++);
    try{const result=topology(core.geometry);assert.equal(result.components,1);for(const k of ['badEdges','degenerate','nonfinite','shortNormals','opposingNormals'])assert.equal(result[k],0,k);assert(result.volume>0);assert.equal(core.validate().maximumContactDrift,0);
      const n=seat.diagnostics.sourceVertices,count=seat.diagnostics.sourceTriangles*3;
      for(const key of ['position','normal','uv'])assert.deepEqual(core.geometry.attributes[key].array.subarray(0,n*core.geometry.attributes[key].itemSize),seat.geometry.attributes[key].array.subarray(0,n*seat.geometry.attributes[key].itemSize));
      assert.deepEqual(Array.from(core.geometry.index.array.subarray(0,count)),Array.from(seat.geometry.index.array.subarray(0,count)));
      const sourceMesh=new THREE.Mesh(body,material),supportMesh=new THREE.Mesh(core.geometry,material);sourceMesh.updateMatrixWorld();supportMesh.updateMatrixWorld();
      for(const x of [-.11,0,.11])for(const z of [-.10,.20,.48]){const lower=new THREE.Raycaster(new THREE.Vector3(x,.31,z),new THREE.Vector3(0,1,0)).intersectObject(sourceMesh)[0],upper=new THREE.Raycaster(new THREE.Vector3(x,.70,z),new THREE.Vector3(0,-1,0)).intersectObject(supportMesh)[0];assert(lower&&upper);assert(Math.abs((upper.point.y-lower.point.y)*size-.003*size)<2e-7);}
      assert(Math.abs(core.geometry.boundingBox.min.y*size+.14+.45)<2e-7);
      const waterSection=horizontalSection(core.geometry,waterY,core.surfaceRoleAt),submergedSection=horizontalSection(core.geometry,THREE.MathUtils.lerp(waterY,bottomY,.68),core.surfaceRoleAt);
      assert(waterSection.width<.76&&waterSection.length<1.36,'the water-line outline must not restore the old broad pedestal skirt');assert(submergedSection.width>waterSection.width*1.25&&submergedSection.length>waterSection.length*1.15,'the spreading foot must be below the retained water level');
      assert(core.diagnostics.maximumWaveY<body.boundingBox.min.y-.012);
    }finally{core.dispose();core.dispose();assert.equal(releases,1);assert.throws(()=>core.validate(),/disposed/);}
  }assert.deepEqual(geometryHash(body),sourceBefore);assert.deepEqual(geometryHash(seat.geometry),capBefore);
  }finally{seat.dispose();body.dispose();material.dispose();}
});

test('the five true inner openings survive a 3-by-3 ray footprint and side-angle changes, with actual solid crests and connected roots',()=>{
  const body=fixtureBody(),seat=createStoneFishBellySeat(body),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  try{for(const size of [1,.72]){const owner=createStoneFishCarvedWaveR3({contactGeometry:seat.geometry,contactInfo:seat.diagnostics,bottomY:-.59/size,waterY:-.01/size,bodyMinimumY:body.boundingBox.min.y,worldScale:size}),mesh=new THREE.Mesh(owner.geometry,material);mesh.updateMatrixWorld();
    try{assert.equal(owner.waves.length,5);for(const wave of owner.waves){const normal=new THREE.Vector3(...wave.viewNormal),along=new THREE.Vector3().crossVectors(normal,new THREE.Vector3(0,1,0)),centre=new THREE.Vector3(...wave.airProbe),crest=new THREE.Vector3(...wave.crestProbe),rootIds=new Set(wave.rootBoundary);let coreFaces=0,waveFaces=0;
      for(let i=0;i<owner.geometry.index.count;i+=3)if([0,1,2].some(k=>rootIds.has(owner.geometry.index.getX(i+k)))){if(owner.surfaceRoleAt(i/3)===wave.role)waveFaces++;else if(owner.surfaceRoleAt(i/3)===0)coreFaces++;}assert(coreFaces>0&&waveFaces>0,'the same real root vertices must belong to the body and to the wave');
      const directions=[-.12,0,.12].map(angle=>normal.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle));if(wave.id.startsWith('near-'))directions.push(new THREE.Vector3(...stoneFishPoolR3StudyViews.contact.direction).normalize());
      for(const view of directions){const crestHit=new THREE.Raycaster(crest.clone().addScaledVector(view,.5),view.clone().negate()).intersectObject(mesh)[0];assert(crestHit);assert.equal(owner.surfaceRoleAt(crestHit.faceIndex),wave.role);
        for(const dx of [-.01,0,.01])for(const dy of [-.01,0,.01]){const point=centre.clone().addScaledVector(along,dx*wave.scale).addScaledVector(new THREE.Vector3(0,1,0),dy*wave.scale),hit=new THREE.Raycaster(point.addScaledVector(view,.5),view.clone().negate()).intersectObject(mesh)[0];assert(hit);assert.equal(owner.surfaceRoleAt(hit.faceIndex),0,'view through the curl must reach the deeper body, not a filled wave');assert((hit.distance-crestHit.distance)*size>.035,'actual inner negative space must be at least 35 mm deep in the tested directions');}
      }
    }}finally{owner.dispose();}
  }}finally{seat.dispose();body.dispose();material.dispose();}
});

test('R3 is opt-in and borrows exactly the same six fish geometries, four independent material frames and three maps',()=>{
  const sources=fixtureOwners(),sourceBefore=sources.source.group.children.map(n=>geometryHash(n.geometry)),base=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures}),mouths=structuredClone(base.context.diagnostics.waterEndpoints),mounts=base.context.mounts.map(m=>m.group.matrix.toArray()),owner=createXieqiquStoneFishPoolR2FromBase({baseOwner:base,supportVariant:'r3'});
  try{assert.equal(owner.diagnostics.assetId,stoneFishPoolR3StudyId);assert.equal(owner.diagnostics.supportVariant,'r3');assert.equal(owner.diagnostics.supportStudy.uniqueWaveCoreGeometries,2);assert.equal(owner.diagnostics.supportStudy.sharedCrestGeometries,0);assert.equal(owner.diagnostics.supportStudy.newTextures,0);assert.equal(owner.diagnostics.supportStudy.newMaterials,10);assert.equal(owner.diagnostics.visualAcceptance,false);assert.equal(owner.diagnostics.archiveCompatible,false);
    assert.equal(owner.supports[0].core.geometry,owner.supports[1].core.geometry);assert.equal(owner.supports[2].core.geometry,owner.supports[3].core.geometry);assert.notEqual(owner.supports[0].core.geometry,owner.supports[2].core.geometry);
    const camera=new THREE.PerspectiveCamera(40,1,.04,1200);camera.position.set(19,9,35);camera.lookAt(0,0,26);camera.updateMatrixWorld();const frames=[];
    for(const support of owner.supports){assert.equal(support.mount.plinth.children.length,1);assert.equal(support.core.waves.length,5);const m=support.coreMesh.material[0],shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader);support.coreMesh.onBeforeRender(null,null,camera,support.core.geometry,m);frames.push(shader.uniforms.fishMetricNormalToView);assert.equal(m.map,sources.textures.maps.color);assert.equal(m.normalMap,sources.textures.maps.normal);assert.equal(m.roughnessMap,sources.textures.maps.roughness);assert.equal(shader.uniforms.fishTileMetres.value,1.5);}
    assert.equal(new Set(frames).size,4);assert.notDeepEqual(frames[0].value.elements,frames[1].value.elements);assert.deepEqual(base.context.diagnostics.waterEndpoints,mouths);assert.deepEqual(base.context.mounts.map(m=>m.group.matrix.toArray()),mounts);owner.update(.47);assert.equal(owner.validate().retiredNodesDrawn,0);
    assert.deepEqual(sources.source.group.children.map(n=>geometryHash(n.geometry)),sourceBefore);for(const view of Object.values(stoneFishPoolR3StudyViews))for(const name of view.groups)assert(owner.group.getObjectByName(name));
  }finally{owner.dispose();owner.dispose();assert(owner.supports.length===0);assert.equal(sources.source.disposed,false);assert.equal(sources.textures.disposed,false);sources.dispose();}
});

test('R3 cleanup restores water first, releases its two shared supports once, and does not consume borrowed maps or source; abort and unknown variants are explicit',()=>{
  const sources=fixtureOwners();let owner;
  try{const base=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures}),controller=new AbortController();owner=createXieqiquStoneFishPoolR2FromBase({baseOwner:base,signal:controller.signal,supportVariant:'r3'});const cores=[...new Set(owner.supports.map(s=>s.core))],counts=new Map(cores.map(c=>[c,0]));for(const c of cores)c.geometry.addEventListener('dispose',()=>{counts.set(c,counts.get(c)+1);assert.equal(owner.waterOwner.disposed,true);});controller.abort();owner.dispose();for(const c of cores){assert.equal(counts.get(c),1);assert(c.disposed);}assert(base.disposed);assert(!sources.source.disposed&&!sources.textures.disposed);
    const second=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures}),aborted=new AbortController();aborted.abort();assert.throws(()=>createXieqiquStoneFishPoolR2FromBase({baseOwner:second,supportVariant:'r3',signal:aborted.signal}),{name:'AbortError'});assert(second.disposed);
    const third=createXieqiquStoneFishPoolFromSource({sourceOwner:sources.source,textureOwner:sources.textures});try{assert.throws(()=>createXieqiquStoneFishPoolR2FromBase({baseOwner:third,supportVariant:'unknown'}),/unknown support variant/);assert.equal(third.disposed,false);}finally{third.dispose();}
  }finally{owner?.dispose();sources.dispose();}
});
