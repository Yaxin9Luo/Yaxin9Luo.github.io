/*! PaintSim 0.7 — a small physical paint simulator for the browser.

    A stroke is a bundle of bristles. Each bristle carries its own colour and paint load, lays down
    pigment AND thickness, runs dry on the tooth of the ground and can pick up wet colour beneath it.
    A paint is data (a "material recipe"): colour, body, gloss, metal, flakes, weathering.
    The finished relief is photographed under a raking lamp, so ridges, leaf and flakes catch the light.

    PaintSim.create({canvas, width, height, scale, ground, seed})  → a surface
      surface.paint({material, brush, path, width, pressure, color, opacity})
      surface.fill({material, shape, soft})      surface.dot({material, at, r})
      surface.render()                           surface.light({azimuth, elevation})
    Units are "page units": the surface is `width` × `height` units, `scale` pixels per unit.          */
(function(root){
'use strict';
const VERSION='0.7.0';

/* ====================================================================== maths, noise, colour */
function hash(x,y){let h=Math.imul(x,374761393)+Math.imul(y,668265263)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,o){o=o||4;let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*vnoise(x*f,y*f);a*=.5;f*=2}return s/(1-Math.pow(.5,o))}
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
function hsv(h,s,v){h=((h%360)+360)%360/60;const i=Math.floor(h),f=h-i,p=v*(1-s),q=v*(1-s*f),t=v*(1-s*(1-f));
  return i===0?[v,t,p]:i===1?[q,v,p]:i===2?[p,v,t]:i===3?[p,q,v]:i===4?[t,p,v]:[v,p,q]}
// distance to the nearest border of a jittered Voronoi tiling, in cell units (0 on a border)
function cellEdge(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;let md=8,mx=0,my=0,mi=0,mj=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const px=i+hash(ix+i,iy+j)-fx,py=j+hash(ix+i+57,iy+j+113)-fy,d=px*px+py*py;if(d<md){md=d;mx=px;my=py;mi=i;mj=j}}
  let e=8;
  for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){if(!i&&!j)continue;const ci=mi+i,cj=mj+j,px=ci+hash(ix+ci,iy+cj)-fx,py=cj+hash(ix+ci+57,iy+cj+113)-fy,dx=px-mx,dy=py-my,l=dx*dx+dy*dy;
    if(l>1e-9){const d=((mx+px)*.5*dx+(my+py)*.5*dy)/Math.sqrt(l);if(d<e)e=d}}
  return e}
// fbm value above which a fraction `a` of the area lies, read off the measured distribution of the noise itself
const QT=(()=>{const v=new Float32Array(8192);for(let i=0;i<v.length;i++)v[i]=fbm(hash(i,7)*4096+i*.731,hash(i,91)*4096+i*.377,4);return v.sort()})();
function quantile(a){return QT[Math.round((1-clamp(a,0,1))*(QT.length-1))]}

/* ====================================================================== geometry */
function cr(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3)}
function spline(p,seg,closed){seg=seg||10;const n=p.length,o=[],g=i=>closed?p[(i+n)%n]:p[clamp(i,0,n-1)],m=closed?n:n-1;
  for(let i=0;i<m;i++){const a=g(i-1),b=g(i),c=g(i+1),d=g(i+2);for(let j=0;j<seg;j++){const t=j/seg;o.push([cr(a[0],b[0],c[0],d[0],t),cr(a[1],b[1],c[1],d[1],t)])}}
  if(!closed)o.push(p[n-1].slice());return o}
function arc(x,y,ang,len,curv,n){curv=curv||0;n=n||6;const p=[[x,y]];let a=ang-curv/2;const s=len/n;for(let i=0;i<n;i++){a+=curv/n;x+=Math.cos(a)*s;y+=Math.sin(a)*s;p.push([x,y])}return p}
function circleArc(cx,cy,r,a0,a1,n){n=n||16;const p=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;p.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r])}return p}
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
function bbox(p){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const a of p){if(a[0]<x0)x0=a[0];if(a[1]<y0)y0=a[1];if(a[0]>x1)x1=a[0];if(a[1]>y1)y1=a[1]}return{x0,y0,x1,y1}}

/* ====================================================================== registries: paint is data */
const PIGMENTS=Object.create(null),MATERIALS=Object.create(null),BRUSHES=Object.create(null),GROUNDS=Object.create(null),LIGHTS=Object.create(null);
// A surface may bring recipes of its own (PaintSim.create({define:…})). While it works, they are looked up before the shared ones.
let LOCAL=null;const KIND_KEY={material:'materials',brush:'brushes',ground:'grounds',light:'lights',pigment:'pigments'};
function own(kind,name){const l=LOCAL&&LOCAL[KIND_KEY[kind]];return l&&Object.prototype.hasOwnProperty.call(l,name)?l[name]:undefined}
function within(defs,fn){const prev=LOCAL;LOCAL=defs||null;try{return fn()}finally{LOCAL=prev}}
const mergeDefs=(a,b)=>{const o={};for(const k of Object.values(KIND_KEY))o[k]=Object.assign({},a&&a[k],b&&b[k]);return o};
// a colour is '#hex', [r,g,b] (0–1), a pigment name, {color, scatter, strength} or {mix:{name: parts, …}}.
// It comes back as [r, g, b, scatter, strength]; the last two may be missing and then get their defaults when mixed.
function parseColor(c){
  if(Array.isArray(c))return c;
  if(typeof c==='string'){
    if(c[0]==='#'){let h=c.slice(1);if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];const n=parseInt(h,16);if(h.length===6&&!isNaN(n))return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
    const p=own('pigment',c)||own('pigment',c.toLowerCase())||PIGMENTS[c.toLowerCase()];if(p)return parseColor(p)}
  else if(c&&typeof c==='object'){
    if(c.mix)return mixColors(c.mix);
    if(c.color){const b=parseColor(c.color);return[b[0],b[1],b[2],c.scatter===undefined?b[3]:c.scatter,c.strength===undefined?b[4]:c.strength]}}
  throw new Error('PaintSim: unknown colour '+JSON.stringify(c))}
// a recipe may say {base:'oil', ...}: it then inherits everything from that recipe and overrides what it names
function resolveIn(reg,kind,v,depth,skip){
  if(typeof v==='string'){const lo=v===skip?undefined:own(kind,v),r=lo!==undefined?lo:reg[v];if(!r)throw new Error('PaintSim: unknown '+kind+' "'+v+'"');
    return resolveIn(reg,kind,r,depth,lo!==undefined?v:undefined)}   // a recipe of a painting's own may build on the shared recipe of the same name
  if(v&&v.base!==undefined){if((depth|0)>12)throw new Error('PaintSim: '+kind+' "base" chain is too deep');
    const b=resolveIn(reg,kind,v.base,(depth|0)+1,skip),o=Object.assign({},b,v);delete o.base;
    if(v.addTexture){o.texture=(b.texture||[]).concat(v.addTexture);delete o.addTexture}
    if(reg===MATERIALS&&v.color!==undefined&&v.color2===undefined)delete o.color2;   // a new colour on its own means one tone, not the parent's second tone
    return o}
  return v||{}}
const material=m=>resolveIn(MATERIALS,'material',m),brushOf=b=>resolveIn(BRUSHES,'brush',b),groundOf=g=>resolveIn(GROUNDS,'ground',g);
// the bare minimum, so the engine works on its own; paintsim.recipes.js brings the real palette
MATERIALS.gouache={family:'water',color:'#b8442c',opacity:.94,body:.5,ridges:.12,grain:.03,level:.35,gloss:.05,sharp:.2,dry:.3,reach:220};
BRUSHES.round={shape:'round',width:14,profile:'leaf',clump:3,streak:1,wobble:.3,var:.1};
GROUNDS.vellum={kind:'vellum',color:'#ecdfbf',tooth:.13};

/* ====================================================================== pigment mixing
   Paint does not average the way light does. Every colour is given a reflectance curve over 16 bands of the spectrum
   (the smoothest curves that give back exactly the same sRGB colour, after Scott Burns); pigments are then mixed by
   adding up their absorption K and their scattering S (Kubelka–Munk), and the mixture is turned back into a colour.
   So blue and yellow make green, a little white goes a long way, and complements make a dark neutral.
   Scattering is taken as one number per paint. The tables are printed by tools/spectral.mjs.                       */
const NB=16,F64=a=>Float64Array.from(a),
  RHO_R=F64([0.05692,0.05668,0.03016,0,0,0,0,0,0,0.10839,0.87021,1,1,1,1,1]),
  RHO_G=F64([0,0,0,0.01325,0.30207,0.68639,0.97644,1,1,0.83179,0.12979,0,0,0,0,0]),
  RHO_B=RHO_R.map((r,i)=>1-r-RHO_G[i]),
  MIX_R=F64([0.00234,0.02389,0.04663,-0.00035,-0.06135,-0.12889,-0.17642,-0.10552,0.08367,0.29714,0.4157,0.34995,0.18107,0.05885,0.01188,0.00141]),
  MIX_G=F64([-0.00193,-0.02073,-0.04526,-0.01896,0.0417,0.13029,0.25073,0.29541,0.24109,0.13569,0.03112,-0.01824,-0.01628,-0.0047,-0.00017,0.00025]),
  MIX_B=F64([0.01601,0.15103,0.36751,0.35386,0.17701,0.04743,-0.00879,-0.03032,-0.03112,-0.02294,-0.01233,-0.00482,-0.00164,-0.00061,-0.00022,-0.00006]);
