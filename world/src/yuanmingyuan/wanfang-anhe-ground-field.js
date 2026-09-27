import {DataTexture,RGBAFormat,UnsignedByteType,LinearFilter,ClampToEdgeWrapping,NoColorSpace} from 'three';
import {wanfangGardenPaths,wanfangGardenPathSamples,wanfangGardenGroundBands} from './wanfang-anhe-garden-design.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const fract=v=>v-Math.floor(v);
const hash=(x,z)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
const noise=(x,z)=>{const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,fract(x)),v=smooth(0,1,fract(z));return(hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;};
const segmentDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
/** The original quarter-metre RGBA grass/blend/sun/variation field.
 * Forest-edge ribbons feather into existing ground; the surveyed path centre
 * and its full walkable core remain clear. No new plane or terrain displacement. */
export function createWanfangAnheGroundField({site,plantingLayout}){
 if(site?.id!=='wanfang-anhe'||site.scale!==1||site.rotationY!==0||!site.position.every(Number.isFinite))throw new Error('Wanfang ground needs its original finite site frame.');
 const [sx,,sz]=site.position,min=[sx-110,sz-105],max=[sx+108,sz+96],pitch=.25;
 const treePlacements=plantingLayout.regions.flatMap(r=>r.placements).filter(p=>p.species==='willow');
 const trees=treePlacements.map(p=>[p.position[0]-sx,p.position[2]-sz]),treeScales=treePlacements.map(p=>p.scale);
 const segments=wanfangGardenPaths.flatMap(path=>{const points=wanfangGardenPathSamples(path);return points.slice(1).map((b,i)=>({a:points[i],b,width:path.width}));});
 const ribbons=wanfangGardenGroundBands.flatMap(band=>band.points.slice(1).map((b,i)=>({a:band.points[i],b,width:band.width})));
 const pathBins=new Map(),ribbonBins=new Map();
 for(const [lines,bins,margin]of [[segments,pathBins,3],[ribbons,ribbonBins,null]])for(const line of lines){
  const reach=margin??line.width*1.3+5;
  for(let z=Math.floor((Math.min(line.a[1],line.b[1])-reach)/8);z<=Math.floor((Math.max(line.a[1],line.b[1])+reach)/8);z++)for(let x=Math.floor((Math.min(line.a[0],line.b[0])-reach)/8);x<=Math.floor((Math.max(line.a[0],line.b[0])+reach)/8);x++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(line);}
 }
 function sample(worldX,worldZ){
  const x=worldX-sx,z=worldZ-sz,macro=.64*noise(x*.035+8,z*.035-4)+.36*noise(x*.058-2,z*.058+5),middle=noise(x*.19+4,z*.19-3),fine=noise(x*.91,z*.91+5),key=Math.floor(x/8)+','+Math.floor(z/8);
  let grove=0,pathStrength=0,gap=8,forestEdge=0;
  for(let i=0;i<trees.length;i++){const [tx,tz]=trees[i],scale=treeScales[i];grove=Math.max(grove,1-smooth(1.8*scale,(7.4+1.8*middle)*scale,Math.hypot(x-tx,z-tz)));}
  for(const line of pathBins.get(key)??[]){
   const distance=segmentDistance(x,z,line.a,line.b),core=line.width/2;
   gap=Math.min(gap,distance-core);
   // Width irregularity stays outside the preserved walking core, within its
   // existing reserved shoulder. It cannot narrow or move a physical approach.
   pathStrength=Math.max(pathStrength,1-smooth(core,core+.19+.39*middle,distance));
  }
  for(const line of ribbonBins.get(key)??[]){
   const distance=segmentDistance(x,z,line.a,line.b),width=line.width*(.73+.25*macro+.23*middle);
   forestEdge=Math.max(forestEdge,1-smooth(width*.47,width+3.4+.9*middle,distance));
  }
  const dry=smooth(.40,.77,.58*macro+.42*middle);
  const grass=clamp((1-pathStrength)*(.89-.19*dry-.055*grove+.075*(middle-.5)));
  const frameFeather=smooth(0,6,Math.min(worldX-min[0],max[0]-worldX,worldZ-min[1],max[1]-worldZ));
  const blend=Math.max(forestEdge,pathStrength)*frameFeather;
  return {grass,blend,sun:clamp(.31+.43*macro+.18*middle-.11*grove),variation:.92+.1*fine+.025*middle,gap,grove,pathStrength,forestEdge};
 }
 const width=Math.ceil((max[0]-min[0])/pitch)+1,height=Math.ceil((max[1]-min[1])/pitch)+1,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const s=sample(min[0]+x*pitch,min[1]+y*pitch),i=4*(y*width+x);data[i]=Math.round(s.grass*255);data[i+1]=Math.round(s.blend*255);data[i+2]=Math.round(s.sun*255);data[i+3]=Math.round(clamp((s.variation-.85)/.25)*255);}
 const texture=new DataTexture(data,width,height,RGBAFormat,UnsignedByteType);texture.name='wanfang-forest-edge-and-path-field-r4';texture.colorSpace=NoColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=ClampToEdgeWrapping;texture.magFilter=texture.minFilter=LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 return {texture,sample,diagnostics:{id:'wanfang-ground-field-r4',min,max,width,height,pitch,trees,treeScales,paths:wanfangGardenPaths,bands:wanfangGardenGroundBands,sourcePixelsChanged:false,terrainDisplaced:false,historicallySurveyed:false,paletteSRGB:{cool:'#617d4b',warm:'#96a56b',mineral:'#b9ab90'}}};
}
