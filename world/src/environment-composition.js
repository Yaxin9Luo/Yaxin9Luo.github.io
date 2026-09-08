import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {beveledBlock,assignArchitecturalUVs} from './architecture.js';
import {surface,planarUV} from './landscape.js';
import {addScannedRocks,scannedRockReady,scannedRockSource} from './rock-scans.js';
import {createGroveShrub,createGardenFlower} from './grove-foliage.js';
import {attachWindShadows} from './environment-wind.js';
import {createEnvironmentSign} from './environment-signage.js';
import {bridges,locations} from './locations.js';
import {insideAuthoredGarden} from './environment-layout.js';
import {placementMatrix} from './foliage-lod.js';

const TAU=Math.PI*2;
const palettes={sage:['#90a17c','#b9c49b'],heather:['#8f9c81','#c8b6c7'],ochre:['#8a9871','#c8bd8d']};
const regionPatches=[
  {id:'castle-west',x:-31.9,z:-26,rx:2.7,rz:7.2,palette:'sage',count:6},
  {id:'castle-east',x:32.1,z:-38,rx:2.4,rz:10.4,palette:'ochre',count:7},
  {id:'courtyard-east',x:20.7,z:22,rx:2.3,rz:9.3,palette:'sage',count:6},
  {id:'courtyard-west',x:-21.1,z:48,rx:2.6,rz:5.7,palette:'heather',count:4},
  {id:'reading-bank',x:-66,z:38.7,rx:10.1,rz:2.1,palette:'heather',count:7},
  {id:'atelier-bank',x:78.6,z:69.7,rx:4.6,rz:2.4,palette:'ochre',count:4},
  {id:'wayfarer-bank',x:-59.2,z:82,rx:2.4,rz:5.3,palette:'sage',count:4},
  {id:'post-bank',x:96.7,z:-48.5,rx:2.7,rz:6.1,palette:'ochre',count:4},
];

// These open runs address the large cliff faces seen from the bridges. They
// intentionally stop before the remote banks rather than repeating a ring.
const cliffRuns=[
  {id:'observatory-front',toward:[-27,-23],points:[[-108,-48],[-98,-42],[-88,-44],[-78,-48],[-67,-53],[-57,-57],[-51,-66]]},
  {id:'research-approach',toward:[-84,-72],points:[[-75,-29],[-65,-38],[-55,-44],[-45,-51]]},
  {id:'contact-approach',toward:[80,-65],points:[[37,-60],[44,-52],[51,-42],[56,-32],[62,-23]]},
  {id:'post-front',toward:[48,-20],points:[[56,-66],[58,-58],[61,-47],[66,-36],[74,-28]]},
  {id:'east-channel',toward:[117,-4],points:[[84,-1],[91,3],[97,10],[105,21]]},
];
export function cliffScanBounds(placement){
  const source=scannedRockSource(placement.kind,placement.piece),matrix=placementMatrix(placement),corners=[];
  if(!source)return {corners,box:new THREE.Box3()};
  const box=source.geometry.boundingBox;
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
  return {corners,box:new THREE.Box3().setFromPoints(corners)};
}
function clearCliffApproach(placement,heightAt,nearPath){
  const {corners,box}=cliffScanBounds(placement);
  for(const [a,b]of Object.values(bridges)){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    const along=corners.map(p=>(p.x-a[0])*dx+(p.z-a[1])*dz),across=corners.map(p=>(p.x-a[0])*dz-(p.z-a[1])*dx);
    if(Math.min(...along)<length+3&&Math.max(...along)>-3&&Math.min(...across)<3.8&&Math.max(...across)>-3.8)return false;
  }
  for(const l of locations)if(box.max.y>l.y-.25&&box.min.x<l.x+4.6&&box.max.x>l.x-4.6&&box.min.z<l.z+l.radius+5.7&&box.max.z>l.z+l.radius+.3)return false;
  for(const x of[box.min.x,(box.min.x+box.max.x)/2,box.max.x])for(const z of[box.min.z,(box.min.z+box.max.z)/2,box.max.z]){
    if(nearPath(x,z)&&box.max.y>heightAt(x,z)-.2)return false;
  }
  return true;
}

