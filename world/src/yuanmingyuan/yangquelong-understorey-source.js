import * as THREE from 'three';
import {seededGardenRandom,VegetationGeometryBatch} from './vegetation-geometry.js';
import {understoryLaminaGeometry,understoryFlowerGeometry,understoryCurveStemGeometry,understoryPose,understoryLeafPairParameters,understoryPedicelCurve} from './garden-understory-geometry.js';
import {createGardenUnderstoryStudy} from './garden-understory-study.js';

const V=(...p)=>new THREE.Vector3(...p),TAU=Math.PI*2;
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong understorey source: '+message);};
export const yangquelongUnderstoreySourceSpecs=Object.freeze([
 {id:'olive-a',form:'layered-arching-small-leaf-mound',seed:73191,tint:'#637747',height:.415,reach:.49,leafLength:.053,leafWidth:.027,maximumHeight:.49},
 {id:'olive-b',form:'occasional-upright-olive-leaf-shoulder',seed:41873,tint:'#6c7d4e',height:.49,reach:.44,leafLength:.056,leafWidth:.028,maximumHeight:.56},
 {id:'sage-a',form:'low-overlapping-silver-rosettes-with-drooping-tips',seed:90919,tint:'#a2ae91',height:.29,reach:.22,leafLength:.255,leafWidth:.125,maximumHeight:.39},
 {id:'sage-b',form:'offset-young-and-arching-outer-silver-rosettes',seed:50731,tint:'#97a787',height:.32,reach:.21,leafLength:.242,leafWidth:.117,maximumHeight:.41},
 {id:'ivory',form:'rounded-ivory-flower-mound-with-high-centre-and-lower-shoulders',seed:13877,tint:'#6e8150',height:.25,reach:.29,leafLength:.059,leafWidth:.028,flower:'#f0e9d8',maximumHeight:.84},
 {id:'lilac',form:'unequal-upright-lilac-spires-with-layered-upper-whorls',seed:65537,tint:'#748652',height:.27,reach:.27,leafLength:.058,leafWidth:.023,flower:'#9b83b3',maximumHeight:1.08},
 {id:'sedge',form:'reviewed-arching-sedge-at-authored-height',seed:7371,scale:1.40,maximumHeight:.73},
].map(Object.freeze));

