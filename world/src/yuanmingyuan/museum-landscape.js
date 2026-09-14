import {gardenLayout} from './garden-layout.js';
import {museumSites,sitePoint} from './museum-sites.js';
import {HILL,SCREEN_LAYOUT} from './xianfa-landscape-layout.js';
import {hanjingtangPlan} from './hanjingtang-layout.js';
import {zhengjuesiPlan} from './zhengjuesi-layout.js';
import {haiyueLayout} from './haiyue-layout.js';
import {applyXianfaqiaoSitePatch} from './xianfaqiao-site-patch.js';
import {createXieqiquCourtGround} from './xieqiqu-court-ground.js';
import {createFangwaiguanCourtGround,bindFangwaiguanCourtWater} from './fangwaiguan-court-ground.js';

function xianfashanGround(site,fanghe,layout,ready){
  const point=([x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,p.z];};
  const xyz=(owner,p)=>{const q=sitePoint(owner,p);return[q.x,q.y,q.z];};
  const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  const alignment={kind:'admitted-model-hill-substrate',assetId:'xianfashan',metresCalibrated:false};
  const limit='Mound square, gate spacing and path endpoints follow the authored asset; only the approximately 8 m hill and 1.5 m road have institutional size evidence.';
  // moundGeometry is a 51.6 m square with a closed bottom at local -0.30.
  // The separate ground approaches have bottom -0.17 and top +0.04.
  const courts=[{id:'xianfashan-mound-substrate',assetId:'xianfashan',polygon:rect(-25.8,-25.8,25.8,25.8).map(point),floorY:site.position[1]-.33*site.scale,rimY:site.position[1]-.18*site.scale,alignment,limit}];
  const pads=[{id:'xianfashan-ground-approaches',polygon:rect(-44,-28.27,36,28.27).map(point),heightY:site.position[1]-.18*site.scale,blend:2*site.scale,alignment,limit}];
  const paths=[];
  function path(id,from,to,width){
    const dx=to[0]-from[0],dz=to[2]-from[2],length=Math.hypot(dx,dz),nx=-dz/length*width/2,nz=dx/length*width/2;
    const polygon=[[from[0]-nx,from[2]-nz],[to[0]-nx,to[2]-nz],[to[0]+nx,to[2]+nz],[from[0]+nx,from[2]+nz]];
    paths.push({id,from,to,width,thickness:.32*site.scale,polygon,kind:'exhibition-ground-path',evidence:'exhibition-design',coordinatesSurveyed:false,limit:'A new dry-land visitor connection between the authored endpoints; not a reconstructed historical road or bridge.'});
    pads.push({id:`${id}-substrate`,polygon,heightY:Math.min(from[1],to[1])-.27*site.scale,blend:2*site.scale,alignment:{kind:'exhibition-path-substrate',metresCalibrated:false}});
  }
  path('xianfashan-west-arrival-link',xyz(site,[-48,0,0]),xyz(site,[-44,.04,0]),3.48*site.scale);
  if(fanghe)path('xianfashan-fanghe-bank-link',xyz(site,[36,.04,0]),xyz(fanghe,[SCREEN_LAYOUT.water.x0-5.7,0,0]),2.44*site.scale);
  // The admitted mound has a flat local-zero top at every visible boundary.
  // Its few lower west-edge vertices are covered by the 3.48 m stone approach.
  // Apply this last: the broad -0.18 substrate must not expose the mound's
  // square side. The existing excavation still excludes all land inside it.
  pads.push({id:'xianfashan-mound-edge-ground',polygon:courts[0].polygon.map(p=>[...p]),heightY:site.position[1],blend:4*site.scale,alignment:{kind:'admitted-model-visible-mound-edge',assetId:'xianfashan',metresCalibrated:false},limit:'An authored 4 m ground transition outside the existing mound excavation, meeting its visible local-zero boundary below the +0.04 stone paving; not a measured historical planting edge.'});
  const coarse=layout.landforms.filter(hill=>hill.id==='xianfa-hill');
  // A caller can partition this bounded part of the initial terrain and swap
  // its support together with the ready owner, without rebuilding the garden.
  // Include the existing 14 m court height blend and each pad's outside blend.
  const bounds={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};
  for(const {polygon,margin} of [...coarse.map(hill=>({polygon:hill.polygon,margin:0})),...courts.map(court=>({polygon:court.polygon,margin:14})),...pads.map(pad=>({polygon:pad.polygon,margin:pad.blend}))])for(const [x,z] of polygon){bounds.minX=Math.min(bounds.minX,x-margin);bounds.maxX=Math.max(bounds.maxX,x+margin);bounds.minZ=Math.min(bounds.minZ,z-margin);bounds.maxZ=Math.max(bounds.maxZ,z+margin);}
  for(const key of ['minX','minZ'])bounds[key]-=1;for(const key of ['maxX','maxZ'])bounds[key]+=1;
  return {id:'xianfashan-ground-replacement',assetId:'xianfashan',ready,removedLandformIds:['xianfa-hill'],coarseLandforms:coarse,bounds,polygon:rect(bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ),prepared:{courts,pads,paths},
    sourceSupport:{mound:'xianfashan-complete-earth-mound',ramp:'xianfashan-winding-stone-deck',approaches:'xianfashan-ground-approaches',height:HILL.height,clearPathWidth:HILL.clearPathWidth},
    activation:'Activate only with a retained, placed full owner and its triangle support; replace the local terrain and support together. Failed or pending owners retain the coarse state.'};
}

