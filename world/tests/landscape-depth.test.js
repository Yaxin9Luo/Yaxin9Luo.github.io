import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readScanGeometry} from './helpers/scan-geometry.js';
import {loadScannedRockAssets,scannedRockSource} from '../src/rock-scans.js';
import {DEPTH_RIDGES,ridgeGeometry,createLandscapeDepth} from '../src/landscape-depth.js';
import {createLake,createBackdrop,cliffMaterial} from '../src/landscape.js';
import {worldBounds} from '../src/locations.js';
import {Game} from '../src/game.js';
import {EnvironmentClock,sampleEnvironment,TIME_PHASES} from '../src/environment-time.js';
import {createWorld,createNavigationWorld,islandGeometry,registerWorldLighting} from '../src/world.js';

function dispose(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}

test('authored ridges are closed, finite 3D bedrock with submerged edges clear of playable flight',()=>{
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const ridge of DEPTH_RIDGES){
    const g=ridgeGeometry(ridge),p=g.attributes.position,edges=new Map();
    for(const name of ['position','normal','uv','color','ridgeMoss'])assert.ok(g.attributes[name].array.every(Number.isFinite),`${ridge.name}: ${name}`);
    assert.equal(g.attributes.color.itemSize,3);assert.equal(g.attributes.uv.count,p.count);
    for(let i=0;i<g.index.count;i+=3){
      const ids=[0,1,2].map(j=>g.index.getX(i+j));a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-10,`${ridge.name}: degenerate face`);
      for(let j=0;j<3;j++){const key=[ids[j],ids[(j+1)%3]].sort((x,y)=>x-y).join('/');edges.set(key,(edges.get(key)||0)+1);}
    }
    assert.ok([...edges.values()].every(n=>n===2),`${ridge.name}: watertight topology`);
    const {min,max}=g.boundingBox;assert.ok(min.y<-15&&max.y>-15&&max.y<60,'submerged foot and low authored crest');
    assert.ok(max.x<-worldBounds.x||min.x>worldBounds.x||max.z<-worldBounds.z||min.z>worldBounds.z,`${ridge.name} enters unsupported flight space`);
    const ray=new THREE.Raycaster(new THREE.Vector3((min.x+max.x)/2,100,(min.z+max.z)/2),new THREE.Vector3(0,-1,0));
    const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld(true);
    assert.ok(ray.intersectObject(mesh).length,'upper faces must point up and remain visible');mesh.material.dispose();g.dispose();
  }
});

test('local mist uses each active camera through transformed parent frames, and retains its authored pose',()=>{
  const scene=new THREE.Scene(),root=new THREE.Group();root.position.set(11,3,-8);root.rotation.y=.27;scene.add(root);
  const wind={value:12},fogColor=new THREE.Color('#708a92'),depth=createLandscapeDepth(root,{rockMaterial:cliffMaterial,wind,fogColor}),rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);scene.add(rig);rig.position.set(35,-90,51);
  scene.updateMatrixWorld(true);const poses=depth.mist.map(o=>o.matrix.clone());
  for(const y of [134,45,186]){
    camera.position.set(8,y,9);scene.updateMatrixWorld(true);
    for(const mesh of depth.mist){
      mesh.onBeforeRender(null,scene,camera);
      const actual=mesh.localToWorld(mesh.material.uniforms.localEye.value.clone());
      assert.ok(actual.distanceTo(camera.getWorldPosition(new THREE.Vector3()))<1e-8);
      assert.equal(mesh.material.uniforms.windTime,wind);assert.equal(mesh.material.uniforms.fogTint.value,fogColor);
      assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.side,THREE.BackSide);
      assert.ok(!mesh.userData.backgroundLayer&&!mesh.castShadow);
    }
  }
  wind.value=0;assert.ok(depth.mist.every(o=>o.material.uniforms.windTime.value===0));
  assert.ok(depth.mist.every((o,i)=>o.matrix.equals(poses[i])),'per-pass camera updates must not move or rotate authored volumes');dispose(scene);
});

