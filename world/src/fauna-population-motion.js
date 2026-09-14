import * as THREE from 'three';
import {locations,worldBounds} from './locations.js';
import {academyPathCurves} from './landform-layout.js';
import {herbariumAt} from './herbarium-layout.js';
import {environmentWind} from './environment-wind.js';

const TAU=Math.PI*2;
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const fraction=x=>x-Math.floor(x);
const seededRandom=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
export const FAUNA_DOMAINS=Object.freeze({
  lanterns:[
    {name:'Western water lanterns',count:8,center:[-118,58,28],extent:[22,22,38]},
    {name:'Eastern water lanterns',count:10,center:[123,64,-4],extent:[20,26,34]},
    {name:'Far western lanterns',count:8,center:[-115,92,-112],extent:[22,20,24]},
  ],
  insects:[
    {name:'Cherry grove fireflies',count:30,center:[-73,66],radius:[10,6]},
    {name:'Lilac grove fireflies',count:30,center:[48,77],radius:[9,6]},
    {name:'Outer research fireflies',count:30,center:[-105,-82],radius:[6,8]},
  ],
  birds:[
    {name:'Western swallow flock',count:5,center:[-138,38,-22],radius:[22,36],rise:9,speed:6.2,start:.22},
    {name:'Eastern swallow flock',count:4,center:[143,34,18],radius:[18,34],rise:7,speed:6.0,start:.48},
    {name:'Far swallow flock',count:3,center:[18,60,-190],radius:[60,25],rise:4,speed:6.5,start:.84},
  ],
});

// Authoring rejection is deterministic and independent of the moving player.
// Radius margins include the complete local wandering/sway envelope.
export function clearOfLandmarks(point,margin){
  return locations.every(site=>point.y>site.y+site.height+margin||Math.hypot(point.x-site.x,point.z-site.z)>site.radius+margin);
}
const routeSegments=locations.flatMap(location=>academyPathCurves(location).flatMap(curve=>{
  const points=curve.getPoints(Math.ceil(curve.getLength()/1.5));
  return points.slice(1).map((point,i)=>({a:points[i],b:point,width:location.id==='about'?3.2:2}));
}));
function pointSegmentDistance(x,z,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
  return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
}
export function clearInsectHabitat(x,z,heightAt){
  if(!Number.isFinite(heightAt(x,z))||heightAt(x,z)<0||herbariumAt(x,z,1.2))return false;
  if(!clearOfLandmarks(new THREE.Vector3(x,heightAt(x,z)+1,z),3))return false;
  return routeSegments.every(({a,b,width})=>pointSegmentDistance(x,z,a,b)>width+1.5);
}
const spireCameras=[
  [[130,94,184],[-2,44,-40]],[[130,162,180],[-2,12,-4]],
  [[30,27,79],[0,10,28]],[[-27,26,-23],[-65,5,-53]],
].map(([eye,target])=>{
  const camera=new THREE.PerspectiveCamera(43,16/9,.1,2000);camera.position.fromArray(eye);camera.lookAt(new THREE.Vector3(...target));camera.updateMatrixWorld();return camera;
});
export function clearProjectedSpire(point){
  for(const camera of spireCameras){
    const p=point.clone().project(camera);if(p.z<0||p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1)continue;
    const bottom=new THREE.Vector3(0,35,-38).project(camera),top=new THREE.Vector3(0,106,-38).project(camera);
    if(pointSegmentDistance(p.x,p.y,{x:bottom.x,z:bottom.y},{x:top.x,z:top.y})<.065)return false;
  }
  return true;
}
function allocation(domains,total){
  const sum=domains.reduce((n,domain)=>n+domain.count,0),count=Math.max(0,Math.min(sum,Math.floor(Number.isFinite(total)?total:sum)));
  let left=count;return domains.map((domain,i)=>{const n=i===domains.length-1?left:Math.floor(count*domain.count/sum);left-=n;return n;});
}

