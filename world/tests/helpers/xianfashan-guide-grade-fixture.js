import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {extrudedPolygon} from '../../src/yuanmingyuan/study-geometry.js';
import {stripPolygon} from '../../src/yuanmingyuan/huanghuazhen-geometry.js';
import {createArchitectureSurface} from '../../src/yuanmingyuan/architecture-surface.js';
import {createMuseumGuideWorld} from '../../src/yuanmingyuan/museum-guide-world.js';
import {createMuseumLandscape} from '../../src/yuanmingyuan/museum-landscape.js';
import {museumSite} from '../../src/yuanmingyuan/museum-sites.js';
import {prepareTerrainPads,applyTerrainPads} from '../../src/yuanmingyuan/terrain-pads.js';

// Exact component calls and transforms used by xianfa-landscape-study / gate:
// only the west arrival paving, low enclosure and four piers, no asset factory.
// Terrain is the current small authored pad height field, not a reconstruction
// of every triangle in the production terrain; the 4 m mound-edge pad is used.
export function xianGuideFixture(){
  const site=museumSite('xianfashan'),root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),geometries=[],names=new Map();
  root.position.fromArray(site.position);root.rotation.y=site.rotationY;root.scale.setScalar(site.scale);
  function add(parent,geometry,name,position=[0,0,0]){const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(position);mesh.name=name;parent.add(mesh);geometries.push(geometry);names.set(mesh.uuid,name);return mesh;}
  const box=(parent,name,position,size,bevel)=>add(parent,new RoundedBoxGeometry(...size,1,Math.min(bevel,...size.map(x=>x/5))),name,position);
  add(root,extrudedPolygon(stripPolygon([[-44,0],[-24,0]],1.74),-.17,.04),'xianfashan-ground-approaches');
  for(const side of [-1,1]){
    const wall=new THREE.Group();wall.position.set(-38,0,side*17.4);wall.rotation.y=-Math.PI/2;root.add(wall);
    box(wall,`xianfashan-west-flank-${side}-body`,[0,1.22,0],[21.6,2.44,.54],.016);
    box(wall,`xianfashan-west-flank-${side}-lower-cornice`,[0,.18,.02],[21.74,.16,.66],.01);
  }
  const gate=new THREE.Group();gate.position.x=-38;gate.rotation.y=-Math.PI/2;root.add(gate);
  for(const x of [-6.04,-2.53,2.53,6.04]){
    box(gate,`xianfashan-west-gate-pier-${x}`,[x,2.83,.18],[.77,5.66,.94],.016);
    for(const y of [.12,.36])box(gate,`xianfashan-west-gate-pier-base-${x}-${y}`,[x,y,.31],[.93,.19,1.08],.01);
  }
  const replacement=createMuseumLandscape().replacements.find(r=>r.assetId==='xianfashan'),pads=prepareTerrainPads(replacement.prepared.pads);
  const wave=(x,z)=>Math.sin(x*.029+Math.sin(z*.018)*1.9)*.46+Math.cos(z*.024-x*.011)*.30+Math.sin(x*.091+z*.072)*.12;
  const height=(x,z)=>applyTerrainPads(x,z,4+wave(x,z)*.24,pads);
  let groundQueries=0;
  const terrain={colliders:[],surfaceAt(x,z){groundQueries++;const h=height(x,z),delta=.001,n=new THREE.Vector3(-(height(x+delta,z)-height(x-delta,z))/(2*delta),1,-(height(x,z+delta)-height(x,z-delta))/(2*delta)).normalize();return{height:h,normal:n,walkable:n.y>=Math.cos(Math.PI*35/180),surfaceId:'fixture-current-xian-pad-field',source:'current-authored-pad-height-field'};}};
  const architecture=createArchitectureSurface(root),world=createMuseumGuideWorld({site,terrain,architecture,centre:{x:883,z:-640}});
  return {site,root,terrain,architecture,world,pads,names,get groundQueries(){return groundQueries;},dispose(){world.dispose();architecture.dispose();for(const geometry of geometries)geometry.dispose();material.dispose();root.clear();}};
}