test('lake retains the Three reflection camera, clipping, cadence and renderer state',()=>{
  const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);const {water,reflection}=createLake(root,scene),camera=new THREE.PerspectiveCamera(50,1.5,.1,3000),rig=new THREE.Group();scene.add(rig);rig.position.y=10;rig.add(camera);camera.position.set(31,44,88);camera.lookAt(0,0,0);scene.updateMatrixWorld(true);
  const oldTarget={name:'main'},calls=[],renderer={xr:{enabled:true},shadowMap:{autoUpdate:true},autoClear:false,getRenderTarget:()=>oldTarget,setRenderTarget:t=>calls.push(['target',t]),clear:()=>calls.push(['clear']),state:{buffers:{depth:{setMask:v=>calls.push(['mask',v])}},viewport:v=>calls.push(['viewport',v])},render(s,mirror){
    assert.equal(s,scene);assert.equal(water.visible,false);assert.equal(this.xr.enabled,false);assert.equal(this.shadowMap.autoUpdate,false);
    calls.push(['render',mirror.position.clone(),mirror.projectionMatrix.clone()]);
  }};
  const frame=(draw=()=>{for(let i=0;i<3;i++)water.onBeforeRender(renderer,scene,camera);})=>{reflection.beginFrame(renderer,scene,camera);try{draw();}finally{reflection.endFrame();}};
  camera.viewport=new THREE.Vector4(1,2,300,200);
  frame(()=>{
    scene.overrideMaterial=new THREE.MeshNormalMaterial();water.onBeforeRender(renderer,scene,camera);assert.equal(calls.length,0);scene.overrideMaterial.dispose();scene.overrideMaterial=null;
    water.onBeforeRender(renderer,scene,camera);const draw=calls.find(c=>c[0]==='render');assert.ok(draw);assert.ok(draw[1].distanceTo(new THREE.Vector3(31,-84,88))<1e-6);
    assert.notDeepEqual(draw[2].elements,camera.projectionMatrix.elements,'oblique water clipping must remain applied');
    assert.equal(water.visible,true);assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);
    assert.deepEqual(calls.at(-2),['target',oldTarget]);assert.deepEqual(calls.at(-1),['viewport',camera.viewport]);
  });
  for(let i=0;i<4;i++)frame();assert.equal(calls.filter(c=>c[0]==='render').length,1);
  frame();assert.equal(calls.filter(c=>c[0]==='render').length,2);
  camera.position.y=-40;scene.updateMatrixWorld(true);for(let i=0;i<5;i++)frame();assert.equal(calls.filter(c=>c[0]==='render').length,2,'back of water skips reflection');
  camera.position.y=44;frame();assert.equal(calls.filter(c=>c[0]==='render').length,3,'returning above the water refreshes the first front-facing frame');dispose(scene);
});

test('lake material disposal owns each generated texture and the full reflection target once',()=>{
  const scene=new THREE.Scene(),lake=createLake(scene,scene),u=lake.water.material.uniforms,counts={normal:0,shore:0,target:0};
  for(const [key,resource]of [['normal',u.normalSampler.value],['shore',u.shoreMap.value],['target',u.mirrorSampler.value.renderTarget]])resource.addEventListener('dispose',()=>counts[key]++);
  lake.water.material.dispose();lake.water.material.dispose();assert.deepEqual(counts,{normal:1,shore:1,target:1});lake.water.geometry.dispose();
});

