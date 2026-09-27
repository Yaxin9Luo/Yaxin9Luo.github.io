import * as THREE from 'three';
import {part} from './zhengda-guangming-geometry.js';

export const ZHENGDA_CENSER_REVISION='cast-openwork-censer-r2';
export const censerR2Spec=Object.freeze({
 totalHeight:2.60,pedestalHeight:.58,outerEarHalfWidth:.9014964699745178,coverBaseY:1.72,coverRise:.62,
 coverThickness:.016,coverPanels:8,aperturesPerPanel:2,
 reliefHeight:.0045,maximumAuthoredGrainHeight:.00014,
 authority:'Copper alloy, three-foot form, pierced cloud cover and ornament are modern reconstruction interpretations; not identified Yuanmingyuan originals.'
});
const TAU=Math.PI*2,vec=a=>new THREE.Vector3(...a),clamp=THREE.MathUtils.clamp;
const outerKnots=[[1.035,.09],[1.065,.29],[1.15,.435],[1.29,.505],[1.42,.521],[1.535,.501],[1.61,.483],[1.635,.501],[1.649,.534],[1.667,.544],[1.692,.542],[1.714,.505]];
function interpolate(knots,t){
 let i=0;while(i<knots.length-2&&t>knots[i+1][0])i++;
 const a=knots[i],b=knots[i+1],p=knots[Math.max(0,i-1)],n=knots[Math.min(knots.length-1,i+2)],h=b[0]-a[0],u=clamp((t-a[0])/h,0,1);
 const m0=(b[1]-p[1])/(b[0]-p[0]),m1=(n[1]-a[1])/(n[0]-a[0]);
 return (2*u*u*u-3*u*u+1)*a[1]+(u*u*u-2*u*u+u)*h*m0+(-2*u*u*u+3*u*u)*b[1]+(u*u*u-u*u)*h*m1;
}
export const censerBodyRadius=y=>interpolate(outerKnots,y);
export function censerCoverPoint(u,v,depth=0){
 const r=.505*Math.pow(Math.cos(v*Math.PI/2),.84)+depth;
 return new THREE.Vector3(r*Math.cos(u),1.72+.62*v,r*Math.sin(u));
}
function normalAt(map,p,n){
 const e=1e-5,du=map(p.x+e,p.y,p.z).sub(map(p.x-e,p.y,p.z)).multiplyScalar(.5/e);
 const dv=map(p.x,p.y+e,p.z).sub(map(p.x,p.y-e,p.z)).multiplyScalar(.5/e);
 const dd=map(p.x,p.y,p.z+e).sub(map(p.x,p.y,p.z-e)).multiplyScalar(.5/e);
 const jac=new THREE.Matrix3().set(du.x,dv.x,dd.x,du.y,dv.y,dd.y,du.z,dv.z,dd.z);
 if(Math.abs(jac.determinant())<1e-10)throw new Error('Degenerate cast-surface mapping');
 return n.clone().applyMatrix3(jac.invert().transpose()).normalize();
}
// Subdivide in the authored 2D pattern before bending. This preserves real
// hole sidewalls and avoids a coarse triangulation flattening the curved lid.
function bendExtrusion(source,map,maxEdge=.08){
 const s=source.index?source.toNonIndexed():source,p=s.attributes.position,n=s.attributes.normal;
 const positions=[],normals=[],uvs=[];
 const mid=(a,b)=>({p:a.p.clone().add(b.p).multiplyScalar(.5),n:a.n.clone().add(b.n).normalize()});
 function emit(a,b,c,level=0){
  const edge=Math.max(a.p.distanceTo(b.p),b.p.distanceTo(c.p),c.p.distanceTo(a.p));
  if(edge>maxEdge&&level<6){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);emit(a,ab,ca,level+1);emit(ab,b,bc,level+1);emit(ca,bc,c,level+1);emit(ab,bc,ca,level+1);return;}
  // The (u, v, outward depth) mapping has negative determinant. Reverse
  // winding, but transform the authored extrusion normals by inverse-T.
  for(const v of [a,c,b]){
   const point=map(v.p.x,v.p.y,v.p.z),normal=normalAt(map,v.p,v.n);
   positions.push(...point.toArray());normals.push(...normal.toArray());uvs.push(v.p.x,v.p.y);
  }
 }
 for(let i=0;i<p.count;i+=3)emit(...[i,i+1,i+2].map(k=>({p:new THREE.Vector3().fromBufferAttribute(p,k),n:new THREE.Vector3().fromBufferAttribute(n,k)})));
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 if(s!==source)s.dispose();source.dispose();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function censerCloudOpening(upper=false,centre=0){
 const p=new THREE.Path(),y=upper?.48:.09,sy=upper?.95:1,flip=upper?-1:1;
 const xy=(x,v)=>[centre+flip*x,y+sy*v];
 p.moveTo(...xy(-.29,.025));
 p.bezierCurveTo(...xy(-.325,.090),...xy(-.22,.105),...xy(-.23,.160));
 p.bezierCurveTo(...xy(-.29,.220),...xy(-.18,.310),...xy(-.075,.250));
 p.bezierCurveTo(...xy(.015,.205),...xy(.065,.320),...xy(.20,.285));
 p.bezierCurveTo(...xy(.325,.253),...xy(.327,.170),...xy(.235,.142));
 p.bezierCurveTo(...xy(.155,.117),...xy(.21,.032),...xy(.10,.014));
 p.bezierCurveTo(...xy(.015,-.008),...xy(-.045,.079),...xy(-.135,.040));
 p.bezierCurveTo(...xy(-.205,-.01),...xy(-.26,-.012),...xy(-.29,.025));p.closePath();return p;
}
export function createCenserCoverPanel(){
 const half=Math.PI,s=new THREE.Shape();
 s.moveTo(-half,0);s.lineTo(half,0);s.lineTo(half,.94);s.lineTo(-half,.94);s.closePath();
 for(let j=0;j<8;j++){const a=-Math.PI+(j+.5)*TAU/8;s.holes.push(censerCloudOpening(false,a),censerCloudOpening(true,a));}
 const raw=new THREE.ExtrudeGeometry(s,{depth:.016,bevelEnabled:true,bevelSize:.005,bevelThickness:.0025,bevelSegments:3,steps:1,curveSegments:32});
 const g=bendExtrusion(raw,censerCoverPoint,.075);
 g.userData={body:'solid-pierced-cast-cover',apertures:16,thicknessMetres:.016,trueOpenHoles:true,curveSegments:32};
 return g;
}
function bowlGeometry(){
 const profile=[[0,1.035],[.09,1.035]];
 for(let i=1;i<=240;i++){const y=1.035+(1.714-1.035)*i/240;profile.push([censerBodyRadius(y),y]);}
 // Rounded rim returns to a separate inner wall, then the solid bowl floor.
 profile.push([.495,1.719],[.482,1.720],[.469,1.715],[.459,1.702],[.455,1.688]);
 const inner=[[1.12,.10],[1.17,.31],[1.27,.42],[1.42,.475],[1.53,.461],[1.61,.443],[1.688,.455]];
 for(let i=1;i<=180;i++){const y=1.688-(1.688-1.12)*i/180;profile.push([interpolate(inner,y),y]);}
 profile.push([0,1.12],[0,1.035]);
 const g=new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),192);
 g.userData={body:'rounded-hollow-cast-bronze-bowl',wallThicknessNominal:.040,solidFloor:true};
 return g;
}
function mappedRelief(shape,angle,y,height=.0045){
 const raw=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:.0016,bevelThickness:.0010,bevelSegments:3,steps:1,curveSegments:28});
 return bendExtrusion(raw,(u,v,d)=>{const yy=y+v,r=censerBodyRadius(yy)+d-.0011,a=angle+u/.52;return new THREE.Vector3(r*Math.cos(a),yy,r*Math.sin(a));},.025);
}
function cloudRelief(){
 const s=new THREE.Shape();
 s.moveTo(-.16,-.063);
 s.bezierCurveTo(-.15,-.005,-.077,-.008,-.098,.042);
 s.bezierCurveTo(-.125,.105,-.025,.107,0,.044);
 s.bezierCurveTo(.032,.112,.143,.090,.124,.026);
 s.bezierCurveTo(.110,-.013,.064,-.011,.056,-.040);
 s.bezierCurveTo(.092,-.039,.128,-.032,.162,-.064);
 s.bezierCurveTo(.090,-.090,.043,-.066,0,-.026);
 s.bezierCurveTo(-.039,-.062,-.103,-.081,-.16,-.063);s.closePath();
 for(const side of [-1,1]){
  const h=new THREE.Path();h.moveTo(side*.036,.028);
  h.bezierCurveTo(side*.043,.063,side*.091,.075,side*.096,.039);
  h.bezierCurveTo(side*.080,.054,side*.055,.044,side*.036,.028);h.closePath();s.holes.push(h);
 }
 return s;
}
function foliateRelief(){
 const s=new THREE.Shape();s.moveTo(0,-.072);s.bezierCurveTo(-.055,-.033,-.051,.035,0,.073);s.bezierCurveTo(.051,.035,.055,-.033,0,-.072);s.closePath();return s;
}
function sweepCast(points,widths,depths,{segments=96,sides=32,flutes=.06,flatStartY=null}={}){
 const curve=new THREE.CatmullRomCurve3(points.map(vec),false,'centripetal');
 const frames=curve.computeFrenetFrames(segments,false),p=[],uv=[],ix=[];
 for(let i=0;i<=segments;i++){
  const t=i/segments,c=curve.getPointAt(t),w=interpolate(widths,t),d=interpolate(depths,t);
  for(let j=0;j<=sides;j++){
   const a=TAU*j/sides,shape=1+flutes*Math.cos(3*a)*Math.sin(Math.PI*t);
   const v=c.clone().addScaledVector(frames.normals[i],w*Math.cos(a)*shape).addScaledVector(frames.binormals[i],d*Math.sin(a)*shape);
   if(i===0&&flatStartY!==null)v.y=flatStartY;
   p.push(...v.toArray());uv.push(j/sides,t);
  }
 }
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;ix.push(a,a+1,b,b,a+1,b+1);}
 for(const end of [0,segments]){
  const c=curve.getPointAt(end/segments),center=p.length/3;if(end===0&&flatStartY!==null)c.y=flatStartY;p.push(...c.toArray());uv.push(.5,end/segments);
  for(let j=0;j<sides;j++){const a=end*(sides+1)+j;ix.push(...(end===0?[center,a+1,a]:[center,a,a+1]));}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function retainedEarEnvelope(g,side){
 // Preserve the actual R1 outside width while leaving both cast-on roots
 // unchanged. Only the outer arch broadens; there is no whole-vessel scale.
 const p=g.attributes.position;
 g.computeBoundingBox();
 const current=side>0?g.boundingBox.max.x:-g.boundingBox.min.x;
 const delta=censerR2Spec.outerEarHalfWidth-current;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),t=clamp((Math.abs(x)-.56)/.20,0,1),w=t*t*(3-2*t);
  p.setX(i,x+side*delta*w);
 }
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 return g;
}
function smoothFinial(){
 const pts=[[.055,2.285],[.087,2.309],[.080,2.344],[.043,2.378],[.050,2.408],[.082,2.460],[.068,2.518],[.026,2.574],[0,2.60]];
 const curve=new THREE.CatmullRomCurve3(pts.map(([r,y])=>new THREE.Vector3(r,y,0)),false,'centripetal');
 const profile=[[0,2.285],...curve.getPoints(144).map(v=>[Math.max(0,v.x),v.y])].map(a=>new THREE.Vector2(...a));
 return new THREE.LatheGeometry(profile,128);
}
function materials(b){
 if(b.censerR2Materials)return b.censerR2Materials;
 const make=(name,color,roughness,metalness)=>{
  const m=new THREE.MeshStandardMaterial({color,roughness,metalness});
  m.name='zhengda-censer-'+name+'-r2';m.userData={category:'authored-cast-bronze',censerRevision:ZHENGDA_CENSER_REVISION,measuredHistoricAlloy:false};
  b.materials.add(m);return m;
 };
 b.censerR2Materials={cast:make('cast-bronze',0x776a53,.55,.82),edge:make('raised-bronze',0x807157,.49,.86)};
 return b.censerR2Materials;
}
export function buildZhengdaCenserR2(b,parent,name,{x=0,z=0,floor=0}={}){
 const g=part(parent,name,{body:'independent-detailed-bronze-censer',typeAuthority:censerR2Spec.authority,totalHeight:2.60,censerRevision:ZHENGDA_CENSER_REVISION});
 g.position.set(x,floor,z);
 // Exact R1 stone pedestal, still a distinct material/geometry owner.
 b.lathe(g,b.m.stone,[[0,0],[.70,0],[.70,.10],[.62,.16],[.57,.26],[.57,.42],[.64,.48],[.64,.58],[0,.58]],[0,0,0],96);
 const m=materials(b),body=part(g,name+'-cast-bowl',{body:'hollow-cast-bowl-with-shallow-relief'});
 b.add(body,b.prototype('censer-r2-bowl',bowlGeometry),m.cast);
 const relief=part(g,name+'-cast-relief',{body:'integrated-foliate-cloud-shallow-relief',heightMetres:.0045,notWireLoops:true});
 for(let j=0;j<8;j++){
  const a=TAU*j/8;
  b.add(relief,mappedRelief(cloudRelief(),a,1.425),m.cast,undefined,undefined,undefined,true);
  b.add(relief,mappedRelief(foliateRelief(),a+Math.PI/8,1.220,.0038),m.cast,undefined,undefined,undefined,true);
 }
 for(const y of [1.588,1.625]){
  const r=censerBodyRadius(y);
  b.lathe(relief,m.edge,[[r-.003,y-.004],[r+.004,y-.004],[r+.006,y],[r+.004,y+.004],[r-.003,y+.004],[r-.003,y-.004]],[0,0,0],192);
 }
 const legs=part(g,name+'-three-cast-legs',{body:'three-fluted-variable-section-legs',feetTopOfStone:.58,authoredFoliateForm:true});
 for(let k=0;k<3;k++){
  const angle=TAU*k/3;
  const geo=b.prototype('censer-r2-leg',()=>sweepCast([[0,.589,.42],[0,.66,.426],[0,.82,.355],[0,1.01,.346],[0,1.14,.416]],[[0,.112],[.12,.078],[.48,.059],[.78,.078],[1,.110]],[[0,.046],[.14,.060],[.54,.065],[.80,.077],[1,.093]],{flutes:.095,flatStartY:.58}));
  b.add(legs,geo,m.cast,undefined,undefined,[0,angle,0]);
 }
 const ears=part(g,name+'-paired-cast-ears',{body:'paired-shaped-cast-ears',castAttachments:true});
 for(const side of [-1,1]){
  const points=[[side*.478,1.365,0],[side*.685,1.437,0],[side*.804,1.586,0],[side*.806,1.811,0],[side*.703,1.934,0],[side*.590,1.932,0],[side*.504,1.742,0]];
  b.add(ears,retainedEarEnvelope(sweepCast(points,[[0,.082],[.20,.065],[.50,.044],[.75,.052],[1,.073]],[[0,.054],[.35,.038],[.65,.041],[1,.047]],{segments:144,sides:40,flutes:.085}),side),m.cast,undefined,undefined,undefined,true);
 }
 const cover=part(g,name+'-pierced-cover',{body:'solid-pierced-cast-cover',panels:8,actualApertures:16,wallThickness:.016});
 b.add(cover,b.prototype('censer-r2-pierced-cover',createCenserCoverPanel),m.cast);
 b.lathe(cover,m.edge,[[.488,1.704],[.516,1.704],[.522,1.713],[.520,1.726],[.492,1.734],[.488,1.704]],[0,0,0],192);
 b.add(cover,b.prototype('censer-r2-smooth-bud-finial',smoothFinial),m.edge);
 return g;
}
const GLSL=[
 'varying vec3 vCenserWorld;',
 'uniform sampler2D censerMicrofinish;',
 'vec3 censerSample(vec3 p,vec3 n){',
 ' vec3 w=pow(abs(inverseTransformDirection(n,viewMatrix)),vec3(4.0));w/=max(dot(w,vec3(1.0)),1e-8);',
 ' vec3 q=p/.28,dx=dFdx(q),dy=dFdy(q);',
 ' return textureGrad(censerMicrofinish,q.yz,dx.yz,dy.yz).rgb*w.x+textureGrad(censerMicrofinish,q.zx,dx.zx,dy.zx).rgb*w.y+textureGrad(censerMicrofinish,q.xy,dx.xy,dy.xy).rgb*w.z;',
 '}',
 'vec3 censerRelief(vec3 p,vec3 n,float h,float faceSign){',
 ' vec3 sx=dFdx(p),sy=dFdy(p),r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1)*faceSign;',
 ' if(abs(det)<1e-16)return n;',
 ' return normalize(abs(det)*n-sign(det)*(dFdx(h)*r1+dFdy(h)*r2));',
 '}'
].join('\n');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw new Error('Censer R2 shader anchor changed: '+a);return s.replace(a,b);};
export function prepareZhengdaCenserR2Finishes(b,diagnostics){
 if(!b.censerR2Materials)return;
 for(const m of Object.values(b.censerR2Materials)){
  m.onBeforeCompile=shader=>{
   shader.uniforms.censerMicrofinish={value:b.finishTextures.mineral};
   shader.vertexShader=once(shader.vertexShader,'#include <common>','#include <common>\nvarying vec3 vCenserWorld;');
   shader.vertexShader=once(shader.vertexShader,'#include <project_vertex>','#include <project_vertex>\nvec4 censerPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\ncenserPosition=instanceMatrix*censerPosition;\n#endif\nvCenserWorld=(modelMatrix*censerPosition).xyz;');
   shader.fragmentShader=once(shader.fragmentShader,'#include <common>','#include <common>\n'+GLSL);
   shader.fragmentShader=once(shader.fragmentShader,'#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 censerGrain=censerSample(vCenserWorld,normal);\nfloat censerOxide=smoothstep(.48,.69,censerGrain.b);\ndiffuseColor.rgb*=mix(vec3(1.015,1.003,.987),vec3(.84,.91,.89),.35*censerOxide);\nroughnessFactor=clamp(roughnessFactor+.10*(censerGrain.g-.5),.43,.65);\nnormal=censerRelief(-vViewPosition,normal,.00014*(censerGrain.r-.5),faceDirection);');
   diagnostics.shaderPreparations++;diagnostics.preparedMaterials=[...new Set([...diagnostics.preparedMaterials,m.name])];
  };
  m.customProgramCacheKey=()=>ZHENGDA_CENSER_REVISION+'-physical-bronze';
  m.needsUpdate=true;
 }
 diagnostics.censer={revision:ZHENGDA_CENSER_REVISION,privateMaterials:2,extraTextures:0,borrowedMap:b.finishTextures.mineral.name,maximumHeightMetres:.00014,roughnessBounds:[.43,.65],originalNonCenserFinishesUnchanged:true,artifactTypeHistoricallyVerified:false};
}
