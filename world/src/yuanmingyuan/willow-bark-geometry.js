import {BufferGeometry,Float32BufferAttribute,CatmullRomCurve3,Vector3,MathUtils} from 'three';
import {VegetationGeometryBatch} from './vegetation-geometry.js';

export const willowBarkReliefSpec=Object.freeze({
 id:'willow-bark-relief-r1',tileMetres:1,maximumOffsetMetres:.008,
 measuredAbsoluteDepth:false,source:'polyhaven:bark_willow',heightNormalization:'raw/65535',
 seam:'two overlapping circumference charts; same color/roughness/height coordinates',
});
const TAU=Math.PI*2,mod=(a,n)=>(a%n+n)%n;
const smooth=(a,b,x)=>MathUtils.smoothstep(x,a,b);
export function sampleWillowHeight(height,u,v){
 const {data,width,height:rows}=height;
 const x=mod(u,1)*width-.5,y=(1-mod(v,1))*rows-.5;
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const at=(a,b)=>data[mod(b,rows)*width+mod(a,width)]/65535;
 return MathUtils.lerp(MathUtils.lerp(at(ix,iy),at(ix+1,iy),fx),MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),fx),fy);
}
export function willowBarkChart(u,v,circumference){
 if(!(circumference>0))return {a:[u,v],b:[u,v],weightA:1,offset:0};
 const winding=Math.floor(u/circumference);u-=winding*circumference;
 const f=u/circumference,offset=f<.5?.5:-.5;
 return {a:[u,v],b:[u+offset*circumference,v],weightA:smooth(.08,.22,Math.min(f,1-f)),offset};
}
export function sampleWillowBarkHeight(height,u,v,circumference){
 const chart=willowBarkChart(u,v,circumference);
 return MathUtils.lerp(sampleWillowHeight(height,...chart.b),sampleWillowHeight(height,...chart.a),chart.weightA);
}
export function assertWillowHeight(height){
 if(!(height?.data instanceof Uint16Array)||!Number.isInteger(height.width)||height.width<2||height.height!==height.width||height.data.length!==height.width*height.height)throw new Error('Willow height requires complete square unsigned 16-bit top-left samples.');
}
export function createWillowBarkGeometry(options,height){
 assertWillowHeight(height);
 const {points,radii,bark=.06,seed=0,name='authored-curved-branch'}=options;
 if(!Array.isArray(points)||points.length<2||points.length!==radii?.length||points.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x)))||radii.some(r=>!Number.isFinite(r)||r<=0))throw new Error('Invalid preserved willow branch controls.');
 const originalRadial=options.radialSegments??12,originalSegments=options.segments??24;
 const isTrunk=radii[0]>.4,isRoot=points[0][1]<.5&&points.at(-1)[1]<0;
 const radialSegments=isTrunk?256:isRoot?128:radii[0]>=.12?64:originalRadial;
 const segments=isTrunk?768:isRoot?192:radii[0]>=.12?192:originalSegments;
 const curve=new CatmullRomCurve3(points.map(p=>new Vector3(...p)),false,'centripetal');
 const frames=curve.computeFrenetFrames(segments,false),length=curve.getLength(),stride=radialSegments+1;
 const positions=[],colors=[],uv=[],circumferences=[],indices=[],rowRadii=[],normal=new Vector3();
 let maxOffset=0,minOffset=Infinity,maxPositive=-Infinity,maxPhysicalUError=0;
 for(let row=0;row<=segments;row++){
  const t=row/segments,point=curve.getPointAt(t),span=curve.getUtoTmapping(t)*(radii.length-1);
  const i=Math.min(radii.length-2,Math.floor(span)),radius=MathUtils.lerp(radii[i],radii[i+1],span-i);
  const ring=[],arc=[0];
  for(let side=0;side<radialSegments;side++){
   const angle=side/radialSegments*TAU;
   const flute=Math.sin(angle*9+t*3.2+seed)*.58+Math.sin(angle*17-t*12)*.23+Math.sin(t*75+angle*3)*.18;
   const r=radius*(1+bark*flute);
   ring.push([r*Math.cos(angle),r*Math.sin(angle)]);
  }
  ring.push([...ring[0]]);
  for(let side=1;side<=radialSegments;side++)arc.push(arc.at(-1)+Math.hypot(ring[side][0]-ring[side-1][0],ring[side][1]-ring[side-1][1]));
  const circumference=arc.at(-1),v=t*length;
  const envelope=smooth(0,.08,v)*smooth(0,.08,length-v)*smooth(.025,.15,radius);
  rowRadii.push(radius);
  for(let side=0;side<=radialSegments;side++){
   const angle=side/radialSegments*TAU,u=arc[side];
   const relief=(sampleWillowBarkHeight(height,u,v,circumference)-.5)*.016*envelope;
   maxOffset=Math.max(maxOffset,Math.abs(relief));minOffset=Math.min(minOffset,relief);maxPositive=Math.max(maxPositive,relief);
   normal.copy(frames.normals[row]).multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[row],Math.sin(angle));
   const baseRadius=Math.hypot(...ring[side]);
   if(side===radialSegments)positions.push(...positions.slice((row*stride)*3,(row*stride)*3+3));
   else positions.push(...point.clone().addScaledVector(normal,baseRadius+relief).toArray());
   uv.push(u,v);colors.push(1,1,1);circumferences.push(circumference);
   if(side)maxPhysicalUError=Math.max(maxPhysicalUError,Math.abs((u-arc[side-1])-Math.hypot(ring[side][0]-ring[side-1][0],ring[side][1]-ring[side-1][1])));
  }
 }
 for(let row=0;row<segments;row++)for(let side=0;side<radialSegments;side++){
  const a=row*stride+side,b=a+stride;indices.push(a,a+1,b,a+1,b+1,b);
 }
 // Separate planar cap charts retain the original closed endpoints; no collapsed
 // circumference is divided and cap normals cannot flatten the barrel rim.
 for(const end of [0,1]){
  const centre=positions.length/3,p=curve.getPointAt(end);positions.push(...p.toArray());colors.push(1,1,1);uv.push(0,0);circumferences.push(-1);
  const offset=positions.length/3,sourceOffset=end*segments*stride;
  for(let side=0;side<radialSegments;side++){
   const vertex=positions.slice((sourceOffset+side)*3,(sourceOffset+side)*3+3),d=new Vector3(...vertex).sub(p);
   positions.push(...vertex);colors.push(1,1,1);uv.push(d.dot(frames.normals[end*segments]),d.dot(frames.binormals[end*segments]));circumferences.push(-1);
  }
  for(let side=0;side<radialSegments;side++){
   const a=offset+side,b=offset+(side+1)%radialSegments;indices.push(centre,end?a:b,end?b:a);
  }
 }
 const geometry=new BufferGeometry();geometry.name=name;
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
 geometry.setAttribute('willowBarkCircumference',new Float32BufferAttribute(circumferences,1));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const n=geometry.attributes.normal;
 for(let row=0;row<=segments;row++){
  const a=row*stride,b=a+radialSegments;
  normal.fromBufferAttribute(n,a).add(new Vector3().fromBufferAttribute(n,b)).normalize();
  n.setXYZ(a,...normal.toArray());n.setXYZ(b,...normal.toArray());
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={body:'curved-tapered-willow-wood',controlPoints:points.map(p=>[...p]),radii:[...radii],rootContact:[...points[0]],curveLength:length,
  originalRadialSegments:originalRadial,originalSegments,radialSegments,segments,isTrunk,isRoot,
  physicalTextureTile:[1,1],maximumOffsetMetres:willowBarkReliefSpec.maximumOffsetMetres,actualMaximumOffsetMetres:maxOffset,actualOffsetRange:[minOffset,maxPositive],
  maxPhysicalUError,measuredBarkDepth:false,reliefSource:'polyhaven:bark_willow',endpointOffsetMetres:0};
 return geometry;
}
export class WillowBarkGeometryBatch extends VegetationGeometryBatch{
 constructor(name){super(name);this.willowBark=true;this.barkCircumferences=[];this.branchRecords=[];}
 add(geometry,matrix,tint){
  if(matrix&&!matrix.equals(new (matrix.constructor)()))throw new Error('Willow bark metric batches require source-local geometry.');
  const attr=geometry.attributes.willowBarkCircumference;
  if(!attr||attr.count!==geometry.attributes.position.count)throw new Error('Missing willow bark chart attribute.');
  for(const x of attr.array)this.barkCircumferences.push(x);
  this.branchRecords.push({...geometry.userData,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3});
  return super.add(geometry,matrix,tint);
 }
 finish(){
  const geometry=super.finish();
  geometry.setAttribute('willowBarkCircumference',new Float32BufferAttribute(this.barkCircumferences,1));
  geometry.userData={...geometry.userData,barkRevision:willowBarkReliefSpec.id,branchRecords:this.branchRecords};
  this.barkCircumferences=[];this.branchRecords=[];return geometry;
 }
}