// Ray tests use a local subset of the existing cliff triangles. Nothing is
// rendered or uploaded by this fitting mesh, and no AABB stands in for a face.
function localCliffSurface(geometry,shore,anchor){
  const indices=[],perSegment=geometry.index.count/shore.length;
  for(const [i,p]of shore.entries())if(Math.hypot(p.x-anchor.x,p.z-anchor.z)<18&&Math.abs((p.x-anchor.x)*anchor.nx+(p.z-anchor.z)*anchor.nz)<4&&p.nx*anchor.nx+p.nz*anchor.nz>.55)for(let j=0;j<perSegment;j++)indices.push(geometry.index.getX(i*perSegment+j));
  const local=new THREE.BufferGeometry();local.setAttribute('position',geometry.attributes.position);local.setIndex(indices);
  const mesh=new THREE.Mesh(local,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster(),direction=new THREE.Vector3(-anchor.nx,0,-anchor.nz);
  return {
    depthAt(point){
      const tangent=(point.x-anchor.x)*anchor.nz-(point.z-anchor.z)*anchor.nx;
      ray.set(new THREE.Vector3(anchor.x+anchor.nz*tangent+anchor.nx*30,point.y,anchor.z-anchor.nx*tangent+anchor.nz*30),direction);
      const hit=ray.intersectObject(mesh,false)[0];return hit?(hit.point.x-anchor.x)*anchor.nx+(hit.point.z-anchor.z)*anchor.nz:null;
    },
    dispose(){local.dispose();mesh.material.dispose();},
  };
}

function fitCliffBoulder(rock,anchor,host,source){
  const depth=point=>(point.x-anchor.x)*anchor.nx+(point.z-anchor.z)*anchor.nz;
  const probe=new THREE.Mesh(source.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));probe.matrixAutoUpdate=false;probe.matrix.copy(placementMatrix(rock));probe.updateMatrixWorld(true);
  const {box}=cliffScanBounds(rock),size=box.getSize(new THREE.Vector3()),ray=new THREE.Raycaster(),direction=new THREE.Vector3(-anchor.nx,0,-anchor.nz),samples=[];
  for(const u of[-.24,0,.24])for(const v of[.3,.5,.7]){
    const point=new THREE.Vector3(rock.x+anchor.nz*u*Math.max(size.x,size.z),box.min.y+v*size.y,rock.z-anchor.nx*u*Math.max(size.x,size.z)),hostDepth=host.depthAt(point);
    ray.set(point.clone().addScaledVector(direction,-30),direction);const hits=ray.intersectObject(probe,false);
    if(hostDepth!==null&&hits.length>1)samples.push({front:depth(hits[0].point)-hostDepth,back:depth(hits.at(-1).point)-hostDepth});
  }
  probe.material.dispose();if(samples.length<5)return false;
  const offsets=samples.map(p=>.65-p.front).sort((a,b)=>a-b),offset=Math.min(offsets[Math.floor(offsets.length/2)],1.45-Math.max(...samples.map(p=>p.front)));
  const frontExposure=samples.map(p=>p.front+offset),backBurial=samples.map(p=>p.back+offset);
  if(frontExposure.filter(d=>d>.08).length<samples.length*.45||backBurial.some(d=>d>-.25))return false;
  rock.x+=anchor.nx*offset;rock.z+=anchor.nz*offset;
  const matrix=placementMatrix(rock);let reach=-Infinity;const point=new THREE.Vector3(),position=source.geometry.attributes.position;
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(matrix);reach=Math.max(reach,depth(point));}
  rock.surfaceFit={frontExposure,backBurial,reach};return true;
}

