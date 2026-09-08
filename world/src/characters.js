import { AnimationMixer, LoopRepeat, LoopOnce, MathUtils, Quaternion, PropertyBinding, Vector3 } from 'three';
import {loadGLTF} from './gltf-resource.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createWizard as createFallbackWizard, createWisp as createFallbackWisp } from './models.js';

// Imported safely by simulation tests. Network and image decoding start only on load.
const templates = { wizard: null, wraith: null };
export const CHARACTER_ACTION_TIMING = Object.freeze({ boostStart: .20, boostEnd: .35, cast: .60, castRelease: .18 });
export const CHARACTER_GROUND_MOTION = Object.freeze({ soleY:-1.30, height:3.24, walkSpeed:1.6, runSpeed:3.8, walkCycle:1, runCycle:.70, walkContact:.58, runContact:.36, mountDuration:1.2, dismountDuration:1.2 });
const oneShots = new Set(['boost_start', 'boost_end', 'cast', 'mount', 'dismount', 'ground_cast']);

function prepareTemplate(gltf, kind) {
  const { scene, animations } = gltf;
  scene.name = kind === 'wizard' ? 'Researcher on a broom' : 'Spectral archive guardian';
  scene.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    // Cloth chains travel outside the rest-pose geometry sphere. Actor-level distance
    // selection remains with the world; a rest-pose mesh bound must not clip a cape.
    node.frustumCulled = !node.isSkinnedMesh;
    node.geometry.computeBoundingSphere();
  });
  const required = kind === 'wizard'
    ? ['idle', 'cruise', 'turn_left', 'turn_right', 'boost', 'boost_start', 'boost_end', 'cast', 'ground_idle', 'walk', 'run', 'mount', 'dismount', 'ground_cast']
    : ['idle', 'approach', 'channel'];
  for (const name of required) {
    if (!animations.some((clip) => clip.name === name)) {
      throw new Error(`Character asset ${kind} is missing its ${name} action.`);
    }
  }
  if (kind === 'wizard') {
    for (const name of ['rider-cape', 'rider-scarf', 'wandTip', 'broomTail', 'rider-mask', 'rider-hat-crown']) {
      if (!scene.getObjectByName(name)) throw new Error(`Character asset is missing its ${name} anchor.`);
    }
    for(const name of ['sole.L','sole.R','toe.L','toe.R'])if(!scene.getObjectByName(PropertyBinding.sanitizeNodeName(name)))throw new Error(`Character asset is missing its ${name} foot anchor.`);
  }
  scene.userData.asset = `/models/characters/${kind}.glb`;
  scene.userData.assetSource = kind === 'wizard'
    ? 'Original fully masked academy rider, tailored wizard hat, clothing, broom and rig; CC0 Blender Studio garment anatomy'
    : 'Original carved moon guardian, layered drapery, materials and animation rig';
  return { scene, animations };
}

export async function loadWizardAsset(options={}){
  const {baseURL='/models/characters/',variant='full',...context}=options;
  const base=baseURL.endsWith('/')?baseURL:`${baseURL}/`;
  const id=variant==='core'&&baseURL==='/models/characters/'?'wizard-core':`${base}wizard.glb`;
  const gltf=await loadGLTF({id,url:`${base}wizard.glb`,phase:variant==='core'?1:2},context);
  templates.wizard=prepareTemplate(gltf,'wizard');
  return templates.wizard;
}
export async function loadWraithAsset(options={}){
  const {baseURL='/models/characters/',...context}=options;
  const base=baseURL.endsWith('/')?baseURL:`${baseURL}/`;
  templates.wraith=prepareTemplate(await loadGLTF({id:baseURL==='/models/characters/'?'wraith':`${base}wraith.glb`,url:`${base}wraith.glb`,phase:3},context),'wraith');
  return templates.wraith;
}
/** Studios request both characters; gameplay only requires the wizard. */
export async function loadCharacterAssets(options={}){
  await Promise.all([loadWizardAsset(options),loadWraithAsset(options)]);
  return {loaded:true};
}

/** Upgrade only maps: keep the live skeleton, motion phase, garment geometry and attachments. */
export function upgradeWizardMaterials(actor,template){
  const materials=new Map();template.scene.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.set(m.name,m);});
  actor.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){
    const source=materials.get(m.name);if(!source)continue;
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','sheenColorMap','sheenRoughnessMap','specularColorMap','specularIntensityMap'])if(key in source)m[key]=source[key];
    m.needsUpdate=true;
  }});
}

