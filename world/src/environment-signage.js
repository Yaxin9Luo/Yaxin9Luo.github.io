import * as THREE from 'three';
import {beveledBlock,assignArchitecturalUVs} from './architecture.js';
import {loadImageTexture} from './asset-cache.js';

export const environmentSignLabels = [
  {id:'about',en:'ABOUT',zh:'关于我',motif:'THE GRAND ACADEMY',motifZh:'中央魔法学院'},
  {id:'publications',en:'PAPERS',zh:'论文',motif:'THE INFINITE LIBRARY',motifZh:'无尽图书馆'},
  {id:'projects',en:'PROJECTS',zh:'作品',motif:'THE ARTIFICER’S ATELIER',motifZh:'造物者工坊'},
  {id:'journey',en:'EXPERIENCE',zh:'经历',motif:'THE WAYFARER’S RUINS',motifZh:'旅人的古迹'},
  {id:'research',en:'RESEARCH',zh:'研究',motif:'THE ASTRAL OBSERVATORY',motifZh:'星象研究台'},
  {id:'contact',en:'CONTACT · CV',zh:'联系 · 简历',motif:'THE OWL POST',motifZh:'猫头鹰邮局'},
];
const textures=new Map();
const faces=new Map();
export async function loadEnvironmentSignage(options={}){
  const results=await Promise.allSettled(environmentSignLabels.map(async label=>{
    if(textures.has(label.id))return;
    const texture=await loadImageTexture({id:`sign:${label.id}`,url:`/textures/wayfinding/${label.id}.png`,phase:2},options);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.name=`Bilingual ${label.id} enamel sign`;textures.set(label.id,texture);
    for(const material of faces.get(label.id)||[]){material.map=texture;material.needsUpdate=true;}
  }));
  return results.every(result=>result.status==='fulfilled');
}
export function createEnvironmentSign(id,stone){
  const label=environmentSignLabels.find(item=>item.id===id),group=new THREE.Group();group.name=`${label.en} / ${label.zh} — physical wayfinding`;
  const brass=new THREE.MeshStandardMaterial({color:'#b09b6b',metalness:.72,roughness:.48});
  const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
  for(const x of[-1.03,1.03]){
    add(assignArchitecturalUVs(beveledBlock(.34,1.25,.40,.045).clone()),stone,x,.61,0);
    add(beveledBlock(.41,.13,.47,.028),brass,x,1.24,0);
  }
  add(beveledBlock(3.08,1.25,.18,.055),brass,0,1.60,.02);
  const face=add(new THREE.PlaneGeometry(2.98,1.15),new THREE.MeshStandardMaterial({color:'#ffffff',map:textures.get(id)||null,metalness:.08,roughness:.69}),0,1.60,.116);
  face.name=`${label.en} / ${label.zh} / ${label.motif} / ${label.motifZh}`;
  face.userData.wayfindingLabel=label;
  if(!faces.has(id))faces.set(id,new Set());faces.get(id).add(face.material);face.material.addEventListener('dispose',()=>faces.get(id)?.delete(face.material));
  group.userData.label=label;
  return group;
}
