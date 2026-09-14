import {gardenLayout,pointInPolygon} from './garden-layout.js';
import {museumSite} from './museum-sites.js';
import {createXianfaqiaoIntegrationDescriptor,xianfaqiaoArchive} from './xianfaqiao-integration.js';
import {createXieqiquCourtGround} from './xieqiqu-court-ground.js';
import {polygonBooleanRegions,polygonArea,ringBounds,distanceToRing} from './terrain-geometry.js';
import {Vector3} from 'three';

const ID='xianfaqiao-forelake-site-v1',CHANNEL='north-fuhai-waterway';
const GARDENS=['yuanmingyuan','changchunyuan'],SHA=/^[a-f0-9]{64}$/;
const candidates=new WeakSet(),admitted=new WeakMap(),waterHandoffs=new WeakSet();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const overlap=(a,b)=>{const x=ringBounds(a),y=ringBounds(b);return x.minX<=y.maxX&&x.maxX>=y.minX&&x.minZ<=y.maxZ&&x.maxZ>=y.minZ;};
const intersectionArea=(a,b)=>overlap(a,b)?polygonBooleanRegions([a,b],p=>pointInPolygon(p,a)&&pointInPolygon(p,b)).area:0;
const union=rings=>polygonBooleanRegions(rings,p=>rings.some(ring=>pointInPolygon(p,ring)));
function single(result,label){if(result.regions.length!==1||result.regions[0].holes.length)throw new Error(`${label} must remain one connected region without interior islands`);return result.regions[0].outer;}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function baseKey(layout){
  return JSON.stringify({gardens:GARDENS.map(id=>({id,boundary:layout.gardens.find(g=>g.id===id)?.boundary})),
    channel:layout.channels.find(c=>c.id===CHANNEL),coast:layout.exhibition.coast.polygon});
}
function channelRing(points,width){
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    left.push([points[i][0]-dz/length*width/2,points[i][1]+dx/length*width/2]);
    right.push([points[i][0]+dz/length*width/2,points[i][1]-dx/length*width/2]);
  }
  const ring=left.concat(right.reverse());return polygonArea(ring)<0?ring.reverse():ring;
}
function checkWetClearance(layout,patch){
  for(const feature of [...layout.waterBodies,...layout.ornamentalWaters,...layout.channels]){
    const polygon=feature.id===CHANNEL?patch.channel.polygon:feature.polygon;
    for(const dry of [patch.peerCourt,...patch.prepared.paths.map(p=>p.polygon),...patch.prepared.courts.map(c=>c.polygon)])
      if(intersectionArea(polygon,dry)>1e-7)throw new Error(`Xianfaqiao prepared ground intersects ${feature.id}; review the changed layout before admission`);
  }
}

/** Pure, inactive proposal for this one authored site frame. It does not change
 * the shared plan, register a site, load an asset, or grant native admission. */
