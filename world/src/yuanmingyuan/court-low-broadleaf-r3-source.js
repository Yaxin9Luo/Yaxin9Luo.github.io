import * as THREE from 'three';
import {createCourtLowBroadleafR3} from './court-low-broadleaf-r3.js';
import {loadCourtLeafSurface} from './court-leaf-surface-r3.js';
import {courtBroadleafR3Review,assertCourtBroadleafR3Record} from './court-broadleaf-r3-profile.js';

// Load once per source bridge. The complete owner adopts the exclusive texture
// lease; callers retire borrowed instances/colliders before owner.dispose().
// Preparation rejects only after all late decodes and partial cleanup settle.
export async function loadCourtLowBroadleafR3Source({signal,baseUrl,fetcher,decode}={}){
 signal?.throwIfAborted();let surface=null,owner=null;
 try{
  surface=await loadCourtLeafSurface({signal,baseUrl,fetcher,decode});signal?.throwIfAborted();
  owner=createCourtLowBroadleafR3({THREE,signal,leafSurface:surface});signal?.throwIfAborted();
  const record=Object.freeze({part:owner.part,owner,review:courtBroadleafR3Review});
  assertCourtBroadleafR3Record(record);return record;
 }catch(error){
  const failures=[];
  try{owner?.dispose();}catch(cleanup){failures.push(cleanup);}
  // A rejected/pre-aborted factory may not have adopted its input lease.
  // An adopted lease is already retired by the factory, even if cleanup threw.
  if(surface&&!surface.disposed)try{surface.dispose();}catch(cleanup){failures.push(cleanup);}
  if(failures.length)throw new AggregateError([error,...failures],'Textured broadleaf R3 loading and cleanup failed',{cause:error});
  throw error;
 }
}
