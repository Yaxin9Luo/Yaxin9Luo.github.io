import * as THREE from 'three';
import {VegetationGeometryBatch,seededGardenRandom} from './vegetation-geometry.js';
import {understoryPose} from './garden-understory-geometry.js';
import {shoreSedgeBladeGeometry,shoreFernFrondGeometry,shoreFernFiddleheadGeometry} from './jiuzhou-shore-grove-understory-geometry.js';
const V=(...p)=>new THREE.Vector3(...p);
export const shoreUnderstoryId='jiuzhou-shore-understory-r4';
import {shoreUnderstoryVariants} from './jiuzhou-shore-grove-understory-variants.js';
export {shoreUnderstoryVariants};
const sedges=[
 {seed:14051,count:126,height:.32,spread:.53,width:.018,lift:.42,emergence:.40,youngEvery:18,lean:.35},
 {seed:68103,count:112,height:.46,spread:.48,width:.020,lift:.61,emergence:.26,youngEvery:13,lean:1.20},
 {seed:31229,count:96,height:.38,spread:.55,width:.024,lift:.50,emergence:.36,youngEvery:16,lean:2.50},
];
function sedge(b,part,index,signal){
 const spec=sedges[index],rng=seededGardenRandom(spec.seed),batch=new VegetationGeometryBatch(part.name+'-laminae'),leaves=[],roots=[];
 const colors=['#72864b','#7e9052','#6d8345','#819257','#778d4a'];
 for(let i=0;i<spec.count;i++){
  signal?.throwIfAborted();
  // Three unequal fans emerge laterally from the same rooted crown. The
  // mature majority bends before the old repeated vertical "neck" develops.
  const fan=i%10<5?0:i%10<8?1:2,angle=spec.lean+[0,2.11,4.33][fan]+(rng()-.5)*1.40;
  const radial=Math.sqrt(rng())*.088,base=[Math.cos(angle+.6)*radial,-.009-rng()*.006,Math.sin(angle+.6)*radial*.78];
  const young=i%spec.youngEvery===2,broad=i%5!==1;
  const height=spec.height*(.72+rng()*.52)*(young?1.13:1),reach=spec.spread*(.68+rng()*.30)*(young?.56:1);
  const width=spec.width*(broad?.75+rng()*.48:.36+rng()*.18),tipY=young?height*(.53+rng()*.22):.09+rng()*.15;
  const options={height,reach,width,tipY,angle,base,sway:(rng()-.5)*.12,twist:(rng()-.5)*.95,
   emergence:young?.12:spec.emergence+(rng()-.5)*.12,lift:young?.82:spec.lift+(rng()-.5)*.16,
   color:colors[(i+index)%colors.length],paleEdge:broad?.075:.11,rows:44,columns:8};
  const g=shoreSedgeBladeGeometry(options);
  leaves.push({...options,young,broad,vertexOffset:batch.positions.length/3,vertexCount:g.attributes.position.count,controlPoints:g.userData.controlPoints});
  roots.push(base);batch.add(g);g.dispose();
 }
 const geometry=batch.finish();geometry.userData={body:'shore-r4-rooted-sedge',variant:part.userData.variant,leaves,rootDatum:0};
 b.mesh(part,geometry,b.leaf,part.name+'-laminae');part.userData.rootPoints=roots;
 part.userData.form={seed:spec.seed,leaves:spec.count,broadLeaves:leaves.filter(l=>l.broad).length,youngLeaves:leaves.filter(l=>l.young).length,rows:44,columns:8};
}
function fern(b,part,index,signal){
 const seed=[63211,90127,11813][index],rng=seededGardenRandom(seed),count=[11,13,10][index],roots=[],forms=[];
 for(let i=0;i<count;i++){
  signal?.throwIfAborted();
  const angle=i*2.399963+(rng()-.5)*.72+[.4,1.1,-.5][index];
  const tier=i%5,low=tier===0||tier===3;
  const length=(index===1?.68:.60)+rng()*(index===1?.22:.20);
  const rise=low?.50+rng()*.17:.76+rng()*.35,radial=low?.98:.69+rng()*.28;
  const direction=V(Math.cos(angle)*radial,rise,Math.sin(angle)*radial);
  const root=V(Math.cos(angle)*.034,-.006,Math.sin(angle)*.034);
  const frame=understoryPose(root,direction,V((rng()-.5)*.12,1,(rng()-.5)*.12));
  const group=new THREE.Group();group.name=part.name+'-mature-'+(i+1);group.applyMatrix4(frame);part.add(group);
  const shape=shoreFernFrondGeometry({length,width:.235+rng()*.080,arch:low?.17+rng()*.075:.24+rng()*.12,
   sideBend:(rng()-.5)*.10,pairs:13,seed:seed+i*131,leafColor:['#6f8d50','#799456','#668748','#829c5c'][(i+index)%4]});
  b.mesh(group,shape.wood,b.wood,group.name+'-rachises');b.mesh(group,shape.lamina,b.leaf,group.name+'-pinnules');
  group.userData={age:'green-mature',form:shape.data};roots.push(V(...shape.data.root).applyMatrix4(frame).toArray());forms.push(shape.data);
 }
 if(index===2){
  const group=new THREE.Group();group.name=part.name+'-coiled-new-shoot';group.rotation.y=.73;part.add(group);
  const shape=shoreFernFiddleheadGeometry({height:.29,radius:.044,seed:seed+47});
  b.mesh(group,shape.wood,b.wood,group.name+'-stem');b.mesh(group,shape.lamina,b.leaf,group.name+'-folded-pinnules');
  group.userData={age:'green-coiled-new',form:shape.data};roots.push(shape.data.root);forms.push(shape.data);
 }
 part.userData.rootPoints=roots;part.userData.form={seed,matureFronds:count,fiddleheads:index===2?1:0,forms};
}

