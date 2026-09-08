import { AnimationMixer, LoopRepeat, LoopOnce, MathUtils, Quaternion, PropertyBinding } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createWizard as createFallbackWizard, createWisp as createFallbackWisp } from './models.js';

// Imported safely by simulation tests. Network and image decoding start only on load.
const templates = { wizard: null, wraith: null };
let pendingLoad = null;
export const CHARACTER_ACTION_TIMING = Object.freeze({ boostStart: .20, boostEnd: .35, cast: .60, castRelease: .18 });
const oneShots = new Set(['boost_start', 'boost_end', 'cast']);

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
    ? ['idle', 'cruise', 'turn_left', 'turn_right', 'boost', 'boost_start', 'boost_end', 'cast']
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
  }
  scene.userData.asset = `/models/characters/${kind}.glb`;
  scene.userData.assetSource = kind === 'wizard'
    ? 'Original fully masked academy rider, tailored wizard hat, clothing, broom and rig; CC0 Blender Studio garment anatomy'
    : 'Original carved moon guardian, layered drapery, materials and animation rig';
  return { scene, animations };
}

/** Load once before constructing Game or the art studio; failures remain visible to the caller. */
export function loadCharacterAssets({ baseURL = '/models/characters/' } = {}) {
  if (templates.wizard && templates.wraith) return Promise.resolve({ loaded: true });
  if (pendingLoad) return pendingLoad;
  const loader = new GLTFLoader();
  const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  pendingLoad = Promise.all([
    loader.loadAsync(`${base}wizard.glb?v=academy-tailored-v11-cut-panels-20260908c`),
    loader.loadAsync(`${base}wraith.glb?v=academy-guardian-v8-final-20260908b`),
  ]).then(([wizard, wraith]) => {
    const preparedWizard = prepareTemplate(wizard, 'wizard');
    const preparedWraith = prepareTemplate(wraith, 'wraith');
    templates.wizard = preparedWizard;
    templates.wraith = preparedWraith;
    return { loaded: true };
  }).catch((error) => {
    pendingLoad = null;
    throw error;
  });
  return pendingLoad;
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
    cape: [],
    head: group.getObjectByName(kind === 'wizard' ? 'head' : 'mask'),
  };
  mixer.update(0);
  group.updateMatrixWorld(true);
  if (kind === 'wizard') {
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
  const action = animation?.actions.get('cast');
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
  animation.weights.set('cast', 0);
  animation.actions.get('cast')?.setEffectiveWeight(0);
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
} = {}) {
  const animation = group?.userData.characterAnimation;
  if (!animation) return { castReleased: false, castSequence: 0, castActive: false };
  const { mixer, actions, weights, kind, head } = animation;
  const delta = MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  const result = { castReleased: false, castSequence: animation.cast.sequence, castActive: animation.cast.active };
  // No mixer, pose, intent, cloth or event changes while the caller is paused.
  if (paused || delta === 0) return result;
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
