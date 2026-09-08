import { AnimationMixer, LoopRepeat, MathUtils } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createWizard as createFallbackWizard, createWisp as createFallbackWisp } from './models.js';

// Imported safely by simulation tests. Network and image decoding start only on load.
const templates = { wizard: null, wraith: null };
let pendingLoad = null;

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
    ? ['idle', 'cruise', 'turn_left', 'turn_right', 'boost']
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
    loader.loadAsync(`${base}wizard.glb?v=academy-tailored-v9-20260908`),
    loader.loadAsync(`${base}wraith.glb?v=academy-guardian-v7-20260908`),
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
    action.setLoop(LoopRepeat, Infinity).play();
    action.time = phase % clip.duration;
    action.setEffectiveWeight(clip.name === 'idle' ? 1 : 0);
    actions.set(clip.name, action);
    weights.set(clip.name, clip.name === 'idle' ? 1 : 0);
  }
  group.userData.characterAnimation = {
    kind, mixer, actions, weights, reducedMotion: false,
    head: group.getObjectByName(kind === 'wizard' ? 'head' : 'mask'),
  };
  mixer.update(0);
  return group;
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
  dt = 0, speed = 0, turn = 0, vertical = 0, reducedMotion = false, state,
} = {}) {
  const animation = group?.userData.characterAnimation;
  if (!animation) return;
  const { mixer, actions, weights, kind, head } = animation;
  const delta = MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  const velocity = MathUtils.clamp(Number.isFinite(speed) ? speed : 0, 0, 1);
  const steering = MathUtils.clamp(Number.isFinite(turn) ? turn : 0, -1, 1);
  const targets = new Map([...actions.keys()].map((name) => [name, 0]));

  if (reducedMotion) {
    for (const [name, action] of actions) {
      const weight = name === 'idle' ? 1 : 0;
      action.setEffectiveWeight(weight);
      weights.set(name, weight);
    }
    if (!animation.reducedMotion) mixer.setTime(0.6);
    animation.reducedMotion = true;
    return;
  }
  animation.reducedMotion = false;
  if (kind === 'wizard') {
    const cruise = MathUtils.smoothstep(velocity, 0.07, 0.38);
    const boost = MathUtils.smoothstep(velocity, 0.70, 1);
    const turning = Math.abs(steering) * 0.72;
    targets.set('idle', (1 - cruise) * (1 - turning));
    targets.set('cruise', cruise * (1 - boost) * (1 - turning));
    targets.set('boost', cruise * boost * (1 - turning));
    targets.set(steering < 0 ? 'turn_left' : 'turn_right', turning);
  } else {
    const channel = state === 'channel' ? 1 : 0;
    const approach = MathUtils.smoothstep(velocity, 0.1, 0.7) * (1 - channel);
    targets.set('idle', 1 - approach - channel);
    targets.set('approach', approach);
    targets.set('channel', channel);
  }
  const blend = 1 - Math.exp(-delta * 7);
  for (const [name, action] of actions) {
    const weight = MathUtils.lerp(weights.get(name), targets.get(name) ?? 0, blend);
    weights.set(name, weight);
    action.setEffectiveWeight(weight);
  }
  mixer.update(delta);
  if (kind === 'wizard' && head) {
    head.rotation.x += MathUtils.clamp(Number.isFinite(vertical) ? vertical : 0, -1, 1) * 0.025;
  }
}
