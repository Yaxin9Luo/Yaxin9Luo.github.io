import * as THREE from 'three';
import {createSurfaceSupport} from './surface-support.js';
import {createFoliageLOD} from './foliage-lod.js';
import {surface,planarUV} from './landscape.js';
import {createGardenLamp,createLampGroundGlow} from './site-details.js';

import {blossomParks} from './environment-layout.js';

/** Authored walks share the terrain sampler used by footsteps; tree trunks stay off their edges. */
export function createBlossomGroves(root,heightAt,{nearPath=()=>false,trees=true}={}){
  const group=new THREE.Group();group.name='Cherry and lilac lakeside walks';root.add(group);
  const definitions=[],support=createSurfaceSupport(heightAt),lampSites=[],colliders=[];
  const brass=new THREE.MeshStandardMaterial({color:'#a18c61',metalness:.65,roughness:.42});
  const wood=new THREE.MeshStandardMaterial({color:'#554a45',roughness:.88});
  const stone=surface('courtyard-paving',{color:'#ddceb4',albedoStrength:1,normalScale:new THREE.Vector2(.45,.45),roughness:.90,roughnessFloor:.60});
  const add=(geometry,material,name)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const box=(x,y,z,w,h,d,material,name)=>{const mesh=add(new THREE.BoxGeometry(w,h,d),material,name);mesh.position.set(x,y,z);return mesh;};
  for(const park of blossomParks){
    const curve=new THREE.CatmullRomCurve3(park.path.map(([x,z])=>new THREE.Vector3(x,0,z))),points=curve.getPoints(140),positions=[],indices=[];
    points.forEach((point,i)=>{
      const tangent=curve.getTangent(i/(points.length-1));
      for(let side=0;side<9;side++){
        const across=(side/8*2-1)*1.35,x=point.x+tangent.z*across,z=point.z-tangent.x*across;
        positions.push(x,heightAt(x,z)+.085,z);
        if(i<points.length-1&&side<8){const k=i*9+side;indices.push(k,k+9,k+1,k+1,k+9,k+10);}
      }
      if(i%5===0){
        for(const side of[-1,1]){
          const x=point.x+tangent.z*1.49*side,z=point.z-tangent.x*1.49*side;
          box(x,heightAt(x,z)+.08,z,.20,.15,.66,stone,`${park.id} fitted path edging`).rotation.y=Math.atan2(tangent.x,tangent.z);
        }
      }
    });
    const path=new THREE.BufferGeometry();path.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));path.setIndex(indices);path.computeVertexNormals();support.addGeometry(path);planarUV(path,.5);add(path,stone,`${park.id} stone walk`);
    const placements=park.trees.filter(([x,z])=>heightAt(x,z)>.5&&!nearPath(x,z)).map(([x,z,s],i)=>({x,z,y:heightAt(x,z)-.035,s,r:i*2.399+park.seed}));
    if(trees)definitions.push({kind:park.kind,seed:park.seed,placements});
    const [ox,oz]=park.overlook,oy=heightAt(ox,oz)+.085;
    const daisGeometry=new THREE.CircleGeometry(2.8,72);daisGeometry.rotateX(-Math.PI/2);
    const daisPositions=daisGeometry.getAttribute('position');
    for(let i=0;i<daisPositions.count;i++){const x=ox+daisPositions.getX(i),z=oz+daisPositions.getZ(i);daisPositions.setXYZ(i,x,heightAt(x,z)+.13,z);}
    daisGeometry.computeVertexNormals();support.addGeometry(daisGeometry);planarUV(daisGeometry,.5);add(daisGeometry,stone,`${park.id} circular overlook`);
    // Open-backed benches leave the water and mountains visible above the brass rail.
    for(const side of[-1,1]){
      const x=ox+side*2.4,z=oz;
      for(const dz of[-.75,.75])box(x,oy+.36,z+dz,.32,.68,.30,brass,'Cast-bronze bench legs');
      for(let plank=0;plank<4;plank++)box(x+(plank-1.5)*.14,oy+.76,z,.12,.09,2.15,wood,'Curved garden bench seat');
      box(x+side*.28,oy+1.22,z,.065,.15,2.15,wood,'Open garden bench back');
      colliders.push({id:`grove/${park.id}/bench-${side}`,walkable:false,buildingId:'grove',bottom:oy,top:oy+1.35,planes:[[1,0,0,x+.45],[-1,0,0,-x+.45],[0,0,1,z+1.1],[0,0,-1,-z+1.1],[0,1,0,oy+1.35],[0,-1,0,-oy]]});
    }
    for(const [x,z]of park.lamps){const y=heightAt(x,z);if(y<.5)continue;const lamp=createGardenLamp();lamp.position.set(x,y,z);group.add(lamp);lampSites.push([x,y,z,3.2]);}
  }
  group.add(createLampGroundGlow(lampSites,heightAt));
  const foliage=createFoliageLOD(group,definitions);
  const lights=[];
  for(const park of blossomParks){const [x,z]=park.overlook,light=new THREE.PointLight('#f6c387',0,14,2);light.position.set(x,heightAt(x,z)+2.8,z);light.castShadow=false;group.add(light);lights.push({light,baseIntensity:28});}
  group.userData.parkIds=blossomParks.map(p=>p.id);
  return {group,foliage,colliders,lighting:{lights},heightAt:support.heightAt,update:(camera,viewport)=>foliage.update(camera,viewport)};
}