function waterlineSupport(upper,lower){
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),meshes=[upper,lower].map(p=>{const mesh=new THREE.Mesh(scannedRockSource('moss',p.piece).geometry,material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(placementMatrix(p));mesh.updateMatrixWorld(true);return mesh;});
  const {box}=cliffScanBounds(upper),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),ray=new THREE.Raycaster(),contacts=[];
  for(const x of[-.2,0,.2])for(const z of[-.2,0,.2]){
    ray.set(new THREE.Vector3(center.x+x*size.x,box.max.y+1,center.z+z*size.z),new THREE.Vector3(0,-1,0));
    const a=ray.intersectObject(meshes[0],false),b=ray.intersectObject(meshes[1],false);
    if(a.length>1&&b.length>1&&a.at(-1).point.y<=b[0].point.y+.05&&a[0].point.y>b[0].point.y)contacts.push({x:ray.ray.origin.x,z:ray.ray.origin.z,upperBottom:a.at(-1).point.y,lowerTop:b[0].point.y});
  }
  material.dispose();return contacts;
}

export function createShoreCliffPlacements(shoreline,shoreField,heightAt,nearPath=()=>false,cliffGeometry=null){
  const rocks=[],anchors=[];
  if(!shoreline.length||!shoreField||!cliffGeometry||!scannedRockReady())return {rocks,anchors};
  const shore=shoreline.map(([a,b])=>{
    const x=(a.x+b.x)/2,z=(a.z+b.z)/2,dx=shoreField(x+.15,z)-shoreField(x-.15,z),dz=shoreField(x,z+.15)-shoreField(x,z-.15),length=Math.hypot(dx,dz)||1;
    return {x,z,nx:-dx/length,nz:-dz/length};
  });
  for(const [region,run]of cliffRuns.entries()){
    let ordinal=0,remainder=1.4+region*.43,regionCount=0;const quota=[6,4,4,4,6][region];
    for(let segment=0;segment<run.points.length-1;segment++){
      const a=run.points[segment],b=run.points[segment+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(;remainder<length;remainder+=8.2*[1,.84,1.16,.94][ordinal++%4]){
        const x=THREE.MathUtils.lerp(a[0],b[0],remainder/length),z=THREE.MathUtils.lerp(a[1],b[1],remainder/length);
        const candidates=shore.filter(p=>Math.hypot(p.x-x,p.z-z)<5.5&&(run.toward[0]-p.x)*p.nx+(run.toward[1]-p.z)*p.nz>0).sort((p,q)=>Math.hypot(p.x-x,p.z-z)-Math.hypot(q.x-x,q.z-z));
        const p=candidates.find(p=>!anchors.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<6.8));if(!p)continue;
        if(regionCount>=quota)continue;
        const {nx,nz}=p,tx=nz,tz=-nx,phase=ordinal*1.71+region*.93,edgeHeight=heightAt(p.x-nx*.65,p.z-nz*.65),host=localCliffSurface(cliffGeometry,shore,p);
        let waterWidth=24;for(let d=.5;d<=24;d+=.5)if(shoreField(p.x+nx*d,p.z+nz*d)>=0){waterWidth=d;break;}
        const layers=[
          {tier:'waterline-base',top:-12.6+Math.sin(phase)*.3,height:7.2+Math.cos(phase)*.6,width:10.6+Math.sin(phase+.5)*1.2},
          {tier:'waterline-crown',top:-9.5+Math.sin(phase+.5)*.3,height:7.5+Math.cos(phase)*.4,width:7.3+Math.cos(phase+.4)*.6},
        ];
        let installed=0,baseRock=null;
        for(const [level,layer]of layers.entries()){
          if(regionCount>=quota||level&&!baseRock)break;
          const slip=Math.sin(phase+level*2.1)*1.1,angle=Math.atan2(nx,nz)+Math.sin(phase+level)*.3,piece=[3,5,2,5,3,6][(ordinal+region+level)%6],source=scannedRockSource('moss',piece),size=source.geometry.boundingBox.getSize(new THREE.Vector3());
          let rock;
          for(const width of[1,.78]){
            const candidate={kind:'moss',piece,tint:'#d5e0d4',type:'cliff-refine',region:run.id,tier:layer.tier,x:p.x+tx*slip,y:layer.top-layer.height,z:p.z+tz*slip,sx:layer.width*width/size.x,sy:layer.height/size.y,sz:(5.8+level*.55)/size.z,r:angle};
            if(!fitCliffBoulder(candidate,p,host,source)||candidate.surfaceFit.reach>waterWidth*.4||!clearCliffApproach(candidate,heightAt,nearPath))continue;
            if(level){const contacts=waterlineSupport(candidate,baseRock);if(contacts.length<3)continue;candidate.support={cluster:`${run.id}/${ordinal}`,contacts};}
            rock=candidate;break;
          }
          if(!rock)continue;
          if(!level)baseRock=rock;
          rock.cluster=`${run.id}/${ordinal}`;
          const bounds=cliffScanBounds(rock);rock.bounds={min:bounds.box.min.toArray(),max:bounds.box.max.toArray()};rock.shore={x:p.x,z:p.z,nx,nz,waterWidth,reach:rock.surfaceFit.reach};rocks.push(rock);installed++;regionCount++;
        }
        host.dispose();
        if(installed)anchors.push({...p,y:edgeHeight,region:run.id,instances:installed});
      }
      remainder-=length;
    }
  }
  return {rocks,anchors};
}

