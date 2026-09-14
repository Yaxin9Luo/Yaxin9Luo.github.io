import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {beveledBlock,assignArchitecturalUVs} from './architecture.js';
import {loadPBRTexture,loadImageTexture} from './asset-cache.js';
import {loadGLTF} from './gltf-resource.js';
import {loadHerbariumCommunityAssets} from './herbarium-community.js';
import {waterGardenContourPoint} from './herbarium-layout.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),UP=V(0,1,0),owners=new WeakMap(),localMaterials=new WeakMap();
const rng=seed=>()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
const materials={};
function material(name,color,extra={}){return new THREE.MeshStandardMaterial({name:`Herbarium ${name}`,color,roughness:.85,...extra,userData:{sharedAsset:true,...extra.userData}});}
function botanicalMaps(){
  const width=512,height=1024,pigment=new Uint8Array(width*height*4),normal=new Uint8Array(width*height*4),relief=new Float32Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/(width-1),v=y/(height-1),mid=Math.exp(-(((u-.5)/.009)**2));let vein=0;
    for(let k=0;k<10;k++)vein=Math.max(vein,Math.exp(-(((v-(.04+k*.091+Math.abs(u-.5)*.58))/.004)**2)));
    const noise=Math.sin(x*2.1+y*1.78)*Math.sin(x*.27-y*.93),tone=.80+.09*mid+.065*vein+.025*noise+.09*Math.sin(v*Math.PI);relief[y*width+x]=mid*.4+vein*.13+noise*.012;
    const i=(y*width+x)*4;pigment[i]=tone*242;pigment[i+1]=tone*255;pigment[i+2]=tone*231;pigment[i+3]=255;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const h=(a,b)=>relief[Math.max(0,Math.min(height-1,b))*width+Math.max(0,Math.min(width-1,a))],n=V((h(x-1,y)-h(x+1,y))*2,(h(x,y-1)-h(x,y+1))*2,1).normalize(),i=(y*width+x)*4;normal[i]=(n.x*.5+.5)*255;normal[i+1]=(n.y*.5+.5)*255;normal[i+2]=(n.z*.5+.5)*255;normal[i+3]=255;}
  const texture=(data,srgb)=>{const t=new THREE.DataTexture(data,width,height);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=8;t.needsUpdate=true;t.name=`Original herbaceous ${srgb?'pigment':'veins'} 512x1024`;t.userData.sharedAsset=true;return t;};
  return {map:texture(pigment,true),normalMap:texture(normal,false)};
}
export function getHerbariumMaterials(){
  if(materials.stone)return materials;
  Object.assign(materials,{
    stone:material('warm limestone','#d6ccb6'),trim:material('pale dressed limestone','#e2dbc9'),mortar:material('recessed mortar','#797b69'),floor:material('weathered paving','#b9b5a4'),
    iron:material('verdigris primary iron','#476d5d',{metalness:.63,roughness:.86}),brass:material('aged brass fasteners','#a8904f',{metalness:.77,roughness:.42}),wood:material('oiled oak','#816348',{roughness:.75}),soil:material('rooted loam','#514b32',{roughness:1}),pot:material('fired terracotta','#ad7760'),submerged:material('optically attenuated submerged rhizomes','#879982',{roughness:1,emissive:'#657b63',emissiveIntensity:.24}),
    glass:new THREE.MeshPhysicalMaterial({name:'Herbarium clear slightly aged glazing',color:'#f3f6f1',metalness:0,roughness:.035,transmission:.985,thickness:.028,ior:1.46,transparent:false,opacity:1,side:THREE.DoubleSide,depthWrite:true,envMapIntensity:1.15,userData:{sharedAsset:true,surface:'glazing',glassThickness:.028}}),
    water:new THREE.MeshPhysicalMaterial({name:'Herbarium quiet clear water',color:'#426558',roughness:.075,metalness:.035,transparent:true,opacity:.88,depthWrite:false,transmission:0,ior:1.333,thickness:0,attenuationColor:'#3b725a',attenuationDistance:.62,clearcoat:.8,clearcoatRoughness:.10,envMapIntensity:1.3,side:THREE.DoubleSide,userData:{sharedAsset:true}}),
    ripple:material('restrained pale ripples','#b6d5be',{roughness:.2,transparent:true,opacity:.32,depthWrite:false}),
  });
  const maps=botanicalMaps();
  for(const[name,color]of Object.entries({leaf:'#395d31',sage:'#637449',darkLeaf:'#27452b',lime:'#627e39',ivory:'#eee7cd',pink:'#db9faa',violet:'#9982b6',yellow:'#d8b95d'}))materials[name]=material(name,color,{...maps,normalScale:new THREE.Vector2(.32,.32),roughness:.85,vertexColors:true,side:THREE.DoubleSide});
  for(const[key,surface,scale]of[['stone','castle-masonry',2.085],['trim','castle-masonry',2.085],['floor','castle-masonry',2.085],['iron','oxidized-copper',1],['wood','aged-wood',2],['soil','mossy-rock',1.5]])Object.assign(materials[key].userData,{surface,metresPerRepeat:scale});
  materials.water.normalMap=waterNormalMap();materials.water.normalScale.set(.75,.75);
  return materials;
}
/** All instances share textures/materials. Loading is explicit, retryable and never starts on import. */
export async function loadHerbariumAssets(options={}){
  getHerbariumMaterials();const sets={};const jobs=[];
    for(const[name,channels]of Object.entries({'castle-masonry':['color','normal','roughness'],'oxidized-copper':['color','normal','roughness','metalness'],'aged-wood':['color','normal','roughness'],'mossy-rock':['color','normal','roughness']}))for(const channel of channels)jobs.push(loadPBRTexture(name,channel,options).then(t=>{(sets[name]??={})[channel]=t;}));
    const results=await Promise.allSettled(jobs),failed=results.filter(r=>r.status==='rejected');if(failed.length)throw new Error(`Herbarium PBR preload failed (${failed.length} channels): ${failed[0].reason?.message||failed[0].reason}`);
    await Promise.all(['fern_02','periwinkle_plant','potted_plant_01'].map(kind=>loadHerbariumBotanicalAssets({kind,...options})));bindHerbariumTextureSets(sets);
    if(options.regional!==false)await Promise.all([loadHerbariumIvyAssets(options),loadHerbariumCommunityAssets(options)]);
    return materials;
}
/** Used by the exporter with decoded real local pixels, never placeholder images. */
export function bindHerbariumTextureSets(sets){getHerbariumMaterials();if(sets['castle-masonry']?.color)sets['castle-masonry']={...sets['castle-masonry'],color:stoneAlbedo(sets['castle-masonry'].color)};if(sets['oxidized-copper']?.color)sets['oxidized-copper']={...sets['oxidized-copper'],color:quietPaintAlbedo(sets['oxidized-copper'].color)};for(const m of Object.values(materials)){const set=sets[m.userData.surface];if(!set)continue;m.map=set.color;m.normalMap=set.normal;m.roughnessMap=set.roughness;if(set.metalness)m.metalnessMap=set.metalness;m.normalScale.setScalar(m===materials.iron?.24:.32);m.needsUpdate=true;}}

class Builder{
  constructor(name,dimensions){this.group=new THREE.Group();this.group.name=name;this.group.userData={herbarium:true,version:8,dimensions:{width:dimensions[0],depth:dimensions[1],height:dimensions[2]},axis:'long X, front +Z, finished floor y=0',parts:[],colliders:[],supportMeshes:[],plantRoots:[],originalAuthoring:'Procedural original authored meshes; no target image used as texture'};this.buckets=new Map();this.m=getHerbariumMaterials();}
  add(geometry,key,name,position=V(),rotation=null,options={}){
    // Only private sourcePlant/specimen temporaries transfer ownership, including
    // on failure. Cached architecture and borrowed source geometry still copy.
    let g=options.owned?geometry:null,queued=false;
    try{
    const preserveIndex=key.startsWith('source-');g??=geometry.index&&!preserveIndex?geometry.toNonIndexed():geometry.clone();const matrix=new THREE.Matrix4().compose(position,rotation||new THREE.Quaternion(),V(1,1,1));g.applyMatrix4(matrix);
    if(!options.keepUV)assignArchitecturalUVs(g,this.m[key].userData.metresPerRepeat||1);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(!g.attributes.color){const colors=new Float32Array(g.attributes.position.count*3);colors.fill(1);g.setAttribute('color',new THREE.BufferAttribute(colors,3));}
    g.computeBoundingBox();const bounds={min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},bucketKey=key+(options.support?':support':'');const bucket=this.buckets.get(bucketKey)||{key,geometries:[],parts:[],count:0,support:Boolean(options.support)};
    const part={name,role:options.role||'structure',bounds,firstVertex:bucket.count,vertexCount:g.index?.count||g.attributes.position.count,...(options.attachedTo?{attachedTo:options.attachedTo}:{})};bucket.parts.push(part);bucket.count+=part.vertexCount;bucket.geometries.push(g);this.buckets.set(bucketKey,bucket);queued=true;this.group.userData.parts.push({...part,batch:bucketKey});
    if(options.collider)this.group.userData.colliders.push({name,...bounds,kind:options.collider===true?'solid':options.collider});return part;
    }catch(error){if(!queued)g?.dispose();this.discard();throw error;}
  }
  box(key,name,w,h,d,x,y,z,options={}){return this.add(beveledBlock(w,h,d,Math.min(.028,h*.12)),key,name,V(x,y,z),null,options);}
  tube(key,name,points,r=.035,options={}){const curve=points.length===2?new THREE.LineCurve3(points[0],points[1]):new THREE.CatmullRomCurve3(points);const geo=new THREE.TubeGeometry(curve,Math.max(1,points.length*4),r,8,false);this.add(geo,key,name,V(),null,options);geo.dispose();}
  sphere(key,name,point,scale){const geo=new THREE.SphereGeometry(1,12,8);geo.scale(...scale);this.add(geo,key,name,point);geo.dispose();}
  releaseInputs(bucket){for(const g of bucket.geometries)g.dispose();bucket.geometries.length=0;}
  discard(){for(const bucket of this.buckets.values())this.releaseInputs(bucket);for(const mesh of this.group.children)mesh.geometry?.dispose();for(const m of Object.values(this.m))if(m.userData.herbariumOwnedMaterial)m.dispose();this.group.clear();}
  finish(){let pending=null;try{for(const[name,bucket]of this.buckets){
    const combined=mergeGeometries(bucket.geometries,false);if(!combined)throw new Error('Herbarium geometry merge failed');pending=combined;
    // mergeGeometries copied every attribute/index. dispose alone leaves the CPU
    // arrays reachable; drop inputs before welding and building later buckets.
    this.releaseInputs(bucket);
    const geometry=bucket.key.startsWith('source-')?combined:mergeVertices(combined,1e-7);if(geometry!==combined)combined.dispose();pending=geometry;
    for(const part of bucket.parts){part.firstIndex=part.firstVertex;part.indexCount=part.vertexCount;delete part.firstVertex;delete part.vertexCount;}geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,this.m[bucket.key]);mesh.name=name;mesh.castShadow=bucket.key!=='glass'&&bucket.key!=='water'&&bucket.key!=='ripple';mesh.receiveShadow=!['glass','water','ripple'].includes(bucket.key);if(this.group.name.includes('water')&&['leaf','lime','sage','lily','submerged'].includes(bucket.key)){mesh.castShadow=false;if(bucket.key==='submerged')mesh.receiveShadow=false;}mesh.userData={parts:bucket.parts,support:bucket.support,sharedAsset:false};if(bucket.key==='glass')mesh.renderOrder=2;if(bucket.key==='water')mesh.renderOrder=1;this.group.add(mesh);pending=null;if(bucket.support)this.group.userData.supportMeshes.push(mesh.name);}
    for(const part of this.group.userData.parts){part.firstIndex=part.firstVertex;part.indexCount=part.vertexCount;delete part.firstVertex;delete part.vertexCount;}this.group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(this.group);this.group.userData.actualBounds={min:box.min.toArray(),max:box.max.toArray()};owners.set(this.group,{refs:1,meshes:[...this.group.children]});localMaterials.set(this.group,new Set(Object.values(this.m).filter(m=>m.userData.herbariumOwnedMaterial)));return this.group;
    }catch(error){pending?.dispose();this.discard();throw error;}}
}
function lathe(b,key,name,profile,point,segments=32,options={}){const geo=new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),segments);b.add(geo,key,name,point,null,options);geo.dispose();}
function tileFloor(b,w,d,clip=null){
  b.box('mortar','Continuous supported foundation',w,.24,d,0,-.14,0);
  // Finished floor top is exactly y=0; joints are shallow, backed by the foundation.
  for(let x=-w/2;x<w/2-.001;x+=.8)for(let z=-d/2;z<d/2-.001;z+=.8){const tw=Math.min(.8,w/2-x),td=Math.min(.8,d/2-z);if(clip&&!clip(x+tw/2,z+td/2))continue;b.box('floor','Floor paving',tw-.012,.10,td-.012,x+tw/2,-.05,z+td/2,{support:true,role:'floor'});}
  const plane=new THREE.PlaneGeometry(w,d);plane.rotateX(-Math.PI/2);plane.translate(0,-.004,0);b.add(plane,'mortar','Recessed supported paving joints',V(),null,{support:true,role:'floor'});plane.dispose();
}
function arch(b,cx,z,span,spring,apex,depth,prefix,axis='x'){
  const inner=[];for(let side=0;side<2;side++){const left=side===0,a=V(cx+(left?-span/2:0),left?spring:apex,z),d=V(cx+(left?0:span/2),left?apex:spring,z),curve=new THREE.CubicBezierCurve3(a,V(a.x+(left?0:span*.32),a.y+(left?.57:-.35),z),V(d.x-(left?span*.32:0),d.y+(left?-.35:.57),z),d);const pts=curve.getPoints(18);inner.push(...(side?pts.slice(1):pts));}
  for(let i=0;i<inner.length-1;i++){const p=inner[i],q=inner[i+1],dir=q.clone().sub(p).normalize(),out=V(-dir.y,dir.x,0),thickness=.19;const shape=new THREE.Shape([new THREE.Vector2(p.x,p.y),new THREE.Vector2(q.x,q.y),new THREE.Vector2(q.x+out.x*thickness,q.y+out.y*thickness),new THREE.Vector2(p.x+out.x*thickness,p.y+out.y*thickness)]);const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.008,bevelThickness:.007,bevelSegments:1,steps:1});geo.translate(0,0,z-depth/2);if(axis==='z')geo.rotateY(Math.PI/2);b.add(geo,i%5===0?'trim':'stone',`${prefix} voussoir ${i}`);geo.dispose();}
}
function cylinder(b,key,name,r1,r2,h,point,options={}){const g=new THREE.CylinderGeometry(r1,r2,h,24,1);b.add(g,key,name,point,null,options);g.dispose();}

