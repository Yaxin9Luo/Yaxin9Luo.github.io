import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {resourceLoader,assertSelfContainedGLB} from './resource-loader.js';
import {Float32BufferAttribute} from 'three';

/** CPU transforms must not write world metres back into normalized integer accessors. */
export function mutableGeometry(source){
  const geometry=source.clone();
  for(const name of ['position','normal','tangent']){
    const attribute=geometry.getAttribute(name);if(!attribute)continue;
    if(attribute.normalized||!(attribute.array instanceof Float32Array)){
      const values=[];for(let i=0;i<attribute.count;i++)for(let j=0;j<attribute.itemSize;j++)values.push(attribute.getComponent(i,j));
      geometry.setAttribute(name,new Float32BufferAttribute(values,attribute.itemSize));
    }
  }
  return geometry;
}

export function disposeGLTF(gltf){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  gltf?.scene?.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  for(const texture of textures){texture.image?.close?.();texture.dispose();}
  for(const material of materials)material.dispose();
  for(const geometry of geometries)geometry.dispose();
}

export function loadGLTF(resource,options={}){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return resourceLoader.load(resource,{...options,parse:async buffer=>{
    assertSelfContainedGLB(buffer);
    const gltf=await loader.parseAsync(buffer,'');
    // These assets are shared by independently created studio/world instances.
    gltf.scene.traverse(object=>{
      if(object.geometry)object.geometry.userData.sharedAsset=true;
      for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){
        material.userData.sharedAsset=true;
        for(const value of Object.values(material))if(value?.isTexture)value.userData.sharedAsset=true;
      }
    });
    return gltf;
  },dispose:disposeGLTF});
}