// The full source owns reusable geometry; placements borrow it through a
// before-dispose lease. No source geometry/material is cloned or recoloured.
export function createYangquelongUnderstoreySources({signal}={}){
 signal?.throwIfAborted();
 const group=new THREE.Group();group.name='yangquelong-understorey-sources-r5';
 const geometries=new Set(),materials=new Set(),scratch=new Set(),dependents=new Set(),nested=[];
 const variants=new Map(),errors=[];let disposed=false;
 const remember=e=>{if(!errors.includes(e))errors.push(e);};
 const attempt=fn=>{try{fn();}catch(e){remember(e);}};
 const keep=g=>{geometries.add(g);return g;};
 const temp=g=>{scratch.add(g);return g;};
 const drop=g=>{if(scratch.delete(g))g.dispose();};
 const physical=(name,roughness,side=THREE.FrontSide)=>{
  const m=new THREE.MeshStandardMaterial({name,color:0xffffff,vertexColors:true,roughness,metalness:0,side});
  m.userData={body:'authored-low-understorey',alphaCoverage:'real-curved-geometry',historicalIdentification:false};materials.add(m);return m;
 };
 const leafMaterial=physical('understorey-olive-sage-real-leaf',.79,THREE.DoubleSide);
 const stemMaterial=physical('understorey-fine-attached-stem',.87);
 const petalMaterial=physical('understorey-ivory-lilac-real-petal',.66,THREE.DoubleSide);
 function dispose(){
  if(disposed)return;disposed=true;
  // Instance buffers detach before the shared prototype resources go away.
  for(const fn of [...dependents])attempt(fn);dependents.clear();
  attempt(()=>group.removeFromParent());attempt(()=>group.clear());
  for(const g of scratch)attempt(()=>g.dispose());scratch.clear();
  for(const g of geometries)attempt(()=>g.dispose());geometries.clear();
  for(const m of materials)attempt(()=>m.dispose());materials.clear();
  for(const owner of nested)attempt(()=>owner.dispose());
  if(errors.length)throw new AggregateError([...errors],'Understorey source cleanup failed');
 }
 function addMesh(parent,batch,material,body){
  const g=keep(batch.finish());g.userData={...g.userData,body};
  const mesh=new THREE.Mesh(g,material);mesh.name=batch.name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 // Flat tube ends need their own rim vertices. Sharing them with the
 // curved side averaged three ivory cap normals back through their faces.
 // Split only the shading seam; keep every position and triangle surface.
 function separateStemCapNormals(g,segments,radialSegments){
  const stride=radialSegments+1,count=g.attributes.position.count,added=stride*2;
  for(const [name,attribute] of Object.entries(g.attributes)){
   const array=new attribute.array.constructor((count+added)*attribute.itemSize);array.set(attribute.array);
   for(let end=0;end<2;end++)for(let side=0;side<stride;side++){
    const from=(end*segments*stride+side)*attribute.itemSize,to=(count+end*stride+side)*attribute.itemSize;
    array.set(attribute.array.subarray(from,from+attribute.itemSize),to);
   }
   g.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
  }
  const indices=g.index.array.slice(),capStart=indices.length-radialSegments*6;
  for(let end=0;end<2;end++)for(let i=0;i<radialSegments*3;i++){
   const at=capStart+end*radialSegments*3+i,original=indices[at],start=end*segments*stride;
   if(original>=start&&original<start+stride)indices[at]=count+end*stride+original-start;
  }
  g.setIndex(new THREE.BufferAttribute(indices,1));g.computeVertexNormals();
  g.userData.flatCapNormalsSeparated=true;return g;
 }
 // Bend the existing dense lamina grid around its longitudinal arc. The
 // root, UVs, colours, indices and cross-section remain; only the midrib
 // trajectory and its transported normal change. Outer tips can hang down.
 function bendBroadLamina(g,angle){
  const a=g.attributes.position,uv=g.attributes.uv,length=g.userData.length;
  for(let i=0;i<a.count;i++){
   const t=uv.getY(i),theta=angle*t,z=a.getZ(i);
   a.setXYZ(i,a.getX(i),length*Math.sin(theta)/angle+z*Math.sin(theta),-length*(1-Math.cos(theta))/angle+z*Math.cos(theta));
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  g.userData.longitudinalBend=angle;return g;
 }
 function build(spec){
  const rng=seededGardenRandom(spec.seed),part=new THREE.Group();part.name='understorey-source-'+spec.id;
  part.userData={sourceId:spec.id,form:spec.form,contemporaryExhibitionDesign:true,historicalSpecies:false};
  group.add(part);
  if(spec.id==='sedge'){
   const borrowed=createGardenUnderstoryStudy({specimens:['sedge'],signal});nested.push(borrowed);
   for(const original of borrowed.parts[0].children){
    const mesh=original.clone(false);mesh.scale.setScalar(spec.scale);mesh.name=part.name+'-'+original.name;part.add(mesh);
   }
   part.userData.detail={leaves:112,sourceId:'garden-understory-study-r2/sedge',originalGeometryAndMaterialUnchanged:true,uniformHerbScale:spec.scale};
   return part;
  }
  const wood=new VegetationGeometryBatch(part.name+'-stems'),leaves=new VegetationGeometryBatch(part.name+'-leaves');
  const petals=new VegetationGeometryBatch(part.name+'-petals'),centres=new VegetationGeometryBatch(part.name+'-calyx-stamens');
  const leafShapes=[0,1].map(i=>temp(understoryLaminaGeometry({
   length:spec.leafLength*(i?.92:1),width:spec.leafWidth*(i?1.06:1),curl:spec.leafLength*(spec.id.startsWith('sage')?.055:.12),
   cup:spec.id.startsWith('sage')?.24:.14,rows:spec.id.startsWith('sage')?48:24,columns:spec.id.startsWith('sage')?16:8,teeth:9,serration:spec.id.startsWith('sage')?.038:.025,
   profile:spec.id.startsWith('sage')?.65:.52,veinHeight:.00022,color:spec.tint,
   edgeColor:new THREE.Color(spec.tint).multiplyScalar(.85),veinColor:spec.id.startsWith('sage')?'#bcc5a7':'#929e70',seed:spec.seed+i*7,
  })));
  if(spec.id.startsWith('sage'))leafShapes.forEach((g,i)=>bendBroadLamina(g,i?.90:1.10));
  const flowers=spec.flower?[0,1].map(i=>{
   const f=understoryFlowerGeometry({radius:spec.id==='ivory'?.041:.021,tint:spec.flower,seed:spec.seed+i*23});
   temp(f.lamina);temp(f.centre);return f;
  }):[];
  const detail={leaves:0,flowers:0,petals:0,stems:0,canes:0,rootPoints:[],leafRoots:[],flowerJoins:[],mainCanes:[],inflorescences:[],rosettes:[]};
  function stem(curve,radii,segments=18,radialSegments=8,color='#77825a'){
   const g=temp(understoryCurveStemGeometry({curve,radii,segments,radialSegments,color}));separateStemCapNormals(g,segments,radialSegments);wood.add(g);drop(g);detail.stems++;
  }
  function growLeaves(curve,phase,age=1,maximumParameter=1){
   const ts=understoryLeafPairParameters(curve,.023+rng()*.006).filter(t=>t<=maximumParameter);
   for(let i=0;i<ts.length;i++){
    const point=curve.getPointAt(ts[i]),tangent=curve.getTangentAt(ts[i]),angle=phase+i*1.30;
    const across=V(Math.cos(angle),.09,Math.sin(angle));across.addScaledVector(tangent,-across.dot(tangent)).normalize();
    for(const side of [-1,1]){
     const direction=across.clone().multiplyScalar(side*.86).addScaledVector(tangent,.25).add(V(0,.40+rng()*.20,0)).normalize();
     const end=point.clone().addScaledVector(direction,.0022+rng()*.0028);
     // Curved petioles share the exact leaf origin and mother-curve point.
     const c=new THREE.CubicBezierCurve3(point,point.clone().lerp(end,.33),point.clone().lerp(end,.70),end);
     stem(c,[.00030,.00020,.00013],3,6,'#7f8b5d');
     const size=(.84+rng()*.26)*age,shape=leafShapes[(i+(side>0?1:0))%2];
     const normal=V(point.x*1.7+(rng()-.5)*.45,1,point.z*1.7+(rng()-.5)*.45),m=understoryPose(end,direction,normal,[size,size,size]);
     leaves.add(shape,m,.95+rng()*.09);detail.leaves++;
     detail.leafRoots.push({mother:point.toArray(),root:end.toArray(),matrix:[...m.elements]});
    }
   }
  }
  try{
   if(spec.id.startsWith('sage')){
    // Three nearby root crowns carry complete low rosettes. Short curved
    // petioles meet the arched lamina tangent; no leaf rides a long wire.
    const crowns=[V(.010,-.007,-.045),V(-.145,-.007,.075),V(.140,-.007,.065)];
    detail.rosettes=crowns.map((root,index)=>({index,root:root.toArray(),leaves:16}));
    for(let i=0;i<48;i++){
     const crown=Math.floor(i/16),node=i%16,tier=node%3,angle=node*2.399963+crown*1.14+(rng()-.5)*.24;
     const radial=V(Math.cos(angle),0,Math.sin(angle)),root=crowns[crown].clone().addScaledVector(radial,.010+rng()*.008);
     const reach=[.038,.027,.016][tier]*(.92+rng()*.16),height=[.050,.062,.072][tier]*(spec.height/.30)*(1+crown*.025);
     const origin=root.clone().addScaledVector(radial,reach).add(V(0,height,0));
     const pitch=[.52,.82,1.22][tier]+(rng()-.5)*.10;
     const direction=radial.clone().multiplyScalar(Math.cos(pitch)).add(V(0,Math.sin(pitch),0));
     const petiole=new THREE.CubicBezierCurve3(root,root.clone().add(V(0,height*.62,0)),origin.clone().addScaledVector(direction,-.023),origin);
     stem(petiole,[.0016,.0010,.00045],28,10,'#62734f');
     const size=.90+rng()*.16,shape=leafShapes[i%2],normal=radial.clone().multiplyScalar(.10).add(V(0,1,0));
     const m=understoryPose(origin,direction,normal,[size,size,size]),vertexStart=leaves.positions.length/3;
     leaves.add(shape,m,.97+rng()*.055);detail.leaves++;
     detail.rootPoints.push(root.toArray());
     detail.leafRoots.push({mother:root.toArray(),root:origin.toArray(),matrix:[...m.elements],crown,tier,vertexStart,vertexCount:shape.attributes.position.count,tipVertex:shape.userData.tipVertex,petioleCurve:[petiole.v0,petiole.v1,petiole.v2,petiole.v3].map(p=>p.toArray()),petioleLength:petiole.getLength()});
     detail.mainCanes.push({root:root.toArray(),tip:origin.toArray(),tier,reach,height:origin.y});detail.canes++;
    }
    addMesh(part,wood,stemMaterial,'attached-thin-curved-stems');
    addMesh(part,leaves,leafMaterial,'small-veined-curved-leaves');
    detail.shape='three-short-petiole-rosettes-with-arching-and-drooping-laminae';part.userData.detail=detail;return part;
   }
   // Upright core, rounded shoulders and lower outer branches form one
   // irregular volume. None of these authored parts are scaled-up R1 fans.
   const count=spec.flower?9:18,angles=Array.from({length:count},(_,i)=>i*2.399963+(rng()-.5)*.36);
   for(let i=0;i<count;i++){
    signal?.throwIfAborted();
    const angle=angles[i],tier=spec.flower?i%3:Math.floor(i/6),baseRadius=.020+rng()*.075;
    const root=V(Math.cos(angle+1)*baseRadius,-.007,Math.sin(angle+1)*baseRadius);
    const radial=V(Math.cos(angle),0,Math.sin(angle)),side=V(-radial.z,0,radial.x);
    const spread=[.48,.76,1.0][tier],rise=[1.0,.87,.69][tier];
    const reach=spec.reach*spread*(.87+rng()*.19),h=spec.height*rise*(.88+rng()*.13);
    const tip=root.clone().addScaledVector(radial,reach).addScaledVector(side,(rng()-.5)*.075).add(V(0,h*(tier===2?.82:.96),0));
    const curve=new THREE.CubicBezierCurve3(root,
     root.clone().addScaledVector(radial,reach*.08).add(V(0,h*.40,0)),
     tip.clone().addScaledVector(radial,-reach*.30).add(V(0,h*.13,0)),tip);
    stem(curve,[.0027+rng()*.0008,.0016,.00072,.00024],32,10,'#596445');
    growLeaves(curve,angle+1);detail.canes++;detail.rootPoints.push(root.toArray());
    detail.mainCanes.push({root:root.toArray(),tip:curve.v3.toArray(),height:h,reach,tier});
    for(let j=0;j<3;j++){
     const t=.29+j*.22,anchor=curve.getPointAt(t),tangent=curve.getTangentAt(t);
     const turn=angle+(j%2?-.95:.95),out=V(Math.cos(turn),.34+rng()*.25,Math.sin(turn)).normalize();
     const len=(spec.flower?.10:.15)+rng()*(spec.flower?.04:.055),endDirection=tangent.clone().multiplyScalar(.25).addScaledVector(out,.75).normalize();
     const branchTip=anchor.clone().addScaledVector(endDirection,len);
     const branch=new THREE.CubicBezierCurve3(anchor,anchor.clone().addScaledVector(tangent,len*.30),branchTip.clone().addScaledVector(endDirection,-len*.30),branchTip);
     stem(branch,[.0010-j*.00012,.00052,.00018],20,8);
     growLeaves(branch,angle+j*1.5,.89+rng()*.10);
    }
   }
   if(spec.flower){
    function flowerAt({curve,parentParameter,centre,outward,shoot,tier,phase,size=1}){
     const parent=curve.getPointAt(parentParameter),axis=curve.getTangentAt(parentParameter),flower=flowers[phase%2];
     const m=understoryPose(centre,outward,V(0,0,1),[size,size,size]),calyx=V(...flower.data.root).applyMatrix4(m);
     const pedicel=understoryPedicelCurve(parent,calyx,outward,axis);
     stem(pedicel,[.00033,.00022,.00015],9,6,'#8c9668');
     const petalVertexStart=petals.positions.length/3;
     petals.add(flower.lamina,m);centres.add(flower.centre,m);detail.flowers++;detail.petals+=5;
     detail.flowerJoins.push({parent:parent.toArray(),calyx:calyx.toArray(),matrix:[...m.elements],localRoot:flower.data.root,centre:centre.toArray(),shoot,tier,petalVertexStart,petalVertexCount:flower.lamina.attributes.position.count});
    }
    const count=spec.id==='ivory'?9:13;
    for(let i=0;i<count;i++){
     const angle=i*2.399963+(rng()-.5)*.25,radial=V(Math.cos(angle),0,Math.sin(angle));
     const root=radial.clone().multiplyScalar(.020+rng()*.055);root.y=-.007;
     let tip,height;
     if(spec.id==='ivory'){
      // Centre heads rise above lower outward shoulders. Each head itself
      // carries a convex cap of flowers, rather than a horizontal corymb.
      const ring=i===0?0:i<5?1:2,radius=[.016,.120,.225][ring]*(.94+rng()*.12);
      height=[.650,.565,.465][ring]+(rng()-.5)*.025;
      tip=radial.clone().multiplyScalar(radius);tip.y=height;
     }else{
      // Unequal erect axes stay taller than the basal foliage. All upper
      // tiers carry real flowers and pedicels around the same stem.
      const radius=.040+Math.sqrt(i/(count-1))*.170;
      height=.995-.165*(i/(count-1))+(rng()-.5)*.035;
      tip=radial.clone().multiplyScalar(radius);tip.y=height;
     }
     const curve=new THREE.CubicBezierCurve3(root,root.clone().add(V(0,height*.42,0)),tip.clone().addScaledVector(radial,-.024).add(V(0,-height*.24,0)),tip);
     stem(curve,[.0015,.0010,.00038],34,10);growLeaves(curve,angle,.86,spec.id==='ivory'?.48:.34);
     const first=detail.flowerJoins.length;
     if(spec.id==='ivory'){
      const capRadius=.108+rng()*.013;
      for(let f=0;f<16;f++){
       const phi=f*2.399963+rng()*.17,q=Math.sqrt((f+.35)/16),reach=capRadius*q;
       const centre=tip.clone().add(V(Math.cos(phi)*reach,.095*Math.sqrt(1-q*q)+(rng()-.5)*.007,Math.sin(phi)*reach));
       const outward=V(Math.cos(phi)*q*.87,.97-q*.58,Math.sin(phi)*q*.87).normalize();
       flowerAt({curve,parentParameter:.84+(f%4)*.039,centre,outward,shoot:i,tier:f,phase:f,size:.94+rng()*.13});
      }
     }else{
      for(let tier=0;tier<8;tier++)for(let around=0;around<3;around++){
       const t=.60+tier/7*.36,phi=angle+tier*1.13+around*TAU/3+(rng()-.5)*.18,parent=curve.getPointAt(t);
       const reach=(.039-tier*.0022)*(.91+rng()*.16),centre=parent.clone().add(V(Math.cos(phi)*reach,(rng()-.5)*.008,Math.sin(phi)*reach));
       const outward=V(Math.cos(phi)*.92,.31+(.5-rng())*.12,Math.sin(phi)*.92).normalize();
       flowerAt({curve,parentParameter:t,centre,outward,shoot:i,tier,phase:tier+around,size:(.98-tier*.022)*(.95+rng()*.10)});
      }
      flowerAt({curve,parentParameter:.985,centre:tip.clone().add(V(0,.009,0)),outward:V(Math.cos(angle)*.16,.98,Math.sin(angle)*.16).normalize(),shoot:i,tier:8,phase:i,size:.69});
     }
     detail.inflorescences.push({shoot:i,kind:spec.id==='ivory'?'convex-white-head':'layered-upright-lilac-spire',root:root.toArray(),tip:tip.toArray(),curve:[curve.v0,curve.v1,curve.v2,curve.v3].map(p=>p.toArray()),flowerStart:first,flowerCount:detail.flowerJoins.length-first,basalLeafMaximumParameter:spec.id==='ivory'?.48:.34});
    }
   }
   addMesh(part,wood,stemMaterial,'attached-thin-curved-stems');
   addMesh(part,leaves,leafMaterial,'small-veined-curved-leaves');
   if(spec.flower){addMesh(part,petals,petalMaterial,'individual-five-curved-petals');addMesh(part,centres,petalMaterial,'actual-calyx-filaments-and-anthers');}
   part.userData.detail=detail;
  }finally{for(const g of leafShapes)drop(g);for(const f of flowers){drop(f.lamina);drop(f.centre);}}
  return part;
 }
 try{
  for(const spec of yangquelongUnderstoreySourceSpecs){
   signal?.throwIfAborted();const part=build(spec);part.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(part);fail(box.max.y<=spec.maximumHeight,'source exceeds authored height: '+spec.id);
   const parts=[];part.traverse(n=>{if(n.isMesh)parts.push(n);});
   const diagnostics={id:spec.id,form:spec.form,meshes:parts.length,
    maximumHeight:spec.maximumHeight,leafRows:spec.id==='sedge'?34:spec.id.startsWith('sage')?48:24,leafColumns:spec.id.startsWith('sage')?16:8,
    triangles:parts.reduce((sum,n)=>sum+(n.geometry.index?.count??n.geometry.attributes.position.count)/3,0),
    bounds:{min:box.min.toArray(),max:box.max.toArray()},leaves:part.userData.detail.leaves,flowers:part.userData.detail.flowers??0,
    historicalSpecies:false,nativeReviewed:false};
   variants.set(spec.id,{id:spec.id,group:part,meshes:parts,diagnostics});
  }
  const allGeometries=new Set(),allMaterials=new Set(),buffers=new Set();
  for(const v of variants.values())for(const mesh of v.meshes){allGeometries.add(mesh.geometry);allMaterials.add(mesh.material);
   for(const attr of [mesh.geometry.index,...Object.values(mesh.geometry.attributes)].filter(Boolean))buffers.add(attr.array.buffer);
  }
  const diagnostics={id:'yangquelong-understorey-source-r5',evidence:'contemporary-authored-museum-garden',variants:[...variants.values()].map(v=>v.diagnostics),
   uniqueGeometries:allGeometries.size,materials:materials.size+nested.reduce((n,owner)=>n+owner.diagnostics.materials,0),renderMaterials:allMaterials.size,textures:0,uniqueBufferBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),
   sourceReuse:'R4 olive colours and 24x8 small leaves retained; 48x16 broad laminae keep their grid/veins but bend into low short-petiole rosettes. Ivory heads form convex raised domes; unequal lilac axes carry eight upper flower tiers. Original curved petal/calyx/stamen sampling retained at authored flower size. Complete accepted 112-blade sedge buffers/materials remain at 1.40 herb scale. Contemporary form references are not historical or exact taxonomic reconstruction.',
   nativeReviewed:false,historicalIdentity:false,rootDatum:0};
  return {group,variants,diagnostics,dispose,
   subscribeBeforeDispose(callback){fail(!disposed&&typeof callback==='function','live source and disposer required');dependents.add(callback);return()=>dependents.delete(callback);},
   assertCurrent(){fail(!disposed&&variants.size===yangquelongUnderstoreySourceSpecs.length,'source already disposed');return true;},
   whenIdle(){return errors.length?Promise.reject(new AggregateError([...errors],'Understorey source cleanup failed')):Promise.resolve();},
   get disposed(){return disposed;},
  };
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Understorey source construction and cleanup failed',{cause:error});}throw error;}
}