function addMesh(root,geometry,material,name){const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;}
function batches(root,source,placements,name){
  placements=placements.filter(p=>!Object.values(bridges).some(([a,b])=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,along=(p.x-a[0])*dx+(p.z-a[1])*dz,across=(p.x-a[0])*dz-(p.z-a[1])*dx;return along>-3&&along<length+3&&Math.abs(across)<4.5;}));
  if(!placements.length)return;
  for(const part of source.children){
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,placements.length);mesh.name=`${name} / ${part.name}`;
    placements.forEach((p,i)=>mesh.setMatrixAt(i,placementMatrix(p)));mesh.castShadow=mesh.receiveShadow=true;attachWindShadows(mesh);mesh.computeBoundingSphere();root.add(mesh);
  }
}

function masonryRuns(root,runs,heightAt){
  const materials=[surface('mossy-rock',{color:'#a8ad99',albedoStrength:.93,roughness:1}),surface('castle-masonry',{color:'#bec2b0',albedoStrength:.75,roughness:.98})],parts=[[],[]];
  for(const [index,run] of runs.entries()){
    const [ax,az,bx,bz,top]=run,length=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/length,dz=(bz-az)/length,rotation=Math.atan2(dx,dz),count=Math.ceil(length/1.26);
    for(let i=0;i<count;i++){
      const t=(i+.5)/count,x=THREE.MathUtils.lerp(ax,bx,t),z=THREE.MathUtils.lerp(az,bz,t),ground=heightAt(x,z),bottom=Math.min(ground-.12,top-.7),height=top-bottom;
      const rows=Math.max(2,Math.ceil(height/.46));
      for(let row=0;row<rows;row++){
        const h=height/rows-.022,y=bottom+(row+.5)*height/rows,joint=(row%2?.17:-.17),variation=.025*Math.sin(i*1.7+index+row),width=.76+(rows-row)*.075;
        const geometry=beveledBlock(width,h,length/count-.025,.04).clone();
        geometry.applyMatrix4(placementMatrix({x:x+dx*joint,y:y+variation,z:z+dz*joint,r:rotation}));assignArchitecturalUVs(geometry,2.085);parts[row===rows-1?1:0].push(geometry);
      }
    }
  }
  parts.forEach((list,i)=>{if(list.length)addMesh(root,mergeGeometries(list),materials[i],i?'Weathered limestone foundation caps':'Jointed mossy masonry footings');list.forEach(g=>g.dispose());});
}