function animatedClone(template, kind, phase = 0) {
  const group = cloneSkeleton(template.scene);
  const mixer = new AnimationMixer(group);
  const actions = new Map();
  const weights = new Map();
  for (const clip of template.animations) {
    const action = mixer.clipAction(clip);
    action.setLoop(oneShots.has(clip.name) ? LoopOnce : LoopRepeat, oneShots.has(clip.name) ? 1 : Infinity).play();
    action.clampWhenFinished = oneShots.has(clip.name);
    action.time = oneShots.has(clip.name) ? 0 : phase % clip.duration;
    action.setEffectiveWeight(clip.name === 'idle' ? 1 : 0);
    actions.set(clip.name, action);
    weights.set(clip.name, clip.name === 'idle' ? 1 : 0);
  }
  group.userData.characterAnimation = {
    kind, mixer, actions, weights, reducedMotion: false,
    boostIntent: false, transition: null, cast: { active: false, elapsed: 0, released: false, sequence: 0 },
    cape: [], broom: [], feet: [], bones: [], mode:'flying', previousMode:'flying', gaitPhase:0, groundTime:0,
    head: group.getObjectByName(kind === 'wizard' ? 'head' : 'mask'),
  };
  mixer.update(0);
  group.updateMatrixWorld(true);
  if (kind === 'wizard') {
    group.traverse(node=>{if(node.isBone)group.userData.characterAnimation.bones.push(node);if(node.userData.broomPart)group.userData.characterAnimation.broom.push(node);});
    for(const side of ['L','R']){
      const node=name=>group.getObjectByName(PropertyBinding.sanitizeNodeName(name+'.'+side));
      group.userData.characterAnimation.feet.push({side,thigh:node('thigh'),calf:node('calf'),foot:node('foot'),sole:node('sole'),lock:null});
    }
    for (const side of ['L', 'C', 'R']) for (let index = 0; index < 4; index++) {
      const bone = group.getObjectByName(PropertyBinding.sanitizeNodeName(`cape.${side}${index}`));
      if (bone) group.userData.characterAnimation.cape.push({ bone, response: 18 - index * 2.2,
        previous: bone.getWorldQuaternion(new Quaternion()), target: new Quaternion(), parentInverse: new Quaternion() });
    }
  }
  return group;
}

/** Start/restart an authored cast. The release event is emitted by updateCharacter. */
export function requestCharacterCast(group) {
  const animation = group?.userData.characterAnimation;
  if(animation&&['mounting','dismounting'].includes(animation.mode))return {accepted:false,releaseDelay:0,duration:0,sequence:animation.cast.sequence};
  const action = animation?.actions.get(animation.mode==='grounded'?'ground_cast':'cast');
  if (!action) return { accepted: false, releaseDelay: 0, duration: 0, sequence: 0 };
  animation.cast = { active: true, elapsed: 0, released: false, sequence: animation.cast.sequence + 1 };
  action.reset().setEffectiveTimeScale(1).play();
  return { accepted: true, releaseDelay: CHARACTER_ACTION_TIMING.castRelease,
    duration: CHARACTER_ACTION_TIMING.cast, sequence: animation.cast.sequence };
}

/** Cancel a reserved cast on teleport/gameplay disable. Pause should use paused. */
export function cancelCharacterCast(group) {
  const animation = group?.userData.characterAnimation;
  if (!animation?.actions.has('cast')) return false;
  const wasActive = animation.cast.active;
  animation.cast.active = false;
  animation.cast.elapsed = 0;
  animation.cast.released = false;
  for(const name of ['cast','ground_cast']){animation.weights.set(name,0);animation.actions.get(name)?.setEffectiveWeight(0);}
  const total = [...animation.weights.values()].reduce((sum, value) => sum + value, 0);
  for (const [name, action] of animation.actions) {
    const weight = total > 0 ? animation.weights.get(name) / total : Number(name === 'idle');
    animation.weights.set(name, weight); action.setEffectiveWeight(weight);
  }
  return wasActive;
}

