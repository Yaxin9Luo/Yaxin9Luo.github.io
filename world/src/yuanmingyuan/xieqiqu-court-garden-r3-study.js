import {createXieqiquCourtCompositionR3} from './xieqiqu-court-composition-r3.js';
import {prepareXieqiquStoneFishMaterialPixels} from './xieqiqu-stone-fish-material-study.js';
import {bindCourtPavingMaterialCandidate} from './court-paving-material-r2.js';

import {createCourtBandsR3Drifts} from './xieqiqu-court-garden-r3-layout.js';
import {createCourtBandsR3Sources} from './court-planting-sources-r3.js';
import {loadCourtLowBroadleafSource} from './court-low-broadleaf-source.js';
import {prepareCourtBandsWithSoilCandidate} from './xieqiqu-court-garden-r3-soil.js';

const createSourcesForCourt=options=>createCourtBandsR3Sources({...options,loadBroadleaf:loadCourtLowBroadleafSource});

// The fish and paving use the exact same Marble021 delivery. Decode it once;
// their independent texture owners retain the arrays they need after release.
export async function createXieqiquCourtGardenR3Study({
  signal,onProgress=()=>{},layout=createCourtBandsR3Drifts(),createSources=createSourcesForCourt,
  prepareGarden=prepareCourtBandsWithSoilCandidate,loadBase,
  preparePixels=prepareXieqiquStoneFishMaterialPixels,
  assemble=createXieqiquCourtCompositionR3,bindPaving=bindCourtPavingMaterialCandidate,
}={}){
  signal?.throwIfAborted();
  onProgress({stage:'court-stone-materials'});
  const pixels=await preparePixels({signal});let owner=null;
  try{
    signal?.throwIfAborted();
    owner=await assemble({
      signal,onProgress,layout,createSources,prepareGarden,...(loadBase?{loadBase}:{}),
      fishPixels:pixels,
      decoratePaving:({group,signal})=>{
        const anchor=group.getObjectByName('xieqiqu-court-paving'),meshes=[];
        anchor?.traverse(node=>{if(node.isMesh)meshes.push(node);});
        if(meshes.length!==1)throw new Error('R3 requires the complete original single paving mesh');
        return bindPaving({floor:meshes[0],courtRoot:group,pixels:pixels.maps,signal});
      },
    });
    signal?.throwIfAborted();return owner;
  }catch(error){
    const failures=[];
    try{owner?.dispose();}catch(cleanup){failures.push(cleanup);}
    try{await owner?.whenIdle?.();}catch(cleanup){failures.push(cleanup);}
    if(failures.length)throw new AggregateError([error,...failures],'R3 publication and cleanup failed',{cause:error});
    throw error;
  }finally{pixels.dispose();}
}
