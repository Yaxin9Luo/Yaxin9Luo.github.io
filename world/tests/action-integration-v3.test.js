import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import * as THREE from 'three';
import {Game} from '../src/game.js';
import {loadCharacterAssets,createWizard,CHARACTER_ACTION_TIMING} from '../src/characters.js';
import {createActionEffects} from '../src/effects.js';
import {spellDefinitions} from '../src/locations.js';

// Preserve shipped geometry, skin and action buffers. Only image/material tables
// are removed because Node has no image decoder; this does not prove rendering.
function animationFixture(buffer){
  const length=buffer.readUInt32LE(12),json=JSON.parse(buffer.toString('utf8',20,20+length)),binary=buffer.subarray(28+length);
  delete json.images;delete json.textures;delete json.materials;
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
  const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,padded,binHeader,binary]);
}
let server,previousProgress;
before(async()=>{
  previousProgress=globalThis.ProgressEvent;globalThis.ProgressEvent??=class{constructor(type,values){this.type=type;Object.assign(this,values);}};
  const fixtures=new Map();for(const kind of ['wizard','wraith'])fixtures.set(kind,animationFixture(await readFile(new URL(`../public/models/characters/${kind}.glb`,import.meta.url))));
  server=createServer((req,res)=>{res.setHeader('Content-Type','model/gltf-binary');res.end(fixtures.get(req.url.includes('wizard')?'wizard':'wraith'));}).listen(0,'127.0.0.1');await once(server,'listening');
  await loadCharacterAssets({baseURL:`http://127.0.0.1:${server.address().port}/`});
});
after(async()=>{globalThis.ProgressEvent=previousProgress;if(server)await new Promise(resolve=>server.close(resolve));});

