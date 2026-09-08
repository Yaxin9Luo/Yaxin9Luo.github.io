import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {surface,planarUV} from './landscape.js';

function batch(group){
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),materials=new Map();
  group.traverse(o=>{if(o.isMesh){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!materials.has(o.material))materials.set(o.material,[]);materials.get(o.material).push(g);}});
  group.clear();for(const [material,parts] of materials){add(group,mergeGeometries(parts),material);parts.forEach(g=>g.dispose());}return group;
}
const metal=()=>new THREE.MeshStandardMaterial({color:'#b59a62',metalness:.72,roughness:.38});
function add(group,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}

export function createViaduct(length){
  const group=new THREE.Group();group.name='Arched stone viaduct';
  const stone=surface('castle-masonry',{color:'#b9b4aa'}),trim=surface('castle-masonry',{color:'#b9c7cc'});
  add(group,new THREE.BoxGeometry(6,.7,length),stone);
  const count=Math.max(2,Math.round(length/8)),span=length/count,r=span*.36;
  const shape=new THREE.Shape();shape.moveTo(-span/2,-.25);shape.lineTo(span/2,-.25);shape.lineTo(span/2,-24);shape.lineTo(r,-24);shape.lineTo(r,-6);
  shape.absarc(0,-6,r,0,Math.PI,false);shape.lineTo(-r,-24);shape.lineTo(-span/2,-24);shape.closePath();
  const arch=new THREE.ExtrudeGeometry(shape,{depth:.65,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:2,steps:1,curveSegments:16});
  arch.rotateY(Math.PI/2);planarUV(arch,.4);
  const parts=[];
  for(let i=0;i<count;i++)for(const side of[-1,1]){const g=arch.clone();g.translate(side*2.45-.325,0,-length/2+span*(i+.5));parts.push(g);}
  add(group,mergeGeometries(parts),stone);parts.forEach(g=>g.dispose());arch.dispose();
  const trims=[];
  for(const side of[-1,1]){
    const rail=new THREE.BoxGeometry(.48,.42,length);rail.translate(side*2.86,1.45,0);trims.push(rail);
    const base=new THREE.BoxGeometry(.55,.35,length);base.translate(side*2.86,.43,0);trims.push(base);
    for(let z=-length/2+.5;z<length/2;z+=1.3){const baluster=new THREE.CylinderGeometry(.11,.2,.9,8);baluster.translate(side*2.86,.95,z);trims.push(baluster);}
    for(let i=0;i<=count;i++){const pier=new THREE.BoxGeometry(.85,1.8,.85);pier.translate(side*2.86,1,-length/2+i*span);trims.push(pier);}
  }
  add(group,mergeGeometries(trims.map(g=>g.toNonIndexed())),trim);trims.forEach(g=>g.dispose());
  return group;
}

