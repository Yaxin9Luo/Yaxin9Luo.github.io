import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {inspectCopperSheepGeometry} from '../scripts/inspect-xieqiqu-copper-sheep.mjs';
import {createXieqiquCopperSheepStudy} from '../src/yuanmingyuan/xieqiqu-study.js';
import {copperSheepFeet,copperSheepMouth,copperSheepHoofSides,copperSheepEarSides,copperSheepComponentSpecs,copperSheepStudyViews} from '../src/yuanmingyuan/xieqiqu-copper-sheep.js';

let owner,core,tree,collisionGeometry,constructionSeconds;
const v=(...a)=>new THREE.Vector3(...a);
const part=id=>owner.group.getObjectByName('xieqiqu-south-copper-sheep-1-body-'+id).children[0];
before(()=>{const started=performance.now();owner=createXieqiquCopperSheepStudy();constructionSeconds=(performance.now()-started)/1000;core=part('continuous-anatomy');collisionGeometry=core.geometry.clone();tree=new MeshBVH(collisionGeometry,{indirect:true});});
after(()=>{collisionGeometry?.dispose();owner?.dispose();});
function hit(point,direction){return tree.raycastFirst(new THREE.Ray(v(...point),v(...direction)),THREE.DoubleSide);}
function inside(point){for(const direction of [[1,.173,.071],[-.213,1,.131],[.113,-.173,1]]){const cast=new THREE.Ray(v(...point),v(...direction).normalize()),found=tree.raycastFirst(cast,THREE.DoubleSide);if(!found||found.face.normal.dot(cast.direction)<=0)return false;}return true;}

test('a single welded boundary replaces the separate head, neck, chest, limbs and tail caps',()=>{
  const p=core.geometry.attributes.position,order=Uint32Array.from({length:p.count},(_,i)=>i),ids=new Uint32Array(p.count);
  // Sort actual Float32 coordinates; no tolerance merges distinct skin points.
  // Numeric edge codes bound memory instead of allocating millions of strings.
  order.sort((a,b)=>p.getX(a)-p.getX(b)||p.getY(a)-p.getY(b)||p.getZ(a)-p.getZ(b));
  let uniqueVertices=0,previous=-1;
  for(const at of order){if(previous<0||p.getX(at)!==p.getX(previous)||p.getY(at)!==p.getY(previous)||p.getZ(at)!==p.getZ(previous))uniqueVertices++;ids[at]=uniqueVertices-1;previous=at;}
  const parent=Uint32Array.from({length:uniqueVertices},(_,i)=>i),find=id=>{while(parent[id]!==id){parent[id]=parent[parent[id]];id=parent[id];}return id;},edges=new Float64Array(p.count),a=v(0,0,0),b=v(0,0,0),c=v(0,0,0);let volume=0;
  for(let i=0;i<p.count;i+=3){
    a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);volume+=a.dot(b.cross(c))/6;
    parent[find(ids[i+1])]=find(ids[i]);parent[find(ids[i+2])]=find(ids[i]);
    for(let j=0;j<3;j++){const x=ids[i+j],y=ids[i+(j+1)%3];edges[i+j]=2*(Math.min(x,y)*uniqueVertices+Math.max(x,y))+(x<y?0:1);}
  }
  edges.sort();let boundary=0;
  for(let i=0;i<edges.length;i+=2)if(Math.floor(edges[i]/2)!==Math.floor(edges[i+1]/2)||edges[i]%2===edges[i+1]%2)boundary++;
  assert.equal(boundary,0,'actual rendered edges close exactly with opposite winding');
  const root=find(0);for(let i=0;i<parent.length;i++)assert.equal(find(i),root,'all anatomy belongs to one skin');
  assert.ok(volume>.2&&volume<1,'positive bounded signed volume');assert.equal(uniqueVertices-edges.length/2+p.count/3,2,'closed genus-zero anatomical skin');
  console.log('SHEEP_SKIN_TOPOLOGY '+JSON.stringify({triangles:p.count/3,uniqueVertices,edges:edges.length/2,connectedComponents:1,boundaryEdges:boundary,signedVolume:volume,validation:'exact-coordinate sort and numeric directed-edge pairs'}));
});

