// The blog's night sky: Milky Way, temperature-coloured stars with diffraction spikes,
// real constellations around Polaris, tonight's moon, ridgelines and rising lanterns.
const SYNODIC=29.530588853,NEW_MOON=Date.UTC(2000,0,6,18,14);
const D2R=Math.PI/180;

export function moonPhase(date=new Date()){
  const age=(((date-NEW_MOON)/864e5)%SYNODIC+SYNODIC)%SYNODIC,angle=2*Math.PI*age/SYNODIC;
  return {age,angle,lit:(1-Math.cos(angle))/2,waxing:age<SYNODIC/2};
}
const PHASES=[['New moon','新月'],['Waxing crescent','蛾眉月'],['First quarter','上弦月'],['Waxing gibbous','盈凸月'],['Full moon','满月'],['Waning gibbous','亏凸月'],['Last quarter','下弦月'],['Waning crescent','残月']];
// Named by illuminated fraction: quarters only within about a day of half-lit.
export function phaseName(age,lang){
  const a=((age%SYNODIC)+SYNODIC)%SYNODIC,lit=(1-Math.cos(2*Math.PI*a/SYNODIC))/2,waxing=a<SYNODIC/2;
  const i=lit<.03?0:lit>.97?4:Math.abs(lit-.5)<.06?(waxing?2:6):lit<.5?(waxing?1:7):(waxing?3:5);
  return PHASES[i][lang==='zh'?1:0];
}

// J2000 right ascension (hours), declination (degrees), visual magnitude.
export const CONSTELLATIONS=[
  {id:'dipper',name:['Big Dipper','北斗七星'],sub:['URSA MAJOR','大熊座'],stars:[
    ['Dubhe','天枢',11.0621,61.751,1.79],['Merak','天璇',11.0307,56.383,2.37],['Phecda','天玑',11.8972,53.695,2.44],['Megrez','天权',12.2571,57.033,3.31],
    ['Alioth','玉衡',12.9005,55.960,1.77],['Mizar','开阳',13.3988,54.925,2.27],['Alkaid','摇光',13.7923,49.313,1.86],['Alcor','辅',13.4204,54.988,4.01]],
    lines:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]]},
  {id:'little',name:['Little Dipper','小北斗'],sub:['URSA MINOR','小熊座'],stars:[
    ['Polaris','北极星',2.5303,89.264,1.98],['','',17.537,86.586,4.35],['','',16.766,82.037,4.21],['','',15.734,77.794,4.32],
    ['Kochab','北极二',14.845,74.156,2.08],['Pherkad','北极一',15.3455,71.834,3.05],['','',16.2917,75.755,4.95]],
    lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]]},
  {id:'cassiopeia',name:['Cassiopeia','仙后座'],sub:['THE QUEEN','仙后'],stars:[
    ['Caph','王良一',0.1530,59.150,2.28],['Schedar','王良四',0.6751,56.537,2.24],['Navi','策',0.9451,60.717,2.47],['Ruchbah','阁道三',1.4303,60.235,2.68],['Segin','阁道二',1.9066,63.670,3.37]],
    lines:[[0,1],[1,2],[2,3],[3,4]]},
];

// Polar stereographic projection around the celestial pole, as seen looking north (y down on screen).
export function projectStar(ra,dec){const th=ra*15*D2R,r=2*Math.tan((90-dec)/2*D2R);return [r*Math.sin(th),-r*Math.cos(th)];}

function hash2(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,y,s,oct=5){let sum=0,amp=.5,f=1,norm=0;for(let i=0;i<oct;i++){sum+=amp*vnoise(x*f,y*f,s+i*17);norm+=amp;amp*=.5;f*=2.03;}return sum/norm;}
function rng(seed){return ()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const canvas2d=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;};

// Visible star colours from hot to cool; most naked-eye stars read white or blue-white.
const STAR_COLORS=[[196,214,255],[226,234,255],[255,248,240],[255,236,206],[255,214,170],[255,190,150]];
const pickColor=r=>{const x=r();return STAR_COLORS[x<.22?0:x<.5?1:x<.74?2:x<.88?3:x<.96?4:5];};
const magToBright=m=>Math.min(1.5,Math.max(.12,Math.pow(10,-.4*(m-1.6))));

// Near-side maria in unit-disk coordinates (x right, y down), and the craters people recognise.
const MARIA=[[-.5,-.02,.24,.42,.85],[-.26,-.42,.24,.19,1],[.17,-.38,.14,.13,.95],[.3,-.08,.2,.16,.9],[.67,-.3,.1,.08,1],[.54,.16,.1,.16,.75],[.36,.3,.08,.08,.7],[-.18,.37,.17,.12,.7],[-.5,.42,.08,.08,.75],[-.15,-.68,.16,.05,.45],[.2,-.66,.14,.045,.4],[-.03,-.15,.09,.07,.6],[-.38,.1,.12,.09,.55]];
const NAMED_CRATERS=[[-.32,-.12,.05,1,.5],[-.12,.72,.045,1,1],[-.55,-.08,.025,1,.3],[-.68,-.32,.018,1,.25],[-.1,-.73,.04,0,0],[.1,.45,.035,0,0]];

