import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import * as assets from '../src/herbarium-assets.js';
import {prepareHerbariumGeometry} from './helpers/herbarium-source.js';
import {createSurfaceSupport} from '../src/surface-support.js';

function vertices(group,part,visit){
  const mesh=group.children.find(m=>m.name===part.batch),p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i++)visit(new THREE.Vector3().fromBufferAttribute(p,index.getX(i)));
}
function clear(group,box){
  let hits=0;
  for(const mesh of group.children.filter(m=>m.isMesh)){
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<index.count;i+=3){const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k)));if(box.intersectsTriangle(new THREE.Triangle(...points)))hits++;}
  }
  assert.equal(hits,0,'actual plant, lamp and architecture triangles must leave the whole aisle open');
}
async function studioFixture(candidate){
  const source=(await readFile(new URL('../src/herbarium-studio.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,''),html=await readFile(new URL('../herbarium-studio.html',import.meta.url),'utf8'),nodes=new Map(),listeners={};
  const element=()=>({value:'',hidden:false,disabled:false,checked:false,dataset:{},setAttribute(){},replaceChildren(){}});
  for(const [,id]of html.matchAll(/id="([^"]+)"/g))nodes.set(id,element());
  const canvas={addEventListener:(name,fn)=>listeners[name]=fn,clientWidth:1845,clientHeight:1440},document={body:element(),hidden:false,getElementById:id=>nodes.get(id),querySelector:s=>s==='canvas'?canvas:element(),querySelectorAll:()=>[],createElement:element()},window={addEventListener:(name,fn)=>listeners[name]=fn};
  class Renderer{constructor(){this.shadowMap={};this.info={render:{}};this.capabilities={maxTextureSize:16384};this.extensions={has:()=>false};}setPixelRatio(n){this.dpr=n;}getPixelRatio(){return this.dpr;}setSize(){}render(){}dispose(){}}
  class Orbit{constructor(){this.target=new THREE.Vector3();}update(){}dispose(){}}
  const context={...assets,createConservatoryR11:()=>assets.cloneHerbariumAsset(candidate),createGrassSpecimen(){},createHerbariumCommunity(){},setShrubMaterialMode(){},getShrubMaterialMode(){},shrubNormalCapabilities:()=>({}),getShrubNormalSourceState:()=>({}),THREE:{...THREE,WebGLRenderer:Renderer,PMREMGenerator:class{fromScene(){return {texture:new THREE.Texture(),dispose(){}};}dispose(){}}},RoomEnvironment:class extends THREE.Group{dispose(){}},OrbitControls:Orbit,loadHerbariumAssets:async()=>{},document,window,location:{search:'?candidate=r11&kind=conservatory&view=interior&light=night'},devicePixelRatio:2,performance,URLSearchParams,AbortController,Blob,structuredClone,requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},setTimeout:fn=>setTimeout(fn,0),clearTimeout};
  await vm.runInNewContext(`(async()=>{${source}})()`,context,{filename:'herbarium-studio.js'});
  return {api:window.__herbariumStudio,listeners,document};
}

test('R11 fills the hall vertically with supported specimens and per-instance night lamps while preserving human access',async()=>{
  assert.equal(typeof assets.createConservatoryR11,'function','the opt-in hall refinement is missing');
  assert.equal(typeof assets.getHerbariumLighting,'function','asset lighting must expose the existing world registry contract');
  await prepareHerbariumGeometry();
  const original=assets.createConservatoryR10(),candidate=assets.createConservatoryR11(),owned=[original,candidate],report={};
  try{
    assert.deepEqual(candidate.userData.doors,original.userData.doors);
    const roots=g=>g.userData.plantRoots.map(({species,root,support})=>({species,root,support}));
    assert.deepEqual(roots(candidate).slice(0,roots(original).length),roots(original),'the full source potted collections must survive unchanged');
    const newRoots=candidate.userData.plantRoots.slice(original.userData.plantRoots.length);
    assert.equal(newRoots.length,2,'the refinement adds two tall specimens, not a field of small pots');
    const support=createSurfaceSupport(()=>-Infinity),substrate=createSurfaceSupport(()=>-Infinity),roof=createSurfaceSupport(()=>-Infinity);
    for(const g of assets.getHerbariumSupportGeometries(candidate)){support.addGeometry(g);g.dispose();}
    substrate.addGeometry(candidate.children.find(m=>m.name==='soil').geometry);
    roof.addGeometry(candidate.children.find(m=>m.name==='glass').geometry);
    const specimens=[];
    for(const root of newRoots){
      assert.ok(Math.abs(substrate.heightAt(root.root[0],root.root[2])-root.root[1])<1e-4,'each new root meets real planter substrate');
      assert.ok(Math.abs(support.heightAt(root.root[0],root.root[2]))<1e-4,'planter soil does not replace the walkable floor');
      assert.ok(candidate.userData.colliders.some(p=>p.name===`${root.assembly} floor-standing planter`));
      const parts=candidate.userData.parts.filter(p=>p.name.startsWith(root.assembly)&&p.role==='plant'),bounds=new THREE.Box3();
      assert.ok(parts.length>10,'a stem, attached fronds and blades form the specimen');
      for(const part of parts)vertices(candidate,part,p=>{bounds.expandByPoint(p);assert.ok(Number.isFinite(p.x+p.y+p.z));assert.ok(roof.heightAt(p.x,p.z)>p.y+.012,`${part.name} crosses the actual roof`);});
      assert.ok(bounds.max.y>4.7,'the new silhouette must occupy the high hall');
      assert.ok(bounds.min.y<=root.root[1]+.025,'the visible stems reach the substrate');
      specimens.push({species:root.species,root:root.root,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},parts:parts.length});
    }
    clear(candidate,new THREE.Box3(new THREE.Vector3(-1.1,.04,-3.75),new THREE.Vector3(1.1,3.6,4.51)));
    const registry=assets.getHerbariumLighting(candidate);
    assert.equal(registry.lights.length,4);assert.equal(registry.emissiveMaterials.length,1);
    for(const entry of registry.lights){
      assert.ok(entry.baseIntensity>0);assert.ok(entry.light.parent===candidate);assert.ok(entry.light.position.y>3.6);
      const lamp=candidate.userData.lamps.find(p=>p.name===entry.light.userData.herbariumLamp),mount=new THREE.Vector3(...lamp.mount);
      assert.ok(candidate.userData.parts.filter(p=>p.name.startsWith('Wall upright')).some(p=>new THREE.Box3(new THREE.Vector3(...p.bounds.min),new THREE.Vector3(...p.bounds.max)).expandByScalar(.003).containsPoint(mount)),'each lamp bracket mounts on a real upright');
      assert.ok(candidate.userData.parts.some(p=>p.name===`${lamp.name} bracket`),'visible bracket geometry is retained');
    }
    const clone=assets.cloneHerbariumAsset(candidate);owned.push(clone);const cloned=assets.getHerbariumLighting(clone);
    assert.notEqual(cloned.emissiveMaterials[0].material,registry.emissiveMaterials[0].material,'night state is local to one asset instance');
    assert.notEqual(cloned.lights[0].light,registry.lights[0].light);
    cloned.lights[0].light.intensity=0;assert.notEqual(registry.lights[0].light.intensity,0);
    let localDisposed=0,sharedDisposed=0;registry.emissiveMaterials[0].material.addEventListener('dispose',()=>localDisposed++);candidate.children.find(m=>m.isMesh).geometry.addEventListener('dispose',()=>sharedDisposed++);
    const qa=await studioFixture(candidate);assert.equal(qa.document.body.dataset.ready,'true');
    const study=assets.getHerbariumLighting(qa.api.asset);
    for(const entry of study.lights)assert.equal(entry.light.intensity,entry.baseIntensity,'initial night selection is applied after the asset arrives');
    assert.equal(study.emissiveMaterials[0].material.emissiveIntensity,study.emissiveMaterials[0].baseIntensity);
    qa.api.setLight('day');for(const entry of study.lights)assert.equal(entry.light.intensity,0);
    assert.equal(study.emissiveMaterials[0].material.emissiveIntensity,study.emissiveMaterials[0].baseIntensity*.08);
    const camera=qa.api.camera;camera.lookAt(qa.api.controls.target);camera.updateMatrixWorld(true);
    for(const point of [[-.5,0,-1],[-2.35,1.37,1.5],[-2.2,4.8,-1.65],[2.2,4.8,-1.4],[-1,7.1,-3.5]]){const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1,'the indoor view includes floor, workbench, tall plants and roof context');}
    qa.api.setView('front');assert.equal(camera.fov,39,'wide interior framing does not leak into exterior comparison views');
    qa.api.setLight('night');qa.listeners.pagehide({persisted:false});assert.equal(qa.api.asset.userData.disposed,true);
    assets.disposeHerbariumAsset(candidate);assert.equal(localDisposed,1);assert.equal(sharedDisposed,0);
    assert.ok(cloned.emissiveMaterials[0].material.emissiveIntensity>0);assets.disposeHerbariumAsset(clone);assert.equal(sharedDisposed,1);
    const box=new THREE.Box3().setFromObject(original);report.original={bounds:{min:box.min.toArray(),max:box.max.toArray()},roots:original.userData.plantRoots.length};
    report.candidate={bounds:candidate.userData.actualBounds,triangles:candidate.children.filter(m=>m.isMesh).reduce((n,m)=>n+m.geometry.index.count/3,0),meshBatches:candidate.children.filter(m=>m.isMesh).length,lights:registry.lights.length,rootedPlants:candidate.userData.plantRoots.length,specimens,interiorView:candidate.userData.studyViews.interior};
    if(process.env.HERBARIUM_R11_ASSET_REPORT)await writeFile(process.env.HERBARIUM_R11_ASSET_REPORT,JSON.stringify(report,null,2)+'\n');
  }finally{for(const group of owned)assets.disposeHerbariumAsset(group);}
});