// Adapt the coarse planning diagram to geometry already admitted for exhibition.
// This is model/terrain alignment, not newly established historical surveying.
export function createMuseumLandscape({layout=gardenLayout,sites=museumSites,readyAssetIds=[],xianfaqiaoPatch=null}={}){
  const fanghe=sites.find(site=>site.assetId==='fanghe-xianfahua');
  let ornamentalWaters=layout.ornamentalWaters,landforms=layout.landforms,islands=layout.islands;
  const pads=[],courts=[],paths=[],replacements=[],ready=new Set(readyAssetIds),assetWallReplacements=[...(layout.assetWallReplacements||[])];
  const xieqi=sites.find(site=>site.assetId==='xieqiqu');
  if(xieqi&&ready.has('xieqiqu')){const prepared=createXieqiquCourtGround(xieqi);pads.push(...prepared.pads);courts.push(...prepared.courts);}
  const fangwai=sites.find(site=>site.assetId==='fangwaiguan');
  if(fangwai&&ready.has('fangwaiguan')){const prepared=createFangwaiguanCourtGround(fangwai);pads.push(...prepared.pads);courts.push(...prepared.courts);}
  if(fanghe){
    const w=SCREEN_LAYOUT.water;
    const ring=[[w.x0,-w.halfWidth],[w.x1,-w.halfWidth],[w.x1,w.halfWidth],[w.x0,w.halfWidth]];
    const point=([x,z],y=0)=>sitePoint(fanghe,[x,y,z]);
    const old=layout.ornamentalWaters.find(water=>water.id==='fanghe');
    const water={...old,id:'fanghe',polygon:ring.map(p=>{const q=point(p);return[q.x,q.z];}),surfaceY:point([0,0],w.level).y,bedY:point([0,0],w.floor-.15).y,
      trace:undefined,alignment:{kind:'admitted-model-local-basin',assetId:fanghe.assetId,metresCalibrated:false},limit:'Aligned with the authored scenic-wall model; neither global registration nor historic basin measurements are established.'};
    ornamentalWaters=layout.ornamentalWaters.filter(item=>item.id!=='fanghe').concat(water);
    pads.push({id:'fanghe-bank-ground',polygon:[[w.x0-5.7,-w.halfWidth-3.6],[57,-w.halfWidth-3.6],[57,w.halfWidth+3.6],[w.x0-5.7,w.halfWidth+3.6]].map(p=>{const q=point(p);return[q.x,q.z];}),heightY:fanghe.position[1]-.27,blend:3});
  }
  const hill=sites.find(site=>site.assetId==='xianfashan');
  if(hill){
    const replacement=xianfashanGround(hill,fanghe,layout,ready.has('xianfashan'));replacements.push(replacement);
    if(replacement.ready){
      landforms=layout.landforms.filter(hill=>hill.id!=='xianfa-hill');
      pads.push(...replacement.prepared.pads);courts.push(...replacement.prepared.courts);paths.push(...replacement.prepared.paths);
    }
  }
  const hanjing=sites.find(site=>site.assetId==='hanjingtang');
  if(hanjing){
    const b=hanjingtangPlan.boundary;
    // The model owns its paving, steps and inscription-gallery foundations.
    // A level substrate follows that real court, leaving lake shores untouched.
    pads.push({id:'hanjingtang-court-ground',polygon:[[b.west,b.north],[b.east,b.north],[b.east,b.south],[b.west,b.south]].map(([x,z])=>{const p=sitePoint(hanjing,[x,0,z]);return[p.x,p.z];}),heightY:hanjing.position[1]-.03*hanjing.scale,blend:2*hanjing.scale});
  }
  const temple=sites.find(site=>site.assetId==='zhengjuesi');
  if(temple){
    const b=zhengjuesiPlan.boundary,point=([x,z])=>{const p=sitePoint(temple,[x,0,z]);return[p.x,p.z];};
    const footprint=[[b.west,b.north],[b.east,b.north],[b.east,b.south],[b.divisionX,b.south],[b.divisionX,80],[4,80],[4,96],[-4,96],[-4,80],[b.west,80]];
    pads.push({id:'zhengjuesi-court-ground',polygon:footprint.map(point),heightY:temple.position[1]-.03*temple.scale,blend:2*temple.scale});
    // The detailed temple supplies the entire rear enclosure, including its
    // open northern gateway. Do not draw a second coarse garden wall through it.
    assetWallReplacements.push({id:'zhengjuesi-rear-enclosure',assetId:'zhengjuesi',gardenIds:['qichunyuan'],position:point([(b.west+b.east)/2,b.north]),width:(b.east-b.west)*temple.scale,evidence:'admitted-model-wall-alignment',kind:'asset-owned-enclosure',limit:'Replaced by the actual temple north wall and its gateway; this is not an 83 m historical open gate.'});
  }
  const haiyue=sites.find(site=>site.assetId==='haiyue');
  if(haiyue){
    // The masonry owns the circular shore and all four docks. Keep the dry
    // substrate inside it; the old coarse polygon protruded into the lake.
    const lower=haiyueLayout.terraces[0],radius=lower.radius-.8;
    const polygon=Array.from({length:96},(_,i)=>{const a=i/96*Math.PI*2,p=sitePoint(haiyue,[Math.cos(a)*radius,0,Math.sin(a)*radius]);return[p.x,p.z];});
    const heightY=sitePoint(haiyue,[0,lower.topY-.06,0]).y;
    islands=layout.islands.map(island=>island.id==='haiyue-island'?{...island,polygon,anchor:[...haiyue.position],heightY,trace:undefined,alignment:{kind:'admitted-model-masonry-footprint',assetId:'haiyue',metresCalibrated:false},limit:'Substrate fitted beneath the authored circular terrace; not a surveyed historic shoreline.'}:island);
    pads.push({id:'haiyue-terrace-substrate',polygon,heightY,blend:.5*haiyue.scale});
  }
  const aviary=sites.find(site=>site.assetId==='yangquelong');
  if(aviary){
    // Match the admitted court's 72-sided paving holes and the pool component's
    // separate 64-sided inner wall and water sheet. These are model dimensions.
    const point=([x,z])=>{const p=sitePoint(aviary,[x,0,z]);return[p.x,p.z];};
    const level=y=>sitePoint(aviary,[0,y,0]).y;
    const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(point);
    const circle=(z,r,n)=>Array.from({length:n},(_,i)=>point([-6.6+Math.sin(i/n*Math.PI*2)*r,z+Math.cos(i/n*Math.PI*2)*r]));
    const alignment={kind:'admitted-model-court-and-basin',assetId:'yangquelong',metresCalibrated:false};
    const limit='Fitted beneath the authored Yangquelong paving and stone basins; not measured historical pool dimensions.';
    const rimY=level(-.21),channel=rect(13,-23.5,18,23.5);
    pads.push({id:'yangquelong-court-ground',polygon:rect(-19,-24,22,24),heightY:rimY,blend:2*aviary.scale,alignment,limit});
    function basin(name,polygon,floorY,wetPolygon,surfacePolygon,surfaceY){
      courts.push({id:`${name}-excavation`,assetId:'yangquelong',sourceGroup:name,polygon,floorY,rimY,alignment,limit,
        water:{polygon:wetPolygon,surfacePolygon,surfaceY,kind:'ornamental-basin',sourceIds:['yangquelong-admitted-model']}});
    }
    basin('yangquelong-east-water-channel',channel,level(-.87),channel,channel,level(-.30));
    for(const [name,z] of [['north',-4.85],['south',4.85]])basin(`yangquelong-west-pool-${name}`,circle(z,1.30,72),level(-.43),circle(z,1.08,64),circle(z,1.065,64),level(.17));
    // Do not add these to ornamentalWaters: the model owns the narrow banks,
    // pool rims and open bridge, so terrain must not generate its wide shore rails.
  }
  return applyXianfaqiaoSitePatch({layout:{...layout,ornamentalWaters,landforms,islands,assetWallReplacements},pads,courts,paths,replacements},xianfaqiaoPatch);
}