function buildMoonTexture(size,seed){
  const n=size*size,mareMask=new Float32Array(n),nx=new Float32Array(n),ny=new Float32Array(n),nz=new Float32Array(n),alb=new Float32Array(n),alpha=new Float32Array(n),du=new Float32Array(n),dv=new Float32Array(n);
  const half=size/2,scale=half-1;
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const k=j*size+i,u=(i+.5-half)/scale,v=(j+.5-half)/scale,r2=u*u+v*v;
    alpha[k]=Math.min(1,Math.max(0,(1-Math.sqrt(r2))*scale+.5));if(!alpha[k])continue;
    // Highlands: bright, finely grained, a little brighter toward the south.
    let a=.8+.1*(fbm(u*3+7,v*3,seed,4)-.5)+.08*(fbm(u*18,v*18,seed+5,4)-.5)+.04*v;
    let g=0;
    for(const [cx,cy,rx,ry,st] of MARIA){const e=((u-cx)/rx)**2+((v-cy)/ry)**2;g=Math.max(g,Math.exp(-e*1.4)*st);}
    // Noisy coastlines instead of ellipses.
    const mare=smooth(.3,.62,g+(fbm(u*6+3,v*6,seed+11,4)-.5)*.42);
    a*=1-.34*mare*(.8+.4*fbm(u*11,v*11,seed+23,3));
    mareMask[k]=mare;alb[k]=a;
  }
  const r=rng(seed),craters=[...NAMED_CRATERS];
  for(let c=0;c<140;c++){const ang=r()*Math.PI*2,rad=Math.sqrt(r())*.96;craters.push([Math.cos(ang)*rad,Math.sin(ang)*rad,.006+Math.pow(r(),4)*.045,r()<.06?1:0,0]);}
  for(const [cx,cy,rc,fresh,rays] of craters){
    const reach=rays?rc*11:rc*1.5,i0=Math.max(0,Math.floor((cx-reach)*scale+half)),i1=Math.min(size-1,Math.ceil((cx+reach)*scale+half)),j0=Math.max(0,Math.floor((cy-reach)*scale+half)),j1=Math.min(size-1,Math.ceil((cy+reach)*scale+half));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const k=j*size+i;if(!alpha[k])continue;
      const u=(i+.5-half)/scale-cx,v=(j+.5-half)/scale-cy,d=Math.hypot(u,v),q=d/rc,dx=d?u/d:0,dy=d?v/d:0;
      const depth=mareMask[k]>.5?.6:1;
      if(q<1){du[k]-=dx*.32*q*depth;dv[k]-=dy*.32*q*depth;if(fresh)alb[k]*=1.05;}
      else if(q<1.3){const sh=(1.3-q)/.3;du[k]+=dx*.22*sh*depth;dv[k]+=dy*.22*sh*depth;}
      if(fresh)alb[k]+=.08*Math.exp(-((q-1)**2)*3);
      if(rays&&q>1.2){const ang=Math.atan2(v,u),ray=smooth(.62,.95,vnoise(ang*7+40,cx*50,seed+71))*smooth(.45,.8,vnoise(ang*23,3,seed+73));alb[k]+=rays*.2*ray*Math.exp(-(q-1.2)/7);}
    }
  }
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const k=j*size+i;if(!alpha[k])continue;
    const u=(i+.5-half)/scale,v=(j+.5-half)/scale,z=Math.sqrt(Math.max(0,1-u*u-v*v));
    const x=u+du[k]*.35,y=-(v+dv[k]*.35),zz=z+.02,len=Math.hypot(x,y,zz);
    nx[k]=x/len;ny[k]=y/len;nz[k]=zz/len;
  }
  return {size,nx,ny,nz,alb,alpha,mareMask,image:new ImageData(size,size),sprite:canvas2d(size,size)};
}

