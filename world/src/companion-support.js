import {sampleGroundSurface} from './ground-motion.js';
import {horizontalProjection} from './companion-footprint.js';

// A small index of actual collision planes, rebuilt when progressive world
// bindings change. Unbounded/complex solids stay in the fallback list.
function horizontalBounds(solid){
  // Expand each original half-plane by the narrow phase's EPS BEFORE finding
  // intersections. A fixed AABB padding misses rotated/acute corners.
  const points=horizontalProjection(solid?.planes,1e-5);if(!points)return null;
  return {minX:Math.min(...points.map(p=>p.x))-1e-5,maxX:Math.max(...points.map(p=>p.x))+1e-5,minZ:Math.min(...points.map(p=>p.z))-1e-5,maxZ:Math.max(...points.map(p=>p.z))+1e-5};
}

/** Live rendered surfaces plus the existing walkable upper-face semantics. */
export function createCompanionSupport(getWorld){
  let previousHeight,previousColliders,world,cells=new Map(),fallback=[],order=new Map(),pointCache=new Map(),disposed=false;
  function refresh(){
    if(disposed)return false;
    world=getWorld();if(typeof world?.heightAt!=='function'||!Array.isArray(world.colliders))return false;
    if(world.heightAt===previousHeight&&world.colliders===previousColliders)return true;
    previousHeight=world.heightAt;previousColliders=world.colliders;cells=new Map();fallback=[];order=new Map(world.colliders.map((solid,index)=>[solid,index]));pointCache.clear();
    for(const solid of world.colliders){
      const b=horizontalBounds(solid);
      if(!b||(Math.ceil((b.maxX-b.minX)/4)+1)*(Math.ceil((b.maxZ-b.minZ)/4)+1)>4096){fallback.push(solid);continue;}
      for(let x=Math.floor(b.minX/4);x<=Math.floor(b.maxX/4);x++)for(let z=Math.floor(b.minZ/4);z<=Math.floor(b.maxZ/4);z++){
        const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(solid);
      }
    }
    return true;
  }
  function surfaceAt(x,z){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!refresh())return null;
    const key=x+','+z;if(pointCache.has(key))return pointCache.get(key);
    const base=world.heightAt(x,z);if(!Number.isFinite(base))return null;
    // This local court layer is at most 30 cm above its authored base. Higher
    // decks remain obstacles; route relief/edges still use the stricter 65 mm.
    // Defer the expensive underlying terrain normal unless it wins. Geometry
    // selection only uses heights; a selected tile keeps its exact face normal.
    const point=()=>base;point.surfaceAt=()=>({height:base,normal:{x:0,y:1,z:0}});
    const candidates=[...(cells.get(Math.floor(x/4)+','+Math.floor(z/4))||[]),...fallback].sort((a,b)=>order.get(a)-order.get(b));
    const hit=sampleGroundSurface(x,z,base+.30,{heightAt:point,colliders:candidates});
    if(hit?.surfaceId==='terrain')hit.normal=sampleGroundSurface(x,z,base+.30,{heightAt:world.heightAt,colliders:[]}).normal;
    const result=hit?{...hit,height:hit.y}:null;
    if(pointCache.size>=32768)pointCache.clear();pointCache.set(key,result);return result;
  }
  function collidersFor(from,to,kind,interaction=false){
    if(!refresh())return null;
    // Both accepted actors and their padded sign/action envelopes fit in this
    // 3.3 m horizontal radius; it encloses the full rotation and translation.
    const radius=3.3,result=new Set(fallback);
    for(let x=Math.floor((Math.min(from.x,to.x)-radius)/4);x<=Math.floor((Math.max(from.x,to.x)+radius)/4);x++)for(let z=Math.floor((Math.min(from.z,to.z)-radius)/4);z<=Math.floor((Math.max(from.z,to.z)+radius)/4);z++)for(const solid of cells.get(x+','+z)||[])result.add(solid);
    return [...result].sort((a,b)=>order.get(a)-order.get(b));
  }
  const heightAt=(x,z)=>surfaceAt(x,z)?.height;
  heightAt.surfaceAt=surfaceAt;
  return {heightAt,collidersFor,invalidate(){previousHeight=null;pointCache.clear();},dispose(){disposed=true;cells.clear();order.clear();pointCache.clear();fallback=[];world=null;previousHeight=previousColliders=null;}};
}