export function configureMuseumLandscapeAsset(resource,site,{terrain,water}={}){
  if(site.assetId==='fangwaiguan')return bindFangwaiguanCourtWater(createFangwaiguanCourtGround(site),{owner:resource,terrain,water});
  if(site.assetId==='yangquelong'){
    const sheets=[];
    for(const name of ['yangquelong-east-water-channel','yangquelong-west-pool-north','yangquelong-west-pool-south']){
      const basin=resource.group.getObjectByName(name),found=[];
      if(!basin)throw new Error(`The Yangquelong model is missing its named basin ${name}.`);
      basin.traverse(mesh=>{if(mesh.isMesh&&mesh.material?.userData?.category==='water'&&mesh.material.userData.role==='surface')found.push(mesh);});
      if(found.length!==1)throw new Error(`Expected one Yangquelong study water sheet in ${name}, found ${found.length}.`);
      sheets.push(found[0]);
    }
    // Validate all three before mutation. High wall bowls share water materials;
    // hide only these meshes, retaining flows, animation and archive ownership.
    for(const sheet of sheets){sheet.visible=false;sheet.userData.navigation=false;}
    return;
  }
  if(site.assetId!=='fanghe-xianfahua')return;
  // The landscape now owns this exact water polygon and its reflection. Keep
  // the archival mesh/resources intact but suppress the duplicate study sheet.
  const basin=resource.group.getObjectByName('xianfahua-fanghe-basin');
  if(!basin)throw new Error('The Fanghe model is missing its named basin.');
  let sheets=0;
  basin.traverse(mesh=>{
    if(mesh.isMesh&&mesh.material?.userData?.category==='water'&&mesh.material.userData.role==='surface'){
      mesh.visible=false;mesh.userData.navigation=false;sheets++;
    }
  });
  if(sheets!==1)throw new Error(`Expected one Fanghe study water sheet, found ${sheets}.`);
}
