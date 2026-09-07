import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { locations, islands, worldBounds } from './locations.js';

const assets = {};
let loading;
export const moonDirection = new THREE.Vector3(-.16, .18, -.84).normalize();

/** Called by the landscape preload. Importing this module never touches the DOM. */
export function loadAtmosphereAssets() {
  if (typeof document === 'undefined') return Promise.resolve(assets);
  if (!loading) loading = Promise.allSettled([
    ['sky', '/art/night-garden/moonlit-sky.webp'],
    ['moon', '/art/night-garden/moon-lroc-2k.jpg'],
    ['blossoms', '/art/night-garden/blossom-atlas.webp'],
  ].map(async ([key, path]) => {
    const texture = await new THREE.TextureLoader().loadAsync(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = key === 'blossoms' ? 8 : 2;
    texture.name = path;
    assets[key] = texture;
  })).then(() => assets);
  return loading;
}

export function blossomTexture() { return assets.blossoms || null; }

function randomSource(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function haloMaterial(color, opacity, falloff = 3) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: opacity }, falloff: { value: falloff } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float opacity; uniform float falloff;
      void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),falloff)*opacity;
      gl_FragColor=vec4(tint,a);
      #include <colorspace_fragment>
      }`,
  });
}

/** Reusable paper lantern with seams, open bamboo rim, brace and internal flame. */
export function createSkyLantern() {
  const group = new THREE.Group(); group.name = 'Handcrafted floating paper lantern';
  const profile = [[.33,0],[.43,.15],[.58,.72],[.61,1.13],[.51,1.55],[.25,1.78],[.035,1.86]];
  const geometry = new THREE.LatheGeometry(profile.map(([x,y]) => new THREE.Vector2(x,y)), 24);
  const paper = new THREE.MeshStandardMaterial({ color:'#eac494', emissive:'#ff6c1e', emissiveIntensity:1.0,
    roughness:.95, side:THREE.DoubleSide, transparent:true, opacity:.94, depthWrite:false });
  paper.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 paperUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\npaperUv=uv;');
    shader.fragmentShader = 'varying vec2 paperUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float paperWeave=.96+.04*sin(paperUv.x*950.+sin(paperUv.y*400.));
      diffuseColor.rgb*=mix(vec3(1.0,.67,.33),vec3(.95,.91,.79),smoothstep(.05,.87,paperUv.y))*paperWeave;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float seam=pow(abs(cos(paperUv.x*50.26548)),28.);
      float fibers=.95+.05*sin(paperUv.y*470.+sin(paperUv.x*90.));
      totalEmissiveRadiance*=mix(.44,1.0,pow(max(0.,1.-paperUv.y),.48))*fibers*(1.-seam*.22);`);
  };
  paper.customProgramCacheKey = () => 'translucent-rice-paper-v2';
  const shell = new THREE.Mesh(geometry,paper); shell.name = 'Folded rice paper'; group.add(shell);
  const bamboo = new THREE.MeshStandardMaterial({ color:'#5f3624', roughness:.82 });
  const frameParts=[];
  for (const [radius,y] of [[.335,0],[.435,.16]]) {
    const rim=new THREE.TorusGeometry(radius,.024,5,24);rim.rotateX(Math.PI/2);rim.translate(0,y,0);frameParts.push(rim);
  }
  for (let i=0;i<2;i++) {
    const brace=new THREE.CylinderGeometry(.012,.012,.68,5);
    brace.rotateZ(Math.PI/2);brace.rotateY(i*Math.PI/2);brace.translate(0,.025,0);frameParts.push(brace);
  }
  const frame=new THREE.Mesh(mergeGeometries(frameParts),bamboo);frame.name='Bamboo hoops and crossed flame brace';group.add(frame);
  frameParts.forEach(g=>g.dispose());
  const flame=new THREE.Mesh(new THREE.SphereGeometry(.11,8,8),new THREE.MeshBasicMaterial({color:'#fff0ba',toneMapped:false}));
  flame.position.y=.23;flame.scale.set(.7,2.3,.7);flame.name='Small sheltered flame';group.add(flame);
  // A round shader plane gives a feathered glow without a square sprite texture.
  const aura=new THREE.Mesh(new THREE.PlaneGeometry(3.1,3.1),haloMaterial('#ffad5b',.20,3.5));
  aura.position.y=.45;aura.onBeforeRender=(_r,_s,c)=>{
    group.getWorldQuaternion(aura.quaternion);aura.quaternion.invert().multiply(c.quaternion);aura.updateMatrixWorld();
  };group.add(aura);
  group.userData.flame=flame;
  return group;
}

