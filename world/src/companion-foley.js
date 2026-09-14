// Original project-authored material foley; no recordings, melodies or voices.
// Adopted unchanged from the root R1 draft. Playback belongs to WorldAudio.
export const COMPANION_FOLEY_VERSION = 'living-v8-original-foley-r1';
export const COMPANION_FOLEY_KINDS = Object.freeze([
  'sign-lift', 'sign-tap', 'elizabeth-step', 'elizabeth-puff',
  'dog-step', 'dog-breath', 'dog-collar',
]);
const TAU = Math.PI * 2;
const durations = { 'sign-lift': .32, 'sign-tap': .24, 'elizabeth-step': .18,
  'elizabeth-puff': .40, 'dog-step': .22, 'dog-breath': .68, 'dog-collar': .36 };
const levels = { 'sign-lift': .17, 'sign-tap': .29, 'elizabeth-step': .18,
  'elizabeth-puff': .19, 'dog-step': .24, 'dog-breath': .13, 'dog-collar': .10 };

function random(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 * 2 - 1; };
}
function resonance(frequency, decay, gain, dt) {
  if (dt < 0) return 0;
  return Math.sin(TAU * frequency * dt) * Math.exp(-dt / decay) * gain;
}
function pulse(t, duration, attack=.008) {
  return Math.min(1, Math.max(0, t / attack)) * Math.pow(Math.max(0, 1-t/duration), 1.6);
}

/** Mono Float32 data; replay through the existing effects bus, not a new context. */
export function createCompanionFoley(kind, sampleRate=48000, variant=0) {
  if (!COMPANION_FOLEY_KINDS.includes(kind)) throw new RangeError('Unknown foley kind');
  if (!Number.isInteger(sampleRate) || sampleRate < 16000 || sampleRate > 192000) throw new RangeError('Invalid sample rate');
  if (!Number.isInteger(variant) || variant < 0 || variant > 3) throw new RangeError('Variant must be 0..3');
  const duration=durations[kind], data=new Float32Array(Math.ceil(sampleRate*duration));
  const noise=random(19337+COMPANION_FOLEY_KINDS.indexOf(kind)*919+variant*31), pitch=1+(variant-1.5)*.023;
  let slow=0, middle=0, fast=0;
  const alpha=f=>1-Math.exp(-TAU*f/sampleRate);
  const lowA=alpha(180), midA=alpha(1350), highA=alpha(4700);
  for(let i=0;i<data.length;i++) {
    const t=i/sampleRate, n=noise();
    slow+=(n-slow)*lowA; middle+=(n-middle)*midA; fast+=(n-fast)*highA;
    const body=middle-slow, air=fast-middle;
    let value=0;
    if(kind==='sign-tap') {
      // Damped wooden plate modes with a brief fibrous impact, not a note/chime.
      value=resonance(382*pitch,.042,.56,t)+resonance(923*pitch,.029,.30,t)
        +resonance(1769*pitch,.018,.18,t)+air*Math.exp(-t/.013)*.72;
    } else if(kind==='sign-lift') {
      // Hand/wood friction with two irregular grip accents.
      const grain=.42+.26*Math.sin(TAU*29*t)+.20*Math.sin(TAU*47.3*t);
      value=body*grain*pulse(t,duration,.034)
        +resonance(540*pitch,.024,.20,t-.069)+resonance(766*pitch,.017,.12,t-.221);
    } else if(kind==='elizabeth-step') {
      // Broad soft webbed contact, with a restrained rubbery body resonance.
      const phase=TAU*(132*pitch*t-120*t*t);
      value=(Math.sin(phase)*.31+slow*2.0)*Math.exp(-t/.037)
        +body*Math.exp(-t/.021)*.36;
    } else if(kind==='elizabeth-puff') {
      // Brief comic breath gesture: filtered air, with no voice or dialogue sample.
      const env=Math.pow(Math.sin(Math.PI*Math.min(1,t/duration)),1.4)*Math.exp(-t*3.4);
      value=(body*.83+air*.19)*(1+.11*Math.sin(TAU*17.4*t))*env;
    } else if(kind==='dog-step') {
      // Weight first, then a soft grass scuff. The high band stays deliberately low.
      value=resonance(76*pitch,.036,.31,t)+resonance(143*pitch,.024,.17,t)
        +slow*Math.exp(-t/.035)*1.6+body*Math.exp(-t/.027)*.35
        +air*.14*Math.exp(-Math.pow((t-.062)/.025,2));
    } else if(kind==='dog-breath') {
      // Two relaxed breaths with slightly unequal envelopes.
      const env=Math.exp(-Math.pow((t-.17)/.092,2))+.65*Math.exp(-Math.pow((t-.48)/.11,2));
      value=(body*.85+slow*.46+air*.09)*env;
    } else if(kind==='dog-collar') {
      // Two tiny metal contacts, inharmonic and short, avoiding a UI reward bell.
      for(const [at, gain] of [[0,1],[.083,.43]]) {
        const d=t-at;
        value+=resonance(2381*pitch,.045,.50*gain,d)
          +resonance(3947*pitch,.032,.28*gain,d)+resonance(6173*pitch,.021,.12*gain,d);
      }
    }
    const edge=Math.min(1,t/.003,(duration-t)/.015);
    data[i]=value*Math.max(0,edge);
  }
  let peak=0,mean=0;
  for(const x of data) { peak=Math.max(peak,Math.abs(x)); mean+=x; }
  mean/=data.length;
  // Preserve relative authored levels; remove tiny DC and gently close both ends.
  const gain=levels[kind]/Math.max(peak,1e-9);
  for(let i=0;i<data.length;i++) {
    const edge=Math.min(1,i/(sampleRate*.003),(data.length-1-i)/(sampleRate*.008));
    data[i]=(data[i]-mean)*gain*Math.max(0,edge);
  }
  return data;
}

/** Uses only the caller's already-unlocked context; creates no nodes or context. */
export function createCompanionFoleyBuffer(context,kind,variant=0) {
  if(!context||typeof context.createBuffer!=='function')throw new TypeError('An existing audio context is required');
  const samples=createCompanionFoley(kind,context.sampleRate,variant);
  const buffer=context.createBuffer(1,samples.length,context.sampleRate);
  buffer.copyToChannel(samples,0);
  return buffer;
}

/** Smooth finite local falloff. WorldAudio owns listener distance and bus gain. */
export function companionFoleyGain(distance) {
  if(!Number.isFinite(distance)||distance<0||distance>=18)return 0;
  return (1-(distance/18)**2)**2/(1+distance/8);
}
