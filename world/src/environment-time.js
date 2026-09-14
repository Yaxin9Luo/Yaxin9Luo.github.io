import * as THREE from 'three';
import { TIME_MODES, TIME_PHASES, DAY_DURATION_SECONDS, wrapPhase, normalizeTimeMode, formatClockTime, periodForPhase } from './time-contract.js';
export { TIME_MODES, TIME_PERIODS, TIME_PHASES, DAY_DURATION_SECONDS, normalizeTimeMode, formatClockTime, periodForPhase } from './time-contract.js';

const wrap = wrapPhase;
const smooth = value => value * value * (3 - 2 * value);

// Art-directed palettes. Lighting and sky share these values; surfaces keep
// their own albedo instead of receiving a full-screen colour filter.
const palettes = {
  night: { zenith: '#17244d', horizon: '#496c7b', cloud: '#536d8b', fog: '#354f66', key: '#c3deff', sky: '#b6d1eb', ground: '#596d88', fill: '#b7ccec', water: '#173d50', keyIntensity: 2.0, ambientIntensity: 1.1, fillIntensity: .4, fogDensity: .00135, exposure: 1.05, night: 1 },
  dawn: { zenith: '#7195c4', horizon: '#edbdb0', cloud: '#f0d1c0', fog: '#a8a9bc', key: '#ffd4b8', sky: '#cad6f0', ground: '#9f9694', fill: '#9aafdf', water: '#537481', keyIntensity: 2.15, ambientIntensity: 1.0, fillIntensity: .45, fogDensity: .0011, exposure: 1.0, night: .12 },
  day: { zenith: '#397bb1', horizon: '#c9e4e9', cloud: '#fff3dd', fog: '#abc6d5', key: '#fff0d5', sky: '#b3d6f2', ground: '#9d9d83', fill: '#bed8ef', water: '#236775', keyIntensity: 3.0, ambientIntensity: .95, fillIntensity: .6, fogDensity: .00095, exposure: 1.0, night: 0 },
  dusk: { zenith: '#6979ad', horizon: '#efac87', cloud: '#f4bc96', fog: '#b49da6', key: '#ffd2a5', sky: '#c2b9e0', ground: '#a39390', fill: '#a6bbe9', water: '#53697f', keyIntensity: 2.0, ambientIntensity: 1.0, fillIntensity: .42, fogDensity: .0012, exposure: 1.0, night: .28 },
};
palettes.noon = { ...palettes.day, zenith: '#3078b1', key: '#fff6e7', keyIntensity: 3.15, fogDensity: .0009 };
palettes.midnight = { ...palettes.night, zenith: '#121d40', horizon: '#405f73', cloud: '#48617e', ambientIntensity: 1.05, fillIntensity: .38 };
const colorKeys = ['zenith', 'horizon', 'cloud', 'fog', 'key', 'sky', 'ground', 'fill', 'water'];
for (const palette of Object.values(palettes)) for (const key of colorKeys) palette[key] = new THREE.Color(palette[key]);
const stops = [[0, 'midnight'], [.08, 'night'], [.19, 'night'], [.265, 'dawn'], [.36, 'day'], [.46, 'day'], [.5, 'noon'], [.54, 'day'], [.62, 'day'], [.735, 'dusk'], [.815, 'night'], [.92, 'night'], [1, 'midnight']];

// Explicit local review choices. Production clocks use the accepted stable solar/cloud variant.
export const LIGHTING_REVIEW_VARIANTS=Object.freeze([
  {id:'baseline',label:'Baseline / 基线'},
  {id:'pearl-fill',label:'Pearl front fill / 珍珠色补光'},
  {id:'solar-120',label:'Solar azimuth +120° / 太阳方位'},
  {id:'solar-120-stable',label:'Solar +120° · stable · cloud .83 / 云层基准'},
  {id:'solar-120-cloud70',label:'Solar +120° · stable · cloud .70 / 云层 .70'},
  {id:'solar-120-sunlit',label:'Sunlit garden · key / sky balance / 晴日庭园对照'},
]);
const pearlFill=new THREE.Color('#e5e1d7');
const linearLuminance=c=>c.r*.2126+c.g*.7152+c.b*.0722;

// These authored orbits occupy the western azimuth interval. Put the angular
// branch cut at positive Z, away from both paths, so nearly opposing sun/moon
// vectors travel through the west instead of cancelling or flipping arcs.
// This is an orbit-specific handoff, not a shortest-arc spherical interpolator.
export function blendWesternKeyDirections(sun,moon,night){
  if(night===0)return sun.clone();
  if(night===1)return moon.clone();
  const azimuth=v=>{const angle=Math.atan2(v.x,v.z);return angle>0?angle-Math.PI*2:angle;};
  const az=THREE.MathUtils.lerp(azimuth(sun),azimuth(moon),night);
  const elevation=THREE.MathUtils.lerp(Math.asin(THREE.MathUtils.clamp(sun.y,-1,1)),Math.asin(THREE.MathUtils.clamp(moon.y,-1,1)),night);
  const horizontal=Math.cos(elevation);
  return new THREE.Vector3(Math.sin(az)*horizontal,Math.sin(elevation),Math.cos(az)*horizontal);
}