function groundPatch(root,patch,heightAt,free){
  const positions=[],colors=[],indices=[],segments=64,bands=7,palette=palettes[patch.palette],phase=patch.x*.17+patch.z*.09;
  for(let row=0;row<bands;row++)for(let i=0;i<=segments;i++){
    const a=i/segments*TAU,r=(.008+row/(bands-1)*.992)*(1+.085*Math.sin(a*3+phase)+.052*Math.cos(a*5-phase)),x=patch.x+Math.cos(a)*patch.rx*r,z=patch.z+Math.sin(a)*patch.rz*r;
    positions.push(x,heightAt(x,z)+.031,z);const c=new THREE.Color(palette[0]).lerp(new THREE.Color(palette[1]),row/(bands-1)*.42);colors.push(c.r,c.g,c.b);
    if(row<bands-1&&i<segments){const q=row*(segments+1)+i;indices.push(q,q+1,q+segments+1,q+1,q+segments+2,q+segments+1);}
  }
  const kept=[];
  for(let i=0;i<indices.length;i+=3){const face=indices.slice(i,i+3);if(face.every(v=>free(positions[v*3],positions[v*3+2])))kept.push(...face);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(kept);geometry.computeVertexNormals();planarUV(geometry,.42);
  const mesh=addMesh(root,geometry,surface('forest-ground',{vertexColors:true,color:'#e7e6cb',albedoStrength:.77,roughness:1,roughnessFloor:.9}),`${patch.id} irregular soil and moss ribbon`);mesh.castShadow=false;
}

export function createEnvironmentComposition(root,heightAt,nearPath=()=>false,{shoreline=[],shoreField=null}={}){
  const group=new THREE.Group();group.name='Authored geology, castle footings and regional banks';root.add(group);
  const free=(x,z)=>heightAt(x,z)>.35&&!insideAuthoredGarden(x,z,.16)&&!nearPath(x,z);
  const rocks=[],shrubs=[],flowers={heather:[],ochre:[],sage:[]},placements=[];
  const runs=[[-29.9,-51,-29.9,-25,9.56],[29.9,-51,29.9,-26,9.56],[-26,-14.4,-13,-14.4,9.52],[14,-14.4,26,-14.4,9.52]];
  masonryRuns(group,runs,heightAt);
  for(const [index,patch]of regionPatches.entries()){
    groundPatch(group,patch,heightAt,free);
    for(let i=0;i<patch.count;i++){
      const a=i*2.399+index*.71,r=.22+.60*Math.sqrt((i+.5)/patch.count),x=patch.x+Math.cos(a)*patch.rx*r,z=patch.z+Math.sin(a)*patch.rz*r;
      if(!free(x,z))continue;
      const y=heightAt(x,z),s=.61+(i%4)*.12,p={x,y:y-.025,z,s,r:a};shrubs.push(p);placements.push({type:'shrub',region:patch.id,...p});
      const fx=x+Math.cos(a+.8)*.63,fz=z+Math.sin(a+.8)*.63;
      if(free(fx,fz))flowers[patch.palette].push({x:fx,y:heightAt(fx,fz),z:fz,s:.92+(i%3)*.15,r:a});
      if(i%2===0){const rx=x+Math.cos(a+2)*.9,rz=z+Math.sin(a+2)*.9;if(free(rx,rz))rocks.push({kind:'moss',piece:(index+i)%7,x:rx,y:heightAt(rx,rz)-.14,z:rz,s:.64+(i%3)*.13,r:a+.42});}
    }
  }
  // Larger scans tie the castle plinth to its site; low pieces follow those
  // strata with varied rotations rather than repeated spherical outcrops.
  for(const [i,[x,z,r]]of [[-31.4,-49,-.5],[-31.0,-33,.3],[31.6,-46,2.7],[31.1,-25,1.9],[-24.5,-12.7,.7],[25.7,-13.7,2.2]].entries()){
    const h=heightAt(x,z);rocks.push({kind:'face',x,y:h-.9,z,s:.8+(i%3)*.09,r});
    rocks.push({kind:'moss',piece:i,x:x+.9,y:heightAt(x+.9,z+1)-.15,z:z+1,s:.83,r:r+1.1});
  }
  // Bridge abutments continue the existing parapet axes; the centre of each
  // bridge and all four portals remain open.
  for(const [id,ends]of Object.entries(bridges)){
    const angle=Math.atan2(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1]),side=new THREE.Vector2(Math.cos(angle),-Math.sin(angle));
    for(const [end,[x,z]]of ends.entries())for(const sign of[-1,1]){
      const px=x+side.x*5.2*sign,pz=z+side.y*5.2*sign,h=heightAt(px,pz),base=h>.5?h:5.6;
      rocks.push({kind:'moss',piece:end?3:5,tint:'#d5e0d4',x:px,y:base-4.1,z:pz,sx:2.1,sy:2.8,sz:2.1,r:angle+(sign<0?Math.PI:0)+.18*(end?1:-1)});
      const mx=x+side.x*4.85*sign,mz=z+side.y*4.85*sign;
      if(heightAt(mx,mz)>.4)rocks.push({kind:'moss',piece:end+3,x:mx,y:heightAt(mx,mz)-.18,z:mz,s:1.04,r:angle+end*.4});
      placements.push({type:'bridgehead',region:id,x:px,z:pz,y:base});
    }
  }
  // Sample the actual clipped shore rather than inferring it from a height
  // function that also contains garden grades. Each run uses unequal groups
  // and exposes the original 32-band geology between scan sections.
  const shoreAnchors=[{x:-48,z:-47},{x:44,z:-49},{x:92,z:-6},{x:61,z:84},{x:-73,z:63},{x:-102,z:-79},{x:94,z:-91}];
  const cliffRefinement=createShoreCliffPlacements(shoreline,shoreField,heightAt,nearPath,root.getObjectByName('shoreline-cliffs')?.geometry);rocks.push(...cliffRefinement.rocks);
  placements.push(...cliffRefinement.rocks);
  if(shoreline.length&&shoreField){
    const points=shoreline.map(([a,b])=>({x:(a.x+b.x)*.5,z:(a.z+b.z)*.5})),selected=[];
    for(const [region,anchor]of shoreAnchors.entries()){
      const nearby=points.filter(p=>Math.hypot(p.x-anchor.x,p.z-anchor.z)<18).sort((a,b)=>Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z));
      let used=0;
      for(const p of nearby){
        if(selected.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<4.8)||cliffRefinement.anchors.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<7.5)||used>=4)continue;
        const dx=shoreField(p.x+.15,p.z)-shoreField(p.x-.15,p.z),dz=shoreField(p.x,p.z+.15)-shoreField(p.x,p.z-.15),len=Math.hypot(dx,dz)||1,nx=-dx/len,nz=-dz/len;
        const y=heightAt(p.x-nx*.5,p.z-nz*.5),rotation=Math.atan2(nx,nz)+(region%2?.12:-.09),scale=1.18+(used%3)*.17;
        rocks.push({kind:'face',x:p.x+nx*.30,y:y-2.7*scale,z:p.z+nz*.30,s:scale,r:rotation});
        if(used%2===0)rocks.push({kind:'face',x:p.x+nx*.72+nx*.3,y:y-5.8*scale,z:p.z+nz*.72,s:scale*1.15,r:rotation+.31});
        const bx=p.x-nx*1.1,bz=p.z-nz*1.1;
        if(free(bx,bz)){rocks.push({kind:'moss',piece:(region+used)%7,x:bx,y:heightAt(bx,bz)-.16,z:bz,s:.76+used*.07,r:rotation+.6});if(used%2===0)shrubs.push({x:bx-nx*.8,y:heightAt(bx-nx*.8,bz-nz*.8)-.03,z:bz-nz*.8,s:.68,r:rotation});}
        selected.push(p);placements.push({type:'shore-strata',region,x:p.x,y,z:p.z,normal:[nx,nz]});used++;
      }
    }
  }
  const scans=addScannedRocks(group,rocks,'Scanned geological strata and mossy footings');
  batches(group,createGroveShrub('silver',24),shrubs,'Sage understory along irregular banks');
  for(const [palette,items]of Object.entries(flowers)){
    const specimen=createGardenFlower(palette==='heather'?'lilac':'cherry',17);
    if(palette!=='heather'){
      const attribute=specimen.leavesMesh.geometry.attributes.color;
      // Leaves remain green; only petal pixels with a red-heavy pigment move
      // toward the chosen muted ivory or warm ochre family.
      for(let i=0;i<attribute.count;i++)if(attribute.getX(i)>attribute.getY(i)*1.15){const c=new THREE.Color(palette==='ochre'?'#d2bc8b':'#d5d7bc');attribute.setXYZ(i,c.r,c.g,c.b);}
    }
    batches(group,specimen,items,`${palette} botanical flower grouping`);
  }
  const signs=[],stone=surface('castle-masonry',{color:'#b8c0b0',roughness:1});
  const signSites=[['about',-6.8,1.2,.18],['publications',-75.7,24.8,.18],['projects',74.5,52.1,-.27],['journey',-51.5,91.3,.12],['research',-89.8,-54.1,.30],['contact',87.1,-43.1,-.30]];
  for(const [id,x,z,r]of signSites){const sign=createEnvironmentSign(id,stone),y=heightAt(x,z);sign.position.set(x,y,z);sign.rotation.y=r;group.add(sign);signs.push(sign);}
  group.userData={scanReady:scannedRockReady(),rockCount:rocks.length,scanCount:scans.userData.instanceCount,cliffRefinement:{anchors:cliffRefinement.anchors,instances:cliffRefinement.rocks.length},shrubs:shrubs.length,flowers:Object.values(flowers).reduce((s,p)=>s+p.length,0),patches:regionPatches.length,placements,signs:signs.map(o=>({id:o.userData.label.id,position:o.position.toArray()}))};
  return {group,signs,stats:group.userData};
}