/** Four true pointed voids on both faces, with open ends and supported cross ribs. */
export function createArcade({bays=4,vine='legacy'}={}){
  if(!Number.isInteger(bays)||bays<1||bays>4)throw new RangeError('Arcade bays must be an integer in 1…4.');
  if(!['legacy','outer-left','outer-right'].includes(vine))throw new RangeError('Unknown arcade vine composition.');
  if(vine!=='legacy')candidateIvyMaterials();
  const length=bays*2.88+.48,b=new Builder('Open limestone arcade',[length,3.4,5.4]);tileFloor(b,length,3.4);
  for(let i=0;i<=bays;i++){const x=-bays*1.44+i*2.88;for(const z of[-1.42,1.42]){
    b.box('stone',`Pier ${i} foot`,.48,.16,.48,x,.08,z,{collider:true});b.box('trim',`Pier ${i} base moulding`,.43,.12,.43,x,.22,z,{collider:true});
    cylinder(b,'stone',`Pier ${i} octagonal shaft`,.175,.19,3.19,V(x,1.865,z),{collider:true});
    for(const y of[.35,3.39])cylinder(b,'trim',`Pier ${i} shaft collar`,.21,.21,.085,V(x,y,z));
    lathe(b,'trim',`Pier ${i} carved capital`,[[.18,0],[.18,.09],[.205,.15],[.23,.28],[.23,.32]],V(x,3.44,z),12);
    b.box('trim',`Pier ${i} abacus`,.48,.12,.46,x,3.77,z);
    b.box('stone',`Pier ${i} coping riser`,.24,1.36,.29,x,4.46,z);
    for(const dx of[-.14,.14])b.tube('stone',`Capital folded leaf ${i}`,[V(x+dx*.7,3.49,z+.18),V(x+dx,3.60,z+.21),V(x+dx*.8,3.69,z+.20)],.022);
  }
  b.box('stone',`Cross tie ${i}`,.24,.15,2.84,x,5.16,0);
  }
  for(let i=0;i<bays;i++)for(const z of[-1.42,1.42])arch(b,-bays*1.44+(i+.5)*2.88,z,2.47,3.81,5.11,.29,`Bay ${i}`);
  for(const z of[-1.42,1.42]){b.box('stone','Continuous parapet cornice',length-.08,.16,.38,0,5.22,z);b.box('trim','Chamfered supported coping',length,.105,.48,0,5.347,z);b.box('mortar','Recessed drip groove',length-.15,.024,.35,0,5.112,z);}
  // Legacy remains the live default until the opt-in source receives its studio gate.
  if(vine==='legacy'){
  // Climbing ivy is rooted against the outer back piers, leaving every passage clear.
  for(const x of[-bays*1.44,bays*1.44]){const rand=rng(90+Math.round(x*8));for(let k=0;k<3;k++){const z=-1.37-k*.015,path=[V(x,0,z),V(x+.07,1,z),V(x-.05,2.1,z),V(x+.09,3.15,z),V(x,4.15,z)];b.tube('darkLeaf','Rooted ivy climbing stem',path,.016,{role:'plant'});for(let i=0;i<28;i++){const y=.15+i*.143,a=i*2.4;leaf(b,V(x+.07*Math.sin(y*3),y,z-.025),V(Math.cos(a)*.5,.2,-.6),.14+rand()*.035,.12,'darkLeaf','Ivy attached blade');}}b.group.userData.plantRoots.push({species:'Hedera helix',root:[x,0,-1.5],support:'pier'});}
  {const x=-bays*1.44,z=1.638,path=[V(x,0,z),V(x+.025,1.2,z),V(x-.02,2.5,z),V(x+.02,3.65,z),V(x+.38,4.28,1.595),V(x+.85,4.58,1.595)];b.tube('darkLeaf','Front rooted climbing vine',path,.020,{role:'plant'});for(let i=0;i<56;i++){const t=i/55,p=new THREE.CatmullRomCurve3(path).getPoint(t);leaf(b,p,V(Math.sin(i*2.4)*.7,.50,0),.17+(i%3)*.025,.15,'darkLeaf','Weighted climbing ivy blade',.06,true);}b.group.userData.plantRoots.push({species:'Hedera helix',root:[x,0,z],support:'front end pier'});}
  }else outerColumnVine(b,bays,vine);
  b.group.userData.clearPassages=[{min:[-length/2,.03,-1.1],max:[length/2,3.6,1.1],kind:'continuous aisle'},...Array.from({length:bays},(_,i)=>({min:[-bays*1.44+(i+.5)*2.88-1.1,.03,1.05],max:[-bays*1.44+(i+.5)*2.88+1.1,3.6,1.7],kind:'south arch'}))];return b.finish();
}

// One rooted colony follows the actual outer shaft, riser and cornice. The
// candidate uses scanned leaf contours; every shoot starts on a parent stem
// instead of distributing disconnected leaves over the stone.
function outerColumnVine(b,bays,kind){
  const side=kind==='outer-left'?-1:1,inward=-side,x=side*bays*1.44,span=Math.min(bays*2.88-.25,side<0?4.04:3.53),rand=rng(side<0?40131:40367),stems=[];
  const stem=(name,points,radius,parent=null)=>{
    b.tube('ivyBark',name,points,radius,{role:'plant',attachedTo:parent||'rooted outer column'});
    const curve=new THREE.CatmullRomCurve3(points);stems.push({name,parent,points:points.map(p=>p.toArray())});return curve;
  };
  const leaves=(curve,positions,phase=0,lower=false,scale=1)=>{
    for(const [i,t]of positions.entries()){
      const node=curve.getPoint(t),a=i*2.399+phase;
      const outward=lower&&node.y<3.84;
      const direction=outward?V(side*(.44+.36*Math.sin(a)),.55+.3*Math.cos(a),.16+.24*rand()):V(Math.sin(a)*.75,.32+.58*Math.cos(a*.83),.10+.44*rand());
      // A short real petiole lifts each blade from its supporting woody shoot.
      const base=node.clone().addScaledVector(direction.clone().normalize(),.028+.021*rand());
      b.tube('ivyBark','Attached ivy leaf petiole',[node,base],.0025,{role:'plant',attachedTo:'rooted woody shoot'});
      ivyBlade(b,base,direction,(.18+rand()*.055)*scale,phase+i*.57,.83+rand()*.31);
    }
  };
  const root=V(x,-.28,1.78),trunk=stem('Outer ivy rooted leader',[root,V(x+side*.045,.36,1.66),V(x-side*.035,1.16,1.635),V(x+side*.047,2.16,1.637),V(x-side*.040,3.10,1.64),V(x,3.61,1.672),V(x+inward*.035,4.48,1.590),V(x+inward*.08,5.29,1.653),V(x+inward*.26,5.419,1.46)],.021);
  // Short holdfasts terminate on the real tapered shaft/front riser surface.
  for(const t of [.12,.23,.37,.51,.65,.80]){const node=trunk.getPoint(t);let contact;
    if(node.y<3.39){const radius=.19-(.19-.175)*(node.y-.27)/3.19,dx=node.x-x,dz=node.z-1.42,d=Math.hypot(dx,dz);contact=V(x+dx*radius/d,node.y,1.42+dz*radius/d);}
    else if(node.y>3.84)contact=V(Math.max(x-.12,Math.min(x+.12,node.x)),node.y,1.565);
    else continue;stem('Ivy stone holdfast',[node,contact],.0032,'Outer ivy rooted leader');
  }
  // Unequal groups leave visible sections of leader and carved shaft between
  // them. The two ends use different branch heights and lengths, not a mirror.
  const climbs=side<0?[[.085,.64,-.08],[.258,.43,.12],[.438,.78,-.10],[.684,.51,.06]]:[[.12,.41,.06],[.33,.72,-.13],[.535,.46,.10],[.758,.39,-.08]];
  leaves(trunk,[.03,.07,.21,.38,.56,.65,.88,.94],1.1,true,.88);
  for(const [i,[t,height,turn]]of climbs.entries()){
    const base=trunk.getPoint(t),reach=side*(.065+rand()*.075),shoot=stem(`Outer ivy shaft branch ${i}`,[base,V(x+reach,base.y+height*.38,1.70+turn),V(x+reach*.50,Math.min(4.31,base.y+height),1.68+turn*.65)],.010-i*.0006,'Outer ivy rooted leader');
    leaves(shoot,[.12,.30,.50,.67,.86,1],i*1.4,true);
    const forkBase=shoot.getPoint(.42),fork=stem(`Outer ivy shaft fork ${i}`,[forkBase,forkBase.clone().add(V(side*.065,.13,.09)),forkBase.clone().add(V(side*.12,.31,.13))],.005,`Outer ivy shaft branch ${i}`);leaves(fork,[.28,.62,.96],i,true,.84);
  }
  const leader=stem('Outer ivy cornice leader',[trunk.getPoint(1),V(x+inward*.73,5.413,1.39),V(x+inward*1.41,5.412,1.49),V(x+inward*2.43,5.413,1.43),V(x+inward*span,5.412,1.44)],.019,'Outer ivy rooted leader');
  leaves(leader,[.035,.12,.28,.44,.62,.83,1],2.4,false,1);
  // Overlapping unequal colonies: a dominant turn, a lower inward shoulder,
  // then a small taper. Alternate shoots pass in front of and above the stone.
  // Deliberate open intervals expose short woody connections between groups.
  const clusters=side<0?[
    {name:'outer turn',start:.012,end:.34,shoots:13,reach:.42,drop:.49,rise:.36,scale:1.20},
    {name:'inward shoulder',start:.30,end:.67,shoots:9,reach:.39,drop:.33,rise:.19,scale:1.12},
    {name:'terminal taper',start:.67,end:.92,shoots:4,reach:.25,drop:.24,rise:.09,scale:.90},
  ]:[
    {name:'outer turn',start:.018,end:.37,shoots:12,reach:.37,drop:.43,rise:.32,scale:1.17},
    {name:'inward shoulder',start:.34,end:.72,shoots:8,reach:.36,drop:.38,rise:.21,scale:1.10},
    {name:'terminal taper',start:.74,end:.93,shoots:3,reach:.21,drop:.19,rise:.08,scale:.86},
  ];
  for(const [clusterIndex,cluster]of clusters.entries())for(let i=0;i<cluster.shoots;i++){
    const t=cluster.start+(cluster.end-cluster.start)*(i+.24+rand()*.51)/cluster.shoots,base=leader.getPoint(t),above=i%3===1;
    const reach=inward*cluster.reach*(.55+rand()*.70)*(i%4===0?-.65:1),height=above?cluster.rise*(.63+rand()*.58):-cluster.drop*(.62+rand()*.50),depth=above?-.10-rand()*.10:.23+rand()*.23;
    const name=`Outer ivy ${cluster.name} branch ${i}`,shoot=stem(name,[base,base.clone().add(V(reach*.25,.075,depth*.30)),base.clone().add(V(reach*.67,height*.45,depth*.80)),base.clone().add(V(reach,height,depth))],clusterIndex===2?.004:.0065,'Outer ivy cornice leader');
    const positions=clusterIndex===2?[.16,.40,.65,.86,1]:[.08,.19,.30,.41,.52,.63,.74,.86,.97];leaves(shoot,positions,clusterIndex*3.8+i*1.79,false,cluster.scale);
    if(clusterIndex<2){
      const anchor=shoot.getPoint(.43),fork=stem(`${name} fork`,[anchor,anchor.clone().add(V(-reach*.39,.035,.08)),anchor.clone().add(V(-reach*.81,above?.12:-.13,.13))],.0037,name);leaves(fork,[.19,.43,.68,.94],i*.83+clusterIndex,false,cluster.scale*.90);
    }
  }
  // A few unequal pendant tips interrupt the mass edge. Their origins and
  // directions vary independently, instead of creating a repeated fringe.
  for(const [i,[t,drop,reach,depth]]of (side<0?[[.075,.79,.13,.35],[.28,.56,-.17,.29],[.52,.64,.21,.33],[.84,.31,.12,.24]]:[[.11,.68,-.11,.32],[.41,.77,.20,.37],[.65,.42,.12,.27]]).entries()){
    const base=leader.getPoint(t),shoot=stem(`Outer ivy pendant ${i}`,[base,base.clone().add(V(inward*reach*.31,-drop*.24,depth*.61)),base.clone().add(V(inward*reach,-drop,depth))],.005,'Outer ivy cornice leader');leaves(shoot,[.14,.29,.44,.59,.72,.86,1],i*1.7,false,.98);
  }
  b.group.userData.originalAuthoring='Original authored architecture and connected woody assembly; actual CC0 ambientCG LeafSet029 scan maps on shallow curved ivy blades. No concept image pixels.';
  b.group.userData.upperIvyClusters=clusters.map(({name,start,end,shoots})=>({name,start,end,shoots}));
  b.group.userData.plantRoots.push({species:'Hedera helix',root:root.toArray(),support:'buried in outer-column terrain shoulder'});
  b.group.userData.vineComposition={kind,revision:3,upperBays:span/2.88,maxWindDisplacement:0,wind:'Static authored ivy geometry; no vertex wind modifier',stems,leafRecipe:'Six healthy scanned LeafSet029 ivy contours, matching original 4K Color/Opacity/NormalGL/Roughness and shallow curved surfaces',source:{asset:'ambientCG LeafSet029',license:'CC0-1.0',manifest:'/models/herbarium/ivy-leafset029/source.json',atlasRows:[0,1]},materialScope:'Candidate-only ivyBlade and ivyBark; legacy shared materials unchanged'};
}