// Lit by the real phase angle; earthshine keeps the dark side faintly visible.
function shadeMoon(tex,angle,tilt){
  const {size,nx,ny,nz,alb,alpha,mareMask,image,sprite}=tex,data=image.data;
  const lx0=Math.sin(angle),lz=-Math.cos(angle),lx=lx0*Math.cos(tilt),ly=lx0*Math.sin(tilt);
  const earth=.05+.08*(1+Math.cos(angle))/2;
  for(let k=0,p=0;k<size*size;k++,p+=4){
    const a=alpha[k];if(!a){data[p+3]=0;continue;}
    const mu0=nx[k]*lx+ny[k]*ly+nz[k]*lz,mu=Math.max(.05,nz[k]);
    let I=0;if(mu0>0){const ls=mu0/(mu0+mu);I=alb[k]*(1.3*ls+.5*mu0)*smooth(0,.06,mu0);}
    const e=alb[k]*earth,cool=mareMask[k]*.05;
    data[p]=Math.min(255,I*(258-cool*300)+e*150);data[p+1]=Math.min(255,I*(248-cool*120)+e*172);data[p+2]=Math.min(255,I*(228+cool*120)+e*215);data[p+3]=a*255;
  }
  sprite.getContext('2d').putImageData(image,0,0);
}

function starSprite([r,g,b]){
  const c=canvas2d(64,64),x=c.getContext('2d'),grad=x.createRadialGradient(32,32,0,32,32,32);
  grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.07,`rgba(${r},${g},${b},.95)`);grad.addColorStop(.2,`rgba(${r},${g},${b},.28)`);grad.addColorStop(.5,`rgba(${r},${g},${b},.06)`);grad.addColorStop(1,`rgba(${r},${g},${b},0)`);
  x.fillStyle=grad;x.fillRect(0,0,64,64);return c;
}