const S2L=new Float64Array(1026),L2S=new Float64Array(4098);
for(let i=0;i<1026;i++){const v=i/1024;S2L[i]=v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
for(let i=0;i<4098;i++){const v=i/4096;L2S[i]=v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055}
const lin=v=>{if(!(v>0))return 0;if(v>=1)return 1;const x=v*1024,i=x|0;return S2L[i]+(S2L[i+1]-S2L[i])*(x-i)};   // sRGB value → linear light
const enc=v=>{if(!(v>0))return 0;if(v>=1)return 1;const x=v*4096,i=x|0;return L2S[i]+(L2S[i+1]-L2S[i])*(x-i)};   // and back
// how strongly a paint scatters light when nobody says: pale paints are full of opaque pigment, dark ones are mostly transparent
function scatterOf(c){if(c[3]!==undefined)return c[3];const y=.2126*lin(c[0])+.7152*lin(c[1])+.0722*lin(c[2]);return .12+.88*y*Math.sqrt(y)}
const POT=new Float64Array(NB);
function potAdd(c,w){const lr=lin(c[0]),lg=lin(c[1]),lb=lin(c[2]);   // w parts, already multiplied by scatter
  for(let i=0;i<NB;i++){let R=lr*RHO_R[i]+lg*RHO_G[i]+lb*RHO_B[i];if(R<.002)R=.002;else if(R>1)R=1;POT[i]+=w*(1-R)*(1-R)/(2*R)}}
function potOut(S,o){let r=0,g=0,b=0;
  for(let i=0;i<NB;i++){const q=POT[i]/S,R=1+q-Math.sqrt(q*q+2*q);r+=MIX_R[i]*R;g+=MIX_G[i]*R;b+=MIX_B[i]*R;POT[i]=0}
  o[0]=enc(r);o[1]=enc(g);o[2]=enc(b);return o}
// mix({ultramarine:1,'cadmium yellow':2}) or mix([[colour,parts],…]) → the colour of the mixture
function mixColors(parts){
  if(!parts||typeof parts!=='object')throw new Error('PaintSim: a mix is {colour: parts, …} or [[colour, parts], …]');
  const list=(Array.isArray(parts)?parts:Object.keys(parts).map(k=>[k,parts[k]])).map(p=>[parseColor(p[0]),+p[1]]).filter(p=>p[1]>0);
  if(!list.length)throw new Error('PaintSim: a mix needs at least one colour with a positive amount');
  if(list.length===1)return list[0][0];
  let S=0,W=0,A=0;
  for(const[c,w]of list){const e=w*(c[4]===undefined?1:c[4]),sc=scatterOf(c)*e;potAdd(c,sc);S+=sc;W+=e;A+=w}
  const o=potOut(S,[0,0,0,0,0]);o[3]=S/W;o[4]=W/A;return o}
// the 33 steps from one colour to another, for brushes loaded with two tones
function ramp(c1,c2){const n=33,a=new Float32Array(n*3),o=[0,0,0],s1=scatterOf(c1)*(c1[4]===undefined?1:c1[4]),s2=scatterOf(c2)*(c2[4]===undefined?1:c2[4]);
  a[0]=c1[0];a[1]=c1[1];a[2]=c1[2];a[n*3-3]=c2[0];a[n*3-2]=c2[1];a[n*3-1]=c2[2];
  for(let i=1;i<n-1;i++){const t=i/(n-1);potAdd(c1,s1*(1-t));potAdd(c2,s2*t);potOut(s1*(1-t)+s2*t,o);a[i*3]=o[0];a[i*3+1]=o[1];a[i*3+2]=o[2]}
  return a}
const RO=[0,0,0];
function rampAt(RA,t){const x=t<=0?0:t>=1?32:t*32,q=x>=32?31:x|0,f=x-q,k=q*3;RO[0]=RA[k]+(RA[k+3]-RA[k])*f;RO[1]=RA[k+1]+(RA[k+4]-RA[k+1])*f;RO[2]=RA[k+2]+(RA[k+5]-RA[k+2])*f;return RO}
// the quick two-colour mix for a brush dragging through wet paint: (1−t) of the first, t of the second, into RO
function mix2(r1,g1,b1,r2,g2,b2,t){
  const a1=lin(r1),a2=lin(g1),a3=lin(b1),c1=lin(r2),c2=lin(g2),c3=lin(b2);
  let y=.2126*a1+.7152*a2+.0722*a3;const s1=(.12+.88*y*Math.sqrt(y))*(1-t);y=.2126*c1+.7152*c2+.0722*c3;const s2=(.12+.88*y*Math.sqrt(y))*t,iS=1/(s1+s2);
  let r=0,g=0,b=0;
  for(let i=0;i<NB;i++){const pr=RHO_R[i],pg=RHO_G[i],pb=RHO_B[i];let R1=a1*pr+a2*pg+a3*pb,R2=c1*pr+c2*pg+c3*pb;
    if(R1<.002)R1=.002;else if(R1>1)R1=1;if(R2<.002)R2=.002;else if(R2>1)R2=1;
    const q=(s1*(1-R1)*(1-R1)/(2*R1)+s2*(1-R2)*(1-R2)/(2*R2))*iS,R=1+q-Math.sqrt(q*q+2*q);r+=MIX_R[i]*R;g+=MIX_G[i]*R;b+=MIX_B[i]*R}
  RO[0]=enc(r);RO[1]=enc(g);RO[2]=enc(b)}
const toHex=c=>{c=parseColor(c);return'#'+[0,1,2].map(i=>Math.round(clamp(c[i],0,1)*255).toString(16).padStart(2,'0')).join('')};

/* pressure along a stroke, 0 (start) → 1 (end). A recipe or command may also give a plain array of numbers. */
const PROF={
  leaf:t=>Math.pow(Math.sin(Math.PI*Math.pow(t,1.25)),.75),
  feather:t=>Math.pow(Math.sin(Math.PI*Math.min(1,Math.pow(t,1.5))),.5),
  taper:t=>Math.pow(Math.sin(Math.PI*t),.55),
  comma:t=>smooth(t/.08)*Math.pow(1-t,.75),
  hair:t=>smooth(t/.06)*Math.pow(1-t,.8),
  flat:t=>smooth(t/.04)*smooth((1-t)/.04),
  pen:t=>smooth(t/.05)*smooth((1-t)/.1)*(.8+.2*Math.sin(Math.PI*t)),
  full:()=>1
};
function profile(p){if(typeof p==='function')return p;
  if(Array.isArray(p)){const n=p.length-1;if(n<1)return()=>p[0]||1;return t=>{const x=clamp(t,0,1)*n,i=Math.min(n-1,Math.floor(x));return p[i]+(p[i+1]-p[i])*(x-i)}}
  return PROF[p]||PROF.taper}

/* every field a recipe may use. lint() reports anything else, so that a misspelt field is not silently ignored */
const FIELDS={
  material:'base family note color color2 blend opacity mode film body ridges grain level gloss sharp metal flake dry charge reach open pickup merge water flow bury rim gran uneven soft cushion texture addTexture',
  texture:'mask scale amount soft octaves stretch angle width warp size length seed invert signed color mix tone height lip gloss sharp metal flake cover',
  flake:'amount hue spread chroma size sparkle sheen drift',cushion:'height round',
  brush:'base note shape kind width profile clump streak jit body reach load pickup opacity charge dry level rag wobble var vary varLen taper edge gaps nib bury density drop blend',
  ground:'base note kind color tooth pitch vary gloss cockle',pigment:'color scatter strength',
  light:'base note azimuth elevation relief contrast cavity shadow softbox cockle exposure shoulder lamps lens',lamp:'azimuth elevation strength color ambient pool',lens:'focus depth blur vignette contrast grain'};
const MASKS=['noise','ridge','cells','speck','lines','grain','tooth'];
function lint(kind,rec){const out=[],reg=kind==='material'?MATERIALS:kind==='brush'?BRUSHES:kind==='ground'?GROUNDS:kind==='pigment'?PIGMENTS:kind==='light'?LIGHTS:null;
  if(!reg)return['unknown kind "'+kind+'" (material, brush, ground, pigment or light)'];
  if(typeof rec==='string'&&(kind!=='pigment'||rec[0]!=='#')){const f=own(kind,rec)||reg[rec]||reg[rec.toLowerCase()];if(!f)return['unknown '+kind+' "'+rec+'"'];rec=f}
  if(kind==='pigment'){try{parseColor(rec)}catch(e){out.push(e.message.replace('PaintSim: ',''))}
    if(rec&&typeof rec==='object'&&!Array.isArray(rec)&&!rec.mix){const ok=FIELDS.pigment.split(' ');for(const f of Object.keys(rec))if(!ok.includes(f))out.push('unknown field "'+f+'"')}
    return out}
  const keys=(k,o,at)=>{const ok=FIELDS[k].split(' ');for(const f of Object.keys(o||{}))if(!ok.includes(f))out.push(at+'unknown field "'+f+'"')};
  const col=(c,at)=>{if(c!==undefined&&c!==null)try{parseColor(c)}catch(e){out.push(at+e.message.replace('PaintSim: ',''))}};
  keys(kind,rec,'');
  if(rec.base!==undefined)try{resolveIn(reg,kind,rec.base)}catch(e){out.push(e.message.replace('PaintSim: ',''))}
  col(rec.color,'');
  if(kind==='material'){col(rec.color2,'');
    if(rec.mode!==undefined&&!['body','stain','glaze'].includes(rec.mode))out.push('mode must be "body" or "stain"');
    if(rec.flake)keys('flake',rec.flake,'flake: ');if(rec.cushion)keys('cushion',rec.cushion,'cushion: ');
    (rec.texture||[]).concat(rec.addTexture||[]).forEach((t,i)=>{const at='texture '+(i+1)+': ';keys('texture',t,at);col(t.color,at);if(!MASKS.includes(t.mask))out.push(at+'unknown mask "'+t.mask+'"')})}
  if(kind==='brush'){if(typeof rec.profile==='string'&&!PROF[rec.profile])out.push('unknown pressure profile "'+rec.profile+'"');
    if(rec.shape!==undefined&&!['round','flat'].includes(rec.shape))out.push('shape must be "round" or "flat"')}
  if(kind==='light'&&rec.lens)keys('lens',rec.lens,'lens: ');
  if(kind==='light'&&rec.lamps!==undefined){if(!Array.isArray(rec.lamps))out.push('lamps must be a list');else rec.lamps.forEach((l,i)=>{keys('lamp',l,'lamp '+(i+1)+': ');col(l.color,'lamp '+(i+1)+': ')});if(rec.lamps.length>4)out.push('at most 4 lamps')}
  if(kind==='ground'&&rec.kind!==undefined&&!['vellum','paper','canvas','panel'].includes(rec.kind))out.push('kind must be vellum, paper, canvas or panel');
  return out}

/* procedural masks for weathering, defined in page units so they run unbroken under every stroke of a material */
function makeMask(e,SEED){
  const sc=e.scale||30,sx=SEED+(e.seed||0)*31.7,sy=SEED*.61+(e.seed||0)*13.3,an=e.angle||0,ca=Math.cos(an),sa=Math.sin(an);
  switch(e.mask){
    case'noise':{const oct=e.octaves||4,t=quantile(e.amount===undefined?.5:e.amount),soft=Math.max(.004,e.soft===undefined?.06:e.soft),st=e.stretch||1;
      return(x,y)=>smooth((fbm((x*ca+y*sa)/(sc*st)+sx,(-x*sa+y*ca)/sc+sy,oct)-t+soft)/(2*soft))}
    case'ridge':{const wd=e.width||.02,oct=e.octaves||3;return(x,y)=>1-smooth(Math.abs(fbm(x/sc+sx,y/sc+sy,oct)-.5)/wd)}
    case'cells':{const wd=e.width||.06,warp=e.warp===undefined?.35:e.warp;
      return(x,y)=>{const u=x/sc,v=y/sc,wx=(fbm(u*.7+sx+9,v*.7+sy,2)-.5)*warp*2,wy=(fbm(u*.7+sx,v*.7+sy+9,2)-.5)*warp*2;
        return 1-smooth(cellEdge(u+wx+sx,v+wy+sy)/(wd*(.55+.9*vnoise(u*1.7+sx,v*1.7+sy))))}}
    case'speck':{const amt=e.amount===undefined?.3:e.amount,size=e.size||.3;
      return(x,y)=>{const u=x/sc+sx,v=y/sc+sy,ix=Math.floor(u),iy=Math.floor(v);let m=0;
        for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=ix+i,cy=iy+j;if(hash(cx+3,cy+71)>amt)continue;
          const r=size*(.4+.6*hash(cx+11,cy+5)),d=Math.hypot(u-cx-hash(cx,cy),v-cy-hash(cx+57,cy+113)),k=1-smooth((d-r*.7)/(r*.3+1e-6));if(k>m)m=k}
        return m}}
    case'lines':{const len=e.length||12;return(x,y)=>{const u=x*ca+y*sa,v=-x*sa+y*ca;return vnoise(u/(sc*len)+sx,v/sc+sy)*.6+vnoise(u/(sc*len*.3)+sx+40,v/(sc*.45)+sy)*.4}}
    case'grain':return(x,y)=>vnoise((x*.866+y*.5)/sc+sx,(y*.866-x*.5)/sc+sy)*.6+vnoise((x*.64-y*.77)/sc*2.3+sx,(y*.64+x*.77)/sc*2.3+sy+7)*.4;
    default:throw new Error('PaintSim: unknown texture mask "'+e.mask+'"')}}

/* How much of each pixel a set of polygons covers: exact area, non-zero winding. No canvas is needed for it, so a shape
   comes out the same in every browser and in Node. Polygons are in page units; the w×h window starts at pixel (x0,y0). */
function rasterize(polys,S,x0,y0,w,h){const rw=w+2,acc=new Float32Array(rw*h),a=new Float32Array(w*h);
  for(const p of polys){const n=p.length;if(n<3)continue;
    for(let i=0;i<n;i++){let ax=p[i][0]*S-x0,ay=p[i][1]*S-y0,bx=p[(i+1)%n][0]*S-x0,by=p[(i+1)%n][1]*S-y0,dir=1;if(ay===by)continue;
      if(ay>by){const tx=ax,ty=ay;ax=bx;ay=by;bx=tx;by=ty;dir=-1}
      const dxdy=(bx-ax)/(by-ay),ya=Math.max(0,Math.floor(ay)),yb=Math.min(h,Math.ceil(by));let x=ax;if(ay<0)x-=ay*dxdy;
      for(let y=ya;y<yb;y++){const row=y*rw,dy=Math.min(y+1,by)-Math.max(y,ay),xn=x+dxdy*dy,d=dy*dir;
        let xa=x<xn?x:xn,xb=x<xn?xn:x;if(xa<0)xa=0;else if(xa>w)xa=w;if(xb<0)xb=0;else if(xb>w)xb=w;
        const xi=Math.floor(xa),xc=Math.ceil(xb);
        if(xc<=xi+1){const xm=.5*(xa+xb)-xi;acc[row+xi]+=d-d*xm;acc[row+xi+1]+=d*xm}
        else{const sl=1/(xb-xa),f0=xa-xi,a0=.5*sl*(1-f0)*(1-f0),f1=xb-xc+1,am=.5*sl*f1*f1;acc[row+xi]+=d*a0;
          if(xc===xi+2)acc[row+xi+1]+=d*(1-a0-am);
          else{const a1=sl*(1.5-f0);acc[row+xi+1]+=d*(a1-a0);for(let q=xi+2;q<xc-1;q++)acc[row+q]+=d*sl;acc[row+xc-1]+=d*(1-a1-(xc-xi-3)*sl-am)}
          acc[row+xc]+=d*am}
        x=xn}}}
  for(let y=0;y<h;y++){let t=0;const row=y*rw,o=y*w;for(let x=0;x<w;x++){t+=acc[row+x];const v=t<0?-t:t;a[o+x]=v>1?1:v}}
  return a}