export function createAtmosphere(scene, { heightAt=()=>6, lanternCount=26, fireflyCount=90, direction=moonDirection } = {}) {
  const root=new THREE.Group();root.name='Moonlit garden atmosphere';scene.add(root);
  const rand=randomSource(918472),dir=new THREE.Vector3().copy(direction).normalize();
  scene.background = new THREE.Color('#0c2446');
  const sky=new THREE.Mesh(new THREE.SphereGeometry(930,48,24),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,depthTest:false,toneMapped:false,
    uniforms:{skyMap:{value:assets.sky||null},hasMap:{value:assets.sky?1:0}},
    vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 skyDirection;uniform sampler2D skyMap;uniform float hasMap;
      void main(){vec3 d=normalize(skyDirection);float h=max(0.,d.y);vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,.26+asin(clamp(d.y,-1.,1.))/1.5707963*.74);
      vec3 fallback=mix(vec3(.038,.13,.25),vec3(.008,.025,.09),sqrt(h));
      vec3 skySample=texture2D(skyMap,uv).rgb;
      // The panorama supplies clouds; native fixed-size star points carry crisp stars.
      // Limit isolated bright texels so enlargement cannot create blurred star blobs.
      vec2 starStep=vec2(.0017,.0034);
      vec3 localSky=min(textureLod(skyMap,uv+vec2(starStep.x,0.),1.).rgb,textureLod(skyMap,uv-vec2(starStep.x,0.),1.).rgb);
      localSky=min(localSky,min(textureLod(skyMap,uv+vec2(0.,starStep.y),1.).rgb,textureLod(skyMap,uv-vec2(0.,starStep.y),1.).rgb));
      vec3 photographed=min(skySample,localSky);
      vec3 c=mix(fallback,photographed*.68,hasMap);
      c=mix(vec3(.004,.011,.029),c,smoothstep(-.12,.025,d.y));
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`,
  }));sky.name='Blue moonlit cloud panorama';sky.renderOrder=-1000;sky.frustumCulled=false;root.add(sky);

  const moon=new THREE.Mesh(new THREE.SphereGeometry(20,48,32),new THREE.ShaderMaterial({
    uniforms:{moonMap:{value:assets.moon||null},hasMap:{value:assets.moon?1:0}},toneMapped:false,
    vertexShader:'varying vec2 vUv;varying vec3 n;void main(){vUv=uv;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;varying vec3 n;uniform sampler2D moonMap;uniform float hasMap;
      void main(){vec3 a=texture2D(moonMap,vUv).rgb;float detail=mix(.75,dot(a,vec3(.2126,.7152,.0722)),hasMap);
      detail=clamp((detail-.18)*1.65+.12,0.,1.);
      float limb=.74+.26*pow(max(0.,n.z),.35);vec3 c=vec3(.70,.85,1.)*(.10+detail*.85)*limb;
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`,
  }));moon.position.copy(dir).multiplyScalar(760);moon.rotation.y=-1.3;moon.name='LROC detailed full moon';root.add(moon);
  const moonHalo=new THREE.Mesh(new THREE.PlaneGeometry(155,155),haloMaterial('#8bc9ff',.19,3));
  moonHalo.position.copy(moon.position).multiplyScalar(.994);moonHalo.lookAt(0,0,0);moonHalo.name='Soft lunar corona';root.add(moonHalo);

  const starPositions=[],starColors=[];
  for(let i=0;i<1800;i++){
    const az=rand()*Math.PI*2,y=.04+rand()*.92,radial=Math.sqrt(1-y*y),r=870;
    starPositions.push(Math.cos(az)*radial*r,y*r,Math.sin(az)*radial*r);
    const c=new THREE.Color().setHSL(.56+rand()*.12,.15,.64+rand()*.3);starColors.push(c.r,c.g,c.b);
  }
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({size:1.1,vertexColors:true,transparent:true,opacity:.82,depthWrite:false,toneMapped:false,sizeAttenuation:false,fog:false}));stars.name='Sparse silver stars';root.add(stars);

  const lanterns=[];
  for(let i=0;i<lanternCount;i++){
    const lantern=createSkyLantern(),side=i%2===0?-1:1;
    const x=side*(30+rand()*120),z=-95+rand()*205,y=32+rand()*96;
    lantern.position.set(x,y,z);lantern.scale.setScalar(.75+rand()*.6);root.add(lantern);
    lanterns.push({object:lantern,base:lantern.position.clone(),phase:rand()*6.28,manual:false});
  }
  const released=Array.from({length:8},()=>{const object=createSkyLantern();object.visible=false;root.add(object);return{object,base:new THREE.Vector3(),phase:rand()*6.28,age:0,manual:true};});
  let releaseIndex=0;

  const fireflyPositions=new Float32Array(fireflyCount*3),fireflyColors=new Float32Array(fireflyCount*3),fireflyBases=[];
  for(let i=0;i<fireflyCount;i++){
    const island=islands[i%islands.length],az=rand()*6.28,r=.4+rand()*.48;
    let x=island.x+Math.cos(az)*island.rx*r,z=island.z+Math.sin(az)*island.rz*r;
    if(locations.some(l=>Math.hypot(x-l.x,z-l.z)<l.radius)){x+=14;z+=18;}
    const y=Math.max(1,heightAt(x,z))+1+rand()*3;fireflyBases.push([x,y,z,rand()*6.28]);
    fireflyPositions.set([x,y,z],i*3);const c=new THREE.Color(i%3===0?'#d7b9ff':'#ffe29a');fireflyColors.set([c.r,c.g,c.b],i*3);
  }
  const fireflyGeometry=new THREE.BufferGeometry();fireflyGeometry.setAttribute('position',new THREE.BufferAttribute(fireflyPositions,3));fireflyGeometry.setAttribute('color',new THREE.BufferAttribute(fireflyColors,3));
  const fireflies=new THREE.Points(fireflyGeometry,new THREE.PointsMaterial({size:.19,vertexColors:true,transparent:true,opacity:.76,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));fireflies.name='Warm garden fireflies';root.add(fireflies);

  return {
    root, moonDirection:dir, lanternCount, manualLanternCapacity:released.length,
    releaseLantern(position){
      if(!position||![position.x,position.y,position.z].every(Number.isFinite))return false;
      const item=released[releaseIndex++%released.length];item.base.set(position.x+1.5,position.y+.7,position.z-.5);item.object.position.copy(item.base);item.object.visible=true;item.age=0;item.object.scale.setScalar(.72);return true;
    },
    update(t,dt=0,reduced=false){
      const time=reduced?0:t;
      for(const item of lanterns){const p=item.base;item.object.position.set(p.x+Math.sin(time*.065+item.phase)*2.3,p.y+Math.sin(time*.11+item.phase)*1.5,p.z+Math.cos(time*.07+item.phase)*1.6);item.object.rotation.set(Math.sin(time*.16+item.phase)*.045,item.phase,Math.cos(time*.13+item.phase)*.055);}
      for(const item of released){if(!item.object.visible)continue;if(!reduced)item.age+=Math.min(Math.max(dt,0),.1);
        const a=item.age;item.object.position.set(item.base.x+Math.sin(a*.18+item.phase)*a*.07,item.base.y+a*.9,item.base.z-a*.19);item.object.rotation.z=Math.sin(time*.2+item.phase)*.045;
        if(a>100||item.object.position.y>worldBounds.ceiling+65)item.object.visible=false;
      }
      for(let i=0;i<fireflyBases.length;i++){const [x,y,z,p]=fireflyBases[i];fireflyPositions[i*3]=x+Math.sin(time*.31+p)*.65;fireflyPositions[i*3+1]=y+Math.sin(time*.6+p)*.35;fireflyPositions[i*3+2]=z+Math.cos(time*.27+p)*.65;}
      fireflyGeometry.attributes.position.needsUpdate=true;
    },
    dispose(){root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();});scene.remove(root);},
  };
}
