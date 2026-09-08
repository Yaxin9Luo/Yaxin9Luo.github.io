import fs from 'node:fs';
import * as THREE from 'three';

// Read the real GLB vertex/index payload in Node; only browser image decoding
// is outside this geometry test boundary.
export function readScanGeometry(url){
  const bytes=fs.readFileSync(new URL(`../../public${url}`,import.meta.url)),jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),binary=bytes.subarray(28+jsonLength);
  const accessor=index=>{
    const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const [ArrayType,read,size]={5126:[Float32Array,'readFloatLE',4],5125:[Uint32Array,'readUInt32LE',4],5123:[Uint16Array,'readUInt16LE',2]}[a.componentType];
    const values=new ArrayType(a.count*width),stride=view.byteStride||width*size,offset=(view.byteOffset||0)+(a.byteOffset||0);
    for(let i=0;i<a.count;i++)for(let k=0;k<width;k++)values[i*width+k]=binary[read](offset+i*stride+k*size);
    return new THREE.BufferAttribute(values,width);
  };
  const scene=new THREE.Group();
  for(const node of gltf.nodes||[]){if(node.mesh===undefined)continue;for(const primitive of gltf.meshes[node.mesh].primitives){
    const geometry=new THREE.BufferGeometry();
    for(const [name,key]of[['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']])if(primitive.attributes[key]!==undefined)geometry.setAttribute(name,accessor(primitive.attributes[key]));
    geometry.setIndex(accessor(primitive.indices));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({side:THREE.DoubleSide}));mesh.name=node.name||'real scan';
    if(node.matrix)mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
    else{if(node.translation)mesh.position.fromArray(node.translation);if(node.rotation)mesh.quaternion.fromArray(node.rotation);if(node.scale)mesh.scale.fromArray(node.scale);}
    scene.add(mesh);
  }}
  return {scene};
}
