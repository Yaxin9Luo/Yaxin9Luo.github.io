import {nonOverlappingCourtPaving,pavingJointGeometry,rectPolygon} from './front-court-ground-seams.js';
import {Group,BoxGeometry,InstancedMesh,Mesh,Matrix4,Vector3,Quaternion} from 'three';
import {frontCourtLayout as F} from './front-court-layout.js';
export function createFrontCourtPaving(dagSource,{layout=F}={}){
 const found=new Map();
 dagSource?.group?.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])if(m?.name)found.set(m.name,m);});
 const names=['dagongmen-grey-brick-paving','dagongmen-grey-brick-paving-shade','dagongmen-grey-foundation'],materials=names.map(n=>found.get(n));
 if(materials.some(m=>!m?.isMaterial))throw new Error('Full Dag source paving materials are required.');
 const group=new Group();group.name='Front-court contemporary paving';const geometry=new BoxGeometry(1,1,1),bins=[[],[],[]],matrix=new Matrix4(),rotation=new Quaternion();
 let disposed=false,cleanupError=null;
 function add(bin,position,size){bins[bin].push({position,size});}
 const rectangles=nonOverlappingCourtPaving(layout),areas=rectangles.map(r=>({...r,polygon:rectPolygon(r)}));
 const shell=geometry.clone(),kept=[];for(let i=0;i<shell.index.count;i+=3){const ids=[0,1,2].map(k=>shell.index.getX(i+k));if(!ids.every(j=>shell.attributes.normal.getY(j)>.99))kept.push(...ids);}shell.setIndex(kept);
 for(const area of areas){
  const xs=area.polygon.map(p=>p[0]),zs=area.polygon.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),nx=Math.ceil((x1-x0)/.92),nz=Math.ceil((z1-z0)/.62),dx=(x1-x0)/nx,dz=(z1-z0)/nz,top=area.heightY;
  add(2,[(x0+x1)/2,top-.02,(z0+z1)/2],[x1-x0,.02,z1-z0]);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)add((i+3*j)%7===0?1:0,[x0+(i+.5)*dx,top-.015,z0+(j+.5)*dz],[dx-.006,.03,dz-.006]);
 }
 const meshes=bins.map((items,k)=>{
  const mesh=new InstancedMesh(k===2?shell:geometry,materials[k],items.length);mesh.name='front-court-paving-'+k;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={body:'contemporary-paving',borrowedMaterial:true,navigation:true};
  items.forEach((v,i)=>{matrix.compose(new Vector3(...v.position),rotation,new Vector3(...v.size));mesh.setMatrixAt(i,matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);return mesh;
 });
 const jointGeometry=pavingJointGeometry(rectangles),jointMesh=new Mesh(jointGeometry,materials[2]);jointMesh.name='front-court-paving-visible-joints';jointMesh.castShadow=jointMesh.receiveShadow=true;group.add(jointMesh);
 const counts={meshes:meshes.length+1,instances:bins.reduce((n,a)=>n+a.length,0),triangles:bins.reduce((n,a,i)=>n+a.length*(i===2?10:12),0)+jointGeometry.attributes.position.count/3,ownedGeometries:3,ownedMaterials:0,borrowedMaterials:names};
 return {group,diagnostics:{id:'front-court-contemporary-paving-r2',counts,areas:areas.map(a=>a.id),sourceOwner:'dag',historicalReconstruction:false},get disposed(){return disposed;},
  assertCurrent(){if(disposed||dagSource.disposed||dagSource.diagnostics?.resources?.disposed||meshes.some((m,i)=>m.material!==materials[i]))throw new Error('Court paving material source is unavailable or changed.');},
  dispose(){if(disposed){if(cleanupError)throw cleanupError;return;}disposed=true;const errors=[];for(const release of [()=>group.removeFromParent(),...meshes.map(mesh=>()=>mesh.dispose()),()=>geometry.dispose(),()=>shell.dispose(),()=>jointGeometry.dispose(),()=>group.clear()])try{release();}catch(error){errors.push(error);}if(errors.length){cleanupError=new AggregateError(errors,'Paving cleanup failed');throw cleanupError;}}
 };
}