const ivyChannels={map:'Color',normalMap:'NormalGL',alphaMap:'Opacity',roughnessMap:'Roughness'};
/** Candidate-only preload: default arcades never request these full-resolution maps. */
export async function loadHerbariumIvyAssets(options={}){
  const set={},results=await Promise.allSettled(Object.entries(ivyChannels).map(async([key,channel])=>{
    const texture=await loadImageTexture({id:`herbarium:ivy:LeafSet029:${channel}`,url:`/models/herbarium/ivy-leafset029/LeafSet029_4K-PNG_${channel}.png`,phase:2},options);
    const colorSpace=key==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;if(texture.colorSpace!==colorSpace){texture.colorSpace=colorSpace;texture.needsUpdate=true;}set[key]=texture;
  }));
  const failed=results.find(r=>r.status==='rejected');if(failed)throw new Error(`Scanned ivy preload failed: ${failed.reason?.message||failed.reason}`);
  return bindHerbariumIvyTextureSet(set);
}
/** Exporters/tests bind decoded original pixels through the same material boundary. */
export function bindHerbariumIvyTextureSet(set){
  for(const key of Object.keys(ivyChannels))if(!set[key]?.isTexture||set[key].image?.width!==4096||set[key].image?.height!==4096)throw new Error(`Scanned ivy requires the original 4096 x 4096 ${key}`);
  getHerbariumMaterials();
  if(!materials.ivyBlade){
    materials.ivyBlade=material('candidate scanned ivy LeafSet029','#ffffff',{normalScale:new THREE.Vector2(1,1),roughness:1,vertexColors:true,side:THREE.DoubleSide,alphaTest:.5,alphaToCoverage:true,depthWrite:true});
    materials.ivyBark=material('candidate woody ivy leaders','#786347',{roughness:.94});
  }
  let changed=false;for(const key of Object.keys(ivyChannels)){const texture=set[key],colorSpace=key==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;if(texture.colorSpace!==colorSpace){texture.colorSpace=colorSpace;texture.needsUpdate=true;}if(materials.ivyBlade[key]!==texture){materials.ivyBlade[key]=texture;changed=true;}}
  if(changed)materials.ivyBlade.needsUpdate=true;return materials.ivyBlade;
}
function candidateIvyMaterials(){if(!materials.ivyBlade?.alphaMap)throw new Error('Call and await loadHerbariumIvyAssets before constructing a scanned ivy candidate.');}

// Pixel bounds include the complete alpha contour. The petiole meets the scanned
// basal sinus, not the rectangular card edge. All four maps share these exact UVs.
const ivyAtlas=[
  {bounds:[168,167,1234,1215],root:[316,711]},
  {bounds:[1461,200,2650,1263],root:[1555,690]},
  {bounds:[2891,184,3960,1174],root:[3070,683]},
  {bounds:[282,1512,1198,2610],root:[343,2042]},
  {bounds:[1434,1448,2683,2653],root:[1509,2053]},
  {bounds:[2848,1419,4019,2686],root:[3030,2042]},
];
function ivyBlade(b,base,direction,length,phase,tone){
  const atlas=ivyAtlas[Math.abs(Math.floor(phase*71))%ivyAtlas.length], [x0,y0,x1,y1]=atlas.bounds,[rootX,rootY]=atlas.root;
  const forward=direction.clone().normalize(),face=V(.30*Math.sin(phase),.30+.24*Math.sin(phase*.73),1).normalize(),side=new THREE.Vector3().crossVectors(forward,face).normalize(),normal=new THREE.Vector3().crossVectors(side,forward).normalize();
  const positions=[],uv=[],colors=[],indices=[],steps=20,pixelScale=length/(x1-rootX),bend=.018+.017*(.5+.5*Math.sin(phase)),twist=.014*Math.sin(phase*1.71);
  for(let row=0;row<=steps;row++)for(let col=0;col<=steps;col++){
    const px=x0+(x1-x0)*col/steps,py=y0+(y1-y0)*row/steps,u=(px-rootX)/(x1-rootX),v=(py-rootY)/(x1-rootX);
    const relief=length*(bend*Math.sin(u*Math.PI)+twist*u*v-.016*u*u);
    const p=base.clone().addScaledVector(forward,(px-rootX)*pixelScale).addScaledVector(side,(py-rootY)*pixelScale).addScaledVector(normal,relief);
    positions.push(...p.toArray());uv.push(px/4096,1-py/4096);
    // The scan supplies pigment and veins. A restrained neutral age variation
    // preserves its healthy color without repeating R1's dark albedo multiplier.
    const shade=.93+.07*Math.max(0,Math.min(1,tone-.83));colors.push(shade,shade,shade);
  }
  for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){const a=row*(steps+1)+col,b=a+steps+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  b.add(geometry,'ivyBlade','Scanned ivy blade with true opacity contour',V(),null,{keepUV:true,role:'plant',attachedTo:'rooted woody petiole'});geometry.dispose();
}