test('real environment updates own base water and live mist colors through day, night, transition and reduced motion',()=>{
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.FogExp2();const root=new THREE.Group();scene.add(root);
  const lake=createLake(root,scene),backdrop=createBackdrop(root,scene),world={root,lake,atmosphere:{setEnvironment(){}},environmentLighting:{lights:[],emissiveMaterials:[],nightMaterials:[],nightObjects:[]}};registerWorldLighting(world);
  const game=Object.create(Game.prototype);Object.assign(game,{scene,world,renderer:{shadowMap:{}},started:true,options:{reducedMotion:false},_isPaused:()=>false,_landscapeLighting:[],accentLights:[],ambientLight:new THREE.HemisphereLight(),keyLight:new THREE.DirectionalLight(),fillLight:new THREE.DirectionalLight(),audio:{setEnvironment(){}},position:new THREE.Vector3(),_time:0});
  const shore=lake.water.material.uniforms.shoreDay.value.clone();
  for(const [mode,reduced]of [['day',false],['night',false],['dusk',false],['dawn',true]]){
    game.options.reducedMotion=reduced;game.environmentClock=new EnvironmentClock(mode);game._updateEnvironment(0);lake.update(28,reduced);const expected=sampleEnvironment(TIME_PHASES[mode],{lightingVariant:game.environmentClock.lightingReviewVariant}),u=lake.water.material.uniforms;
    assert.equal(scene.fog.density,expected.fogDensity);assert.ok(u.waterColor.value.equals(expected.water));assert.ok(u.sunColor.value.equals(expected.key));assert.ok(u.sunDirection.value.equals(expected.lightDirection));assert.equal(u.nightFactor.value,expected.night);assert.ok(u.shoreDay.value.equals(shore));
    backdrop.depth.group.traverse(mesh=>{if(mesh.material?.userData.localDepthFog)assert.equal(mesh.material.uniforms.nightFactor.value,expected.night);});
    for(const mesh of backdrop.depth.mist){assert.equal(mesh.material.uniforms.nightFactor.value,expected.night);assert.equal(mesh.material.uniforms.fogTint.value,scene.fog.color);assert.ok(mesh.material.uniforms.fogTint.value.equals(expected.fog));assert.equal(mesh.material.uniforms.windTime.value,reduced?0:28);}
  }
  const map=lake.water.material.uniforms.shoreMap.value,{data,width}=map.image;
  const sample=(x,z)=>data[(Math.floor((z+220)/440*width)*width+Math.floor((x+220)/440*width))*4];
  assert.ok(sample(111,31)>sample(-120,0)+100,'cove treatment remains local');assert.equal(sample(190,140),0);dispose(scene);
});

test('reused full-resolution scans and pine roots fit actual ridge triangles, with owned instance/shadow cleanup',async()=>{
  assert.equal(await loadScannedRockAssets({loadGLTFImpl:async asset=>readScanGeometry(asset.url)}),true);
  const root=new THREE.Group(),depth=createLandscapeDepth(root,{rockMaterial:cliffMaterial});root.updateMatrixWorld(true);
  assert.ok(depth.vegetation.userData.treeCount>0);assert.ok(depth.scanAccents.userData.instanceCount>0);
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),ray=new THREE.Raycaster(),instances=[];
  depth.group.traverse(mesh=>{if(mesh.isInstancedMesh){instances.push(mesh);assert.ok(mesh.geometry.index.count>0);assert.ok(mesh.geometry.attributes.uv,'source texture coordinates retained');}});
  for(const mesh of depth.vegetation.children)for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);ray.set(new THREE.Vector3(point.x,100,point.z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObjects(depth.ridges,false);
    assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-point.y-.1)<.002,'pine roots match visible bedrock triangles');
  }
  for(const placement of depth.scanAccents.userData.placements){
    ray.set(new THREE.Vector3(placement.x,100,placement.z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObjects(depth.ridges,false);assert.ok(hits.length);assert.ok(placement.y<hits[0].point.y&&hits[0].point.y-placement.y<8,'large structural scan base penetrates its local support');
  }
  let instanceDisposals=0,shadowDisposals=0;
  for(const mesh of instances){mesh.addEventListener('dispose',()=>instanceDisposals++);for(const shadow of [mesh.customDepthMaterial,mesh.customDistanceMaterial])shadow?.addEventListener('dispose',()=>shadowDisposals++);}
  depth.ridges[0].material.dispose();depth.ridges[0].material.dispose();assert.equal(instanceDisposals,instances.length);assert.equal(shadowDisposals,2);dispose(root);
});

