import * as THREE from 'three';
import {createYangquelongStudy} from './yangquelong-study.js';
import {
  prepareXieqiquStoneFishMaterialPixels,
  createStoneFishTextureOwnerFromPixels,
  createStoneFishTriplanarMaterial,
} from './xieqiqu-stone-fish-material-study.js';
export {yangquelongStudyViews} from './yangquelong-views.js';
export {prepareXieqiquStoneFishMaterialPixels as prepareYangquelongMaterialPixels};

export const yangquelongMaterialSpec=Object.freeze({
  id:'yangquelong-material-candidate-r1',historicalColourVerified:false,nativeReviewed:false,
  source:'https://ambientcg.com/view?id=Marble021',license:'CC0-1.0',
  stoneTileMetres:.5,stoneNormalStrength:.08,stoneRoughnessRange:Object.freeze([.66,.88]),
  recessNormalStrength:.06,recessRoughnessRange:Object.freeze([.88,.98]),
  stoneColour:'original Yangquelong authored base tint; original photographic map multiplied without recolouring',
  tileColour:0x596f64,tileRoughness:.38,tileToneAmplitude:.035,tileToneCellMetres:.45,
  geometryChanged:false,uvChanged:false,waterChanged:false,archiveCompatible:false,
});
const stoneNames=new Set(['yangquelong-warm-marble','yangquelong-marble-carving','yangquelong-stone-recess']);
const tileNames=new Set(['yangquelong-provisional-muted-glaze','yangquelong-provisional-glaze-edges']);
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong material candidate: '+message);};
function replaceOnce(source,token,value){fail(source.split(token).length===2,'unsupported shader token '+token);return source.replace(token,value);}
const mod=(a,b)=>a-Math.floor(a/b)*b;
function hashCell(x,y,z){let h=mod(x*73+y*151+z*199,251);h=mod(h*h*17+h*13+101,251);return h/250;}
/** CPU oracle for the deliberately small, continuous glaze-tone field.
 * This is authored colour variation, not a fabricated source texture. */
export function sampleYangquelongTileTone([x,y,z]){
  const p=[x,y,z].map(v=>v/yangquelongMaterialSpec.tileToneCellMetres),i=p.map(Math.floor);
  const f=p.map((v,k)=>{const a=v-i[k];return a*a*(3-2*a);});let n=0;
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)n+=hashCell(i[0]+x,i[1]+y,i[2]+z)*(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);
  return 1+yangquelongMaterialSpec.tileToneAmplitude*(2*n-1);
}
const tileFragment=[
'uniform float yqTileToneCellMetres;',
'uniform float yqTileToneAmplitude;',
'varying vec3 vYqMetricPosition;',
'float yqCell(vec3 p){',
'  float h=mod(dot(p,vec3(73.0,151.0,199.0)),251.0);',
'  h=mod(h*h*17.0+h*13.0+101.0,251.0);',
'  return h/250.0;',
'}',
'float yqNoise(vec3 p){',
'  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
'  return mix(mix(mix(yqCell(i),yqCell(i+vec3(1,0,0)),f.x),',
'                 mix(yqCell(i+vec3(0,1,0)),yqCell(i+vec3(1,1,0)),f.x),f.y),',
'             mix(mix(yqCell(i+vec3(0,0,1)),yqCell(i+vec3(1,0,1)),f.x),',
'                 mix(yqCell(i+vec3(0,1,1)),yqCell(i+vec3(1,1,1)),f.x),f.y),f.z);',
'}',
].join('\n');
function newFrame(){return {assetToMetric:new THREE.Matrix4(),normalToMetric:new THREE.Matrix3(),metricNormalToView:new THREE.Matrix3()};}

/** Keep the tested stone shader; replace only its per-draw frame because this
 * source has translated/rotated nested groups, unlike the baked fish meshes.
 * modelMatrix/normalMatrix are Three's per-draw uniforms. The added uniforms
 * depend only on the asset root/camera, so consecutive meshes sharing one
 * material do not require a material-uniform upload for each child transform. */
