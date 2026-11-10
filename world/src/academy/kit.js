import * as THREE from 'three';

// Merges many small primitives into one vertex-coloured geometry per material
// group, so a whole landmark costs one or two draw calls. Each primitive can
// also register a flight collider.

const tmpColor=new THREE.Color(),tmpMatrix=new THREE.Matrix4(),tmpQuat=new THREE.Quaternion(),tmpEuler=new THREE.Euler(),tmpPos=new THREE.Vector3(),tmpScale=new THREE.Vector3();

export function createRandom(seed=1){let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

export function createKit({seed=7,jitter=.045}={}){
  const groups={solid:{positions:[],colors:[]},glow:{positions:[],colors:[]}},colliders=[],random=createRandom(seed);
  function add(geometry,{color='#888',x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,group='solid',shade=true,ao=null,vary=jitter}={}){
    const source=geometry.index?geometry.toNonIndexed():geometry;
    tmpMatrix.compose(tmpPos.set(x,y,z),tmpQuat.setFromEuler(tmpEuler.set(rx,ry,rz)),tmpScale.set(sx,sy,sz));
    const p=source.attributes.position,target=groups[group],base=tmpColor.set(color).clone();
    const v=1+(random()*2-1)*vary;base.multiplyScalar(v);
    // Bounds in local Y for the ambient-occlusion ramp.
    let minY=Infinity;for(let i=0;i<p.count;i++)minY=Math.min(minY,p.getY(i)*sy);
    const vec=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      vec.fromBufferAttribute(p,i);const localY=vec.y*sy-minY;vec.applyMatrix4(tmpMatrix);
      target.positions.push(vec.x,vec.y,vec.z);
      let f=1;if(shade&&ao)f=ao[0]+(1-ao[0])*Math.min(1,localY/ao[1]);
      target.colors.push(base.r*f,base.g*f,base.b*f);
    }
    if(source!==geometry)source.dispose();
    geometry.dispose();
  }
  const api={
    random,colliders,add,
    /** y is the bottom of the box. */
    box({x=0,y=0,z=0,w=1,h=1,d=1,ry=0,color,group,solid=false,ao=[.72,3],rx=0,rz=0}){
      add(new THREE.BoxGeometry(w,h,d),{color,x,y:y+h/2,z,ry,rx,rz,group,ao});
      if(solid)colliders.push({type:'box',x,z,hx:w/2,hz:d/2,y0:y,y1:y+h,rot:ry});
    },
    cyl({x=0,y=0,z=0,r=1,rTop=r,h=1,seg=10,color,group,solid=false,ao=[.72,3],ry=0,open=false}){
      add(new THREE.CylinderGeometry(rTop,r,h,seg,1,open),{color,x,y:y+h/2,z,ry,group,ao});
      if(solid)colliders.push({type:'cyl',x,z,r:Math.max(r,rTop),y0:y,y1:y+h});
    },
    cone({x=0,y=0,z=0,r=1,h=1,seg=10,color,group,solid=false,ry=0}){
      add(new THREE.ConeGeometry(r,h,seg),{color,x,y:y+h/2,z,ry,group});
      if(solid)colliders.push({type:'cyl',x,z,r:r*.6,y0:y,y1:y+h*.55});
    },
    dome({x=0,y=0,z=0,r=1,seg=12,rings=5,color,group,solid=false,sy=1}){
      add(new THREE.SphereGeometry(r,seg,rings,0,Math.PI*2,0,Math.PI/2),{color,x,y,z,sy,group});
      if(solid)colliders.push({type:'cyl',x,z,r:r*.85,y0:y,y1:y+r*sy*.8});
    },
    /** Gabled roof prism; ridge along local x. */
    gable({x=0,y=0,z=0,w=4,d=4,h=2,ry=0,color,overhang=.6}){
      const shape=new THREE.Shape();const hd=d/2+overhang;
      shape.moveTo(-hd,0);shape.lineTo(hd,0);shape.lineTo(0,h);shape.lineTo(-hd,0);
      const g=new THREE.ExtrudeGeometry(shape,{depth:w+overhang*2,bevelEnabled:false});
      g.translate(0,0,-(w+overhang*2)/2);g.rotateY(Math.PI/2);
      add(g,{color,x,y,z,ry});
    },
    /** A glowing window: a thin box so it reads from both sides at any angle. */
    window({x=0,y=0,z=0,w=1,h=1.6,ry=0,color='#ffc979',depth=.12}){
      add(new THREE.BoxGeometry(w,h,depth),{color,x,y:y+h/2,z,ry,group:'glow',shade:false,vary:.12});
    },
    torus({x=0,y=0,z=0,r=2,tube=.2,seg=24,tubeSeg=5,rx=0,ry=0,rz=0,color,group}){
      add(new THREE.TorusGeometry(r,tube,tubeSeg,seg),{color,x,y,z,rx,ry,rz,group});
    },
    ico({x=0,y=0,z=0,r=1,detail=0,color,group,sy=1}){add(new THREE.IcosahedronGeometry(r,detail),{color,x,y,z,sy,group});},
    build(){
      const out={};
      for(const [name,g] of Object.entries(groups)){
        if(!g.positions.length){out[name]=null;continue;}
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.positions,3));
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(g.colors,3));
        geometry.computeVertexNormals();geometry.computeBoundingSphere();
        out[name]=geometry;
      }
      out.colliders=colliders;return out;
    },
  };
  return api;
}

/** Place a set of kit calls in a landmark's local frame (rotation about Y). */
export function framed(kit,{x:ox,y:oy,z:oz,ry:oRot=0}){
  const c=Math.cos(oRot),s=Math.sin(oRot);
  const at=(x,z)=>({x:ox+x*c+z*s,z:oz-x*s+z*c});
  const wrap=fn=>(o={})=>{const p=at(o.x||0,o.z||0);return kit[fn]({...o,x:p.x,y:oy+(o.y||0),z:p.z,ry:(o.ry||0)+oRot});};
  const f={};for(const fn of ['box','cyl','cone','dome','gable','window','torus','ico'])f[fn]=wrap(fn);
  f.random=kit.random;f.at=at;return f;
}