test('local fog preserves per-pass depth, live night uniforms, pine wind and original shared scan materials',()=>{
  const source=scannedRockSource('moss',0),sourceCompile=source.material.onBeforeCompile,sourceColor=source.material.color.clone(),root=new THREE.Group(),depth=createLandscapeDepth(root,{rockMaterial:cliffMaterial}),scene=new THREE.Scene(),lake=createLake(root,scene);
  const shaders=[];root.traverse(mesh=>{const m=mesh.material;if(!m?.userData.localDepthFog)return;
    const shader={uniforms:{},vertexShader:m.isShaderMaterial?m.vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:m.isShaderMaterial?m.fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);shaders.push({m,shader});
    assert.equal(shader.uniforms.depthNightFactor,m.uniforms.nightFactor);assert.ok(shader.fragmentShader.includes('coastalFogDepth=vFogDepth*coastalFogScale'),'active draw view depth supplies fog in main and reflected passes');
    assert.ok(shader.fragmentShader.includes('#ifdef USE_FOG')&&shader.fragmentShader.includes('#ifdef FOG_EXP2')&&shader.fragmentShader.includes('smoothstep(fogNear,fogFar,coastalFogDepth)'));
    m.uniforms.nightFactor.value=.73;assert.equal(shader.uniforms.depthNightFactor.value,.73);
  });
  assert.ok(shaders.length>depth.ridges.length,'scan and pine materials also receive local fog');
  assert.ok(depth.scanAccents.children.every(mesh=>mesh.material!==source.material&&mesh.material.userData.sharedAsset===false));assert.equal(source.material.onBeforeCompile,sourceCompile);assert.ok(source.material.color.equals(sourceColor));
  const leaves=depth.vegetation.children.find(m=>m.material.userData.environmentWind),leafShader=shaders.find(({m})=>m===leaves.material).shader;
  assert.ok(leafShader.vertexShader.includes('plantTransform = modelMatrix * instanceMatrix'));assert.ok(leafShader.uniforms.environmentWindTime);assert.ok(leaves.customDepthMaterial&&leaves.customDistanceMaterial);
  const mix=(a,b,t)=>a+(b-a)*t,smoothstep=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
  for(const {m,shader}of shaders){
    const scale=shader.fragmentShader.match(/float coastalFogScale=([^;]+);/)[1],restore=shader.fragmentShader.match(/coastalFogScale=mix\(coastalFogScale,1.,smoothstep\([^;]+;/)?.[0]||'',depthExpression=shader.fragmentShader.match(/float coastalFogDepth=([^;]+);/)[1];
    const evaluate=new Function('vFogDepth','depthNightFactor','mix','smoothstep',`let coastalFogScale=${scale};${restore}return ${depthExpression};`),sample=(d,n)=>evaluate(d,n,mix,smoothstep);
    assert.equal(sample(0,0),0);for(const d of [250,600,900]){assert.ok(sample(d,0)>0&&sample(d,0)<d);assert.ok(sample(d,1)>0&&sample(d,1)<sample(d,0));}
    if(m===lake.water.material)for(const night of [0,.5,1])assert.equal(sample(3600,night),3600,'lake must converge to unmodified sky fog before the far clip');
  }
  dispose(root);
});

test('full and progressive assembly attach one depth group at highlands and keep the shared update live',async()=>{
  const fullScene=new THREE.Scene(),full=createWorld(fullScene,{herbarium:false}),count=(root,name)=>{let n=0;root.traverse(o=>{if(o.name===name)n++;});return n;};
  assert.equal(count(fullScene,'Reflective lake'),1);assert.equal(count(fullScene,'Authored middle-distance coast'),1);full.update(13,.016,false);assert.ok(full.environmentLighting.nightMaterials.some(e=>e.material.uniforms.localEye));dispose(fullScene);
  const scene=new THREE.Scene(),world=createNavigationWorld(scene,islandGeometry(),{herbarium:false}),lake=world.lake;assert.equal(count(scene,'Authored middle-distance coast'),0);
  let highlands=false;await world.enhance({prepareRegion:async()=>false,onRegion:({region})=>{if(region==='highlands'){highlands=true;assert.equal(count(scene,'Authored middle-distance coast'),1);world.update(19,.016,false);const mist=world.root.getObjectByName('West headland water mist');assert.equal(mist.material.uniforms.windTime.value,19);assert.ok(world.environmentLighting.nightMaterials.some(e=>e.material===mist.material));}}});
  assert.ok(highlands);assert.equal(world.lake,lake);assert.equal(count(scene,'Reflective lake'),1);assert.equal(count(scene,'Authored middle-distance coast'),1);world.update(31,.016,true);assert.equal(world.root.getObjectByName('West headland water mist').material.uniforms.windTime.value,0);dispose(scene);
});
