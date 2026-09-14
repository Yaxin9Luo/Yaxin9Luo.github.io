import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRendering } from '../rendering.js';
import { createHaiyueRailStudy, haiyueRailViews } from './haiyue-rail-study.js';

const canvas = document.querySelector('canvas'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d8dfdb');
const camera = new THREE.PerspectiveCamera(38, 1, .015, 40), controls = new OrbitControls(camera, canvas); controls.enableDamping = false; controls.minDistance = .12; controls.maxDistance = 15;
const study = createHaiyueRailStudy(), errors = []; scene.add(study.group);
scene.add(new THREE.HemisphereLight(0xe2efff, 0x9e9a80, .8));
const sun = new THREE.DirectionalLight(0xffefd8, 3.1); sun.position.set(-2.5, 4, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -2.3; sun.shadow.camera.right = sun.shadow.camera.top = 2.3; sun.shadow.camera.near = .1; sun.shadow.camera.far = 12; sun.shadow.normalBias = .006; scene.add(sun);
const fill = new THREE.DirectionalLight(0xddeaff, .5); fill.position.set(2, 1.7, -1); scene.add(fill);
const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, 0); scene.environment = environment.texture; scene.environmentIntensity = .34; room.dispose(); pmrem.dispose();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshStandardMaterial({ color: 0xaaa99a, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; floor.receiveShadow = true; scene.add(floor);
const post = createRendering(renderer, scene, camera, { clipBox: new THREE.Box3(new THREE.Vector3(-2, -.3, -1), new THREE.Vector3(2, 2, 1)) }); post.setQuality('high');
let view = 'threequarter', serial = 0, disposed = false;
const info = () => ({ asset: 'haiyue-independent-carved-stone-rail', view, renderSerial: serial, native: { width: canvas.width, height: canvas.height, pixelRatio: renderer.getPixelRatio() }, camera: camera.position.toArray(), target: controls.target.toArray(), render: { ...renderer.info.render }, memory: { ...renderer.info.memory }, study: study.diagnostics, errors, disposed });
function render() { if (disposed) return; post.render(0); serial++; }
function setView(id) {
  const spec = id === 'back' ? { ...haiyueRailViews.front, direction: [-.3, .15, -1] } : haiyueRailViews[id]; if (!spec) throw new Error('Unknown rail inspection view');
  view = id; const box = new THREE.Box3();
  if (spec.groups.length) for (const name of spec.groups) box.union(new THREE.Box3().setFromObject(study.group.getObjectByName(name))); else box.setFromObject(study.group);
  if (spec.crop) { const min = box.min.clone(), size = box.getSize(new THREE.Vector3()); box.set(new THREE.Vector3(...spec.crop.min).multiply(size).add(min), new THREE.Vector3(...spec.crop.max).multiply(size).add(min)); }
  const target = box.getCenter(new THREE.Vector3()), direction = new THREE.Vector3(...spec.direction).normalize(), size = box.getSize(new THREE.Vector3()), radius = size.length() / 2, distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2) * spec.margin;
  camera.position.copy(target).addScaledVector(direction, distance); controls.target.copy(target); camera.lookAt(target); controls.update(); render();
}
function resize() { if (disposed) return; const { width, height } = canvas.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); post.resize(width, height, renderer.getPixelRatio()); render(); }
const observer = new ResizeObserver(resize); observer.observe(canvas); controls.addEventListener('change', render);
document.querySelector('select').addEventListener('change', e => setView(e.target.value));
document.querySelector('#night').addEventListener('change', e => { const night = e.target.checked; sun.intensity = night ? .15 : 3.1; fill.intensity = night ? .9 : .5; scene.environmentIntensity = night ? .16 : .34; scene.background.set(night ? '#1b2637' : '#d8dfdb'); renderer.toneMappingExposure = night ? 1.25 : 1; render(); });
function dispose() { if (disposed) return; disposed = true; observer.disconnect(); controls.dispose(); study.dispose(); floor.geometry.dispose(); floor.material.dispose(); environment.dispose(); sun.shadow.map?.dispose(); post.dispose(); renderer.dispose(); scene.clear(); }
window.addEventListener('error', e => errors.push(e.message)); window.addEventListener('unhandledrejection', e => errors.push(String(e.reason))); window.addEventListener('pagehide', dispose, { once: true });
window.__haiyueRailReview = { info, setView, render, dispose, study, renderer };
resize(); setView(new URLSearchParams(location.search).get('view') || 'threequarter');
document.querySelector('#state').textContent = '可旋转、缩放；双面实体刻工。';