/** Exactly one species owner with three cached complete shape prototypes.
 * Child variants remain at identity; the regional selector borrows only the
 * requested variant and never renders the all-variants source group itself. */
export function createJiuzhouShoreUnderstoryStudy({specimens,arrangement='specimens',signal}={}){
 if(!Array.isArray(specimens)||specimens.length!==1||!shoreUnderstoryVariants[specimens[0]]||arrangement!=='specimens')throw new Error('One supported shore R4 species required.');
 signal?.throwIfAborted();
 const species=specimens[0],geometries=new Set(),materials=new Set(),group=new THREE.Group(),part=new THREE.Group();
 group.name=shoreUnderstoryId+'-'+species;part.name='shore-r4-'+species+'-sources';part.userData={id:species};group.add(part);
 const leaf=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.69,metalness:0,side:THREE.DoubleSide});
 const wood=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.88,metalness:0});
 leaf.name='shore-r4-physical-leaf';wood.name='shore-r4-fine-stems';
 for(const m of [leaf,wood]){materials.add(m);m.userData={body:'botanical-understory',authoredPBR:true,alphaCoverage:'actual-geometry-no-alpha-mask',newSourceRevision:shoreUnderstoryId};}
 const b={leaf,wood,mesh(parent,g,m,name){geometries.add(g);const node=new THREE.Mesh(g,m);node.name=name;node.castShadow=node.receiveShadow=true;parent.add(node);return node;}};
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();const errors=[];for(const resource of [...geometries,...materials])try{resource.dispose();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Shore R4 prototype cleanup failed.');}
 try{
  for(const [index,id]of shoreUnderstoryVariants[species].entries()){
   signal?.throwIfAborted();const variant=new THREE.Group();variant.name='shore-r4-'+id;variant.userData={id:species,variant:id,sourceId:shoreUnderstoryId,sourceGeometryChanged:true,nativeReviewed:false,historicallySurveyed:false};part.add(variant);
   (species==='sedge'?sedge:fern)(b,variant,index,signal);
  }
  signal?.throwIfAborted();group.updateMatrixWorld(true);
  const variants=part.children.map(variant=>{
   let triangles=0,meshes=0;variant.traverse(n=>{if(n.isMesh){triangles+=n.geometry.index.count/3;meshes++;}});
   const box=new THREE.Box3().setFromObject(variant);
   return {id:variant.userData.variant,triangles,meshes,roots:variant.userData.rootPoints.length,form:variant.userData.form,bounds:{min:box.min.toArray(),max:box.max.toArray()}};
  });
  const diagnostics={id:shoreUnderstoryId,species,variants,triangles:variants.reduce((n,v)=>n+v.triangles,0),geometries:geometries.size,materials:materials.size,textures:0,nativeReviewed:false,historicallySurveyed:false,originalWillowChanged:false};
  return {group,parts:[part],diagnostics,get disposed(){return disposed;},dispose};
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Shore R4 prototype preparation and cleanup failed.');}throw error;}
}
