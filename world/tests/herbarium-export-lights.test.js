import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as packing from '../../docs/art/living-v8/herbarium/lossless-pack.mjs';

const exporterURL=new URL('../scripts/export-herbarium-assets.mjs',import.meta.url);
const helperURL=new URL('../scripts/herbarium-export-contract.mjs',import.meta.url);
function reader(t){
  const previous=globalThis.FileReader;
  globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onload?.();this.onloadend?.();});}};
  t.after(()=>{if(previous===undefined)delete globalThis.FileReader;else globalThis.FileReader=previous;});
}
function specimen(){
  const group=new THREE.Group();group.name='tiny herbarium';group.position.set(3,2,-4);group.rotation.y=.37;group.scale.set(1.2,1,.8);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geometry.setIndex([0,1,2]);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(.4,.6,.2),emissive:new THREE.Color(1,.4,.1),emissiveIntensity:3.2});
  for(let i=0;i<2;i++){const mesh=new THREE.Mesh(geometry.clone(),material);mesh.name='batch-'+i;mesh.position.x=i*2;group.add(mesh);}
  const params=[
    {position:[-2.8,4.08,-3.53],color:[1,.4,.1],intensity:45,range:10.5},
    {position:[2.8,4.08,-3.53],color:[.2,.7,.3],intensity:27,range:7},
    {position:[-2.8,4.08,3.53],color:[.3,.2,.8],intensity:60,range:12},
    {position:[2.8,4.08,3.53],color:[.5,.6,.7],intensity:31,range:4.5},
  ];
  group.userData.lamps=[];group.userData.plantRoots=[];group.userData.supportMeshes=[];group.userData.herbariumFixtureRoot=true;
  params.forEach((p,i)=>{const light=new THREE.PointLight(new THREE.Color(...p.color),p.intensity,p.range,2);light.name='Lamp '+i;light.position.fromArray(p.position);light.userData={herbariumLamp:'lamp-'+i,authoredIntensity:p.intensity};group.add(light);group.userData.lamps.push({name:light.userData.herbariumLamp,position:p.position,baseIntensity:p.intensity,distance:p.range});});
  const hidden=new THREE.Group();hidden.visible=false;hidden.add(new THREE.Mesh(geometry.clone(),material),new THREE.PointLight());group.add(hidden);
  group.updateMatrixWorld(true);
  const lights=group.children.filter(o=>o.isLight).map(o=>({tag:o.userData.herbariumLamp,matrix:o.matrixWorld.toArray(),color:o.color.toArray(),intensity:o.intensity,range:o.distance,decay:o.decay}));
  const destroy=()=>{group.traverse(o=>o.geometry?.dispose());geometry.dispose();material.dispose();};
  return {group,lights,destroy};
}
const near=(a,b,label)=>{assert.equal(a.length,b.length,label);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,`${label}[${i}]: ${v} != ${b[i]}`));};
async function runAssetLoop(group,packLosslessly){
  // Execute the real per-asset export body while replacing only source loading,
  // file writes and the asset owner. No garden constructor or texture is loaded.
  const source=await readFile(exporterURL,'utf8'),start=source.indexOf('for(const[kind,make]of Object.entries(factories))'),end=source.indexOf('const python=',start);
  assert.ok(start>=0&&end>start,'actual export loop is available');
  let helpers={};try{helpers=await import(helperURL);}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
  const files=new Map(),manifest={assets:{}},state={disposed:0},out=new URL('file:///unused-herbarium-output/'),evidence=new URL('file:///unused-herbarium-evidence/');
  const context={...helpers,factories:{tiny:()=>group},GLTFExporter,packLosslessly,Buffer,createHash,URL,out,evidence,manifest,
    writeFile:async(path,bytes)=>files.set(String(path),bytes),console:{log(){}},disposeHerbariumAsset:()=>state.disposed++};
  const run=new Function('context',`with(context){return(async()=>{${source.slice(start,end)}})();}`);
  try{await run(context);return {files,manifest,state};}catch(error){error.exportState=state;throw error;}
}