/** Pure paths evaluated from one accepted activity clock, with no catch-up debt. */
export function createFaunaMotion({heightAt=()=>6,lanternCount=26,fireflyCount=90,birdCount=12}={}){
  const random=seededRandom(918472),lanterns=[],insects=[],flocks=[],released=Array.from({length:8},()=>({active:false,base:new THREE.Vector3(),position:new THREE.Vector3(),rotation:new THREE.Euler(),phase:random()*TAU,age:0,fade:0,scale:.72}));
  let time=0,releaseIndex=0,reduced=false;
  for(const [group,domain]of FAUNA_DOMAINS.lanterns.entries()){
    const count=allocation(FAUNA_DOMAINS.lanterns,lanternCount)[group];
    for(let i=0;i<count;i++){
      let base;
      for(let attempt=0;attempt<400;attempt++){
        const point=new THREE.Vector3(...domain.center).add(new THREE.Vector3(...domain.extent.map(extent=>(random()*2-1)*extent)));
        if(clearOfLandmarks(point,13)&&clearProjectedSpire(point)&&lanterns.every(lantern=>lantern.base.distanceTo(point)>3)){base=point;break;}
      }
      if(!base)throw new Error(`Cannot place ${domain.name} inside its authored envelope`);
      lanterns.push({group,base,position:base.clone(),rotation:new THREE.Euler(),phase:random()*TAU,scale:.83+random()*.29,fade:1});
    }
  }
  for(const [group,domain]of FAUNA_DOMAINS.insects.entries()){
    const count=allocation(FAUNA_DOMAINS.insects,fireflyCount)[group];
    for(let i=0;i<count;i++){
      let base;
      for(let attempt=0;attempt<500;attempt++){
        const angle=random()*TAU,radius=Math.sqrt(random())*.90,x=domain.center[0]+Math.cos(angle)*domain.radius[0]*radius,z=domain.center[1]+Math.sin(angle)*domain.radius[1]*radius;
        if(clearInsectHabitat(x,z,heightAt)&&insects.every(insect=>Math.hypot(x-insect.base.x,z-insect.base.z)>.65)){base=new THREE.Vector3(x,0,z);break;}
      }
      if(!base)throw new Error(`Cannot place ${domain.name} in its actual habitat`);
      insects.push({group,base,position:base.clone(),rotation:new THREE.Euler(),clearance:1.05+random()*.68,phase:random()*TAU,period:3.8+random()*1.8,pulseOffset:random()*6,glow:0,wingAngle:0});
    }
  }
  for(const [group,domain]of FAUNA_DOMAINS.birds.entries()){
    const count=allocation(FAUNA_DOMAINS.birds,birdCount)[group];if(!count)continue;
    const points=Array.from({length:12},(_,i)=>{const angle=i/12*TAU;return new THREE.Vector3(domain.center[0]+Math.cos(angle)*domain.radius[0],domain.center[1]+Math.sin(angle*2)*domain.rise,domain.center[2]+Math.sin(angle)*domain.radius[1]);});
    const curve=new THREE.CatmullRomCurve3(points,true,'centripetal');curve.arcLengthDivisions=512;curve.updateArcLengths();
    flocks.push({group,domain,curve,length:curve.getLength(),visibility:1,birds:Array.from({length:count},(_,i)=>({index:i,position:new THREE.Vector3(),direction:new THREE.Vector3(),bank:0,poseTime:0,scale:.91+i*.025}))});
  }
  function place(){
    const wind=environmentWind.direction;
    for(const item of lanterns){const drift=Math.sin(time*.065+item.phase)*1.7;item.position.set(item.base.x+wind.x*drift,item.base.y+Math.sin(time*.11+item.phase)*.95,item.base.z+wind.y*drift);item.rotation.set(Math.sin(time*.16+item.phase)*.042,item.phase,Math.cos(time*.13+item.phase)*.048);}
    for(const item of released){
      if(!item.active)continue;const age=time-item.born,drift=age*.23+Math.sin(age*.18+item.phase)*age*.025;
      item.age=age;item.position.set(item.base.x+wind.x*drift,item.base.y+age*.9,item.base.z+wind.y*drift);item.rotation.set(Math.sin(time*.16+item.phase)*.032,item.phase,Math.sin(time*.20+item.phase)*.043);
      item.fade=Math.min(1-smooth(88,100,age),1-smooth(worldBounds.ceiling+48,worldBounds.ceiling+65,item.position.y));
      if(age>=100||item.position.y>=worldBounds.ceiling+65){item.active=false;item.fade=0;}
    }
    for(const [i,item]of insects.entries()){
      const t=time,p=item.phase;item.position.x=item.base.x+Math.sin(t*.67+p)*.32;item.position.z=item.base.z+Math.cos(t*.53+p)*.28;
      // The resolver is live: progressive terrain/patch completion never leaves
      // an insect above the analytic pre-patch surface.
      item.position.y=heightAt(item.position.x,item.position.z)+item.clearance+Math.sin(t*1.1+p)*.20;
      item.rotation.set(Math.sin(t*1.5+p)*.10,p+Math.sin(t*.4+p)*.3,Math.sin(t*1.7+p)*.12);
      const cycle=fraction((t+item.pulseOffset)/item.period)*item.period,halfWidth=.18;
      item.glow=reduced?(i%13===0?.22:.025):(cycle<halfWidth*2?Math.sin(Math.PI*cycle/(halfWidth*2))**2:0);
      item.wingAngle=reduced?0:Math.sin(t*TAU*23+p)*.62;
    }
    for(const flock of flocks){
      const {domain,curve,length}=flock,phase=fraction(time/72+domain.start);flock.visibility=smooth(.04,.10,phase)*(1-smooth(.64,.72,phase));
      for(const bird of flock.birds){
        const distance=time*domain.speed+domain.start*length-bird.index*3.35,u=fraction(distance/length),tangent=curve.getTangentAt(u).normalize();
        bird.position.copy(curve.getPointAt(u));bird.direction.copy(tangent);
        const side=new THREE.Vector3(tangent.z,0,-tangent.x).normalize(),offset=(bird.index%2?1:-1)*(.55+.18*Math.sin(time*.47+bird.index));
        bird.position.addScaledVector(side,offset);bird.position.y+=.18*Math.sin(time*.43+bird.index);
        const before=curve.getTangentAt(fraction((distance-.5)/length)),after=curve.getTangentAt(fraction((distance+.5)/length));
        const curvature=Math.atan2(before.x*after.z-before.z*after.x,before.x*after.x+before.z*after.z);
        bird.bank=THREE.MathUtils.clamp(Math.atan(domain.speed*domain.speed*curvature/9.81),-.35,.35);bird.poseTime=time+bird.index*.19+domain.start*8;
      }
    }
  }
  place();
  return{
    lanterns,insects,flocks,released,
    get time(){return time;},get reduced(){return reduced;},
    update(dt,isReduced=false,{paused=false,started=true}={}){reduced=isReduced;if(started&&!paused&&!reduced&&Number.isFinite(dt)&&dt>0)time+=dt;place();},
    resetActivityForReview(value=0,isReduced=false){time=Number.isFinite(value)?Math.max(0,value):0;reduced=isReduced;releaseIndex=0;for(const item of released){item.active=false;item.age=0;item.fade=0;}place();},
    release(position){
      if(!position||![position.x,position.y,position.z].every(Number.isFinite)||position.y+.7>=worldBounds.ceiling+65)return false;
      const item=released[releaseIndex++%released.length];item.base.set(position.x+1.5,position.y+.7,position.z-.5);item.position.copy(item.base);item.born=time;item.age=0;item.fade=1;item.active=true;place();return true;
    },
  };
}
