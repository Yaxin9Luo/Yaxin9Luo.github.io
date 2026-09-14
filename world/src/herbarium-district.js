import * as THREE from 'three';
import {createArcade,createConservatory,createWaterGarden,createGardenBorder,createHerbariumBotanicalSpecimen,cloneHerbariumAsset,disposeHerbariumAsset,getHerbariumColliders,getHerbariumSupportGeometries,getHerbariumLighting} from './herbarium-assets.js';
import {herbariumSites,herbariumPaths,herbariumBorders,herbariumPlantingDrifts,herbariumCourtBeds,herbariumRegionalCommunities,herbariumLowGardenBeds,herbariumSiteDistance,nearestHerbariumPath,registerHerbariumCommunityFootprints} from './herbarium-layout.js';
import {createHerbariumCommunity,disposeCommunityAsset} from './herbarium-community.js';
import {insideAuthoredGarden,blossomParks} from './environment-layout.js';
import {createSurfaceSupport} from './surface-support.js';
import {surface,planarUV,groundMaterial} from './landscape.js';

const plantProfiles=new WeakMap();
function convexFootprint(points){
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lower=[],upper=[];
  for(const point of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),point)<=0)lower.pop();lower.push(point);}
  for(let i=points.length-1;i>=0;i--){const point=points[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),point)<=0)upper.pop();upper.push(point);}
  lower.pop();upper.pop();return lower.concat(upper);
}
// Cache each unchanged source mesh in plant-local coordinates. The lowest
// source vertex in each small X/Z cell records terrain contact below fronds.
// Basal samples determine root support; the complete projected hull determines
// the soil mask. A lower alpha-card vertex alone is not visible-leaf evidence.
// Neither operation edits, reduces or substitutes the rendered source mesh.
function plantGroundProfile(asset){
  asset.updateWorldMatrix(true,true);const inverse=asset.matrixWorld.clone().invert(),points=[],samples=[];
  asset.traverse(mesh=>{
    if(!mesh.isMesh)return;const local=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),key=local.elements.map(v=>v.toFixed(6)).join(','),cached=plantProfiles.get(mesh.geometry)||new Map();let profile=cached.get(key);
    if(!profile){
      const projected=[],lowest=new Map(),p=new THREE.Vector3(),position=mesh.geometry.attributes.position;
      for(let i=0;i<position.count;i++){
        p.fromBufferAttribute(position,i).applyMatrix4(local);projected.push([p.x,p.z]);const cell=`${Math.floor(p.x/.10)},${Math.floor(p.z/.10)}`,previous=lowest.get(cell);
        if(!previous||p.y<previous[1])lowest.set(cell,[p.x,p.y,p.z]);
      }
      profile={loop:convexFootprint(projected),samples:[...lowest.values()]};cached.set(key,profile);plantProfiles.set(mesh.geometry,cached);
    }
    points.push(...profile.loop);samples.push(...profile.samples);
  });
  return {loop:convexFootprint(points),samples};
}
export function herbariumPlantGroundSupport(asset,heightAt){
  const profile=plantGroundProfile(asset),point=new THREE.Vector3();let penetration=0,basalPenetration=0;
  for(const sample of profile.samples){point.fromArray(sample).applyMatrix4(asset.matrixWorld);penetration=Math.max(penetration,heightAt(point.x,point.z)-point.y);}
  const lowest=Math.min(...profile.samples.map(p=>p[1])),nearRoot=profile.samples.filter(p=>p[1]<lowest+.05&&Math.hypot(p[0],p[2])<.18),basal=nearRoot.length?nearRoot:profile.samples.filter(p=>p[1]<lowest+.05);
  for(const sample of basal){point.fromArray(sample).applyMatrix4(asset.matrixWorld);basalPenetration=Math.max(basalPenetration,heightAt(point.x,point.z)-point.y);}
  if(basalPenetration>.10)return {valid:false,reason:'source basal envelope enters rising terrain',penetration,basalPenetration};
  const loop=profile.loop.map(([x,z])=>{point.set(x,0,z).applyMatrix4(asset.matrixWorld);return [point.x,point.z];});
  const woody=asset.userData.botanicalSource?.id==='didelta_spinosa'||asset.children.some(mesh=>mesh.userData.sourceAsset==='didelta_spinosa');
  return {valid:true,penetration,basalPenetration,basalSamples:basal.length,footprint:{loop,strength:woody?1:.82}};
}

