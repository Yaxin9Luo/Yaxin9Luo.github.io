import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createGardenWater} from '../src/yuanmingyuan/garden-water.js';
import {projectedOverviewError} from '../src/yuanmingyuan/asset-overview.js';

// Production metadata only. No full GLB, factory, canvas or WebGL context.
const manifest=JSON.parse(await readFile(new URL('../public/assets/yuanmingyuan-distance/zhengjuesi-distance/202a091fca7d4eac-gzip-bin-v1/manifest.json',import.meta.url))),report=manifest.distance.report;
const bounds=report.boundsArchiveWorld,error=report.maximumErrorArchiveWorld,placement=new THREE.Matrix4().makeTranslation(467,4,769.2);
const box=new THREE.Box3(new THREE.Vector3(...bounds.min),new THREE.Vector3(...bounds.max));
const target=box.getCenter(new THREE.Vector3()).applyMatrix4(placement);target.y=8.85;

function cameraAt({metres=600,height=40,bearing=0,orthographic=false,offset=false}={}){
  const camera=orthographic?new THREE.OrthographicCamera(-180,180,150,-150,5,22000):new THREE.PerspectiveCamera(40,3200/2200,5,22000);
  if(offset){camera.zoom=1.3;camera.setViewOffset(3200,2200,130,70,2700,2000);camera.updateProjectionMatrix();}
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(bearing)*metres,height-5,Math.cos(bearing)*metres));camera.lookAt(target);camera.updateMatrixWorld();return camera;
}

function reflectors(t){
  const surfaces=[2,3.7].map(worldY=>({geometry:new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2),worldY})),coast=[[-20,-20],[20,-20],[20,20],[-20,20]];
  const water=createGardenWater({terrain:{waterSurfaces:surfaces,coastPolygon:coast},layout:{exhibition:{seaY:0,coast:{polygon:coast}}}}),scene=new THREE.Scene();scene.add(water.group);scene.updateMatrixWorld();
  let activeTarget=null,captured=null,draws=0,disposedTargets=0;
  for(const sheet of water.sheets)sheet.getRenderTarget().addEventListener('dispose',()=>disposedTargets++);
  const renderer={xr:{enabled:false},shadowMap:{autoUpdate:false},autoClear:true,state:{buffers:{depth:{setMask(){}}},viewport(){}},getRenderTarget:()=>activeTarget,setRenderTarget(value){activeTarget=value;},getCurrentViewport:v=>v.set(0,0,3200,2200),render(renderScene,camera){draws++;captured=camera.clone();}};
  const sample={lightDirection:new THREE.Vector3(1,1,1).normalize(),key:new THREE.Color(0xffeedd),keyIntensity:3,night:0,water:new THREE.Color(0x548d84)};
  t.after(()=>{water.dispose();for(const surface of surfaces)surface.geometry.dispose();assert.equal(disposedTargets,3);assert.equal(water.snapshot().disposed,true);});
  return {water,get draws(){return draws;},capture(camera){water.update(12,sample,camera);return water.sheets.map(sheet=>{captured=null;sheet.onBeforeRender(renderer,scene,camera);assert(captured,'stock Reflector reached its nested render');return {camera:captured,planeY:sheet.position.y,width:sheet.getRenderTarget().width,height:sheet.getRenderTarget().height};});}};
}

const evaluate=(camera,extra={})=>projectedOverviewError({camera,bounds,error,placementMatrix:placement,physicalWidth:2048,physicalHeight:2048,...extra});
const clipPoint=(point,camera,transform=placement)=>new THREE.Vector4(...point.toArray(),1).applyMatrix4(transform).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
const retained=point=>point.w>0&&point.z>=-point.w&&point.z<=point.w;

