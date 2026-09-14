import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as world from '../src/world.js';
import {academyPathCurves} from '../src/landform-layout.js';
import {locations} from '../src/locations.js';
import {herbariumSites} from '../src/herbarium-layout.js';

function foundationSamples(){const samples=[];for(const site of herbariumSites.filter(s=>s.kind!=='water')){const c=Math.cos(site.rotation||0),s=Math.sin(site.rotation||0);for(let x=-site.width/2;x<=site.width/2;x+=.37)for(let z=-site.depth/2;z<=site.depth/2;z+=.37)samples.push([site.x+x*c+z*s,site.z-x*s+z*c,site.floor]);}return samples;}

// Catches missing/incomplete grade under the delivered floors, not the nominal centre alone.
test('whole arcade and conservatory foundations fit their finished floor without hillside penetration',()=>{
  for(const [x,z,floor] of foundationSamples()){
    const h=world.renderedTerrainHeight(x,z);assert.ok(h<=floor+.005&&h>=floor-.18,`floor ${floor}, ground ${h} at ${x},${z}`);
  }
});

test('indexed road predicate preserves exact eligible samples and strict radius boundaries',()=>{
  assert.equal(typeof world.createRoadSampleIndex,'function');
  const paths=locations.flatMap(l=>academyPathCurves(l).map(c=>c.getPoints(Math.ceil(c.getLength()/.18))));
  const reference=(x,z)=>paths.some(p=>p.some((v,i)=>i%3===0&&Math.hypot(v.x-x,v.z-z)<3.7));
  const indexed=world.createRoadSampleIndex(paths);
  let state=18;const rand=()=>((state=Math.imul(state,1664525)+1013904223)>>>0)/4294967296;
  for(let i=0;i<12000;i++){const x=rand()*300-150,z=rand()*300-150;assert.equal(indexed(x,z),reference(x,z),`${x},${z}`);}
  const boundary=world.createRoadSampleIndex([[{x:0,z:0},{x:50,z:50},{x:60,z:60},{x:10,z:0}]]);
  assert.equal(boundary(3.7,0),false);assert.equal(boundary(3.7-1e-9,0),true);assert.equal(boundary(50,50),false);assert.equal(boundary(10,0),true);
});