function followCape(group, animation, delta, reset = false) {
  group.updateMatrixWorld(true);
  for (const item of animation.cape) item.bone.getWorldQuaternion(item.target);
  for (const item of animation.cape) {
    if (reset) item.previous.copy(item.target);
    else item.previous.slerp(item.target, 1 - Math.exp(-delta * item.response));
    item.bone.parent.getWorldQuaternion(item.parentInverse).invert();
    item.bone.quaternion.copy(item.parentInverse).multiply(item.previous);
    item.bone.updateMatrixWorld(true);
  }
}

/** Explicit teleport/respawn reset; Game cancels/refunds its reservation first. */
export function resetCharacterMotion(group,{mode='flying'}={}){
  const animation=group?.userData.characterAnimation;if(!animation)return;
  cancelCharacterCast(group);for(const leg of animation.feet)leg.lock=null;animation.groundPoseName=null;animation.groundBlend=null;animation.mode=mode;animation.previousMode=mode;animation.transition=null;animation.boostIntent=false;animation.gaitPhase=0;animation.groundTime=0;
  const idle=mode==='grounded'?'ground_idle':'idle';
  for(const [name,action]of animation.actions){const weight=Number(name===idle);action.reset().play().setEffectiveWeight(weight);animation.weights.set(name,weight);}
  animation.mixer.update(0);for(const part of animation.broom)part.visible=mode!=='grounded';followCape(group,animation,0,true);
}

/** Ground pose evaluation uses authored distance-normalized cycles. Game owns the
 * world transform and transition progress; this function never moves the actor. */
function updateGroundCharacter(group, animation, {delta, mode, groundSpeed, gaitPhase, transitionProgress, reducedMotion, groundSupport}) {
  const {actions,weights,mixer}=animation;
  const result={castReleased:false,castSequence:animation.cast.sequence,castActive:animation.cast.active};
  const changing=mode==='mounting'||mode==='dismounting';
  if(changing&&animation.cast.active)cancelCharacterCast(group);
  if(animation.mode!==mode){for(const leg of animation.feet)leg.lock=null;animation.groundPoseName=null;animation.groundBlend=null;}
  animation.mode=mode;animation.transition=null;animation.boostIntent=false;
  const speed=Math.max(0,Number.isFinite(groundSpeed)?groundSpeed:0);
  const running=speed>(CHARACTER_GROUND_MOTION.walkSpeed+CHARACTER_GROUND_MOTION.runSpeed)/2;
  const gait=running?'run':'walk';
  if(Number.isFinite(gaitPhase))animation.gaitPhase=((gaitPhase%1)+1)%1;
  else if(speed>.03)animation.gaitPhase=(animation.gaitPhase+speed*delta/(running?2.66:1.6))%1;
  let name=changing?(mode==='mounting'?'mount':'dismount'):speed>.03?gait:'ground_idle';
  let time=changing?MathUtils.clamp(transitionProgress??0,0,1)*1.2:name==='ground_idle'?(animation.groundTime+=delta)%2:animation.gaitPhase*actions.get(name).getClip().duration;
  if(animation.cast.active){
    animation.cast.elapsed=Math.min(CHARACTER_ACTION_TIMING.cast,animation.cast.elapsed+delta);
    if(!animation.cast.released&&animation.cast.elapsed+1e-9>=CHARACTER_ACTION_TIMING.castRelease){animation.cast.released=true;result.castReleased=true;}
    name='ground_cast';time=animation.cast.elapsed;
    if(time+1e-9>=CHARACTER_ACTION_TIMING.cast)animation.cast.active=false;
  }
  if(reducedMotion&&!changing){name='ground_idle';time=0;}
  const locomoting=(name==='walk'||name==='run');
  const contact=running?CHARACTER_GROUND_MOTION.runContact:CHARACTER_GROUND_MOTION.walkContact;
  animation.contacts={L:!locomoting||animation.gaitPhase<contact,R:!locomoting||(animation.gaitPhase+.5)%1<contact};
  if(animation.groundPoseName&&animation.groundPoseName!==name&&!changing&&!reducedMotion){animation.groundBlend={elapsed:0,poses:animation.bones.map(bone=>({bone,position:bone.position.clone(),rotation:bone.quaternion.clone(),scale:bone.scale.clone()}))};}
  animation.groundPoseName=name;
  // The authored loops already share a contact phase. Avoid an unrelated flight
  // idle contribution moving planted feet; transitions have their own baked clip.
  for(const [key,action]of actions){
    const weight=Number(key===name);weights.set(key,weight);action.setEffectiveWeight(weight);
    if(weight){action.enabled=true;action.paused=true;action.time=time;}
  }
  mixer.update(0);
  if(animation.groundBlend&&!changing&&!reducedMotion){
    const blend=animation.groundBlend;blend.elapsed+=delta;const t=MathUtils.smoothstep(blend.elapsed,0,.14);
    for(const pose of blend.poses){pose.bone.position.lerpVectors(pose.position,pose.bone.position,t);pose.bone.quaternion.slerpQuaternions(pose.rotation,pose.bone.quaternion,t);pose.bone.scale.lerpVectors(pose.scale,pose.bone.scale,t);}
    if(t===1)animation.groundBlend=null;
  }
  group.updateMatrixWorld(true);
  for(const part of animation.broom)part.visible=changing;
  if(!changing)fitGroundFeet(group,animation,groundSupport);
  followCape(group,animation,delta,animation.previousMode!==mode||reducedMotion);
  animation.previousMode=mode;animation.reducedMotion=reducedMotion;
  result.castActive=animation.cast.active;result.gaitPhase=animation.gaitPhase;result.mode=mode;
  return result;
}

