import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {QUALITY} from './render-quality.js';

/** Resolve geometric coverage once; subsequent passes process resolved pixels. */
class AntialiasedScenePass extends RenderPass {
  constructor(scene,camera){
    super(scene,camera);
    this.target=new THREE.WebGLRenderTarget(1,1,{
      type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false,
      resolveDepthBuffer:false,resolveStencilBuffer:false,
    });
    this.target.texture.name='Academy.scene-antialiased';
  }
  setSize(width,height){this.target.setSize(width,height);}
  setSamples(samples){if(this.target.samples!==samples){this.target.dispose();this.target.samples=samples;}}
  render(renderer,writeBuffer,readBuffer){
    super.render(renderer,writeBuffer,this.target);
    // r185 resolves the MSAA colour target when render() returns. This GPU copy
    // preserves HDR and alpha without another geometry or fullscreen draw.
    renderer.initRenderTarget(readBuffer);
    renderer.copyTextureToTexture(this.target.texture,readBuffer.texture);
  }
  dispose(){this.target.dispose();}
}

export function createRendering(renderer,scene,camera) {
  // Canvas antialiasing does not cover the offscreen scene used by the composer.
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false});
  target.texture.name='Academy.postprocess';
  const composer=new EffectComposer(renderer,target);
  const scenePass=new AntialiasedScenePass(scene,camera);composer.addPass(scenePass);
  const ao=new GTAOPass(scene,camera,512,512,{},{radius:1.6,distanceExponent:1.4,thickness:.6,scale:1.0,samples:8},{lumaPhi:5,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:8});
  ao.blendIntensity=.55;ao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(-100,-25,-110),new THREE.Vector3(100,75,110)));
  // Only the normal/depth prepass needs depth. AO and denoise are screen images.
  ao.gtaoRenderTarget.depthBuffer=false;ao.pdRenderTarget.depthBuffer=false;
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
  const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.28,.45,1.35);
  for(const buffer of[bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical])buffer.depthBuffer=false;
  composer.addPass(bloom);
  // In Three r185 SMAA operates in linear-sRGB, before the output transform.
  // It is a fallback for the lightweight mode or a device without scene MSAA.
  const smaa=new SMAAPass();composer.addPass(smaa);
  composer.addPass(new OutputPass());
  let quality='high',width=1,height=1,dpr=1,samples=0;
  function resize(w=width,h=height,pixelRatio=dpr){width=w;height=h;dpr=pixelRatio;composer.setPixelRatio(dpr);composer.setSize(width,height);const scale=quality==='high'?.8:.65;ao.setSize(Math.max(1,Math.round(width*dpr*scale)),Math.max(1,Math.round(height*dpr*scale)));}
  return {
    render(dt){composer.render(dt);},resize,
    get samples(){return samples;},
    setQuality(value){
      quality=Object.hasOwn(QUALITY,value)?value:'high';
      samples=Math.min(QUALITY[quality].samples,renderer.capabilities.maxSamples||0);
      scenePass.setSamples(samples);
      smaa.enabled=samples===0;ao.enabled=quality!=='low';bloom.enabled=quality!=='low';resize();
    },
    dispose(){for(const pass of composer.passes)pass.dispose?.();composer.dispose();},
  };
}
