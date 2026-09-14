import {createXieqiquCourtGardenR3Study} from './xieqiqu-court-garden-r3-study.js';
import {createCourtBandsR3Drifts} from './xieqiqu-court-garden-r3-layout.js';
import {createCourtBandsR3Sources} from './court-planting-sources-r3.js';
import {prepareCourtBandsWithSoilCandidate} from './xieqiqu-court-garden-r3-soil.js';
import {loadCourtLowBroadleafR3Source} from './court-low-broadleaf-r3-source.js';
import {courtBroadleafR3Profile,courtBroadleafR3Review,courtBroadleafR3Contract} from './court-broadleaf-r3-profile.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export function createCourtRealLeafLayout(){
 const p=courtBroadleafR3Profile,base=createCourtBandsR3Drifts({broadleafRootRadius:p.rootRadius}),id='xieqiqu-court-garden-r4-bilberry-leaf-r3';
 // Lower and shift only the west outer topiary to reveal the annex window line.
 // The complete original tree is retained; this is authored exhibition planting.
 const placements=base.placements.map(p=>p.id==='west-main-garden-band-juniper-1'?{...p,x:-25.8,z:-42.35,scale:.84}:p);
 return freeze({...base,id,placements,status:'work-textured-real-leaf-awaiting-native-composition',
  evidence:{...base.evidence,id,description:'Contemporary paired formal garden bands around the open pool and axis. Original curved-leaf broadleaf shrubs, sedge, flower accents and clipped junipers are authored exhibition planting, not recovered historical specimens or measured planting coordinates.'},
  sourceLayout:{regions:[{id,placements:placements.map(placement=>({species:placement.species}))}]},
  sourceProfileEvidence:{'low-broadleaf':courtBroadleafR3Review,sourceAssetId:p.id,sourceTriangles:p.triangles,rootMinY:p.rootMinY,rootRadius:p.rootRadius,
   representation:'complete opaque curved leaf geometry with original BilberryLeaf01 front PBR',alphaMap:false,alphaTest:0,sourceTextures:3,textureDimensions:[1024,2048],normalConvention:'directx',normalScale:[1,-1],sourceFreezeSHA256:p.sourceFreezeSHA256,historicallySurveyed:false},
 });
}
const createRealLeafSources=options=>createCourtBandsR3Sources({...options,loadBroadleaf:loadCourtLowBroadleafR3Source,broadleafContract:courtBroadleafR3Contract});
const prepareRealLeafGarden=options=>prepareCourtBandsWithSoilCandidate({...options,broadleafContract:courtBroadleafR3Contract});

// Reuse the complete R9 building, paving/soil owners and scene lifecycle. Only
// the separately identified low broadleaf source and its real footprint change.
export function createXieqiquCourtGardenR4Study({layout=createCourtRealLeafLayout(),createSources=createRealLeafSources,prepareGarden=prepareRealLeafGarden,...options}={}){
 return createXieqiquCourtGardenR3Study({...options,layout,createSources,prepareGarden});
}