test('actual GardenWater perspective and orthographic reflection matrices retain the same XY error equation and certify all three lake heights',t=>{
  const f=reflectors(t);
  for(const spec of [{},{metres:500},{bearing:.58,height:90},{height:1.7},{orthographic:true}]){
    const main=cameraAt(spec);
    for(const reflection of f.capture(main)){
      const camera=reflection.camera,changed=camera.projectionMatrix.elements.flatMap((value,i)=>value===main.projectionMatrix.elements[i]?[]:[i]);
      assert(changed.length>0);assert(changed.every(i=>[2,6,10,14].includes(i)));assert.equal(reflection.width,2048);assert.equal(reflection.height,2048);
      const standard=camera.clone();standard.projectionMatrix.copy(main.projectionMatrix);
      const actual=evaluate(camera),baseline=evaluate(standard);
      assert.equal(actual.projectedErrorPhysicalPixels,baseline.projectedErrorPhysicalPixels,'changing only clip-z cannot change the XY bound');
      assert.equal(actual.clipping.certified,true);assert.equal(actual.clipping.depthConvention,'webgl-forward');assert(actual.clipping.planes.every(p=>p.minimumPairMarginArchiveUnits>0));
      if(!spec.orthographic)assert(actual.clipping.planes[0].minimumPairMarginArchiveUnits>.1,'actual Zheng foundations clear the highest water plane including geometry error');
      assert.equal(actual.eligible,baseline.eligible);assert.equal(actual.pixelBudget,.5);
    }
  }
  assert.equal(f.draws,15);
});

test('real oblique, view-offset and zoom projections bound sampled point displacement in physical pixels, including sheared placements',t=>{
  const f=reflectors(t);let seed=94513;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(const orthographic of [false,true]){
    const main=cameraAt({orthographic,offset:true,bearing:.58,height:90}),camera=f.capture(main)[1].camera;
    const transform=placement.clone().multiply(new THREE.Matrix4().makeShear(0,.2,.1,0,.2,0)).multiply(new THREE.Matrix4().makeScale(-1.1,1.05,.9)),result=evaluate(camera,{placementMatrix:transform});
    assert.equal(result.clipping.certified,true);
    const original=camera.clone();original.projectionMatrix.copy(main.projectionMatrix);
    for(let i=0;i<250;i++){
      const a=new THREE.Vector3(...bounds.min).lerp(new THREE.Vector3(...bounds.max),random());a.x=THREE.MathUtils.lerp(bounds.min[0],bounds.max[0],random());a.z=THREE.MathUtils.lerp(bounds.min[2],bounds.max[2],random());
      const delta=new THREE.Vector3(random()-.5,random()-.5,random()-.5).normalize().multiplyScalar(error*random()),b=a.clone().add(delta);
      const ca=clipPoint(a,camera,transform),cb=clipPoint(b,camera,transform),uncut=clipPoint(a,original,transform);
      assert(retained(ca)&&retained(cb));assert(Math.abs(ca.x/ca.w-uncut.x/uncut.w)<1e-12);assert(Math.abs(ca.y/ca.w-uncut.y/uncut.w)<1e-12);
      const pixels=Math.hypot((ca.x/ca.w-cb.x/cb.w)*1024,(ca.y/ca.w-cb.y/cb.w)*1024);
      assert(pixels<=result.projectedErrorPhysicalPixels+1e-9,`${pixels} exceeds ${result.projectedErrorPhysicalPixels}`);
    }
  }
});

test('actual reflection clipping rejects a source or its error neighbourhood crossing the water plane despite a small pixel error',t=>{
  const f=reflectors(t),camera=f.capture(cameraAt())[1].camera,lowPlacement=placement.clone();lowPlacement.elements[13]=3.8;
  const result=evaluate(camera,{placementMatrix:lowPlacement});assert(result.projectedErrorPhysicalPixels<.5);assert.equal(result.eligible,false);assert.equal(result.projectionReason,'clip-boundary-uncertified');assert.equal(result.clipping.certified,false);
  const near=result.clipping.planes[0];assert(near.minimumSourceDistanceArchiveUnits<0);assert(near.maximumSourceDistanceArchiveUnits>0);
  assert.equal(retained(clipPoint(new THREE.Vector3(0,bounds.min[1],bounds.max[2]),camera,lowPlacement)),false);
  assert.equal(retained(clipPoint(new THREE.Vector3(0,bounds.max[1],bounds.max[2]),camera,lowPlacement)),true);
  // Lift until the full source barely clears the clip plane, while a permitted
  // counterpart still crosses. A source-only corner check would accept this.
  lowPlacement.elements[13]+=-near.minimumSourceDistanceArchiveUnits+error/2;
  const neighbourhood=evaluate(camera,{placementMatrix:lowPlacement});assert(neighbourhood.clipping.planes[0].minimumSourceDistanceArchiveUnits>0);assert.equal(neighbourhood.clipping.certified,false);assert.equal(neighbourhood.eligible,false);
});

