// Full scanned geometry and authored assembly from the reviewed r1 source.
export const lowBroadleafId='court-low-broadleaf-r1';
const TAU=Math.PI*2;

export function decodeSprayGeometries(T,spec,buffer){
  if(spec.id!=='polyhaven-shrub04-complete-curved-sprays-r1'||spec.sourceTriangles!==27327||spec.variants.length!==4)throw new Error('Unexpected full scan source.');
  if(buffer.byteLength!==spec.binaryBytes)throw new Error('Incomplete source binary.');
  return spec.variants.map(v=>{
    const raw=new Float32Array(buffer,v.vertexByteOffset,v.vertices*8),indices=new Uint32Array(buffer,v.indexByteOffset,v.triangles*3);
    const p=new Float32Array(v.vertices*3),n=new Float32Array(v.vertices*3),uv=new Float32Array(v.vertices*2);
    for(let i=0;i<v.vertices;i++){p.set(raw.subarray(i*8,i*8+3),i*3);n.set(raw.subarray(i*8+3,i*8+6),i*3);uv.set(raw.subarray(i*8+6,i*8+8),i*2);}
    const g=new T.BufferGeometry();g.name='complete-scanned-spray-'+v.id;
    g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('normal',new T.BufferAttribute(n,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(new T.BufferAttribute(indices.slice(),1));
    g.computeBoundingBox();g.computeBoundingSphere();g.userData={sourceVariant:v.id,sourceTriangles:v.triangles,sourceRoot:v.sourceRoot,originalFullGeometry:true};return g;
  });
}

function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function merge(T,items,name){
  let nv=0,ni=0;
  for(const {geometry:g} of items){nv+=g.attributes.position.count;ni+=g.index?.count??g.attributes.position.count;}
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),color=new Float32Array(nv*3),uv=new Float32Array(nv*2),index=new Uint32Array(ni);
  let vo=0,io=0;const q=new T.Vector3(),nn=new T.Vector3(),nm=new T.Matrix3();
  for(const {geometry:g,matrix=new T.Matrix4(),tint=[1,1,1]} of items){
    const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,u=g.attributes.uv;nm.getNormalMatrix(matrix);
    for(let i=0;i<p.count;i++){
      q.fromBufferAttribute(p,i).applyMatrix4(matrix);nn.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();
      pos.set(q.toArray(),(vo+i)*3);nor.set(nn.toArray(),(vo+i)*3);
      color.set([(c?.getX(i)??1)*tint[0],(c?.getY(i)??1)*tint[1],(c?.getZ(i)??1)*tint[2]],(vo+i)*3);
      uv.set([u?.getX(i)??0,u?.getY(i)??0],(vo+i)*2);
    }
    const count=g.index?.count??p.count;for(let i=0;i<count;i++)index[io+i]=vo+(g.index?.getX(i)??i);
    io+=count;vo+=p.count;
  }
  const g=new T.BufferGeometry();g.name=name;g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('normal',new T.BufferAttribute(nor,3));g.setAttribute('color',new T.BufferAttribute(color,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(new T.BufferAttribute(index,1));g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function stem(T,curve,r0,r1,segments,radial){
  const frames=curve.computeFrenetFrames(segments,false),p=[],n=[],uv=[],color=[],ix=[],stride=radial+1;
  const base=new T.Color('#716247'),slope=(r1-r0)/curve.getLength();
  for(let j=0;j<=segments;j++){
    const t=j/segments,c=curve.getPointAt(t),r=r0*(1-t)+r1*t;
    for(let k=0;k<=radial;k++){
      const a=k/radial*TAU,out=frames.normals[j].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j],Math.sin(a));
      const pigment=.88+.10*Math.cos(a*3+t*2)+.025*Math.sin(a*7+t*18);
      p.push(...c.clone().addScaledVector(out,r).toArray());n.push(...out.clone().addScaledVector(frames.tangents[j],-slope).normalize().toArray());uv.push(k/radial,t);
      color.push(base.r*pigment,base.g*pigment,base.b*pigment);
    }
  }
  for(let j=0;j<segments;j++)for(let k=0;k<radial;k++){const a=j*stride+k,b=a+stride;ix.push(a,b,a+1,a+1,b,b+1);}
  for(const j of [0,segments]){
    const centre=curve.getPoint(j/segments),normal=curve.getTangentAt(j/segments).multiplyScalar(j===0?-1:1),offset=p.length/3;
    p.push(...centre.toArray());n.push(...normal.toArray());uv.push(.5,j/segments);color.push(base.r,base.g,base.b);
    for(let k=0;k<radial;k++){const a=j*stride+k,b=a+1;if(j===0)ix.push(offset,a,b);else ix.push(offset,b,a);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);return g;
}

export function createLowBroadleaf({THREE:T,prepared,seed=371104,cpuOnly=false}={}){
  if(!T||prepared?.disposed||prepared?.geometries?.length!==4)throw new Error('Complete four-spray prepared source required.');
  if(!cpuOnly&&(!prepared.fullResolutionVerified||['map','normalMap','arm','alphaMap'].some(k=>!prepared.textures?.[k]?.isTexture||prepared.textures[k].image?.width!==4096||prepared.textures[k].image?.height!==4096)))throw new Error('Native candidate requires original four 4K maps.');
  prepared.claim?.();
  const rand=random(seed),V=(...x)=>new T.Vector3(...x),group=new T.Group(),part=new T.Group();group.name=lowBroadleafId;part.name='low-broadleaf';part.userData={id:'low-broadleaf',botanicalIdentity:'generic-low-broadleaf-reconstruction',historicallySurveyed:false,windAmplitude:0};group.add(part);
  const scans=[],branches=[],roots=[],ownedSource=[],joints=[],placements=[];
  let geos=[],leaf,wood,disposed=false;
  const releaseList=resources=>{const errors=[];for(const resource of resources)try{resource?.dispose?.();}catch(error){errors.push(error);}return errors;};
  const dispose=()=>{if(disposed)return;disposed=true;const errors=releaseList([...ownedSource.splice(0),...geos,leaf,wood,prepared]);try{group.removeFromParent();group.clear();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Low broadleaf geometry cleanup failed');};
  try {
  function addBranch(curve,r0,r1,segments=32,radial=10,root=false){const g=stem(T,curve,r0,r1,segments,radial);ownedSource.push(g);(root?roots:branches).push({geometry:g});return curve;}
  function spray(at,dir,variant,scale=1){
    const y=dir.clone().normalize(),aux=Math.abs(y.z)>.9?V(1,0,0):V(0,0,1),x=y.clone().cross(aux).normalize(),z=x.clone().cross(y).normalize(),roll=rand()*TAU;
    x.applyAxisAngle(y,roll);z.applyAxisAngle(y,roll);const m=new T.Matrix4().makeBasis(x,y,z).scale(V(scale,scale,scale)).setPosition(at);
    const tone=.88+.12*rand();scans.push({geometry:prepared.geometries[variant],matrix:m,tint:[tone,tone,tone]});
    placements.push({variant,origin:at.toArray(),direction:y.toArray(),scale,matrix:m.toArray()});
  }
  // A short real ground collar and curved spreading roots, not a grounding rod.
  addBranch(new T.CubicBezierCurve3(V(0,-.026,0),V(.001,.004,0),V(-.008,.052,.004),V(-.007,.103,.003)),.020,.012,24,14,true);
  for(let i=0;i<7;i++){
    const a=i/7*TAU+.12*rand(),r=.050+.026*rand();
    addBranch(new T.CubicBezierCurve3(V(-.003,.018,.002),V(Math.cos(a)*r*.3,.017,Math.sin(a)*r*.3),V(Math.cos(a)*r*.75,-.010,Math.sin(a)*r*.75),V(Math.cos(a)*r,-.028,Math.sin(a)*r)),.0068,.0028,20,10,true);
  }
  // Unequal outer limbs produce overlapping lobes, not a clipped spherical hedge.
  for(let i=0;i<10;i++){
    const angle=i/10*TAU+(rand()-.5)*.22,radial=V(Math.cos(angle),0,Math.sin(angle)),side=V(-Math.sin(angle),0,Math.cos(angle));
    const reach=.245+.060*rand(),height=.270+.060*rand(),end=V(radial.x*reach*1.08,height,radial.z*reach*.88);
    const base=V(-.005+radial.x*(.008+.003*(i%3)),.037+.014*(i%4),.002+radial.z*(.008+.003*(i%3)));
    const curve=addBranch(new T.CubicBezierCurve3(base,V(radial.x*(.036+.007*(i%3)),.18+.007*(i%2),radial.z*(.036+.007*(i%3))),end.clone().multiply(V(.75,1.05,.75)),end),.0072+.0007*(i%3),.0030,44,12);
    for(let j=0;j<12;j++){
      const level=j%4,t=[.07,.42,.72,.97][level],origin=curve.getPoint(t),turn=j<4?-.070:j<8?.068:(rand()-.5)*.05;
      const at=origin.clone().addScaledVector(radial,.018+.030*level).addScaledVector(side,turn).add(V(0,.025+.022*rand(),0));
      const dir=radial.clone().multiplyScalar(.25+.40*rand()).addScaledVector(side,(rand()-.5)*.28).add(V(0,.78+.18*rand(),0)).normalize();
      if(level===0){
        // Reuse the existing lowest thirty complete sprays as low wrapping
        // laterals. Their true leaves cover the base instead of adding tops.
        const tier=Math.floor(j/4);at.copy(radial).multiplyScalar(.104+.017*(i%3)+.022*tier).addScaledVector(side,turn*.75);at.y=.037+.057*tier+.009*(i%4);
        dir.multiplyScalar(.58).addScaledVector(radial,.50);dir.y=.59;dir.normalize();
      }
      const support=addBranch(new T.CubicBezierCurve3(origin,origin.clone().add(V(0,.030,0)),at.clone().addScaledVector(dir,-.026),at),.0039,.0023,20,8);
      joints.push({parent:i,root:origin.toArray(),supportEnd:support.getPoint(1).toArray(),scanRoot:at.toArray()});spray(at,dir,(i+j)%4,.96+.08*rand());
    }
  }
  // Short inner shoots break the opening between the ten main lobes.
  for(let i=0;i<4;i++){
    const a=(i+.3)*TAU/4,at=V(Math.cos(a)*.09,.37+rand()*.045,Math.sin(a)*.08);
    const axis=addBranch(new T.CubicBezierCurve3(V(-.004,.084,.001),V(Math.cos(a)*.025,.20,Math.sin(a)*.02),at.clone().add(V(0,-.035,0)),at),.008,.0025,36,10);
    for(let j=0;j<5;j++){
      const root=axis.getPoint([.18,.35,.54,.78,1][j]),tip=root.clone().add(V(Math.cos(a+j*1.9)*.052,.028,Math.sin(a+j*1.9)*.050)),dir=V(Math.cos(a+j)*.3,.96,Math.sin(a+j)*.3).normalize();
      const support=addBranch(new T.CubicBezierCurve3(root,root.clone().add(V(0,.025,0)),tip.clone().addScaledVector(dir,-.02),tip),.0033,.0022,18,8);
      joints.push({parent:10+i,root:root.toArray(),supportEnd:support.getPoint(1).toArray(),scanRoot:tip.toArray()});spray(tip,dir,(j+i+1)%4,.95+.08*rand());
    }
  }
  const textures=prepared.textures??{};
  leaf=new T.MeshStandardMaterial({name:'low-broadleaf-original-4k-scanned-leaf-and-fine-twig',color:0xffffff,vertexColors:true,map:textures.map??null,normalMap:textures.normalMap??null,roughnessMap:textures.arm??null,metalness:0,roughness:1,alphaMap:textures.alphaMap??null,alphaTest:.5,transparent:false,side:T.DoubleSide});
  wood=new T.MeshStandardMaterial({name:'low-broadleaf-authored-structural-wood',color:0xffffff,vertexColors:true,roughness:.89,metalness:0});
  geos=[merge(T,scans,'complete-textured-curved-sprays'),merge(T,branches,'connected-curved-branch-skeleton'),merge(T,roots,'short-ground-collar-and-root-spread')];
  ['low-broadleaf-scanned-sprays','low-broadleaf-branch-skeleton','low-broadleaf-ground-roots'].forEach((name,i)=>{const m=new T.Mesh(geos[i],i===0?leaf:wood);m.name=name;m.castShadow=m.receiveShadow=true;m.frustumCulled=true;m.userData={rootContactMesh:i===2,part:'low-broadleaf',alphaCoverageRequired:i===0};part.add(m);});
  const intermediateErrors=releaseList(ownedSource.splice(0));if(intermediateErrors.length)throw new AggregateError(intermediateErrors,'Low broadleaf intermediate cleanup failed');
  group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(part),rootBounds=geos[2].boundingBox;
  const rootP=geos[2].attributes.position,rootBand=[];let rootRadius=0;for(let i=0;i<rootP.count;i++)if(rootP.getY(i)<=.005){rootBand.push([rootP.getX(i),rootP.getY(i),rootP.getZ(i)]);rootRadius=Math.max(rootRadius,Math.hypot(rootP.getX(i),rootP.getZ(i)));}
  const sourceTriangles=prepared.spec.sourceTriangles,triangles=geos.reduce((s,g)=>s+g.index.count/3,0),diagnostics={id:lowBroadleafId,triangles,meshes:3,meshCount:3,scanCopies:placements.length,sourceTriangles,sourcePreserved:true,fullResolutionVerified:prepared.fullResolutionVerified===true&&!cpuOnly,textureResolution:cpuOnly?'CPU geometry mode; native must load actual 4K':[4096,4096],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(V()).toArray()},root:{mesh:'low-broadleaf-ground-roots',min:rootBounds.min.toArray(),max:rootBounds.max.toArray(),bandMaximumY:.005,bandVertices:rootBand.length,radius:rootRadius},windAmplitude:0,historicallySurveyed:false,admission:'work-only candidate pending native art and alpha-aware bed coverage'};
  return {id:lowBroadleafId,group,parts:{'low-broadleaf':part},part,diagnostics,placements,joints,rootBand,get disposed(){return disposed;},update(){},dispose};
  } catch(error) {try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Low broadleaf construction and cleanup failed',{cause:error});}throw error;}
}