/** Curved, ridged leaves with UV midribs; every blade begins at its physical stem. */
function leaf(b,base,direction,length,width,key,name='Leaf',curl=.13,verticalPlane=false){
  const forward=direction.clone().normalize(),side=(verticalPlane?V(-forward.y,forward.x,0):new THREE.Vector3().crossVectors(forward,Math.abs(forward.y)>.95?V(1,0,0):UP)).normalize(),normal=new THREE.Vector3().crossVectors(side,forward).normalize(),p=[],uv=[],colors=[],idx=[],rows=12;
  for(let i=0;i<=rows;i++){const t=i/rows,w=Math.pow(Math.sin(Math.PI*t),.78)*width*.5;for(const s of[-1,0,1]){const q=base.clone().addScaledVector(forward,length*t).addScaledVector(side,w*s).addScaledVector(normal,length*(.085*Math.sin(t*Math.PI)*(1-Math.abs(s))-.02*Math.abs(s)-curl*t*t));p.push(...q.toArray());uv.push((s+1)/2,t);const blossom=['ivory','pink','violet','yellow'].includes(key),variation=.84+.13*Math.sin(base.x*19+base.y*11+base.z*31),tone=blossom?(.82+.18*t):(.33+.63*Math.sqrt(t))*variation*(s===0?1:.86);colors.push(tone,tone*(blossom?1:1.025),tone*(blossom?1:.91));}}
  for(let i=0;i<rows;i++)for(let j=0;j<2;j++){const a=i*3+j;idx.push(a,a+3,a+1,a+1,a+3,a+4);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();b.add(geo,key,name,V(),null,{keepUV:true,role:'plant',attachedTo:'rooted stem'});geo.dispose();
}
function sourcePieces(id,variant=0){const variants=botanicalAssets.get(id);if(!variants)throw new Error(`Call and await loadHerbariumAssets before constructing planted gardens (${id} not prepared).`);return variants[variant].pieces;}
function sourcePlant(b,id,variant,x,y,z,scale,turn=0,partFilter=null){
  const pieces=sourcePieces(id,variant),placement=new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromAxisAngle(UP,turn),V(scale,scale,scale)),prefix=`${id} collection ${b.group.userData.parts.length}`;
  for(const piece of pieces){if(partFilter&&!partFilter(piece))continue;const g=piece.geometry.clone();try{g.applyMatrix4(piece.matrix).applyMatrix4(placement);}catch(error){g.dispose();b.discard();throw error;}b.add(g,piece.key,`${prefix}/${piece.name}`,V(),null,{owned:true,keepUV:true,role:piece.name.endsWith('_pebbles')?'substrate':'plant',attachedTo:'original rooted source specimen'});}
  const used=b.group.userData.sourceAssets??=[];if(!used.some(s=>s.id===id))used.push({id,...botanicalCatalog[id],license:'CC0',sourceURL:`https://polyhaven.com/a/${id}`});
  b.group.userData.originalAuthoring='Original authored architecture and planting composition, incorporating attributed CC0 photographic plant geometry and full 4K material pixels.';
  return prefix;
}
let sourceSubstrateHeight;
function pottedSubstrateHeight(){
  if(sourceSubstrateHeight!==undefined)return sourceSubstrateHeight;const part=sourcePieces('potted_plant_01').find(p=>p.name.endsWith('_pebbles')),mesh=new THREE.Mesh(part.geometry,getHerbariumMaterials()[part.key]);mesh.matrixAutoUpdate=false;mesh.matrix.copy(part.matrix);mesh.updateMatrixWorld(true);const hits=new THREE.Raycaster(V(0,1,0),V(0,-1,0)).intersectObject(mesh);if(!hits.length)throw new Error('Original potted substrate does not support its plant centre.');return sourceSubstrateHeight=hits[0].point.y;
}
function groundPlant(b,id,variant,x,z,scale,seed,baseY=0){sourcePlant(b,id,variant,x,baseY,z,scale,seed*2.399);b.group.userData.plantRoots.push({species:id,root:[x,baseY,z],support:'continuous planted soil'});}
function fullPottedPlant(b,x,z,scale,seed,baseY=0){const prefix=sourcePlant(b,'potted_plant_01',0,x,baseY,z,scale,seed*2.399);b.group.userData.plantRoots.push({species:'potted_plant_01',root:[x,baseY+pottedSubstrateHeight()*scale,z],support:'original pebble substrate',supportPart:`${prefix}/potted_plant_01_pebbles`});}
function pottedCollection(b,x,z,potScale,species,seed,baseY=0){
  const prefix=sourcePlant(b,'potted_plant_01',0,x,baseY,z,potScale,seed*2.399,p=>p.name.endsWith('_pot')||p.name.endsWith('_pebbles')),y=baseY+pottedSubstrateHeight()*potScale;
  if(species==='fern'){sourcePlant(b,'fern_02',seed%2?0:2,x,y,z,potScale*(seed%2?.90:1.12),seed*2.399);b.group.userData.plantRoots.push({species:'fern_02',root:[x,y,z],support:'original pebble substrate',supportPart:`${prefix}/potted_plant_01_pebbles`});}
  else for(let i=0;i<3;i++){const angle=i*2.399,px=x+Math.cos(angle)*potScale*.065,pz=z+Math.sin(angle)*potScale*.065;sourcePlant(b,'periwinkle_plant',0,px,y,pz,potScale*(2.25+i*.20),seed+i*2.399);b.group.userData.plantRoots.push({species:'periwinkle_plant',root:[px,y,pz],support:'original pebble substrate',supportPart:`${prefix}/potted_plant_01_pebbles`});}
}
function rosette(b,x,y,z,r=.16){
  const g=new THREE.TorusGeometry(r,.012,6,24);b.add(g,'brass','Cast circular rosette',V(x,y,z));g.dispose();for(let j=0;j<6;j++){const a=j*Math.PI/3;b.tube('brass','Rosette radial petal',[V(x,y,z),V(x+Math.cos(a)*r*.8,y+Math.sin(a)*r*.8,z)],.009);}
}

function ringSolid(b,key,name,points,outerScale,bottom,top,options={}){
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x*outerScale,-p.z*outerScale))),hole=new THREE.Path([...points].reverse().map(p=>new THREE.Vector2(p.x,-p.z)));shape.holes.push(hole);const g=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,bottom,0);b.add(g,key,name,V(),null,options);g.dispose();
}

// Tall specimens have their own human-size planters. Their trunks, petioles and
// curved blades are authored at botanical size rather than enlarging a source pot.
function hallPlanter(b,name,x,z){
  lathe(b,'pot',`${name} rolled terracotta planter`,[[0,0],[.38,0],[.40,.065],[.39,.12],[.51,.57],[.57,.59],[.58,.67],[.55,.72],[.50,.72],[.49,.65],[.44,.24],[0,.24]],V(x,0,z),48);
  for(const y of [.09,.57])lathe(b,'pot',`${name} planter moulding`,[[.40+(y>.1?.12:0),-.018],[.42+(y>.1?.12:0),0],[.40+(y>.1?.12:0),.022]],V(x,y,z),48);
  cylinder(b,'soil',`${name} rooted planter soil`,.485,.485,.06,V(x,.63,z),{role:'substrate'});
  b.group.userData.colliders.push({name:`${name} floor-standing planter`,min:[x-.58,0,z-.58],max:[x+.58,.72,z+.58],kind:'furniture'});
  b.group.userData.plantRoots.push({species:name.includes('tree fern')?'Dicksonia antarctica, original authored tree fern':'Strelitzia nicolai, original authored broadleaf',root:[x,.66,z],support:'floor-standing terracotta planter soil',supportPart:`${name} rooted planter soil`,assembly:name});
}
function hallTreeFern(b,x,z){
  const name='Hall tree fern';hallPlanter(b,name,x,z);
  lathe(b,'wood',`${name} fibrous trunk`,[[.17,0],[.20,.14],[.155,.60],[.15,1.5],[.135,2.5],[.16,3.35],[.13,3.62]],V(x,.655,z),32,{role:'plant',attachedTo:'rooted planter soil'});
  for(let i=0;i<32;i++){
    const a=i*2.399,y=.78+i*.103,r=.158;
    b.tube('darkLeaf',`${name} old frond scar`,[V(x+Math.cos(a)*r,y,z+Math.sin(a)*r),V(x+Math.cos(a+.25)*.177,y+.055,z+Math.sin(a+.25)*.177),V(x+Math.cos(a+.46)*r,y+.10,z+Math.sin(a+.46)*r)],.013,{role:'plant',attachedTo:`${name} fibrous trunk`});
  }
  for(let i=0;i<13;i++){
    const a=i*2.399,reach=.91+(i%3)*.09,start=V(x,4.11+(i%3)*.065,z),end=V(x+Math.cos(a)*reach,4.06+(i%4)*.10,z+Math.sin(a)*reach*1.40);
    const curve=new THREE.CubicBezierCurve3(start,V(x+Math.cos(a)*.28,5.10,z+Math.sin(a)*.38),V(x+Math.cos(a)*reach*.82,5.47+(i%2)*.15,z+Math.sin(a)*reach*1.16),end);
    b.tube('sage',`${name} attached frond rachis ${i}`,curve.getPoints(22),.020,{role:'plant',attachedTo:`${name} fibrous trunk`});
    for(let j=0;j<20;j++)for(const side of[-1,1]){
      const t=.12+j*.043,p=curve.getPoint(t),length=(.10+.27*Math.sin(t*Math.PI)**.75)*(1-.35*t),direction=V(-Math.sin(a)*side*.82+Math.cos(a)*.17,-.12-t*.24,Math.cos(a)*side*.95+Math.sin(a)*.17);
      leaf(b,p,direction,length,.048+(1-t)*.026,i%3?'leaf':'sage',`${name} attached pinnule`,.10);
    }
  }
  // Unfurling croziers retain a visible juvenile stage within the mature crown.
  for(let i=0;i<3;i++){const a=i*2.399,path=[V(x,4.12,z),V(x+Math.cos(a)*.11,4.66,z+Math.sin(a)*.11),V(x+Math.cos(a)*.15,5.10+i*.11,z+Math.sin(a)*.15),V(x+Math.cos(a)*.22,5.18+i*.11,z+Math.sin(a)*.22),V(x+Math.cos(a)*.29,5.08+i*.11,z+Math.sin(a)*.29)];b.tube('lime',`${name} unfolding crozier`,path,.027,{role:'plant',attachedTo:`${name} fibrous trunk`});}
}
function hallPaddleLeaf(b,name,curve,width,phase){
  const positions=[],uv=[],colors=[],indices=[],rows=36,columns=8;
  for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
    const t=i/rows,s=j/columns*2-1,centre=curve.getPoint(t),tangent=curve.getTangent(t),side=new THREE.Vector3().crossVectors(tangent,UP).normalize(),normal=new THREE.Vector3().crossVectors(side,tangent).normalize(),outline=Math.pow(Math.sin(Math.PI*t),.64)*(1-.22*t),edgeWave=.025*Math.sin(t*42+phase)*Math.abs(s)**4;
    const p=centre.addScaledVector(side,s*width*.5*outline).addScaledVector(normal,.052*Math.sin(Math.PI*t)*(1-s*s)+edgeWave-.035*s*s);
    positions.push(...p.toArray());uv.push((s+1)/2,t);const tone=.83+.09*Math.sin(t*Math.PI)+.025*Math.sin(phase+s*4);colors.push(tone,tone,tone*.98);
  }
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const a=i*(columns+1)+j,c=a+columns+1;indices.push(a,c,a+1,a+1,c,c+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  b.add(geometry,'leaf',`${name} curved paddle blade`,V(),null,{keepUV:true,role:'plant',attachedTo:`${name} attached petiole`});geometry.dispose();
  b.tube('sage',`${name} blade midrib`,curve.getPoints(30),.009,{role:'plant',attachedTo:`${name} attached petiole`});
}
function hallBroadleaf(b,x,z){
  const name='Hall broadleaf';hallPlanter(b,name,x,z);
  const leaves=[[-.72,2.95,-.76,1.52,.63],[.63,3.35,.74,1.67,.70],[-.26,3.82,.43,1.54,.66],[.36,3.63,-.70,1.72,.76],[-.54,2.85,.87,1.43,.67],[.48,2.95,-.94,1.32,.59],[.08,4.05,-.05,1.35,.52]];
  for(const [i,[side,height,depth,length,width]]of leaves.entries()){
    const root=V(x+side*.12,.655,z+depth*.12),joint=V(x+side*.32,height,z+depth*.31),direction=V(side*.45,.84,depth).normalize();
    b.tube('darkLeaf',`${name} rooted sheathing stem ${i}`,[root,V(x+side*.10,1.45,z+depth*.12),V(x+side*.18,2.28,z+depth*.19),joint],.046-i*.002,{role:'plant',attachedTo:'rooted planter soil'});
    const bladeStart=joint.clone().addScaledVector(direction,.12),end=bladeStart.clone().add(V(direction.x*length*.58,.26+length*.44,direction.z*length*.78));
    b.tube('sage',`${name} attached petiole`,[joint,bladeStart],.025,{role:'plant',attachedTo:`${name} rooted sheathing stem ${i}`});
    const curve=new THREE.CubicBezierCurve3(bladeStart,bladeStart.clone().add(V(direction.x*.24,length*.73,direction.z*.28)),end.clone().add(V(-direction.x*.16,.40,-direction.z*.10)),end);
    hallPaddleLeaf(b,name,curve,width,i*.83);
  }
}
function hallLamps(b){
  const opal=new THREE.MeshStandardMaterial({name:'Herbarium warm opal lamp globe',color:'#f2e6ce',roughness:.42,emissive:'#ffbd69',emissiveIntensity:3.2,userData:{herbariumOwnedMaterial:true,herbariumNightEmission:true,authoredEmissiveIntensity:3.2}});
  b.m={...b.m,lampOpal:opal};b.group.userData.lamps=[];
  for(const x of[-2.8,2.8])for(const side of[-1,1]){
    const z=side*3.53,name=`Hall lamp ${x}/${side}`,mount=[x,4.83,side*4.1];
    b.box('iron',`${name} upright clamp`,.16,.32,.14,x,4.83,side*4.1);
    b.tube('iron',`${name} bracket`,[V(...mount),V(x,4.96,side*3.88),V(x,4.96,side*3.65),V(x,4.81,z),V(x,4.58,z)],.024,{attachedTo:'central hall wall upright'});
    b.tube('brass',`${name} curled bracket brace`,[V(x,4.70,side*4.1),V(x,4.68,side*3.89),V(x,4.84,side*3.72),V(x,4.93,side*3.78)],.014,{attachedTo:`${name} bracket`});
    lathe(b,'brass',`${name} bell shade`,[[.035,0],[.055,-.06],[.13,-.09],[.24,-.17],[.32,-.22],[.32,-.245],[.28,-.25]],V(x,4.60,z),40);
    lathe(b,'lampOpal',`${name} opal globe`,[[0,0],[.09,.018],[.16,.10],[.19,.23],[.18,.38],[.13,.49],[.06,.53],[0,.54]],V(x,3.86,z),40);
    lathe(b,'brass',`${name} globe lower shoe`,[[0,0],[.07,.01],[.105,.04],[.095,.07]],V(x,3.835,z),32);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;b.tube('iron',`${name} protective curved rib`,[V(x+Math.cos(a)*.065,4.39,z+Math.sin(a)*.065),V(x+Math.cos(a)*.192,4.15,z+Math.sin(a)*.192),V(x+Math.cos(a)*.166,3.97,z+Math.sin(a)*.166),V(x+Math.cos(a)*.09,3.90,z+Math.sin(a)*.09)],.009,{attachedTo:'lamp shade and lower shoe'});}
    b.group.userData.lamps.push({name,mount,position:[x,4.08,z],baseIntensity:45,color:'#ffc57c',distance:10.5});
  }
}
function installHallLights(group){
  for(const lamp of group.userData.lamps){const light=new THREE.PointLight(lamp.color,lamp.baseIntensity,lamp.distance,2);light.name=`${lamp.name} warm light`;light.position.fromArray(lamp.position);light.userData={herbariumLamp:lamp.name,authoredIntensity:lamp.baseIntensity};group.add(light);}
  return group;
}

