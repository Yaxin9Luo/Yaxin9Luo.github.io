import * as THREE from 'three';
import {loadGLTF,mutableGeometry} from './gltf-resource.js';
import {placementMatrix} from './foliage-lod.js';
import {bridges} from './locations.js';

const scans = new Map();
const pending = new Map();
const batchState = new WeakMap();
let revision=0;
const ids = ['rock_face_02', 'rock_moss_set_02'];

export function scannedRockSource(kind='moss',piece=0){
  const pieces=scans.get(kind==='face'?ids[0]:ids[1]);return pieces?.[piece%pieces.length]||null;
}

export function scanClearsBridgeDeck(geometry,placement){
  const box=geometry.boundingBox,matrix=placementMatrix(placement),corners=[];
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
  if(Math.max(...corners.map(p=>p.y))<6.45)return true;
  for(const [a,b]of Object.values(bridges)){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    const along=corners.map(p=>(p.x-a[0])*dx+(p.z-a[1])*dz),across=corners.map(p=>(p.x-a[0])*dz-(p.z-a[1])*dx);
    if(Math.min(...along)<length+3&&Math.max(...along)>-3&&Math.min(...across)<3.8&&Math.max(...across)>-3.8)return false;
  }
  return true;
}

export function loadScannedRockAssets(options={}) {
  const {loadGLTFImpl=loadGLTF,...resourceOptions}=options;
  const variant=options.variant||'full';
  if (pending.has(variant)) return pending.get(variant);
  const request = Promise.allSettled(ids.map(async id => {
    const resourceId=variant==='preview'?`${id}-preview`:`/models/environment/scans/${id}.glb`;
    const {scene} = await loadGLTFImpl({id:resourceId,url:`/models/environment/scans/${id}.glb`,phase:2},resourceOptions);
    scene.updateMatrixWorld(true);
    const pieces = [];
    scene.traverse(object => {
      if (!object.isMesh) return;
      const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
      object.matrixWorld.decompose(position, rotation, scale);
      const geometry = mutableGeometry(object.geometry); geometry.applyQuaternion(rotation); geometry.scale(...scale.toArray());
      geometry.userData.sharedAsset=true;
      geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new THREE.Vector3()), bottom = geometry.boundingBox.min.y;
      geometry.translate(-center.x, -bottom, -center.z); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const material = object.material;
      material.name = `CC0 scan / ${id}`;
      material.userData.scanSource = `https://polyhaven.com/a/${id}`;
      material.userData.license = 'CC0-1.0';
      for (const channel of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (material[channel]) material[channel].anisotropy = 8;
      const mesh = new THREE.Mesh(geometry, material); mesh.name = object.name; mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.scanSource = material.userData.scanSource; mesh.userData.sourcePiece = object.name;
      pieces.push(mesh);
    });
    if (!pieces.length) throw new Error(`Scanned rock asset has no geometry: ${id}`);
    // A late preview cannot replace a full-resolution template.
    if(variant==='full'||scans.get(id)?.variant!=='full'){pieces.variant=variant;scans.set(id,pieces);revision++;}
  })).then(results=>{const ready=results.every(result=>result.status==='fulfilled');if(!ready)pending.delete(variant);return ready;});
  pending.set(variant,request);return request;
}

export function scannedRockReady() {return ids.every(id => scans.has(id));}

export function createScannedRockSpecimen(kind = 'face') {
  const id = kind === 'face' ? ids[0] : ids[1], group = new THREE.Group(); group.name = `Scanned ${kind} rock specimen`;
  const pieces = scans.get(id) || [];
  pieces.forEach((source, i) => {const mesh = source.clone(); mesh.position.set(kind === 'face' ? 0 : (i % 4 - 1.5) * 2.9, 0, kind === 'face' ? 0 : Math.floor(i / 4) * 2.6); group.add(mesh);});
  group.userData.assetReady = pieces.length > 0; return group;
}

/** Keep authored intent before assets arrive. Optional per-source placement and
 * material factories are reapplied for every preview/full revision. Materials
 * returned by the factory belong to this batch unless they are the source. */
export function addScannedRocks(root, placements, name = 'Authored scanned fieldstone', options = {}) {
  const group = new THREE.Group(); group.name = name; root.add(group);
  populateScannedRocks(group,placements,options);return group;
}

function populateScannedRocks(group,placements,options){
  const batches = new Map(), entries = [], materials = new Map(), ownedMaterials = new Set();
  for (const [index, intent] of placements.entries()) {
    const id = intent.kind === 'face' ? ids[0] : ids[1], pieces = scans.get(id);
    if (!pieces) continue;
    const piece = (intent.piece ?? index) % pieces.length;
    const source=pieces[piece],placement=options.resolvePlacement?.(intent,source)||intent;
    if(!scanClearsBridgeDeck(source.geometry,placement))continue;
    const key = `${id}/${piece}/${Math.floor(placement.x / 36)},${Math.floor(placement.z / 36)}`;
    if (!batches.has(key)) batches.set(key, {source, placements: []});
    batches.get(key).placements.push(placement); entries.push({...placement, source: id, piece});
  }
  let triangles = 0;
  for (const [key, batch] of batches) {
    const sourceMaterial=batch.source.material;
    if(!materials.has(sourceMaterial)){
      const material=options.materialFactory?.(sourceMaterial)||sourceMaterial;materials.set(sourceMaterial,material);
      if(material!==sourceMaterial)ownedMaterials.add(material);
    }
    const mesh = new THREE.InstancedMesh(batch.source.geometry, materials.get(sourceMaterial), batch.placements.length);
    mesh.name = `${group.name} / ${key}`;
    const tinted=batch.placements.some(p=>p.tint);
    batch.placements.forEach((placement, i) => {mesh.setMatrixAt(i, placementMatrix(placement));if(tinted)mesh.setColorAt(i,new THREE.Color(placement.tint||'#ffffff'));});
    mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    mesh.userData.scanSource = batch.source.userData.scanSource; group.add(mesh);
    triangles += batch.source.geometry.index.count / 3 * mesh.count;
  }
  Object.assign(group.userData,{assetReady: scannedRockReady(), revision, placements: entries, sourcePlacements:placements, scanBatch:true, instanceCount: entries.length, triangles});
  batchState.set(group,{options,ownedMaterials});
}

export function hydrateScannedRocks(root){
  if(!scans.size)return;
  const pending=[];root.traverse(object=>{if(object.userData.scanBatch&&object.userData.revision!==revision)pending.push(object);});
  for(const group of pending){
    const {options={},ownedMaterials=new Set()}=batchState.get(group)||{};
    group.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});ownedMaterials.forEach(material=>material.dispose());group.clear();
    populateScannedRocks(group,group.userData.sourcePlacements,options);
    // Preserve group identity, authored transforms and external registration.
    group.dispatchEvent({type:'scanhydrated',disposedMaterials:ownedMaterials});
  }
}
