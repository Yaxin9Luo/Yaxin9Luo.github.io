import * as THREE from 'three';

const rnd=(x,z)=>{const a=Math.sin(x*127.1+z*311.7)*43758.5453;return a-Math.floor(a);};
function noise(x,z){const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(rnd(a,b),rnd(a+1,b),u),THREE.MathUtils.lerp(rnd(a,b+1),rnd(a+1,b+1),u),v);}
function rockMass(width,depth,height,seed){
  const columns=94,rows=88,positions=[],indices=[],colours=[];
  for(let iz=0;iz<=rows;iz++)for(let ix=0;ix<=columns;ix++){
    const u=ix/columns*2-1,v=iz/rows*2-1,x=u*width,z=v*depth;
    const spine=.17*Math.sin(u*4.1+seed)+.09*Math.sin(u*11.);
    const profile=.30+.48*Math.max(0.,1.-Math.abs(u+.37)*2.6)+.31*Math.max(0.,1.-Math.abs(u-.21)*4.7)+.14*Math.max(0.,1.-Math.abs(u-.64)*7.);
    const flank=Math.max(0.,1.-Math.abs(v-spine)/(.61+.11*Math.sin(u*5.+seed)));
    const mass=profile*Math.pow(flank,.73)*(.91+.09*noise(u*13+seed,v*10));
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


// One source image spans only 110 degrees. A world-fixed ring preserves parallax
// and pixel density; the overlap receives a feather only over another sector.
export const MATTE_SECTORS = [
  {angle:-.55,radius:1250,height:735,layer:1,art:'main'},
  {angle:Math.PI/2-.55,radius:1510,height:720,layer:2,art:'right'},
  {angle:Math.PI-.55,radius:1460,height:680,layer:2,art:'main'},
  {angle:Math.PI*1.5-.55,radius:1280,height:650,layer:1,art:'right'},
];
export function curvedMountainSector({angle,radius,height},segments=96){
  const positions=[],uv=[],indices=[],span=THREE.MathUtils.degToRad(110);
  for(let y=0;y<2;y++)for(let i=0;i<=segments;i++){
    const u=i/segments,a=angle+(u-.5)*span;
    // Feet remain below lake even in the reflection camera; no horizontal cut line.
    positions.push(Math.sin(a)*radius,-105+y*height,-Math.cos(a)*radius);uv.push(u,y);
    if(y===0&&i<segments){const j=i+segments+1;indices.push(i,j,i+1,i+1,j,j+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export const mountainMatteFragment=`
  varying vec2 artUV;varying vec3 worldPoint;
  uniform sampler2D mountainMap;
  uniform vec3 baseColor,hazeColor,lightDirection;
  uniform float nightFactor,layerDepth,ready;
  void main(){
    if(ready<.5)discard;
    vec4 art=texture2D(mountainMap,artUV);
    // Lossless source has exact black sky. Work in decoded linear colour;
    // reject it before haze/grade so reflection cannot acquire a black rectangle.
    float key=max(art.r,max(art.g,art.b));
    if(key<.0008)discard;
    float silhouette=smoothstep(.0008,.008,key);
    float edge=smoothstep(0.,.065,artUV.x)*smoothstep(0.,.065,1.-artUV.x);
    vec3 grade=mix(vec3(1.10,1.10,1.03),vec3(.56,.72,.91),nightFactor);
    vec3 colour=art.rgb*grade;
    float air=.035+layerDepth*.025;
    float baseMist=(1.-smoothstep(-35.,72.,worldPoint.y))*.16;
    colour=mix(colour,hazeColor,air+baseMist);
    gl_FragColor=vec4(colour,silhouette*edge);
    #include <colorspace_fragment>
  }
`;

export function createMineralHighlands(root,{rockMap,wind={value:0},mountainMaps={}}={}){
  const group=new THREE.Group();group.name='Blue-green mineral highlands';root.add(group);
  const materials=[],matteMaterials=[];
  const near=new THREE.ShaderMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{rockMap:{value:rockMap},baseColor:{value:new THREE.Color('#597f77')},hazeColor:{value:new THREE.Color('#7398b8')},lightDirection:{value:new THREE.Vector3(-.3,.5,-.7).normalize()}},
    vertexShader:'varying vec3 p,n,ore;void main(){p=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);ore=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 p,n,ore;uniform sampler2D rockMap;uniform vec3 baseColor,hazeColor,lightDirection;
      void main(){vec3 normal=normalize(n),weights=pow(abs(normal),vec3(4.));weights/=max(dot(weights,vec3(1.)),.001);
        vec3 scan=texture2D(rockMap,p.yz*.022).rgb*weights.x+texture2D(rockMap,p.xz*.022).rgb*weights.y+texture2D(rockMap,p.xy*.022).rgb*weights.z;
        float mineral=dot(scan,vec3(.2126,.7152,.0722));
        float light=.67+max(0.,dot(normal,lightDirection))*.48;
        vec3 colour=baseColor*ore*light*(.79+mineral*.68);
        float air=smoothstep(400.,1700.,distance(cameraPosition,p))*.18;
        float valley=(1.-smoothstep(-15.,35.,p.y))*.20;
        gl_FragColor=vec4(mix(colour,hazeColor,air+valley),1.);
        #include <colorspace_fragment>
      }`,
  });near.userData.backgroundLayer=0;materials.push(near);
  // Low, connected flanking ridges keep genuine geometry near the shoreline.
  for(const [x,z,w,d,h,angle,seed] of [[-510,-200,245,100,100,-.8,3],[520,-120,210,85,77,.95,17]]){
    const mesh=new THREE.Mesh(rockMass(w,d,h,seed),near);mesh.position.set(x,0,z);mesh.rotation.y=angle;mesh.name='Near connected mineral ridge';mesh.userData.distantLandscape=true;group.add(mesh);
  }
  for(const sector of MATTE_SECTORS){
    const texture=mountainMaps[sector.art];
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{mountainMap:{value:texture||null},ready:{value:texture?1:0},baseColor:{value:new THREE.Color('#ffffff')},hazeColor:{value:new THREE.Color('#7398b8')},lightDirection:{value:new THREE.Vector3(-.3,.5,-.7).normalize()},nightFactor:{value:0},layerDepth:{value:sector.layer}},
      vertexShader:'varying vec2 artUV;varying vec3 worldPoint;void main(){artUV=uv;worldPoint=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:mountainMatteFragment,
    });material.userData.backgroundLayer=sector.layer;material.userData.mountainArt=sector.art;
    const mesh=new THREE.Mesh(curvedMountainSector(sector),material);mesh.name=`Painted mineral sector ${sector.art} ${sector.angle.toFixed(2)}`;
    // Distant transparencies paint first, then the nearer overlapping sectors.
    mesh.renderOrder=sector.layer===2?-20:-10;mesh.userData.distantLandscape=true;group.add(mesh);matteMaterials.push(material);
  }
  const mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{time:wind,tint:{value:new THREE.Color('#7899ae')},nightFactor:{value:1}},
    vertexShader:'varying vec2 uvMist;void main(){uvMist=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 uvMist;uniform float time,nightFactor;uniform vec3 tint;void main(){vec2 v=uvMist;float edge=pow(max(0.,sin(v.x*3.14159)*sin(v.y*3.14159)),1.7);float cloud=.62+.20*sin(v.x*23.+sin(v.x*11.)-time*.023);gl_FragColor=vec4(tint,edge*cloud*.10*(.75+nightFactor*.25));
      #include <colorspace_fragment>
    }`,
  });
  for(const [x,z] of [[-510,-200],[520,-120]]){const mist=new THREE.Mesh(new THREE.PlaneGeometry(450,35),mistMaterial);mist.position.set(x,5,z);mist.lookAt(0,5,0);mist.name='Low mineral valley mist';group.add(mist);}
  return {group,materials,matteMaterials,mistMaterial};
}
