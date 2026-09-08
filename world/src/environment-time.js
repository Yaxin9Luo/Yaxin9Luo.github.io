import * as THREE from 'three';

export const TIME_MODES = ['auto', 'dawn', 'day', 'dusk', 'night'];
export const TIME_PHASES = { dawn: .265, day: .46, dusk: .735, night: .86 };
const wrap = value => ((value % 1) + 1) % 1;
const smooth = value => value * value * (3 - 2 * value);

// Art-directed palettes. Lighting and sky share these values; surfaces keep
// their own albedo instead of receiving a full-screen colour filter.
const palettes = {
  night: { zenith: '#152d59', horizon: '#6382a0', cloud: '#6386a4', fog: '#46617c', key: '#c3deff', sky: '#b6d1eb', ground: '#596d88', fill: '#b7ccec', water: '#173d50', keyIntensity: 3.35, ambientIntensity: 1.75, fillIntensity: .90, fogDensity: .00135, exposure: 1.16, night: 1 },
  dawn: { zenith: '#7195c4', horizon: '#edbdb0', cloud: '#f0d1c0', fog: '#a8a9bc', key: '#ffd4b8', sky: '#cad6f0', ground: '#9f9694', fill: '#9aafdf', water: '#537481', keyIntensity: 3.3, ambientIntensity: 1.8, fillIntensity: .65, fogDensity: .0011, exposure: 1.02, night: .12 },
  day: { zenith: '#397bb1', horizon: '#c9e4e9', cloud: '#fff3dd', fog: '#abc6d5', key: '#fff0d5', sky: '#b3d6f2', ground: '#9d9d83', fill: '#bed8ef', water: '#236775', keyIntensity: 3.4, ambientIntensity: 2.0, fillIntensity: 1.15, fogDensity: .00095, exposure: 1.02, night: 0 },
  dusk: { zenith: '#6979ad', horizon: '#efac87', cloud: '#f4bc96', fog: '#b49da6', key: '#ffd2a5', sky: '#c2b9e0', ground: '#a39390', fill: '#a6bbe9', water: '#53697f', keyIntensity: 3.35, ambientIntensity: 1.8, fillIntensity: .7, fogDensity: .0012, exposure: 1.0, night: .28 },
};
const colorKeys = ['zenith', 'horizon', 'cloud', 'fog', 'key', 'sky', 'ground', 'fill', 'water'];
for (const palette of Object.values(palettes)) for (const key of colorKeys) palette[key] = new THREE.Color(palette[key]);
const stops = [[0, 'night'], [.19, 'night'], [.265, 'dawn'], [.36, 'day'], [.62, 'day'], [.735, 'dusk'], [.815, 'night'], [1, 'night']];

export function sampleEnvironment(phase) {
  const p = wrap(Number.isFinite(phase) ? phase : TIME_PHASES.night);
  let index = 0;
  while (index < stops.length - 2 && p >= stops[index + 1][0]) index++;
  const [start, from] = stops[index], [end, to] = stops[index + 1];
  const mix = smooth((p - start) / (end - start));
  const a = palettes[from], b = palettes[to], result = { phase: p, label: mix < .5 ? from : to };
  for (const key of colorKeys) result[key] = a[key].clone().lerp(b[key], mix);
  for (const key of ['keyIntensity', 'ambientIntensity', 'fillIntensity', 'fogDensity', 'exposure', 'night']) result[key] = THREE.MathUtils.lerp(a[key], b[key], mix);
  const solarAngle = (p - .25) * Math.PI * 2;
  result.sunDirection = new THREE.Vector3(-Math.cos(solarAngle) * .8, Math.sin(solarAngle) * .95, -.62).normalize();
  result.moonDirection = new THREE.Vector3(-.16 + Math.cos(solarAngle) * .16, -Math.sin(solarAngle) * .55, -.84).normalize();
  result.lightDirection = result.sunDirection.clone().lerp(result.moonDirection, result.night).normalize();
  // Palette night weights need not match the celestial horizon crossings.
  // Keep the key's blended azimuth but give its elevation a C1 soft floor:
  // constant below zero, quadratic through the handoff, then the original y.
  // The real sky directions above remain untouched.
  const direction = result.lightDirection, horizon = .05;
  if (direction.y < horizon * 2) {
    const elevation = horizon + Math.max(0, direction.y) ** 2 / (horizon * 4);
    const horizontalScale = Math.sqrt(1 - elevation ** 2) / Math.hypot(direction.x, direction.z);
    direction.set(direction.x * horizontalScale, elevation, direction.z * horizontalScale);
  }
  return result;
}

export class EnvironmentClock {
  constructor(mode = 'auto', { duration = 840, phase = TIME_PHASES.night } = {}) {
    this.mode = TIME_MODES.includes(mode) ? mode : 'auto';
    this.duration = Number.isFinite(duration) && duration > 0 ? duration : 840;
    this.phase = this.mode === 'auto' ? wrap(Number.isFinite(phase) ? phase : TIME_PHASES.night) : TIME_PHASES[this.mode];
    this.transition = null;
  }

  setMode(mode, immediate = false) {
    if (!TIME_MODES.includes(mode)) return false;
    this.mode = mode;
    if (mode === 'auto') { this.transition = null; return true; }
    const target = TIME_PHASES[mode];
    if (immediate) { this.phase = target; this.transition = null; }
    else this.transition = { from: this.phase, delta: wrap(target - this.phase + .5) - .5, elapsed: 0 };
    return true;
  }

  update(dt, { paused = false, reducedMotion = false } = {}) {
    const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .1) : 0;
    if (this.transition) {
      this.transition.elapsed += delta;
      const fraction = reducedMotion ? 1 : Math.min(1, this.transition.elapsed / 2.4);
      this.phase = wrap(this.transition.from + this.transition.delta * smooth(fraction));
      if (fraction === 1) this.transition = null;
    } else if (this.mode === 'auto' && !paused && !reducedMotion) this.phase = wrap(this.phase + delta / this.duration);
    return sampleEnvironment(this.phase);
  }
}
