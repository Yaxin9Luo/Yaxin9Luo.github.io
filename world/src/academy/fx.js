import * as THREE from 'three';
import {createGlowPoints} from './scene.js';

// Particles, wind streaks and camera trauma. All pooled; nothing allocates per frame.

export function createParticles(capacity,{fogDensity}){
  const glow=createGlowPoints(capacity,{fogDensity});
  const pool=Array.from({length:capacity},()=>({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,drag:1,gravity:0,size:1,color:new THREE.Color(),fade:1}));
  let cursor=0,limit=capacity;
  function emit(x,y,z,{count=8,speed=6,spread=1,life=.7,size=1.2,color='#ffe3a6',gravity=0,drag=2.2,vx=0,vy=0,vz=0}={}){
    const c=new THREE.Color(color);
    for(let n=0;n<count;n++){
      const p=pool[cursor];cursor=(cursor+1)%limit;
      const u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=Math.sqrt(1-u*u),s=speed*(.35+Math.random()*.65);
      p.x=x+(Math.random()-.5)*spread;p.y=y+(Math.random()-.5)*spread;p.z=z+(Math.random()-.5)*spread;
      p.vx=vx+Math.cos(a)*r*s;p.vy=vy+u*s;p.vz=vz+Math.sin(a)*r*s;
      p.life=p.max=life*(.6+Math.random()*.6);p.size=size*(.7+Math.random()*.6);p.color.copy(c);p.gravity=gravity;p.drag=drag;
    }
  }
  function update(dt){
    glow.clear();
    for(const p of pool){
      if(p.life<=0)continue;
      p.life-=dt;if(p.life<=0)continue;
      const k=Math.exp(-p.drag*dt);p.vx*=k;p.vy=p.vy*k-p.gravity*dt;p.vz*=k;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const t=p.life/p.max;glow.push(p.x,p.y,p.z,p.color,p.size*(.4+.6*t),t*t*1.4);
    }
    glow.commit();
  }
  return {points:glow.points,material:glow.material,emit,update,setLimit(n){limit=Math.max(16,Math.min(capacity,n));cursor%=limit;},clear(){for(const p of pool)p.life=0;}};
}

/** Streaks around the camera that rush past at speed; opacity follows speed. */
export function createWindStreaks(count=70){
  const positions=new Float32Array(count*6),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.LineBasicMaterial({color:'#d8e8ff',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});
  const lines=new THREE.LineSegments(geometry,material);lines.frustumCulled=false;lines.renderOrder=12;
  const seeds=Array.from({length:count},()=>({a:Math.random()*Math.PI*2,r:2.2+Math.random()*5,z:-Math.random()*40,len:1+Math.random()*2.5}));
  const fwd=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),base=new THREE.Vector3();
  return {lines,update(camera,speed,boosting,dt){
    const intensity=Math.max(0,Math.min(1,(speed-26)/22))*(boosting?1:.6);
    material.opacity+=(intensity*.55-material.opacity)*Math.min(1,dt*6);
    lines.visible=material.opacity>.01;if(!lines.visible)return;
    camera.getWorldDirection(fwd);right.crossVectors(fwd,camera.up).normalize();up.crossVectors(right,fwd).normalize();
    for(let i=0;i<count;i++){
      const s=seeds[i];s.z+=speed*dt*1.6;if(s.z>4){s.z-=44;s.a=Math.random()*Math.PI*2;s.r=2.2+Math.random()*5;}
      base.copy(camera.position).addScaledVector(fwd,-s.z).addScaledVector(right,Math.cos(s.a)*s.r).addScaledVector(up,Math.sin(s.a)*s.r*.7);
      positions[i*6]=base.x;positions[i*6+1]=base.y;positions[i*6+2]=base.z;
      const l=s.len*(1+speed/30);positions[i*6+3]=base.x+fwd.x*l;positions[i*6+4]=base.y+fwd.y*l;positions[i*6+5]=base.z+fwd.z*l;
    }
    geometry.attributes.position.needsUpdate=true;
  }};
}

/** Trauma-based shake: add trauma on impacts; offset grows with trauma². */
export function createShake(){
  let trauma=0,t=0;
  const n=(x)=>Math.sin(x*12.9898)*Math.sin(x*4.1414+1.3);
  return {
    add(amount){trauma=Math.min(1,trauma+amount);},
    update(dt,out,enabled=true){
      t+=dt;trauma=Math.max(0,trauma-dt*1.6);
      const s=enabled?trauma*trauma:0;
      out.x=n(t*7.1)*.55*s;out.y=n(t*6.3+11)*.45*s;out.roll=n(t*5.7+23)*.05*s;return out;
    },
    get trauma(){return trauma;},
  };
}