test('actual oblique far planes, conventional near/far planes and an unbounded far plane are checked using the supplied matrix',()=>{
  const camera=new THREE.PerspectiveCamera(40,1,1,100);camera.updateMatrixWorld();
  const tiny={bounds:{min:[-.1,-.1,-.1],max:[.1,.1,.1]},error:.001,physicalWidth:1000,physicalHeight:1000};
  let result=evaluate(camera,{...tiny,placementMatrix:new THREE.Matrix4().makeTranslation(0,0,-100)});assert.equal(result.eligible,false);assert(result.projectedErrorPhysicalPixels<.5);assert(result.clipping.planes[1].minimumPairMarginArchiveUnits<0);
  result=evaluate(camera,{...tiny,placementMatrix:new THREE.Matrix4().makeTranslation(0,0,-1)});assert.equal(result.eligible,false);assert.equal(result.clipping.certified,false);
  camera.projectionMatrix.elements[2]=.3;camera.projectionMatrix.elements[6]=-.15;camera.projectionMatrix.elements[10]=-1.1;camera.projectionMatrix.elements[14]=-2;
  result=evaluate(camera,{...tiny,placementMatrix:new THREE.Matrix4().makeTranslation(0,0,-20)});assert.equal(result.eligible,false);assert.equal(result.projectionReason,'clip-boundary-uncertified');assert(result.clipping.planes[1].minimumPairMarginArchiveUnits<0);
  camera.projectionMatrix.elements[2]=0;camera.projectionMatrix.elements[6]=0;camera.projectionMatrix.elements[10]=-1;camera.far=Infinity;
  result=evaluate(camera,{...tiny,placementMatrix:new THREE.Matrix4().makeTranslation(0,0,-50)});assert.equal(result.eligible,true);assert.equal(result.clipping.planes[1].unbounded,true);
});

test('XY cross terms, depth-dependent offsets and W changes remain strictly rejected; actual focal length and constant offsets are accounted for',()=>{
  for(const orthographic of [false,true]){
    const camera=cameraAt({orthographic}),original=camera.projectionMatrix.clone(),base=evaluate(camera);
    for(const index of orthographic?[1,3,4,7,8,9,11]:[1,3,4,7,12,13])for(const value of [Number.MIN_VALUE,-Number.EPSILON,.01]){
      camera.projectionMatrix.copy(original);camera.projectionMatrix.elements[index]=value;assert.throws(()=>evaluate(camera),/projection matrix/);
    }
    for(const [index,value] of [[11,orthographic?-1:0],[15,orthographic?0:1],[0,0],[5,0]]){camera.projectionMatrix.copy(original);camera.projectionMatrix.elements[index]=value;assert.throws(()=>evaluate(camera),/projection matrix/);}
    camera.projectionMatrix.copy(original);camera.projectionMatrix.elements[0]*=3;camera.projectionMatrix.elements[5]*=3;const zoom=evaluate(camera);assert(Math.abs(zoom.projectedErrorPhysicalPixels/base.projectedErrorPhysicalPixels-3)<1e-12);
    camera.projectionMatrix.copy(original);camera.projectionMatrix.elements[orthographic?12:8]=.4;camera.projectionMatrix.elements[orthographic?13:9]=-.2;assert.equal(evaluate(camera).projectedErrorPhysicalPixels,base.projectedErrorPhysicalPixels);
  }
});

