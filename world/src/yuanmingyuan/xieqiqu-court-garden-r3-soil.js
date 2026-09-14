import {prepareXieqiquCourtGardenR1} from './xieqiqu-court-garden-r3.js';
import {loadCourtSoilMaterial} from './court-soil-material-r1.js';

// Inject this into the existing createXieqiquCourtGardenOwner.prepareGarden.
// The caller must pass the same explicit frozen plan used by its source loader.
// Importing does not load a model or fetch a texture. No production route uses it.
export function prepareCourtBandsWithSoilCandidate({soilBaseUrl='/textures/yuanmingyuan/court-soil-r1/',...options}={}){
  if(!options.layout)throw new Error('An explicit work candidate layout is required');
  return prepareXieqiquCourtGardenR1({
    ...options,
    createSoilMaterial:({signal,layout})=>loadCourtSoilMaterial({
      signal,layout,...(soilBaseUrl===undefined?{}:{baseUrl:soilBaseUrl}),
    }),
  });
}
