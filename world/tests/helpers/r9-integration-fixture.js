import * as THREE from 'three';
import {xieqiquStoneFishPlacements} from '../../src/yuanmingyuan/xieqiqu-study.js';
import {stoneFishMouth} from '../../src/yuanmingyuan/xieqiqu-fish-surface.js';

// Tiny actual Three scene graphs exercise the real adapter. These geometries
// and 2×2 textures do not stand in for the separate complete-asset proof.
export function r9IntegrationFixture(createAdapter){
  const events=[],callbacks=[],resources=[],buildingResources=new Set(),poolResources=new Set();
  const track=(value,owned)=>{owned.add(value);const record={value,disposals:0};resources.push(record);value.addEventListener('dispose',()=>record.disposals++);return value;};
  const group=name=>{const value=new THREE.Group();value.name=name;return value;};
  const root=group('xieqiqu-complete-group-study'),fountain=group('xieqiqu-south-fountain'),animals=group('south-fountain-animal-sculptures'),basin=group('xieqiqu-south-haitang-pool');
  root.add(fountain);fountain.add(animals,basin);
  const stone=track(new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),buildingResources);
  const plane=track(new THREE.PlaneGeometry(40,40).rotateX(-Math.PI/2),buildingResources);
  const floor=new THREE.Mesh(plane,stone),water=new THREE.Mesh(plane,stone);
  floor.name='original-pool-floor';floor.position.y=-.45;water.name='original-pool-water';water.position.y=.13;basin.add(floor,water);
  const oldGeometry=track(new THREE.BoxGeometry(.1,.1,.1),buildingResources),oldMounts=[];
  const place=(value,p)=>{value.position.fromArray(p.position);value.rotation.y=p.rotationY;value.scale.setScalar(p.size);value.updateMatrix();};
  for(const index of [1,3,2,4]){
    const p=xieqiquStoneFishPlacements.find(p=>p.index===index),mount=group('xieqiqu-south-upturned-stone-fish-'+index);place(mount,p);
    mount.add(new THREE.Mesh(oldGeometry,stone));oldMounts.push(mount);animals.add(mount);
  }
  const poolGroup=group('r9-fixture-pool-owner'),sourceParent=group('standalone-source-fish-parent'),sourceGroup=group('unchanged-source-fish');
  poolGroup.add(sourceParent,group('xieqiqu-south-pool-cropped-court'));
  const maps=Object.fromEntries(['color','normal','roughness'].map(name=>[name,track(new THREE.DataTexture(new Uint8Array(16).fill(127),2,2),poolResources)]));
  const material=track(new THREE.MeshBasicMaterial({map:maps.color}),poolResources);material.normalMap=maps.normal;material.roughnessMap=maps.roughness;
  for(let i=0;i<6;i++){const geometry=track(new THREE.BoxGeometry(.1,.1,.1),poolResources);sourceGroup.add(new THREE.Mesh(geometry,material));}
  const mounts=[],fishViews=[],supports=[],materialBindings=[],waterEndpoints=[];
  for(const p of xieqiquStoneFishPlacements){
    const mount=group('xieqiqu-south-upturned-stone-fish-'+p.index),body=group('fish-body'),plinth=group('fish-support'),flow=group('fish-flow');place(mount,p);mount.add(body,plinth,flow);sourceParent.add(mount);
    for(const source of sourceGroup.children){const mesh=new THREE.Mesh(source.geometry,material);mesh.onBeforeRender=(renderer,scene,camera,geometry,drawMaterial)=>callbacks.push({root:body,camera,material:drawMaterial});body.add(mesh);}
    const bottomY=(-.45-p.position[1])/p.size,geometry=track(new THREE.BoxGeometry(.4,.1,.5).translate(0,bottomY+.05,0),poolResources);geometry.computeBoundingBox();
    const coreMesh=new THREE.Mesh(geometry,material);coreMesh.onBeforeRender=(renderer,scene,camera,geometry,drawMaterial)=>callbacks.push({root:mount,camera,material:drawMaterial});plinth.add(coreMesh);
    const record={group:mount,body,plinth,flow,placement:p};mounts.push(record);fishViews.push({group:body});supports.push({mount:record,core:{geometry},coreMesh});materialBindings.push({mesh:coreMesh,root:mount});
    waterEndpoints.push({id:mount.name+'-jet',start:[...stoneFishMouth],end:[0,(.13-p.position[1])/p.size,1]});
  }
  let buildingDisposed=false,poolDisposed=false,adapter;
  const buildingOwner={group:root,diagnostics:{triangles:0},get disposed(){return buildingDisposed;},
    update(time){events.push(['building-update',time]);},
    dispose(){if(buildingDisposed)return;buildingDisposed=true;events.push('building-dispose');root.clear();for(const value of buildingResources)value.dispose();}};
  const poolOwner={group:poolGroup,supports,materialBindings,diagnostics:{supportVariant:'r9',fullResolutionVerified:true},
    baseOwner:{context:{mounts,diagnostics:{waterEndpoints}},fishViews,sourceOwner:{group:sourceGroup}},get disposed(){return poolDisposed;},
    update(time){events.push(['pool-update',time]);},
    dispose(){if(poolDisposed)return;poolDisposed=true;events.push('pool-dispose');for(const mount of mounts)mount.group.clear();poolGroup.clear();sourceGroup.clear();for(const value of poolResources)value.dispose();}};
  root.updateMatrixWorld(true);poolGroup.updateMatrixWorld(true);
  const originalChildren=animals.children.slice(),sourceChildren=sourceParent.children.slice();
  return {events,callbacks,resources,root,animals,basin,floor,water,oldMounts,mounts,sourceGroup,sourceParent,sourceChildren,originalChildren,maps,buildingOwner,poolOwner,
    install(options={}){adapter=createAdapter({buildingOwner,poolOwner,...options});return adapter;},
    cleanup(){adapter?.dispose();poolOwner.dispose();buildingOwner.dispose();},
  };
}
