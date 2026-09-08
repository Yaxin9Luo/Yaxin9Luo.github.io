import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {placementMatrix} from './foliage-lod.js';
import {bridges} from './locations.js';

const scans = new Map();
let pending = null;
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

export function loadScannedRockAssets() {
  if (pending) return pending;
  pending = Promise.all(ids.map(async id => {
    const {scene} = await new GLTFLoader().loadAsync(`/models/environment/scans/${id}.glb`);
    scene.updateMatrixWorld(true);
    const pieces = [];
    scene.traverse(object => {
      if (!object.isMesh) return;
      const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
      object.matrixWorld.decompose(position, rotation, scale);
      const geometry = object.geometry.clone(); geometry.applyQuaternion(rotation); geometry.scale(...scale.toArray());
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
    scans.set(id, pieces);
  })).catch(error => {pending = null; throw error;});
  return pending;
}

export function scannedRockReady() {return ids.every(id => scans.has(id));}

export function createScannedRockSpecimen(kind = 'face') {
  const id = kind === 'face' ? ids[0] : ids[1], group = new THREE.Group(); group.name = `Scanned ${kind} rock specimen`;
  const pieces = scans.get(id) || [];
  pieces.forEach((source, i) => {const mesh = source.clone(); mesh.position.set(kind === 'face' ? 0 : (i % 4 - 1.5) * 2.9, 0, kind === 'face' ? 0 : Math.floor(i / 4) * 2.6); group.add(mesh);});
  group.userData.assetReady = pieces.length > 0; return group;
}

/** Instanced real scans. Offline geometry factories can run before texture
 * loading; browser startup awaits loadScannedRockAssets and treats failure as
 * an asset-load error, so there is no procedural replacement at runtime. */
export function addScannedRocks(root, placements, name = 'Authored scanned fieldstone') {
  const group = new THREE.Group(); group.name = name; root.add(group);
  const batches = new Map(), entries = [];
  for (const [index, placement] of placements.entries()) {
    const id = placement.kind === 'face' ? ids[0] : ids[1], pieces = scans.get(id);
    if (!pieces) continue;
    const piece = (placement.piece ?? index) % pieces.length;
    const source=pieces[piece];
    if(!scanClearsBridgeDeck(source.geometry,placement))continue;
    const key = `${id}/${piece}/${Math.floor(placement.x / 36)},${Math.floor(placement.z / 36)}`;
    if (!batches.has(key)) batches.set(key, {source, placements: []});
    batches.get(key).placements.push(placement); entries.push({...placement, source: id, piece});
  }
  let triangles = 0;
  for (const [key, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.source.geometry, batch.source.material, batch.placements.length);
    mesh.name = `${name} / ${key}`;
    const tinted=batch.placements.some(p=>p.tint);
    batch.placements.forEach((placement, i) => {mesh.setMatrixAt(i, placementMatrix(placement));if(tinted)mesh.setColorAt(i,new THREE.Color(placement.tint||'#ffffff'));});
    mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    mesh.userData.scanSource = batch.source.userData.scanSource; group.add(mesh);
    triangles += batch.source.geometry.index.count / 3 * mesh.count;
  }
  group.userData = {assetReady: scannedRockReady(), placements: entries, instanceCount: entries.length, triangles};
  return group;
}