export function createXianfaqiaoSitePatch({layout=gardenLayout,xieqiquSite=museumSite('xieqiqu')}={}){
  const descriptor=createXianfaqiaoIntegrationDescriptor({layout,xieqiquSite});
  if(JSON.stringify(xieqiquSite.position)!=='[395,4,-565]'||xieqiquSite.rotationY!==0||xieqiquSite.scale!==1)
    throw new Error('The Xianfaqiao parcel and channel bends require review for a changed Xieqiqu frame');
  const parcel=[[339,-626],[451,-626],[451,-460],[329,-460],[319,-492],[319,-546],[339,-578]];
  const existing=GARDENS.map(id=>layout.gardens.find(g=>g.id===id));
  if(existing.some(g=>!g?.boundary))throw new Error('Both sides of the shared Yuanmingyuan/Changchunyuan wall are required');
  const gardenBoundaries=existing.map(g=>({id:g.id,boundary:single(polygonBooleanRegions([g.boundary,parcel],p=>g.id==='changchunyuan'
    ?pointInPolygon(p,g.boundary)||pointInPolygon(p,parcel):pointInPolygon(p,g.boundary)&&!pointInPolygon(p,parcel)),g.id)}));
  const originalUnion=union(existing.map(g=>g.boundary)),nextUnion=union(gardenBoundaries.map(g=>g.boundary));
  if(Math.abs(originalUnion.area-nextUnion.area)>1e-6||intersectionArea(...gardenBoundaries.map(g=>g.boundary))>1e-7)
    throw new Error('The authored parcel must only transfer the shared boundary, retaining the combined garden area');
  const old=layout.channels.find(c=>c.id===CHANNEL);
  if(!old||old.centerline.length!==5||old.width!==12||old.surfaceY!==2||old.bedY!==.6)
    throw new Error('The north-Fuhai channel geometry and two-metre datum require a new review');
  const expected=gardenLayout.channels.find(c=>c.id===CHANNEL);
  if(JSON.stringify(old.centerline)!==JSON.stringify(expected.centerline)||JSON.stringify(old.polygon)!==JSON.stringify(expected.polygon))
    throw new Error('The north-Fuhai channel route changed before this candidate was prepared');
  const centerline=old.centerline.map(p=>[...p]);centerline[2][0]=320;centerline[3][0]=300;
  const channel={...structuredClone(old),centerline,polygon:channelRing(centerline,old.width),trace:undefined,
    evidence:'exhibition-design',alignment:{kind:'author-channel-clearance',metresCalibrated:false},
    limit:'Two authored bends shift west to retain a dry bank between the 2.0 m channel and the separate 3.8 m study forelake. Neither a surveyed route nor a historical hydraulic connection is asserted.'};
  const components=structuredClone(descriptor.prepared.courts);
  // Separate court holes would each build an above-water wall at their shared
  // edge. A single Boolean excavation removes that internal barrier entirely.
  const polygon=single(union(components.map(c=>c.polygon)),'Bridge/forelake excavation');
  const wet=single(union(components.map(c=>c.water.polygon)),'Bridge/forelake water');
  const court={id:'xianfaqiao-xieqiqu-connected-excavation',assetId:'xianfaqiao',polygon,floorY:Math.min(...components.map(c=>c.floorY)),rimY:4,
    sourceGroups:components.map(c=>c.sourceGroup),alignment:{kind:'authored-model-edge-alignment',metresCalibrated:false},
    water:{polygon:wet,surfacePolygon:wet,surfaceY:3.8,kind:'ornamental-basin',sourceIds:['xianfaqiao-authored-study','xieqiqu-authored-study']}};
  const paths=structuredClone(descriptor.prepared.paths);
  // The visible ground is triangulated independently of the ramp. A 1.4 m
  // pad can miss its terrain vertices, letting interpolated grass cross the
  // low ramp end. A 6 m footprint margin exceeds the 4.5 m local terrain edge
  // target and keeps the actual adjacent triangles below the stone approach.
  const pads=[...paths.map(p=>{const b=ringBounds(p.polygon);return {id:`${p.id}-substrate`,
    polygon:rect(b.minX-6,b.minZ-6,b.maxX+6,b.maxZ+6),heightY:3.97,blend:2,
    evidence:'exhibition-design',limit:'Ground support for the authored ramp, including a 6 m terrain-triangle margin; the paved path itself remains 1.4 m wide.'};}),
    {id:'xianfaqiao-forelake-rim-ground',polygon:structuredClone(polygon),heightY:4,blend:2}];
  const endpoints=[channel.fromWaterId,channel.toWaterId].map(id=>{
    const lake=layout.waterBodies.find(w=>w.id===id),area=lake?intersectionArea(channel.polygon,lake.polygon):0;
    if(area<=0)throw new Error(`The revised channel no longer meets ${id}`);
    return {id,overlapArea:area};
  });
  const peerSite={id:'xieqiqu',assetId:'xieqiqu',position:[395,4,-565],rotationY:0,scale:1};
  const peerGround=createXieqiquCourtGround(peerSite);
  const patch={id:ID,active:false,initializationOnly:true,baseKey:baseKey(layout),
    site:structuredClone(descriptor.site),peerSite,peerGround,
    evidence:{kind:'exhibition-design',coordinatesSurveyed:false,parcel:'Transfer inside the two-garden union; the sea coast and total garden outline do not move.',
      bends:[{index:2,from:[...old.centerline[2]],to:[...centerline[2]]},{index:3,from:[...old.centerline[3]],to:[...centerline[3]]}],
      water:'The two cropped source waters connect to each other at 3.8 m; a dry bank separates them from the 2.0 m coarse channel.'},
    parcel,gardenBoundaries,channel,peerCourt:rect(343,-616,447,-524.25),components,
    prepared:{courts:[court],pads,paths},support:structuredClone(descriptor.support),contactEdge:structuredClone(descriptor.water.contactEdge),
    compositionReview:structuredClone(descriptor.compositionReview),
    metrics:{originalGardenArea:originalUnion.area,gardenArea:nextUnion.area,originalChannelArea:Math.abs(polygonArea(old.polygon)),channelArea:Math.abs(polygonArea(channel.polygon)),
      bankGap:Math.min(...components[0].polygon.map(p=>distanceToRing(p,channel.polygon)),...channel.polygon.map(p=>distanceToRing(p,components[0].polygon))),channelEndpoints:endpoints},
    requirements:['explicit-composition-review-or-native-admission-for-the-loaded-bridge-hash','both-placed-full-owners-and-source-triangle-supports','same-plan-xieqiqu-court-pad-and-two-flower-pool-cuts','retain-both-owners-for-the-scene-lifetime','construct-terrain-and-water-once-before-source-water-handoff']};
  checkWetClearance(layout,patch);freeze(patch);candidates.add(patch);return patch;
}