function collisionBox(box,id){
  const [x,y,z]=box.min,[X,Y,Z]=box.max;
  return {id,name:box.name,buildingId:'herbarium',bottom:y,top:Y,planes:[[1,0,0,X],[-1,0,0,-x],[0,0,1,Z],[0,0,-1,-z],[0,1,0,Y],[0,-1,0,-y]]};
}
// Recover the perimeter from the delivered top triangles, including the pond's
// asymmetric soil ribbons. No nominal rectangle substitutes for source contact.
function topSurface(mesh,part,y){
  const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,points=new Map(),edges=new Map(),triangles=[],key=p=>`${p.x.toFixed(5)},${p.z.toFixed(5)}`;
  for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i+=3){
    const triangle=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
    if(triangle.some(p=>Math.abs(p.y-y)>.001)||new THREE.Triangle(...triangle).getNormal(new THREE.Vector3()).y<.99)continue;
    triangles.push(triangle);
    for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],ka=key(a),kb=key(b),id=[ka,kb].sort().join('/');points.set(ka,a);points.set(kb,b);const edge=edges.get(id);if(edge)edge.count++;else edges.set(id,{a:ka,b:kb,count:1});}
  }
  const boundary=new Map([...edges.values()].filter(e=>e.count===1).map(e=>[e.a,e.b])),loops=[];
  while(boundary.size){const start=boundary.keys().next().value,loop=[];let next=start;
    do{loop.push(points.get(next));const end=boundary.get(next);boundary.delete(next);next=end;}while(next&&next!==start);
    if(loop.length>2){for(let i=0;i<loop.length;i++){const p=loop[(i+loop.length-1)%loop.length],q=loop[i],r=loop[(i+1)%loop.length],a=new THREE.Vector3(-(q.z-p.z),0,q.x-p.x).normalize(),b=new THREE.Vector3(-(r.z-q.z),0,r.x-q.x).normalize();q.out=a.add(b).normalize();}loops.push(loop);}
  }
  return {triangles,loops};
}
function polygonDistance(x,z,loop){
  let inside=false,distance=Infinity;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[j],b=loop[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside?-distance:distance;
}
// Shore edging and bench feet are real solids even where they do not have a
// gameplay collider. Keep their triangles for full-crown placement checks.
function plantingObstacles(asset){
  asset.updateWorldMatrix(true,true);const result=[],keys=new Set(['stone','trim','iron','floor','wood','mortar','brass']);
  for(const mesh of asset.children){
    if(!mesh.isMesh||!keys.has(mesh.name.split(':')[0]))continue;
    const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(const part of mesh.userData.parts||[]){
      if(['plant','ground','water','glass','basin'].includes(part.role))continue;
      const triangles=[];for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i+=3)triangles.push(new THREE.Triangle(...[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,index.getX(i+k)).applyMatrix4(mesh.matrixWorld))));
      result.push({bounds:new THREE.Box3(new THREE.Vector3(...part.bounds.min),new THREE.Vector3(...part.bounds.max)).applyMatrix4(mesh.matrixWorld),triangles});
    }
  }return result;
}
function* soilShoulders(instance,heightAt){
  instance.updateWorldMatrix(true,true);let basin=null;
  if(instance.userData.site==='water-garden')for(const mesh of instance.children)for(const part of mesh.userData.parts||[])if(part.name==='Visible shallow stone basin floor')basin=topSurface(mesh,part,instance.position.y-.30).loops[0];
  for(const mesh of instance.children)for(const part of mesh.userData.parts||[])if(part.name==='Continuous irregular planted loam'){
    const court=instance.userData.site.startsWith('forecourt-'),top=topSurface(mesh,part,instance.position.y),pilot=instance.userData.site==='water-garden'&&top.loops[0].reduce((sum,p)=>sum+p.z,0)/top.loops[0].length>instance.position.z,positions=[],indices=[],soilWeights=[],vertices=new Map();
    const vertex=(p,soil=1)=>{const key=p.map(v=>v.toFixed(5)).join(',');if(vertices.has(key))return vertices.get(key);const i=positions.length/3;positions.push(...p);soilWeights.push(soil);vertices.set(key,i);return i;};
    for(const triangle of top.triangles)indices.push(...triangle.map(p=>vertex([p.x,p.y-.014,p.z])));
    for(const loop of top.loops){
      const rings=loop.map(p=>{
        const outward=basin&&polygonDistance(p.x+p.out.x*.2,p.z+p.out.z*.2,basin)>polygonDistance(p.x,p.z,basin);
        let width=court?1.26+Math.sin(p.x*.79+p.z*.43)*.20:pilot&&outward?1.48+Math.sin(p.x*.79+p.z*.43)*.15:.64+Math.sin(p.x*.79+p.z*.43)*.12;
        if(court){
          const clear=t=>{const x=p.x+p.out.x*t,z=p.z+p.out.z*t,path=nearestHerbariumPath(x,z);return path.distance>path.path.width/2+.035&&!herbariumSites.some(s=>s.kind==='arcade'&&Math.abs(x-s.x)<s.width/2+.03&&Math.abs(z-s.z)<s.depth/2+.03);};
          if(!clear(width)){let low=0,high=width;for(let k=0;k<16;k++){const mid=(low+high)/2;if(clear(mid))low=mid;else high=mid;}width=low;}
        }
        // Keep added earth outside the actual basin lining. The narrow inward
        // shoulder ends underneath its coping, never across the visible water.
        if(basin&&polygonDistance(p.x+p.out.x*width,p.z+p.out.z*width,basin)<.12){let low=0,high=width;for(let k=0;k<16;k++){const mid=(low+high)/2;if(polygonDistance(p.x+p.out.x*mid,p.z+p.out.z*mid,basin)<.12)high=mid;else low=mid;}width=low;}
        const endX=p.x+p.out.x*width,endZ=p.z+p.out.z*width,endY=heightAt(endX,endZ)+.005;
        return Array.from({length:5},(_,i)=>{const t=i/4,x=p.x+p.out.x*width*t,z=p.z+p.out.z*width*t,ease=t*t*(3-2*t);return vertex([x,(p.y-.014)*(1-ease)+endY*ease,z],1-ease);});
      });
      for(let i=0;i<loop.length;i++)for(let j=0;j<4;j++){const a=rings[i][j],b=rings[(i+1)%loop.length][j],c=rings[i][j+1],d=rings[(i+1)%loop.length][j+1];indices.push(a,c,b,b,c,d);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();planarUV(geometry,.5);
    if(pilot||court)geometry.setAttribute('soilInterior',new THREE.Float32BufferAttribute(soilWeights,1));
    yield {geometry,loop:top.loops[0],pilot,court,basin};
  }
}
// Finish the exposed east bank after plant admission. Original soil, basin,
// sitting shores and every plant keep their authored geometry and transforms.
function waterGardenSiteApron(instance,heightAt){
  instance.updateWorldMatrix(true,true);const floor=instance.position.y,soil=[],shores=[],protectedTops=[];let basin;
  for(const mesh of instance.children)for(const part of mesh.userData.parts||[]){
    if(part.name==='Visible shallow stone basin floor')basin=topSurface(mesh,part,floor-.30).loops[0];
    if(['Continuous irregular planted loam','Supported rounded sitting shore'].includes(part.name)){
      const top=topSurface(mesh,part,floor);(part.name==='Continuous irregular planted loam'?soil:shores).push(...top.loops);
      for(const points of top.triangles)protectedTops.push({points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});
    }
  }
  if(!basin||!soil.length||!shores.length)throw new Error('Pond site finish requires the delivered basin, planted soil and sitting shores.');
  const inverse=instance.matrixWorld.clone().invert().elements,step=.12,smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  const sample=(x,z)=>{
    const localX=inverse[0]*x+inverse[4]*floor+inverse[8]*z+inverse[12],d=polygonDistance(x,z,basin);
    const soilDistance=Math.min(...soil.map(loop=>polygonDistance(x,z,loop))),shoreDistance=Math.min(...shores.map(loop=>polygonDistance(x,z,loop)));
    return {x,z,localX,d,soilDistance,shoreDistance,field:Math.min(localX-2,d-.12,2-d,soilDistance,shoreDistance)};
  };
  const positions=[],indices=[],soilWeights=[],vertices=new Map();
  const vertex=p=>{
    const key=`${p.x.toFixed(6)},${p.z.toFixed(6)}`;if(vertices.has(key))return vertices.get(key);
    const radial=1-smooth(.35,1.65,p.d),edge=1-smooth(0,.45,Math.min(p.soilDistance,p.shoreDistance)),weight=smooth(2,3,p.localX)*(1-smooth(1.65,2,p.d))*Math.max(radial,edge),ground=heightAt(p.x,p.z),toe=ground-.05,i=positions.length/3;
    // Bury the fading toe in the existing ground; independently triangulated
    // old shoulders otherwise leave up to 3 cm visible at an edge midpoint.
    positions.push(p.x,toe+(Math.max(ground,floor)-toe)*weight,p.z);soilWeights.push(weight*Math.max(radial*.75,1-smooth(0,.45,p.soilDistance)));vertices.set(key,i);return i;
  };
  const crossing=(a,b)=>{
    let inside=a.field>=0?a:b,outside=a.field>=0?b:a;
    for(let i=0;i<22;i++){const p=sample((inside.x+outside.x)/2,(inside.z+outside.z)/2);if(p.field>=0)inside=p;else outside=p;}
    return inside;
  };
  // A grid triangle can bridge a concave hole corner even when all its
  // vertices are outside. Subtract the actual protected top triangles.
  const cutTop=(polygon,top)=>{
    let remaining=polygon;const outside=[];
    for(let i=0;i<3&&remaining.length;i++){
      const a=top.points[i],b=top.points[(i+1)%3],dx=b.x-a.x,dz=b.z-a.z;
      // A 10 micrometre outward guard covers float32 rounding at world scale.
      const distance=p=>-dx*(p.z-a.z)+dz*(p.x-a.x)+1e-5*Math.hypot(dx,dz),inner=[],outer=[];
      for(let j=0;j<remaining.length;j++){
        const p=remaining[(j+remaining.length-1)%remaining.length],q=remaining[j],dp=distance(p),dq=distance(q);
        if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq),v=sample(p.x+(q.x-p.x)*t,p.z+(q.z-p.z)*t);inner.push(v);outer.push(v);}
        (dq>=0?inner:outer).push(q);
      }
      if(outer.length>2)outside.push(outer);remaining=inner;
    }
    return outside;
  };
  const triangle=points=>{
    const clipped=[];
    for(let i=0;i<3;i++){const a=points[(i+2)%3],b=points[i];if((a.field>=0)!==(b.field>=0))clipped.push(crossing(a,b));if(b.field>=0)clipped.push(b);}
    if(clipped.length<3)return;
    const minX=Math.min(...clipped.map(p=>p.x)),maxX=Math.max(...clipped.map(p=>p.x)),minZ=Math.min(...clipped.map(p=>p.z)),maxZ=Math.max(...clipped.map(p=>p.z));let pieces=[clipped];
    for(const top of protectedTops){if(top.maxX<minX-1e-5||top.minX>maxX+1e-5||top.maxZ<minZ-1e-5||top.minZ>maxZ+1e-5)continue;pieces=pieces.flatMap(p=>cutTop(p,top));if(!pieces.length)break;}
    for(const piece of pieces)for(let i=1;i<piece.length-1;i++){
      const [a,b,c]=[piece[0],piece[i],piece[i+1]];if(Math.abs((b.x-a.x)*(c.z-a.z)-(c.x-a.x)*(b.z-a.z))<1e-10)continue;
      const ids=[vertex(a),vertex(b),vertex(c)],p=ids.map(id=>positions.slice(id*3,id*3+3).map(Math.fround));
      if(Math.abs((p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[2][0]-p[0][0])*(p[1][2]-p[0][2]))>1e-10)indices.push(...ids);
    }
  };
  const minX=Math.floor((Math.min(...basin.map(p=>p.x))-2)/step),maxX=Math.ceil((Math.max(...basin.map(p=>p.x))+2)/step),minZ=Math.floor((Math.min(...basin.map(p=>p.z))-2)/step),maxZ=Math.ceil((Math.max(...basin.map(p=>p.z))+2)/step),grid=new Map();
  const at=(x,z)=>{const key=`${x},${z}`;if(!grid.has(key))grid.set(key,sample(x*step,z*step));return grid.get(key);};
  for(let x=minX;x<maxX;x++)for(let z=minZ;z<maxZ;z++){const a=at(x,z),b=at(x,z+1),c=at(x+1,z),d=at(x+1,z+1);triangle([a,b,c]);triangle([c,b,d]);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('soilInterior',new THREE.Float32BufferAttribute(soilWeights,1));geometry.setIndex(indices);geometry.computeVertexNormals();planarUV(geometry,.5);
  geometry.userData.siteFinish={source:'Delivered basin, soil and sitting-shore top triangles',terrainStep:step,basinClearance:.12,outerDistance:2,eastLocalX:2,toeEmbed:.05,finishedFloor:floor};return geometry;
}
// The original court owns these raised loam surfaces and specimens. Read its
// delivered triangles after assembly; never replace its paving or garden art.
function courtyardUnderplanting(courtyard){
  const court=courtyard.getObjectByName('Grand Academy fountain courtyard')||courtyard;court.updateWorldMatrix(true,true);
  const soil=court.children.find(m=>m.material?.name==='Cultivated garden earth');
  if(!soil)throw new Error('Courtyard loam geometry unavailable');
  const p=soil.geometry.attributes.position,index=soil.geometry.index,count=index?.count||p.count,levels=new Set();
  for(let i=0;i<count;i+=3){const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(soil.matrixWorld));if(new THREE.Triangle(...points).getNormal(new THREE.Vector3()).y>.99)levels.add(points[0].y.toFixed(5));}
  const surfaces=[...levels].flatMap(y=>topSurface(soil,{firstIndex:0,indexCount:count},Number(y)).loops.map(loop=>({loop,y:Number(y)})));
  const beds=herbariumCourtBeds.map(site=>{
    const centre=new THREE.Vector3(site.x,0,site.z).applyMatrix4(court.matrixWorld),surface=surfaces.find(s=>polygonDistance(centre.x,centre.z,s.loop)<0);
    if(!surface)throw new Error(`Courtyard loam missing for ${site.id}`);
    const bounds=new THREE.Box3().setFromPoints(surface.loop);return {...site,...surface,bounds,centre};
  });
  // Existing named tree volumes protect the solid trunks. The merged botanical
  // bark batches also contain tiny shrub/flower shoots; those and foliage can
  // interleave naturally instead of excluding an entire underplanting crown.
  const trunks=(court.userData.colliders||[]).filter(s=>s.name==='ornamental tree trunk').map(s=>{
    const box=new THREE.Box3(new THREE.Vector3(-Infinity,s.bottom,-Infinity),new THREE.Vector3(Infinity,s.top,Infinity));
    for(const [x,y,z,d]of s.planes){if(x>.9999)box.max.x=d;else if(x<-.9999)box.min.x=-d;if(z>.9999)box.max.z=d;else if(z<-.9999)box.min.z=-d;}
    return box.applyMatrix4(court.matrixWorld).expandByScalar(.06);
  });
  // Actual non-botanical stone/furniture triangles retain their own clearance.
  const cells=new Map(),cellSize=1.5,regions=beds.map(b=>new THREE.Box3(new THREE.Vector3(b.bounds.min.x,b.y,b.bounds.min.z),new THREE.Vector3(b.bounds.max.x,b.y+1.5,b.bounds.max.z)));
  const keys=box=>{const result=[];for(let x=Math.floor(box.min.x/cellSize);x<=Math.floor(box.max.x/cellSize);x++)for(let z=Math.floor(box.min.z/cellSize);z<=Math.floor(box.max.z/cellSize);z++)result.push(`${x},${z}`);return result;};
  court.traverse(mesh=>{
    if(!mesh.isMesh||mesh===soil||/foliage|petal|leaf|flower|bark|twig/i.test(mesh.name))return;mesh.geometry.computeBoundingBox();if(!regions.some(r=>r.intersectsBox(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld))))return;
    const positions=mesh.geometry.attributes.position,indices=mesh.geometry.index;
    for(let i=0;i<(indices?.count||positions.count);i+=3){
      const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(positions,indices?indices.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld)),bounds=new THREE.Box3().setFromPoints(points);
      if(!regions.some(r=>r.intersectsBox(bounds)))continue;const triangle=new THREE.Triangle(...points);
      for(const key of keys(bounds)){const bucket=cells.get(key)||[];bucket.push(triangle);cells.set(key,bucket);}
    }
  });
  const templates=new Map(),plants=[];
  try{
    let seed=21001;
    for(const bed of beds){
      for(let z=bed.bounds.min.z+.38;z<bed.bounds.max.z-.3;z+=.34)for(let x=bed.bounds.min.x+.35;x<bed.bounds.max.x-.3;x+=.34){
        const n=seed++,px=x+Math.sin(n*2.11)*.14,pz=z+Math.cos(n*1.73)*.13,u=(pz-bed.centre.z)/(bed.bounds.max.z-bed.bounds.min.z),flower=u>.12+.13*Math.sin((px-bed.centre.x)*1.1+bed.phase);
        const bridge=!flower&&(polygonDistance(px,pz,bed.loop)>-1.3||trunks.some(t=>Math.hypot(Math.max(t.min.x-px,0,px-t.max.x),Math.max(t.min.z-pz,0,pz-t.max.z))<1.7));
        const row=Math.round((z-bed.bounds.min.z-.38)/.34),column=Math.round((x-bed.bounds.min.x-.35)/.34);if(!flower&&!bridge&&(row%2||column%2))continue;
        const kind=flower?'periwinkle_plant':'fern_02',variant=!flower&&(bridge||n%6===0)?2:0,scale=flower?2.05+(n%4)*.22:bridge?2.0+(n%4)*.18:variant===2?2.75+(n%4)*.20:2.0+(n%5)*.15;
        // A small irregular soil opening breaks each mass without turning it
        // into a repeating hedge or covering the entire formal bed rectangle.
        if(!flower&&!bridge&&Math.sin(px*1.8+pz*.77+bed.phase)>.94)continue;
        if(trunks.some(t=>px>t.min.x-.12&&px<t.max.x+.12&&pz>t.min.z-.12&&pz<t.max.z+.12))continue;
        const key=`${kind}/${variant}`;if(!templates.has(key))templates.set(key,createHerbariumBotanicalSpecimen(kind,{variant}));
        const asset=cloneHerbariumAsset(templates.get(key));asset.position.set(px,bed.y+.001,pz);asset.scale.setScalar(scale);asset.rotation.y=n*2.399;asset.updateWorldMatrix(true,true);
        const box=new THREE.Box3().setFromObject(asset),corners=[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]];
        const insideBox=corners.every(([cx,cz])=>polygonDistance(cx,cz,bed.loop)<-.14),clearance=box.clone().expandByScalar(.025),nearby=new Set(keys(clearance).flatMap(key=>cells.get(key)||[]));
        const nearbyTrunks=trunks.filter(trunk=>clearance.intersectsBox(trunk));let blocked=[...nearby].some(triangle=>clearance.intersectsTriangle(triangle));
        // A fern's empty bounding-box corners are not foliage. The box is a
        // broad phase; actual source vertices define its soil footprint, and
        // actual frond triangles must clear the protected solid trunk volume.
        if(!blocked&&(!insideBox||nearbyTrunks.length))asset.traverse(mesh=>{
          if(blocked||!mesh.isMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index,points=[],triangle=new THREE.Triangle();
          for(let i=0;i<p.count;i++){
            const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);points.push(v);
            if(!insideBox&&polygonDistance(v.x,v.z,bed.loop)>=-.14){blocked=true;return;}
          }
          for(let i=0;i<(index?.count||p.count)&&!blocked;i+=3){
            triangle.set(points[index?index.getX(i):i],points[index?index.getX(i+1):i+1],points[index?index.getX(i+2):i+2]);
            if(nearbyTrunks.some(trunk=>trunk.intersectsTriangle(triangle)))blocked=true;
          }
        });
        if(blocked){disposeHerbariumAsset(asset);continue;}
        asset.userData.site='court-underplanting';asset.userData.soilBed=bed.id;asset.userData.rootedAt=asset.position.toArray();plants.push(asset);
      }
    }
    return plants;
  }catch(error){for(const plant of plants)disposeHerbariumAsset(plant);throw error;}
  finally{for(const template of templates.values())disposeHerbariumAsset(template);}
}
/** Requires awaited loadHerbariumAssets. Every returned support copy belongs to
 * the consumer; ingest it into createSurfaceSupport and then dispose the copy. */