// Two-bone correction fits the supplied support, preserves authored swing lift,
// and holds stance soles in world space through changes of speed and heading.
function fitGroundFeet(group,animation,support){
  if(!support||!Number.isFinite(support.y))return;
  const normal=new Vector3(support.normal?.x||0,support.normal?.y??1,support.normal?.z||0).normalize();
  if(normal.y<.5)return;
  const base=group.position.y+CHARACTER_GROUND_MOTION.soleY;
  let pelvisDrop=0;
  for(const leg of animation.feet){const sole=leg.sole.getWorldPosition(new Vector3());const sampled=support.heightAt?.(sole.x,sole.z);const y=Number.isFinite(sampled)?sampled:support.y-(normal.x*(sole.x-(support.x??group.position.x))+normal.z*(sole.z-(support.z??group.position.z)))/normal.y;pelvisDrop=Math.max(pelvisDrop,base-y);}
  pelvisDrop=MathUtils.clamp(Math.max(pelvisDrop>0?pelvisDrop+.025:0,animation.groundBlend?.055:.025),0,.30);
  const pelvis=group.getObjectByName('pelvis');if(pelvis&&pelvisDrop){pelvis.position.y-=pelvisDrop;group.updateMatrixWorld(true);}
  for(const leg of animation.feet){
    const hip=leg.thigh.getWorldPosition(new Vector3()),knee=leg.calf.getWorldPosition(new Vector3()),ankle=leg.foot.getWorldPosition(new Vector3());
    const sole=leg.sole.getWorldPosition(new Vector3());
    const tilt=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),normal);
    const originalRotation=leg.foot.getWorldQuaternion(new Quaternion());
    let footRotation=originalRotation.clone().premultiply(tilt);
    const contact=animation.contacts?.[leg.side]??true;
    if(!contact)leg.lock=null;
    if(contact&&!leg.lock)leg.lock={x:sole.x,z:sole.z,rotation:footRotation.clone()};
    if(leg.lock)footRotation=leg.lock.rotation.clone();
    const offset=sole.clone().sub(ankle).applyQuaternion(footRotation.clone().multiply(originalRotation.invert()));
    const sx=leg.lock?.x??ankle.x+offset.x,sz=leg.lock?.z??ankle.z+offset.z;
    const sampled=support.heightAt?.(sx,sz);
    const planeY=Number.isFinite(sampled)?sampled:support.y-(normal.x*(sx-(support.x??group.position.x))+normal.z*(sz-(support.z??group.position.z)))/normal.y;
    // Retain the authored swing lift relative to the actor's neutral sole plane.
    const target=ankle.clone();target.y+=pelvisDrop+MathUtils.clamp(planeY-base+(sole.y-ankle.y)-offset.y,-.32,.32);
    if(contact)target.y=planeY-offset.y;
    if(leg.lock){target.x=leg.lock.x-offset.x;target.z=leg.lock.z-offset.z;}
    const l1=hip.distanceTo(knee),l2=knee.distanceTo(ankle),axis=target.clone().sub(hip);
    if(axis.length()>l1+l2-.002&&leg.lock){leg.lock=null;target.x=ankle.x;target.z=ankle.z;axis.copy(target).sub(hip);}
    const distance=MathUtils.clamp(axis.length(),.05,l1+l2-.0001);axis.normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    const pole=knee.clone().sub(hip);pole.addScaledVector(axis,-pole.dot(axis));
    if(pole.lengthSq()<1e-8)pole.set(0,0,-1);pole.normalize();
    const goal=hip.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
    const rotate=(bone,from,to)=>{
      const world=bone.getWorldQuaternion(new Quaternion());world.premultiply(new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()));
      bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert()).multiply(world);bone.updateMatrixWorld(true);
    };
    rotate(leg.thigh,knee.clone().sub(hip),goal.clone().sub(hip));
    const actualKnee=leg.calf.getWorldPosition(new Vector3()),actualAnkle=leg.foot.getWorldPosition(new Vector3());
    rotate(leg.calf,actualAnkle.sub(actualKnee),target.clone().sub(actualKnee));
    leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new Quaternion()).invert()).multiply(footRotation);
    leg.foot.updateMatrixWorld(true);
  }
}

