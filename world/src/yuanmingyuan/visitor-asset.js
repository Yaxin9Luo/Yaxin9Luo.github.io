import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {assetManifest} from '../asset-manifest.js';
import {assertSelfContainedGLB} from '../resource-loader.js';
import {disposeGLTF} from '../gltf-resource.js';
import {prepareWizardTemplate,createWizard,resetCharacterMotion} from '../characters.js';

// Own one complete, previously authored rider. Do not populate the main world's
// permanent template cache when visiting the independent museum page.
export async function createMuseumVisitor({signal}={}){
  const source=assetManifest['/models/characters/wizard.glb'];signal?.throwIfAborted();
  const response=await fetch(source.url,{signal});if(!response.ok)throw new Error(`Visitor model HTTP ${response.status}`);
  const buffer=await response.arrayBuffer();signal?.throwIfAborted();assertSelfContainedGLB(buffer);
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer,'');let group=null,disposed=false;
  function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
    const animation=group?.userData.characterAnimation;if(animation){animation.mixer.stopAllAction();animation.mixer.uncacheRoot(group);}
    const skeletons=new Set();for(const root of [group,gltf.scene])root?.traverse(node=>{if(node.skeleton)skeletons.add(node.skeleton);});
    for(const skeleton of skeletons)skeleton.dispose();group?.removeFromParent();group?.clear();disposeGLTF(gltf);gltf.scene.clear();delete gltf.parser;
  }
  try{signal?.throwIfAborted();group=createWizard({template:prepareWizardTemplate(gltf)});group.name='Museum visitor';resetCharacterMotion(group,{mode:'flying'});}
  catch(error){dispose();throw error;}
  signal?.addEventListener('abort',dispose,{once:true});
  return {group,dispose,source};
}