export function createConservatory(){return conservatoryAsset(true,true);}
export function createConservatoryR9(){return conservatoryAsset(false);}
export function createConservatoryR10(){return conservatoryAsset(true);}
export function createConservatoryR11(){return conservatoryAsset(true,true);}
function conservatoryAsset(highHall,inhabited=false){
  const b=new Builder('Verdigris botanical conservatory',[16,9,highHall?9.8:7.5]);tileFloor(b,15.4,8.4);
  // Curved shoulders are sampled parametrically: ribs and glazing share these exact nodes.
  const wingX=[-7.48,-6.91,-6.34,-5.77,-5.2,-4.63,-4.06,-3.5],hallX=[-3.5,-2.8,-2.1,-1.6,-.8,0,.8,1.6,2.1,2.8,3.5];
  const stations=highHall?[...wingX.map(x=>({x,hall:false})),...hallX.map(x=>({x,hall:true})),...wingX.map(x=>({x:-x,hall:false})).reverse()]:Array.from({length:21},(_,i)=>({x:-7.48+14.96*i/20,hall:false}));
  const sections=24,along=stations.length-1,roof=(u,v)=>{const row=stations[Math.round(u*along)],x=row.x,end=Math.max(0,(Math.abs(x)-5.2)/2.35),scale=Math.sqrt(Math.max(.002,1-end*end)),a=v*Math.PI;return V(x,(row.hall?5.5:3.65)+(row.hall?3:highHall?1.55:2.00)*Math.sin(a)*scale,4.1*Math.cos(a)*scale);};
  const runs=highHall?[[0,wingX.length-1],[wingX.length,wingX.length+hallX.length-1],[wingX.length+hallX.length,along]]:[[0,along]];
  const perimeterPoints=[];for(let i=0;i<=18;i++){const a=-Math.PI/2+i/18*Math.PI;perimeterPoints.push(V(5.2+2.35*Math.cos(a),0,4.1*Math.sin(a)));}for(let i=1;i<=18;i++)perimeterPoints.push(V(5.2-10.4*i/18,0,4.1));for(let i=1;i<=18;i++){const a=Math.PI/2+i/18*Math.PI;perimeterPoints.push(V(-5.2+2.35*Math.cos(a),0,4.1*Math.sin(a)));}for(let i=1;i<18;i++)perimeterPoints.push(V(-5.2+10.4*i/18,0,-4.1));
  // Segmented plinth has a real central doorway, with paired walls outside the jambs.
  for(let i=0;i<perimeterPoints.length;i++){const p=perimeterPoints[i],q=perimeterPoints[(i+1)%perimeterPoints.length],mid=p.clone().add(q).multiplyScalar(.5);if(mid.z>3.8&&Math.abs(mid.x)<1.6)continue;const d=q.clone().sub(p),rot=new THREE.Quaternion(),g=beveledBlock(d.length()+.006,.65,.30,.025).clone();g.rotateY(-Math.atan2(d.z,d.x));b.add(g,'stone','Stone plinth block',mid.clone().add(V(0,.325,0)),rot,{collider:true});g.dispose();b.tube('trim','Plinth coping segment',[p.clone().add(V(0,.69,0)),q.clone().add(V(0,.69,0))],.09);}
  for(let i=0;i<=along;i++){const u=i/along,points=Array.from({length:sections+1},(_,j)=>roof(u,j/sections));b.tube('iron',`Primary roof rib ${i}`,points,i%2===0?.052:.031,{attachedTo:'plinth uprights'});
    for(const end of[0,1]){const top=roof(u,end);if(top.z>0&&Math.abs(top.x)<1.51||highHall&&!stations[i].hall&&[stations[i-1],stations[i+1]].some(s=>s?.hall&&s.x===top.x))continue;b.tube('iron',`Wall upright ${i}`,[V(top.x,.65,top.z),top],i%2===0?.053:.032,{attachedTo:'stone plinth'});for(const y of stations[i].hall?[.80,3.35,3.63,5.46]:[.80,3.35,3.63])cylinder(b,'brass','Flat riveted upright ferrule',.062,.062,.085,V(top.x,y,top.z));}
  }
  for(let j=0;j<=sections;j+=2)for(const[first,last]of runs){const points=Array.from({length:last-first+1},(_,i)=>roof((first+i)/along,j/sections));if(j===0){for(const side of[-1,1]){const edge=points.filter(p=>p.x*side>=1.50);if(edge.length>1)b.tube('iron','Front eaves beyond entry',edge,.066);}}else b.tube(j===12?'brass':'iron',`Long glazing bar ${j}`,points,j===sections?.066:.020);}
  if(highHall)for(let i=0;i<along;i++)if(stations[i].x===stations[i+1].x)for(let j=0;j<=sections;j+=2)b.tube('iron','Central hall clerestory tie',[roof(i/along,j/sections),roof((i+1)/along,j/sections)],j===0||j===sections?.053:.025,{attachedTo:'paired wing and central hall ribs'});
  const patch=(points,name)=>{const g=new THREE.BufferGeometry(),p=points.flatMap(v=>v.toArray());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();b.add(g,'glass',name,V(),null,{keepUV:true,role:'glass',attachedTo:'matching iron glazing bars'});g.dispose();};
  for(let i=0;i<along;i++)for(let j=0;j<sections;j++){const name=highHall?(stations[i].x===stations[i+1].x?'Central hall clerestory glazing':stations[i].hall&&stations[i+1].hall?'Central hall glazing':'Wing roof glazing'):'Curved glazing';patch([roof(i/along,j/sections),roof((i+1)/along,j/sections),roof((i+1)/along,(j+1)/sections),roof(i/along,(j+1)/sections)],`${name} ${i}/${j}`);}
  // The front door replaces glazing and transoms throughout its clear rectangle.
  for(const end of[0,1])for(let i=0;i<along;i++){const p=roof(i/along,end),q=roof((i+1)/along,end);if(p.x===q.x)continue;const top=Math.min(p.y,q.y)-.02;if(end===0&&p.x<1.6&&q.x> -1.6){if(highHall)patch([V(p.x,3.98,p.z),V(q.x,3.98,q.z),V(q.x,top,q.z),V(p.x,top,p.z)],'Central entry fanlight glazing');continue;}
    for(const[y0,y1]of[[.73,2.05],[2.05,3.63],...(highHall&&top>3.7?[[3.63,top]]:[])])patch([V(p.x,y0,p.z),V(q.x,y0,q.z),V(q.x,y1,q.z),V(p.x,y1,p.z)],'Wall glazing pane');b.tube('iron','Wall horizontal glazing bar',[V(p.x,2.05,p.z),V(q.x,2.05,q.z)],.025);b.tube('iron','Ornament rail',[V(p.x,3.24,p.z),V(q.x,3.24,q.z)],.025);b.tube('iron','Rosette support stem',[V((p.x+q.x)/2,3.24,(p.z+q.z)/2),V((p.x+q.x)/2,3.33,(p.z+q.z)/2)],.018);rosette(b,(p.x+q.x)/2,3.42,(p.z+q.z)/2,.14);
  }
  // Curved end faces close the roof into coherent iron/glass pavilions.
  for(const u of[0,1]){const points=Array.from({length:sections+1},(_,j)=>roof(u,j/sections));for(let j=0;j<sections;j++){const p=points[j],q=points[j+1];patch([V(p.x,.7,p.z),V(q.x,.7,q.z),q,p],'End pavilion glazing');if(j%3===0)b.tube('iron','End pavilion mullion',[V(p.x,.7,p.z),p],.032);}b.tube('iron','End pavilion sill',points.map(p=>V(p.x,.72,p.z)),.06);}
  for(const end of[0,1])for(const[first,last]of runs){const points=Array.from({length:last-first+1},(_,i)=>roof((first+i)/along,end));if(end===0){for(const side of[-1,1]){const edge=points.filter(p=>p.x*side>=1.50);if(edge.length>1)b.tube('iron','Curved supported front gutter',edge,.083);}}else b.tube('iron','Curved supported back gutter',points,.083);}
  for(const x of[-5.2,5.2])for(const z of[-4.1,4.1])b.tube('iron','Attached rainwater downpipe',[V(x,3.64,z),V(x,3.36,z+.04),V(x,.1,z+.04)],.031);
  if(highHall){
    for(const x of[-3.5,3.5])for(const z of[-4.1,4.1])b.tube('iron','Central hall rainwater downpipe',[V(x,5.48,z),V(x,5.20,z+.04),V(x,.1,z+.04)],.031,{attachedTo:'central hall corner upright'});
    b.tube('iron','Central entrance glazing header',[V(-1.6,5.5,4.1),V(1.6,5.5,4.1)],.066,{attachedTo:'central hall entry uprights'});
    for(const x of[-.8,0,.8])b.tube('iron','Central entrance fanlight mullion',[V(x,3.98,4.1),V(x,5.5,4.1)],.025,{attachedTo:'door lintel and central entrance glazing header'});
  }
  // Wide fixed-open inward doors fold alongside the aisle, entirely inside the footprint.
  for(const side of[-1,1]){const x=side*1.49,z=4.11;b.box('iron','Door structural jamb',.15,3.88,.20,x,1.94,z,{collider:true});b.box('stone','Door jamb stone foot',.27,.32,.34,x,.16,z,{collider:true});
    const dx=side*1.50;for(const zz of[2.64,4.06])b.box('iron','Open door stile',.07,3.49,.065,dx,1.795,zz,{collider:true});for(const y of[.09,.72,2.23,3.52])b.box('iron','Open door cross rail',.065,.065,1.45,dx,y,3.35);patch([V(dx,.76,2.67),V(dx,.76,4.02),V(dx,3.49,4.02),V(dx,3.49,2.67)],'Open door glass');
    b.box('iron','Door lower raised panel',.06,.58,1.34,dx,.41,3.35);for(const y of[.5,1.75,3.15])cylinder(b,'brass','Door hinge knuckle',.055,.055,.17,V(dx,y,4.08));b.tube('brass','Door return handle',[V(dx-side*.055,1.55,2.82),V(dx-side*.14,1.55,2.82),V(dx-side*.14,1.81,2.82),V(dx-side*.055,1.81,2.82)],.018);
  }
  b.box('iron','Door lintel',3.16,.13,.18,0,3.91,4.11);
  const doorArch=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI;return V(Math.cos(a)*1.53,3.90+Math.sin(a)*1.14,4.12);});b.tube('iron','Arched entry hood',doorArch,.09);b.tube('brass','Entry hood inner bead',doorArch.map(p=>V(p.x*.92,3.92+(p.y-3.9)*.9,p.z+.03)),.020);
  for(let i=0;i<9;i++){const a=(i+.5)/9*Math.PI;b.tube('iron','Fanlight spoke',[V(0,3.96,4.12),V(Math.cos(a)*1.47,3.90+Math.sin(a)*1.09,4.12)],.025);}rosette(b,0,4.09,4.22,.24);
  // A subordinate ventilating lantern with louvered sides and curved copper cap.
  const vent=highHall?{base:8.43,bottom:8.51,post:.48,cap:8.99,rise:.52,finial:9.51}:{base:5.62,bottom:5.655,post:.83,cap:6.48,rise:.72,finial:7.20};
  b.box('iron','Ridge ventilator base',1.9,.18,1.48,0,vent.base,0);
  for(const x of[-.78,.78])for(const z of[-.56,.56])b.box('iron','Ventilator corner column',.09,vent.post,.09,x,highHall?vent.bottom+vent.post/2:6.07,z);
  for(const z of[-.58,.58])for(let i=0;i<6;i++)b.box('iron','Ventilator open louver',1.57,.055,.18,0,highHall?8.57+i*.073:5.76+i*.118,z);
  for(const x of[-.8,.8])for(let i=0;i<6;i++)b.box('iron','Ventilator end louver',.18,.055,1.08,x,highHall?8.57+i*.073:5.76+i*.118,0);
  const dome=new THREE.SphereGeometry(1,32,12,0,Math.PI*2,0,Math.PI/2);dome.scale(.98,vent.rise,.76);b.add(dome,'iron','Curved copper ventilator crown',V(0,vent.cap,0));dome.dispose();
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const points=Array.from({length:13},(_,j)=>{const t=j/12*Math.PI/2;return V(.99*Math.cos(t)*Math.cos(a),vent.cap+(vent.rise+.01)*Math.sin(t),.77*Math.cos(t)*Math.sin(a));});b.tube('brass','Cupola seam',points,.019);}
  lathe(b,'brass','Finial',[[.12,0],[.12,.05],[.055,.12],[.08,.17],[.025,.26],[0,.29]],V(0,vent.finial,0));
  // Unequal end/back collections: full photographed trees, lower fern urns and pink-flower pots.
  for(const[x,z,scale,seed]of[[-5.2,-1.2,2.2,4],[-3.6,-2.6,1.75,7],[4.7,-1.65,2.4,10],[6.1,.15,1.55,13]])fullPottedPlant(b,x,z,scale,seed);
  for(const[x,z,scale,seed]of[[-6.1,.7,1.3,3],[-4.25,-.65,1.15,8],[-2.45,-2.9,1.05,5],[3.15,-2.85,1.4,11],[5.8,-1.6,1.12,14],[5.55,1.15,1.3,17]])pottedCollection(b,x,z,scale,'fern',seed);
  for(const[x,z,scale,seed]of[[-5.35,1.7,.72,21],[-3.0,-2.5,.65,24],[3.0,-1.4,.80,27],[6.35,1.75,.60,30]])pottedCollection(b,x,z,scale,'flowers',seed);
  for(const side of[-1,1]){const x=side*3.6,z=1.50;b.box('wood','Workbench thick top',2.8,.14,1.05,x,1.30,z,{collider:true});for(const dx of[-1.15,1.15])for(const dz of[-.37,.37])b.box('wood','Workbench joined leg',.13,1.25,.13,x+dx,.625,z+dz,{collider:true});b.box('wood','Workbench lower shelf',2.54,.09,.86,x,.33,z);
    pottedCollection(b,x-.75,z+.05,.58,'fern',side+6,1.38);pottedCollection(b,x+.30,z-.10,.48,'flowers',side+11,1.38);fullPottedPlant(b,x+.98,z+.03,.62,side+15,1.38);
    pottedCollection(b,x-.55,z,.38,'fern',side+21,.38);pottedCollection(b,x+.5,z,.33,'flowers',side+26,.38);
  }
  pottedCollection(b,-2.30,3.29,.78,'flowers',35);pottedCollection(b,2.35,3.25,.64,'fern',37);
  if(inhabited){hallTreeFern(b,-2.25,-1.25);hallBroadleaf(b,2.25,-1.40);hallLamps(b);}
  b.group.userData.clearPassages=[{min:[-1.1,.03,-3.75],max:[1.1,3.6,4.5],kind:'south door and central aisle'}];b.group.userData.doors={state:'fixed-open inward',clearWidth:2.83,fullWidthClearHeight:3.84};
  if(highHall){b.group.userData.reviewCandidate='r10-conservatory';b.group.userData.architecture={centralHallLength:7,centralEaves:5.5,centralCrown:8.5,wingCrown:5.2,proposedWorldYaw:Math.PI/2};b.group.userData.studyViews={threequarter:{eye:[21,14,23],target:[0,3.7,0]},front:{eye:[0,6.4,26],target:[0,4.4,0]},profile:{eye:[26,6.4,0],target:[0,4.4,0]},back:{eye:[0,9,-27],target:[0,3.7,0]},overview:{eye:[14,24,16],target:[0,3.3,0]},eye:{eye:[0,3.28,11],target:[0,3.7,0]},interior:{eye:[0,2.78,3.63],target:[-2.2,5.3,-3.7]},close:{eye:[3,6.5,9],target:[0,4.8,3.9]}};}
  if(inhabited){b.group.userData.reviewCandidate='r11-conservatory';b.group.userData.studyViews.interior={eye:[0,2.78,3.98],target:[-1.65,2.4,-2.5],fov:70};b.group.userData.botanicalAuthoring='Two original full-geometry tall conservatory specimens with attached trunks, petioles and curved leaves, using existing original pigment/vein maps. The 44 full-source potted roots remain unchanged.';}
  const group=b.finish();return inhabited?installHallLights(group):group;
}

