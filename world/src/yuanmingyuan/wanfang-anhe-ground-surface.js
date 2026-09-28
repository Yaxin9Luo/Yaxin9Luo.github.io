import {Color,Matrix4} from 'three';
import {loadJiuzhouGravelTextures,loadJiuzhouMeadowTextures} from './jiuzhou-landscape-material.js';
import {createFrontCourtGroundMaterial} from './front-court-ground-surface.js';
import {createWanfangAnheGroundField} from './wanfang-anhe-ground-field.js';
/** Reuse the verified six-channel 4K material binding with Wanfang's own field.
 * This owner restores the original continuous land before releasing borrowed maps. */
export async function prepareWanfangAnheGroundSurface({terrain,site,plantingLayout,signal,meadowOwner,loadGravel=loadJiuzhouGravelTextures,loadMeadow=loadJiuzhouMeadowTextures}={}){
 signal?.throwIfAborted();const lifetime=new AbortController(),bindings=[],errors=[],borrowedMeadow=meadowOwner!==undefined;let gravel,meadow=meadowOwner,field,material,disposed=false;
 const run=fn=>{try{fn();}catch(error){errors.push(error);}};
 function dispose(){
  if(!disposed){
   disposed=true;signal?.removeEventListener('abort',abort);
   for(const binding of bindings)if(binding.mesh.material===material)binding.mesh.material=binding.original;
   run(()=>material?.dispose());run(()=>field?.texture.dispose());
   run(()=>gravel?.dispose());if(!borrowedMeadow)run(()=>meadow?.dispose());
   run(()=>lifetime.abort(signal?.reason));
  }
  if(errors.length)throw new AggregateError(errors,'Wanfang ground cleanup failed');
 }
 const abort=()=>{try{dispose();}catch{}};
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{
  if(disposed)lifetime.signal.throwIfAborted();
  if(!terrain?.group||terrain.disposed||!terrain.earthMaterial?.isMaterial)throw new Error('Wanfang ground requires the current complete terrain.');
  const lands=terrain.group.children.filter(mesh=>mesh.isMesh&&mesh.userData.body==='land'&&mesh.name==='yuanming-continuous-land'&&mesh.geometry?.name==='yuanming-continuous-land');
  if(lands.length!==1||lands[0].material!==terrain.earthMaterial)throw new Error('Wanfang ground requires its unique original continuous land mesh.');
  const land=lands[0],landGeometry=land.geometry,originalMaterial=terrain.earthMaterial;
  // The Museum lends its existing three maps; their sampler state is untouched.
  function assertBorrowedMeadow(){
   if(borrowedMeadow&&(!meadow||meadow.disposed||meadow.resolution!=='4k'||typeof meadow.dispose!=='function'||meadow.source!==originalMaterial.userData.earthTextureSource||['map','normalMap','roughnessMap'].some(slot=>meadow[slot]!==originalMaterial[slot]||!meadow[slot]?.isTexture||meadow[slot].image?.width!==4096||meadow[slot].image?.height!==4096)))throw new Error('Wanfang borrowed meadow must be the current live canonical 4K owner.');
  }
  assertBorrowedMeadow();
  const a=await loadGravel({signal:lifetime.signal});
  gravel=a;if(disposed||lifetime.signal.aborted){run(()=>a.dispose());lifetime.signal.throwIfAborted();}
  if(!borrowedMeadow){
   const b=await loadMeadow({signal:lifetime.signal});
   meadow=b;if(disposed||lifetime.signal.aborted){run(()=>b.dispose());lifetime.signal.throwIfAborted();}
  }
  assertBorrowedMeadow();
  if(terrain.disposed||land.parent!==terrain.group||land.geometry!==landGeometry||land.material!==originalMaterial||terrain.earthMaterial!==originalMaterial)throw new Error('Wanfang continuous land changed while preparing maps.');
  field=createWanfangAnheGroundField({site,plantingLayout});
  material=createFrontCourtGroundMaterial({original:terrain.earthMaterial,gravel,meadow,field});
  material.name='wanfang-private-grass-and-gravel-r2';
  material.userData={...material.userData,body:'contemporary-wanfang-ground',field:field.diagnostics};
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
   compile.call(material,shader,renderer);
   const palette=field.diagnostics.paletteSRGB;
   shader.uniforms.fcMeadowCool.value=new Color(palette.cool);
   shader.uniforms.fcMeadowWarm.value=new Color(palette.warm);
   shader.uniforms.fcPaleMineral.value=new Color(palette.mineral);
  };
  const cacheKey=material.customProgramCacheKey;material.customProgramCacheKey=()=>cacheKey()+':wanfang-garden-r2';
  bindings.push({mesh:land,original:originalMaterial,geometry:landGeometry});land.material=material;
  const identity=new Matrix4();
  function assertCurrent(){assertBorrowedMeadow();terrain.group.updateWorldMatrix(true,false);if(disposed||terrain.disposed||land.parent!==terrain.group||gravel.disposed||meadow.disposed||!terrain.group.matrixWorld.equals(identity)||bindings.some(b=>b.mesh.geometry!==b.geometry||b.mesh.material!==material))throw new Error('Wanfang ground binding changed.');}
  assertCurrent();
  return {field,material,assertCurrent,get disposed(){return disposed;},dispose,diagnostics:{id:'wanfang-ground-surface-r2',sixOriginal4KMaps:true,meadowOwnership:borrowedMeadow?'borrowed-global':'owned-local',terrainGeometryChanged:false,acceptedArt:false,field:field.diagnostics}};
 }catch(error){
  try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Wanfang ground preparation failed',{cause:error});}
  throw error;
 }
}