test('every visible part has finite smooth normals and remains within the source placement envelope',()=>{
  let triangles=0;owner.group.traverse(node=>{if(!node.isMesh)return;const p=node.geometry.attributes.position,n=node.geometry.attributes.normal,uv=node.geometry.attributes.uv;assert.equal(n.count,p.count);assert.equal(uv.count,p.count);for(let i=0;i<p.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<2e-5,node.name+' normal '+i);}triangles+=(node.geometry.index?.count??p.count)/3;});
  assert.equal(triangles,owner.diagnostics.triangles);assert.ok(triangles<1450000);assert.ok(owner.diagnostics.bounds.size[0]<.95);assert.ok(owner.diagnostics.bounds.size[1]<1.85);assert.ok(owner.diagnostics.bounds.size[2]<2.35);assert.ok(Math.abs(owner.diagnostics.bounds.min[1])<.0001);
  assert.equal(owner.diagnostics.visualAcceptance,false);assert.equal(owner.diagnostics.integrationAcceptance,false);
});

test('authored smooth normals point outward on the actual continuous skin triangles',()=>{
  const p=core.geometry.attributes.position,n=core.geometry.attributes.normal,a=v(0,0,0),b=v(0,0,0),c=v(0,0,0),normal=v(0,0,0);let minimum=1;
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1).sub(a);c.fromBufferAttribute(p,i+2).sub(a);b.cross(c).normalize();normal.set(n.getX(i)+n.getX(i+1)+n.getX(i+2),n.getY(i)+n.getY(i+1)+n.getY(i+2),n.getZ(i)+n.getZ(i+1)+n.getZ(i+2)).normalize();const dot=b.dot(normal);minimum=Math.min(minimum,dot);assert.ok(dot>0,'inward shading on face '+i/3);}
  console.log('SHEEP_NORMALS '+JSON.stringify({minimumDotWithActualFace:minimum}));
});

test('the mouth is a real cavity at the unchanged source jet anchor, with solid lip and inner wall',()=>{
  assert.deepEqual(copperSheepMouth,[0,1.30,1.235]);assert.deepEqual(owner.diagnostics.mouthAnchor,copperSheepMouth);
  const outward=hit(copperSheepMouth,[0,0,1]);assert.equal(outward,null,'jet leaves through open air, not an external pipe cap');
  const inner=hit([0,1.30,1.5],[0,0,-1]);assert.ok(inner.point.z<1.14&&inner.point.z>1.03,'first surface is the recessed cavity back wall');
  for(const point of [[.060,1.30,1.5],[-.060,1.30,1.5],[0,1.341,1.5],[0,1.256,1.5]]){const lip=hit(point,[0,0,-1]);assert.ok(lip&&lip.point.z>1.20,'real lip surrounds the unchanged mouth datum');}
});

test('horn and ear root caps are buried inside the continuous head instead of exposed at a butt joint',()=>{
  for(const [id,sides]of [['horn--1',28],['horn-1',28],['ear--1',copperSheepEarSides],['ear-1',copperSheepEarSides]]){
    const geometry=part(id).geometry,p=geometry.attributes.position,start=p.count-sides*2*3,end=start+sides*3;
    for(let i=start;i<end;i++)assert.ok(inside([p.getX(i),p.getY(i),p.getZ(i)]),`${id}: exposed root cap ${i-start}`);
  }
});

test('cloven hooves have a flat sole at the existing plinth datum and upper caps embedded in the lower leg',()=>{
  for(let foot=0;foot<4;foot++)for(let toe=0;toe<2;toe++){
    const mesh=part(`hoof-${foot}-${toe}`),p=mesh.geometry.attributes.position,start=p.count-copperSheepHoofSides*3;
    for(let i=start;i<p.count;i++)assert.ok(inside([p.getX(i),p.getY(i),p.getZ(i)]),`foot ${foot}/${toe}: exposed upper cap`);
    const [x,,z]=copperSheepFeet[foot],sign=toe?1:-1,ray=new THREE.Raycaster(v(x+sign*.036,-.2,z+.013),v(0,1,0));const found=ray.intersectObject(mesh)[0];assert.ok(found);assert.ok(Math.abs(found.point.y)<.0001,'flat underside, no hovering hoof');
  }
});

