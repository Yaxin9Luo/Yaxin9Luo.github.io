import {COMPANION_CLEARANCE} from '../companion-system.js';
import {segmentSolid} from './architecture-surface.js';
import {createSpatialIndex} from './terrain-geometry.js';
import {museumSupport} from './museum-support.js';
import {createGuideSweepVolume} from './guide-architecture-sweep.js';

// The museum terrain and the current building remain static for this owner's
// lifetime. Cache exact query coordinates, never a rounded height grid. Moving
// actors are still added and checked by the companion controller every step.
export function createMuseumGuideWorld({site,terrain,architecture,centre={x:site?.position?.[0],z:site?.position?.[2]},cacheLimit=40000,visitorCollider=()=>null}={}){
  if(!site?.position||!terrain?.surfaceAt||!Array.isArray(terrain.colliders)||!Number.isInteger(cacheLimit)||cacheLimit<1)throw new Error('A guide world needs a static museum site and terrain.');
  const ceiling=site.position[1]+((site.guide?.[1]??0)+.85)*(site.scale??1),cellSize=32,guideBounds={minX:centre.x-26,maxX:centre.x+26,minZ:centre.z-26,maxZ:centre.z+26};
  const localGround=terrain.createGuideSupport?.(guideBounds);let localArchitecture;
  try{localArchitecture=architecture?.createGuideSupport?.(guideBounds,{maxY:ceiling,cellSize:.25});}catch(error){localGround?.dispose();throw error;}
  const records=terrain.colliders.map(segment=>({solid:segmentSolid(segment),bounds:{minX:Math.min(segment.from[0],segment.to[0])-segment.radius,maxX:Math.max(segment.from[0],segment.to[0])+segment.radius,minZ:Math.min(segment.from[1],segment.to[1])-segment.radius,maxZ:Math.max(segment.from[1],segment.to[1])+segment.radius}}));
  const colliders=records.map(record=>record.solid),index=createSpatialIndex(records,record=>record.bounds,cellSize),cache=new Map();
  let disposed=false,cacheSize=0,oldest=null,newest=null,queries=0,cacheHits=0,cacheMisses=0,cacheEvictions=0,groundQueries=0,architectureQueries=0,collisionQueries=0,collisionCandidates=0;
  const sweepCache=new Map(),sweepCacheLimit=128,sweepCounts={queries:0,cacheHits:0,volumeQueries:0,candidateScans:0,boundsRejected:0,shapecasts:0,triangleTests:0,supportWitnessCandidates:0,supportWitnessTriangles:0,supportWitnessQueries:0,supportWitnessHits:0,enclosureRaycasts:0,enclosureHits:0,hits:0,unavailable:0};
  function touch(entry){
    if(newest===entry)return;
    if(entry.previous)entry.previous.next=entry.next;else oldest=entry.next;
    if(entry.next)entry.next.previous=entry.previous;
    entry.previous=newest;entry.next=null;
    if(newest)newest.next=entry;newest=entry;if(!oldest)oldest=entry;
  }
  function surfaceAt(x,z){
    if(disposed||!Number.isFinite(x)||!Number.isFinite(z))return null;
    queries++;const entry=cache.get(x)?.get(z);
    if(entry){cacheHits++;touch(entry);return entry.value;}
    cacheMisses++;groundQueries++;
    const ground=(localGround||terrain).surfaceAt(x,z,{maxY:ceiling});
    const buildingSource=localArchitecture||architecture;if(buildingSource)architectureQueries++;
    const building=buildingSource?.surfaceAt(x,z,{maxY:ceiling}),hit=museumSupport(ground,building),result=hit?.walkable===false?null:hit;
    // Evict one cold point rather than flushing all three guides' useful
    // support on the same frame. Exact coordinates and null hits are retained.
    if(cacheSize>=cacheLimit){
      const evicted=oldest,column=cache.get(evicted.x);column.delete(evicted.z);if(!column.size)cache.delete(evicted.x);
      oldest=evicted.next;if(oldest)oldest.previous=null;else newest=null;
      evicted.previous=null;evicted.next=null;cacheSize--;cacheEvictions++;
    }
    const added={x,z,value:result,previous:newest,next:null};
    if(newest)newest.next=added;else oldest=added;newest=added;
    if(!cache.has(x))cache.set(x,new Map());cache.get(x).set(z,added);cacheSize++;
    return result;
  }
  const heightAt=(x,z)=>surfaceAt(x,z)?.height;heightAt.surfaceAt=surfaceAt;
  function collidersFor(from,to=from,kind='elizabeth',interaction=false){
    if(disposed)return [];
    const bounds=COMPANION_CLEARANCE[kind]?.[interaction?'interaction':'body'];
    if(!bounds||![from?.x,from?.z,to?.x,to?.z].every(Number.isFinite))return colliders;
    // A circle encloses all rotations of the full raised-board envelope, its
    // 22-cm safety skin and arc sweep allowance. Entire segments are queried.
    const radius=Math.hypot(Math.max(-bounds.minX,bounds.maxX)+.22,Math.max(-bounds.minZ,bounds.maxZ)+.22)+.01;
    const box={minX:Math.min(from.x,to.x)-radius,maxX:Math.max(from.x,to.x)+radius,minZ:Math.min(from.z,to.z)-radius,maxZ:Math.max(from.z,to.z)+radius},found=new Set();
    for(let x=Math.floor(box.minX/cellSize);x<=Math.floor(box.maxX/cellSize);x++)for(let z=Math.floor(box.minZ/cellSize);z<=Math.floor(box.maxZ/cellSize);z++)for(const record of index.at(x*cellSize,z*cellSize)){
      const b=record.bounds;if(b.maxX>=box.minX&&b.minX<=box.maxX&&b.maxZ>=box.minZ&&b.minZ<=box.maxZ)found.add(record.solid);
    }
    collisionQueries++;collisionCandidates+=found.size;return [...found];
  }
  function sweepBlocked(segment){
    sweepCounts.queries++;
    if(disposed||architecture?.disposed===true){sweepCache.clear();sweepCounts.unavailable++;return true;}
    if(!architecture)return false;
    if(typeof architecture.intersectsGuideVolume!=='function'){sweepCounts.unavailable++;return true;}
    // The owned source and its transforms are static for this guide world's
    // lifetime. Cache complete numeric vertices, never rounded positions or a
    // rotation-insensitive endpoint key. Keep this separate cache strictly tiny.
    const key=JSON.stringify([segment.from.y,segment.to.y,segment.vertices.flatMap(p=>[p.x,p.y,p.z]),segment.supportSurfaceIds??[]]);
    if(sweepCache.has(key)){
      const hit=sweepCache.get(key);sweepCache.delete(key);sweepCache.set(key,hit);sweepCounts.cacheHits++;return hit;
    }
    const volume=createGuideSweepVolume(segment);if(!volume){sweepCounts.unavailable++;return true;}
    sweepCounts.volumeQueries++;
    const blocked=architecture.intersectsGuideVolume({...volume,supportAt:surfaceAt,counters:sweepCounts});
    // A malformed/old architecture adapter cannot silently authorize a walk.
    if(typeof blocked!=='boolean'){sweepCounts.unavailable++;return true;}
    if(sweepCache.size>=sweepCacheLimit)sweepCache.delete(sweepCache.keys().next().value);
    sweepCache.set(key,blocked);return blocked;
  }
  const bindings={heightAt,colliders,waterLevel:2,collidersFor,sweepBlocked};
  return {...bindings,getWorld:()=>({...bindings,visitorCollider:visitorCollider()}),
    snapshot:()=>({queries,cacheHits,cacheMisses,cacheEvictions,cacheEntries:cacheSize,cacheLimit,groundQueries,architectureQueries,collisionQueries,collisionCandidates,totalStaticColliders:colliders.length,localSupportTriangles:localGround?.triangleCount??null,localArchitectureSupport:localArchitecture?.snapshot?.()??null,architectureSweeps:{...sweepCounts,cacheEntries:sweepCache.size,cacheLimit:sweepCacheLimit},disposed}),
    dispose(){if(disposed)return;disposed=true;cache.clear();sweepCache.clear();cacheSize=0;oldest=null;newest=null;localGround?.dispose();localArchitecture?.dispose();architecture=null;index.clear();records.length=0;colliders.length=0;},
  };
}
