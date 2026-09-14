import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {Box3,Vector3} from 'three';
import {loadGLTF} from '../../src/gltf-resource.js';
import {loadCompanionAssets} from '../../src/companion-assets.js';
import {companionManifest} from '../../src/companion-manifest.js';

// Actual 9 MB accepted GLBs, decoded ONCE and serially. Only browser image and
// canvas boundaries are supplied by Node; this proves no GPU/text appearance.
export async function loadAcceptedCompanions(){
  globalThis.self=globalThis;
  globalThis.createImageBitmap=async blob=>{
    const {info}=await sharp(Buffer.from(await blob.arrayBuffer())).raw().toBuffer({resolveWithObject:true});
    return {width:info.width,height:info.height,close(){}};
  };
  globalThis.OffscreenCanvas=class {
    constructor(width,height){this.width=width;this.height=height;this.text=[];}
    getContext(){return {fillRect:()=>{this.text=[];},fillText:text=>this.text.push(text),measureText:text=>({width:[...text].length*70})};}
  };
  const fetch0=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(String(url).startsWith('blob:'))return fetch0(url);
    assert.ok(String(url).startsWith('/models/companions/'),'no island or network resources in controller tests');
    const data=await readFile(new URL(`../../public${url}`,import.meta.url));
    const asset=Object.values(companionManifest).find(a=>a.url===url);
    assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);
    return new Response(data);
  };
  try{
    for(const [kind,asset] of Object.entries(companionManifest))await loadGLTF({id:`companion:${kind}:${asset.sha256.slice(0,12)}`,url:asset.url,phase:3},{deadline:performance.now()+30000});
    await loadCompanionAssets({deadline:performance.now()+30000});
  }finally{globalThis.fetch=fetch0;}
}

export function exactBounds(group){
  group.updateWorldMatrix(true,true);
  const bounds=new Box3(),vertex=new Vector3();
  group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.skeleton?.update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,vertex);bounds.expandByPoint(vertex.applyMatrix4(mesh.matrixWorld));
    }
  });
  return bounds;
}
export const solidBox=(x0,x1,z0,z1,bottom=0,top=6)=>({id:'fixture',bottom,top,planes:[
  [1,0,0,x1],[-1,0,0,-x0],[0,0,1,z1],[0,0,-1,-z0],[0,1,0,top],[0,-1,0,-bottom],
]});
