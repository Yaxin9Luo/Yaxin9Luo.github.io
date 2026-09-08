import * as THREE from 'three';
import {createGroveTree} from './grove-foliage.js';
import {botanicalReady} from './botanical-cache.js';

// Original sculpted masses: overlapping mineral ridges, recessed valleys, open-water sight lines.
// The colour/composition study references Chinese blue-green landscape painting, not a flat sky card.
const clusters=[
  [-330,-285,142,121,211,0],[-440,-180,135,110,246,0],[-385,80,135,140,182,0],
  [335,-255,118,104,205,0],[455,-90,148,125,247,0],[348,175,125,114,161,0],
  [-230,-530,143,124,258,1],[-492,-414,166,131,310,1],[260,-548,174,123,279,1],
  [556,-345,130,145,326,1],[-536,275,134,137,281,1],[464,432,156,118,224,1],
  [-158,-753,166,128,286,2],[81,-804,155,147,268,2],[546,-632,137,143,322,2],
  [-627,-613,165,149,341,2],[40,701,240,125,170,2],[-412,630,165,141,237,2],
];
const rnd=(x,z)=>{const a=Math.sin(x*127.1+z*311.7)*43758.5453;return a-Math.floor(a);};
function noise(x,z){const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(rnd(a,b),rnd(a+1,b),u),THREE.MathUtils.lerp(rnd(a,b+1),rnd(a+1,b+1),u),v);}
function rockMass(width,depth,height,seed){
  const columns=94,rows=88,positions=[],indices=[],colours=[];
  for(let iz=0;iz<=rows;iz++)for(let ix=0;ix<=columns;ix++){
    const u=ix/columns*2-1,v=iz/rows*2-1,x=u*width,z=v*depth;
    let mass=0;
    for(const [ox,oz,r,h]of [[-.28,-.03,.71,.87],[.23,.11,.61,1],[.55,-.27,.41,.69],[-.57,.35,.39,.58]]){
      const bend=.11*Math.sin(v*3.6+seed),shape=.82+.25*noise(u*3+seed,v*3.7);
      const distance=Math.hypot(u-ox+bend,(v-oz)*1.18)/(r*shape);
      const crown=Math.pow(Math.max(0,1-distance*distance),.97);
      const relief=.76+.19*noise(u*7+seed,v*6)+.09*Math.abs(noise(u*18,v*16+seed)*2-1);
      mass=Math.max(mass,crown*h*relief);
    }
    const strata=noise(x*.035+seed,z*.035)*.07+noise(x*.105,z*.105+seed)*.035;
    const taper=Math.min(1,Math.max(0,1-Math.max(Math.abs(u),Math.abs(v)))*7);
    const raw=(mass+strata*mass)*height*taper,terrace=raw/4.6,ledge=Math.floor(terrace)+THREE.MathUtils.smoothstep(terrace%1,.12,.91);
    const y=-26+raw*.87+ledge*4.6*.13;
    positions.push(x,y,z);
    const ore=.5+.5*Math.sin(x*.037+z*.056+seed);colours.push(.62+ore*.38,.77+ore*.23,.87+ore*.13);
    if(ix<columns&&iz<rows){const n=iz*(columns+1)+ix;indices.push(n,n+columns+1,n+1,n+1,n+columns+1,n+columns+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createMineralHighlands(root,{rockMap,wind={value:0}}={}){
  const group=new THREE.Group();group.name='Blue-green mineral highlands';root.add(group);const materials=[];
  for(let layer=0;layer<3;layer++){
    const material=new THREE.ShaderMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{rockMap:{value:rockMap},baseColor:{value:new THREE.Color(['#25717d','#427e97','#6998b2'][layer])},hazeColor:{value:new THREE.Color('#7398b8')},layerDepth:{value:layer},lightDirection:{value:new THREE.Vector3(-.3,.5,-.7).normalize()}},
      vertexShader:'varying vec3 p,n,ore;void main(){p=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);ore=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 p,n,ore;uniform sampler2D rockMap;uniform vec3 baseColor,hazeColor,lightDirection;uniform float layerDepth;
        void main(){vec3 normal=normalize(n),weights=pow(abs(normal),vec3(4.));weights/=max(dot(weights,vec3(1.)),.001);
          vec3 scan=texture2D(rockMap,p.yz*.022).rgb*weights.x+texture2D(rockMap,p.xz*.022).rgb*weights.y+texture2D(rockMap,p.xy*.022).rgb*weights.z;
          float mineral=dot(scan,vec3(.2126,.7152,.0722));
          float ridgeLight=.53+max(0.,dot(normal,lightDirection))*.70+max(0.,normal.y)*.18;
          float strata=.96+.04*sin(p.y*.43+sin(p.x*.037+p.z*.032)*3.);
          vec3 colour=baseColor*ore*ridgeLight*(.55+mineral*1.35)*strata;
          float lichen=smoothstep(.20,.48,mineral)*max(0.,normal.y);
          colour=mix(colour,colour*vec3(1.08,1.16,.90),lichen*.55);
          float air=smoothstep(430.,1800.,distance(cameraPosition,p))*.52+layerDepth*.018;
          float valley=(1.-smoothstep(-12.,76.,p.y))*(.16+layerDepth*.055);
          colour=mix(colour,hazeColor,clamp(air+valley,0.,.78));gl_FragColor=vec4(colour,1.);
          #include <colorspace_fragment>
        }`,
    });material.userData.backgroundLayer=layer;materials.push(material);
  }
  const forestSites=[];
  clusters.forEach(([x,z,w,d,h,layer],i)=>{const mesh=new THREE.Mesh(rockMass(w*1.45,d*1.4,h*.62,i*19+3),materials[layer]);mesh.position.set(x*1.85,0,z*1.85);mesh.rotation.y=i*1.71;mesh.name=`Mineral ridge ${layer}-${i}`;mesh.userData.distantLandscape=true;group.add(mesh);mesh.updateMatrix();
    const points=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal;
    for(let j=0,count=0;j<120&&count<7;j++){
      const index=Math.floor(rnd(i*93+j,j*7.1)*points.count),y=points.getY(index);
      if(y<20||normals.getY(index)<.66)continue;
      const position=new THREE.Vector3().fromBufferAttribute(points,index).applyMatrix4(mesh.matrix);
      if(forestSites.some(p=>p.position.distanceTo(position)<9))continue;
      forestSites.push({position,scale:1.25+rnd(j,i)*.85,rotation:rnd(i,j)*6.28});count++;
    }
  });
  if(botanicalReady('pine',168,'far')){
    const tree=createGroveTree('pine',168,'far'),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
    for(const part of [tree.branchesMesh,tree.leavesMesh]){
      const material=new THREE.MeshStandardMaterial({color:part===tree.leavesMesh?'#436b65':'#555d57',map:part.material.map,normalMap:part.material.normalMap,vertexColors:true,roughness:1});
      const instances=new THREE.InstancedMesh(part.geometry,material,forestSites.length);instances.name='Highland ridge conifers';
      forestSites.forEach((p,i)=>{rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotation);matrix.compose(p.position,rotation,new THREE.Vector3(p.scale,p.scale,p.scale));instances.setMatrixAt(i,matrix);});
      instances.computeBoundingSphere();group.add(instances);
    }
  }
  const mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{time:wind,tint:{value:new THREE.Color('#7899ae')},nightFactor:{value:1}},
    vertexShader:'varying vec2 uvMist;void main(){uvMist=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 uvMist;uniform float time,nightFactor;uniform vec3 tint;void main(){vec2 v=uvMist;float edge=pow(max(0.,sin(v.x*3.14159)*sin(v.y*3.14159)),1.7);float cloud=.62+.20*sin(v.x*23.+sin(v.x*11.)-time*.023)+.15*sin(v.x*71.+v.y*5.);gl_FragColor=vec4(tint,edge*cloud*.19*(.75+nightFactor*.25));
      #include <colorspace_fragment>
    }`,
  });
  for(let i=0;i<clusters.length;i++){const [x,z,w,,h]=clusters[i],mist=new THREE.Mesh(new THREE.PlaneGeometry(w*3.1,22+h*.055),mistMaterial);mist.position.set(x*1.8,3+i%3*9,z*1.8);mist.lookAt(0,mist.position.y,0);mist.name=`Low valley mist ${i}`;group.add(mist);}
  return {group,materials,mistMaterial};
}