export function sampleEnvironment(phase,{lightingVariant='baseline'}={}) {
  const p = wrap(Number.isFinite(phase) ? phase : TIME_PHASES.night);
  let index = 0;
  while (index < stops.length - 2 && p >= stops[index + 1][0]) index++;
  const [start, from] = stops[index], [end, to] = stops[index + 1];
  const mix = smooth((p - start) / (end - start));
  const a = palettes[from], b = palettes[to], result = { phase: p, label: mix < .5 ? from : to, period: periodForPhase(p) };
  for (const key of colorKeys) result[key] = a[key].clone().lerp(b[key], mix);
  for (const key of ['keyIntensity', 'ambientIntensity', 'fillIntensity', 'fogDensity', 'exposure', 'night']) result[key] = THREE.MathUtils.lerp(a[key], b[key], mix);
  const solarAngle = (p - .25) * Math.PI * 2;
  result.sunDirection = new THREE.Vector3(-Math.cos(solarAngle) * .8, Math.sin(solarAngle) * .95, -.62).normalize();
  result.lightingVariant=LIGHTING_REVIEW_VARIANTS.some(variant=>variant.id===lightingVariant)?lightingVariant:'baseline';
  result.solarAzimuthDegrees=['solar-120','solar-120-stable','solar-120-cloud70','solar-120-sunlit'].includes(result.lightingVariant)?120:0;
  result.cloudBlend=['solar-120-cloud70','solar-120-sunlit'].includes(result.lightingVariant)?.70:.83;
  if(result.solarAzimuthDegrees){
    // Rotate the real solar direction before deriving both sky and key. Keep
    // exact elevation, palette and the moon's orbit; this trial adds no fill.
    const {x,y,z}=result.sunDirection,angle=result.solarAzimuthDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    result.sunDirection.set(x*c+z*s,y,z*c-x*s);
  }
  result.moonDirection = new THREE.Vector3(-.16 + Math.cos(solarAngle) * .16, -Math.sin(solarAngle) * .55, -.84).normalize();
  result.keyHandoff=['solar-120-stable','solar-120-cloud70','solar-120-sunlit'].includes(result.lightingVariant)?'western-azimuth-elevation':'normalized-vector';
  result.lightDirection = result.keyHandoff==='western-azimuth-elevation'
    ?blendWesternKeyDirections(result.sunDirection,result.moonDirection,result.night)
    :result.sunDirection.clone().lerp(result.moonDirection, result.night).normalize();
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
  // Low-angle keys retain surface light without casting long black stripes.
  const shadowElevation = smooth(THREE.MathUtils.clamp((direction.y - .05) / .3, 0, 1));
  result.shadowIntensity = THREE.MathUtils.lerp(.72, .55, result.night) * shadowElevation;
  if(result.lightingVariant==='pearl-fill'){
    const matched=pearlFill.clone().multiplyScalar(linearLuminance(result.fill)/linearLuminance(pearlFill));
    result.fill.lerp(matched,1-result.night);
  }
  if(result.lightingVariant==='solar-120-sunlit'){
    // A local comparison of direct sun and existing sky fill. Keep the sky,
    // exposure, reflection source and night palette; fade through the horizon.
    const daylight=(1-result.night)*smooth(THREE.MathUtils.clamp((result.sunDirection.y-.10)/.40,0,1));
    result.keyIntensity*=1+.22*daylight;
    result.ambientIntensity*=1-.12*daylight;
    result.fillIntensity*=1-.25*daylight;
  }
  return result;
}

export class EnvironmentClock {
  constructor(mode = 'auto', { duration = DAY_DURATION_SECONDS, phase = TIME_PHASES.night } = {}) {
    this.mode = normalizeTimeMode(mode);
    this.duration = Number.isFinite(duration) && duration > 0 ? duration : DAY_DURATION_SECONDS;
    this.phase = this.mode === 'auto' ? wrap(Number.isFinite(phase) ? phase : TIME_PHASES.night) : TIME_PHASES[this.mode];
    this.transition = null;
    this.lightingReviewVariant='solar-120-sunlit';
  }

  setLightingReviewVariant(id){
    if(!LIGHTING_REVIEW_VARIANTS.some(variant=>variant.id===id))return false;
    this.lightingReviewVariant=id;return true;
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

  jumpTo(period, immediate = false) {
    if (!Object.hasOwn(TIME_PHASES, period)) return false;
    this.setMode(period, immediate);
    this.mode = 'auto';
    return true;
  }

  // activeDt is foreground, unpaused elapsed time supplied by Game. Movement's
  // safety clamp must never slow this clock down on a low-frame-rate device.
  update(activeDt, { paused = false, reducedMotion = false } = {}) {
    const delta = !paused && !reducedMotion && Number.isFinite(activeDt) ? Math.max(0, activeDt) : 0;
    if (this.transition) {
      this.transition.elapsed += delta;
      const fraction = Math.min(1, this.transition.elapsed / 2.4);
      const advance = this.mode === 'auto' ? this.transition.elapsed / this.duration : 0;
      this.phase = wrap(this.transition.from + this.transition.delta * smooth(fraction) + advance);
      if (fraction === 1) this.transition = null;
    } else if (this.mode === 'auto') this.phase = wrap(this.phase + delta / this.duration);
    return sampleEnvironment(this.phase,{lightingVariant:this.lightingReviewVariant});
  }

  getSnapshot({ paused = false, pauseReason = null, reducedMotion = false, started = true } = {}) {
    const sample = sampleEnvironment(this.phase);
    const reason = !started ? 'intro' : pauseReason || (reducedMotion ? 'reduced-motion' : paused ? 'reading' : null);
    return { mode: this.mode, phase: this.phase, label: sample.label, night: sample.night,
      period: sample.period, clockText: formatClockTime(this.phase), durationSeconds: this.duration,
      clockState: this.mode !== 'auto' ? 'fixed' : reason ? 'paused' : 'auto', pauseReason: reason,
      transitioning: Boolean(this.transition) };
  }
}
