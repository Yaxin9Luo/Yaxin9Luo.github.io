import {createSpreadingPineStudy} from './spreading-pine-study.js';
import {prepareVegetationTexturePixels} from './vegetation-textures.js';
export async function prepareSpreadingPineFactory({signal}={}){
 signal?.throwIfAborted();let pixels=await prepareVegetationTexturePixels({signal,includeStone:false});signal?.throwIfAborted();let consumed=false;
 const drop=()=>{pixels=null;};signal?.addEventListener('abort',drop,{once:true});
 return ()=>{if(consumed)throw new Error('Spreading pine preparation was already consumed.');consumed=true;let owner;try{signal?.throwIfAborted();owner=createSpreadingPineStudy({texturePixels:pixels});signal?.throwIfAborted();return owner;}catch(error){owner?.dispose();throw error;}finally{signal?.removeEventListener('abort',drop);drop();}};
}
