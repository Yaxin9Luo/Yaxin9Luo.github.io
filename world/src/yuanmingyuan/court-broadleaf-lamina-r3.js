import {bilberryLeafContour as contour} from './court-bilberry-contour-r3.js';

// The image-derived boundary is geometry. Alpha is never used to cut this leaf.
// Fine venation belongs to the untouched source maps, with image top at v=1.
export function createSmoothBroadleafLamina(T,{length=.076,width=.04,curl=.0042,cup=.085,color='#537346',edgeColor='#3f5d37',seed=41,rows=contour.segments,columns=12,neutralSurface=false,name='r3-smooth-lamina'}={}){
 if(!T?.BufferGeometry||rows!==contour.segments||!Number.isInteger(columns)||columns<8||columns%2)throw new Error('Canonical THREE, the verified contour rows and an even lamina grid are required');
 for(const n of [length,width])if(!Number.isFinite(n)||n<=0)throw new Error('Invalid lamina dimensions');
 for(const n of [curl,cup,seed])if(!Number.isFinite(n))throw new Error('Invalid lamina shape');
 const p=[],colors=[],uv=[],indices=[],rowStarts=[],rowParameters=[];
 const base=new T.Color(color),edge=new T.Color(edgeColor),phase=seed*.137,asymmetry=Math.sin(seed*1.71),roll=Math.cos(seed*.79)*.055;
 const scaleX=width/contour.physicalWidthDivisorTexels;
 for(let row=0;row<=rows;row++){
  const [imageY,left,right]=contour.nodesRootToTip[row];
  const t=(contour.imageRootY-imageY)/(contour.imageRootY-contour.imageTopY),s=Math.sin(Math.PI*t);
  rowStarts.push(p.length/3);rowParameters.push(t);
  for(let column=0;column<(row===0||row===rows?1:columns+1);column++){
   const u=row===0||row===rows?0:column/columns*2-1;
   const imageX=left+(right-left)*(u+1)/2,half=(right-left)*scaleX/2;
   const x=(imageX-contour.rootX)*scaleX;
   const softCup=cup*width*.78*Math.cos(u*Math.PI/2)**2*(1+asymmetry*u*.14);
   // Smooth macro curvature; neither position nor vertex colour repeats vein bands.
   const midrib=.00010*(length/.076)*Math.exp(-((u/.34)**2));
   const longCurve=curl*t*t+length*.013*s*Math.sin(t*2.1+phase);
   const z=longCurve+s*(softCup+midrib)+u*half*roll*s;
   p.push(x,t*length,z);uv.push((imageX+.5)/contour.width,1-(imageY+.5)/contour.height);
   const c=neutralSurface?new T.Color().setRGB(.94,.94,.94):base.clone().lerp(edge,Math.abs(u)*.11).multiplyScalar(.975+.025*t);
   colors.push(c.r,c.g,c.b);
  }
 }
 for(let c=0;c<columns;c++)indices.push(0,rowStarts[1]+c+1,rowStarts[1]+c);
 for(let r=1;r<rows-1;r++)for(let c=0;c<columns;c++){const a=rowStarts[r]+c,b=rowStarts[r+1]+c;indices.push(a,a+1,b,a+1,b+1,b);}
 for(let c=0;c<columns;c++)indices.push(rowStarts[rows-1]+c,rowStarts[rows-1]+c+1,rowStarts[rows]);
 const g=new T.BufferGeometry();g.name=name;
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData={body:'source-contour-smooth-leaf-r3',rows,columns,rowStarts,rowParameters,rootVertex:0,tipVertex:rowStarts[rows],
  opaqueCurvedLamina:true,periodicVeinDisplacement:false,periodicVertexColour:false,neutralSurface,
  uv:'original BilberryLeaf01 front pixel coordinates; image top v=1',contourId:contour.id,sourceSha256:contour.sourceSha256,
  uvProof:'uv-triangle-proof.json',uvProofScope:'all Float32 UV triangle interiors; LOD0 bilinear texel support only'};
 return g;
}