test('placed source floors support face interiors, open aisles and water avoidance with registered disposal',async()=>{
  const {prepareHerbariumGeometry}=await import('./helpers/herbarium-source.js');await prepareHerbariumGeometry();
  const module=await import('../src/herbarium-district.js');
  const parent=new THREE.Group(),district=module.createHerbariumDistrict(parent,{heightAt:world.renderedTerrainHeight});
  const {createSurfaceSupport}=await import('../src/surface-support.js'),support=createSurfaceSupport(world.renderedTerrainHeight);
  for(const geometry of district.supportSurfaces){support.addGeometry(geometry);geometry.dispose();}
  let samples=0;
  district.group.updateMatrixWorld(true);
  district.group.traverse(mesh=>{
    if(!mesh.userData.support)return;
    const g=mesh.geometry,p=g.attributes.position,idx=g.index;
    for(let i=0;i<(idx?.count||p.count);i+=Math.max(3,Math.floor((idx?.count||p.count)/45/3)*3)){
      const a=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld),b=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld),c=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
      if(new THREE.Triangle(a,b,c).getNormal(new THREE.Vector3()).y<.98)continue;
      const point=a.add(b).add(c).divideScalar(3),h=support.heightAt(point.x,point.z);
      assert.ok(h>=point.y-.006&&h<=point.y+.15,`${mesh.name} visible floor ${point.y}, support ${h}`);samples++;
    }
  });
  assert.ok(samples>100);
  // Every actual loam top perimeter must sit on the installed terrain shoulder;
  // a deep excavation below a shallow soil block leaves a visible black air gap.
  let soilSamples=0;
  for(const instance of district.instances)for(const mesh of instance.children)for(const part of mesh.userData.parts||[])if(part.name==='Continuous irregular planted loam'){
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i++){
      const v=new THREE.Vector3().fromBufferAttribute(p,index.getX(i)).applyMatrix4(mesh.matrixWorld);if(Math.abs(v.y-instance.position.y)>.01)continue;
      const ground=support.heightAt(v.x,v.z);assert.ok(ground>=v.y-.025&&ground<=v.y+.025,`${instance.userData.site} soil top ${v.y}, ground ${ground} at ${v.x},${v.z}`);soilSamples++;
    }
  }
  assert.ok(soilSamples>2000);
  assert.ok(district.plantings.length>40,'connected margins contain actual low source plants');
  for(const plant of district.plantings){assert.ok(['fern_02','periwinkle_plant','didelta_spinosa'].includes(plant.userData.botanicalSource.id));assert.ok(Math.abs(support.heightAt(plant.position.x,plant.position.z)-plant.position.y)<.006,'low planting root follows installed earthwork support');}

  // The edge pilots may adjoin planted loam but cannot cover the original
  // paving, coping, bench furniture or greenhouse curved wall solids. Test the
  // actual delivered triangles independently of runtime's placement masks.
  for(const [drift,site]of [['pond-near','water-garden'],['conservatory-south','conservatory']]){
    const building=district.instances.find(g=>g.userData.site===site),crowns=district.plantings.filter(p=>p.userData.drift===drift).map(p=>new THREE.Box3().setFromObject(p));
    for(const mesh of building.children){if(!mesh.isMesh||mesh.name.startsWith('source-'))continue;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
      for(const part of mesh.userData.parts||[]){if(['plant','ground','water','glass','basin'].includes(part.role))continue;
        const bounds=new THREE.Box3(new THREE.Vector3(...part.bounds.min),new THREE.Vector3(...part.bounds.max)).applyMatrix4(mesh.matrixWorld),near=crowns.filter(b=>b.intersectsBox(bounds));if(!near.length)continue;
        for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i+=3){const vertices=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k)).applyMatrix4(mesh.matrixWorld)),triangle=new THREE.Triangle(...vertices);assert.ok(!near.some(b=>b.intersectsTriangle(triangle)),`${drift} crown intersects delivered ${part.name}`);}
      }
    }
  }

  const pool=district.instances.find(g=>g.userData.site==='water-garden'),originalFloors=createSurfaceSupport(world.renderedTerrainHeight);
  const {getHerbariumSupportGeometries}=await import('../src/herbarium-assets.js');for(const geometry of getHerbariumSupportGeometries(pool)){originalFloors.addGeometry(geometry);geometry.dispose();}
  for(const mesh of pool.children){const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(const part of mesh.userData.parts||[])if(part.name==='Visible shallow stone basin floor')for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i+=3){
      const point=new THREE.Vector3();for(let k=0;k<3;k++)point.add(new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k)).applyMatrix4(mesh.matrixWorld));point.divideScalar(3);
      assert.ok(world.renderedTerrainHeight(point.x,point.z)<point.y-.015,`ground penetrates basin at ${point.x},${point.z}`);
      const before=originalFloors.heightAt(point.x,point.z),after=support.heightAt(point.x,point.z);
      assert.ok(before>=point.y-.015?after<=before+.01:after<point.y-.015,`soil shoulder crosses the visible basin at ${point.x},${point.z}: ${before} -> ${after}`);
    }
  }

  const {queryGroundSupport}=await import('../src/ground-motion.js');
  const scene={heightAt:support.heightAt,colliders:district.colliders};
  const {herbariumPaths}=await import('../src/herbarium-layout.js');
  for(const path of herbariumPaths)for(let segment=1;segment<path.points.length;segment++){
    const [ax,az]=path.points[segment-1],[bx,bz]=path.points[segment],steps=Math.ceil(Math.hypot(bx-ax,bz-az)/.2);
    for(let i=0;i<=steps;i++)for(const offset of [-(path.width/2-.32),0,path.width/2-.32]){const length=Math.hypot(bx-ax,bz-az),x=ax+(bx-ax)*i/steps+(bz-az)/length*offset,z=az+(bz-az)*i/steps-(bx-ax)/length*offset,hit=queryGroundSupport({x,z,feetY:support.heightAt(x,z),height:3.6,allowSteps:true},scene);assert.equal(hit.valid,true,`${path.id} approach at ${x},${z}: ${hit.reason}`);}
  }

  for(const [x,z] of [[-20,2],[20,2],[53.2,29],[48,29],[-35.2,47]])assert.equal(queryGroundSupport({x,z,feetY:support.heightAt(x,z),allowSteps:true},scene).valid,true,`${x},${z} must remain open`);
  assert.equal(queryGroundSupport({x:-44,z:47,feetY:7.1,allowSteps:true},scene).valid,false,'basin is not a walking floor');
  const west=district.instances.find(g=>g.userData.site==='west-arcade'),east=district.instances.find(g=>g.userData.site==='east-arcade');assert.notEqual(west.children[0].geometry,east.children[0].geometry,'two accepted outer-vine variants own their assembly geometry');assert.deepEqual(west.children[0].geometry.attributes.position.array,east.children[0].geometry.attributes.position.array,'unchanged stone geometry is byte-identical across vine variants');assert.equal(west.children[0].material,east.children[0].material,'retained shared stone material');
  let releases=0;west.children[0].geometry.addEventListener('dispose',()=>releases++);district.dispose();district.dispose();assert.equal(releases,1);assert.equal(parent.children.length,0);
});

