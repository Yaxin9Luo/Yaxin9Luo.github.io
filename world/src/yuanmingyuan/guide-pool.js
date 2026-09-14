import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCompanionActor} from '../companion-assets.js';
import {companionManifest} from '../companion-manifest.js';
import {assertSelfContainedGLB} from '../resource-loader.js';
import {disposeGLTF} from '../gltf-resource.js';
import {museumEntry,guideSign} from './museum-content.js';

function disposeTemplate(template){
  const skeletons=new Set();template.scene.traverse(object=>{if(object.skeleton)skeletons.add(object.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();disposeGLTF(template);
  template.scene.clear();delete template.parser;
}

// A museum visit owns this template. It never enters the portfolio's permanent
// resource cache; all independently animated clones are released before it.
export async function createMuseumGuidePool({signal,fetchImpl=(...args)=>fetch(...args),parse=buffer=>new GLTFLoader().parseAsync(buffer,'')}={}){
  signal?.throwIfAborted();
  const asset=companionManifest.elizabeth,response=await fetchImpl(asset.url,{signal});
  signal?.throwIfAborted();if(!response.ok)throw new Error(`Guide model could not be loaded (HTTP ${response.status}).`);
  const buffer=await response.arrayBuffer();signal?.throwIfAborted();assertSelfContainedGLB(buffer);
  const template=await parse(buffer);
  try{
    signal?.throwIfAborted();
    if(!template.scene.getObjectByName(asset.sign.face))throw new Error('Guide model has no sign face.');
    for(const name of asset.actions)if(!template.animations.some(clip=>clip.name===name))throw new Error(`Guide model is missing animation ${name}.`);
  }catch(error){disposeTemplate(template);throw error;}
  const actors=new Set();let disposed=false;
  const pool={
    create({entryId,id=entryId,lang='zh'}={}){
      if(disposed)throw new Error('This guide pool has been released.');
      if(!museumEntry(entryId))throw new Error('A guide must refer to an existing museum exhibit.');
      const actor=createCompanionActor('elizabeth',{lang,template,signMode:'bilingual'}),dispose=actor.dispose;
      actor.group.name=`MuseumGuide:${id}`;actor.group.userData={...actor.group.userData,guideId:id,entryId};actor.entryId=entryId;
      actor.setSign(guideSign(entryId));actors.add(actor);
      actor.dispose=()=>{if(!actors.delete(actor))return;dispose();};return actor;
    },
    get count(){return actors.size;},
    dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);for(const actor of [...actors])actor.dispose();disposeTemplate(template);},
  };
  const abort=()=>pool.dispose();signal?.addEventListener('abort',abort,{once:true});return pool;
}