/** Every instance has independent animation transforms and shared geometry/material/texture storage. */
export function createWizard() {
  if (!templates.wizard) {
    const fallback = createFallbackWizard();
    fallback.userData.assetSource = 'Procedural fallback; character assets have not loaded';
    return fallback;
  }
  const wizard = animatedClone(templates.wizard, 'wizard');
  const cape = wizard.getObjectByName('rider-cape');
  cape.userData.restRotationX = cape.rotation.x;
  wizard.userData.cape = cape;
  wizard.userData.scarf = wizard.getObjectByName('rider-scarf');
  wizard.userData.wandTip = wizard.getObjectByName('wandTip');
  wizard.userData.broomTail = wizard.getObjectByName('broomTail');
  return wizard;
}

export function createWisp() {
  if (!templates.wraith) {
    const fallback = createFallbackWisp();
    fallback.userData.assetSource = 'Procedural fallback; character assets have not loaded';
    return fallback;
  }
  return animatedClone(templates.wraith, 'wraith', Math.random() * 4);
}

/**
 * Advance one independently skinned actor. speed is normalized 0–1; turn and
 * vertical are signed -1–1. The caller continues to own world movement/banking.
 * Cloth, torso, head and grip animation belong to this helper.
 */
export function updateCharacter(group, {
  dt = 0, speed = 0, turn = 0, vertical = 0, boost, paused = false, reducedMotion = false, state,
  mode='flying', groundSpeed=0, gaitPhase, transitionProgress=0, groundSupport,
} = {}) {
  const animation = group?.userData.characterAnimation;
  if (!animation) return { castReleased: false, castSequence: 0, castActive: false };
  const { mixer, actions, weights, kind, head } = animation;
  const delta = MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  const result = { castReleased: false, castSequence: animation.cast.sequence, castActive: animation.cast.active };
  // No mixer, pose, intent, cloth or event changes while the caller is paused.
  if (paused || delta === 0) return result;
  if(kind==='wizard'&&mode!=='flying')return updateGroundCharacter(group,animation,{delta,mode,groundSpeed,gaitPhase,transitionProgress,reducedMotion,groundSupport});
  if(kind==='wizard'&&animation.mode!=='flying'){
    animation.mode='flying';animation.previousMode='flying';
    for(const part of animation.broom)part.visible=true;
    for(const action of actions.values())action.paused=false;
    followCape(group,animation,0,true);
  }
  const velocity = MathUtils.clamp(Number.isFinite(speed) ? speed : 0, 0, 1);
  const steering = MathUtils.clamp(Number.isFinite(turn) ? turn : 0, -1, 1);
  const targets = new Map([...actions.keys()].map((name) => [name, 0]));

  if (kind === 'wizard') {
    const intent = typeof boost === 'boolean' ? boost : velocity > .85;
    if (intent !== animation.boostIntent) {
      animation.boostIntent = intent;
      const name = intent ? 'boost_start' : 'boost_end';
      animation.transition = { name, elapsed: 0, duration: intent ? CHARACTER_ACTION_TIMING.boostStart : CHARACTER_ACTION_TIMING.boostEnd };
      actions.get(name).reset().setEffectiveTimeScale(1).play();
    }
    if (animation.transition) {
      const transition = animation.transition;
      actions.get(transition.name).time = transition.elapsed;
      actions.get(transition.name).paused = false;
      transition.elapsed = Math.min(transition.duration, transition.elapsed + delta);
    }
    if (animation.cast.active) {
      actions.get('cast').time = animation.cast.elapsed;
      actions.get('cast').paused = false;
      animation.cast.elapsed = Math.min(CHARACTER_ACTION_TIMING.cast, animation.cast.elapsed + delta);
      if (!animation.cast.released && animation.cast.elapsed + 1e-9 >= CHARACTER_ACTION_TIMING.castRelease) {
        animation.cast.released = true;
        result.castReleased = true;
      }
      if (animation.cast.elapsed + 1e-9 >= CHARACTER_ACTION_TIMING.cast) animation.cast.active = false;
      result.castActive = animation.cast.active;
    }
  }

  if (reducedMotion) {
    for (const [name, action] of actions) {
      const weight = name === 'idle' ? 1 : 0;
      action.setEffectiveWeight(weight);
      weights.set(name, weight);
    }
    if (!animation.reducedMotion) { mixer.setTime(0.6); followCape(group, animation, 0, true); }
    animation.reducedMotion = true;
    if (animation.transition?.elapsed >= animation.transition?.duration) animation.transition = null;
    return result;
  }
  animation.reducedMotion = false;
  if (kind === 'wizard') {
    const cruise = MathUtils.smoothstep(velocity, 0.07, 0.38);
    const boosting = typeof boost === 'boolean' ? Number(boost) : MathUtils.smoothstep(velocity, 0.70, 1);
    const turning = Math.abs(steering) * 0.72;
    targets.set('idle', (1 - cruise) * (1 - turning));
    targets.set('cruise', cruise * (1 - boosting) * (1 - turning));
    targets.set('boost', cruise * boosting * (1 - turning));
    targets.set(steering < 0 ? 'turn_left' : 'turn_right', turning);
    if (animation.transition) {
      const { name, elapsed, duration } = animation.transition;
      const envelope = 1 - MathUtils.smoothstep(elapsed, duration - .055, duration);
      for (const [key, weight] of targets) targets.set(key, weight * (1 - envelope));
      targets.set(name, envelope);
    }
    if (animation.cast.active) {
      const envelope = 1 - MathUtils.smoothstep(animation.cast.elapsed, .46, CHARACTER_ACTION_TIMING.cast);
      for (const [key, weight] of targets) targets.set(key, weight * (1 - envelope));
      targets.set('cast', envelope);
    }
  } else {
    const channel = state === 'channel' ? 1 : 0;
    const approach = MathUtils.smoothstep(velocity, 0.1, 0.7) * (1 - channel);
    targets.set('idle', 1 - approach - channel);
    targets.set('approach', approach);
    targets.set('channel', channel);
  }
  const transient = animation.transition || animation.cast.active || [...oneShots].some(name => (weights.get(name) ?? 0) > .001);
  const blend = 1 - Math.exp(-delta * (transient ? 24 : 7));
  let total = 0;
  for (const [name, action] of actions) {
    let weight = MathUtils.lerp(weights.get(name), targets.get(name) ?? 0, blend);
    // Retire a completed transient once its contribution is below 0.1 percent.
    if (oneShots.has(name) && !targets.get(name) && weight < .001) weight = 0;
    weights.set(name, weight);
    total += weight;
  }
  for (const [name, action] of actions) {
    const weight = total > 0 ? weights.get(name) / total : Number(name === 'idle');
    weights.set(name, weight); action.setEffectiveWeight(weight);
  }
  mixer.update(delta);
  if (kind === 'wizard' && head) {
    head.rotation.x += MathUtils.clamp(Number.isFinite(vertical) ? vertical : 0, -1, 1) * 0.025;
  }
  followCape(group, animation, delta);
  if (animation.transition?.elapsed + 1e-9 >= animation.transition?.duration) animation.transition = null;
  return result;
}
