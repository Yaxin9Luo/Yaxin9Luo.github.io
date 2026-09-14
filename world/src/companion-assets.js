import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {loadGLTF} from './gltf-resource.js';
import {companionManifest,originalCompanionSign} from './companion-manifest.js';

const templates=new Map(),liveActors=new Set();
const signSequence=['sign_raise','sign_hold','sign_lower'];
const looping=new Set(['idle','walk','sign_hold']);

/** The resource coordinator owns cached original geometry/materials/clips. */
export async function loadCompanionAssets({signal,deadline,attemptId,onProgress}={}){
  const decoded=await Promise.all(Object.entries(companionManifest).map(async([kind,asset])=>{
    const gltf=await loadGLTF({id:`companion:${kind}:${asset.sha256.slice(0,12)}`,url:asset.url,phase:3},{signal,deadline,attemptId,onProgress});
    for(const action of asset.actions){
      if(!gltf.animations.some(clip=>clip.name===action))throw new Error(`${asset.name} is missing authored clip ${action}.`);
    }
    return [kind,gltf];
  }));
  signal?.throwIfAborted();for(const [kind,gltf] of decoded)templates.set(kind,gltf);
  return true;
}

function makeSignCanvas(){
  const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(1536,900):document.createElement('canvas');
  canvas.width=1536;canvas.height=900;
  if(!canvas.getContext('2d'))throw new Error('The companion sign could not create a drawing surface.');
  return canvas;
}

