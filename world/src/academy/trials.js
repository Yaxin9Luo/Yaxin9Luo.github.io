// Trials: the game loop. Pure data and rules (no Three.js) so courses, timing
// and scoring are testable in Node.

export const RING_POINTS=100,PERFECT_POINTS=60,CHAIN_POINTS=25,STARDUST_POINTS=10,WISP_POINTS=250,TIME_POINTS=40;
export const COMBO_WINDOW=2.6,COMBO_MAX=8,HIT_PENALTY=3,COUNTDOWN=3;
export const MEDALS=['bronze','silver','gold'];

export const TRIALS=[
  {
    id:'lantern-loop',name:{en:'Lantern Loop',zh:'灯火环线'},
    blurb:{en:'A first lap of the grounds: the court, the Library, the Ruins and the Atelier.',zh:'环绕学院一圈：庭院、图书馆、古迹与工坊。'},
    start:{x:14,y:17,z:86,heading:.35},ringRadius:5.6,startTime:9,ringTime:1.85,wisps:[],
    rings:[[4,15,64],[-20,15,48],[-44,17,30],[-50,20,-6],[-74,21,-24],[-98,18,4],[-86,16,40],[-66,15,62],[-44,15,92],[-12,15,84],[34,16,74],[60,18,66],[90,20,40],[70,19,10],[32,17,22],[6,19,26]],
    medals:{bronze:0,silver:4800,gold:6500},
  },
  {
    id:'lake-run',name:{en:'Lake Run',zh:'湖面疾驰'},
    blurb:{en:'Skim the water around the islands and thread both bridge channels.',zh:'贴着湖面绕岛飞行，穿过两座桥下的水道。'},
    start:{x:-14,y:-8,z:132,heading:-1.45},ringRadius:5.2,startTime:13,ringTime:2.2,
    rings:[[30,-9,128],[78,-9,112],[118,-8,70],[130,-7,22],[104,-7,-27],[70,-6,-24,4.2],[56.5,-6,-44,4.2],[46,-6,-61,4.4],[34,-8,-96],[-8,-8,-106],[-30,-6,-75,4.6],[-42.5,-5,-62.2,4.2],[-62,-5,-48,4.2],[-79,-6,-37,4.4],[-104,-8,-30],[-118,-8,16],[-114,-8,62],[-72,-9,110],[-30,-8,132]],
    wisps:[[120,-2,46],[16,-2,-104],[-120,-1,40]],
    medals:{bronze:0,silver:5600,gold:7800},
  },
  {
    id:'spire-ascent',name:{en:'Spire Ascent',zh:'尖塔攀升'},
    blurb:{en:'Spiral up the Grand Academy to the crown of its spire, then dive past the Library and Ruins to the lake.',zh:'绕着中央学院盘旋上升到尖塔顶端，再掠过图书馆与古迹俯冲向湖面。'},
    start:{x:0,y:19,z:50,heading:0},ringRadius:4.8,startTime:10,ringTime:2.1,
    rings:[[0,22,6],[-40,28,-10],[-46,38,-40],[-36,48,-74],[0,56,-90],[36,62,-74],[44,68,-40],[32,74,-4],[0,82,10],[-22,90,-28],[0,100,-53],[-30,80,-10],[-56,52,40],[-34,30,66],[-6,4,112],[40,-6,124]],
    wisps:[[-54,40,-24],[14,58,-104],[54,66,-22],[-34,92,-46],[-50,40,58]],
    medals:{bronze:0,silver:4800,gold:7000},
  },
];

const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const len=v=>Math.hypot(v.x,v.y,v.z);
const norm=v=>{const l=len(v)||1;return {x:v.x/l,y:v.y/l,z:v.z/l};};
const P=([x,y,z])=>({x,y,z});

/** Ring centres with facing normals (average of incoming and outgoing directions). */
export function courseRings(trial){
  const points=[trial.start,...trial.rings.map(P)];
  return trial.rings.map((r,i)=>{
    const c=P(r),prev=points[i],next=i+1<trial.rings.length?P(trial.rings[i+1]):null;
    const din=norm(sub(c,prev)),dout=next?norm(sub(next,c)):din;
    return {index:i,...c,radius:r[3]??trial.ringRadius,normal:norm({x:din.x+dout.x,y:din.y+dout.y,z:din.z+dout.z})};
  });
}

