import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {loadHerbariumBuilder} from './helpers/herbarium-builder-module.js';

const assets=await loadHerbariumBuilder();
const district=await readFile(new URL('../src/herbarium-district.js',import.meta.url),'utf8');
const addBody=district.match(/const add=\(asset,site\)=>\{([\s\S]*?)\n  \};/)[1];
const add=new Function('asset','site','context',`with(context){${addBody}}`);
const game=await readFile(new URL('../src/game.js',import.meta.url),'utf8');
const updateBody=game.slice(game.indexOf('    for (const { material, baseIntensity } of lighting.emissiveMaterials)'),game.indexOf('    for (const { material, uniform, baseValue } of lighting.nightMaterials)'));
const update=new Function('lighting','environment',updateBody);
const site={id:'conservatory',kind:'conservatory',x:48,floor:6.7,z:29,rotation:Math.PI/2};
function place(asset,kind=site.kind){
  const context={...assets,group:new THREE.Group(),instances:[],colliders:[],supportSurfaces:[],collisionBox(){throw new Error('fixture has no colliders');}};
  add(asset,{...site,kind},context);return context;
}
function fixture(){
  const builder=new assets.Builder('tiny hall lamps',[8,8,5]);
  const map=new THREE.DataTexture(new Uint8Array(16).fill(255),2,2);
  const opal=new THREE.MeshStandardMaterial({name:'Herbarium warm opal lamp globe',color:'#f2e6ce',map,roughness:.42,emissive:'#ffbd69',emissiveIntensity:3.2,userData:{herbariumOwnedMaterial:true,herbariumNightEmission:true,authoredEmissiveIntensity:3.2}});
  builder.m={...builder.m,lampOpal:opal};
  const triangle=new THREE.BufferGeometry();triangle.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.1,0,0,0,.1,0],3));triangle.computeVertexNormals();
  for(const x of[-2.8,2.8])for(const side of[-1,1])builder.add(triangle,'lampOpal',`Hall lamp ${x}/${side} opal globe`,new THREE.Vector3(x,4.08,side*3.53));
  triangle.dispose();const group=builder.finish();
  for(const x of[-2.8,2.8])for(const side of[-1,1]){
    const light=new THREE.PointLight('#ffc57c',45,10.5,2);light.position.set(x,4.08,side*3.53);light.userData={herbariumLamp:`Hall lamp ${x}/${side}`,authoredIntensity:45};group.add(light);
  }
  return {group,opal,map};
}
const lightState=group=>assets.getHerbariumLighting(group).lights.map(({light,baseIntensity})=>({position:light.position.toArray(),color:light.color.toArray(),intensity:light.intensity,baseIntensity,distance:light.distance,decay:light.decay,castShadow:light.castShadow}));
const geometryBytes=group=>Buffer.from(group.children[0].geometry.attributes.position.array.buffer).toString('hex');

test('real site placement lowers only the private opal baseline and the actual night update preserves all four light powers',()=>{
  const {group:source,opal,map}=fixture(),placed=assets.cloneHerbariumAsset(source),other=assets.cloneHerbariumAsset(source),before=lightState(placed),bytes=geometryBytes(placed);
  try{
    const material=placed.children[0].material,geometry=placed.children[0].geometry,parts=JSON.stringify(placed.children[0].userData.parts),color=material.color.toArray(),emissive=material.emissive.toArray();
    place(placed);const registry=assets.getHerbariumLighting(placed),entry=registry.emissiveMaterials[0];
    assert.equal(registry.emissiveMaterials.length,1);assert.equal(registry.lights.length,4);
    assert.ok(entry.baseIntensity>0&&entry.baseIntensity<opal.emissiveIntensity,'site opal radiance must be reduced without switching the lamps off');
    assert.equal(material.emissiveIntensity,entry.baseIntensity);assert.equal(material.userData.authoredEmissiveIntensity,entry.baseIntensity);
    assert.deepEqual(lightState(placed),before,'no intensity, range, decay, colour or local lamp transform changes');
    assert.equal(placed.children[0].material,material,'already-owned material needs no extra clone');
    assert.equal(placed.children[0].geometry,geometry);assert.equal(geometryBytes(placed),bytes);assert.equal(JSON.stringify(placed.children[0].userData.parts),parts);
    assert.equal(material.map,map);assert.equal(material.roughness,.42);assert.deepEqual(material.color.toArray(),color);assert.deepEqual(material.emissive.toArray(),emissive);
    assert.equal(opal.emissiveIntensity,3.2);assert.equal(opal.userData.authoredEmissiveIntensity,3.2);assert.equal(other.children[0].material.emissiveIntensity,3.2);
    const luminance=(material.emissive.r*.2126+material.emissive.g*.7152+material.emissive.b*.0722)*entry.baseIntensity;
    assert.ok(luminance<1.35,'opal emission alone no longer crosses the existing world bloom threshold');
    for(const night of[0,1,.35,1]){
      update.call({accentLights:[]},registry,{night});
      assert.equal(material.emissiveIntensity,entry.baseIntensity*(.08+.92*night),'actual Game update keeps the placed baseline');
      for(const {light}of registry.lights)assert.equal(light.intensity,45*night,'actual illumination keeps its original night response');
    }
  }finally{assets.disposeHerbariumAsset(placed);assets.disposeHerbariumAsset(other);assets.disposeHerbariumAsset(source);map.dispose();}
});

test('site material ownership excludes shared/other-site emission and releases private materials once',()=>{
  const {group:source,opal,map}=fixture(),placed=assets.cloneHerbariumAsset(source),other=assets.cloneHerbariumAsset(source);
  let privateDisposed=0,sourceDisposed=0,geometryDisposed=0,textureDisposed=0;
  placed.children[0].material.addEventListener('dispose',()=>privateDisposed++);opal.addEventListener('dispose',()=>sourceDisposed++);source.children[0].geometry.addEventListener('dispose',()=>geometryDisposed++);map.addEventListener('dispose',()=>textureDisposed++);
  try{
    place(other,'water');assert.equal(other.children[0].material.emissiveIntensity,3.2,'the site finish is conservatory-only');
    other.children[0].material.userData.herbariumOwnedMaterial=false;place(other);assert.equal(other.children[0].material.emissiveIntensity,3.2,'a shared material is never mutated');
    place(placed);assets.disposeHerbariumAsset(placed);assets.disposeHerbariumAsset(placed);
    assert.equal(privateDisposed,1);assert.equal(sourceDisposed,0);assert.equal(geometryDisposed,0);assert.equal(textureDisposed,0);
    assert.equal(opal.emissiveIntensity,3.2);assert.equal(other.children[0].material.emissiveIntensity,3.2);
    assets.disposeHerbariumAsset(other);assets.disposeHerbariumAsset(source);
    assert.equal(sourceDisposed,1);assert.equal(geometryDisposed,1);assert.equal(textureDisposed,0,'shared map remains owned by the source loader');
  }finally{assets.disposeHerbariumAsset(placed);assets.disposeHerbariumAsset(other);assets.disposeHerbariumAsset(source);map.dispose();}
});