function pondPoint(t,offset=0,expanded=false){const[x,z]=waterGardenContourPoint(t,offset,expanded);return V(x,0,z);}
function pondDisk(b,key,name,height,scale=1,expanded=false){const points=Array.from({length:144},(_,i)=>pondPoint(i/144,0,expanded).multiplyScalar(scale)),shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z))),g=new THREE.ShapeGeometry(shape,24);g.rotateX(-Math.PI/2);g.translate(0,height,0);b.add(g,key,name,V(),null,{role:key==='water'?'water':'basin'});g.dispose();}
function prepareLilyMaterials(){
  const m=getHerbariumMaterials();if(m.lily)return;const size=1024,pigment=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),relief=new Float32Array(size*size);
  const veins=[.32,1.06,1.82,2.65,3.51,4.20,5.07,5.74];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=(x/size-.5)*2,v=(y/size-.5)*2;let primary=0,secondary=0;
    for(let k=0;k<veins.length;k++){const a=veins[k],along=u*Math.cos(a)+v*Math.sin(a),cross=-u*Math.sin(a)+v*Math.cos(a),curve=.012*Math.sin(along*5+k);if(along<=.02||Math.abs(cross)>along*.38)continue;primary=Math.max(primary,Math.exp(-(((cross-curve)/.004)**2)));
      const offset=along-Math.abs(cross-curve)*.67,branchDistance=Math.abs(((offset+.03)% .125)-.0625);secondary=Math.max(secondary,Math.exp(-((branchDistance/.003)**2))*Math.min(1,Math.abs(cross)*35));}
    const noise=Math.sin(x*.17+y*.27)*Math.sin(x*.63-y*.13),cloud=Math.sin(x*.019+Math.sin(y*.015)*.7)*Math.sin(y*.024-x*.011),tone=.90+.020*cloud+.015*noise+.008*primary+.004*secondary,i=(y*size+x)*4;relief[y*size+x]=primary*.023+secondary*.006+noise*.0005;pigment[i]=75*tone;pigment[i+1]=108*tone;pigment[i+2]=57*tone;pigment[i+3]=255;}

  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const h=(xx,yy)=>relief[Math.max(0,Math.min(size-1,yy))*size+Math.max(0,Math.min(size-1,xx))],n=V((h(x-1,y)-h(x+1,y))*1.5,(h(x,y-1)-h(x,y+1))*1.5,1).normalize(),i=(y*size+x)*4;normal[i]=(n.x*.5+.5)*255;normal[i+1]=(n.y*.5+.5)*255;normal[i+2]=(n.z*.5+.5)*255;normal[i+3]=255;}
  const texture=(data,srgb)=>{const t=new THREE.DataTexture(data,size,size);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=8;t.needsUpdate=true;t.name=`Original waterlily ${srgb?'pigment':'branching vein relief'} 1024`;t.userData.sharedAsset=true;return t;};
  m.lily=new THREE.MeshPhysicalMaterial({name:'Herbarium living waterlily lamina',map:texture(pigment,true),normalMap:texture(normal,false),normalScale:new THREE.Vector2(.24,.24),roughness:.40,clearcoat:.24,clearcoatRoughness:.28,side:THREE.DoubleSide,vertexColors:true,userData:{sharedAsset:true}});
  m.lilyPink=material('waterlily rose petals','#deb5c2',{roughness:.52,side:THREE.DoubleSide,vertexColors:true});m.lilyIvory=material('waterlily ivory petals','#f0ead9',{roughness:.55,side:THREE.DoubleSide,vertexColors:true});m.lilyPollen=material('waterlily golden anthers','#d8b74e',{roughness:.63});
}
function lilyPetal(b,center,angle,length,width,rise,key,seed){
  const rows=16,columns=6,p=[],uv=[],colors=[],index=[],c=Math.cos(angle),s=Math.sin(angle);
  for(let j=0;j<=rows;j++){const t=j/rows,span=Math.sin(Math.PI*t)**.84*width;for(let k=0;k<=columns;k++){const side=k/columns*2-1,along=length*t,across=span*side,y=rise*(t*t*.92+.28*Math.sin(t*Math.PI))-.018*Math.sin(t*Math.PI)*side*side;p.push(center.x+c*along-s*across,center.y+y,center.z+s*along+c*across);uv.push(k/columns,t);const tone=.80+.20*t+.025*Math.sin(seed*1.3+j*.24);colors.push(tone,tone,tone);} }
  for(let j=0;j<rows;j++)for(let k=0;k<columns;k++){const a=j*(columns+1)+k;index.push(a,a+columns+1,a+1,a+1,a+columns+1,a+columns+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();
  // Collapsed endpoint vertices have no face area; borrow the adjacent valid surface normal so export preserves all normal bytes.
  const normals=g.attributes.normal;for(let i=0;i<normals.count;i++)if(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))<1e-8){const adjacent=i<columns+1?i+columns+1:i-columns-1;normals.setXYZ(i,normals.getX(adjacent),normals.getY(adjacent),normals.getZ(adjacent));}
  b.add(g,key,'Curved waterlily petal',V(),null,{keepUV:true,role:'plant',attachedTo:'waterlily receptacle'});g.dispose();
}
function lily(b,x,z,r,seed){
  prepareLilyMaterials();const rand=rng(seed),p=[],uv=[],colors=[],index=[],padY=.184+(seed%7)*.001,yaw=seed*2.39996323,n=112,rings=18,stride=n+1;
  // Two very thin, gently cupped surfaces share an organic notched perimeter; no coarse flat triangle fan or raised straight spokes.
  for(let side=0;side<2;side++)for(let j=0;j<=rings;j++){const t=j/rings;for(let i=0;i<=n;i++){const notch=.06+.10*t*t,localA=notch+(Math.PI*2-notch*2)*i/n,a=localA+yaw,rr=r*t*(1+.024*Math.sin(a*5+seed)+.012*Math.sin(a*11)),y=padY+.006*t*t+.0028*Math.sin(a*3+seed)*t+.002*Math.sin(a*7)*t*t-side*.002;p.push(x+rr*Math.cos(a),y,z+rr*Math.sin(a));uv.push(.5+rr*Math.cos(localA)/(2*r*1.04),.5+rr*Math.sin(localA)/(2*r*1.04));const tone=.94+(seed%5)*.022-.07*side;colors.push(tone,tone,tone);}}
  const layer=(rings+1)*stride;for(let side=0;side<2;side++)for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=side*layer+j*stride+i,tri=j===0?[a,a+stride,a+stride+1]:[a,a+stride,a+1,a+1,a+stride,a+stride+1];index.push(...(side?tri:tri.reverse()));}
  for(let i=0;i<n;i++){const a=rings*stride+i,c=layer+a;index.push(a,a+1,c,a+1,c+1,c);}
  for(const edge of[0,n])for(let j=0;j<rings;j++){const a=j*stride+edge,c=layer+a;index.push(a,c,a+stride,c,c+stride,a+stride);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();b.add(g,'lily','Smooth notched floating waterlily lamina',V(),null,{keepUV:true,role:'plant',attachedTo:'water rooted rhizome'});g.dispose();
  b.tube('submerged','Lily submerged petiole',[V(x-.12,-.31,z+.06),V(x-.06,-.12,z+.03),V(x,padY,z)],.006,{role:'plant'});
  if(seed%4===0){const top=V(x+r*.16,.246,z-r*.16);b.tube('submerged','Waterlily blossom stalk',[V(top.x,-.28,top.z),top],.008,{role:'plant'});
    for(let layer=0;layer<3;layer++){const count=14-layer*3;for(let j=0;j<count;j++){const angle=j/count*Math.PI*2+layer*.37+rand()*.025;lilyPetal(b,top.clone().add(V(0,layer*.006,0)),angle,r*(.63-layer*.11),r*(.125-layer*.018),r*(.12+layer*.12),seed%8?'lilyPink':'lilyIvory',seed+j);}}
    b.sphere('lilyPollen','Small waterlily receptacle',top.clone().add(V(0,.015,0)),[r*.075,.010,r*.075]);
    for(let j=0;j<38;j++){const a=j*2.399,d=r*.08*Math.sqrt(j/38),base=top.clone().add(V(Math.cos(a)*d,.012,Math.sin(a)*d)),tip=base.clone().add(V(Math.cos(a)*.006,.020+rand()*.026,Math.sin(a)*.006));b.tube('lilyPollen','Fine waterlily stamen',[base,base.clone().lerp(tip,.5).add(V(Math.cos(a)*.003,0,Math.sin(a)*.003)),tip],.0015,{role:'plant'});b.sphere('lilyPollen','Rounded waterlily anther',tip,[.0026,.006,.0026]);}
  }
}
function bench(b,x,z,rotation=0){const c=Math.cos(rotation),s=Math.sin(rotation),pos=(a,y,d)=>V(x+a*c+d*s,y,z-a*s+d*c);for(let j=0;j<5;j++){const geo=beveledBlock(2.45,.075,.12,.018).clone();geo.rotateY(rotation);b.add(geo,'wood','Bench seat oak slat',pos(0,.45,(j-2)*.135));geo.dispose();}for(let j=0;j<4;j++){const geo=beveledBlock(2.45,.11,.065,.02).clone();geo.rotateY(rotation);b.add(geo,'wood','Bench back oak slat',pos(0,.67+j*.125,-.32-j*.025));geo.dispose();}
  for(const side of[-1,1]){const xx=side*1.02;b.tube('iron','Curved bench load-bearing leg',[pos(xx,0,.30),pos(xx,.24,.20),pos(xx,.46,.19),pos(xx,.50,-.2),pos(xx,.80,-.36),pos(xx,1.07,-.41)],.04,{role:'furniture'});b.tube('iron','Bench rear foot',[pos(xx,.5,-.18),pos(xx,.15,-.29),pos(xx,0,-.40)],.04);b.tube('iron','Curled bench arm',[pos(xx,.47,.22),pos(xx,.66,.26),pos(xx,.73,.20),pos(xx,.75,-.06),pos(xx,.80,-.36)],.037);for(const zz of[-.39,.3])b.box('stone','Bench grounded foot',.28,.08,.22,...pos(xx,.04,zz).toArray());}b.group.userData.colliders.push({name:'Reading bench',min:[x-1.35,0,z-.6],max:[x+1.35,1.1,z+.6],kind:'furniture'});
}
function borderSegment(b,length,seed,transform=(x,y,z)=>V(x,y,z),width=1.8){
  const rand=rng(seed),count=Math.ceil(length/.28);const edge=[];
  for(let i=0;i<=count;i++){const x=-length/2+i*length/count,z=-width*.43+Math.sin(x*.74+seed)*.09;edge.push(transform(x,.07,z));}
  for(let i=0;i<edge.length-1;i++){const p=edge[i],q=edge[i+1],mid=p.clone().add(q).multiplyScalar(.5),g=beveledBlock(p.distanceTo(q)-.008,.14,.16,.035).clone();g.rotateY(-Math.atan2(q.z-p.z,q.x-p.x));b.add(g,'stone','Curved low border edging',mid);g.dispose();}
  // Continuous loam ribbon, backed by masses of actual rooted leaves.
  const positions=[],index=[];for(let i=0;i<=count;i++){const x=-length/2+i*length/count;for(const z of[-width*.42,width*.43])positions.push(...transform(x,-.006,z+Math.sin(x*.74+seed)*.09).toArray());if(i<count){const k=i*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const outline=[];for(let i=0;i<=count;i++)outline.push(new THREE.Vector2(positions[i*6],-positions[i*6+2]));for(let i=count;i>=0;i--)outline.push(new THREE.Vector2(positions[i*6+3],-positions[i*6+5]));const soilShape=new THREE.Shape(outline),bedDepth=b.group.name.includes('water')?.34:.10,soil=new THREE.ExtrudeGeometry(soilShape,{depth:bedDepth,bevelEnabled:false});soil.rotateX(-Math.PI/2);soil.translate(0,-bedDepth,0);b.add(soil,'soil','Continuous irregular planted loam',V(),null,{role:'ground'});soil.dispose();
  // Interlocking fern crowns form the continuous middle mass; flowering stems rise through it in unequal drifts.
  for(let i=0;i<Math.ceil(length*2.2);i++){
    const x=-length/2+.82+rand()*(length-1.64),z=.12+(rand()-.5)*.16+Math.sin(x*.74+seed)*.09,variant=i%3?0:2,p=transform(x,0,z),scale=variant===0?.95+rand()*.30:1.25+rand()*.40;
    groundPlant(b,'fern_02',variant,p.x,p.z,scale,seed+i*19,p.y);
  }
  for(let i=0;i<Math.ceil(length*6.7);i++){
    const row=i%4,margin=row<2?.58:.28,x=-length/2+margin+rand()*(length-margin*2),drift=Math.sin(x*.81+seed*.17),zz=row===0?Math.min(.42,width*.28):row===1?.10:-Math.min(.48,width*.32),z=zz+(rand()-.5)*.16+Math.sin(x*.74+seed)*.09,p=transform(x,0,z),scale=row===0?(drift>.10?2.6+rand()*.7:1.65+rand()*.35):row===1?1.70+rand()*.6:.85+rand()*.65;
    groundPlant(b,'periwinkle_plant',0,p.x,p.z,scale,seed+1300+i,p.y);
  }
  for(let i=0;i<Math.ceil(length*.55);i++){const x=-length/2+.45+rand()*(length-.9),p=transform(x,0,(rand()-.5)*width*.54);gardenStone(b,p,.16+rand()*.16,seed+i);}

}
export function createGardenBorder({length=12,seed=81}={}){
  if(!Number.isFinite(length)||length<2||length>30||!Number.isFinite(seed))throw new RangeError('Border requires finite length 2…30 and a finite seed.');const b=new Builder('Continuous botanical flower border',[length,2.2,1.2]);borderSegment(b,length,seed);return b.finish();
}
export function createWaterGarden(){return waterGardenAsset(true);}
export function createWaterGardenR9(){return waterGardenAsset(false);}
export function createWaterGardenR10(){return waterGardenAsset(true);}
function waterGardenAsset(expanded){
  const b=new Builder('Asymmetric reading water garden',expanded?[20,11.5,1.2]:[16,9,1.2]),point=(t,offset=0)=>pondPoint(t,offset,expanded),perimeter=Array.from({length:145},(_,i)=>point(i/144)),perimeterLength=perimeter.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(perimeter[i]),0),copingCount=expanded?Math.ceil(perimeterLength/.49):58;
  // A continuous basin floor and deep lining seal the water volume below the coping.
  pondDisk(b,'floor','Visible shallow stone basin floor',-.30,1.02,expanded);const ring=Array.from({length:144},(_,i)=>point(i/144));ringSolid(b,'mortar','Continuous watertight recessed basin lining',ring,1.035,-.34,.25,{collider:'pool-edge'});pondDisk(b,'water','Quiet inset water surface',.18,1,expanded);
  for(let i=0;i<copingCount;i++){const p=point((i+.025)/copingCount,.05),q=point((i+.975)/copingCount,.05),po=point((i+.025)/copingCount,.39),qo=point((i+.975)/copingCount,.39),shape=new THREE.Shape([new THREE.Vector2(p.x,-p.z),new THREE.Vector2(q.x,-q.z),new THREE.Vector2(qo.x,-qo.z),new THREE.Vector2(po.x,-po.z)]),g=new THREE.ExtrudeGeometry(shape,{depth:.19,bevelEnabled:true,bevelThickness:.018,bevelSize:.009,bevelSegments:1});g.rotateX(-Math.PI/2);g.translate(0,.16,0);b.add(g,i%7?'stone':'trim','Jointed basin coping block',V(),null,{role:'coping',collider:'pool-edge'});g.dispose();}
  // East landing and two sitting shelves provide local support without a narrow ring path.
  for(const[x,z,w,d]of expanded?[[8,0,2.8,2.65],[-4.3,4.1,4.5,1.86],[4.1,-4.15,4.1,1.86]]:[[6.55,0,2.8,2.65],[-3.4,3.24,4.5,1.86],[3.2,-3.24,4.1,1.86]]){const points=Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2;return new THREE.Vector2(x+Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.52*w*.5,-z+Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.52*d*.5);}),shape=new THREE.Shape(points),g=new THREE.ExtrudeGeometry(shape,{depth:.34,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,-.34,0);b.add(g,'floor','Supported rounded sitting shore',V(),null,{support:true,role:'floor'});g.dispose();}
  if(expanded){bench(b,-4.3,4.25,Math.PI);bench(b,4.1,-4.35,0);}else{bench(b,-3.4,3.40,Math.PI);bench(b,3.1,-3.42,0);}
  // Three unequal leaf colonies leave the middle and the entire east half largely calm.
  for(const[cx,cz,n,seed]of expanded?[[-4.5,-.9,12,41],[.6,1.45,8,120],[-1.25,-2.35,6,280]]:[[-3.45,-.65,12,41],[1.0,1.02,8,120],[-.75,-1.65,6,280]]){const rand=rng(seed),pads=[];for(let attempt=0;attempt<500&&pads.length<n;attempt++){const a=rand()*Math.PI*2,d=Math.sqrt(rand()),x=cx+Math.cos(a)*d*1.34,z=cz+Math.sin(a)*d*.72,r=.21+rand()*.15;if(pads.some(p=>Math.hypot(p.x-x,p.z-z)<(p.r+r)*.94))continue;pads.push({x,z,r});lily(b,x,z,r,seed+pads.length);}}
  const fountainShift=expanded?-1.5:0;
  for(let j=0;j<5;j++){const g=new THREE.TorusGeometry(.17+j*.09,.0035,5,64,.9*Math.PI*2);g.rotateX(-Math.PI/2);b.add(g,'ripple','Local fountain ripple',V(-4.85+fountainShift,.186,-.15));g.dispose();}
  b.box('stone','Low wall fountain pedestal',.55,.72,.48,-5.78+fountainShift,.36,-.05,{collider:true});b.box('trim','Fountain cap',.66,.09,.56,-5.78+fountainShift,.765,-.05);const spout=[V(-5.48+fountainShift,.58,-.05),V(-5.29+fountainShift,.58,-.05),V(-5.15+fountainShift,.48,-.05),V(-5.04+fountainShift,.32,-.05),V(-4.96+fountainShift,.19,-.05)];b.tube('brass','Wall fountain metal outlet',spout.slice(0,2),.035);b.tube('water','Local descending water',spout.slice(1),.025,{role:'water'});
  for(const[t0,t1,originalLength,seed]of[[.08,.28,5.4,82],[.405,.79,9.8,176]]){
    const arc=Array.from({length:65},(_,i)=>point(t0+(t1-t0)*i/64,.87)),length=expanded?arc.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(arc[i]),0):originalLength;
    borderSegment(b,length,seed,(x,y,z)=>{const t=t0+(x/length+.5)*(t1-t0),p=point(t,.87+z*.82);return V(p.x,y,p.z);},1.18);
  }
  b.group.userData.clearPassages=[{min:[expanded?7.55:6.2,.03,-1.1],max:[expanded?9.35:8,3.6,1.1],kind:'east arrival shelf'}];b.group.userData.water={height:.18,basinBottom:-.30,calmArea:'central and east water; three edge colonies',shadowTreatment:'Opaque land-shadow projection disabled for surface pads and submerged stems: the physical transmission pass does not attenuate land shadows through water. Submerged stem contrast is locally softened; plant/pad geometry and surface elevation are unchanged.'};
  if(expanded){b.group.userData.reviewCandidate='r10-water';b.group.userData.water.contour=ring.map(p=>[p.x,p.z]);b.group.userData.studyViews={threequarter:{eye:[20,12,22],target:[0,.3,0]},front:{eye:[0,10,25],target:[0,.2,0]},profile:{eye:[25,8,0],target:[0,.2,0]},back:{eye:[0,10,-25],target:[0,.2,0]},overview:{eye:[11,22,13],target:[0,.1,0]},eye:{eye:[10,3.28,2.2],target:[-1,.2,0]},interior:{eye:[-4.3,1.65,4.2],target:[1,.2,-.7]},close:{eye:[-.1,2.1,4.8],target:[.6,.20,1.45]}};}
  return b.finish();
}

