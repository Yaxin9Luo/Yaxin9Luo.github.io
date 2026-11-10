import * as THREE from 'three';
import {createKit} from './kit.js';

// Procedural rider on a broom (~700 triangles): one merged lit mesh plus a
// trailing scarf ribbon. Facing -z like the flight model.

export function createRider(materials){
  const k=createKit({seed:23,jitter:.02});
  // Broom: handle along z, bristles at the back.
  k.cyl({x:0,y:-1.3,z:0,r:.07,h:2.6,seg:6,color:'#7a5a3e'});
  const group=new THREE.Group();group.name='Rider';
  const g=k.build();
  // The broom handle was built vertical; lay it along z.
  g.solid.rotateX(Math.PI/2);
  const broom=new THREE.Mesh(g.solid,materials.solid);
  const b=createKit({seed:29,jitter:.03});
  b.cyl({y:-.95,r:.34,rTop:.12,h:1.1,seg:9,color:'#d9b071'});
  b.ico({y:-.98,r:.34,detail:1,sy:.45,color:'#c99f60'});
  b.cyl({y:.1,r:.14,h:.22,seg:6,color:'#6a4a32'});
  const bristles=b.build();bristles.solid.rotateX(-Math.PI/2);bristles.solid.translate(0,0,1.7);
  const bristleMesh=new THREE.Mesh(bristles.solid,materials.solid);
  const r=createKit({seed:31,jitter:.02});
  // Seated rider, looking forward (-z).
  r.cone({x:0,y:-.15,z:.25,r:.62,h:1.25,seg:8,color:'#2f3f73'});             // robe
  r.cyl({x:0,y:.55,z:.15,r:.34,rTop:.28,h:.6,seg:7,color:'#34477e'});        // torso
  r.ico({x:0,y:1.35,z:.1,r:.27,detail:1,color:'#e6c3a3'});                    // head
  r.cyl({x:0,y:1.5,z:.12,r:.48,h:.06,seg:10,color:'#262d52'});               // hat brim
  r.cone({x:0,y:1.55,z:.16,r:.3,h:.85,seg:8,color:'#262d52'});               // hat
  r.cyl({x:0,y:1.56,z:.12,r:.31,h:.08,seg:8,color:'#d9b56a'});               // hat band
  for(const s of [-1,1]){
    r.box({x:s*.34,y:.62,z:-.18,w:.16,h:.16,d:.62,ry:s*.18,color:'#34477e'}); // arms reaching forward
    r.ico({x:s*.24,y:.6,z:-.52,r:.09,color:'#e6c3a3'});                         // hands
    r.box({x:s*.28,y:-.2,z:-.18,w:.18,h:.18,d:.55,color:'#232a4c'});           // legs
  }
  r.cyl({x:.38,y:.62,z:-.95,r:.03,h:.7,seg:5,color:'#4a3426',ry:0});          // wand (vertical, tilted below)
  const body=r.build();
  const riderMesh=new THREE.Mesh(body.solid,materials.solid);
  const wandTip=new THREE.Object3D();wandTip.position.set(.38,.95,-1.2);
  const seat=new THREE.Group();seat.position.y=.15;seat.add(riderMesh,wandTip);
  const tilt=new THREE.Group();tilt.add(broom,bristleMesh,seat);
  group.add(tilt);

  // Scarf ribbon: a short strip trailing from the neck, driven by history.
  const SEG=10,scarfPos=new Float32Array((SEG+1)*2*3),scarfCol=new Float32Array((SEG+1)*2*3);
  const scarfGeo=new THREE.BufferGeometry();scarfGeo.setAttribute('position',new THREE.BufferAttribute(scarfPos,3).setUsage(THREE.DynamicDrawUsage));
  const c1=new THREE.Color('#c84a4a'),c2=new THREE.Color('#e8c16a');
  for(let i=0;i<=SEG;i++){const c=(i>>1)%2?c2:c1;for(let s=0;s<2;s++){scarfCol.set([c.r,c.g,c.b],(i*2+s)*3);}}
  scarfGeo.setAttribute('color',new THREE.BufferAttribute(scarfCol,3));
  const idx=[];for(let i=0;i<SEG;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}scarfGeo.setIndex(idx);
  const scarf=new THREE.Mesh(scarfGeo,materials.scarf);scarf.frustumCulled=false;scarf.name='Scarf';
  const neck=new THREE.Object3D();neck.position.set(0,1.12,.28);seat.add(neck);
  const history=Array.from({length:SEG+1},()=>new THREE.Vector3());let seeded=false;
  const tmp=new THREE.Vector3(),side=new THREE.Vector3(),up=new THREE.Vector3();

  let bob=0;
  return {group,scarf,wandTip,
    update(state,dt,time,{reducedMotion=false}={}){
      group.position.set(state.x,state.y,state.z);
      group.rotation.set(0,state.heading,0,'YXZ');
      // Nose follows pitch; bank into turns; barrel roll on top.
      tilt.rotation.set(state.pitch*.85,0,-state.bank*1.1+state.rollAngle,'YXZ');
      bob+=dt*(state.hover?2.2:6+state.speed*.1);
      tilt.position.y=reducedMotion?0:Math.sin(bob)*(state.hover?.18:.05);
      seat.rotation.x=-Math.min(.35,Math.max(0,(state.speed-24)/40))*.6; // lean forward when fast
      group.updateMatrixWorld(true);
      neck.getWorldPosition(tmp);
      if(!seeded){for(const h of history)h.copy(tmp);seeded=true;}
      // Ribbon segments follow the neck with lag, plus a little flutter.
      history[0].copy(tmp);
      for(let i=1;i<history.length;i++){
        const prev=history[i-1],cur=history[i];
        cur.lerp(prev,Math.min(1,dt*18));
        tmp.subVectors(cur,prev);const l=tmp.length(),max=.16;if(l>max)cur.copy(prev).addScaledVector(tmp,max/l);
        if(!reducedMotion)cur.y+=Math.sin(time*14+i*.9)*.012*i;
      }
      up.set(0,1,0).applyQuaternion(tilt.getWorldQuaternion(new THREE.Quaternion()));
      for(let i=0;i<history.length;i++){
        const p=history[i],w=.11*(1-i/history.length*.4);
        side.copy(up).multiplyScalar(w);
        scarfPos.set([p.x-side.x,p.y-side.y,p.z-side.z],(i*2)*3);scarfPos.set([p.x+side.x,p.y+side.y,p.z+side.z],(i*2+1)*3);
      }
      scarfGeo.attributes.position.needsUpdate=true;scarfGeo.computeBoundingSphere();
    },
    reset(){seeded=false;},
  };
}
