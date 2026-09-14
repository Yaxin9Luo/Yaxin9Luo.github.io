import * as THREE from 'three';
import { createGardenWater } from '../../src/yuanmingyuan/garden-water.js';

export function cameraState(camera) {
  return { type: camera.type, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), up: camera.up.toArray(), scale: camera.scale.toArray(), matrix: camera.matrix.toArray(), matrixWorld: camera.matrixWorld.toArray(), matrixWorldInverse: camera.matrixWorldInverse.toArray(), projectionMatrix: camera.projectionMatrix.toArray(), projectionMatrixInverse: camera.projectionMatrixInverse.toArray(), near: camera.near, far: camera.far, layers: camera.layers.mask, coordinateSystem: camera.coordinateSystem };
}

export function createReflectionFixture() {
  const surfaces = [2, 3.7].map(worldY => ({ geometry: new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2), worldY })), coast = [[-20, -20], [20, -20], [20, 20], [-20, 20]], scene = new THREE.Scene();
  const water = createGardenWater({ terrain: { waterSurfaces: surfaces, coastPolygon: coast }, layout: { exhibition: { seaY: 0, coast: { polygon: coast } } } }); scene.add(water.group);
  const calls = [], sample = { lightDirection: new THREE.Vector3(1, 1, 1).normalize(), key: new THREE.Color(0xffeedd), keyIntensity: 3, night: 0, water: new THREE.Color(0x548d84) }; let activeTarget = null, disposed = false;
  const renderer = {
    xr: { enabled: false }, shadowMap: { autoUpdate: false }, autoClear: true,
    state: { buffers: { depth: { setMask() {} } }, viewport() {} },
    getRenderTarget: () => activeTarget,
    setRenderTarget(target) { activeTarget = target; },
    getCurrentViewport: value => value.set(0, 0, 3200, 2200),
    render(renderScene, camera) { calls.push({ camera: cameraState(camera), physicalWidth: activeTarget.width, physicalHeight: activeTarget.height, renderScene }); },
  };
  return { water, scene, renderer, calls,
    begin(camera) { scene.updateMatrixWorld(); camera.updateWorldMatrix(true, false); water.update(12, sample, camera); },
    draw(sheet, camera) { const count = calls.length; sheet.onBeforeRender(renderer, scene, camera); return calls.length > count ? calls.at(-1) : null; },
    dispose() { if (disposed) return; disposed = true; water.dispose(); surfaces.forEach(surface => surface.geometry.dispose()); },
  };
}

// Reuses Western's actual Zheng metadata and five audited viewpoints. The
// fixture only creates tiny water sheets; no building factory or archive load.
export function camerasFromReflectionAudit(audit) {
  const placement = new THREE.Matrix4().fromArray(audit.placement), target = new THREE.Box3(new THREE.Vector3(...audit.bounds.min), new THREE.Vector3(...audit.bounds.max)).getCenter(new THREE.Vector3()).applyMatrix4(placement); target.y = 8.85;
  return [...new Map(audit.runs.map(run => [run.name, run])).values()].map(run => {
    const camera = run.name.startsWith('ortho') ? new THREE.OrthographicCamera(-180, 180, 150, -150, 5, 22000) : new THREE.PerspectiveCamera(40, 3200 / 2200, 5, 22000);
    camera.position.fromArray(run.sourceCamera); camera.lookAt(target); camera.updateMatrixWorld();
    return { name: run.name, camera };
  });
}