function assertOwner(binding,site,review){
  const {owner,support}=binding??{};
  if(!owner?.group?.isObject3D||!owner.group.children.length||owner.disposed||typeof owner.dispose!=='function')throw new Error(`Xianfaqiao site needs the retained full ${site.assetId} owner`);
  const archive=owner.archive?.id===site.assetId&&SHA.test(owner.archive?.glbSHA256??'');
  // Xieqiqu currently uses loadMuseumModel's real source factory, not an
  // admitted archive. Accept that existing identity for opt-in composition
  // review only; do not fabricate an archive/hash or grant model admission.
  const source=review&&site.assetId==='xieqiqu'&&!owner.archive&&owner.group.userData.assetId==='xieqiqu-complete-group'&&owner.diagnostics?.assetId==='xieqiqu-complete-group';
  const original=owner.reviewSourceOwner;
  const courtReview=review&&site.assetId==='xieqiqu'&&!owner.archive&&
    owner.diagnostics?.assemblyId==='xieqiqu-court-garden-composition-r3-candidate'&&
    owner.diagnostics.assetId==='xieqiqu-r9-fish-integration-r1'&&
    owner.diagnostics.publicAdmission===false&&owner.diagnostics.historicalLayoutVerified===false&&
    original&&original!==owner&&!original.archive&&!original.disposed&&
    original.group===owner.group&&original.group.userData.assetId==='xieqiqu-complete-group'&&
    original.diagnostics?.assetId==='xieqiqu-complete-group'&&
    typeof original.dispose==='function'&&typeof original.assertCurrent==='function'&&
    typeof owner.assertCurrent==='function';
  if(!archive&&!source&&!courtReview)throw new Error(`Xianfaqiao site needs the retained full ${site.assetId} archive or explicit review source owner`);
  // Retain the real original owner behind the R9 decoration. Its different
  // diagnostics remain intact; this path grants only composition review.
  if(courtReview)owner.assertCurrent();
  if(owner.collisionGroup&&owner.collisionGroup!==owner.group||owner.namedGroupRoot&&owner.namedGroupRoot!==owner.group)
    throw new Error('Xianfaqiao water handoff requires the displayed source meshes; a separately batched display needs its own visibility adapter');
  if(!support||support.disposed||typeof support.surfaceAt!=='function'||support.diagnostics?.source!=='actual-static-mesh-triangles')
    throw new Error(`Xianfaqiao site needs actual source triangle support for ${site.assetId}`);
  owner.group.updateWorldMatrix(true,true);
  const s=site.scale,c=Math.cos(site.rotationY)*s,t=Math.sin(site.rotationY)*s,[x,y,z]=site.position;
  const expected=[c,0,-t,0,0,s,0,0,t,0,c,0,x,y,z,1],actual=owner.group.matrixWorld.elements;
  if(actual.some((v,i)=>!Number.isFinite(v)||Math.abs(v-expected[i])>1e-7))throw new Error(`The full ${site.assetId} owner is not at the reviewed world transform`);
}
function sourceSheets(patch,bindings){
  return patch.components.map(component=>{
    const group=bindings[component.assetId==='xianfaqiao'?'bridge':'peer'].owner.group.getObjectByName(component.sourceGroup),found=[];
    group?.traverse(node=>{if(node.isMesh&&node.geometry?.attributes?.position?.count&&node.material?.userData?.category==='water'&&node.material.userData.role==='surface')found.push(node);});
    if(found.length!==1)throw new Error(`Expected one source surface in ${component.sourceGroup}, found ${found.length}`);
    requireSourceSurface(found[0],component);
    return found[0];
  });
}
function assertReady(patch,bindings){
  const review=bindings.admission.mode==='composition-review';
  assertOwner(bindings.bridge,patch.site,review);assertOwner(bindings.peer,patch.peerSite,review);
  if(bindings.bridge.owner.archive.glbSHA256!==bindings.admission.glbSHA256)throw new Error('Loaded Xianfaqiao hash differs from the explicit site admission');
  const probes=[...Object.values(patch.support.endpoints).map(point=>({point,binding:bindings.bridge})),
    {point:patch.prepared.paths[0].from,binding:bindings.peer}];
  for(const {point,binding} of probes){
    const hit=binding.support.surfaceAt(point[0],point[2],{maxY:point[1]+.02});
    if(!hit||!Number.isFinite(hit.height)||Math.abs(hit.height-point[1])>.02||hit.walkable!==true)
      throw new Error('The real source triangles do not support the reviewed bridge/court joins');
  }
  sourceSheets(patch,bindings);
}

