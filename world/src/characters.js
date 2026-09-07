import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWizard as createFallbackWizard, createWisp as createFallbackWisp } from './models.js';

// Imported safely by simulation tests. Network and image decoding start only on load.
const templates = { wizard: null, wraith: null };
let pendingLoad = null;

function prepareTemplate(scene, kind) {
  scene.name = kind === 'wizard' ? 'Researcher on a broom' : 'Spectral archive guardian';
  scene.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.geometry.computeBoundingSphere();
  });
  if (kind === 'wizard') {
    for (const name of ['rider-cape', 'rider-scarf', 'wandTip', 'broomTail']) {
      if (!scene.getObjectByName(name)) throw new Error(`Character asset is missing its ${name} anchor.`);
    }
  }
  scene.userData.asset = `/models/characters/${kind}.glb`;
  scene.userData.assetSource = 'Original Blender geometry with embedded PBR textures';
  return scene;
}

/** Load once before constructing Game or the art studio; failures remain visible to the caller. */
export function loadCharacterAssets({ baseURL = '/models/characters/' } = {}) {
  if (templates.wizard && templates.wraith) return Promise.resolve({ loaded: true });
  if (pendingLoad) return pendingLoad;
  const loader = new GLTFLoader();
  const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  pendingLoad = Promise.all([
    loader.loadAsync(`${base}wizard.glb`),
    loader.loadAsync(`${base}wraith.glb`),
  ]).then(([wizard, wraith]) => {
    const preparedWizard = prepareTemplate(wizard.scene, 'wizard');
    const preparedWraith = prepareTemplate(wraith.scene, 'wraith');
    templates.wizard = preparedWizard;
    templates.wraith = preparedWraith;
    return { loaded: true };
  }).catch((error) => {
    pendingLoad = null;
    throw error;
  });
  return pendingLoad;
}

/** Every instance has independent animation transforms and shared geometry/material/texture storage. */
export function createWizard() {
  if (!templates.wizard) {
    const fallback = createFallbackWizard();
    fallback.userData.assetSource = 'Procedural fallback; character assets have not loaded';
    return fallback;
  }
  const wizard = templates.wizard.clone(true);
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
  return templates.wraith.clone(true);
}
