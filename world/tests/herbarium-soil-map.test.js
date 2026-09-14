import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {groundMaterial} from '../src/landscape.js';
import {registerHerbariumCommunityFootprints} from '../src/herbarium-layout.js';

function compileMap(material){const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader.uniforms.plantingMap.value;}
const green=(texture,x,z)=>texture.image.data[(Math.floor((z+144)/288*256)*256+Math.floor((x+144)/288*256))*4+1];
const square=(x,z)=>({loop:[[x-2,z-2],[x+2,z-2],[x+2,z+2],[x-2,z+2]]});

test('progressive accepted soil refreshes the cached ground map and texture disposal removes its listener',()=>{
  const material=groundMaterial(),texture=compileMap(material),before=[green(texture,-10,60),green(texture,65,10)],version=texture.version;
  const releaseA=registerHerbariumCommunityFootprints([square(-10,60)]),releaseB=registerHerbariumCommunityFootprints([square(65,10)]);let next;
  try{
    assert.equal(compileMap(material),texture,'retain the existing map and resolution');assert.equal(texture.image.width,256);assert.ok(texture.version>version);assert.ok(green(texture,-10,60)>before[0]);const east=green(texture,65,10);assert.ok(east>before[1]);
    releaseA();assert.equal(green(texture,-10,60),before[0]);assert.equal(green(texture,65,10),east,'one owner cannot clear another living world');
    texture.dispose();const disposedVersion=texture.version;releaseB();assert.equal(texture.version,disposedVersion,'disposed texture is unsubscribed');
    next=compileMap(material);assert.notEqual(next,texture);assert.equal(green(next,65,10),before[1]);
    const initial=next.version,releaseC=registerHerbariumCommunityFootprints([square(-10,60)]);assert.equal(next.version,initial+1,'only one current texture listener remains');releaseC();assert.equal(next.version,initial+2);
  }finally{releaseA();releaseB();next?.dispose();material.dispose();}
});