/** Explicit review is allowed for the transport-checked bridge while native and
 * world approval remain false. The old native-admission path remains available.
 * Both paths borrow retained full owners; neither decodes/disposes resources. */
export function activateXianfaqiaoSitePatch(candidate,{admission,bridge,peer}={}){
  if(!candidates.has(candidate))throw new Error('Use the prepared inactive Xianfaqiao site candidate');
  const review=admission?.mode==='composition-review';
  if(review?(admission.nativeApproved!==false||admission.composedWorldApproved!==false):admission?.nativeApproved!==true)
    throw new Error('Xianfaqiao site activation requires explicit composition review with approvals false, or native admission');
  if(!SHA.test(admission.manifestSHA256??'')||!SHA.test(admission.glbSHA256??'')||review&&(admission.manifestSHA256!==xianfaqiaoArchive.manifestSHA256||admission.glbSHA256!==xianfaqiaoArchive.glbSHA256))
    throw new Error('Xianfaqiao site admission must identify the exact reviewed manifest/GLB hash');
  const bindings={admission:{...admission},bridge,peer,waterBound:false},active=Object.freeze({...candidate,active:true,admission:Object.freeze({...admission})});
  assertReady(active,bindings);admitted.set(active,bindings);return active;
}

/** Called only while assembling a new landscape, never against live terrain. */
export function applyXianfaqiaoSitePatch(plan,patch){
  if(!patch?.active)return plan;
  const bindings=admitted.get(patch);if(!bindings)throw new Error('Xianfaqiao active flag is not a readiness/admission token');
  assertReady(patch,bindings);
  if(baseKey(plan.layout)!==patch.baseKey)throw new Error('Xianfaqiao base layout changed; prepare and review a fresh site candidate');
  checkWetClearance(plan.layout,patch);
  requirePeerGround(plan,patch);
  const ids=new Set([...plan.courts,...plan.pads,...plan.paths].map(item=>item.id));
  if([...patch.prepared.courts,...patch.prepared.pads,...patch.prepared.paths].some(item=>ids.has(item.id)))throw new Error('Xianfaqiao site inputs are already applied');
  const gardens=plan.layout.gardens.map(g=>{
    const changed=patch.gardenBoundaries.find(item=>item.id===g.id);
    return changed?{...g,boundary:changed.boundary,trace:undefined,alignment:{kind:'exhibition-shared-boundary-transfer',metresCalibrated:false}}:g;
  });
  return {...plan,layout:{...plan.layout,gardens,channels:plan.layout.channels.map(c=>c.id===CHANNEL?patch.channel:c)},
    courts:plan.courts.concat(patch.prepared.courts),pads:plan.pads.concat(patch.prepared.pads),paths:plan.paths.concat(patch.prepared.paths),
    sitePatches:[...(plan.sitePatches??[]),{id:patch.id,assetIds:['xianfaqiao','xieqiqu'],initializationOnly:true,admission:patch.admission}]};
}