test('actual export entry retains point lights while validating and counting only visible mesh batches',async t=>{
  reader(t);const fixture=specimen();t.after(fixture.destroy);const pack=await packing.createLosslessPacker([]);let raw,packed;
  const result=await runAssetLoop(fixture.group,async input=>{raw=input;packed=await pack(input);return packed;});
  assert.equal(result.state.disposed,1);assert.equal(result.manifest.assets.tiny.batches,2);assert.equal(result.manifest.assets.tiny.triangles,2);assert.equal(result.manifest.assets.tiny.lights,4);
  assert.equal(packed.verification.runtimeAttributeBytesVerified,true);assert.equal(packed.verification.runtimeLightsVerified,true);
  assert.equal(packed.verification.lights.length,4);
  for(const bytes of [raw,packed.authoringBytes,packed.bytes]){
    const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    gltf.scene.updateMatrixWorld(true);const lights=[],meshes=[];gltf.scene.traverse(o=>{if(o.isLight)lights.push(o);if(o.isMesh)meshes.push(o);});
    assert.equal(meshes.length,2);assert.equal(lights.length,4);
    for(const expected of fixture.lights){const light=lights.find(o=>o.userData.herbariumLamp===expected.tag);assert.ok(light?.isPointLight);assert.equal(light.parent.userData.herbariumFixtureRoot,true);near(light.matrixWorld.toArray(),expected.matrix,'world transform');near(light.color.toArray(),expected.color,'linear colour');assert.equal(light.intensity,expected.intensity);assert.equal(light.distance,expected.range);assert.equal(light.decay,expected.decay);}
    for(const mesh of meshes){const p=mesh.geometry.attributes.position;assert.deepEqual(Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]).flat(),[0,0,0,1,0,0,0,1,0]);assert.equal(mesh.geometry.index.count,3);assert.equal(mesh.material.emissiveIntensity,3.2);}
    gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
});

test('per-asset export failure releases the constructed asset without publishing successful output',async t=>{
  reader(t);const fixture=specimen();t.after(fixture.destroy);
  await assert.rejects(runAssetLoop(fixture.group,async()=>{throw new Error('packing failed');}),error=>{assert.equal(error.message,'packing failed');assert.equal(error.exportState.disposed,1);return true;});
});

test('packing light identity rejects dropped nodes and changed transform, colour, intensity or range',async t=>{
  reader(t);const fixture=specimen();t.after(fixture.destroy);
  const raw=new Uint8Array(await new GLTFExporter().parseAsync(fixture.group,{binary:true,onlyVisible:true}));
  assert.equal(typeof packing.punctualLightIdentity,'function','packer exposes the identity used by its real round-trip check');
  assert.equal(typeof packing.assertPunctualLightsUnchanged,'function');
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),original=await io.readBinary(raw),expected=packing.punctualLightIdentity(original);
  for(const mutate of [
    node=>node.dispose(),
    node=>node.setTranslation([5,8,-2]),
    node=>node.getExtension('KHR_lights_punctual').setColor([.1,.2,.3]),
    node=>node.getExtension('KHR_lights_punctual').setIntensity(999),
    node=>node.getExtension('KHR_lights_punctual').setRange(1),
    node=>node.setExtras({...node.getExtras(),herbariumLamp:'wrong-tag'}),
  ]){
    const changed=await io.readBinary(raw),node=changed.getRoot().listNodes().find(n=>n.getExtension('KHR_lights_punctual'));mutate(node);
    assert.throws(()=>packing.assertPunctualLightsUnchanged(expected,packing.punctualLightIdentity(changed),'tiny corruption'),/light/i);
  }
});