/** Clone transforms/metadata are independent. Geometry is released only after the last registered clone. */
/** The world and studio consume the same night-lighting entries. No scene is retained. */
export function getHerbariumLighting(group){
  const lighting={lights:[],emissiveMaterials:[],nightMaterials:[],nightObjects:[]},seen=new Set();
  group?.traverse(object=>{
    if(object.isLight&&object.userData.herbariumLamp)lighting.lights.push({light:object,baseIntensity:object.userData.authoredIntensity});
    for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])if(material.userData.herbariumNightEmission&&!seen.has(material)){seen.add(material);lighting.emissiveMaterials.push({material,baseIntensity:material.userData.authoredEmissiveIntensity});}
  });return lighting;
}
export function cloneHerbariumAsset(group){
  const owner=owners.get(group);if(!owner||group.userData.disposed)throw new Error('Cannot clone an unowned or disposed herbarium asset.');const clone=group.clone(true),copies=new Map();
  clone.traverse(mesh=>{if(!mesh.isMesh)return;const copy=material=>{if(!material.userData.herbariumOwnedMaterial)return material;if(!copies.has(material))copies.set(material,material.clone());return copies.get(material);};mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);});
  owner.refs++;owners.set(clone,owner);localMaterials.set(clone,new Set(copies.values()));return clone;
}
export function disposeHerbariumAsset(group){const owner=owners.get(group);if(!owner)return;owners.delete(group);group.removeFromParent();group.userData.disposed=true;for(const material of localMaterials.get(group)||[])material.dispose();localMaterials.delete(group);if(--owner.refs===0){const geometries=new Set(owner.meshes.map(m=>m.geometry));for(const g of geometries)g.dispose();}}
/** Caller owns these transformed geometry copies; feed to createSurfaceSupport then dispose. */
export function getHerbariumSupportGeometries(group){group.updateWorldMatrix(true,true);const result=[];group.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.support)result.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));});return result;}
/** World-space bounds from each actual named solid, never the whole greenhouse box. */
export function getHerbariumColliders(group){group.updateWorldMatrix(true,true);return group.userData.colliders.map(c=>{const bounds=new THREE.Box3(V(...c.min),V(...c.max)).applyMatrix4(group.matrixWorld);return {...c,min:bounds.min.toArray(),max:bounds.max.toArray()};});}

