import * as THREE from 'three';

export const ILLUMINATION = Object.freeze({ intensity: 18, distance: 14, fadeSeconds: .28 });

/** One persistent local light. It never reads the world phase, mana or spell state. */
export function createWandIllumination() {
  const group = new THREE.Group();group.name = 'Persistent wand illumination';group.visible = false;
  const light = new THREE.PointLight('#d4ecff', 0, ILLUMINATION.distance, 2);
  light.name = 'Wand local light';light.castShadow = false;
  const geometry = new THREE.SphereGeometry(.045, 10, 8);
  const material = new THREE.MeshBasicMaterial({ color: '#d4ecff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const tip = new THREE.Mesh(geometry, material);tip.name = 'Illuminated wand tip';
  group.add(light, tip);
  let enabled = false, strength = 0, shown = false, disposed = false;
  const apply = () => {
    // Keep the light slot at zero intensity when off: toggling must not change
    // every material's light-count shader variant. The small emitter stays hidden.
    group.visible = !disposed && shown;tip.visible = group.visible && strength > 0;
    light.intensity = group.visible ? strength * ILLUMINATION.intensity : 0;
    material.opacity = strength;
  };
  return {
    group, light,
    setEnabled(value, { immediate = false } = {}) {
      if (disposed) return false;
      const changed = enabled !== Boolean(value);enabled = Boolean(value);
      if (immediate) strength = enabled ? 1 : 0;
      apply();return changed;
    },
    update(dt, wandWorldPosition, { paused = false, reducedMotion = false, visible = true } = {}) {
      if (disposed) return;
      shown = visible && Boolean(wandWorldPosition) && [wandWorldPosition.x, wandWorldPosition.y, wandWorldPosition.z].every(Number.isFinite);
      if (shown) group.position.copy(wandWorldPosition);
      if (!paused) {
        const step = reducedMotion ? 1 : (Number.isFinite(dt) ? Math.max(0, dt) : 0) / ILLUMINATION.fadeSeconds;
        strength = enabled ? Math.min(1, strength + step) : Math.max(0, strength - step);
      }
      apply();
    },
    getState: () => ({ enabled, available: !disposed, intensity: light.intensity }),
    dispose() {
      if (disposed) return;
      disposed = true;enabled = false;strength = 0;apply();
      group.removeFromParent();geometry.dispose();material.dispose();
    },
  };
}