export function startSky(host,canvas,{lang='en',reducedMotion=false,tip}={}){
  const ctx=canvas.getContext('2d');
  const sprites=STAR_COLORS.map(starSprite),M=28;
  let w=0,h=0,dpr=1,deep,ridgeBack,ridgeFront,stars=[],groups=[],lanterns=[],meteors=[],sparks=[],moon=null,moonTex=null;
  let raf=0,running=false,visible=true,last=performance.now(),idleSince=performance.now(),tour={index:-1,until:0},nextMeteor=performance.now()+4000;
  const pointer={x:-1e4,y:-1e4,inside:false},par={x:0,y:0};
  const today=moonPhase();let phaseAnim=null,moonHover=false,phaseShown=today.angle;
  const T=(en,zh)=>lang==='zh'?zh:en;

  function layout(){
    const narrow=w<900;
    const R=narrow?Math.max(26,w*.075):Math.min(68,Math.max(44,w*.042));
    moon={x:narrow?w*.8:w*.86,y:narrow?h*.11:h*.17,R};
    // Constellations: rotate the projected sky so the Big Dipper sits right of Polaris.
    const pts=CONSTELLATIONS.map(c=>c.stars.map(s=>projectStar(s[2],s[3])));
    const pol=pts[1][0],dip=pts[0].slice(0,7).reduce((a,p)=>[a[0]+p[0]/7,a[1]+p[1]/7],[0,0]);
    const target=narrow?62*D2R:32*D2R,dist=narrow?Math.min(w*.4,h*.32):Math.min(w*.2,h*.31);
    const rot=target-Math.atan2(dip[1]-pol[1],dip[0]-pol[0]),sc=dist/Math.hypot(dip[0]-pol[0],dip[1]-pol[1]);
    const anchor=narrow?[w*.5,h*.17]:[w*.6,h*.3];
    groups=CONSTELLATIONS.map((c,ci)=>{
      const p=pts[ci].map(([x,y])=>{const dx=x-pol[0],dy=y-pol[1];return [anchor[0]+(dx*Math.cos(rot)-dy*Math.sin(rot))*sc,anchor[1]+(dx*Math.sin(rot)+dy*Math.cos(rot))*sc];});
      const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
      return {...c,p,box:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],glow:0,progress:0,guide:0};
    });
    const r=rng(7);
    stars=[];const count=Math.round(w*h/15000);
    for(let i=0;i<count;i++){const x=r()*w,y=r()*h*.78;if(Math.hypot(x-moon.x,y-moon.y)<moon.R*3)continue;stars.push({x,y,b:.12+Math.pow(r(),5)*1.05,c:Math.floor(r()*6),f1:.6+r()*2.2,f2:2+r()*4,p1:r()*7,p2:r()*7});}
    stars.forEach(s=>{s.c=STAR_COLORS.indexOf(pickColor(rng(Math.floor(s.p1*1e4))));});
    lanterns=Array.from({length:Math.max(3,Math.round(w/300))},(_,i)=>newLantern(true,i));
  }
  function newLantern(anywhere,i=Math.random()*99){const r=rng(Math.floor(i*977+performance.now()));return {x:(.08+r()*.84)*w,y:anywhere?h*(.45+r()*.5):h*(.9+r()*.08),s:.5+r()*.6,v:.1+r()*.16,sway:r()*7,flick:r()*7};}

  function buildDeep(){
    const W=w+2*M,H=h+2*M,sw=Math.ceil(W/3),sh=Math.ceil(H/3);
    const small=canvas2d(sw,sh),sx=small.getContext('2d'),img=sx.createImageData(sw,sh),d=img.data;
    // Milky Way rising from behind the ridges toward the upper left.
    const core=[W*.73/3,H*.95/3],dir=[-.6,-.8],nrm=[.8,-.6],sigma=Math.hypot(sw,sh)*.085;
    for(let j=0;j<sh;j++)for(let i=0;i<sw;i++){
      const px=i-core[0],py=j-core[1],along=px*dir[0]+py*dir[1],across=px*nrm[0]+py*nrm[1];
      const wob=across+sigma*.35*(fbm(along/90,1.3,3,3)-.5)*2;
      const band=Math.exp(-((wob/sigma)**2)),tex=fbm(i/26,j/26,9,5),fine=fbm(i/7,j/7,13,3);
      const lane=Math.exp(-(((wob+sigma*.18*Math.sin(along/60))/(sigma*.22))**2))*smooth(.35,.75,fbm(i/18+5,j/18,21,4));
      const coreBoost=1+1.6*Math.exp(-((along/(sigma*2.6))**2));
      let v=band*(.35+.65*tex)*(.75+.25*fine)*coreBoost*(1-.78*lane);
      v=Math.max(0,v-.08);
      const warm=Math.exp(-((along/(sigma*3))**2)),k=(j*sw+i)*4;
      d[k]=180+70*warm;d[k+1]=192+40*warm;d[k+2]=230-40*warm;d[k+3]=Math.min(255,v*95);
    }
    sx.putImageData(img,0,0);
    deep=canvas2d(W*dpr,H*dpr);const x=deep.getContext('2d');x.scale(dpr,dpr);x.imageSmoothingQuality='high';x.drawImage(small,0,0,W,H);
    // Faint stars, denser inside the band.
    const r=rng(42),n=Math.round(W*H/380);
    for(let i=0;i<n;i++){
      let px=r()*W,py=r()*H*.9;
      if(r()<.45){const t=(r()-.5)*Math.hypot(W,H)*1.1,s=(r()+r()+r()-1.5)*sigma*3*.7;px=core[0]*3+dir[0]*t+nrm[0]*s;py=core[1]*3+dir[1]*t+nrm[1]*s;}
      const a=.07+.7*Math.pow(r(),4),[cr,cg,cb]=pickColor(r);
      x.fillStyle=`rgba(${cr},${cg},${cb},${a})`;const s=.35+a*1.1;x.beginPath();x.arc(px,py,s,0,Math.PI*2);x.fill();
    }
  }

  function buildRidges(){
    const W=w+2*M,H=h+2*M;
    ridgeBack=canvas2d(W*dpr,H*dpr);ridgeFront=canvas2d(W*dpr,H*dpr);
    const ridge=(c,base,amp,seed,freq,fill,rim)=>{
      c.beginPath();c.moveTo(0,H);const pts=[];
      for(let px=0;px<=W;px+=3){const n=smooth(.28,.72,fbm(px*freq,.5,seed,5)),ridged=Math.pow(1-Math.abs(2*fbm(px*freq*2.2,2.5,seed+3,4)-1),2);const y=H*base-H*amp*(.62*n+.38*ridged);pts.push([px,y]);c.lineTo(px,y);}
      c.lineTo(W,H);c.closePath();
      if(Array.isArray(fill)){const g=c.createLinearGradient(0,H*(base-amp),0,H*Math.min(1,base+.06));g.addColorStop(0,fill[0]);g.addColorStop(1,fill[1]);c.fillStyle=g;}else c.fillStyle=fill;
      c.fill();
      if(rim){c.beginPath();pts.forEach(([px,y],i)=>i?c.lineTo(px,y):c.moveTo(px,y));c.strokeStyle=rim;c.lineWidth=1;c.stroke();}
      return pts;
    };
    const b=ridgeBack.getContext('2d');b.scale(dpr,dpr);
    const glow=b.createLinearGradient(0,H*.6,0,H*.85);glow.addColorStop(0,'rgba(120,170,170,0)');glow.addColorStop(1,'rgba(120,170,170,.10)');b.fillStyle=glow;b.fillRect(0,H*.6,W,H*.4);
    ridge(b,.86,.2,101,.0012,['#173340','#0e252d'],'rgba(225,214,170,.22)');
    const mist=b.createLinearGradient(0,H*.72,0,H*.92);mist.addColorStop(0,'rgba(160,200,200,0)');mist.addColorStop(1,'rgba(160,200,200,.13)');b.fillStyle=mist;b.fillRect(0,H*.68,W,H*.32);
    ridge(b,.93,.13,202,.002,['#112a33','#0b1e24'],'rgba(210,200,160,.12)');
    const f=ridgeFront.getContext('2d');f.scale(dpr,dpr);
    const near=ridge(f,.975,.08,303,.0032,'#0a181c',null);
    // Pines along the nearest ridge.
    const r=rng(5);f.fillStyle='#0a181c';
    for(let i=0;i<near.length;i+=2+Math.floor(r()*4)){
      if(r()<.35)continue;const [px,py]=near[i],th=8+r()*20,tw=th*.42;
      for(let tier=0;tier<3;tier++){const ty=py-th*(tier*.3),s=1-tier*.25;f.beginPath();f.moveTo(px-tw*s,ty+2);f.lineTo(px,ty-th*.55*s);f.lineTo(px+tw*s,ty+2);f.fill();}
    }
  }

  function resize(){
    const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
    dpr=Math.min(2,window.devicePixelRatio||1);w=box.width;h=box.height;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    layout();buildDeep();buildRidges();
    const size=Math.ceil(moon.R*2*dpr)+2;moonTex=buildMoonTexture(size,3);shadeMoon(moonTex,phaseShown,-.42);
    draw(performance.now(),0);
  }

  function drawStar(x,y,b,c,spikes){
    const s=4+20*b;ctx.drawImage(sprites[c],x-s,y-s,s*2,s*2);
    if(spikes&&b>.65){const len=8+26*Math.sqrt(b),[r,g,bl]=STAR_COLORS[c];
      for(const [dx,dy] of [[1,0],[0,1]]){const grad=ctx.createLinearGradient(x-dx*len,y-dy*len,x+dx*len,y+dy*len);grad.addColorStop(0,`rgba(${r},${g},${bl},0)`);grad.addColorStop(.5,`rgba(${r},${g},${bl},${Math.min(.85,b*.6)})`);grad.addColorStop(1,`rgba(${r},${g},${bl},0)`);ctx.strokeStyle=grad;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x-dx*len,y-dy*len);ctx.lineTo(x+dx*len,y+dy*len);ctx.stroke();}}
  }

  function activeGroup(now){
    if(pointer.inside){for(const g of groups){const [x0,y0,x1,y1]=g.box,pad=34;if(pointer.x>x0-pad+par.x&&pointer.x<x1+pad+par.x&&pointer.y>y0-pad+par.y&&pointer.y<y1+pad+par.y)return g;}}
    if(tour.index>=0&&now<tour.until)return groups[tour.index];
    return null;
  }

  function draw(now,dt){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const t=now/1000,tx=pointer.inside?(pointer.x/w-.5):0,ty=pointer.inside?(pointer.y/h-.5):0;
    par.x+=((-tx*10)-par.x)*Math.min(1,dt*3);par.y+=((-ty*7)-par.y)*Math.min(1,dt*3);
    const layer=k=>[par.x*k,par.y*k];
    let [ox,oy]=layer(.35);ctx.drawImage(deep,-M+ox,-M+oy,w+2*M,h+2*M);
    // Bright twinkling field stars.
    ctx.globalCompositeOperation='lighter';
    [ox,oy]=layer(1);
    for(const s of stars){const tw=reducedMotion?1:.72+.28*(.6*Math.sin(t*s.f1+s.p1)+.4*Math.sin(t*s.f2+s.p2));drawStar(s.x+ox,s.y+oy,s.b*tw,s.c,true);}
    // Constellations; their labels are drawn last so ridges never cover them.
    const act=activeGroup(now),overlay=[];
    for(const g of groups){
      const on=g===act,rate=reducedMotion?1:Math.min(1,dt*3.2);
      g.glow+=((on?1:0)-g.glow)*rate;
      g.progress=on?Math.min(1,g.progress+(reducedMotion?1:dt*1.1)):Math.max(0,g.progress-(reducedMotion?1:dt*2));
      g.guide=on&&g.progress>=1&&g.id==='dipper'?Math.min(1,g.guide+(reducedMotion?1:dt*1.2)):Math.max(0,g.guide-dt*3);
      const P=g.p.map(([x,y])=>[x+ox,y+oy]);
      ctx.globalCompositeOperation='source-over';ctx.lineCap='round';
      ctx.strokeStyle='rgba(214,196,150,.16)';ctx.lineWidth=.8;ctx.beginPath();for(const [a,b] of g.lines){ctx.moveTo(...P[a]);ctx.lineTo(...P[b]);}ctx.stroke();
      if(g.glow>.01){
        ctx.save();ctx.shadowColor='rgba(243,214,159,.9)';ctx.shadowBlur=10;ctx.strokeStyle=`rgba(243,220,170,${.85*g.glow})`;ctx.lineWidth=1.3;ctx.beginPath();
        g.lines.forEach(([a,b],k)=>{const seg=Math.min(1,Math.max(0,g.progress*g.lines.length-k));if(!seg)return;ctx.moveTo(...P[a]);ctx.lineTo(P[a][0]+(P[b][0]-P[a][0])*seg,P[a][1]+(P[b][1]-P[a][1])*seg);});
        ctx.stroke();ctx.restore();
      }
      ctx.globalCompositeOperation='lighter';
      g.stars.forEach((s,i)=>{const b=magToBright(s[4])*(1+.5*g.glow)*(reducedMotion?1:.9+.1*Math.sin(t*1.7+i*2.1));drawStar(P[i][0],P[i][1],b,s[4]<2.3?1:2,true);});
      const cox=ox,coy=oy;
      if(g.glow>.02)overlay.push(()=>{
        ctx.globalCompositeOperation='source-over';ctx.textBaseline='middle';
        ctx.font='500 11px Inter, "PingFang SC", sans-serif';
        const cxm=P.reduce((a,q)=>a+q[0],0)/P.length,cym=P.reduce((a,q)=>a+q[1],0)/P.length;
        // Each name tries outward first, then the four sides, skipping spots another name already took.
        const taken=P.map(([x,y])=>[x-4,y-4,x+4,y+4]);
        g.stars.forEach((s,i)=>{const label=lang==='zh'?s[1]:s[0];if(!label||s[4]>3.9)return;const a=g.glow*smooth(i/g.stars.length*.8,i/g.stars.length*.8+.25,g.progress+.15);
          let dx=P[i][0]-cxm,dy=P[i][1]-cym;const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
          const tw=ctx.measureText(label).width,[x,y]=P[i];
          const spot=([ux,uy])=>{const cx=x+ux*12,cy=y+uy*11,left=ux<-.3?cx-tw:ux>.3?cx:cx-tw/2;return [left,cy-7,left+tw,cy+7];};
          const hit=r=>taken.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]);
          const box=[[dx,dy],[1,0],[-1,0],[0,-1],[0,1],[.7,-.7],[-.7,-.7],[.7,.7],[-.7,.7]].map(spot).find(r=>!hit(r))||spot([dx,dy]);
          taken.push(box);ctx.textAlign='left';ctx.fillStyle=`rgba(226,218,196,${a*.85})`;ctx.fillText(label,box[0],(box[1]+box[3])/2);});
        // Title below the figure if there is sky there, otherwise beside it.
        const [x0,y0,x1,y1]=g.box.map((v,i)=>v+(i%2?coy:cox));
        let tx=(x0+x1)/2,ty=y1+34,align='center';
        if(ty>h*.68){if(x1+170<w){tx=x1+28;align='left';}else{tx=x0-28;align='right';}ty=(y0+y1)/2-8;}
        ctx.textAlign=align;ctx.fillStyle=`rgba(243,220,170,${g.glow})`;ctx.font=lang==='zh'?'500 21px "Songti SC", serif':'italic 500 24px "Cormorant Garamond", serif';ctx.fillText(g.name[lang==='zh'?1:0],tx,ty);
        ctx.font='600 9px Inter, sans-serif';if('letterSpacing' in ctx)ctx.letterSpacing='2.5px';ctx.fillStyle=`rgba(190,200,190,${g.glow*.8})`;ctx.fillText(g.sub[lang==='zh'?1:0],tx,ty+20);if('letterSpacing' in ctx)ctx.letterSpacing='0px';ctx.textAlign='left';
      });
      // Follow the pointer stars Merak → Dubhe to Polaris.
      if(g.id==='dipper'&&g.guide>.01){
        const pol=groups[1].p[0],a=P[1],b=P[0],end=[pol[0]+ox,pol[1]+oy],sx=b[0]+(b[0]-a[0])*.25,sy=b[1]+(b[1]-a[1])*.25;
        ctx.globalCompositeOperation='source-over';ctx.setLineDash([3,6]);ctx.strokeStyle=`rgba(170,210,215,${.7*g.guide})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+(end[0]-sx)*ease(g.guide),sy+(end[1]-sy)*ease(g.guide));ctx.stroke();ctx.setLineDash([]);
        const ga=g.guide;overlay.push(()=>{ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle=`rgba(190,226,230,${ga})`;ctx.font='500 11px Inter, "PingFang SC", sans-serif';ctx.fillText(T('Polaris · the pointer stars lead here','北极星 · 沿天璇、天枢延长即可找到'),end[0]-12,end[1]-14);ctx.textAlign='left';});
      }
    }
    // Moon with bloom and a faint 22° halo.
    [ox,oy]=layer(1.6);
    const mx=moon.x+ox,my=moon.y+oy,R=moon.R,lit=(1-Math.cos(phaseShown))/2,k=(.35+.65*lit)*(moonHover?1.25:1);
    ctx.globalCompositeOperation='lighter';
    const bloom=ctx.createRadialGradient(mx,my,R*.9,mx,my,R*5);bloom.addColorStop(0,`rgba(255,238,205,${.26*k})`);bloom.addColorStop(.18,`rgba(255,232,196,${.1*k})`);bloom.addColorStop(1,'rgba(255,230,190,0)');
    ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(mx,my,R*5,0,Math.PI*2);ctx.fill();
    const halo=ctx.createRadialGradient(mx,my,R*3.1,mx,my,R*3.75);halo.addColorStop(0,'rgba(255,190,160,0)');halo.addColorStop(.45,`rgba(255,214,180,${.05*k})`);halo.addColorStop(.6,`rgba(190,215,255,${.045*k})`);halo.addColorStop(1,'rgba(180,210,255,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(mx,my,R*3.75,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    if(moonTex){const s=moonTex.size/dpr;ctx.drawImage(moonTex.sprite,mx-s/2,my-s/2,s,s);}
    // Ridges, lanterns between them, meteors.
    [ox,oy]=layer(.6);ctx.drawImage(ridgeBack,-M+ox,-M+oy,w+2*M,h+2*M);
    [ox,oy]=layer(1.1);
    for(const l of lanterns){
      if(!reducedMotion){l.y-=l.v*dt*60;l.sway+=dt*.6;if(l.y<-50)Object.assign(l,newLantern(false));}
      const x=l.x+Math.sin(l.sway)*7+ox,y=l.y+oy,s=l.s,fl=reducedMotion?1:.85+.15*Math.sin(t*9+l.flick)*Math.sin(t*5.3+l.flick);
      ctx.globalCompositeOperation='lighter';
      const glow=ctx.createRadialGradient(x,y,0,x,y,30*s);glow.addColorStop(0,`rgba(255,190,105,${.32*fl})`);glow.addColorStop(1,'rgba(255,160,80,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,30*s,0,Math.PI*2);ctx.fill();
      ctx.globalCompositeOperation='source-over';
      const body=ctx.createLinearGradient(x,y-6*s,x,y+6*s);body.addColorStop(0,`rgba(255,226,170,${.95*fl})`);body.addColorStop(1,`rgba(232,140,70,${.9*fl})`);ctx.fillStyle=body;
      ctx.beginPath();ctx.moveTo(x-3.4*s,y-5.5*s);ctx.lineTo(x+3.4*s,y-5.5*s);ctx.quadraticCurveTo(x+4.6*s,y+1,x+3*s,y+5.5*s);ctx.lineTo(x-3*s,y+5.5*s);ctx.quadraticCurveTo(x-4.6*s,y+1,x-3.4*s,y-5.5*s);ctx.fill();
    }
    [ox,oy]=layer(1.6);ctx.drawImage(ridgeFront,-M+ox,-M+oy,w+2*M,h+2*M);
    ctx.globalCompositeOperation='source-over';overlay.forEach(fn=>fn());
    ctx.globalCompositeOperation='lighter';
    meteors=meteors.filter(m=>(m.life+=dt)<m.dur);
    for(const m of meteors){const p=m.life/m.dur,x=m.x+m.vx*m.life,y=m.y+m.vy*m.life,a=Math.sin(Math.PI*Math.min(1,p*1.4))*(1-p*.4),tail=.16;
      const grad=ctx.createLinearGradient(x,y,x-m.vx*tail,y-m.vy*tail);grad.addColorStop(0,`rgba(255,246,220,${a})`);grad.addColorStop(1,'rgba(180,220,255,0)');ctx.strokeStyle=grad;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-m.vx*tail,y-m.vy*tail);ctx.stroke();
      ctx.drawImage(sprites[1],x-6,y-6,12,12);}
    sparks=sparks.filter(s=>(s.life-=s.decay*dt*60)>0);
    for(const s of sparks){s.x+=s.vx*dt*60;s.y+=s.vy*dt*60;s.vy+=.03*dt*60;s.vx*=.98;ctx.fillStyle=`rgba(255,226,165,${s.life})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r*s.life+.3,0,Math.PI*2);ctx.fill();}
    if(pointer.inside){const g=ctx.createRadialGradient(pointer.x,pointer.y,0,pointer.x,pointer.y,140);g.addColorStop(0,'rgba(208,178,122,.07)');g.addColorStop(1,'rgba(208,178,122,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(pointer.x,pointer.y,140,0,Math.PI*2);ctx.fill();}
    ctx.globalCompositeOperation='source-over';
  }

  function step(now){
    if(!running)return;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(phaseAnim){const p=Math.min(1,(now-phaseAnim.start)/phaseAnim.dur);phaseShown=phaseAnim.from+2*Math.PI*ease(p);shadeMoon(moonTex,phaseShown,-.42);updateTip();if(p>=1){phaseAnim=null;phaseShown=today.angle;shadeMoon(moonTex,phaseShown,-.42);updateTip();}}
    if(!pointer.inside&&now-idleSince>5000&&now>tour.until+2500){tour={index:(tour.index+1)%groups.length,until:now+4800};}
    if(now>nextMeteor){spawnMeteor(w*(.35+Math.random()*.6),h*Math.random()*.3);nextMeteor=now+6000+Math.random()*9000;}
    draw(now,dt);raf=requestAnimationFrame(step);
  }
  function setRunning(next){
    if(reducedMotion)return;
    if(next&&!running){running=true;last=performance.now();raf=requestAnimationFrame(step);}
    if(!next&&running){running=false;cancelAnimationFrame(raf);}
  }
  function spawnMeteor(x,y){const ang=(150+Math.random()*25)*D2R,sp=700+Math.random()*400;meteors.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp*.55+sp*.3,life:0,dur:.7+Math.random()*.5});}

  function updateTip(){
    if(!tip)return;
    const show=moonHover||phaseAnim;tip.hidden=!show;if(!show)return;
    const age=(phaseShown/(2*Math.PI))*SYNODIC%SYNODIC,lit=Math.round((1-Math.cos(phaseShown))/2*100);
    tip.innerHTML=phaseAnim
      ?`<small>${T('A lunar month','一个朔望月')} · ${T('day','第')} ${Math.floor(age)+1}${T('',' 天')}</small><strong>${phaseName(age,lang)}</strong><span>${lit}% ${T('illuminated','被照亮')}</span>`
      :`<small>${T('TONIGHT’S MOON','今夜月相')}</small><strong>${phaseName(today.age,lang)}</strong><span>${Math.round(today.lit*100)}% ${T('illuminated','被照亮')} · ${T('click to watch a month pass','点击观看一个月的月相变化')}</span>`;
    const [ox,oy]=[par.x*1.6,par.y*1.6];
    tip.style.left=`${Math.max(12,moon.x+ox-moon.R*1.4-tip.offsetWidth)}px`;tip.style.top=`${moon.y+oy-tip.offsetHeight/2}px`;
  }

  const local=e=>{const box=canvas.getBoundingClientRect();return [e.clientX-box.left,e.clientY-box.top];};
  const overMoon=(x,y)=>Math.hypot(x-moon.x-par.x*1.6,y-moon.y-par.y*1.6)<moon.R*1.25;
  const onMove=e=>{
    [pointer.x,pointer.y]=local(e);pointer.inside=true;idleSince=performance.now();tour.until=0;
    const hover=overMoon(pointer.x,pointer.y);if(hover!==moonHover){moonHover=hover;updateTip();}
    const g=hover?null:activeGroup(performance.now());host.style.cursor=hover?'pointer':g?'help':'';
    if(reducedMotion)draw(performance.now(),1);
  };
  const onLeave=()=>{pointer.inside=false;moonHover=false;updateTip();host.style.cursor='';if(reducedMotion)draw(performance.now(),1);};
  const onDown=e=>{
    if(e.target.closest('a,button,input,label'))return;
    const [x,y]=local(e);
    if(overMoon(x,y)){if(!phaseAnim){phaseAnim={start:performance.now(),dur:reducedMotion?1:3600,from:today.angle};if(reducedMotion){phaseAnim=null;}updateTip();}return;}
    if(e.pointerType!=='mouse'){pointer.x=x;pointer.y=y;const g=groups.find(g=>x>g.box[0]-34&&x<g.box[2]+34&&y>g.box[1]-34&&y<g.box[3]+34);if(g){tour={index:groups.indexOf(g),until:performance.now()+5000};idleSince=performance.now();if(reducedMotion)draw(performance.now(),1);return;}}
    if(reducedMotion)return;
    for(let i=0;i<26;i++){const a=Math.random()*Math.PI*2,sp=.6+Math.random()*2.6;sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-.4,life:1,decay:.012+Math.random()*.016,r:.8+Math.random()*1.4});}
    spawnMeteor(x+120,Math.max(10,y-90));
  };
  host.addEventListener('pointermove',onMove);host.addEventListener('pointerleave',onLeave);host.addEventListener('pointerdown',onDown);
  let resizeTimer=0;const ro=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,w?120:0);});ro.observe(canvas);
  const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;setRunning(visible&&!document.hidden);});io.observe(canvas);
  const onVisibility=()=>setRunning(visible&&!document.hidden);document.addEventListener('visibilitychange',onVisibility);
  // Fonts used by canvas labels must be loaded before the first labelled frame.
  document.fonts?.load('italic 500 24px "Cormorant Garamond"').catch(()=>{});
  resize();setRunning(true);
  return ()=>{setRunning(false);ro.disconnect();io.disconnect();clearTimeout(resizeTimer);document.removeEventListener('visibilitychange',onVisibility);host.removeEventListener('pointermove',onMove);host.removeEventListener('pointerleave',onLeave);host.removeEventListener('pointerdown',onDown);};
}
