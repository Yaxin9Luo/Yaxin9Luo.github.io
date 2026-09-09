import * as THREE from 'three';
import {createArcade,createConservatory,createWaterGarden,createGardenBorder,createHerbariumBotanicalSpecimen,cloneHerbariumAsset,disposeHerbariumAsset,getHerbariumColliders,getHerbariumSupportGeometries} from './herbarium-assets.js';
import {herbariumSites,herbariumPaths,herbariumBorders,herbariumPlantingDrifts,herbariumCourtBeds,nearestHerbariumPath} from './herbarium-layout.js';
import {insideAuthoredGarden} from './environment-layout.js';
import {createSurfaceSupport} from './surface-support.js';
import {surface,planarUV,groundMaterial} from './landscape.js';

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
  const instances=[],plantings=[],colliders=[],supportSurfaces=[],recipes=new Map(),owned=[];
  let disposed=false,courtPlanted=false;
  const add=(asset,site)=>{
    asset.position.set(site.x,site.floor,site.z);asset.rotation.y=site.rotation||0;asset.userData.site=site.id;group.add(asset);instances.push(asset);
    colliders.push(...getHerbariumColliders(asset).map((box,i)=>collisionBox(box,`herbarium/${site.id}/${i}`)));
    supportSurfaces.push(...getHerbariumSupportGeometries(asset));
  };
  const recipe=(key,make)=>{const previous=recipes.get(key);if(previous)return cloneHerbariumAsset(previous);const first=make();recipes.set(key,first);return first;};
  function walk(name,positions,indices){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();planarUV(geometry,.5);
    const material=surface('courtyard-paving',{color:'#deded0',albedoStrength:1,roughness:.94,normalScale:new THREE.Vector2(.45,.45)}),mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;mesh.userData.support=true;group.add(mesh);owned.push(mesh);supportSurfaces.push(geometry.clone());
  }
  try{
    for(const site of herbariumSites)add(recipe(site.kind,()=>site.kind==='arcade'?createArcade():site.kind==='conservatory'?createConservatory():createWaterGarden()),site);
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
    // South porch stays within the audited 4.4 x 1.5 envelope. Its sloped top
    // reaches the floor without adding a collider across the accessible door.
    const positions=[],indices=[],nx=22,nz=8;
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const x=52.8+4.4*i/nx,z=26.5+1.5*j/nz;positions.push(x,Math.max(heightAt(x,z)+.065,6.7-.055*j/nz),z);
      if(i<nx&&j<nz){const a=j*(nx+1)+i,b=a+nx+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
    walk('herbarium-conservatory-south-porch',positions,indices);
    // Fine local earthwork follows actual delivered loam triangles. This fills
    // the shallow soil block above the basin excavation without raising water.
    let pondEdge;const courtEdges=[];
    for(const instance of instances)for(const {geometry,loop,pilot,court,basin} of soilShoulders(instance,heightAt)){
      if(pilot)pondEdge={loop,basin};if(court)courtEdges.push({loop,site:instance.userData.site});
      const mesh=new THREE.Mesh(geometry,groundMaterial({transition:pilot||court}));mesh.name=`herbarium-soil-shoulder/${instance.userData.site}`;mesh.receiveShadow=true;mesh.userData.support=true;group.add(mesh);owned.push(mesh);supportSurfaces.push(geometry.clone());
    }
    const conservatory=instances.find(g=>g.userData.site==='conservatory'),water=instances.find(g=>g.userData.site==='water-garden');
    const slab=new THREE.Box3();for(const m of conservatory.children)if(m.userData.support)slab.union(new THREE.Box3().setFromObject(m));
    // The delivered apron is rectangular even though its plinth is curved.
    // This adjoining earth ribbon meets that real west edge without covering it.
    const westEdge=slab.min.x-.008,zStart=slab.min.z+.65,zEnd=slab.max.z-.9,earthPositions=[],earthIndices=[],soilWeights=[],rows=40,columns=8;
    for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
      const u=i/rows,t=j/columns,z=zStart+(zEnd-zStart)*u,width=(1.5+.16*Math.sin(u*Math.PI*2))*(.45+.55*Math.sin(Math.PI*u)**.45),x=westEdge-width*t,ease=t*t*(3-2*t);
      earthPositions.push(x,(slab.max.y-.014)*(1-ease)+(heightAt(x,z)+.005)*ease,z);soilWeights.push((1-ease)*Math.sin(Math.PI*u)**.35);
      if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;earthIndices.push(a,a+1,b,b,a+1,b+1);}
    }
    const earth=new THREE.BufferGeometry();earth.setAttribute('position',new THREE.Float32BufferAttribute(earthPositions,3));earth.setAttribute('soilInterior',new THREE.Float32BufferAttribute(soilWeights,1));earth.setIndex(earthIndices);earth.computeVertexNormals();planarUV(earth,.5);
    const shoulder=new THREE.Mesh(earth,groundMaterial({transition:true}));shoulder.name='herbarium-soil-shoulder/conservatory-west';shoulder.receiveShadow=true;shoulder.userData.support=true;group.add(shoulder);owned.push(shoulder);supportSurfaces.push(earth.clone());
    const waterBasin=pondEdge.basin,waterFloors=[];for(const mesh of water.children)for(const part of mesh.userData.parts||[])if(part.name==='Supported rounded sitting shore')waterFloors.push(...topSurface(mesh,part,water.position.y).loops);
    const waterSolids=getHerbariumColliders(water).filter(b=>b.name!=='Continuous watertight recessed basin lining'),conservatorySolids=getHerbariumColliders(conservatory);
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
    const occupied=[];
    function plant(x,z,seed,drift,edge,pilot=false){
      const fern=!edge||seed%3===0,kind=fern?'fern_02':'periwinkle_plant',variant=fern&&seed%7===0?2:0,scale=fern?(variant===0?.96+(seed%5)*.055:1.3+(seed%4)*.07):1.85+(seed%5)*.22,radius=fern?(variant===0?.69:.43)*scale:.13*scale;
      const path=nearestHerbariumPath(x,z);
      if(path.distance<path.path.width/2+radius+.14||nearPath(x,z)||insideAuthoredGarden(x,z,radius+.18)||occupied.some(p=>Math.hypot(x-p.x,z-p.z)<(radius+p.radius)*.32))return;
      if(herbariumSites.some(s=>s.kind!=='water'&&!(pilot&&s.kind==='conservatory')&&Math.abs(x-s.x)<s.width/2+radius+.12&&Math.abs(z-s.z)<s.depth/2+radius+.12))return;
      if(pilot&&drift==='conservatory-west'){
        const dx=Math.max(slab.min.x-x,0,x-slab.max.x),dz=Math.max(slab.min.z-z,0,z-slab.max.z);
        if(Math.hypot(dx,dz)<radius+.025||conservatorySolids.some(b=>x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius))return;
      }
      // Pond arrivals and sitting shelves keep their complete support envelopes.
      if(pilot&&drift==='pond-near'){
        if(polygonDistance(x,z,waterBasin)<radius+.39||waterFloors.some(loop=>polygonDistance(x,z,loop)<radius+.08)||waterSolids.some(b=>x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius))return;
      }else if(instances.some(g=>g.userData.site==='water-garden'&&getHerbariumColliders(g).some(b=>x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius)))return;
      const key=`plant-${kind}-${variant}`,asset=recipe(key,()=>createHerbariumBotanicalSpecimen(kind,{variant}));asset.scale.setScalar(scale);asset.rotation.y=seed*2.399;asset.position.set(x,ground.heightAt(x,z),z);asset.userData.site='margin-planting';asset.userData.drift=drift;asset.userData.rootedAt=asset.position.toArray();group.add(asset);plantings.push(asset);occupied.push({x,z,radius});
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
    const {loop,basin}=pondEdge;
    for(let i=0;i<loop.length;i++){
      const a=loop[i],b=loop[(i+1)%loop.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),out=new THREE.Vector3(-dz,0,dx).normalize(),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;
      if(polygonDistance(mx+out.x*.2,mz+out.z*.2,basin)<=polygonDistance(mx,mz,basin))continue;
      for(let t=.1;t<length;t+=.38)for(let row=0;row<3;row++){
        const offset=.16+row*.36;plant(a.x+dx*t/length+out.x*offset,a.z+dz*t/length+out.z*offset,pilotSeed++,'pond-near',row===0,true);
      }
    }
    for(let z=zStart+.18;z<zEnd;z+=.42)for(let row=0;row<3;row++){
      const u=(z-zStart)/(zEnd-zStart),offset=.35+row*.36+.10*Math.sin(u*Math.PI*2);
      plant(westEdge-offset,z+(row%2)*.17,pilotSeed++,'conservatory-west',row===0,true);
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



  }catch(error){for(const instance of [...instances,...plantings])disposeHerbariumAsset(instance);for(const mesh of owned){mesh.geometry.dispose();mesh.material.dispose();}for(const geometry of supportSurfaces)geometry.dispose();group.removeFromParent();throw error;}
  return {group,instances,plantings,colliders,supportSurfaces,plantCourtyard(courtyard){if(disposed)throw new Error('Herbarium district disposed');if(courtPlanted)return;const added=courtyardUnderplanting(courtyard);for(const plant of added){group.add(plant);plantings.push(plant);}courtPlanted=true;},lighting:{lights:[],emissiveMaterials:[],nightMaterials:[],nightObjects:[]},update(){},dispose(){
    if(disposed)return;disposed=true;for(const instance of [...instances,...plantings])disposeHerbariumAsset(instance);for(const mesh of owned){mesh.geometry.dispose();mesh.material.dispose();}group.removeFromParent();
  }};
}