test('nonfinite, singular or reverse-depth matrices and unsupported clip conventions cannot certify a view',()=>{
  for(const orthographic of [false,true]){
    const camera=cameraAt({orthographic}),original=camera.projectionMatrix.clone();
    for(let index=0;index<16;index++)for(const value of [NaN,Infinity,-Infinity]){camera.projectionMatrix.copy(original);camera.projectionMatrix.elements[index]=value;assert.throws(()=>evaluate(camera),/projection matrix/);}
    for(const value of [0,.01]){camera.projectionMatrix.copy(original);camera.projectionMatrix.elements[orthographic?10:14]=value;assert.throws(()=>evaluate(camera),/projection matrix/);}
    camera.projectionMatrix.copy(original);camera.coordinateSystem=THREE.WebGPUCoordinateSystem;assert.throws(()=>evaluate(camera),/projection matrix/);
    camera.coordinateSystem=THREE.WebGLCoordinateSystem;camera._reversedDepth=true;assert.throws(()=>evaluate(camera),/projection matrix/);
  }
});

test('world, view and placement must each be affine, even if non-affine factors cancel in the product',()=>{
  const camera=cameraAt(),world=camera.matrixWorld.clone(),inverse=camera.matrixWorldInverse.clone(),common={bounds:{min:[-1,-1,-1],max:[1,1,1]},error:.001};
  for(const property of ['matrixWorld','matrixWorldInverse'])for(const index of [3,7,11]){
    camera.matrixWorld.copy(world);camera.matrixWorldInverse.copy(inverse);camera[property].elements[index]=Number.MIN_VALUE;assert.throws(()=>evaluate(camera,common),/finite affine/);
  }
  camera.matrixWorld.copy(world);camera.matrixWorldInverse.identity();camera.matrixWorldInverse.elements[3]=.125;
  const cancelling=camera.matrixWorldInverse.clone().invert();assert.deepEqual(camera.matrixWorldInverse.clone().multiply(cancelling).toArray(),new THREE.Matrix4().toArray());
  assert.throws(()=>evaluate(camera,{...common,placementMatrix:cancelling}),/finite affine/);
  camera.matrixWorld.copy(world);camera.matrixWorldInverse.copy(inverse);
  const base=evaluate(camera,common),before=[camera.matrixWorld.toArray(),camera.matrixWorldInverse.toArray(),placement.toArray()];
  for(const factor of [-2,3,.9999999999999998]){
    camera.matrixWorld.copy(world).multiplyScalar(factor);camera.matrixWorldInverse.copy(inverse).multiplyScalar(-factor);
    const scaled=placement.clone().multiplyScalar(factor),scaledBefore=scaled.toArray(),result=evaluate(camera,{...common,placementMatrix:scaled});
    assert(Math.abs(result.projectedErrorPhysicalPixels-base.projectedErrorPhysicalPixels)<1e-12);assert.deepEqual(scaled.toArray(),scaledBefore);
  }
  camera.matrixWorld.copy(world);camera.matrixWorldInverse.copy(inverse);evaluate(camera,common);assert.deepEqual([camera.matrixWorld.toArray(),camera.matrixWorldInverse.toArray(),placement.toArray()],before);
  for(const property of ['matrixWorld','matrixWorldInverse'])for(const value of [0,NaN,Infinity,-Infinity]){camera.matrixWorld.copy(world);camera.matrixWorldInverse.copy(inverse);camera[property].elements[15]=value;assert.throws(()=>evaluate(camera,common),/finite affine/);}
});

test('reflection uses the unchanged physical pixel admission and does not use the stale projection inverse',t=>{
  const f=reflectors(t),camera=f.capture(cameraAt({metres:500}))[0].camera;
  assert.notDeepEqual(camera.projectionMatrix.clone().invert().toArray(),camera.projectionMatrixInverse.toArray(),'stock Reflector leaves this inverse at the original projection');
  const low=evaluate(camera),high=evaluate(camera,{physicalWidth:8192,physicalHeight:8192});assert.equal(low.clipping.certified,true);assert.equal(high.clipping.certified,true);assert.equal(low.eligible,true);assert.equal(high.eligible,false);assert(Math.abs(high.projectedErrorPhysicalPixels/low.projectedErrorPhysicalPixels-4)<1e-12);
  camera.projectionMatrixInverse.elements.fill(NaN);assert.equal(evaluate(camera).projectedErrorPhysicalPixels,low.projectedErrorPhysicalPixels);
  assert.throws(()=>evaluate(camera,{pixelBudget:.500001}),/pixel.*budget|budget/);
});