function boxH(s,d,w,h,r){const iw=1/(2*r+1);for(let y=0;y<h;y++){const o=y*w;let acc=0;for(let x=-r;x<=r;x++)acc+=s[o+(x<0?0:x>=w?w-1:x)];
  for(let x=0;x<w;x++){d[o+x]=acc*iw;const a=x+r+1,b=x-r;acc+=s[o+(a<w?a:w-1)]-s[o+(b>0?b:0)]}}}
function boxV(s,d,w,h,r){const iw=1/(2*r+1);for(let x=0;x<w;x++){let acc=0;for(let y=-r;y<=r;y++)acc+=s[(y<0?0:y>=h?h-1:y)*w+x];
  for(let y=0;y<h;y++){d[y*w+x]=acc*iw;const a=y+r+1,b=y-r;acc+=s[(a<h?a:h-1)*w+x]-s[(b>0?b:0)*w+x]}}}
function blurMask(m,r){const br=Math.max(1,Math.round(r)),t=new Float32Array(m.a.length);for(let i=0;i<3;i++){boxH(m.a,t,m.w,m.h,br);boxV(t,m.a,m.w,m.h,br)}return m}

/* ====================================================================== a painting surface */
function create(opt){
  opt=opt||{};
  const UW=opt.width||1000,UH=opt.height||UW,S=opt.scale||2,W=Math.max(32,Math.round(UW*S)),H=Math.max(32,Math.round(UH*S)),N=W*H,HS=S/2.048,W2=2*W,W3=3*W;
  const cv=opt.canvas||(typeof document!=='undefined'?document.createElement('canvas'):null);if(cv){cv.width=W;cv.height=H}   // without a canvas (Node) the picture is read from `pixels`
  const ctx=cv?cv.getContext('2d'):null;let local=opt.define?mergeDefs(null,opt.define):null;
  let seed=(opt.seed===undefined?1:opt.seed)|0;const SEED=(((opt.seed===undefined?1:opt.seed)|0)%997)*1.618;
  function rnd(){seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
  // A stroke takes one number from the surface's stream and draws all its accidents from a stream of its own. How many it needs
  // depends on the scale (more bristles, more droplets); this way the strokes after it get the same accidents at every scale.
  function sub(){let s=(rnd()*4294967296)|0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

  /* what the surface remembers at every pixel */
  const F=()=>new Float32Array(N);
  const CR=F(),CG=F(),CB=F();            // pigment colour
  const HT=F();                          // paint thickness (relief)
  const SP=F(),RG=F(),MT=F(),FA=F();     // gloss, sharpness of the highlight, metal, flake amount
  const WET=F();                         // how wet the paint lying there still is
  const FI=new Uint8Array(N);            // which kind of flake (slot in the table below)
  const PAPER=F(),HB=F();                // tooth of the ground, working height buffer
  const sW=F(),sR=F(),sG=F(),sBl=F(),sL=F(),sH=F(),sU=F(),touched=new Int32Array(N);   // the stroke being painted
  const OUT=typeof ImageData!=='undefined'?new ImageData(W,H):{data:new Uint8ClampedArray(N*4),width:W,height:H};
  const TS=64,TSH=6,TW=Math.ceil(W/TS),TH=Math.ceil(H/TS),dirty=new Uint8Array(TW*TH);
  function markDirty(x0,y0,x1,y1){if(x1<0||y1<0||x0>=W||y0>=H)return;
    const a=Math.max(0,(x0-12)>>TSH),b=Math.max(0,(y0-12)>>TSH),c=Math.min(TW-1,(x1+12)>>TSH),d=Math.min(TH-1,(y1+12)>>TSH);
    for(let j=b;j<=d;j++)for(let i=a;i<=c;i++)dirty[j*TW+i]=1}

  /* ---------- water: a wash stays afloat for a while, and what floats can move (see flow) ---------- */
  let AQR=null,AQG=null,AQB=null,WQ=null,anyWater=false;   // made on first use: pigment still afloat (as absorbance), and the water it floats in
  const wetTile=new Uint8Array(TW*TH);
  function needWater(){if(!WQ){AQR=F();AQG=F();AQB=F();WQ=F()}}
  function markWet(x0,y0,x1,y1){if(x1<0||y1<0||x0>=W||y0>=H)return;anyWater=true;
    const a=Math.max(0,x0>>TSH),b=Math.max(0,y0>>TSH),c=Math.min(TW-1,x1>>TSH),d=Math.min(TH-1,y1>>TSH);for(let j=b;j<=d;j++)for(let i=a;i<=c;i++)wetTile[j*TW+i]=1}
  function noWater(){if(WQ){WQ.fill(0);AQR.fill(0);AQG.fill(0);AQB.fill(0)}wetTile.fill(0);anyWater=false}

  /* ---------- the ground: vellum, paper, canvas or a gessoed panel ---------- */
  let KP=.13,CKG=.5;
  function ground(g){g=groundOf(g||'vellum');const col=parseColor(g.color||'#ecdfbf'),kind=g.kind||'vellum',pitch=g.pitch||2.3,vary=g.vary===undefined?1:g.vary,gl=g.gloss===undefined?.03:g.gloss;KP=g.tooth===undefined?.13:g.tooth;CKG=g.cockle===undefined?(kind==='panel'?.1:kind==='canvas'?.2:kind==='paper'?.4:.5):g.cockle;
    for(let y=0;y<H;y++){const yd=y/S;for(let x=0;x<W;x++){const xd=x/S,k=y*W+x;let t,dr,dg,db;
      if(kind==='canvas'){ // plain weave: at each crossing one thread rides over the other
        const u=xd/pitch+(vnoise(yd/23+SEED,xd/90)-.5)*.5,v=yd/pitch+(vnoise(xd/23+SEED+40,yd/90)-.5)*.5,iu=Math.floor(u),iv=Math.floor(v),su=Math.sin(Math.PI*(u-iu)),sv=Math.sin(Math.PI*(v-iv));
        let h=((iu+iv)&1)===0?Math.pow(su,.7)*(.5+.5*sv):Math.pow(sv,.7)*(.5+.5*su);h*=.8+.4*vnoise(iu*.37+SEED,iv*.41);
        t=clamp(.08+.8*h+(hash(x,y)-.5)*.1,0,1);const lo=(fbm(xd/160+SEED,yd/160,3)-.5)*.05,d=(t-.5)*.07+lo;dr=d;dg=d;db=d*1.15}
      else if(kind==='paper'){ // cold-pressed paper: soft lumps
        t=vnoise((xd*.8+yd*.6)/2.1+11+SEED,(yd*.8-xd*.6)/2.1+5)*.42+vnoise((xd*.47-yd*.88)/4.6+3,(yd*.47+xd*.88)/4.6+40+SEED)*.26+vnoise((xd*.96+yd*.28)/.95,(yd*.96-xd*.28)/.95+9)*.22+hash(x,y)*.1;
        const d=(fbm(xd/180+SEED,yd/180,3)-.5)*.03-(t-.5)*.05;dr=d;dg=d;db=d*1.2}
      else if(kind==='panel'){ // gesso laid with a wide brush, sanded
        const a=xd*.95+yd*.3,b=-xd*.3+yd*.95;t=clamp(.5+(vnoise(a/14+SEED,b/1.7)-.5)*.2+(vnoise((xd*.8+yd*.6)/1.2+SEED,(yd*.8-xd*.6)/1.2)-.5)*.36+(vnoise((xd*.47-yd*.88)/3.1,(yd*.47+xd*.88)/3.1+SEED)-.5)*.16+(hash(x,y)-.5)*.2,0,1);
        const d=(fbm(xd/200+SEED,yd/200,3)-.5)*.035-(t-.5)*.025;dr=d;dg=d;db=d*1.2}
      else{ // vellum: fine tooth, mottling, faint veins
        t=vnoise(xd/1.05+11+SEED,yd/1.05+5)*.45+vnoise(xd/2.9+3,yd/2.9+40)*.3+hash(x,y)*.25;
        const n=fbm(xd/210+SEED,yd/210,4),n2=fbm(xd/34+50,yd/34+9+SEED,3),n3=vnoise(xd/95+7,yd/95+70+SEED),v=(n-.5)*.1+(n2-.5)*.03;
        const vein=smooth(1-Math.abs(fbm(xd/150+31+SEED,yd/150+17,3)-.5)/.008)*.018,gr=(t-.5)*.035+(hash(x+5,y+9)-.5)*.012;
        dr=v*.9+(n3-.5)*.014-vein*.6-gr;dg=v-(n3-.5)*.004-vein-gr*1.05;db=v*1.3-(n3-.5)*.03-vein*1.2-gr*1.2}
      PAPER[k]=t;CR[k]=col[0]*(1+dr*vary);CG[k]=col[1]*(1+dg*vary);CB[k]=col[2]*(1+db*vary);HT[k]=0;SP[k]=gl;RG[k]=.2;MT[k]=0;FA[k]=0;FI[k]=0;WET[k]=0}}
    noWater();dirty.fill(1)}

  /* ---------- flakes: each paint that sparkles registers what its flakes look like ---------- */
  const flHue=[0],flSpread=[0],flChroma=[0],flSize=[2],flSparkle=[0],flSheen=[0],flDrift=[30],flKeys=new Map();
  function flakeSlot(f){const key=JSON.stringify(f);let s=flKeys.get(key);if(s)return s;s=flHue.length;if(s>255)return 255;flKeys.set(key,s);
    flHue.push(f.hue===undefined?180:f.hue);flSpread.push((f.spread===undefined?.2:f.spread)*180);flChroma.push(f.chroma===undefined?.7:f.chroma);
    flSize.push(Math.max(2,Math.round((f.size===undefined?.6:f.size)*S)));flSparkle.push(f.sparkle===undefined?1:f.sparkle);flSheen.push(f.sheen===undefined?.6:f.sheen);flDrift.push(f.drift||30);return s}

  /* ---------- compiling a recipe into what the brush engine needs ---------- */
  const mcache=new Map(),maskCache=new Map();
  function compileFx(e){const tooth=e.mask==='tooth';let mc=null;
    if(!tooth){const key=JSON.stringify([e.mask,e.scale,e.amount,e.soft,e.octaves,e.stretch,e.angle,e.width,e.warp,e.size,e.length,e.seed]);mc=maskCache.get(key);
      if(!mc){mc={fn:makeMask(e,SEED),buf:null,done:null};maskCache.set(key,mc)}}
    const u=v=>v===undefined?-1:v;
    return{mc,tooth,inv:!!e.invert,signed:!!e.signed,col:e.color?parseColor(e.color):null,mix:e.mix===undefined?1:e.mix,tone:e.tone===undefined?1:e.tone,
      height:(e.height||0)*HS,lip:(e.lip||0)*HS,gloss:u(e.gloss),sharp:u(e.sharp),metal:u(e.metal),flake:u(e.flake),cover:u(e.cover)}}
  function compile(m){const rec=material(m),key=JSON.stringify(rec);let c=mcache.get(key);if(c)return c;
    const f=rec.flake||null,stain=rec.mode==='stain'||rec.mode==='glaze',d=(v,x)=>v===undefined?x:v;
    c={rec,col:parseColor(rec.color||'#808080'),col2:rec.color2?parseColor(rec.color2):null,blend:d(rec.blend,.5),a:d(rec.opacity,.95),
      thick:d(rec.body,.5),streak:d(rec.ridges,.15),jit:d(rec.grain,.04),level:d(rec.level,0),dry:d(rec.dry,.3),reach:rec.reach||0,wet:d(rec.charge,1.15),pick:d(rec.pickup,0),
      uneven:d(rec.uneven,stain?.5:.15),soft:d(rec.soft,stain?.9:.2),cushion:rec.cushion||null,
      P:{stain,film:d(rec.film,stain?0:1),bury:d(rec.bury,.5),rim:d(rec.rim,stain?.5:0),gran:d(rec.gran,stain?.3:0),spec:d(rec.gloss,.1),sharp:d(rec.sharp,.4),metal:d(rec.metal,0),open:d(rec.open,.2),
        water:d(rec.water,0),flow:d(rec.flow,rec.water>0?.6:0),merge:d(rec.merge,0),
        fAmt:f?d(f.amount,1):0,slot:f?flakeSlot(f):0,fx:rec.texture&&rec.texture.length?rec.texture.map(compileFx):null}};
    if(c.P.water>0)needWater();
    mcache.set(key,c);return c}
  // for raw stroke() calls that give engine options directly instead of a material
  function prep(o){const stain=o.mode==='stain'||o.mode==='glaze',d=(v,x)=>v===undefined?x:v;if(o.water>0)needWater();
    return{stain,film:d(o.film,stain?0:1),bury:d(o.bury,.5),rim:d(o.rim,stain?.5:0),gran:d(o.gran,stain?.3:0),spec:d(o.spec,.1),sharp:d(o.sharp,.4),metal:d(o.metal,0),open:d(o.open,.2),
      water:d(o.water,0),flow:d(o.flow,o.water>0?.6:0),merge:d(o.merge,0),
      fAmt:o.flake?d(o.flake.amount,1):0,slot:o.flake?flakeSlot(o.flake):0,fx:o.texture?o.texture.map(compileFx):null}}
  function fillTile(mc,ti){if(!mc.buf){mc.buf=new Uint8Array(N);mc.done=new Uint8Array(TW*TH)}
    const x0=(ti%TW)*TS,y0=((ti/TW)|0)*TS,x1=Math.min(W,x0+TS),y1=Math.min(H,y0+TS),fn=mc.fn,b=mc.buf;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const m=fn((x+.5)/S,(y+.5)/S);b[y*W+x]=m<=0?0:m>=1?255:(m*255+.5)|0}
    mc.done[ti]=1}

  /* ---------- one touch of paint arriving at one pixel ---------- */
  function put(k,r,g,b,h,a,e,P,cw){
    let sp=P.spec,rg=P.sharp,mt=P.metal,fa=P.fAmt;const fx=P.fx;
    if(fx){const x=k%W,y=(k-x)/W,ti=(y>>TSH)*TW+(x>>TSH);
      for(let i=0;i<fx.length;i++){const f=fx[i];let m;
        if(f.tooth)m=PAPER[k];else{const mc=f.mc;if(!mc.done||!mc.done[ti])fillTile(mc,ti);m=mc.buf[k]*.00392156862745098}
        if(f.inv)m=1-m;const mm=f.signed?m*2-1:m;
        if(f.col){const am=m*f.mix;r+=(f.col[0]-r)*am;g+=(f.col[1]-g)*am;b+=(f.col[2]-b)*am}
        if(f.tone!==1){const t=1+(f.tone-1)*mm;r*=t;g*=t;b*=t}
        if(f.height)h+=f.height*mm;if(f.lip)h+=f.lip*4*m*(1-m);
        if(f.gloss>=0)sp+=(f.gloss-sp)*m;if(f.sharp>=0)rg+=(f.sharp-rg)*m;if(f.metal>=0)mt+=(f.metal-mt)*m;if(f.flake>=0)fa+=(f.flake-fa)*m;
        if(f.cover>=0)a*=1+(f.cover-1)*m}
      if(a<=.003)return}
    if(P.stain){ // a transparent layer absorbs by its thickness: the recipe's colour at an amount of 1, deeper where more has gathered
      const wat=P.water>0;let rim=P.rim*e,wq=0;
      if(wat){wq=WQ[k];if(wq>0)rim*=wq>=.4?0:1-wq*2.5}   // nothing pools along an edge that lies in water: there it is not an edge
      const gr=a*(1+P.gran*(.5-PAPER[k])*2);let ga=gr+a*rim;if(ga>1.6)ga=1.6;if(ga<=0)return;const gf=ga>1?1:ga;
      const lr=Math.log(r<.004?.004:r>1?1:r),lg=Math.log(g<.004?.004:g>1?1:g),lb=Math.log(b<.004?.004:b>1?1:b);
      CR[k]*=Math.exp(ga*lr);CG[k]*=Math.exp(ga*lg);CB[k]*=Math.exp(ga*lb);WET[k]+=(P.open-WET[k])*gf;
      if(wat){const fl=(gr<ga?gr:ga)*P.flow;AQR[k]-=fl*lr;AQG[k]-=fl*lg;AQB[k]-=fl*lb;wq+=P.water*(cw>1?1:cw);WQ[k]=wq>2.5?2.5:wq}   // the share that stays afloat (what pooled at the edge has settled)
      const af=gf*P.film;if(af>0){HT[k]=HT[k]*(1-P.bury*af)+af*h;SP[k]+=(sp-SP[k])*af;RG[k]+=(rg-RG[k])*af;MT[k]+=(mt-MT[k])*af;FA[k]+=(fa-FA[k])*af;if(P.slot&&af>.25)FI[k]=P.slot}}
    else{if(a>1)a=1;
      if(P.merge>0){const t=WET[k]*P.merge;   // laid into wet paint it melts into it, as pigment, instead of lying on top
        if(t>.03){const dr=r-CR[k],dg=g-CG[k],db=b-CB[k];if(dr*dr+dg*dg+db*db>.0012){mix2(r,g,b,CR[k],CG[k],CB[k],t>.9?.9:t);r=RO[0];g=RO[1];b=RO[2]}}}
      CR[k]+=(r-CR[k])*a;CG[k]+=(g-CG[k])*a;CB[k]+=(b-CB[k])*a;WET[k]+=(P.open-WET[k])*a;
      if(P.water>0){let wq=WQ[k];const fl=a*P.flow,q=1-a;   // thinned with water, a share of it can float off as a wash
        AQR[k]=AQR[k]*q-fl*Math.log(r<.004?.004:r>1?1:r);AQG[k]=AQG[k]*q-fl*Math.log(g<.004?.004:g>1?1:g);AQB[k]=AQB[k]*q-fl*Math.log(b<.004?.004:b>1?1:b);wq+=P.water*(cw>1?1:cw);WQ[k]=wq>2.5?2.5:wq}
      HT[k]=HT[k]*(1-P.bury*a)+a*h;SP[k]+=(sp-SP[k])*a;RG[k]+=(rg-RG[k])*a;MT[k]+=(mt-MT[k])*a;FA[k]+=(fa-FA[k])*a;if(P.slot&&a>.25)FI[k]=P.slot}}

  /* ---------- the bristle brush ---------- */
  const STEP=.75,MAXP=30000,rx=new Float32Array(MAXP),ry=new Float32Array(MAXP),rnx=new Float32Array(MAXP),rny=new Float32Array(MAXP);
  const MAXB=700,bu=new Float32Array(MAXB),bR=new Float32Array(MAXB),bG=new Float32Array(MAXB),bBl=new Float32Array(MAXB),bL=new Float32Array(MAXB),bH=new Float32Array(MAXB),bS=new Float32Array(MAXB),bE=new Float32Array(MAXB),bPh=new Int32Array(MAXB),bN=new Uint8Array(MAXB),bR0=new Float32Array(MAXB),bG0=new Float32Array(MAXB),bB0=new Float32Array(MAXB);
  const NTAB=new Float32Array(1024);for(let i=0;i<1024;i++)NTAB[i]=vnoise(i/26,3.7);
  let nT=0,bx0=0,by0=0,bx1=0,by1=0;
  function resample(P,nib){let n=1,px=P[0][0]*S-.5,py=P[0][1]*S-.5,need=STEP;rx[0]=px;ry[0]=py;
    for(let i=1;i<P.length&&n<MAXP;i++){const qx=P[i][0]*S-.5,qy=P[i][1]*S-.5;let ax=px,ay=py,seg=Math.hypot(qx-ax,qy-ay);
      while(seg>=need&&n<MAXP){const f=need/seg;ax+=(qx-ax)*f;ay+=(qy-ay)*f;rx[n]=ax;ry[n]=ay;n++;seg-=need;need=STEP}
      need-=seg;px=qx;py=qy}
    if(nib!==undefined&&nib!==null){const nx=Math.cos(nib),ny=Math.sin(nib);for(let j=0;j<n;j++){rnx[j]=nx;rny[j]=ny}}
    else for(let j=0;j<n;j++){const a=j>2?j-3:0,b=j<n-3?j+3:n-1,dx=rx[b]-rx[a],dy=ry[b]-ry[a],l=Math.hypot(dx,dy)||1;rnx[j]=-dy/l;rny[j]=dx/l}
    return n}
  // lay the finished stroke (held in the scratch layer) onto the surface in one go
  function layDown(o){if(!nT)return;const P=o.P||prep(o),A=o.a===undefined?1:o.a,dry=o.dry===undefined?.3:o.dry,clip=o.clip||null,BL=o.blend>0;
    for(let i=0;i<nT;i++){const k=touched[i],ws=sW[k],inv=1/ws,Ld=sL[k]*inv;let cov=ws*1.15;if(cov>1)cov=1;let a=cov*A;
      if(dry>0){ // dry brush catches only on what stands proud: the tooth of the ground, or ridges of paint already there
        let tooth=PAPER[k];const t0=HT[k];if(t0>.02&&k>W2+2&&k<N-W2-2){tooth=.5+(tooth-.5)/(1+2.5*t0)+(t0-.25*(HT[k-2]+HT[k+2]+HT[k-W2]+HT[k+W2]))*1.2;tooth=tooth<0?0:tooth>1?1:tooth}
        const f=(Ld-(1-tooth)*dry)*3.5;if(f<1)a=f<=0?0:a*f*f*(3-2*f)}
      else if(Ld<.25)a*=Ld*4;
      if(clip&&a>0){const x=k%W,y=(k-x)/W,mx=x-clip.x0,my=y-clip.y0;a*=(mx>=0&&my>=0&&mx<clip.w&&my<clip.h)?clip.a[my*clip.w+mx]:0}
      if(BL){a*=WET[k];if(a>.004){ // a blending brush only moves what is still wet: it smears the colour and knocks down the ridges
          const r=sR[k]*inv,g=sG[k]*inv,b=sBl[k]*inv,dr=r-CR[k],dg=g-CG[k],db=b-CB[k];
          if(dr*dr+dg*dg+db*db>.0006){mix2(CR[k],CG[k],CB[k],r,g,b,a>.95?.95:a);CR[k]=RO[0];CG[k]=RO[1];CB[k]=RO[2]}
          if(k>W2+2&&k<N-W2-2)HT[k]+=(.25*(HT[k-2]+HT[k+2]+HT[k-W2]+HT[k+W2])-HT[k])*a*.3}}
      else if(a>0)put(k,sR[k]*inv,sG[k]*inv,sBl[k]*inv,sH[k]*inv,a,smooth((sU[k]*inv-.6)/.4),P,A>0?a/A:0);
      sW[k]=0;sR[k]=0;sG[k]=0;sBl[k]=0;sL[k]=0;sH[k]=0;sU[k]=0}
    markDirty(bx0,by0,bx1+1,by1+1);if(P.water>0&&!BL)markWet(bx0,by0,bx1+1,by1+1);nT=0}
  /* stroke(points, o) — the low-level call. Engine options (paint() fills these in from a material + brush):
     w width · col/col2 colours on the brush · grad/gradN how the two spread across the bristles · prof pressure · flat
     a opacity · thick relief · level how flat the paint settles · streak/jit tone variation · dry dry-brush · load reach
     pick wet pick-up · mode 'stain' · spec/sharp gloss · metal · flake{} · texture[] · clip mask · nib fixed pen angle */
  function stroke(P,o){const rnd=sub();
    if(!P||P.length<2)return;
    let src=P;if(o.spline!==false&&P.length>2&&P.length<40)src=spline(P,o.seg||8);
    const n=resample(src,o.nib);if(n<2)return;
    const d=(v,x)=>v===undefined?x:v;
    const w=Math.max(.7,o.w*S),len=(n-1)*STEP,prof=profile(o.prof),flat=!!o.flat,press=d(o.press,1);
    const nb=Math.min(MAXB,Math.max(1,Math.round(w)));
    const c1=parseColor(o.col||'#808080'),c2=o.col2?parseColor(o.col2):c1,two=!!o.col2,RA=two?ramp(c1,c2):null,jit=d(o.jit,.05),streak=d(o.streak,.1),grad=d(o.grad,0),gradN=d(o.gradN,.5);
    const thick=d(o.thick,.5),edge=d(o.edge,0),taperH=d(o.taperH,.72),vary=d(o.vary,.1),hv=1-clamp(d(o.level,0),0,1),wet=d(o.wet,1.15),invLoad=o.load?1/(o.load*S):0,pick=o.pick?1-Math.pow(1-clamp(o.pick,0,.95),4*STEP/S):0,rag=d(o.rag,0)*S,gaps=d(o.gaps,0);
    const cfreq=Math.max(1.2,w/(d(o.clump,3)*S)),su=rnd()*999,sv=rnd()*999,varA=d(o.var,0),wob=d(o.wob,0)*S,tone2=d(o.tone2,0);
    const ffreq=w/3.3,sf2=rnd()*999,kkn=26/(d(o.varLen,9)*S),blend=d(o.blend,0)>0;
    for(let i=0;i<nb;i++){const u=nb>1?((i+.5+(rnd()-.5)*.3)/nb)*2-1:0,uu=u*.5+.5,cl=vnoise(su+uu*cfreq,7.7),fn=vnoise(sf2+uu*ffreq,2.2),tone=1+(cl-.5)*2*streak+(fn-.5)*2*jit;
      const cm=two?rampAt(RA,.5+.5*u*grad+(cl-.5)*2*gradN):c1,au=u<0?-u:u;
      bu[i]=u;bR[i]=bR0[i]=cm[0]*tone;bG[i]=bG0[i]=cm[1]*tone;bBl[i]=bB0[i]=cm[2]*tone;
      bL[i]=(gaps>0&&vnoise(sf2+uu*cfreq*1.7,9.9)<gaps)?0:wet*(.72+.56*cl)*(.85+.3*rnd());
      bH[i]=thick*(1-hv+hv*(.45+1.1*cl+(fn-.5)*.4))*(1-taperH*smooth((au-.5)/.5))+edge*thick*Math.exp(-Math.pow((au-.84)/.1,2));
      bPh[i]=(vnoise(sf2+uu*cfreq*.8,5.1)*900)|0;bS[i]=rag*rnd();bE[i]=len-rag*rnd();bN[i]=blend?1:0}
    let x0=1e9,y0=1e9,x1=-1,y1=-1,pnx=rnx[0],pny=rny[0],pcx=rx[0],pcy=ry[0];nT=0;
    for(let j=0;j<n;j++){const t=j/(n-1);let p=prof(t)*press;if(varA)p*=1+varA*(vnoise(su+j*STEP/(9*S),3.3)-.5)*2;if(!(p>.012)){pnx=rnx[j];pny=rny[j];pcx=rx[j];pcy=ry[j];continue}if(p>1)p=1;
      const dist=j*STEP,hw=flat?w*.5:Math.max(.3,w*.5*p),pa=flat?p:(p*4>1?1:p*4),dl=dist*invLoad,tt=tone2?1+tone2*(t-.35):1,di=(dist*kkn)|0,hp=.35+.65*p;
      let ex=rx[j],ey=ry[j];const enx=rnx[j],eny=rny[j];
      if(wob){const wv=(vnoise(sv+dist/(14*S),8.1)-.5)*2*wob;ex+=enx*wv;ey+=eny*wv}
      const turn=j?Math.hypot(enx-pnx,eny-pny)*hw:0,sub=turn>.9?Math.min(8,Math.ceil(turn/.9)):1;
      for(let q=1;q<=sub;q++){let nx=enx,ny=eny,cx=ex,cy=ey;
        if(sub>1){const f=q/sub;nx=pnx+(enx-pnx)*f;ny=pny+(eny-pny)*f;const nl=1/(Math.hypot(nx,ny)||1);nx*=nl;ny*=nl;cx=pcx+(ex-pcx)*f;cy=pcy+(ey-pcy)*f}
      for(let i=0;i<nb;i++){if(dist<bS[i]||dist>bE[i])continue;let Ld=bL[i]-dl;if(Ld<=0)continue;if(Ld>1)Ld=1;
        const u=bu[i],x=cx+nx*u*hw,y=cy+ny*u*hw;if(x<0||y<0)continue;const ix=x|0,iy=y|0;if(ix>=W-1||iy>=H-1)continue;
        const k=iy*W+ix;
        if(bN[i]){bN[i]=0;bR[i]=CR[k];bG[i]=CG[k];bBl[i]=CB[k]}   // a blending brush starts with whatever it first touches
        if(pick>0&&q===sub&&((j+i)&3)===0){const pk=pick*WET[k];if(pk>.002){mix2(bR[i],bG[i],bBl[i],CR[k],CG[k],CB[k],pk);bR[i]=RO[0];bG[i]=RO[1];bBl[i]=RO[2]}   // every fourth step, four steps' worth
          if(!blend){const rf=.07*Ld;bR[i]+=(bR0[i]-bR[i])*rf;bG[i]+=(bG0[i]-bG[i])*rf;bBl[i]+=(bB0[i]-bBl[i])*rf}}   // clean paint keeps coming down a loaded brush
        const md=NTAB[(di+bPh[i])&1023],tv=tt*(1+(md-.5)*2*vary),fx=x-ix,fy=y-iy,r=bR[i]*tv,g=bG[i]*tv,b=bBl[i]*tv,hh=bH[i]*(.5+.5*Ld)*hp*(1-hv*.4+hv*.8*md),au=u<0?-u:u;
        let wt=(1-fx)*(1-fy)*pa,kk=k;
        if(wt>0){if(sW[kk]===0)touched[nT++]=kk;sW[kk]+=wt;sR[kk]+=wt*r;sG[kk]+=wt*g;sBl[kk]+=wt*b;sL[kk]+=wt*Ld;sH[kk]+=wt*hh;sU[kk]+=wt*au}
        wt=fx*(1-fy)*pa;kk=k+1;
        if(wt>0){if(sW[kk]===0)touched[nT++]=kk;sW[kk]+=wt;sR[kk]+=wt*r;sG[kk]+=wt*g;sBl[kk]+=wt*b;sL[kk]+=wt*Ld;sH[kk]+=wt*hh;sU[kk]+=wt*au}
        wt=(1-fx)*fy*pa;kk=k+W;
        if(wt>0){if(sW[kk]===0)touched[nT++]=kk;sW[kk]+=wt;sR[kk]+=wt*r;sG[kk]+=wt*g;sBl[kk]+=wt*b;sL[kk]+=wt*Ld;sH[kk]+=wt*hh;sU[kk]+=wt*au}
        wt=fx*fy*pa;kk=k+W+1;
        if(wt>0){if(sW[kk]===0)touched[nT++]=kk;sW[kk]+=wt;sR[kk]+=wt*r;sG[kk]+=wt*g;sBl[kk]+=wt*b;sL[kk]+=wt*Ld;sH[kk]+=wt*hh;sU[kk]+=wt*au}
        if(ix<x0)x0=ix;if(ix>x1)x1=ix;if(iy<y0)y0=iy;if(iy>y1)y1=iy}}
      pnx=enx;pny=eny;pcx=ex;pcy=ey}
    bx0=x0;by0=y0;bx1=x1;by1=y1;layDown(o)}

  /* ---------- spray: droplets thrown round the path (airbrush, spray can, spatter) ---------- */
  function drop(x,y,rd,r,g,b,hh,wt0){
    if(rd<1.05){if(x<0||y<0)return;const ix=x|0,iy=y|0;if(ix>=W-1||iy>=H-1)return;const fx=x-ix,fy=y-iy,q=wt0*Math.max(.18,Math.PI*rd*rd),k=iy*W+ix;
      for(let t=0;t<4;t++){const kk=k+(t&1)+(t>>1)*W,wt=((t&1)?fx:1-fx)*((t>>1)?fy:1-fy)*q;if(wt>0){if(sW[kk]===0)touched[nT++]=kk;sW[kk]+=wt;sR[kk]+=wt*r;sG[kk]+=wt*g;sBl[kk]+=wt*b;sL[kk]+=wt;sH[kk]+=wt*hh}}
      if(ix<bx0)bx0=ix;if(ix+1>bx1)bx1=ix+1;if(iy<by0)by0=iy;if(iy+1>by1)by1=iy+1;return}
    const xa=Math.max(0,Math.floor(x-rd-1)),xb=Math.min(W-1,Math.ceil(x+rd+1)),ya=Math.max(0,Math.floor(y-rd-1)),yb=Math.min(H-1,Math.ceil(y+rd+1));
    for(let py=ya;py<=yb;py++)for(let px=xa;px<=xb;px++){const dd=Math.hypot(px-x,py-y);let wt=rd-dd+.5;if(wt<=0)continue;if(wt>1)wt=1;wt*=wt0;const kk=py*W+px,q2=dd/rd;
      if(sW[kk]===0)touched[nT++]=kk;sW[kk]+=wt;sR[kk]+=wt*r;sG[kk]+=wt*g;sBl[kk]+=wt*b;sL[kk]+=wt;sH[kk]+=wt*hh*Math.sqrt(q2<1?1-q2*q2:0)}
    if(xa<bx0)bx0=xa;if(xb>bx1)bx1=xb;if(ya<by0)by0=ya;if(yb>by1)by1=yb}
  function spray(P,o){const rnd=sub();if(!P||!P.length)return;let n;
    if(P.length===1){ // a single point is a puff held in place: as much paint as the cloud is wide
      n=Math.min(MAXP,Math.max(2,Math.round(o.w*S*.6/STEP)));const px=P[0][0]*S-.5,py=P[0][1]*S-.5;for(let j=0;j<n;j++){rx[j]=px;ry[j]=py}}
    else{let src=P;if(o.spline!==false&&P.length>2&&P.length<40)src=spline(P,o.seg||8);n=resample(src)}
    const d=(v,x)=>v===undefined?x:v,rad=Math.max(1,o.w*.5*S),dens=d(o.density,1.2),d0=(o.drop?o.drop[0]:.3)*S,d1=(o.drop?o.drop[1]:.8)*S,prof=profile(o.prof||'full');
    const c1=parseColor(o.col||'#808080'),RA=o.col2?ramp(c1,parseColor(o.col2)):null,jit=d(o.jit,.05),thick=d(o.thick,.1);let acc=rnd();nT=0;bx0=1e9;by0=1e9;bx1=-1;by1=-1;
    for(let j=0;j<n;j++){const p=prof(n>1?j/(n-1):.5);if(!(p>.01))continue;acc+=dens*rad*STEP*p/(S*S);
      while(acc>=1){acc--;const x=rx[j]+(rnd()+rnd()+rnd()-1.5)*.82*rad,y=ry[j]+(rnd()+rnd()+rnd()-1.5)*.82*rad,rd=d0+(d1-d0)*rnd()*rnd(),cm=RA?rampAt(RA,rnd()):c1,tone=1+(rnd()-.5)*2*jit;
        drop(x,y,rd,cm[0]*tone,cm[1]*tone,cm[2]*tone,thick*(.6+.8*rnd()),1)}}
    layDown(Object.assign({},o,{dry:0}))}

  /* ---------- painting with a material and a brush ---------- */
  function paint(cmd){const M=compile(cmd.material||'gouache'),B=brushOf(cmd.brush||'round'),d=(v,x)=>v===undefined?x:v;
    const o={w:d(cmd.width,d(B.width,10)),col:cmd.color?parseColor(cmd.color):M.col,col2:cmd.color2?parseColor(cmd.color2):(cmd.color?null:M.col2),gradN:M.blend,grad:d(cmd.grad,0),
      prof:d(cmd.pressure,d(B.profile,'taper')),flat:B.shape==='flat',press:cmd.press,a:d(cmd.opacity,M.a)*d(B.opacity,1),
      thick:M.thick*d(B.body,1),level:clamp(M.level+d(B.level,0),0,1),taperH:d(B.taper,.72),edge:d(B.edge,0),
      streak:M.streak*d(B.streak,1),jit:M.jit*d(B.jit,1),clump:d(B.clump,3),vary:d(B.vary,.1),
      dry:clamp(M.dry+d(B.dry,0)*Math.max(0,1-M.dry),0,1.3),load:d(cmd.load,M.reach?Math.min(d(B.load,1e9),M.reach*d(B.reach,1)):0),wet:M.wet*d(B.charge,1),pick:M.pick*d(B.pickup,1),varLen:B.varLen,
      rag:d(B.rag,0),wob:d(cmd.wobble,d(B.wobble,0)),var:d(B.var,0),gaps:d(B.gaps,0),nib:B.nib,tone2:cmd.tone2,clip:cmd.clip,spline:cmd.spline,seg:cmd.seg,
      density:B.density,drop:B.drop,P:B.bury===undefined?M.P:Object.assign({},M.P,{bury:B.bury})};
    if(B.blend>0){o.blend=B.blend;o.a=d(cmd.opacity,B.blend);o.pick=d(B.pickup,.12);o.col=[.5,.5,.5];o.col2=null;o.vary=0;o.streak=0;o.jit=0;o.dry=0;o.load=0;o.wet=1.15}
    if(cmd.opts)Object.assign(o,cmd.opts);
    if(B.kind==='spray')spray(cmd.path,o);else stroke(cmd.path,o)}

  /* ---------- laying a material over a whole shape: washes, flat colour, leaf on a raised cushion ---------- */
  function polyMask(polys,pad){let b={x0:1e9,y0:1e9,x1:-1e9,y1:-1e9};pad=pad===undefined?3:pad;for(const p of polys){const c=bbox(p);b.x0=Math.min(b.x0,c.x0);b.y0=Math.min(b.y0,c.y0);b.x1=Math.max(b.x1,c.x1);b.y1=Math.max(b.y1,c.y1)}
    const x0=Math.max(0,Math.floor(b.x0*S-pad)),y0=Math.max(0,Math.floor(b.y0*S-pad)),x1=Math.min(W,Math.ceil(b.x1*S+pad)),y1=Math.min(H,Math.ceil(b.y1*S+pad)),w=x1-x0,h=y1-y0;
    return w>0&&h>0?{x0,y0,w,h,a:rasterize(polys,S,x0,y0,w,h)}:null}
  function fill(cmd){const M=compile(cmd.material||'gouache'),P=M.P,d=(v,x)=>v===undefined?x:v,polys=typeof cmd.shape[0][0]==='number'?[cmd.shape]:cmd.shape;
    const soft=d(cmd.soft,M.soft)*S,cu=cmd.cushion===undefined?M.cushion:cmd.cushion,cuR=cu?d(cu.round,2)*S:0,m=polyMask(polys,Math.ceil(Math.max(soft,cuR)*3)+4);if(!m)return;
    let dm=null;if(cu){dm={a:new Float32Array(m.a),w:m.w,h:m.h};blurMask(dm,cuR)}
    if(soft>=.5)blurMask(m,soft);
    const A=d(cmd.opacity,M.a),un=d(cmd.uneven,M.uneven),sc=d(cmd.scale,50),sx=rnd()*300,c1=cmd.color?parseColor(cmd.color):M.col,c2=cmd.color2?parseColor(cmd.color2):cmd.color?null:M.col2,RA=c2?ramp(c1,c2):null,bl=M.blend,hG=cu?d(cu.height,3)*HS:0,dryF=M.dry,LdF=Math.min(1,M.wet),
      ang=d(cmd.angle,-.2),ca=Math.cos(ang),sa=Math.sin(ang),hv=1-clamp(M.level,0,1),rdg=P.stain?0:M.streak,sy=rnd()*300;
    const clip=cmd.clip||null;
    for(let j=0;j<m.h;j++)for(let i=0;i<m.w;i++){let mv=m.a[j*m.w+i];if(clip&&mv>0){const mx=m.x0+i-clip.x0,my=m.y0+j-clip.y0;mv*=(mx>=0&&my>=0&&mx<clip.w&&my<clip.h)?clip.a[my*clip.w+mx]:0}
      if(mv<.004)continue;const x=m.x0+i,y=m.y0+j,k=y*W+x,xd=x/S,yd=y/S,nz=fbm(xd/sc+sx,yd/sc,3);
      let r=c1[0],g=c1[1],b=c1[2],a,e=0,st=.5;
      if(!P.stain){const u=xd*ca+yd*sa,v=yd*ca-xd*sa+(vnoise(u/70+sy,(yd*ca-xd*sa)/45)-.5)*9;st=vnoise(u/34+sy,v/1.7)*.6+vnoise(u/13+sy+40,v/.75)*.4}
      if(c2){const cm=rampAt(RA,.5+(fbm(xd/(sc*.3)+sx+50,yd/(sc*.3),3)-.5)*1.2*bl+(st-.5)*1.5*bl);r=cm[0];g=cm[1];b=cm[2]}
      if(P.stain){a=mv*A*(1-un*.5+un*nz);e=4*mv*(1-mv)}else{a=mv*A;if(dryF>.7){const f=(LdF-(1-PAPER[k])*dryF)*3.5;if(f<1)a=f<=0?0:a*f*f*(3-2*f)}const tn=1+un*(nz-.5)*.6+(st-.5)*rdg*1.3;r*=tn;g*=tn;b*=tn}
      put(k,r,g,b,M.thick*(1-hv+hv*(.45+1.1*st))*(.9+.1*vnoise(xd/1.3+sx,yd/1.3)+.1*vnoise((xd*.8+yd*.6)/2.3+sx,(yd*.8-xd*.6)/2.3))+(dm?hG*smooth((dm.a[j*m.w+i]-.2)/.7):0),a,e,P,mv)}
    markDirty(m.x0,m.y0,m.x0+m.w,m.y0+m.h);if(P.water>0)markWet(m.x0,m.y0,m.x0+m.w,m.y0+m.h)}
  function dot(cmd){const M=compile(cmd.material||'gouache'),P=M.P,d=(v,x)=>v===undefined?x:v,c=cmd.color?parseColor(cmd.color):M.col,x=cmd.at[0]*S-.5,y=cmd.at[1]*S-.5,r=cmd.r*S,A=d(cmd.opacity,M.a),soft=Math.max(.9,d(cmd.soft,.12)*r),dome=d(cmd.dome,0)*HS;
    const x0=Math.max(0,Math.floor(x-r-2)),x1=Math.min(W-1,Math.ceil(x+r+2)),y0=Math.max(0,Math.floor(y-r-2)),y1=Math.min(H-1,Math.ceil(y+r+2));
    for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){const dd=Math.hypot(px-x,py-y);let a=(r-dd)/soft+.5;if(a<=0)continue;if(a>1)a=1;const q2=dd/r;
      put(py*W+px,c[0],c[1],c[2],M.thick+dome*Math.sqrt(q2<1?1-q2*q2:0),a*A,0,P,a)}
    markDirty(x0,y0,x1,y1);if(P.water>0)markWet(x0,y0,x1,y1)}

  /* ---------- flow: what happens to a wash while it is wet ----------
     Water levels out and carries floating pigment with it; pigment spreads through the water and slowly settles; the water dries
     away and whatever still floats stays where it is. All of this happens only where there is water, so a wash on dry paper keeps
     its edge and a wash on wet paper blooms. It runs on a coarse grid (cells about 2 units wide), which lets colour travel far
     cheaply; afterwards every pixel keeps the share of its own floating pigment that did not leave, and receives what arrived. */
  const CS=Math.max(2,Math.round(2*S)),CW=Math.ceil(W/CS)+2,CH=Math.ceil(H/CS)+2,CN=CW*CH,FLOW_STEPS=120;
  let fc=null;
  function flow(amount,toDry){if(!anyWater)return 0;
    if(!fc){fc={act:new Int32Array(CN)};for(const n of['h','h0','f','g','p0','p1','p2','q0','q1','q2','x0','x1','x2','u','s','dv','d0','d1','d2','out','st','g0','g1','g2','af','hr','ev'])fc[n]=new Float32Array(CN)}
    const{act,h,h0,f,g,p0,p1,p2,q0,q1,q2,x0,x1,x2,u,s:sd,dv,d0,d1,d2,out,st,g0,g1,g2,af,hr,ev}=fc,ncx=Math.ceil(W/CS),ncy=Math.ceil(H/CS);let na=0,hmax=0;
    // 1. gather the wet pixels into cells: water depth, how much of the cell is wet, pigment afloat
    for(let cy=0;cy<ncy;cy++){const ya=cy*CS,yb=Math.min(H,ya+CS),ta=(ya>>TSH)*TW,tb=((yb-1)>>TSH)*TW;
      for(let cx=0;cx<ncx;cx++){const xa=cx*CS,xb=Math.min(W,xa+CS),ua=xa>>TSH,ub=(xb-1)>>TSH,ci=(cy+1)*CW+cx+1;h[ci]=0;f[ci]=0;
        if(!(wetTile[ta+ua]|wetTile[ta+ub]|wetTile[tb+ua]|wetTile[tb+ub]))continue;
        let sw=0,n=0,a0=0,a1=0,a2=0;
        for(let y=ya;y<yb;y++){let k=y*W+xa;for(let x=xa;x<xb;x++,k++){const w=WQ[k];if(w>.004){n++;sw+=w;a0+=AQR[k];a1+=AQG[k];a2+=AQB[k]}}}
        if(!n)continue;const ic=1/((xb-xa)*(yb-ya)),ff=n*ic,hh=sw/n;
        f[ci]=ff;h[ci]=h0[ci]=hh;p0[ci]=q0[ci]=a0*ic;p1[ci]=q1[ci]=a1*ic;p2[ci]=q2[ci]=a2*ic;x0[ci]=0;x1[ci]=0;x2[ci]=0;u[ci]=1;sd[ci]=0;
        g[ci]=smooth((ff-.3)/.4)*clamp(.3+1.1*(vnoise(cx/6+SEED,cy/6+7)*.6+vnoise(cx/2.2+3,cy/2.2+SEED)*.3+hash(cx+31,cy+17)*.1),.2,1.1);   // paper does not wick evenly
        act[na++]=ci;if(hh>hmax)hmax=hh}}
    if(!na){noWater();return 0}
    // 2. let time pass. On every other step a cell trades not with its neighbours but with the cells three away (if the way there
    //    is wet), which lets water and colour travel far in few steps. Water at the rim of a wash dries faster, and that draws
    //    pigment to the edge.
    const kk=Math.min(1.2,4*S*S/(CS*CS)),K1=.14*kk,K3=.2*kk,D1=.08*kk,D3=.11*kk,EV=1/FLOW_STEPS,SET=.005;
    for(let i=0;i<na;i++){const ci=act[i],nb=(h[ci-1]>0)+(h[ci+1]>0)+(h[ci-CW]>0)+(h[ci+CW]>0);ev[ci]=EV*(1+.35*(4-nb)+1.2*(1-f[ci]))}
    const steps=toDry?Math.min(3*FLOW_STEPS,Math.ceil(hmax/EV)+1):Math.max(1,Math.round(amount*FLOW_STEPS));
    for(let t=0;t<steps;t++){const far=t&1,kw=far?K3:K1,kd=far?D3:D1;
      for(let i=0;i<na;i++){const ci=act[i];dv[ci]=0;d0[ci]=0;d1[ci]=0;d2[ci]=0;out[ci]=0}
      for(let i=0;i<na;i++){const ci=act[i],hi=h[ci];if(!(hi>0))continue;const fi=f[ci],gi=g[ci],ii=1/fi;
        for(let e=0;e<2;e++){let cj,gk=gi;const o=e?CW:1;
          if(far){const m1=ci+o,m2=m1+o;if(!(h[m1]>0&&h[m2]>0))continue;cj=m2+o;if(g[m1]<gk)gk=g[m1];if(g[m2]<gk)gk=g[m2]}else cj=ci+o;
          const hj=h[cj];if(!(hj>0))continue;if(g[cj]<gk)gk=g[cj];const fj=f[cj],fm=fi<fj?fi:fj,hm=hi<hj?hi:hj;
          if(hm<1)gk*=hm*Math.sqrt(hm);if(gk<=0)continue;                                 // the thinner the film, the less it moves
          const fw=kw*gk*fm*(hi-hj);dv[ci]-=fw;dv[cj]+=fw;                               // water runs to where there is less
          if(p0[ci]+p1[ci]+p2[ci]+p0[cj]+p1[cj]+p2[cj]<1e-7)continue;
          if(fw>0){const fr=fw*ii/hi,ct=hj<.6?1-hj*1.6667:0,ps=1-ct;let m=p0[ci]*fr;d0[ci]-=m;d0[cj]+=m*ps;x0[cj]+=m*ct;m=p1[ci]*fr;d1[ci]-=m;d1[cj]+=m*ps;x1[cj]+=m*ct;m=p2[ci]*fr;d2[ci]-=m;d2[cj]+=m*ps;x2[cj]+=m*ct;out[ci]+=fr}   // and takes pigment along;
          else if(fw<0){const fr=-fw/(hj*fj),ct=hi<.6?1-hi*1.6667:0,ps=1-ct;let m=p0[cj]*fr;d0[cj]-=m;d0[ci]+=m*ps;x0[ci]+=m*ct;m=p1[cj]*fr;d1[cj]-=m;d1[ci]+=m*ps;x1[ci]+=m*ct;m=p2[cj]*fr;d2[cj]-=m;d2[ci]+=m*ps;x2[ci]+=m*ct;out[cj]+=fr}   // damp paper catches it, the water goes on
          const dd=kd*gk*fm,ij=1/fj;let m=dd*(p0[ci]*ii-p0[cj]*ij);d0[ci]-=m;d0[cj]+=m;m=dd*(p1[ci]*ii-p1[cj]*ij);d1[ci]-=m;d1[cj]+=m;m=dd*(p2[ci]*ii-p2[cj]*ij);d2[ci]-=m;d2[cj]+=m;
          out[ci]+=dd*ii;out[cj]+=dd*ij}}                                                // pigment also spreads through the water
      for(let i=0;i<na;i++){const ci=act[i];let hi=h[ci];if(!(hi>0))continue;hi=(hi*f[ci]+dv[ci])/f[ci]-ev[ci];
        let a0=p0[ci]+d0[ci],a1=p1[ci]+d1[ci],a2=p2[ci]+d2[ci];if(a0<0)a0=0;if(a1<0)a1=0;if(a2<0)a2=0;
        let o=out[ci];if(o>1)o=1;let uu=u[ci]*(1-o);
        if(hi<=0){hi=0;x0[ci]+=a0;x1[ci]+=a1;x2[ci]+=a2;a0=0;a1=0;a2=0;sd[ci]+=uu;uu=0}          // dry: everything stays here
        else{const sg=SET*(hi<.3?7-20*hi:1);x0[ci]+=a0*sg;x1[ci]+=a1*sg;x2[ci]+=a2*sg;a0-=a0*sg;a1-=a1*sg;a2-=a2*sg;sd[ci]+=uu*sg;uu-=uu*sg}   // some settles, more as it thins
        h[ci]=hi;p0[ci]=a0;p1[ci]=a1;p2[ci]=a2;u[ci]=uu}}
    // 3. per cell: the share of its own pigment that stayed, what arrived (per wet area), the share still afloat, the water left
    for(let i=0;i<na;i++){const ci=act[i],ii=1/f[ci],sy=Math.min(1,u[ci]+sd[ci]),t0=p0[ci]+x0[ci],t1=p1[ci]+x1[ci],t2=p2[ci]+x2[ci],tt=t0+t1+t2;
      st[ci]=sy;let v=(t0-q0[ci]*sy)*ii;g0[ci]=v>0?v:0;v=(t1-q1[ci]*sy)*ii;g1[ci]=v>0?v:0;v=(t2-q2[ci]*sy)*ii;g2[ci]=v>0?v:0;
      af[ci]=tt>1e-9?(p0[ci]+p1[ci]+p2[ci])/tt:0;hr[ci]=h[ci]/h0[ci]}
    // 4. back to the pixels, wet ones only. The paper's fibres feather what the grid computed, and arriving pigment gathers in its hollows
    const iCS=1/CS;
    for(let cy=0;cy<ncy;cy++){const ya=cy*CS,yb=Math.min(H,ya+CS);
      for(let cx=0;cx<ncx;cx++){if(!(f[(cy+1)*CW+cx+1]>0))continue;const xa=cx*CS,xb=Math.min(W,xa+CS);
        for(let y=ya;y<yb;y++){let k=y*W+xa;for(let x=xa;x<xb;x++,k++){const w=WQ[k];if(!(w>.004))continue;
          const ub=(x+.5)*iCS+.5,vb=(y+.5)*iCS+.5,xd=x/S,yd=y/S;   // cell centres sit at whole numbers (+1 for the border)
          let uu=ub+(vnoise(xd/5+SEED,yd/5)-.5)*2+(vnoise(xd/1.3+9,yd/1.3+SEED)-.5)*1.1+(hash(x,y)-.5)*.4,vv=vb+(vnoise(xd/5+40,yd/5+SEED)-.5)*2+(vnoise(xd/1.3+SEED,yd/1.3+70)-.5)*1.1+(hash(x+13,y+7)-.5)*.4;
          if(uu<0)uu=0;else if(uu>CW-1.001)uu=CW-1.001;if(vv<0)vv=0;else if(vv>CH-1.001)vv=CH-1.001;
          let iu=uu|0,iv=vv|0,fx=uu-iu,fy=vv-iv,c0=iv*CW+iu,wa=(1-fx)*(1-fy)*f[c0],wb=fx*(1-fy)*f[c0+1],wc=(1-fx)*fy*f[c0+CW],wd=fx*fy*f[c0+CW+1],ws=wa+wb+wc+wd;
          if(!(ws>0)){iu=ub|0;iv=vb|0;fx=ub-iu;fy=vb-iv;c0=iv*CW+iu;wa=(1-fx)*(1-fy)*f[c0];wb=fx*(1-fy)*f[c0+1];wc=(1-fx)*fy*f[c0+CW];wd=fx*fy*f[c0+CW+1];ws=wa+wb+wc+wd;if(!(ws>0))continue}
          const iw=1/ws,c1=c0+1,c2=c0+CW,c3=c2+1,sy=(wa*st[c0]+wb*st[c1]+wc*st[c2]+wd*st[c3])*iw,fa=(wa*af[c0]+wb*af[c1]+wc*af[c2]+wd*af[c3])*iw,hh=(wa*hr[c0]+wb*hr[c1]+wc*hr[c2]+wd*hr[c3])*iw,
            gm=(w>=.25?1:w*4)*(1+.7*(.5-PAPER[k]))*iw;
          let o=AQR[k],n=o*sy+(wa*g0[c0]+wb*g0[c1]+wc*g0[c2]+wd*g0[c3])*gm,dl=n-o;if(dl>1e-4||dl<-1e-4)CR[k]*=Math.exp(-dl);AQR[k]=n*fa;
          o=AQG[k];n=o*sy+(wa*g1[c0]+wb*g1[c1]+wc*g1[c2]+wd*g1[c3])*gm;dl=n-o;if(dl>1e-4||dl<-1e-4)CG[k]*=Math.exp(-dl);AQG[k]=n*fa;
          o=AQB[k];n=o*sy+(wa*g2[c0]+wb*g2[c1]+wc*g2[c2]+wd*g2[c3])*gm;dl=n-o;if(dl>1e-4||dl<-1e-4)CB[k]*=Math.exp(-dl);AQB[k]=n*fa;
          WQ[k]=w*hh}}}}
    for(let i=0;i<wetTile.length;i++)if(wetTile[i])dirty[i]=1;
    if(toDry)noWater();
    return steps}

  /* ---------- lighting: photograph the relief ----------
     One raking lamp plus a soft overhead light by default. A set-up may have up to four lamps, each with its own direction,
     strength and colour; a lamp may be `ambient` (light from everywhere: it shows colour but no relief) and may throw a `pool`
     of light that falls off with distance. `exposure` scales the result and `shoulder` rolls the highlights off instead of clipping. */
  const LT0={azimuth:230,elevation:30,relief:1.15,contrast:.5,cavity:.08,shadow:.2,softbox:.35,cockle:1,exposure:1,shoulder:0,lamps:null,lens:null},LT=Object.assign({},LT0);
  const LMAX=4,LA=()=>new Float32Array(LMAX),LXa=LA(),LYa=LA(),LZa=LA(),HXa=LA(),HYa=LA(),HZa=LA(),EXa=LA(),EYa=LA(),EZa=LA(),LW=LA(),LCR=LA(),LCG=LA(),LCB=LA(),LPX=LA(),LPY=LA(),LPI=LA(),
    LAM=new Uint8Array(LMAX),TO=new Int32Array(LMAX*5),TD=new Float32Array(LMAX*5);let NL=1;
  function setLight(cfg){
    if(typeof cfg==='string'||(cfg&&cfg.base!==undefined))Object.assign(LT,LT0,resolveIn(LIGHTS,'light',cfg));     // a named set-up replaces everything
    else if(cfg){Object.assign(LT,cfg);                                                                              // single values adjust what is there
      if(cfg.lamps===undefined&&LT.lamps&&LT.lamps.length&&(cfg.azimuth!==undefined||cfg.elevation!==undefined)){     // azimuth and elevation move the main lamp
        const kI=LT.lamps.findIndex(l=>!l.ambient);if(kI>=0)LT.lamps=LT.lamps.map((l,i)=>i===kI?Object.assign({},l,{azimuth:LT.azimuth,elevation:LT.elevation}):l)}}
    const lamps=LT.lamps&&LT.lamps.length?LT.lamps.slice(0,LMAX):[{azimuth:LT.azimuth,elevation:LT.elevation}],dv=(v,x)=>v===undefined?x:v;NL=lamps.length;
    lamps.forEach((lp,l)=>{const az=dv(lp.azimuth,230)*Math.PI/180,el=clamp(dv(lp.elevation,30),3,89)*Math.PI/180,c=lp.color?parseColor(lp.color):[1,1,1];
      LW[l]=dv(lp.strength,1);LCR[l]=c[0];LCG[l]=c[1];LCB[l]=c[2];LAM[l]=lp.ambient?1:0;
      if(lp.pool){const at=lp.pool.at||[.5,.5],rad=Math.max(.02,dv(lp.pool.radius,.6))*W;LPX[l]=at[0]*W;LPY[l]=at[1]*H;LPI[l]=1/(rad*rad)}else LPI[l]=0;
      const LX=Math.cos(az)*Math.cos(el),LY=Math.sin(az)*Math.cos(el),LZ=Math.sin(el);LXa[l]=LX;LYa[l]=LY;LZa[l]=LZ;
      let x=LX,y=LY,z=LZ+1,q=Math.hypot(x,y,z);const HX=x/q,HY=y/q,HZ=z/q;HXa[l]=HX;HYa[l]=HY;HZa[l]=HZ;
      x=HX*.6;y=HY*.6;z=HZ*.6+.4;q=Math.hypot(x,y,z);EXa[l]=x/q;EYa[l]=y/q;EZa[l]=z/q;
      const l2=Math.hypot(LX,LY)||1,slope=Math.tan(el)*.78;[1.5,3,5,7.5,10.5].forEach((dd,i)=>{TO[l*5+i]=Math.round(LX/l2*dd)+Math.round(LY/l2*dd)*W;TD[l*5+i]=dd*slope})});
    const key=lamps.find(l=>!l.ambient);if(key&&LT.lamps){LT.azimuth=dv(key.azimuth,230);LT.elevation=dv(key.elevation,30)}
    dirty.fill(1);return api}
  const MG=12;
  function relight(x0,y0,x1,y1){
    x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W-1,x1|0);y1=Math.min(H-1,y1|0);if(x1<x0||y1<y0)return;
    const a0=Math.max(0,x0-MG),b0=Math.max(0,y0-MG),a1=Math.min(W-1,x1+MG),b1=Math.min(H-1,y1+MG);
    for(let y=b0;y<=b1;y++){let k=y*W+a0;for(let x=a0;x<=a1;x++,k++){const t=HT[k];HB[k]=t+PAPER[k]*KP/(1+2.5*(t>0?t:0))}}
    const d=OUT.data,KB=LT.relief,KD=LT.contrast,KC=LT.cavity,KS=LT.shadow,SOFT=LT.softbox,CK=LT.cockle*CKG,EXP=LT.exposure,SHO=clamp(LT.shoulder,0,1),KN=1-SHO*.6,IKN=1/(1-KN+1e-9);
    for(let y=y0;y<=y1;y++){const ey=y<MG||y>=H-MG;let k=y*W+x0;
      for(let x=x0;x<=x1;x++,k++){let r=CR[k],g=CG[k],b=CB[k],ar=0,ag=0,ab=0;
        if(!ey&&x>=MG&&x<W-MG){
          const h=HB[k],gx=(HB[k+1]-HB[k-1])*.5*KB,gy=(HB[k+W]-HB[k-W])*.5*KB,il=1/Math.sqrt(gx*gx+gy*gy+1),nx=-gx*il,ny=-gy*il,nz=il;
          let cvt=1+KC*(h-(HB[k-3]+HB[k+3]+HB[k-W3]+HB[k+W3])*.25);if(cvt<.8)cvt=.8;else if(cvt>1.2)cvt=1.2;
          const sp=SP[k],mt=MT[k],fa=FA[k],gl=sp>.02||mt>.01||fa>.01,rg=RG[k],xd=x/S,yd=y/S;let ux=nx,uy=ny,uz=nz;
          if(gl){ // no support is perfectly flat: a slow undulation moves the sheen about
            const ux0=nx+(vnoise(xd/140+5,yd/140+2)-.5)*CK,uy0=ny+(vnoise(xd/140+60,yd/140+33)-.5)*CK,ul=1/Math.sqrt(ux0*ux0+uy0*uy0+nz*nz);ux=ux0*ul;uy=uy0*ul;uz=nz*ul}
          for(let l=0;l<NL;l++){let wl=LW[l];if(LPI[l]>0){const px=x-LPX[l],py=y-LPY[l];wl/=1+(px*px+py*py)*LPI[l]}
            if(LAM[l]){const m=cvt*wl;ar+=r*m*LCR[l];ag+=g*m*LCG[l];ab+=b*m*LCB[l];continue}
            const LX=LXa[l],LY=LYa[l],LZ=LZa[l],HX=HXa[l],HY=HYa[l],HZ=HZa[l],EX=EXa[l],EY=EYa[l],EZ=EZa[l],o5=l*5;
            let sd=1+KD*((nx*LX+ny*LY+nz*LZ)/LZ-1);if(sd<.4)sd=.4;else if(sd>1.7)sd=1.7;
            let sh=0,dd=HB[k+TO[o5]]-h-TD[o5];if(dd>0)sh+=dd;dd=HB[k+TO[o5+1]]-h-TD[o5+1];if(dd>0)sh+=dd;dd=HB[k+TO[o5+2]]-h-TD[o5+2];if(dd>0)sh+=dd;dd=HB[k+TO[o5+3]]-h-TD[o5+3];if(dd>0)sh+=dd;dd=HB[k+TO[o5+4]]-h-TD[o5+4];if(dd>0)sh+=dd;
            sh*=KS;if(sh>1)sh=1;
            const lm=sd*cvt*(1-.5*sh);let pr=r*lm,pg=g*lm,pb=b*lm;
            if(gl){const lit=1-.75*sh;
              let nh=ux*HX+uy*HY+uz*HZ;if(nh<0)nh=0;let ne=ux*EX+uy*EY+uz*EZ;if(ne<0)ne=0;const n2=nh*nh,s0=n2*n2*nh;
              if(sp>.02){const add=sp*(Math.pow(nh,8*Math.pow(2,rg*4.5))*(.25+.5*rg)+Math.pow(ne,6+rg*60)*rg*SOFT*.5+s0*.05)*lit;pr+=add;pg+=add;pb+=add}
              if(mt>.01){ // metal: no colour of its own, only a tinted mirror — broad sheen, a tighter lamp reflection, burnished glints
                const h1=hash(x,y)-.5,h2=hash(x+7919,y+3571)-.5,mj=.03+.35*(1-rg)*(1-rg);
                let ax=ux+h1*mj,ay=uy+h2*mj,al=1/Math.sqrt(ax*ax+ay*ay+uz*uz),mh=(ax*HX+ay*HY+uz*HZ)*al,me=(ax*EX+ay*EY+uz*EZ)*al;if(mh<0)mh=0;if(me<0)me=0;
                ax=ux+h1;ay=uy+h2;al=1/Math.sqrt(ax*ax+ay*ay+uz*uz);let gh=(ax*HX+ay*HY+uz*HZ)*al;if(gh<0)gh=0;
                const I=(.1+Math.pow(me,3+rg*14)*(.7+.5*SOFT)+Math.pow(mh,10+rg*70)*.6+Math.pow(gh,110)*.6*rg)*lit,amb=.3*lm;
                pr+=(r*I+r*r*amb-pr)*mt;pg+=(g*I+g*g*amb-pg)*mt;pb+=(b*I+b*b*amb-pb)*mt}
              if(fa>.01){ // flakes: each a tiny mirror with its own tilt and its own interference colour
                const s=FI[k],cs=flSize[s],ch=flChroma[s],sprk=flSparkle[s],shn=flSheen[s];
                if(sprk>0){const h1=hash(x+11,y+17)-.5,h2=hash(x+23,y+5)-.5;let ax=nx+h1*1.7,ay=ny+h2*1.7,al=1/Math.sqrt(ax*ax+ay*ay+nz*nz),fh=(ax*HX+ay*HY+nz*HZ)*al,sf=fh>0?Math.pow(fh,70):0,hsel=hash(x+3,y+91);
                  const qx=(x/cs)|0,qy=(y/cs)|0,g1=hash(qx+101,qy+77)-.5,g2=hash(qx+5,qy+311)-.5;ax=nx+g1*2;ay=ny+g2*2;al=1/Math.sqrt(ax*ax+ay*ay+nz*nz);fh=(ax*HX+ay*HY+nz*HZ)*al;
                  if(fh>0){const s2=Math.pow(fh,110);if(s2>sf){sf=s2;hsel=hash(qx+3,qy+91)}}
                  if(sf>.003){let hh=(flHue[s]+(hsel-.5)*2*flSpread[s])/60;hh-=Math.floor(hh/6)*6;const hi=hh|0,hf=hh-hi,p_=1-ch,q_=1-ch*hf,t_=1-ch*(1-hf),am=fa*lit*sf*1.25*sprk;
                    if(hi===0){pr+=am;pg+=t_*am;pb+=p_*am}else if(hi===1){pr+=q_*am;pg+=am;pb+=p_*am}else if(hi===2){pr+=p_*am;pg+=am;pb+=t_*am}else if(hi===3){pr+=p_*am;pg+=q_*am;pb+=am}else if(hi===4){pr+=t_*am;pg+=p_*am;pb+=am}else{pr+=am;pg+=p_*am;pb+=q_*am}}}
                if(shn>0){const dr2=flDrift[s],wq=dr2*.62,wx=(vnoise(xd/wq+31,yd/wq+4)-.5)*1.5,wy=(vnoise(xd/wq+9,yd/wq+57)-.5)*1.5;let hh=(flHue[s]+flSpread[s]*((fbm(xd/dr2+3+wx,yd/dr2+7+wy,2)-.5)*3+nx*2.2+ny*1.6))/60;hh-=Math.floor(hh/6)*6;const hi=hh|0,hf=hh-hi,p_=1-ch,q_=1-ch*hf,t_=1-ch*(1-hf),am=fa*lit*shn*(s0*.5+Math.pow(ne,8)*.25*SOFT);
                  if(hi===0){pr+=am;pg+=t_*am;pb+=p_*am}else if(hi===1){pr+=q_*am;pg+=am;pb+=p_*am}else if(hi===2){pr+=p_*am;pg+=am;pb+=t_*am}else if(hi===3){pr+=p_*am;pg+=q_*am;pb+=am}else if(hi===4){pr+=t_*am;pg+=p_*am;pb+=am}else{pr+=am;pg+=p_*am;pb+=q_*am}}}}
            ar+=pr*wl*LCR[l];ag+=pg*wl*LCG[l];ab+=pb*wl*LCB[l]}}
        else for(let l=0;l<NL;l++){let wl=LW[l];if(LPI[l]>0){const px=x-LPX[l],py=y-LPY[l];wl/=1+(px*px+py*py)*LPI[l]}ar+=r*wl*LCR[l];ag+=g*wl*LCG[l];ab+=b*wl*LCB[l]}
        if(EXP!==1){ar*=EXP;ag*=EXP;ab*=EXP}
        if(SHO>0){if(ar>KN)ar=KN+(1-KN)*(1-Math.exp((KN-ar)*IKN));if(ag>KN)ag=KN+(1-KN)*(1-Math.exp((KN-ag)*IKN));if(ab>KN)ab=KN+(1-KN)*(1-Math.exp((KN-ab)*IKN))}   // highlights roll off instead of clipping
        const o=k<<2;d[o]=ar>=1?255:ar<=0?0:(ar*255+.5)|0;d[o+1]=ag>=1?255:ag<=0?0:(ag*255+.5)|0;d[o+2]=ab>=1?255:ab<=0?0:(ab*255+.5)|0;d[o+3]=255}}
    if(ctx)ctx.putImageData(OUT,0,0,x0,y0,x1-x0+1,y1-y0+1)}
  // relight only what has changed since the last call (for showing a painting as it is made)
  function flush(max){max=max||1e9;let c=0;for(let j=0;j<TH;j++)for(let i=0;i<TW;i++)if(dirty[j*TW+i]){if(c>=max)return c;dirty[j*TW+i]=0;relight(i*TS,j*TS,Math.min(W,(i+1)*TS)-1,Math.min(H,(j+1)*TS)-1);c++}return c}
  function render(){relight(0,0,W-1,H-1);dirty.fill(0);if(LT.lens)lens(LT.lens);return api}
  /* The lens, for a close-up: sharp round `focus`, softer and softer beyond `depth`, corners darkened by `vignette`,
     a little `contrast` and film `grain`. It belongs to the finished photograph, so render() applies it and flush() does not. */
  function boxBlur(src,dst,r,horiz){const d0=horiz?4:W*4,n=horiz?W:H,m=horiz?H:W,d1=horiz?W*4:4,iw=1/(2*r+1);
    for(let j=0;j<m;j++)for(let c=0;c<3;c++){const o=j*d1+c;let acc=0;for(let i=-r;i<=r;i++)acc+=src[o+(i<0?0:i>=n?n-1:i)*d0];
      for(let i=0;i<n;i++){dst[o+i*d0]=acc*iw;const a=i+r+1,b=i-r;acc+=src[o+(a<n?a:n-1)*d0]-src[o+(b>0?b:0)*d0]}}}
  function lens(L){const d=OUT.data,dv=(v,x)=>v===undefined?x:v,fx=dv(L.focus&&L.focus[0],.5)*W,fy=dv(L.focus&&L.focus[1],.5)*H,dep=dv(L.depth,.3)*W,B=dv(L.blur,0)*S,
      vg=dv(L.vignette,0),ct=dv(L.contrast,0),gr=dv(L.grain,0)*7,far=Math.max(Math.hypot(fx,fy),Math.hypot(W-fx,fy),Math.hypot(fx,H-fy),Math.hypot(W-fx,H-fy),dep+1);
    let lv=null;
    if(B>=.6){const tmp=new Uint8ClampedArray(d.length);lv=[.3,.65,1].map(k=>{const o=new Uint8ClampedArray(d.length),r=Math.max(1,Math.round(B*k*.6));boxBlur(d,tmp,r,true);boxBlur(tmp,o,r,false);boxBlur(o,tmp,r,true);boxBlur(tmp,o,r,false);return o})}
    const cx=W*.5,cy=H*.5,v0=W*.38,iv=1/(W*.38);
    for(let y=0,p=0;y<H;y++)for(let x=0;x<W;x++,p+=4){let r=d[p],g=d[p+1],b=d[p+2];
      if(lv){const t=(Math.hypot(x-fx,y-fy)-dep)/(far-dep);
        if(t>0){const q=Math.pow(t>1?1:t,1.3)*3;let a,c,f;   // between which two of sharp, soft, softer, softest
          if(q<=1){a=d;c=lv[0];f=q}else if(q<=2){a=lv[0];c=lv[1];f=q-1}else{a=lv[1];c=lv[2];f=q-2}
          r=a[p]+(c[p]-a[p])*f;g=a[p+1]+(c[p+1]-a[p+1])*f;b=a[p+2]+(c[p+2]-a[p+2])*f}}
      if(vg>0){const k=vg*smooth((Math.hypot(x-cx,y-cy)-v0)*iv);r*=1-k*.8;g*=1-k*.88;b*=1-k*.96}
      if(ct>0){let v=r/255;r=(v+(v*v*(3-2*v)-v)*ct)*255;v=g/255;g=(v+(v*v*(3-2*v)-v)*ct)*255;v=b/255;b=(v+(v*v*(3-2*v)-v)*ct)*255}
      if(gr>0){const n=(hash(x+3,y+11)-.5)*gr;r+=n;g+=n;b+=n}
      d[p]=r;d[p+1]=g;d[p+2]=b}
    if(ctx)ctx.putImageData(OUT,0,0)}

  /* ---------- keeping and restoring a state (e.g. the bare ground) ---------- */
  const KEEP=[CR,CG,CB,HT,SP,RG,MT,FA,WET,PAPER];
  function save(){return{f:KEEP.map(a=>new Float32Array(a)),fi:new Uint8Array(FI),kp:KP,ck:CKG,wq:anyWater?[WQ,AQR,AQG,AQB].map(a=>new Float32Array(a)):null,wt:anyWater?new Uint8Array(wetTile):null}}
  function restore(st){KEEP.forEach((a,i)=>a.set(st.f[i]));FI.set(st.fi);KP=st.kp;if(st.ck!==undefined)CKG=st.ck;
    if(st.wq){needWater();[WQ,AQR,AQG,AQB].forEach((a,i)=>a.set(st.wq[i]));wetTile.set(st.wt);anyWater=true}else noWater();
    dirty.fill(1);return api}

  const sc=f=>(a,b)=>{const prev=LOCAL;LOCAL=local;try{return f(a,b)}finally{LOCAL=prev}};   // everything that looks a recipe up does so with this surface's own first
  const api={canvas:cv,ctx,width:UW,height:UH,scale:S,pxWidth:W,pxHeight:H,get pixels(){return OUT.data},
    define:defs=>{local=mergeDefs(local,defs);return api},
    ground:sc(g=>{ground(g);return api}),paint:sc(c=>{paint(c);return api}),fill:sc(c=>{fill(c);return api}),dot:sc(c=>{dot(c);return api}),
    stroke:sc((P,o)=>{stroke(P,o||{});return api}),spray:sc((P,o)=>{spray(P,o||{});return api}),polyMask,blurMask,
    flow:t=>{flow(t===undefined?1:t,false);return api},
    dry:(amt,still)=>{amt=amt===undefined?1:amt;if(anyWater){if(still){if(amt>=1)noWater()}else flow(amt,amt>=1)}const f=1-amt;for(let k=0;k<N;k++)WET[k]*=f;return api},
    light:sc(setLight),getLight:()=>Object.assign({},LT),render,flush,relight,save,restore,
    random:rnd,reseed:s=>{seed=s|0;return api},forget:()=>{mcache.clear();maskCache.clear();return api},
    buffers:{CR,CG,CB,HT,SP,RG,MT,FA,FI,WET,PAPER,get water(){return WQ},get afloat(){return WQ?[AQR,AQG,AQB]:null}}};
  sc(()=>{setLight(opt.light);ground(opt.ground||'vellum')})();
  return api}

root.PaintSim={VERSION,create,
  pigments:PIGMENTS,materials:MATERIALS,brushes:BRUSHES,grounds:GROUNDS,lights:LIGHTS,profiles:PROF,
  define:(name,recipe)=>(MATERIALS[name]=recipe),defineBrush:(name,recipe)=>(BRUSHES[name]=recipe),defineGround:(name,recipe)=>(GROUNDS[name]=recipe),defineLight:(name,recipe)=>(LIGHTS[name]=recipe),
  material,brush:brushOf,groundOf,color:parseColor,mix:mixColors,hex:toHex,lint,within,
  util:{spline,arc,circleArc,rect,hsv,mix,lerp,clamp,smooth,vnoise,fbm,hash}};
})(typeof window!=='undefined'?window:globalThis);

export {};