function frameMaterial(material,kind){
  const frame=newFrame(),before=material.onBeforeCompile,key=material.customProgramCacheKey;
  const previousKey=key.call(material);
  material.onBeforeCompile=function(shader,renderer){
    before.call(this,shader,renderer);
    if(kind==='stone'){
      shader.vertexShader=replaceOnce(shader.vertexShader,'fishAssetToMetric * vec4( transformed, 1.0 )','fishAssetToMetric * modelMatrix * vec4( transformed, 1.0 )');
      shader.vertexShader=replaceOnce(shader.vertexShader,'fishNormalToMetric * objectNormal','fishNormalToMetric * normalMatrix * objectNormal');
      shader.uniforms.fishAssetToMetric.value=frame.assetToMetric;
      shader.uniforms.fishNormalToMetric.value=frame.normalToMetric;
      shader.uniforms.fishMetricNormalToView.value=frame.metricNormalToView;
    }else{
      Object.assign(shader.uniforms,{yqAssetToMetric:{value:frame.assetToMetric},yqTileToneCellMetres:{value:yangquelongMaterialSpec.tileToneCellMetres},yqTileToneAmplitude:{value:yangquelongMaterialSpec.tileToneAmplitude}});
      shader.vertexShader=replaceOnce(shader.vertexShader,'#include <common>','#include <common>\nuniform mat4 yqAssetToMetric;\nvarying vec3 vYqMetricPosition;');
      shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvYqMetricPosition=(yqAssetToMetric*modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <common>','#include <common>\n'+tileFragment);
      shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb *= 1.0+yqTileToneAmplitude*(2.0*yqNoise(vYqMetricPosition/yqTileToneCellMetres)-1.0);');
    }
  };
  material.customProgramCacheKey=()=>previousKey+'|'+yangquelongMaterialSpec.id+':'+kind+':nested-metric-frame';
  return frame;
}

/** All source meshes/geometries and water textures remain borrowed by complete
 * hierarchy views. Only the three stone materials and one shared glaze material
 * are private. Source-owner injection is for exact before/after verification;
 * the ordinary entry invokes the complete original factory once. */
export function createYangquelongMaterialCandidate({pixels,sourceOwner,signal,createSource=createYangquelongStudy}={}){
  signal?.throwIfAborted();
  const ownsSource=!sourceOwner,ownedMaterials=[],frames=new Map(),listeners=[];
  let textureOwner,source=sourceOwner,group,disposed=false,cleanupError=null,triangles=0,meshCount=0;
  const replacements=new Map(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  const rigid=new THREE.Matrix4(),inverseRigid=new THREE.Matrix4(),normalToWorld=new THREE.Matrix4(),viewFrame=new THREE.Matrix4();
  const diagnostics={id:yangquelongMaterialSpec.id,spec:yangquelongMaterialSpec,visualAcceptance:false,integrationAcceptance:false,
    originalSource:'createYangquelongStudy; unchanged full hierarchy',sourceOwnerBorrowed:!ownsSource,
    sourceGeometryObjectsShared:true,sourceArrayChanges:0,sourceMaterialChanges:0,ownedTextureImages:3,fullResolutionVerified:false};
  function updateFrame(node,camera,frame){
    group.updateWorldMatrix(true,false);node.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
    fail(group.matrixWorld.elements.every(Number.isFinite)&&group.matrixWorld.determinant()>0&&node.matrixWorld.determinant()>0,'invalid positive source frame');
    group.matrixWorld.decompose(position,rotation,scale);rotation.normalize();
    normalToWorld.makeRotationFromQuaternion(rotation);rigid.copy(normalToWorld).setPosition(position);inverseRigid.copy(rigid).invert();
    frame.assetToMetric.copy(inverseRigid);
    viewFrame.multiplyMatrices(camera.matrixWorldInverse,normalToWorld);frame.metricNormalToView.getNormalMatrix(viewFrame);
    frame.normalToMetric.copy(frame.metricNormalToView).invert();
  }
  function dispose(){
    if(disposed)return;disposed=true;const errors=[],run=fn=>{try{fn();}catch(e){errors.push(e);}};
    signal?.removeEventListener('abort',cancel);
    for(const resource of listeners)run(()=>resource.removeEventListener('dispose',cancel));listeners.length=0;
    run(()=>group?.removeFromParent());run(()=>group?.clear());
    for(const material of ownedMaterials)run(()=>material.dispose());ownedMaterials.length=0;
    if(ownsSource)run(()=>source?.dispose());
    run(()=>textureOwner?.dispose());frames.clear();replacements.clear();
    if(errors.length){cleanupError=new AggregateError(errors,'Yangquelong material candidate cleanup failed');throw cleanupError;}
  }
  function cancel(){try{dispose();}catch(error){cleanupError=error;}}
  function replaceMaterial(original){
    if(replacements.has(original))return replacements.get(original);
    let material,kind;
    if(stoneNames.has(original.name)){
      kind='stone';const recess=original.name==='yangquelong-stone-recess';
      material=createStoneFishTriplanarMaterial({maps:textureOwner.maps,color:original.color,
        tileMetres:yangquelongMaterialSpec.stoneTileMetres,normalStrength:recess?yangquelongMaterialSpec.recessNormalStrength:yangquelongMaterialSpec.stoneNormalStrength,
        roughnessRange:recess?yangquelongMaterialSpec.recessRoughnessRange:yangquelongMaterialSpec.stoneRoughnessRange});
    }else if(tileNames.has(original.name)){
      // Both old %7 material populations use the SAME material object and
      // response. The gentle spatial field is independent of that old mask.
      const previous=[...replacements].find(([m])=>tileNames.has(m.name));
      if(previous){replacements.set(original,previous[1]);return previous[1];}
      kind='tile';material=original.clone();material.map=null;material.roughnessMap=null;
      material.color.setHex(yangquelongMaterialSpec.tileColour);material.roughness=yangquelongMaterialSpec.tileRoughness;
    }else return original;
    ownedMaterials.push(material);
    material.name=yangquelongMaterialSpec.id+'-'+(kind==='tile'?'continuous-glaze':original.name);
    material.userData={...original.userData,...material.userData,materialCandidate:yangquelongMaterialSpec.id,
      historicalColourVerified:false,nativeReviewed:false,sourceMaterial:kind==='tile'?'both original glaze populations':original.name};
    frames.set(material,frameMaterial(material,kind));replacements.set(original,material);return material;
  }
  function cloneTree(original){
    fail(!original.isInstancedMesh&&!original.isSkinnedMesh,'unsupported deformed source');
    const node=original.clone(false);
    if(original.isMesh){
      fail(!Array.isArray(original.material)&&original.geometry?.attributes.position&&!original.morphTargetInfluences&&!original.geometry.morphAttributes.position,'unsupported mesh');
      for(const key of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'])fail(original[key]===THREE.Mesh.prototype[key],'unreviewed callback '+key);
      fail(!original.customDepthMaterial&&!original.customDistanceMaterial,'unreviewed shadow material');
      node.material=replaceMaterial(original.material);
      const frame=frames.get(node.material);
      if(frame)node.onBeforeRender=function(renderer,scene,camera,geometry,drawMaterial){if(!disposed&&drawMaterial===this.material)updateFrame(this,camera,frame);};
      triangles+=(original.geometry.index?.count??original.geometry.attributes.position.count)/3;meshCount++;
    }
    for(const child of original.children)node.add(cloneTree(child));
    return node;
  }
  try{
    textureOwner=createStoneFishTextureOwnerFromPixels(pixels);
    source??=createSource();
    fail(source?.group?.userData?.assetId==='yangquelong'&&typeof source.dispose==='function'&&source.group.children.length>0,'complete Yangquelong owner required');
    source.group.traverse(node=>{if(node.isMesh){
      fail(node.material?.onBeforeCompile===THREE.Material.prototype.onBeforeCompile&&node.material?.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey,'unreviewed source material hooks');
    }});
    group=cloneTree(source.group);group.userData={...group.userData,materialCandidate:yangquelongMaterialSpec.id,visualAcceptance:false,integrationAcceptance:false};
    fail([...replacements.keys()].filter(m=>stoneNames.has(m.name)).length===3&&[...replacements.keys()].filter(m=>tileNames.has(m.name)).length===2,'expected original stone/glaze populations');
    group.updateWorldMatrix(true,true);
    Object.assign(diagnostics,{triangles,meshCount,sourceDiagnostics:source.diagnostics,fullResolutionVerified:true,
      materialReplacements:[...replacements].map(([a,b])=>({source:a.name,candidate:b.name})),
      sharedTexturePixels:Object.fromEntries(Object.entries(textureOwner.maps).map(([c,t])=>[c,{encodedSha256:t.userData.encodedSha256,decodedSha256:t.userData.decodedSha256,width:t.image.width,height:t.image.height,colorSpace:t.colorSpace}]))});
    const resources=new Set();source.group.traverse(n=>{if(n.isMesh){resources.add(n.geometry);resources.add(n.material);}});
    for(const resource of resources){resource.addEventListener('dispose',cancel);listeners.push(resource);}
    signal?.addEventListener('abort',cancel,{once:true});signal?.throwIfAborted();
    return {group,diagnostics,sourceOwner:source,textureOwner,materials:ownedMaterials,
      update(time){fail(!disposed,'disposed');source.update?.(time);},dispose,
      whenIdle(){return cleanupError?Promise.reject(cleanupError):Promise.resolve();},
      get disposed(){return disposed;},get cleanupError(){return cleanupError;}};
  }catch(error){
    try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Yangquelong material candidate construction failed',{cause:error});}
    throw error;
  }
}