export function courseLength(trial){
  const points=[trial.start,...trial.rings.map(P)];let total=0;
  for(let i=1;i<points.length;i++)total+=len(sub(points[i],points[i-1]));
  return total;
}

/** Catmull-Rom point on the course polyline (used for stardust trails). */
function catmull(p0,p1,p2,p3,t){
  const t2=t*t,t3=t2*t,f=(a,b,c,d)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
  return {x:f(p0.x,p1.x,p2.x,p3.x),y:f(p0.y,p1.y,p2.y,p3.y),z:f(p0.z,p1.z,p2.z,p3.z)};
}
/** Stardust along the racing line, kept clear of ring openings. */
export function courseStardust(trial,{spacing=7,clearance=7}={}){
  const points=[trial.start,...trial.rings.map(P)],out=[];
  for(let i=0;i<points.length-1;i++){
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
    const segment=len(sub(p2,p1)),count=Math.max(1,Math.floor(segment/spacing));
    for(let k=1;k<count;k++){
      const t=k/count,p=catmull(p0,p1,p2,p3,t);
      if(len(sub(p,p1))<clearance||len(sub(p,p2))<clearance)continue;
      // A gentle weave makes the trail read as a line to follow, not a wall.
      p.y+=Math.sin((i*7+k)*.9)*.9;out.push(p);
    }
  }
  return out;
}

/** Swept test of the segment a->b against a ring disc. */
export function crossRing(ring,a,b){
  const n=ring.normal,da=(a.x-ring.x)*n.x+(a.y-ring.y)*n.y+(a.z-ring.z)*n.z,db=(b.x-ring.x)*n.x+(b.y-ring.y)*n.y+(b.z-ring.z)*n.z;
  if(da===db||Math.sign(da)===Math.sign(db)&&da!==0)return null;
  const t=da/(da-db),px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t,pz=a.z+(b.z-a.z)*t;
  const distance=Math.hypot(px-ring.x,py-ring.y,pz-ring.z);
  return distance<=ring.radius?{distance,perfect:distance<=ring.radius*.42,forward:db>da}:null;
}

export function createRun(trial){
  return {trial,rings:courseRings(trial),phase:'countdown',countdown:COUNTDOWN,time:trial.startTime,elapsed:0,ring:0,
    score:0,combo:1,comboTimer:0,chain:0,bestChain:0,stardust:0,wisps:0,hits:0,perfects:0,timeBonus:0,result:null};
}

/** Advance clocks. Returns events: tick (countdown second), go, low-time, timeout. */
export function stepRun(run,dt){
  const events=[];
  if(run.phase==='countdown'){
    const before=Math.ceil(run.countdown);run.countdown=Math.max(0,run.countdown-dt);
    const after=Math.ceil(run.countdown);
    if(after<before&&after>0)events.push({type:'tick',value:after});
    if(run.countdown<=0){run.phase='running';events.push({type:'go'});}
    return events;
  }
  if(run.phase!=='running')return events;
  run.elapsed+=dt;
  const before=run.time;run.time=Math.max(0,run.time-dt);
  if(before>5&&run.time<=5)events.push({type:'low-time'});
  if(run.comboTimer>0){run.comboTimer=Math.max(0,run.comboTimer-dt);if(run.comboTimer===0&&run.combo>1){run.combo=1;events.push({type:'combo-lost'});}}
  if(run.time<=0){run.phase='timeout';run.result=finishResult(run,false);events.push({type:'timeout'});}
  return events;
}

export function ringPassed(run,{perfect=false}={}){
  if(run.phase!=='running')return null;
  run.chain++;run.bestChain=Math.max(run.bestChain,run.chain);
  const points=RING_POINTS+(perfect?PERFECT_POINTS:0)+CHAIN_POINTS*Math.min(10,run.chain-1);
  if(perfect)run.perfects++;
  run.score+=points;run.time+=run.trial.ringTime;run.ring++;
  const event={type:'ring',index:run.ring-1,points,perfect,timeBonus:run.trial.ringTime,chain:run.chain};
  if(run.ring>=run.rings.length){run.phase='finished';run.result=finishResult(run,true);event.finished=true;}
  return event;
}