/** A small production assembly using the same PBR, fieldstone joints, scan
 * sources and plant geometry as the castle banks; intended for studio QA. */
export function createFootingSpecimen(){
  const root=new THREE.Group();root.name='Castle footing production sample';
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,10,30,24),surface('forest-ground',{color:'#afbc99',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;root.add(ground);
  masonryRuns(root,[[-4,-2,4,-2,1.25]],()=>0);
  addScannedRocks(root,[{kind:'face',x:-3.4,y:-.13,z:-2.2,s:.85,r:-.3},{kind:'face',x:3.4,y:-.18,z:-2.5,s:.78,r:2.8},{kind:'moss',piece:0,x:-2,y:-.08,z:.8,s:1.1,r:.8},{kind:'moss',piece:4,x:3,y:-.12,z:.9,s:.85,r:1.4},{kind:'moss',piece:2,x:2.2,y:-.05,z:1.7,s:.33,r:.4},{kind:'moss',piece:6,x:-3.3,y:-.07,z:1.4,s:.34,r:1.4}]);
  batches(root,createGroveShrub('silver',24),[{x:-3.2,y:0,z:.1,s:.87,r:.3},{x:2.4,y:0,z:-.3,s:.69,r:1.5}],'Footing sage');
  batches(root,createGardenFlower('lilac',17),[{x:-2.8,y:0,z:1.3,s:1.15,r:.3},{x:3.7,y:0,z:1.1,s:1,r:1.3}],'Footing heather');
  root.userData.assetReady=scannedRockReady();return root;
}