function waterNormalMap(){
  const size=512,data=new Uint8Array(size*size*4),h=(u,v)=>Math.sin(u*51+Math.sin(v*17)*.7)*.36+Math.sin(v*63+u*11)*.23+Math.sin(u*113-v*73)*.075;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size,n=V((h(u-.001,v)-h(u+.001,v))*.7,(h(u,v-.001)-h(u,v+.001))*.7,1).normalize(),i=(y*size+x)*4;data[i]=(n.x*.5+.5)*255;data[i+1]=(n.y*.5+.5)*255;data[i+2]=(n.z*.5+.5)*255;data[i+3]=255;}
  const map=new THREE.DataTexture(data,size,size);map.name='Original calm water micro-ripple normal';map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(.8,.8);map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.needsUpdate=true;map.userData.sharedAsset=true;return map;
}
function gardenStone(b,point,size,seed){
  const g=new THREE.SphereGeometry(1,20,12),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.12*Math.sin(x*9+seed)*Math.sin(z*7-y*3);p.setXYZ(i,x*size*n,y*size*.63*n+size*.33,z*size*.82*n);}g.computeVertexNormals();b.add(g,'mortar','Rooted mossy border stone',point,null,{role:'ground'});g.dispose();
}

const stoneDerivatives=new WeakMap();
function stoneAlbedo(source){
  if(stoneDerivatives.has(source))return stoneDerivatives.get(source);const image=source.image,width=image.width,height=image.height;let pixels=image.data;
  if(!pixels){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);pixels=context.getImageData(0,0,width,height).data;}
  const data=new Uint8Array(width*height*4);for(let i=0;i<data.length;i+=4){const l=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255,value=Math.max(0,Math.min(255,Math.round((.67+.34*l)*255)));data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;}
  const texture=new THREE.DataTexture(data,width,height);texture.name='Pale limestone albedo derived from castle-masonry source pixels';texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=source.flipY;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=8;texture.needsUpdate=true;texture.userData={sharedAsset:true,source:'castle-masonry/color.webp',derivation:'Luminance-preserving pale limestone pigment; full source resolution'};stoneDerivatives.set(source,texture);return texture;
}

const botanicalCatalog={
  fern_02:{author:'Rob Tuytel / Rico Cilliers',sha256:'0997aa669e73f1fce052366ddb563754294b97379d6e185a6f6a24bfe66dc083'},
  periwinkle_plant:{author:'Amal Kumar',sha256:'7dc4b4edf073647d2c3c5b46e0ead8a035b1654e4871ff3ba048663860d6588e'},
  potted_plant_01:{author:'Rico Cilliers',sha256:'8637c846709769f0ee3178ed4eccbb594129e0f457896c287f788b6a97449901'},
};
const botanicalAssets=new Map();
/** Accepted source specimens; resourceLoader owns shared transfers and per-consumer cancellation. */
export async function loadHerbariumBotanicalAssets({kind,...options}={}){
  const ids=kind?[kind]:Object.keys(botanicalCatalog);getHerbariumMaterials();
  await Promise.all(ids.map(async id=>{
    if(!botanicalCatalog[id])throw new RangeError(`Unknown botanical source: ${id}`);
    const gltf=await loadGLTF({id:`herbarium-source-${id}`,url:`/models/herbarium/botanical/${id}.glb`,phase:2},options);
    if(!botanicalAssets.has(id))bindHerbariumBotanicalSource(id,gltf.scene);
  }));return ids.map(id=>({id,variants:botanicalAssets.get(id).map(v=>v.name),...botanicalCatalog[id]}));
}
/** Bind an actual decoded source scene; shared source meshes remain immutable. Also used by the pixel-faithful Node exporter. */
export function bindHerbariumBotanicalSource(id,scene){
  if(!botanicalCatalog[id])throw new RangeError(`Unknown botanical source: ${id}`);
  getHerbariumMaterials();scene.updateMatrixWorld(true);const pieces=[],keys=new Map();
  scene.traverse(object=>{
    if(!object.isMesh)return;
    if(Array.isArray(object.material))throw new Error(`${id}: explicitly split source material groups before binding.`);
    const m=object.material;let key=keys.get(m);
    if(!key){key=`source-${id}-${keys.size}`;keys.set(m,key);if(!materials[key]){materials[key]=m.clone();materials[key].depthWrite=true;materials[key].alphaToCoverage=materials[key].alphaTest>0;Object.assign(materials[key].userData,{sharedAsset:true,sourceAsset:id,sourceURL:`https://polyhaven.com/a/${id}`,license:'CC0'});}}
    // Multi-node pot/soil/stem/leaves form ONE original specimen; their authored relative transforms are essential.
    // Other packages lay independent plant variants on a grid, so only that layout translation is removed.
    const matrix=id==='potted_plant_01'?object.matrixWorld.clone():new THREE.Matrix4().compose(V(),object.quaternion,object.scale);
    pieces.push({name:object.name,geometry:object.geometry,matrix,key});
  });
  if(!pieces.length)throw new Error(`${id} contains no mesh specimens.`);
  botanicalAssets.set(id,id==='potted_plant_01'?[{name:'potted_plant_01 complete',pieces}]:pieces.map(p=>({name:p.name,pieces:[p]})));
}
export function createHerbariumBotanicalSpecimen(id,{variant=0}={}){
  const variants=botanicalAssets.get(id);if(!variants)throw new Error(`Call loadHerbariumBotanicalAssets before creating ${id}.`);if(!Number.isInteger(variant)||variant<0||variant>=variants.length)throw new RangeError('Botanical variant is outside the source package.');
  const source=variants[variant],bounds=new THREE.Box3(),copies=[];let b;
  try{
  for(const p of source.pieces){const g=p.geometry.clone();copies.push({...p,geometry:g});g.applyMatrix4(p.matrix);g.computeBoundingBox();bounds.union(g.boundingBox);}const size=bounds.getSize(V()),center=bounds.getCenter(V());
  b=new Builder(`CC0 source specimen · ${id} · ${source.name}`,[size.x,size.z,size.y]);
  for(const p of copies){p.geometry.translate(-center.x,-bounds.min.y,-center.z);const geometry=p.geometry;p.geometry=null;b.add(geometry,p.key,p.name,V(),null,{owned:true,keepUV:true,role:'plant'});}
  b.group.userData.originalAuthoring='Photographed CC0 source specimen, preserved geometry and 4K material pixels; isolated study, not original architecture.';
  b.group.userData.botanicalSource={id,variant:source.name,variantIndex:variant,variants:variants.map(v=>v.name),...botanicalCatalog[id],sourceURL:`https://polyhaven.com/a/${id}`,license:'CC0',transform:'Original orientation and unit scale, centered X/Z and minimum Y=0. Separate-variant layout translation removed; complete potted specimen preserves all relative node transforms.',nativeSourceBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};return b.finish();
  }catch(error){b?.discard();throw error;}finally{for(const p of copies)p.geometry?.dispose();}
}

const paintDerivatives=new WeakMap();
function quietPaintAlbedo(source){
  if(paintDerivatives.has(source))return paintDerivatives.get(source);const image=source.image,{width,height}=image;let pixels=image.data;if(!pixels){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);pixels=context.getImageData(0,0,width,height).data;}
  const data=new Uint8Array(width*height*4);for(let i=0;i<data.length;i+=4){const l=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255,value=Math.round((.78+.17*l)*255);data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;}
  const texture=new THREE.DataTexture(data,width,height);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=source.flipY;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=8;texture.needsUpdate=true;texture.name='Restrained painted iron pigment over original copper surface relief';texture.userData={sharedAsset:true,source:'oxidized-copper/color.webp',derivation:'Full-resolution original luminance retained in narrow painted-iron contrast range; original normal/roughness/metalness channels retained.'};paintDerivatives.set(source,texture);return texture;
}