export function stardustCollected(run){
  if(run.phase!=='running')return null;
  run.combo=run.comboTimer>0?Math.min(COMBO_MAX,run.combo+1):Math.max(1,run.combo);
  run.comboTimer=COMBO_WINDOW;run.stardust++;
  const points=STARDUST_POINTS*run.combo;run.score+=points;
  return {type:'stardust',points,combo:run.combo};
}

export function wispBanished(run){
  if(run.phase!=='running')return null;
  run.wisps++;run.score+=WISP_POINTS;return {type:'wisp',points:WISP_POINTS};
}

export function playerHit(run){
  if(run.phase!=='running')return null;
  run.hits++;run.chain=0;run.combo=1;run.comboTimer=0;run.time=Math.max(0,run.time-HIT_PENALTY);
  return {type:'hit',penalty:HIT_PENALTY};
}

function finishResult(run,finished){
  run.timeBonus=finished?Math.round(run.time*TIME_POINTS):0;
  const score=run.score+run.timeBonus;
  return {trialId:run.trial.id,finished,score,medal:finished?medalFor(run.trial,score):null,
    elapsed:+run.elapsed.toFixed(2),rings:run.ring,totalRings:run.rings.length,stardust:run.stardust,wisps:run.wisps,hits:run.hits,perfects:run.perfects,bestChain:run.bestChain,timeBonus:run.timeBonus};
}

export function medalFor(trial,score){
  let medal=null;for(const m of MEDALS)if(score>=trial.medals[m])medal=m;return medal;
}

// ---------- Save data ----------
export const SAVE_KEY='yaxin.academy.v2';
export const SHARD_COUNT=8;
export function freshSave(){return {version:2,trials:{},shards:[],discovered:[],flights:0};}
export function parseSave(raw){
  try{
    const data=JSON.parse(raw);if(!data||data.version!==2)return freshSave();
    const save=freshSave();
    for(const trial of TRIALS){
      const t=data.trials?.[trial.id];if(!t||typeof t!=='object')continue;
      const best=Number.isFinite(t.best)&&t.best>=0&&t.best<1e7?Math.round(t.best):null;
      const medal=MEDALS.includes(t.medal)?t.medal:null;
      const time=Number.isFinite(t.time)&&t.time>0&&t.time<3600?t.time:null;
      if(best!==null||medal)save.trials[trial.id]={best,medal,time,runs:Number.isInteger(t.runs)&&t.runs>=0?Math.min(t.runs,1e6):0};
    }
    save.shards=Array.isArray(data.shards)?[...new Set(data.shards.filter(i=>Number.isInteger(i)&&i>=0&&i<SHARD_COUNT))]:[];
    save.discovered=Array.isArray(data.discovered)?[...new Set(data.discovered.filter(id=>typeof id==='string'&&id.length<40))]:[];
    save.flights=Number.isInteger(data.flights)&&data.flights>=0?Math.min(data.flights,1e6):0;
    return save;
  }catch{return freshSave();}
}

/** Merge a result; returns {save, newBest, newMedal}. */
export function recordResult(save,result){
  const next=parseSave(JSON.stringify(save)),prev=next.trials[result.trialId]||{best:null,medal:null,time:null,runs:0};
  const entry={...prev,runs:(prev.runs||0)+1};
  let newBest=false,newMedal=false;
  if(result.finished){
    if(prev.best===null||result.score>prev.best){entry.best=result.score;newBest=true;}
    if(result.medal&&MEDALS.indexOf(result.medal)>MEDALS.indexOf(prev.medal)){entry.medal=result.medal;newMedal=true;}
    if(prev.time===null||result.elapsed<prev.time)entry.time=result.elapsed;
  }
  next.trials[result.trialId]=entry;
  return {save:next,newBest,newMedal};
}

/** The first trial is always open; each later one opens after a medal on the previous. */
export function unlockedTrials(save){
  const open=[];
  TRIALS.forEach((trial,i)=>{if(i===0||save.trials[TRIALS[i-1].id]?.medal)open.push(trial.id);});
  return open;
}
