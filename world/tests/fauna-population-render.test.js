import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import * as source from '../src/sky-fauna.js';
import {createFaunaPopulation} from '../src/fauna-population.js';

function geometryDigest(root){
  const hash=createHash('sha256');root.traverse(o=>{if(!o.geometry)return;hash.update(o.name);const g=o.geometry;
    for(const [key,attribute]of [...Object.entries(g.attributes),...Object.entries(g.morphAttributes).flatMap(([key,values])=>values.map((a,i)=>[`${key}/${i}`,a])),['index',g.index]])if(attribute){hash.update(key);hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));}
  });return hash.digest('hex');
}

test('shared flight adds articulation without changing any accepted R3 geometry or material colors',async()=>{
  const archived=await readFile(new URL('../../docs/art/living-v8/fauna/archive/r3/world/src/sky-fauna.js',import.meta.url),'utf8');
  const previous=await import('data:text/javascript;base64,'+Buffer.from(archived.replace(/from '(three[^']*)'/g,(_all,specifier)=>`from '${import.meta.resolve(specifier)}'`)).toString('base64'));
  for(const factory of ['createSwallow','createPaperLantern','createFirefly']){
    const old=previous[factory](),current=source[factory]();assert.equal(geometryDigest(current),geometryDigest(old));
    const materials=root=>{const rows=[];root.traverse(o=>{if(o.material)rows.push([o.name,o.material.type,o.material.color?.getHex(),o.material.emissive?.getHex(),o.material.roughness,o.material.metalness,o.material.opacity,o.material.side,o.material.depthTest,o.material.depthWrite,o.material.vertexShader,o.material.fragmentShader,o.material.onBeforeCompile.toString()]);});return rows;};
    assert.deepEqual(materials(current),materials(old));source.disposeFaunaSpecimen(current);previous.disposeFaunaSpecimen(old);
  }
});

test('studio and actual instanced wings use identical attachment transforms throughout their cycle',()=>{
  const insect=source.createFirefly(),rig=source.fireflyFlightRig(insect),population=createFaunaPopulation({heightAt:()=>7,lanternCount:0,birdCount:0,fireflyCount:3});
  try{
    assert.equal(rig.length,4);const before=geometryDigest(insect),identity=new THREE.Matrix4(),sample=new THREE.Matrix4(),base=new THREE.Matrix4(),quaternion=new THREE.Quaternion();
    const parent=population.root.getObjectByName('Firefly habitat 0'),item=population.motion.insects[0];
    for(let frame=0;frame<=120;frame++){
      const time=frame/120;source.setFireflyFlight(insect,time,{phase:item.phase});population.resetActivityForReview(time);
      base.compose(item.position,quaternion.setFromEuler(item.rotation),new THREE.Vector3(1,1,1));
      let wing=0;
      for(const object of parent.children.filter(o=>['Left membranous wing','Right membranous wing','Fine wing vein'].includes(o.name))){
        const descriptor=rig[wing++];object.getMatrixAt(0,sample);sample.premultiply(base.clone().invert());
        const expected=descriptor.part.matrix;assert.ok(sample.elements.every((value,i)=>Math.abs(value-expected.elements[i])<1e-5));
        // A hinge point is invariant under its own pivot rotation, so the wing
        // cannot detach while its long distal end moves.
        const local=source.fireflyWingMatrix(descriptor,item.wingAngle,identity).multiply(descriptor.rest.clone().invert());
        assert.ok(descriptor.pivot.clone().applyMatrix4(local).distanceTo(descriptor.pivot)<1e-10);
      }
    }
    assert.equal(geometryDigest(insect),before);source.setFireflyFlight(insect,12,{reduced:true});assert.equal(insect.userData.wingAngle,0);
    for(const descriptor of rig)assert.ok(descriptor.part.matrix.elements.every((v,i)=>Math.abs(v-descriptor.rest.elements[i])<1e-12));
  }finally{source.disposeFaunaSpecimen(insect);population.dispose();}
});

test('full source bird morphs and translucent paper stay present across continuous day/night visibility',()=>{
  const population=createFaunaPopulation({heightAt:()=>7});
  try{
    const bird=population.root.children.find(o=>o.isInstancedMesh&&o.morphTexture),papers=[];population.root.traverse(o=>{if(o.name==='Continuous folded translucent paper shell'&&!o.isInstancedMesh)papers.push(o);});
    assert.ok(bird.geometry.morphAttributes.position.length===2&&bird.geometry.morphAttributes.normal.length===2);assert.equal(papers.length,34);
    let previous=0;
    for(let i=0;i<=1000;i++){
      const night=i/1000;population.setEnvironment({night});const snapshot=population.snapshot();assert.equal(snapshot.counts.ambientLanterns,26);assert.equal(snapshot.counts.fireflies,90);assert.equal(snapshot.counts.birds,12);
      const shell=papers[0].material;assert.equal(shell.opacity,.94);assert.ok(Math.abs(shell.emissiveIntensity-previous)<.046);previous=shell.emissiveIntensity;
    }
    assert.equal(population.snapshot().counts.visibleBirds,0);assert.equal(population.snapshot().counts.visibleFireflies,90);
    population.setEnvironment({night:0});assert.equal(population.snapshot().counts.visibleFireflies,0);assert.ok(population.snapshot().counts.visibleBirds>0);
    const matrices=bird.instanceMatrix.array.slice();population.update(.1,true);population.update(20,true);assert.deepEqual(bird.instanceMatrix.array,matrices,'reduced motion holds flight position and orientation');
    population.resetActivityForReview(17,true);assert.equal(population.snapshot().activityTime,17);assert.equal(population.snapshot().reducedMotion,true);
  }finally{population.dispose();}
});