export function createHerbariumDistrict(root,{heightAt,nearPath=()=>false}){
  const group=new THREE.Group();group.name='Living v8 connected herbarium';root.add(group);
  const instances=[],plantings=[],colliders=[],supportSurfaces=[],recipes=new Map(),owned=[],communities=[];
  let disposed=false,courtPlanted=false,releaseCommunitySoil;
  const add=(asset,site)=>{
    asset.position.set(site.x,site.floor,site.z);asset.rotation.y=site.rotation||0;asset.userData.site=site.id;group.add(asset);instances.push(asset);
    // The four globes share an instance-owned material. Keep their real point
    // lights unchanged while reducing the site's visible opal bloom source.
    if(site.kind==='conservatory')asset.traverse(mesh=>{
      const material=mesh.material;
      if(mesh.name==='lampOpal'&&material?.userData.herbariumOwnedMaterial&&material.userData.herbariumNightEmission){material.emissiveIntensity=1.15;material.userData.authoredEmissiveIntensity=1.15;}
    });
    colliders.push(...getHerbariumColliders(asset).map((box,i)=>collisionBox(box,`herbarium/${site.id}/${i}`)));
    supportSurfaces.push(...getHerbariumSupportGeometries(asset));
  };
  const recipe=(key,make)=>{const previous=recipes.get(key);if(previous)return cloneHerbariumAsset(previous);const first=make();recipes.set(key,first);return first;};
  function walk(name,positions,indices){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();planarUV(geometry,.5);
    const material=surface('courtyard-paving',{color:'#deded0',albedoStrength:1,roughness:.94,normalScale:new THREE.Vector2(.45,.45)}),mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;mesh.userData.support=true;group.add(mesh);owned.push(mesh);supportSurfaces.push(geometry.clone());
  }
  try{
    for(const site of herbariumSites)add(recipe(site.kind==='arcade'?site.id:site.kind,()=>site.kind==='arcade'?createArcade({vine:site.id==='west-arcade'?'outer-left':'outer-right'}):site.kind==='conservatory'?createConservatory():createWaterGarden()),site);
    for(const site of herbariumBorders)add(recipe(`border-${site.length}`,()=>createGardenBorder({length:site.length,seed:81})),site);
    for(const path of herbariumPaths){
      const positions=[],indices=[];
      for(let segment=1;segment<path.points.length;segment++){
        const [ax,az]=path.points[segment-1],[bx,bz]=path.points[segment],length=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/length,dz=(bz-az)/length,steps=Math.ceil(length/.20),across=Math.ceil(path.width/.20),start=positions.length/3;
        for(let i=0;i<=steps;i++)for(let j=0;j<=across;j++){
          const offset=(j/across-.5)*path.width,x=ax+(bx-ax)*i/steps+dz*offset,z=az+(bz-az)*i/steps-dx*offset;positions.push(x,heightAt(x,z)+.065,z);
          if(i<steps&&j<across){const a=start+i*(across+1)+j,b=a+across+1;indices.push(a,b,a+1,a+1,b,b+1);}
        }
      }
      walk(`herbarium-path-${path.id}`,positions,indices);
    }
    // The original human-scale porch follows the actual house transform.
    const houseSite=herbariumSites.find(s=>s.kind==='conservatory'),house=instances.find(g=>g.userData.site===houseSite.id),positions=[],indices=[],nx=22,nz=8;
    house.updateMatrixWorld(true);
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const point=new THREE.Vector3(-2.2+4.4*i/nx,0,4.5+1.5*j/nz).applyMatrix4(house.matrixWorld);positions.push(point.x,Math.max(heightAt(point.x,point.z)+.065,houseSite.floor-.055*j/nz),point.z);
      if(i<nx&&j<nz){const a=j*(nx+1)+i,b=a+nx+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
    walk('herbarium-conservatory-east-porch',positions,indices);
    // Fine local earthwork follows actual delivered loam triangles. This fills
    // the shallow soil block above the basin excavation without raising water.
    let pondEdge;const courtEdges=[];
    for(const instance of instances)for(const {geometry,loop,pilot,court,basin} of soilShoulders(instance,heightAt)){
      if(pilot)pondEdge={loop,basin};if(court)courtEdges.push({loop,site:instance.userData.site});
      const mesh=new THREE.Mesh(geometry,groundMaterial({transition:pilot||court}));mesh.name=`herbarium-soil-shoulder/${instance.userData.site}`;mesh.receiveShadow=true;mesh.userData.support=true;group.add(mesh);owned.push(mesh);supportSurfaces.push(geometry.clone());
    }
    const conservatory=instances.find(g=>g.userData.site==='conservatory'),water=instances.find(g=>g.userData.site==='water-garden');
    const slab=new THREE.Box3(),localSlab=new THREE.Box3();for(const m of conservatory.children)if(m.userData.support){slab.union(new THREE.Box3().setFromObject(m));m.geometry.computeBoundingBox();localSlab.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix));}
    // Local -X is now the world south end after the accepted +pi/2 turn.
    // The earth ribbon meets that real floor edge without covering the paving.
    const westEdge=localSlab.min.x-.008,zStart=localSlab.min.z+.65,zEnd=localSlab.max.z-.9,earthPositions=[],earthIndices=[],soilWeights=[],rows=40,columns=8;
    for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
      const u=i/rows,t=j/columns,z=zStart+(zEnd-zStart)*u,width=(1.5+.16*Math.sin(u*Math.PI*2))*(.45+.55*Math.sin(Math.PI*u)**.45),x=westEdge-width*t,ease=t*t*(3-2*t);
      const point=new THREE.Vector3(x,localSlab.max.y-.014,z).applyMatrix4(conservatory.matrixWorld);earthPositions.push(point.x,point.y*(1-ease)+(heightAt(point.x,point.z)+.005)*ease,point.z);soilWeights.push((1-ease)*Math.sin(Math.PI*u)**.35);
      if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;earthIndices.push(a,a+1,b,b,a+1,b+1);}
    }
    const earth=new THREE.BufferGeometry();earth.setAttribute('position',new THREE.Float32BufferAttribute(earthPositions,3));earth.setAttribute('soilInterior',new THREE.Float32BufferAttribute(soilWeights,1));earth.setIndex(earthIndices);earth.computeVertexNormals();planarUV(earth,.5);
    const shoulder=new THREE.Mesh(earth,groundMaterial({transition:true}));shoulder.name='herbarium-soil-shoulder/conservatory-south';shoulder.receiveShadow=true;shoulder.userData.support=true;group.add(shoulder);owned.push(shoulder);supportSurfaces.push(earth.clone());
    const waterBasin=pondEdge.basin,waterFloors=[];for(const mesh of water.children)for(const part of mesh.userData.parts||[])if(part.name==='Supported rounded sitting shore')waterFloors.push(...topSurface(mesh,part,water.position.y).loops);
    const waterSolids=getHerbariumColliders(water).filter(b=>b.name!=='Continuous watertight recessed basin lining'),waterObstacles=plantingObstacles(water),waterEnvelope=new THREE.Box3().setFromObject(water).expandByScalar(.4),conservatorySolids=getHerbariumColliders(conservatory);
    // Across the approach break, the planting follows the pavement's outside
    // edge toward the existing court corner; the wide central axis stays clear.
    for(const side of [-1,1]){
      const p=[],idx=[],soil=[],steps=28,across=6;
      for(let i=0;i<=steps;i++)for(let j=0;j<=across;j++){
        const u=i/steps,t=j/across,x=side*(19.0+4.5*u),z=9.64+.20*u+1.32*Math.sin(Math.PI*u)**.45*t;
        p.push(x,heightAt(x,z)+.01,z);soil.push((1-t*t*(3-2*t))*Math.sin(Math.PI*u)**.3);
        if(i<steps&&j<across){const a=i*(across+1)+j,b=a+across+1;idx.push(...(side===1?[a,b,a+1,a+1,b,b+1]:[a,a+1,b,a+1,b+1,b]));}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('soilInterior',new THREE.Float32BufferAttribute(soil,1));geometry.setIndex(idx);geometry.computeVertexNormals();planarUV(geometry,.5);
      const mesh=new THREE.Mesh(geometry,groundMaterial({transition:true}));mesh.name=`herbarium-soil-shoulder/court-corner-${side}`;mesh.userData.support=true;mesh.receiveShadow=true;group.add(mesh);owned.push(mesh);supportSurfaces.push(geometry.clone());
    }
    const ground=createSurfaceSupport(heightAt);for(const geometry of supportSurfaces)ground.addGeometry(geometry);
    const occupied=[],blossomWalks=blossomParks.map(park=>({park,points:new THREE.CatmullRomCurve3(park.path.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(140)}));
    const nearBlossomWalk=(x,z)=>blossomWalks.some(({park,points})=>Math.hypot(x-park.overlook[0],z-park.overlook[1])<3.6||points.some(p=>Math.hypot(x-p.x,z-p.z)<1.9));
    const regionalClear=asset=>{
      const box=new THREE.Box3().setFromObject(asset),radius=Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2,besideWater=box.max.x>=waterEnvelope.min.x&&box.min.x<=waterEnvelope.max.x&&box.max.z>=waterEnvelope.min.z&&box.min.z<=waterEnvelope.max.z;
      if(box.max.x>=5&&box.min.x<=26&&box.max.z>=55&&box.min.z<=76||box.max.x>=-19&&box.min.x<=-6&&box.max.z>=35&&box.min.z<=54)return {valid:false,reason:'arrival or actor reservation'};
      const stepsX=Math.ceil((box.max.x-box.min.x)/.35),stepsZ=Math.ceil((box.max.z-box.min.z)/.35);
      for(let i=0;i<=stepsX;i++)for(let j=0;j<=stepsZ;j++){
        const x=box.min.x+(box.max.x-box.min.x)*i/stepsX,z=box.min.z+(box.max.z-box.min.z)*j/stepsZ,path=nearestHerbariumPath(x,z);
        if(nearPath(x,z)||nearBlossomWalk(x,z)||path.distance<path.path.width/2+.16||insideAuthoredGarden(x,z,.15))return {valid:false,reason:'path, blossom walk or authored garden envelope'};
        if(besideWater&&(polygonDistance(x,z,waterBasin)<.39||waterFloors.some(loop=>polygonDistance(x,z,loop)<.08)))return {valid:false,reason:'actual pond basin or sitting shore'};
      }
      const {x,z}=asset.position,h=heightAt(x,z),slope=Math.hypot(heightAt(x+.35,z)-heightAt(x-.35,z),heightAt(x,z+.35)-heightAt(x,z-.35))/.70;
      if(h<=1||slope>=.8)return {valid:false,reason:'unsupported or steep root'};
      if(herbariumSites.some(site=>site.kind!=='water'&&herbariumSiteDistance(x,z,site)<radius+.12))return {valid:false,reason:'destination envelope'};
      if(besideWater&&waterObstacles.some(p=>box.intersectsBox(p.bounds)&&p.triangles.some(t=>box.intersectsTriangle(t))))return {valid:false,reason:'actual pond furniture, edging or coping'};
      const support=herbariumPlantGroundSupport(asset,ground.heightAt);if(support.valid){asset.userData.groundFootprint=support.footprint;asset.userData.terrainContact={lowerEnvelopePenetration:support.penetration,basalPenetration:support.basalPenetration,basalSamples:support.basalSamples};}return support;
    };
    for(const region of [...herbariumRegionalCommunities,...herbariumLowGardenBeds]){
      const community=createHerbariumCommunity({plants:region.plants,terrain:{...region,heightAt:ground.heightAt,accept:regionalClear}});group.add(community);communities.push(community);plantings.push(...community.children);
    }

    function plant(x,z,seed,drift,edge,pilot=false){
      const fullScale=herbariumPlantingDrifts.find(d=>d.id===drift)?.fullScale,fern=!edge||seed%3===0,kind=fern?'fern_02':'periwinkle_plant',variant=fern&&seed%7===0?2:0,scale=fern?(fullScale?(variant===0?2.05+(seed%4)*.10:2.80+(seed%4)*.15):(variant===0?.96+(seed%5)*.055:1.3+(seed%4)*.07)):1.85+(seed%5)*.22,radius=fern?(variant===0?.69:.43)*scale:.13*scale;
      const path=nearestHerbariumPath(x,z);
      if(path.distance<path.path.width/2+radius+.14||nearPath(x,z)||insideAuthoredGarden(x,z,radius+.18)||occupied.some(p=>Math.hypot(x-p.x,z-p.z)<(radius+p.radius)*.32))return;
      if(herbariumSites.some(s=>s.kind!=='water'&&!(pilot&&s.kind==='conservatory')&&herbariumSiteDistance(x,z,s)<radius+.12))return;
      if(pilot&&drift==='conservatory-south'){
        const dx=Math.max(slab.min.x-x,0,x-slab.max.x),dz=Math.max(slab.min.z-z,0,z-slab.max.z);
        if(Math.hypot(dx,dz)<radius+.025||conservatorySolids.some(b=>x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius))return;
      }
      // Pond arrivals and sitting shelves keep their complete support envelopes.
      if(pilot&&drift==='pond-near'){
        if(polygonDistance(x,z,waterBasin)<radius+.39||waterFloors.some(loop=>polygonDistance(x,z,loop)<radius+.08)||waterSolids.some(b=>x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius))return;
      }else if(instances.some(g=>g.userData.site==='water-garden'&&getHerbariumColliders(g).some(b=>x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius)))return;
      // Refine the accepted recipe after its deterministic spacing selection.
      // Validate the corrected full crown and roots, while retaining the old
      // spacing sites so four manual moves cannot replace neighbouring plants.
      const [rootDx,rootDz]=herbariumPlantingDrifts.find(d=>d.id===drift)?.rootOffsets?.[seed]||[0,0],rootX=x+rootDx,rootZ=z+rootDz;
      const key=`plant-${kind}-${variant}`,asset=recipe(key,()=>createHerbariumBotanicalSpecimen(kind,{variant}));asset.scale.setScalar(scale);asset.rotation.y=seed*2.399;asset.position.set(rootX,ground.heightAt(rootX,rootZ),rootZ);if(fullScale&&!regionalClear(asset).valid){if(recipes.get(key)===asset)recipes.delete(key);disposeHerbariumAsset(asset);return;}asset.userData.site='margin-planting';asset.userData.drift=drift;asset.userData.rootedAt=asset.position.toArray();group.add(asset);plantings.push(asset);occupied.push({x,z,radius});
    }
    // Stagger overlapping complete specimens across each tapered ribbon. The
    // central fern body has two rows; smaller flowering edges break its outline.
    for(const drift of herbariumPlantingDrifts){
      if(drift.placement!=='ribbon')continue;let plantingSeed=drift.seed;
      const lengths=drift.points.slice(1).map((b,i)=>Math.hypot(b[0]-drift.points[i][0],b[1]-drift.points[i][1])),total=lengths.reduce((a,b)=>a+b,0);
      let covered=0;
      for(let segment=0;segment<lengths.length;segment++){
        const [ax,az]=drift.points[segment],[bx,bz]=drift.points[segment+1],length=lengths[segment];
        for(let t=.12;t<length;t+=.48)for(let row=0;row<4;row++){
          const along=Math.min(length,t+(row%2)*.23),u=(covered+along)/total,taper=.35+.65*Math.sin(Math.PI*u)**.55,edge=row===0||row===3;
          const offset=(row/3-.5)*(drift.depth-.65)*taper+Math.sin(plantingSeed*1.73)*.08;
          const x=ax+(bx-ax)*along/length+(bz-az)/length*offset,z=az+(bz-az)*along/length-(bx-ax)/length*offset;
          plant(x,z,plantingSeed++,drift.id,edge);
        }
        covered+=length;
      }
    }
    // The pilots follow actual installed edges, not another detached offset line.
    let pilotSeed=9001;
    for(let z=zStart+.18;z<zEnd;z+=.42)for(let row=0;row<3;row++){
      const u=(z-zStart)/(zEnd-zStart),offset=.35+row*.36+.10*Math.sin(u*Math.PI*2);
      const point=new THREE.Vector3(westEdge-offset,0,z+(row%2)*.17).applyMatrix4(conservatory.matrixWorld);plant(point.x,point.z,pilotSeed++,'conservatory-south',row===0,true);
    }
    let courtSeed=14001;
    for(const {loop,site} of courtEdges){
      const drift=herbariumPlantingDrifts.find(d=>d.sourceBorder===site).id;
      for(let i=0;i<loop.length;i++){
        const a=loop[i],b=loop[(i+1)%loop.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),out=new THREE.Vector3(-dz,0,dx).normalize();
        for(let t=.08;t<length;t+=.36)for(let row=0;row<3;row++){
          const offset=.12+row*.31;plant(a.x+dx*t/length+out.x*offset,a.z+dz*t/length+out.z*offset,courtSeed++,drift,row===0);
        }
      }
    }
    for(const side of [-1,1])for(let x=19.15;x<23.4;x+=.42)for(let row=0;row<2;row++){
      const u=(x-19)/4.5,z=10.54+.22*row+.13*Math.sin(u*Math.PI);plant(side*x,z,courtSeed++,`court-corner-${side}`,row===0);
    }
    // Add only the site finish after deterministic admission, so the accepted
    // plant transforms and their original support recipes remain unchanged.
    const apron=waterGardenSiteApron(water,ground.heightAt),apronMesh=new THREE.Mesh(apron,groundMaterial({transition:true}));apronMesh.name='herbarium-site-apron/water-garden';apronMesh.userData={support:true,siteFinish:apron.userData.siteFinish};apronMesh.receiveShadow=true;group.add(apronMesh);owned.push(apronMesh);supportSurfaces.push(apron.clone());
    releaseCommunitySoil=registerHerbariumCommunityFootprints(plantings.map(p=>p.userData.groundFootprint).filter(Boolean));
  }catch(error){releaseCommunitySoil?.();for(const instance of [...instances,...plantings])if(!instance.userData.regionalCommunity)disposeHerbariumAsset(instance);for(const community of communities)disposeCommunityAsset(community);for(const mesh of owned){mesh.geometry.dispose();mesh.material.dispose();}for(const geometry of supportSurfaces)geometry.dispose();group.removeFromParent();throw error;}
  return {group,instances,plantings,communities,colliders,supportSurfaces,plantCourtyard(courtyard){if(disposed)throw new Error('Herbarium district disposed');if(courtPlanted)return;const added=courtyardUnderplanting(courtyard);for(const plant of added){group.add(plant);plantings.push(plant);}courtPlanted=true;},lighting:getHerbariumLighting(group),update(){},dispose(){
    if(disposed)return;disposed=true;releaseCommunitySoil?.();for(const instance of [...instances,...plantings])if(!instance.userData.regionalCommunity)disposeHerbariumAsset(instance);for(const community of communities)disposeCommunityAsset(community);for(const mesh of owned){mesh.geometry.dispose();mesh.material.dispose();}group.removeFromParent();
  }};
}
