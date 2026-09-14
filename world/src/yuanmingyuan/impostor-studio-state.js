import * as THREE from 'three';

// A continuous light rig for the isolated material test, not the museum's HDR.
export function impostorStudioLighting(hour) {
  if (!Number.isFinite(hour)) throw new Error('Finite hour required');
  const angle = ((hour % 24) / 24 - .25) * 2 * Math.PI, altitude = Math.sin(angle), daylight = Math.max(0, altitude), twilight = Math.max(0, 1 - Math.abs(altitude) * 5);
  const sun = new THREE.Vector3(Math.cos(angle), altitude, .3).normalize();
  return { hour, direction: sun.toArray(), sunIntensity: 3.6 * daylight, moonIntensity: .08 * Math.max(0, -altitude), hemisphereIntensity: .035 + .6 * daylight + .05 * twilight, sunColor: new THREE.Color('#ffd0a0').lerp(new THREE.Color('#fff5df'), Math.min(1, daylight * 2)).toArray(), background: new THREE.Color('#07101b').lerp(new THREE.Color('#a5bdc5'), daylight).toArray() };
}
