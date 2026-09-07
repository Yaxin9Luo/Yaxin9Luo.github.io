import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export function createRendering(renderer,scene,camera) {
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const ao=new GTAOPass(scene,camera,512,512,{},{radius:1.6,distanceExponent:1.4,thickness:.6,scale:1.0,samples:8},{lumaPhi:5,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:8});
  ao.blendIntensity=.55;ao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(-100,-25,-110),new THREE.Vector3(100,75,110)));
  // The stock normal override cannot preserve alpha-cut foliage or transparent
  // spell membranes. Those surfaces must not become solid polygons in the AO buffer.
  const renderAO=ao.render.bind(ao);
  ao.render=(...args)=>{
    const hidden=[];scene.traverse(o=>{
      if(!o.visible||!o.isMesh)return;const list=Array.isArray(o.material)?o.material:[o.material];
      if(o.isWater||list.some(m=>m.alphaTest>0||m.transparent||m.side===THREE.BackSide)){hidden.push(o);o.visible=false;}
    });
    try{renderAO(...args);}finally{hidden.forEach(o=>o.visible=true);}
  };
  composer.addPass(ao);
  const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.28,.45,1.35);composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let quality='balanced',width=1,height=1,dpr=1;
  function resize(w=width,h=height,pixelRatio=dpr){width=w;height=h;dpr=pixelRatio;composer.setPixelRatio(dpr);composer.setSize(width,height);const scale=quality==='high'?.7:.5;ao.setSize(Math.max(1,Math.round(width*dpr*scale)),Math.max(1,Math.round(height*dpr*scale)));}
  return {
    render(dt){composer.render(dt);},resize,
    setQuality(value){quality=value;ao.enabled=value!=='low';bloom.enabled=value!=='low';resize();},
    reduceCost(){ao.enabled=false;},
    dispose(){for(const pass of composer.passes)pass.dispose?.();composer.dispose();},
  };
}