function gameFixture(t){
  const game=Object.create(Game.prototype),sounds=[],launches=[];
  Object.assign(game,{started:true,paused:false,_suspended:false,_contextLost:false,_disposed:false,_combat:false,
    options:{gameplay:true,reducedMotion:false},mana:100,health:100,spell:0,shield:0,cooldown:0,race:null,_pendingCast:null,_boostIntent:false,
    scene:new THREE.Scene(),position:new THREE.Vector3(0,12,15),velocity:new THREE.Vector3(),heading:0,_bank:0,_time:0,_simulationTime:0,
    _scratch:new THREE.Vector3(),_scratch2:new THREE.Vector3(),_forward:new THREE.Vector3(),_projected:new THREE.Vector3(),_castOrigin:new THREE.Vector3(),_previous:new THREE.Vector3(),
    _keys:new Set(),_touch:{x:0,z:0},_controls:{up:false,down:false,fire:false,boost:false},cameraYaw:0,_trailTime:0,_destination:null,buildingColliders:[],
    audio:{play:name=>sounds.push(name),unlock(){},setSuspended(){}},renderer:{shadowMap:{}},callbacks:{},
    _emitFrame(){},_message(){},_updateCamera(){},
    world:{wisps:[],crystals:[],portals:[],ringMeshes:[],setRingState(){}},progress:{crystals:[],visited:[]},
  });
  game.camera=new THREE.PerspectiveCamera(43,1,.1,1000);game.camera.position.set(0,20,40);game.camera.lookAt(0,12,0);game.camera.updateMatrixWorld();
  game.wizard=createWizard();game.scene.add(game.wizard);game._createEffects();game._updateWizard(0,true);
  const launch=game._launch.bind(game);game._launch=(projectile,origin,...rest)=>{launches.push({origin:origin.clone(),tip:game.wizard.userData.wandTip.getWorldPosition(new THREE.Vector3())});return launch(projectile,origin,...rest);};
  t.after(()=>{const geometries=new Set(),materials=new Set();game.effects.traverse(mesh=>{if(mesh.geometry)geometries.add(mesh.geometry);for(const material of mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[])materials.add(material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());game.wizard.userData.characterAnimation.mixer.stopAllAction();game.scene.clear();});
  return {game,sounds,launches};
}
function step(game,dt){game._time+=dt;game._updateWizard(dt,game.started&&!game._isPaused());}
const active=game=>game._projectiles.filter(projectile=>projectile.active&&!projectile.enemy);

test('shipped cast releases one reserved spell at the animated wand tip, never on button press',t=>{
  const {game,sounds,launches}=gameFixture(t),before=game.wizard.userData.wandTip.getWorldPosition(new THREE.Vector3());
  assert.equal(game.cast(1),true);assert.equal(game.mana,100-spellDefinitions[1].cost);assert.equal(active(game).length,0);assert.deepEqual(sounds,['cast-start']);
  assert.equal(game.cast(0),false,'a held/repeated button cannot reserve another pending cast');
  step(game,.10);step(game,.07);assert.equal(active(game).length,0);
  game.selectSpell(2);step(game,.02);
  assert.equal(active(game).length,1);assert.equal(active(game)[0].spell,1,'changing selection does not mutate the reserved spell');
  assert.equal(launches.length,1);assert.ok(launches[0].origin.distanceTo(launches[0].tip)<1e-8);assert.ok(launches[0].tip.distanceTo(before)>.01,'the origin comes from an actual animated pose');
  for(let i=0;i<80;i++)step(game,.02);
  assert.equal(launches.length,1);assert.deepEqual(sounds,['cast-start','incendio']);assert.equal(game._pendingCast,null);
});

test('pausing before release preserves the reservation and resumes exactly one release',t=>{
  const {game,sounds,launches}=gameFixture(t);game.cast(0);step(game,.08);game.setPaused(true);
  const elapsed=game.wizard.userData.characterAnimation.cast.elapsed;
  for(let i=0;i<30;i++)step(game,.1);
  assert.equal(game.wizard.userData.characterAnimation.cast.elapsed,elapsed);assert.equal(launches.length,0);assert.deepEqual(sounds,['cast-start']);
  game.setPaused(false);step(game,.08);assert.equal(launches.length,0);step(game,.04);assert.equal(launches.length,1);
  for(let i=0;i<30;i++)step(game,.02);assert.deepEqual(sounds,['cast-start','lumos']);
});

for(const cancellation of ['teleport','gameplay off'])test(`${cancellation} cancels and refunds a pending cast once without a delayed shot`,t=>{
  const {game,sounds,launches}=gameFixture(t);game.cast(2);step(game,.09);
  if(cancellation==='teleport')game._teleport(22,35,70);else game.setOption('gameplay',false);
  assert.equal(game._pendingCast,null);assert.equal(game.mana,100);assert.equal(game.actionEffects.group.children[0].visible,false);
  game._cancelPendingCast();assert.equal(game.mana,100,'repeated cancellation cannot refund twice');
  for(let i=0;i<50;i++)step(game,.02);
  assert.equal(launches.length,0);assert.deepEqual(sounds,['cast-start']);
});

test('reduced motion retains release timing and never emits duplicate release sounds',t=>{
  const {game,sounds,launches}=gameFixture(t);game.options.reducedMotion=true;game.cast(0);
  step(game,CHARACTER_ACTION_TIMING.castRelease/2);assert.equal(launches.length,0);step(game,CHARACTER_ACTION_TIMING.castRelease/2);assert.equal(launches.length,1);
  for(let i=0;i<40;i++)step(game,.05);assert.equal(launches.length,1);assert.deepEqual(sounds,['cast-start','lumos']);
});

test('a projectile slot lost during charge refunds the spell and retires its charge effect',t=>{
  const {game,sounds}=gameFixture(t);game._projectiles=game._projectiles.slice(0,1);game.cast(1);
  // The real player and enemy launchers share this bounded pool.
  game._launch(game._projectiles[0],new THREE.Vector3(),new THREE.Vector3(0,0,-1),15,'#c2a0e9',12,-1,true);
  for(let i=0;i<40;i++)step(game,.025);
  assert.equal(active(game).length,0);assert.equal(game.mana,100);assert.equal(game._pendingCast,null);assert.deepEqual(sounds,['cast-start']);
  assert.equal(game.actionEffects.group.children[0].visible,false,'an unavailable projectile cannot leave a permanent charging halo');
});

test('charge effects pause their visible phase when delta is zero, then resume locally',()=>{
  const effects=createActionEffects(),camera=new THREE.PerspectiveCamera(),wand=new THREE.Vector3(1,2,3),focus=effects.group.children[0];
  effects.charge('#b6e5ee');effects.update(.08,.08,wand,camera);
  const pose=()=>({scale:focus.scale.toArray(),rotation:focus.children.map(child=>child.rotation.toArray()),opacity:focus.children[0].material.opacity});
  const paused=pose();effects.update(0,42,wand,camera);assert.deepEqual(pose(),paused,'the world clock may continue while the action is paused');
  effects.update(.02,42.02,wand,camera);assert.notDeepEqual(pose(),paused);
});

test('held boost starts its sound once and a new boost press starts one new sound',t=>{
  const {game,sounds}=gameFixture(t);game._controls.boost=true;
  for(let i=0;i<20;i++)game._move(0);
  assert.deepEqual(sounds,['boost']);game._controls.boost=false;game._move(0);game._controls.boost=true;game._move(0);
  assert.deepEqual(sounds,['boost','boost']);
});
