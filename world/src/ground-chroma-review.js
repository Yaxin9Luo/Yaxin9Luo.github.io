// Opt-in comparison of the original terrain and the accepted local colour.
import {GROUND_CHROMA_DEFAULT,GROUND_CHROMA_MASKS as masks} from './ground-chroma.js';
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function textureState(texture,expected){
  const image=texture?.source?.data??texture?.image;
  return {bound:Boolean(texture),name:texture?.name??null,expected,sourceMatches:Boolean(texture&&texture.name===expected),width:image?.width??image?.naturalWidth??null,height:image?.height??image?.naturalHeight??null,colorSpace:texture?.colorSpace??null,type:texture?.type??null,format:texture?.format??null,flipY:texture?.flipY??null,anisotropy:texture?.anisotropy??null,minFilter:texture?.minFilter??null,magFilter:texture?.magFilter??null};
}

export function createGroundChromaStudy(scene){
  const bindings=[],rejected=[];let installed=false,disposed=false,revision=0;
  const strength={value:GROUND_CHROMA_DEFAULT};
  function install(){
    scene.updateWorldMatrix(true,true);
    const materials=new Map();
    scene.traverse(object=>{
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!material?.userData.plantingCommunity)continue;
        const entry=materials.get(material)??{material,objects:[],invalid:false};
        entry.objects.push(object.name||object.uuid);
        // Existing ground and shoulder vertices are authored in world axes.
        // A differently transformed user of a shared material rejects the whole
        // material; it cannot silently receive the wrong geographical mask.
        entry.invalid ||= !object.isMesh||object.isInstancedMesh||!object.geometry?.attributes.normal||identity.some((value,i)=>Math.abs(object.matrixWorld.elements[i]-value)>1e-8);
        materials.set(material,entry);
      }
    });
    for(const entry of materials.values()){
      const {material}=entry,key=material.customProgramCacheKey();
      if(entry.invalid||!key.startsWith('terrain-translated-community-pbr-v8-')){rejected.push({objects:entry.objects,reason:entry.invalid?'unexpected ground transform or geometry':'unsupported ground shader'});continue;}
      const beforeCompile=material.onBeforeCompile,beforeKey=material.customProgramCacheKey;
      const binding={material,objects:entry.objects,key,beforeCompile,beforeKey,shader:null};
      material.onBeforeCompile=function(shader,renderer){
        beforeCompile.call(this,shader,renderer);
        if(!shader.uniforms.groundStudyStrength)throw new Error('Ground study does not match the current terrain shader');
        // Replace the one production uniform; never apply the tint twice.
        shader.uniforms.groundStudyStrength=strength;
        binding.shader=shader;
      };
      material.customProgramCacheKey=()=>`${key}|source-chroma-study-v2`;
      binding.release=()=>{material.removeEventListener('dispose',binding.release);binding.shader=null;const i=bindings.indexOf(binding);if(i>=0)bindings.splice(i,1);};
      material.addEventListener('dispose',binding.release);material.needsUpdate=true;bindings.push(binding);
    }
    installed=true;
  }
  return {
    set(value){
      if(disposed)throw new Error('Ground study is disposed');
      if(value!==0&&value!==.5)throw new RangeError('Ground study supports only baseline 0 or source chroma 0.5');
      const first=!installed;if(first)install();
      if(first||strength.value!==value){strength.value=value;revision++;}
      return revision;
    },
    snapshot(){return {sceneId:scene.uuid,installed,disposed,strength:strength.value,revision,formula:'mix(C0, Csource * luminance(C0) / luminance(Csource), strength * region); Csource retains original source chroma, humus factor .79, original diffuse and blend weights; near-black <=1e-6 keeps C0',linearLuminanceWeights:[.2126,.7152,.0722],masks,edge:[.70,1],rejected:rejected.map(entry=>({...entry})),materials:bindings.map(({material,objects,key,shader})=>({objects,publicProgramKey:key,studyProgramKey:material.customProgramCacheKey(),compiled:Boolean(shader),boundStrength:shader?.uniforms.groundStudyStrength.value??null,diffuseLinear:material.color.toArray(),normalScale:material.normalScale.toArray(),roughness:material.roughness,metresPerRepeat:material.userData.metresPerRepeat,maps:{meadow:textureState(material.map,'meadow/color'),meadowNormal:textureState(material.normalMap,'meadow/normal'),meadowRoughness:textureState(material.roughnessMap,'meadow/roughness'),humus:textureState(shader?.uniforms.humusMap.value,'forest-ground/color'),moss:textureState(shader?.uniforms.rockMap.value,'mossy-rock/color'),humusNormal:textureState(shader?.uniforms.humusNormal.value,'forest-ground/normal'),mossNormal:textureState(shader?.uniforms.mossNormal.value,'mossy-rock/normal'),humusRoughness:textureState(shader?.uniforms.humusRoughness.value,'forest-ground/roughness'),mossRoughness:textureState(shader?.uniforms.mossRoughness.value,'mossy-rock/roughness')}}))};},
    dispose(){if(disposed)return;disposed=true;for(const binding of [...bindings]){binding.material.onBeforeCompile=binding.beforeCompile;binding.material.customProgramCacheKey=binding.beforeKey;binding.material.needsUpdate=true;binding.release();}},
  };
}