test('source copper material and full original maps are used, with local ownership and no unused resources',()=>{
  const geometries=new Set(),materials=new Set(),textures=new Set();owner.group.traverse(node=>{if(!node.isMesh)return;geometries.add(node.geometry);materials.add(node.material);for(const value of Object.values(node.material))if(value?.isTexture)textures.add(value);assert.equal(node.material.userData.category,'copper');assert.equal(node.castShadow,true);assert.equal(node.receiveShadow,true);});
  assert.equal(geometries.size,copperSheepComponentSpecs.length);assert.equal(materials.size,2);assert.equal(textures.size,2);assert.equal(owner.diagnostics.resourceOwnership.geometries,geometries.size);
  for(const texture of textures){assert.equal(texture.image.width,96);assert.equal(texture.image.height,96);assert.equal(texture.image.data.length,96*96*4);}
  assert.equal(core.material.roughness,.70);assert.equal(core.material.metalness,.81);assert.deepEqual(core.material.normalScale.toArray(),[.10,.10]);
});

test('the production delta preserves all other source functions and the exact sheep water curve',async()=>{
  const current=await readFile(new URL('../src/yuanmingyuan/xieqiqu-study.js',import.meta.url),'utf8');
  const digest=text=>createHash('sha256').update(text).digest('hex');
  // Independently computed from the preserved pre-change source, excluding only
  // the owned sheep function span. The other sculptures/water/buildings are frozen.
  const unrelated=text=>text.slice(0,text.indexOf('function copperSheep('))+text.slice(text.indexOf('function copperSwallow('));
  const withoutImport=unrelated(current).replace("import { copperSheepComponentSpecs, copperSheepMouth } from './xieqiqu-copper-sheep.js';\n",'');assert.equal(digest(withoutImport),'613be509692386aed14676a4480218ea7bfccabb0cd25a1fe58e20ac30cda79e');
  const water=text=>{const start=text.indexOf('  const water = namedGroup',text.indexOf('function copperSheep('));return text.slice(start,text.indexOf('  return group;',start));};assert.equal(digest(water(current)),'bf243d1fda4d2121c4999a7bf9f56d1fd59d388672ceaaff3c95159ff23f1d29');
});

test('the head review crop includes the real mouth datum and both attached horn roots',()=>{
  assert.equal(Object.keys(copperSheepStudyViews).length,6);const spec=copperSheepStudyViews['head-join'],box=new THREE.Box3().setFromObject(owner.group),size=box.getSize(v(0,0,0)),minimum=box.min.clone();box.set(v(...spec.crop.min).multiply(size).add(minimum),v(...spec.crop.max).multiply(size).add(minimum));
  for(const point of [copperSheepMouth,[-.09,1.55,.785],[.09,1.55,.785]])assert.ok(box.containsPoint(v(...point)));
});

test('optional CPU diagnostics inspect the same tested owner without a second factory', {skip:!process.env.SHEEP_CPU_REVIEW_DIRECTORY},async()=>{
  await inspectCopperSheepGeometry(owner,process.env.SHEEP_CPU_REVIEW_DIRECTORY,{constructionSeconds});assert.ok(owner.group.children.length>0);
});

test('disposing the independent factory twice releases each owned resource once',()=>{
  const resources=new Set(),events=new Map();owner.group.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of [].concat(node.material??[])){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});for(const r of resources){events.set(r,0);r.addEventListener('dispose',()=>events.set(r,events.get(r)+1));}
  owner.dispose();owner.dispose();assert.ok([...events.values()].every(n=>n===1));assert.equal(owner.group.children.length,0);console.log('SHEEP_RESOURCE_DISPOSAL '+JSON.stringify({resources:resources.size,eachDisposedExactlyOnce:true}));
});
