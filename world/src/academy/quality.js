// Quality tiers and the adaptive governor for the lean Academy.
// Static content (tree count, terrain grid) is chosen once from the starting
// tier; the governor then trades render resolution and optional effects for
// frame time while the game runs.

export const TIERS={
  low:{id:'low',pixelRatio:1,terrainStep:3,treeDensity:.5,antialias:false,shadows:false,particles:160,fireflies:0,windSway:false,stars:.7},
  medium:{id:'medium',pixelRatio:1.5,terrainStep:2,treeDensity:.8,antialias:true,shadows:false,particles:320,fireflies:90,windSway:true,stars:1},
  high:{id:'high',pixelRatio:2,terrainStep:2,treeDensity:1,antialias:true,shadows:true,particles:480,fireflies:200,windSway:true,stars:1},
};
const ORDER=['low','medium','high'];

// GPU names that are known to struggle with even modest 3D scenes.
const WEAK=/swiftshader|llvmpipe|software|microsoft basic|mali-[t4]|mali-g[57]\d|adreno \(tm\) [1-5]\d\d|adreno [1-5]\d\d|powervr|intel.*(hd graphics|uhd graphics|gma)|intel\(r\) (hd|uhd)|^(hd|uhd) graphics|intel.*iris(?!.*xe)|iris\(tm\) (plus|pro)? ?graphics \d/i;
const MID=/iris.*xe|radeon\(tm\) graphics|radeon graphics|vega \d|adreno.*6\d\d|apple m1\b|apple gpu|mali-g7[1-9]|geforce (mx|gt )/i;

/** Best starting tier for a device; the governor still adapts afterwards. */
export function guessTier({renderer='',cores=8,memory=8,mobile=false}={}){
  const name=String(renderer||'');
  let tier=WEAK.test(name)?'low':MID.test(name)?'medium':'high';
  if(mobile)tier=ORDER[Math.max(0,ORDER.indexOf(tier)-1)];
  if(cores&&cores<=4&&tier==='high')tier='medium';
  if(memory&&memory<=4)tier='low';
  return tier;
}

/**
 * Settings preference -> starting tier. 'auto' (and legacy values from the old
 * world's settings, which defaulted everyone to 'high') follow the device guess;
 * 'balanced' caps at medium; 'low' forces low. 'high' is honoured only when the
 * visitor's device guess is not weak, otherwise the governor would be fighting it.
 */
export function startingTier(preference,guess){
  if(preference==='low')return 'low';
  if(preference==='balanced'||preference==='medium')return guess==='low'?'low':'medium';
  return guess;
}

const percentile=(values,p)=>{const v=[...values].sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.max(0,Math.ceil(v.length*p)-1))];};

/**
 * Feeds on per-frame cost in milliseconds. When GPU timer queries exist the
 * caller passes max(cpu, gpu) (independent of vsync); otherwise the rAF interval.
 * Returns a change ({scale, effects}) when it decides to move, else null.
 */
export function createGovernor({budgetMs=14,headroomMs=8.5,windowMs=1500,minSamples=20,minScale=.55,maxScale=1,step=.1,upWindows=4,lockMs=20000,usesInterval=false}={}){
  // With only rAF intervals, vsync hides headroom: treat 60 Hz frames as "fits".
  const high=usesInterval?20:budgetMs,low=usesInterval?17.6:headroomMs;
  const state={scale:maxScale,effects:0,samples:[],windowStart:null,good:0,lockedUntil:0,probe:null,changes:0};
  function sample(costMs,now){
    if(!Number.isFinite(costMs)||costMs<=0||costMs>250){return null;}
    if(state.windowStart===null)state.windowStart=now;
    state.samples.push(costMs);
    if(now-state.windowStart<windowMs||state.samples.length<minSamples)return null;
    const p90=percentile(state.samples,.9);state.samples.length=0;state.windowStart=now;
    if(p90>high){
      state.good=0;
      if(state.probe&&now-state.probe.at<windowMs*2.5)state.lockedUntil=now+lockMs;
      state.probe=null;
      if(state.scale>minScale+1e-6){state.scale=Math.max(minScale,+(state.scale-step).toFixed(2));return change();}
      if(state.effects<2){state.effects++;return change();}
      return null;
    }
    if(p90<low){
      state.good++;
      if(state.good>=upWindows&&now>=state.lockedUntil){
        state.good=0;
        if(state.effects>0){state.effects--;state.probe={at:now};return change();}
        if(state.scale<maxScale-1e-6){state.scale=Math.min(maxScale,+(state.scale+step).toFixed(2));state.probe={at:now};return change();}
      }
    }else state.good=0;
    return null;
  }
  function change(){state.changes++;return {scale:state.scale,effects:state.effects};}
  return {sample,get scale(){return state.scale;},get effects(){return state.effects;},get changes(){return state.changes;},
    reset(){state.samples.length=0;state.windowStart=null;state.good=0;},
    snapshot(){return {scale:state.scale,effects:state.effects,changes:state.changes,locked:state.lockedUntil};}};
}
