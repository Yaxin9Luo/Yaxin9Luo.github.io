import * as THREE from 'three';

// Preserve the 2:1 painting aspect instead of stretching it around the horizon.
// Neighbouring 52-degree sectors overlap by 7 degrees; their art is world-fixed.
export const MATTE_SECTORS = [
  [1750,'main',false,1], [1910,'right',false,2],
  [1630,'main',true,1], [1860,'right',true,2],
  [1790,'main',false,1], [1880,'right',true,2],
  [1600,'main',true,1], [1830,'right',false,2],
].map(([radius,art,flip,layer],i)=>({angle:-.55+i*Math.PI/4,radius,art,flip,layer,span:THREE.MathUtils.degToRad(52),height:radius*THREE.MathUtils.degToRad(52)/2}));
export function curvedMountainSector({angle,radius,height,span,flip=false,art},segments=64){
  const positions=[],uv=[],indices=[],rows=8;
  for(let row=0;row<=rows;row++)for(let i=0;i<=segments;i++){
    const u=i/segments,v=row/rows,a=angle+(u-.5)*span,artU=flip?1-u:u;
    const cape=Math.max(art==='main'?Math.exp(-Math.pow((artU-.24)/.14,2)):0,Math.exp(-Math.pow((artU-.83)/.13,2)));
    // A shallow curved toe projects the capes toward the lake. The upper
    // painting and skyline retain their original radius and exact 2:1 aspect.
    const toe=(1-THREE.MathUtils.smoothstep(v,.12,.42))*Math.sin(Math.PI*u)**2;
    const r=radius-150*cape*toe;
    positions.push(Math.sin(a)*r,-105+v*height,-Math.cos(a)*r);uv.push(artU,v);
    if(row<rows&&i<segments){const n=row*(segments+1)+i,j=n+segments+1;indices.push(n,j,n+1,n+1,j,j+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export const mountainMatteFragment=`
  varying vec2 artUV;varying vec3 worldPoint;
  uniform sampler2D mountainMap;
  uniform vec3 baseColor,hazeColor,lightDirection;
  uniform float nightFactor,layerDepth,ready,reflectionMix,mainArt;
  float colourKey(vec3 rgb){return max(rgb.r,max(rgb.g,rgb.b));}
  void main(){
    if(ready<.5)discard;
    vec4 art=texture2D(mountainMap,artUV,reflectionMix*1.2);
    // Lossless source has exact black sky. Work in decoded linear colour;
    // reject it before haze/grade so reflection cannot acquire a black rectangle.
    float key=colourKey(art.rgb);
    if(key<.0008)discard;
    // Reconstruct only the skyline rim from inward colour. This removes black
    // antialias contamination without lifting the painting's interior shadows.
    vec3 inward=texture2D(mountainMap,artUV-vec2(0.,.0034)).rgb;
    float skyAbove=1.-smoothstep(.001,.015,colourKey(texture2D(mountainMap,artUV+vec2(0.,.0034)).rgb));
    float rimAlpha=smoothstep(.002,.040,key);
    float silhouette=mix(1.,rimAlpha,skyAbove);
    art.rgb=mix(art.rgb,inward,skyAbove*.88);
    float edge=smoothstep(0.,.065,artUV.x)*smoothstep(0.,.065,1.-artUV.x);
    vec3 grade=mix(vec3(.94,.97,.96),vec3(.24,.29,.36),nightFactor);
    vec3 colour=art.rgb*grade;
    float luminance=dot(colour,vec3(.2126,.7152,.0722));
    colour=mix(colour,vec3(luminance),.12);
    float air=.075+layerDepth*.018;
    float bank=11.*sin(worldPoint.x*.009)+7.*sin(worldPoint.z*.017);
    // The authored left/right promontories have thin air and exposed coastal
    // edges. Recessed valleys carry deeper fog, breaking the continuous strip.
    float leftCape=exp(-pow((artUV.x-.24)/.14,2.))*mainArt;
    float rightCape=exp(-pow((artUV.x-.83)/.13,2.));
    float cape=max(leftCape,rightCape);
    float shoreStart=mix(-3.,-65.,cape)+bank;
    float shoreEnd=mix(90.,12.,cape)+bank;
    float baseFade=smoothstep(shoreStart,shoreEnd,worldPoint.y);
    float baseMist=(1.-smoothstep(0.,mix(110.,28.,cape),worldPoint.y))*.19*(1.-cape*.65);
    // Keep the mountain-foot air in the lake's blue-grey family during dusk;
    // the warm sky remains above it rather than forming an orange waterline.
    vec3 lowAir=vec3(hazeColor.b*.72,hazeColor.g*.88,hazeColor.b);
    colour=mix(colour,hazeColor,air);
    colour=mix(colour,lowAir,baseMist);
    // Only the mirrored mountain layer loses contrast, leaving the lake's own
    // moving highlights and the direct-view forest/rock detail untouched.
    colour=mix(colour,lowAir,reflectionMix*.30);
    gl_FragColor=vec4(colour,silhouette*edge*baseFade);
    #include <colorspace_fragment>
  }
`;

export function createMineralHighlands(root,{mountainMaps={}}={}){
  const group=new THREE.Group();group.name='Blue-green mineral highlands';root.add(group);
  const materials=[],matteMaterials=[];
  // The academy's authored island cliffs provide near-field geometry; avoid
  // adding isolated procedural peaks that compete with the painted silhouettes.
  for(const sector of MATTE_SECTORS){
    const texture=mountainMaps[sector.art];
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{reflectionMix:{value:0},mainArt:{value:sector.art==='main'?1:0},mountainMap:{value:texture||null},ready:{value:texture?1:0},baseColor:{value:new THREE.Color('#ffffff')},hazeColor:{value:new THREE.Color('#7398b8')},lightDirection:{value:new THREE.Vector3(-.3,.5,-.7).normalize()},nightFactor:{value:0},layerDepth:{value:sector.layer}},
      vertexShader:'varying vec2 artUV;varying vec3 worldPoint;void main(){artUV=uv;worldPoint=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:mountainMatteFragment,
    });material.userData.backgroundLayer=sector.layer;material.userData.mountainArt=sector.art;
    const mesh=new THREE.Mesh(curvedMountainSector(sector),material);mesh.name=`Painted mineral sector ${sector.art} ${sector.angle.toFixed(2)}`;
    // Distant transparencies paint first, then the nearer overlapping sectors.
    const passEye=new THREE.Vector3();
    mesh.onBeforeRender=(_renderer,_scene,camera)=>{
      camera.getWorldPosition(passEye);
      material.uniforms.reflectionMix.value=passEye.y<-15?1:0;
    };
    mesh.renderOrder=sector.layer===2?-20:-10;mesh.userData.distantLandscape=true;group.add(mesh);matteMaterials.push(material);
  }
  return {group,materials,matteMaterials};
}