/** Final synchronous handoff, after the terrain and composed water exist. Call
 * the returned restore before releasing either source owner. No shared material,
 * stone bed, flow, fountain sheet or borrowed resource is changed/disposed. */
export function bindXianfaqiaoSourceWater(patch,{terrain,water}={}){
  const bindings=admitted.get(patch);if(!bindings)throw new Error('Water handoff requires the admitted Xianfaqiao site input');
  assertReady(patch,bindings);
  if(bindings.waterBound)throw new Error('Xianfaqiao source water is already bound');
  const court=patch.prepared.courts[0],surfaces=terrain?.waterSurfaces?.filter(w=>w.id===`${court.id}-water`),surface=surfaces?.[0],cuts=terrain?.courtFootprints?.filter(value=>value.id===court.id),snapshot=water?.snapshot?.();
  if(terrain?.disposed||!terrain?.group?.children.length||surfaces?.length!==1||!surface?.geometry?.isBufferGeometry||surface.worldY!==court.water.surfaceY||!same(surface.polygon,court.water.surfacePolygon)
    ||cuts?.length!==1||!sameCourt(cuts[0],court)||snapshot?.disposed!==false)
    throw new Error('The matching terrain opening and composed 3.8 m water owner must be ready before source sheets are hidden');
  for(const expected of patch.peerGround.courts){const found=terrain.courtFootprints.filter(value=>value.id===expected.id);if(found.length!==1||!sameCourt(found[0],expected))throw new Error('The live terrain is missing the matching Xieqiqu flower-pool openings');}
  requireComposedLake(surface,water,snapshot);
  const previous=sourceSheets(patch,bindings).map(node=>({node,visible:node.visible,hadNavigation:Object.hasOwn(node.userData,'navigation'),navigation:node.userData.navigation}));
  if(previous.some(p=>waterHandoffs.has(p.node)))throw new Error('Xianfaqiao source water is already bound by another site input');
  try{for(const {node} of previous){node.visible=false;node.userData.navigation=false;}}
  catch(error){try{restoreSheets(previous);}catch(cleanup){throw new AggregateError([error,cleanup],'Xianfaqiao water handoff and rollback failed');}throw error;}
  for(const {node} of previous)waterHandoffs.add(node);bindings.waterBound=true;
  let restored=false;
  return ()=>{if(restored)return;restored=true;bindings.waterBound=false;for(const {node} of previous)waterHandoffs.delete(node);restoreSheets(previous.splice(0));};
}

function sameCourt(actual,expected){
  return actual.floorY===expected.floorY&&actual.rimY===expected.rimY&&(actual.rimBlend??14)===(expected.rimBlend??14)&&same(actual.polygon,expected.polygon)
    &&actual.water?.surfaceY===expected.water.surfaceY&&same(actual.water?.polygon,expected.water.polygon)&&same(actual.water?.surfacePolygon,expected.water.surfacePolygon);
}
function requirePeerGround(plan,patch){
  for(const expected of patch.peerGround.pads){
    const found=plan.pads.filter(p=>p.id===expected.id);
    if(found.length!==1||found[0].heightY!==expected.heightY||found[0].blend!==expected.blend||!same(found[0].polygon,expected.polygon))throw new Error('Xianfaqiao requires the same-plan Xieqiqu court pad from readyAssetIds');
  }
  for(const expected of patch.peerGround.courts){
    const found=plan.courts.filter(c=>c.id===expected.id);
    if(found.length!==1||!sameCourt(found[0],expected))throw new Error('Xianfaqiao requires both matching Xieqiqu flower-pool cuts and water levels');
  }
}