export function createGardenLamp(){
  const group=new THREE.Group(),bronze=metal();group.name='Garden lantern';
  add(group,new THREE.CylinderGeometry(.32,.43,.2,10),bronze,0,.1);
  add(group,new THREE.CylinderGeometry(.075,.14,1.9,10),bronze,0,1.05);
  add(group,new THREE.CylinderGeometry(.35,.25,.15,8),bronze,0,2.03);
  const glass=new THREE.MeshStandardMaterial({color:'#ebd2a0',emissive:'#ffbc62',emissiveIntensity:.8,roughness:.4});glass.name='Garden lantern glass';
  add(group,new THREE.CylinderGeometry(.24,.21,.59,8),glass,0,2.38);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;add(group,new THREE.CylinderGeometry(.019,.019,.62,5),bronze,Math.cos(a)*.26,2.38,Math.sin(a)*.26);}
  add(group,new THREE.ConeGeometry(.39,.32,8),bronze,0,2.83);
  add(group,new THREE.SphereGeometry(.055,8,6),bronze,0,3.02);
  const glow=add(group,new THREE.PlaneGeometry(1.7,1.7),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{nightFactor:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float nightFactor;varying vec2 v;void main(){float d=length(v-.5)*2.;float a=pow(max(0.,1.-d),3.)*.055*nightFactor;gl_FragColor=vec4(1.,.64,.31,a);}'}),0,2.4);
  glow.castShadow=false;glow.userData.faceCamera=true;
  return batch(group);
}

export function createLampGroundGlow(sites,heightAt){
  const positions=[],uv=[],strengths=[],indices=[],steps=10;
  for(const [x,,z,radius=3.7] of sites){
    const variation=(Math.sin(x*12.9898+z*78.233)*43758.5453)%1;
    const shape=.88+Math.abs(variation)*.22,strength=.75+Math.abs(variation)*.25;
    const start=positions.length/3;
    for(let row=0;row<=steps;row++)for(let col=0;col<=steps;col++){
      const u=col/steps,v=row/steps,px=x+(u-.5)*radius*2*shape,pz=z+(v-.5)*radius*2/shape;
      positions.push(px,heightAt(px,pz)+.105,pz);uv.push(u,v);strengths.push(strength);
      if(row<steps&&col<steps){const a=start+row*(steps+1)+col;indices.push(a,a+steps+1,a+1,a+1,a+steps+1,a+steps+2);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.setAttribute('strength',new THREE.Float32BufferAttribute(strengths,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{nightFactor:{value:1}},
    vertexShader:'attribute float strength;varying float intensity;varying vec2 v;void main(){v=uv;intensity=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float nightFactor;varying float intensity;varying vec2 v;void main(){float r=length(v-.5)*2.;float light=pow(max(0.,1.-r),3.)*.15*nightFactor*intensity;gl_FragColor=vec4(1.,.61,.29,light);}',
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Warm light on garden paths';mesh.renderOrder=1;return mesh;
}

// An open book is a real curved, layered mesh. The raycast target opens its paper.
export function createResearchBook(id,color='#647998'){
  const group=new THREE.Group(),brass=metal(),cover=new THREE.MeshStandardMaterial({color,roughness:.71}),paper=new THREE.MeshStandardMaterial({color:'#eee1bc',roughness:.94}),ink=new THREE.MeshStandardMaterial({color:'#787970',roughness:1});
  group.name=`research-book-${id}`;
  const base=new THREE.CylinderGeometry(1.65,1.9,.4,12);add(group,base,surface('castle-masonry',{color:'#9caeb9'}));
  add(group,new THREE.CylinderGeometry(.5,.8,2.6,12),surface('castle-masonry'),0,1.5);
  for(const y of [.27,.46,2.6,2.75])add(group,new THREE.CylinderGeometry(y<1?.87:.66,y<1?.95:.72,.13,16),brass,0,y);
  add(group,new THREE.CylinderGeometry(1.18,.65,.25,12),brass,0,2.88);
  const book=new THREE.Group();book.position.y=4.25;book.rotation.x=.25;group.add(book);
  for(const side of [-1,1]){
    const leaf=new THREE.Group();leaf.rotation.z=side*.18;book.add(leaf);
    add(leaf,new THREE.BoxGeometry(1.33,.1,1.95),cover,side*.66,0);
    add(leaf,new THREE.BoxGeometry(1.2,.15,1.8),paper,side*.65,.13);
    for(let layer=0;layer<5;layer++)add(leaf,new THREE.BoxGeometry(1.19,.008,1.795),ink,side*.65,.075+layer*.025);
    const page=new THREE.PlaneGeometry(1.2,1.8,18,8),p=page.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin((x/.6+1)*Math.PI/2)*.08);}
    page.computeVertexNormals();page.rotateX(-Math.PI/2);
    add(leaf,page,paper,side*.65,.22);
    const stroke=(points,material=ink,width=.007)=>{
      const path=points.map(([x,z])=>new THREE.Vector3(side*.65+x,.225+Math.sin((x/.6+1)*Math.PI/2)*.08,z));
      add(leaf,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),Math.max(12,points.length*2),width,4,false),material);
    };
    const line=(z,half=.4,material=ink,width=.006)=>stroke(Array.from({length:13},(_,i)=>[-half+i*half/6,z]),material,width);
    line(-.67,.42,brass,.013);line(-.60,.21,ink,.008);
    if(side<0){for(let n=0;n<8;n++)line(-.42+n*.139,.39-(n%3)*.035);}
    else{
      for(const radius of [.3,.23])stroke(Array.from({length:49},(_,i)=>[Math.cos(i/48*Math.PI*2)*radius,Math.sin(i/48*Math.PI*2)*radius-.16]),brass,.008);
      for(let i=0;i<3;i++){const a=i*Math.PI/3;stroke([[-Math.cos(a)*.34,-.16-Math.sin(a)*.34],[0,-.16],[Math.cos(a)*.34,-.16+Math.sin(a)*.34]]);}
      for(let n=0;n<3;n++)line(.34+n*.14,.39-(n%3)*.035);
    }
    for(const x of [side*.13,side*1.19])for(const z of[-.82,.82])add(leaf,new THREE.BoxGeometry(.19,.014,.19),brass,x,.063,z);
  }
  const halo=add(group,new THREE.TorusGeometry(2.1,.018,5,64),new THREE.MeshBasicMaterial({color:'#dfc590',transparent:true,opacity:.55,toneMapped:false}),0,3.5);halo.rotation.x=Math.PI/2;
  batch(book);
  group.userData.book=book;
  group.traverse(o=>{if(o.isMesh)o.userData.paper=id;});
  return group;
}