function drawSign(canvas,text,lang,{clear=true,top=0,height:areaHeight=canvas.height}={}){
  const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
  if(clear){ctx.fillStyle='#f8f5ec';ctx.fillRect(0,0,width,height);}ctx.fillStyle='#222522';
  ctx.textAlign='center';ctx.textBaseline='middle';
  let fontSize=lang==='zh'?180:128,lines=[];
  const units=lang==='zh'?Array.from(text):text.split(/\s+/).filter(Boolean);
  do{
    ctx.font=`500 ${fontSize}px "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
    lines=[];let line='';
    for(const unit of units){
      const next=line+(line&&lang!=='zh'?' ':'')+unit;
      if(line&&ctx.measureText(next).width>width-180){lines.push(line);line=unit;}else line=next;
    }
    if(line)lines.push(line);
    if(lines.length*fontSize*1.34<=areaHeight-(areaHeight===height?170:100))break;
    fontSize-=8;
  }while(fontSize>=40);
  const spacing=fontSize*1.34;
  lines.forEach((line,index)=>ctx.fillText(line,width/2,top+areaHeight/2+(index-(lines.length-1)/2)*spacing,width-180));
}

/** Clone bones/mixers/sign resources; keep immutable authored asset data shared. */
export function createCompanionActor(kind,{lang='zh',template:suppliedTemplate,signMode='localized'}={}){
  const asset=companionManifest[kind],template=suppliedTemplate||templates.get(kind);
  if(!asset)throw new Error(`Unknown companion: ${kind}`);
  if(!template)throw new Error('Companion assets must finish decoding before an actor is created.');
  const model=cloneSkeleton(template.scene),group=new THREE.Group();group.name=`Companion:${kind}`;group.add(model);
  const mixer=new THREE.AnimationMixer(model),clips=new Map(template.animations.map(clip=>[clip.name,clip]));
  const actions=new Map(template.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
  const skeletons=new Set(),skinnedMeshes=[],ownedMaterials=new Set(),ownedTextures=new Set();
  model.traverse(object=>{
    if(!object.isMesh)return;
    object.castShadow=!object.userData.no_cast_shadow;object.receiveShadow=true;object.frustumCulled=false;
    if(object.skeleton)skeletons.add(object.skeleton);
    if(object.isSkinnedMesh)skinnedMeshes.push(object);
  });
  let language=lang==='en'?'en':'zh',signText={...originalCompanionSign},signCanvas=null,signTexture=null;
  if(asset.sign){
    const face=model.getObjectByName(asset.sign.face);
    if(!face?.isMesh)throw new Error(`${asset.name} is missing its held sign face.`);
    signCanvas=makeSignCanvas();signTexture=new THREE.CanvasTexture(signCanvas);
    signTexture.flipY=false;signTexture.colorSpace=THREE.SRGBColorSpace;signTexture.anisotropy=4;
    signTexture.name=`${kind} instance sign`;ownedTextures.add(signTexture);
    const material=face.material.clone();material.name=`${kind} localized instance sign`;
    material.userData={...material.userData,sharedAsset:false};material.map=signTexture;material.color.set('#ffffff');
    face.material=material;ownedMaterials.add(material);
  }
  let disposed=false,current='idle',active=null,activeName=null,sequenceIndex=0,reducedPose=false,outgoingWalk=null;
  const supported=Object.freeze([...asset.actions,...(asset.sign?['sign']:[])]);
  const feet=asset.soles.map(foot=>({foot,sole:model.getObjectByName(foot.name),bone:model.getObjectByName(foot.bone)}));
  const footStates=new Map(),supportRest=new Map();
  const position=new THREE.Vector3(),target=new THREE.Vector3();
  function refreshSign(){
    if(!signCanvas)return;
    if(signMode==='bilingual'){
      drawSign(signCanvas,signText.zh||'','zh',{height:signCanvas.height*.52});
      drawSign(signCanvas,signText.en||'','en',{clear:false,top:signCanvas.height*.48,height:signCanvas.height*.52});
    }else drawSign(signCanvas,signText[language]||signText.en||signText.zh||'',language);
    signTexture.needsUpdate=true;
  }
  function clearSupport(){
    for(const [bone,position] of supportRest)bone.position.copy(position);
    supportRest.clear();footStates.clear();
  }
  function choose(name,{fade=.10,time=0}={}){
    clearSupport();
    const next=actions.get(name);if(!next)return false;
    const previous=active;
    outgoingWalk=previous&&previous!==next&&fade>0&&activeName==='walk'?{action:previous,remaining:fade}:null;
    next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(1);
    next.setLoop(looping.has(name)?THREE.LoopRepeat:THREE.LoopOnce,looping.has(name)?Infinity:1);
    next.clampWhenFinished=!looping.has(name);next.time=time;next.play();
    if(previous&&previous!==next&&fade>0)previous.crossFadeTo(next,fade,false);
    else if(previous&&previous!==next)previous.stop();
    active=next;activeName=name;mixer.update(0);return true;
  }
  function staticPose(name,time){
    mixer.stopAllAction();choose(name,{fade:0,time});active.paused=true;mixer.update(0);reducedPose=true;
  }
  function updateMatrices(){
    // SkinnedMesh refreshes its bind inverse in updateMatrixWorld, which the
    // base updateWorldMatrix traversal does not invoke. Picks must also work
    // before a renderer has visited a newly placed or moved actor.
    group.parent?.updateWorldMatrix(true,false);group.updateMatrixWorld(true);
    for(const skeleton of skeletons)skeleton.update();
    for(const mesh of skinnedMeshes){mesh.boundingSphere=null;mesh.boundingBox=null;}
  }
  function supportFeet(getSupportHeight){
    footStates.clear();if(typeof getSupportHeight!=='function')return;
    for(const {foot,sole,bone} of feet){
      if(!sole||!bone)continue;
      // The outgoing walk remains visible during the existing crossfade. Its
      // swing paw must not become a planted idle foot before that blend ends.
      const contactWalk=activeName==='walk'?active:outgoingWalk?.action;
      const phase=contactWalk?((contactWalk.time/asset.walk.duration+foot.phase)%1+1)%1:0;
      const planted=!contactWalk||phase<asset.walk.stance;
      sole.getWorldPosition(position);
      const state={kind,name:foot.name,position:position.clone(),planted,phase,correction:0};
      if(planted){
        const height=getSupportHeight(state);
        if(Number.isFinite(height)){
          const correction=THREE.MathUtils.clamp(height+foot.clearance-position.y,-.08,.08);
          supportRest.set(bone,bone.position.clone());
          bone.getWorldPosition(target);target.y+=correction;bone.parent.worldToLocal(target);bone.position.copy(target);
          bone.updateWorldMatrix(false,true);state.correction=correction;
        }
      }
      footStates.set(foot.name,state);
    }
    updateMatrices();
  }
  const actor={
    kind,group,model,mixer,asset,supportedActions:supported,footStates,
    get action(){return current;},get clip(){return activeName;},get time(){return active?.time||0;},
    get duration(){return active?clips.get(activeName).duration:0;},get language(){return language;},
    setAction(name){
      if(disposed)return false;
      if(name==='idle'&&!actions.size){current=name;return true;}
      if(!supported.includes(name))throw new Error(`${asset.name} does not support action ${name}.`);
      if(current===name&&active&&name!=='sign'&&!reducedPose)return true;
      current=name;sequenceIndex=0;reducedPose=false;
      return choose(name==='sign'?signSequence[0]:name);
    },
    setSign(text){
      if(disposed)return;
      signText={zh:String(text.zh??signText.zh),en:String(text.en??signText.en)};refreshSign();
    },
    setLanguage(next){if(disposed)return;language=next==='en'?'en':'zh';refreshSign();},
    seek(seconds){
      if(disposed||!active)return;
      const time=THREE.MathUtils.clamp(Number(seconds)||0,0,clips.get(activeName).duration);
      mixer.stopAllAction();choose(activeName,{fade:0,time});mixer.update(0);updateMatrices();
    },
    update(dt,{paused=false,reducedMotion=false,speed,getSupportHeight}={}){
      if(disposed||paused)return;
      clearSupport();
      const elapsed=Number.isFinite(dt)?Math.max(0,dt):0;
      if(reducedMotion&&active){
        const name=current==='sign'||current.startsWith('sign_')?'sign_hold':current==='sit'?'sit':'idle';
        if(!reducedPose||activeName!==name)staticPose(name,name==='sit'?clips.get(name).duration:0);
      }else if(active){
        if(reducedPose){reducedPose=false;choose(current==='sign'?'sign_hold':current,{fade:0});if(current==='sign')sequenceIndex=1;}
        active.paused=false;
        if(current==='sign'){
          let remaining=elapsed;
          while(remaining>0){
            const duration=clips.get(activeName).duration,left=Math.max(0,duration-active.time),step=Math.min(remaining,left);
            mixer.update(step);remaining-=step;
            if(left<=step+1e-7){
              sequenceIndex++;
              if(sequenceIndex<signSequence.length)choose(signSequence[sequenceIndex],{fade:0});
              else{current='idle';choose('idle',{fade:0});if(remaining)mixer.update(remaining);break;}
            }else break;
          }
        }else{
          active.setEffectiveTimeScale(activeName==='walk'&&speed!==undefined?Math.max(0,speed)/(asset.walk.stride/asset.walk.duration):1);
          mixer.update(elapsed);
        }
      }
      if(outgoingWalk){outgoingWalk.remaining-=elapsed;if(outgoingWalk.remaining<=1e-8)outgoingWalk=null;}
      updateMatrices();supportFeet(getSupportHeight);
    },
    dispose(){
      if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);
      for(const skeleton of skeletons)skeleton.dispose();
      for(const texture of ownedTextures)texture.dispose();for(const material of ownedMaterials)material.dispose();
      group.removeFromParent();group.clear();liveActors.delete(actor);
    },
  };
  refreshSign();choose('idle',{fade:0});updateMatrices();liveActors.add(actor);return actor;
}

export function companionAssetDiagnostics(){
  return {decodedKinds:[...templates.keys()],liveActors:liveActors.size,cacheOwnership:'Resource coordinator; shared originals remain alive for the page lifetime.'};
}