test('real packer refuses changed light bytes at both editable and final serialization boundaries',async t=>{
  reader(t);const fixture=specimen();t.after(fixture.destroy);
  const raw=Buffer.from(await new GLTFExporter().parseAsync(fixture.group,{binary:true,onlyVisible:true}));
  const {NodeIO:Writer}=createRequire(import.meta.url)('@gltf-transform/core'),write=Writer.prototype.writeBinary;
  function changeRange(bytes){
    const input=Buffer.from(bytes),jsonLength=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+jsonLength));
    json.extensions.KHR_lights_punctual.lights[0].range=999;
    const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
    const suffix=input.subarray(20+jsonLength),output=Buffer.alloc(20+padded.length+suffix.length);input.copy(output,0,0,20);
    output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);padded.copy(output,20);suffix.copy(output,20+padded.length);
    return output;
  }
  for(const boundary of [1,2]){
    let writes=0;
    Writer.prototype.writeBinary=async function(document){const bytes=await write.call(this,document);return ++writes===boundary?changeRange(bytes):bytes;};
    try{const pack=await packing.createLosslessPacker([]);await assert.rejects(pack(raw),/changed punctual light/);}
    finally{Writer.prototype.writeBinary=write;}
  }
});

test('editable point-light policy restores finite cutoff and audits SPEC energy without masking import errors',async()=>{
  const helper=fileURLToPath(new URL('../../docs/art/living-v8/herbarium/editable-lighting.py',import.meta.url));
  const python=`import json, math, runpy
from types import SimpleNamespace
api=runpy.run_path(${JSON.stringify(helper)})
record={'tag':'lamp-a','type':'point','color':[1,.4,.1],'intensity':45,'range':10.5,'matrix':[1,0,0,0,0,1,0,0,0,0,1,0,-2.8,4.08,3.53,1],'worldMatrix':[1,0,0,0,0,1,0,0,0,0,1,0,3,6,-5,1]}
metadata={'lamps':[{'name':'lamp-a','position':[-2.8,4.08,3.53],'baseIntensity':45,'distance':10.5}]}
class Object(dict): pass
def scene():
    obj=Object(herbariumLamp='lamp-a');obj.type='LIGHT';obj.name='Unstable display name'
    obj.data=SimpleNamespace(type='POINT',color=[1,.4,.1],energy=45/683*4*math.pi,use_custom_distance=False,cutoff_distance=40)
    obj.matrix_world=SimpleNamespace(translation=[3,5,6])
    return SimpleNamespace(objects=[obj])
current=scene()
api['configure_editable_lights'](current,[record],metadata)
assert current.objects[0].data.use_custom_distance is True
assert current.objects[0].data.cutoff_distance == 10.5
assert abs(current.objects[0].data.energy - .8279453552652456) < 1e-12
assert json.loads(current.objects[0]['gltf_punctual_source']) == record
assert len(api['audit_editable_lights'](current,[record],metadata)) == 1
for field,value in [('energy',45),('color',[0,0,0]),('cutoff_distance',40),('type','SUN')]:
    candidate=scene();api['configure_editable_lights'](candidate,[record],metadata);setattr(candidate.objects[0].data,field,value)
    try: api['audit_editable_lights'](candidate,[record],metadata)
    except (AssertionError,ValueError): pass
    else: raise AssertionError('audit accepted wrong '+field)
for change in ['missing','duplicate','moved','wrong-energy','metadata-range']:
    candidate=scene();authored=json.loads(json.dumps(metadata))
    if change=='missing': candidate.objects=[]
    elif change=='duplicate': candidate.objects.append(candidate.objects[0])
    elif change=='moved': candidate.objects[0].matrix_world.translation=[0,0,0]
    elif change=='wrong-energy': candidate.objects[0].data.energy=45
    else: authored['lamps'][0]['distance']=99
    try: api['configure_editable_lights'](candidate,[record],authored)
    except (AssertionError,ValueError): pass
    else: raise AssertionError('accepted '+change)
print('EDITABLE_LIGHT_POLICY_PASS')
`;
  const result=spawnSync('python3',['-c',python],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/EDITABLE_LIGHT_POLICY_PASS/);
});