function visitTriangles(geometry,matrix,visit){
  const p=geometry?.attributes?.position,index=geometry?.index,total=index?.count??p?.count,start=geometry?.drawRange?.start??0,count=geometry?.drawRange?.count??Infinity,end=Math.min(total,start+count);
  if(!geometry?.isBufferGeometry||!p||!Number.isInteger(start)||start<0||start%3||!(count===Infinity||Number.isInteger(count)&&count>=0)||!Number.isInteger(end)||end%3)throw new Error('Invalid drawn Xianfaqiao water geometry');
  const vertices=[new Vector3(),new Vector3(),new Vector3()];let visited=0;
  for(let i=start;i<end;i+=3){
    for(let j=0;j<3;j++){
      const at=index?index.getX(i+j):i+j;if(!Number.isInteger(at)||at<0||at>=p.count)throw new Error('Invalid Xianfaqiao water triangle index');
      const v=vertices[j].fromBufferAttribute(p,at);if(matrix)v.applyMatrix4(matrix);if(![v.x,v.y,v.z].every(Number.isFinite))throw new Error('Non-finite Xianfaqiao water vertex');
    }
    visit(vertices);visited++;
  }
  return visited;
}
function requireSourceSurface(mesh,component){
  if(mesh.isInstancedMesh)throw new Error('Xianfaqiao source water must be one direct source mesh');
  const ring=component.water.surfacePolygon,planeY=component.water.surfaceY;let area=0;
  visitTriangles(mesh.geometry,mesh.matrixWorld,vertices=>{
    if(!vertices.every(v=>Math.abs(v.y-planeY)<=1e-6))return;
    for(const v of vertices)if(!pointInPolygon([v.x,v.z],ring)&&distanceToRing([v.x,v.z],ring)>4e-5)throw new Error(`Source water footprint changed: ${component.sourceGroup}`);
    const [a,b,c]=vertices;area+=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
  });
  if(Math.abs(area-Math.abs(polygonArea(ring)))>1e-3)throw new Error(`Source water plane or complete footprint changed: ${component.sourceGroup}`);
}
function waterKey(vertices){
  const keys=vertices.map(v=>`${Math.fround(v.x)},${Math.fround(v.z)}`),first=keys.indexOf([...keys].sort()[0]);
  return [keys[first],keys[(first+1)%3],keys[(first+2)%3]].join('|');
}
function requireComposedLake(surface,water,snapshot){
  if(!water?.group?.isObject3D||water.group.visible===false||!Array.isArray(water.sheets)||water.sheets.length!==snapshot.sheets?.length)throw new Error('The actual composed Xianfaqiao water meshes must be ready');
  const required=new Set();
  visitTriangles(surface.geometry,null,vertices=>{if(vertices.some(v=>Math.abs(v.y)>1e-6))throw new Error('Xianfaqiao terrain water must use its declared zero-height geometry');required.add(waterKey(vertices));});
  if(!required.size)throw new Error('Empty Xianfaqiao terrain water geometry');
  water.group.updateWorldMatrix(true,true);
  for(let i=0;i<water.sheets.length;i++){
    const record=snapshot.sheets[i];if(record.height!==surface.worldY)continue;
    const sheet=water.sheets[i];
    // createGardenWater raises its rendered plane 6 mm above the navigation
    // datum. Retain that existing offset; a matching label at another real
    // height must not pass the geometric handoff check.
    if(!sheet?.isMesh||sheet.isInstancedMesh||sheet.parent!==water.group||sheet.visible===false||sheet.material?.visible===false||!Number.isFinite(record.planeY)||Math.abs(record.planeY-surface.worldY-.006)>1e-6)throw new Error('The composed Xianfaqiao water sheet is not drawable at its datum');
    visitTriangles(sheet.geometry,sheet.matrixWorld,vertices=>{
      if(vertices.some(v=>Math.abs(v.y-record.planeY)>1e-6))throw new Error('Xianfaqiao composed water differs from its actual declared plane');
      required.delete(waterKey(vertices));
    });
  }
  if(required.size)throw new Error('The composed water is missing actual triangles of the connected bridge and Xieqiqu lake');
}
function restoreSheets(previous){
  const errors=[];
  for(const p of previous)for(const restore of [()=>{p.node.visible=p.visible;},()=>{if(p.hadNavigation)p.node.userData.navigation=p.navigation;else delete p.node.userData.navigation;}])try{restore();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Xianfaqiao source water restoration failed');
}
