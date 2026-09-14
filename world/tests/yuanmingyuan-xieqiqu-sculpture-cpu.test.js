import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as THREE from 'three';
import {inspectSculptureCPU} from '../scripts/xieqiqu-sculpture-cpu-review.mjs';

test('CPU inspection writes full 2048 square native pixels with exact decoded hash and leaves owner resources untouched',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'xieqiqu-cpu-')),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial(),group=new THREE.Group();let disposal=0;group.add(new THREE.Mesh(geometry,material));geometry.addEventListener('dispose',()=>disposal++);material.addEventListener('dispose',()=>disposal++);
  try{const report=await inspectSculptureCPU({group,diagnostics:{fixture:true}},directory,{viewSpecs:{front:{direction:[0,0,1]}}}),png=await readFile(path.join(directory,'front.png')),decoded=await sharp(png).raw().toBuffer({resolveWithObject:true});
    assert.equal(decoded.info.width,2048);assert.equal(decoded.info.height,2048);assert.equal(report.size,2048);assert.equal(report.images[0].trianglesVisited,12);assert.equal(report.images[0].sideCulledTriangles,2);assert.ok(report.images[0].coveredPixels>2048*2048*.8);assert.equal(createHash('sha256').update(decoded.data).digest('hex'),report.images[0].pixelSHA256);assert.equal(createHash('sha256').update(png).digest('hex'),report.images[0].pngSHA256);assert.equal(disposal,0);assert.equal(group.children.length,1);assert.equal(report.materialResponseRendered,false);
  }finally{geometry.dispose();material.dispose();await rm(directory,{recursive:true,force:true});}
});

test('the CPU depth image preserves a real thin opening and honors the authored material side',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'xieqiqu-gap-')),group=new THREE.Group(),material=new THREE.MeshStandardMaterial({side:THREE.FrontSide}),geometries=[];
  for(const x of [-.3,.3]){const g=new THREE.PlaneGeometry(.5,1);geometries.push(g);const mesh=new THREE.Mesh(g,material);mesh.position.x=x;group.add(mesh);}
  try{const report=await inspectSculptureCPU({group},directory,{size:256,viewSpecs:{front:{direction:[0,0,1]},back:{direction:[0,0,-1]}}}),front=await sharp(path.join(directory,'front.png')).raw().toBuffer(),background=239;
    assert.ok(report.images[0].coveredPixels>0);assert.equal(report.images[1].coveredPixels,0);for(let y=80;y<176;y++)assert.equal(front[(y*256+128)*3],background,'the actual gap is not filled or post-smoothed');assert.equal(front[(128*256+80)*3]===background,false);
  }finally{for(const g of geometries)g.dispose();material.dispose();await rm(directory,{recursive:true,force:true});}
});