test('road lookup replacement preserves complete seeded vegetation placement records',async()=>{
  const {createVegetation}=await import('../src/landscape.js'),{loadBotanicalAssets}=await import('../src/botanical-cache.js'),{readFile}=await import('node:fs/promises'),{decodeGeometryGLB}=await import('./helpers/herbarium-source.js');
  await loadBotanicalAssets({loadGLTFImpl:async asset=>decodeGeometryGLB(await readFile(new URL(`../public${asset.url}`,import.meta.url)))});
  const paths=locations.flatMap(l=>academyPathCurves(l).map(c=>c.getPoints(Math.ceil(c.getLength()/.18))));
  const original=(x,z)=>paths.some(p=>p.some((v,i)=>i%3===0&&Math.hypot(v.x-x,v.z-z)<3.7));
  const before=new THREE.Group(),after=new THREE.Group(),a=createVegetation(before,()=>6,original),b=createVegetation(after,()=>6,world.createRoadSampleIndex(paths));
  const records=root=>root.children.filter(mesh=>mesh.isInstancedMesh).map(mesh=>({name:mesh.name,count:mesh.count,matrices:Array.from(mesh.instanceMatrix.array),colors:mesh.instanceColor?Array.from(mesh.instanceColor.array):null}));
  assert.deepEqual(records(after),records(before));for(const key of ['treeCount','grassCount','flowerCount','fernCount','litterCount'])assert.equal(a[key],b[key]);
});

test('active decoded runtime terrain supports complete foundations and preserves protected authored grades',async()=>{
  const {readFile}=await import('node:fs/promises'),{assetManifest}=await import('../src/asset-manifest.js'),{decodeGeometryGLB}=await import('./helpers/herbarium-source.js'),{mutableGeometry}=await import('../src/gltf-resource.js'),{createSurfaceSupport}=await import('../src/surface-support.js');
  const asset=assetManifest['navigation-terrain'],gltf=await decodeGeometryGLB(await readFile(new URL(`../public${asset.url}`,import.meta.url)));gltf.scene.updateMatrixWorld(true);
  const mesh=gltf.scene.getObjectByName('ground'),geometry=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld),support=createSurfaceSupport(()=>-22);support.addGeometry(geometry);
  for(const [x,z,floor] of foundationSamples()){const y=support.heightAt(x,z);assert.ok(y<=floor+.01&&y>=floor-.19,`${asset.url}: ${x},${z} = ${y}`);}
  for(const [x,z,y]of[[0,-38,9],[0,-1,9],[0,31,6],[64,37,6]])assert.ok(Math.abs(support.heightAt(x,z)-y)<.015,`${x},${z}: old authored grade retained`);
  const oldPadHeights=[];
  for(let x=55.5;x<=62.5;x+=.5)for(let z=18;z<=26;z+=.5){const y=support.heightAt(x,z);oldPadHeights.push(y);assert.ok(Math.abs(y-world.renderedTerrainHeight(x,z))<.016,`retired east pad ${x},${z}: visible GLB and live terrain disagree`);}
  assert.ok(Math.max(...oldPadHeights)-Math.min(...oldPadHeights)>.8,'former empty pad returns to continuous varying terrain');
  assert.ok(support.heightAt(-44,47)<6.8,'active GLB is excavated below the basin floor');geometry.dispose();
});

test('new approach shoulders cannot raise the existing courtyard paving grade',()=>{
  for(const x of [-17,-16,16,17])for(const z of [10,10.2,10.5,11])assert.ok(Math.abs(world.terrainHeight(x,z)-6)<1e-7,`old court at ${x},${z} was covered by new earthworks`);
});
