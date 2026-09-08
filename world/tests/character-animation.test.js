import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Vector3, Box3, Quaternion, PropertyBinding, Raycaster } from 'three';
import { loadCharacterAssets, createWizard, createWisp, updateCharacter, requestCharacterCast,
  cancelCharacterCast, CHARACTER_ACTION_TIMING, CHARACTER_GROUND_MOTION } from '../src/characters.js';

const modelRoot = new URL('../public/models/characters/', import.meta.url);
const originals = new Map();
let server;
let previousProgressEvent;

function parseGLB(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  const length = buffer.readUInt32LE(12);
  return { json: JSON.parse(buffer.toString('utf8', 20, 20 + length)), binary: buffer.subarray(28 + length) };
}

function decodePigmentPNG(png) {
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  let width, height, channels;
  const compressed = [];
  for (let cursor = 8; cursor < png.length;) {
    const length = png.readUInt32BE(cursor);
    const type = png.toString('ascii', cursor + 4, cursor + 8);
    const data = png.subarray(cursor + 8, cursor + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'pigment PNGs use eight-bit channels');
      assert.ok(data[9] === 2 || data[9] === 6, 'pigment PNGs use RGB or RGBA');
      assert.deepEqual([...data.subarray(10)], [0, 0, 0], 'standard compression with no interlacing');
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') compressed.push(data);
    cursor += length + 12;
    if (type === 'IEND') break;
  }
  const bytes = inflateSync(Buffer.concat(compressed));
  const stride = width * channels;
  assert.equal(bytes.length, height * (stride + 1));
  const pixels = new Uint8Array(height * stride);
  let input = 0;
  for (let y = 0; y < height; y++) {
    const filter = bytes[input++];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? pixels[index - channels] : 0;
      const up = y ? pixels[index - stride] : 0;
      const corner = y && x >= channels ? pixels[index - stride - channels] : 0;
      let prediction = 0;
      if (filter === 1) prediction = left;
      else if (filter === 2) prediction = up;
      else if (filter === 3) prediction = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - corner;
        const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
        prediction = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      pixels[index] = (bytes[input++] + prediction) & 255;
    }
  }
  return { width, height, channels, pixels };
}

// This test exercises the shipped mesh/skin/action data in Three.js. Node has no
// image decoder, so only the image/material table is omitted in the test response.
function geometryGLB(buffer) {
  const { json, binary } = parseGLB(buffer);
  delete json.images; delete json.textures; delete json.materials;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const text = Buffer.from(JSON.stringify(json));
  const length = Math.ceil(text.length / 4) * 4;
  const jsonChunk = Buffer.alloc(length, 32); text.copy(jsonChunk);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + length + binary.length, 8);
  header.writeUInt32LE(length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, binaryHeader, binary]);
}

function skinnedMeshes(group) {
  const result = [];
  group.traverse((node) => { if (node.isSkinnedMesh) result.push(node); });
  return result;
}

function setAction(group, name, time) {
  const { actions, mixer } = group.userData.characterAnimation;
  for (const [key, action] of actions) action.reset().play().setEffectiveWeight(key === name ? 1 : 0);
  mixer.setTime(time);
  group.updateMatrixWorld(true);
}

function worldPosition(group, name) {
  // GLTFLoader sanitizes punctuation in authored bone names for property bindings.
  const node = group.getObjectByName(PropertyBinding.sanitizeNodeName(name));
  assert.ok(node, `Missing exported character node ${name}`);
  return node.getWorldPosition(new Vector3());
}

before(async () => {
  previousProgressEvent = globalThis.ProgressEvent;
  if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, values) { this.type = type; Object.assign(this, values); }
  };
  for (const name of ['wizard', 'wraith']) originals.set(name, await readFile(new URL(`${name}.glb`, modelRoot)));
  server = createServer((request, response) => {
    const kind = request.url.includes('wizard.glb') ? 'wizard' : 'wraith';
    response.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
    response.end(geometryGLB(originals.get(kind)));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  await loadCharacterAssets({ baseURL: `http://127.0.0.1:${server.address().port}/` });
});

after(async () => {
  globalThis.ProgressEvent = previousProgressEvent;
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('published assets carry complete skins/actions and respect per-character budgets', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', modelRoot), 'utf8'));
  for (const [kind, buffer] of originals) {
    const { json } = parseGLB(buffer);
    const entry = manifest.assets.find((asset) => asset.file === `${kind}.glb`);
    assert.equal(entry.sha256, createHash('sha256').update(buffer).digest('hex'));
    assert.equal(entry.bytes, buffer.length);
    const triangles = json.meshes.flatMap((mesh) => mesh.primitives)
      .reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0);
    assert.equal(entry.triangles, triangles);
    assert.ok(triangles <= (kind === 'wizard' ? 500000 : 120000));
    assert.ok(buffer.length <= (kind === 'wizard' ? 24000000 : 12000000));
    assert.ok(json.skins.length >= 1);
    const required = kind === 'wizard' ? ['idle', 'cruise', 'turn_left', 'turn_right', 'boost', 'boost_start', 'boost_end', 'cast', 'ground_idle', 'walk', 'run', 'mount', 'dismount', 'ground_cast'] : ['idle', 'approach', 'channel'];
    assert.deepEqual(json.animations.map((clip) => clip.name).sort(), required.sort());
    for (const primitive of json.meshes.flatMap((mesh) => mesh.primitives)) {
      assert.ok(Number.isInteger(primitive.attributes.JOINTS_0));
      assert.ok(Number.isInteger(primitive.attributes.WEIGHTS_0));
      assert.ok(Number.isInteger(primitive.attributes.NORMAL));
    }
    if (kind === 'wizard') {
      for (const name of ['Academy midnight wool', 'Graphite twill riding trousers', 'Burgundy satin lining']) {
        const material = json.materials.find((item) => item.name === name);
        assert.ok(Number.isInteger(material?.normalTexture?.index), `${name} must export its woven normal map`);
        assert.ok(Number.isInteger(material?.pbrMetallicRoughness?.metallicRoughnessTexture?.index), `${name} must export its woven roughness`);
      }
    }
  }
});

test('exported cloth sheen preserves the authored low-intensity material finish', () => {
  const expected = {
    wizard: {
      'Academy midnight wool': .12,
      'Claret woven scarf': .12,
      'Burgundy satin lining': .055,
      'Graphite twill riding trousers': .055,
      'Tailored deep indigo facing': .055,
      'Claret worsted waistcoat': .055,
      'Warm ivory linen': .055,
      'Deep indigo wizard hat felt': .025,
    },
    wraith: {
      'Guardian indigo wool': .025,
      'Guardian twilight lining': .025,
      'Guardian moon blue satin': .08,
    },
  };
  for (const [kind, finishes] of Object.entries(expected)) {
    const { json } = parseGLB(originals.get(kind));
    for (const [name, weight] of Object.entries(finishes)) {
      const material = json.materials.find((item) => item.name === name);
      const sheen = material?.extensions?.KHR_materials_sheen;
      assert.equal(sheen?.sheenColorFactor?.length, 3, `${kind}: missing ${name} sheen`);
      // The authored tint is neutral. glTF has no separate sheen weight, so its
      // RGB factor must carry that weight instead of exporting full white.
      for (const channel of sheen.sheenColorFactor) {
        assert.ok(Math.abs(channel - weight) < 1e-6, `${name}: expected sheen ${weight}, received ${channel}`);
      }
      assert.ok(Math.abs(sheen.sheenRoughnessFactor - .6) < 1e-6, `${name}: sheen roughness changed`);
    }
  }
});

test('selected scan detail carries physical scale and traceable texture inputs', async () => {
  const provenance = JSON.parse(await readFile(new URL('source/sources.json', modelRoot), 'utf8'));
  assert.equal(provenance.generated.textureInputs.length, 6);
  for (const input of provenance.generated.textureInputs) {
    const bytes = await readFile(new URL(`../..${input.file}`, modelRoot));
    assert.equal(input.bytes, bytes.length);
    assert.equal(input.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  for (const [kind, entries] of [['wizard', [['Academy midnight wool', 'wool-cloth', .27],
    ['Tailored deep indigo facing', 'wool-cloth', .27], ['Claret worsted waistcoat', 'wool-cloth', .27],
    ['Dark walnut riding leather', 'dark-leather', .4]]],
    ['wraith', [['Guardian indigo wool', 'wool-cloth', .27]]]]) {
    const { json } = parseGLB(originals.get(kind));
    for (const [name, family, scale] of entries) {
      const material = json.materials.find(item => item.name === name);
      assert.equal(material.extras.surfaceFamily, family);
      assert.equal(material.extras.surfaceVariant, 'hybrid');
      assert.ok(Math.abs(material.extras.tileMeters - scale) < 1e-6);
      assert.ok(Number.isInteger(material.normalTexture.index));
      assert.ok(Number.isInteger(material.pbrMetallicRoughness.metallicRoughnessTexture.index));
    }
  }
});

test('embedded cloth pigment PNGs decode to the intended linear palette with subtle weave variation', t => {
  const palette = {
    wizard: {
      'Academy midnight wool': [.052, .105, .175],
      'Burgundy satin lining': [.22, .032, .048],
      'Graphite twill riding trousers': [.037, .054, .068],
      'Claret woven scarf': [.30, .052, .061],
      'Deep indigo wizard hat felt': [.017, .027, .052],
      'Tailored deep indigo facing': [.032, .061, .112],
      'Claret worsted waistcoat': [.22, .032, .048],
      'Warm ivory linen': [.64, .57, .43],
    },
    wraith: {
      'Guardian indigo wool': [.048, .087, .20],
      'Guardian twilight lining': [.027, .041, .084],
      'Guardian moon blue satin': [.085, .17, .31],
    },
  };
  for (const [kind, colors] of Object.entries(palette)) {
    const { json, binary } = parseGLB(originals.get(kind));
    for (const [name, expected] of Object.entries(colors)) {
      const material = json.materials.find(item => item.name === name);
      const pbr = material?.pbrMetallicRoughness;
      assert.ok(Number.isInteger(pbr?.baseColorTexture?.index), `${name}: missing pigment texture`);
      const image = json.images[json.textures[pbr.baseColorTexture.index].source];
      assert.equal(image.mimeType, 'image/png');
      const view = json.bufferViews[image.bufferView], offset = view.byteOffset || 0;
      const { width, height, channels, pixels } = decodePigmentPNG(binary.subarray(offset, offset + view.byteLength));
      const linearSum = [0, 0, 0], encodedSum = [0, 0, 0];
      let brightnessSum = 0, brightnessSquared = 0;
      for (let i = 0; i < pixels.length; i += channels) {
        let brightness = 0;
        for (let channel = 0; channel < 3; channel++) {
          const encoded = pixels[i + channel] / 255;
          // glTF baseColor textures are sRGB; material factors are linear.
          const linear = (encoded <= .04045 ? encoded / 12.92 : ((encoded + .055) / 1.055) ** 2.4)
            * (pbr.baseColorFactor?.[channel] ?? 1);
          encodedSum[channel] += pixels[i + channel]; linearSum[channel] += linear;
          brightness += linear;
        }
        brightnessSum += brightness; brightnessSquared += brightness * brightness;
      }
      const count = width * height, mean = linearSum.map(value => value / count);
      for (let channel = 0; channel < 3; channel++) {
        assert.ok(Math.abs(mean[channel] - expected[channel]) < .001,
          `${name}: channel ${channel} expected linear ${expected[channel]}, decoded ${mean[channel]}`);
      }
      const average = brightnessSum / count;
      const relativeVariation = Math.sqrt(Math.max(0, brightnessSquared / count - average * average)) / average;
      const scan = material.extras?.surfaceFamily === 'wool-cloth';
      assert.ok(relativeVariation > .005 && relativeVariation < (scan ? .16 : .04), `${name}: preserve dyed-fiber variation without full-scan mottling; relative variation ${relativeVariation}`);
      t.diagnostic(`${name}: RGB8 mean ${encodedSum.map(value => (value / count).toFixed(2))}; linear mean ${mean.map(value => value.toFixed(5))}; relative weave variation ${relativeVariation.toFixed(4)}`);
    }
  }
});

test('each character has independent bones and actions while sharing GPU geometry', () => {
  for (const factory of [createWizard, createWisp]) {
    const a = factory(); const b = factory();
    const am = skinnedMeshes(a); const bm = skinnedMeshes(b);
    assert.ok(am.length > 0);
    assert.equal(am.length, bm.length);
    for (let i = 0; i < am.length; i++) {
      assert.equal(am[i].geometry, bm[i].geometry);
      assert.equal(am[i].material, bm[i].material);
      assert.notEqual(am[i].skeleton, bm[i].skeleton);
      assert.notEqual(am[i].skeleton.bones[0], bm[i].skeleton.bones[0]);
      assert.equal(am[i].frustumCulled, false);
    }
    assert.notEqual(a.userData.characterAnimation.mixer, b.userData.characterAnimation.mixer);
    setAction(a, 'idle', .2); setAction(b, 'idle', 1.9);
    const head = a.userData.characterAnimation.head;
    assert.notDeepEqual(head.quaternion.toArray(), b.userData.characterAnimation.head.quaternion.toArray());
  }
});

test('rider actions maintain the broom seat and gripping hand, with bone-following sockets', () => {
  const rider = createWizard();
  assert.equal(rider.userData.wandTip, rider.getObjectByName('wandTip'));
  assert.equal(rider.userData.broomTail, rider.getObjectByName('broomTail'));
  setAction(rider, 'idle', 0);
  const pelvis = worldPosition(rider, 'pelvis');
  const grip = worldPosition(rider, 'hand.L');
  const broom = worldPosition(rider, 'broomTail');
  const wand = worldPosition(rider, 'wandTip');
  const elbow = worldPosition(rider, 'fore.L');
  const knee = worldPosition(rider, 'calf.L');
  let wandMotion = 0; let elbowMotion = 0; let kneeMotion = 0;
  for (const side of ['L', 'R']) assert.ok(rider.getObjectByName(PropertyBinding.sanitizeNodeName(`clavicle.${side}`)));
  for (const name of ['idle', 'cruise', 'turn_left', 'turn_right', 'boost']) {
    for (const time of [0, .5, 1, 2, 3, 3.95, 4, 8, 12]) {
      setAction(rider, name, time);
      assert.ok(worldPosition(rider, 'pelvis').distanceTo(pelvis) < 1e-5);
      assert.ok(worldPosition(rider, 'hand.L').distanceTo(grip) < 1e-5);
      assert.ok(worldPosition(rider, 'gripContact').distanceTo(grip) < .003, 'baked forearm IK must meet the gripping hand');
      assert.ok(worldPosition(rider, 'broomTail').distanceTo(broom) < 1e-5);
      wandMotion = Math.max(wandMotion, worldPosition(rider, 'wandTip').distanceTo(wand));
      elbowMotion = Math.max(elbowMotion, worldPosition(rider, 'fore.L').distanceTo(elbow));
      kneeMotion = Math.max(kneeMotion, worldPosition(rider, 'calf.L').distanceTo(knee));
    }
  }
  assert.ok(wandMotion > .003, 'wand socket must follow the animated wand hand');
  assert.ok(wandMotion < .15, 'the wand grip must remain controlled');
  assert.ok(elbowMotion > .015, 'shoulder and elbow must respond while the hand remains fixed');
  assert.ok(kneeMotion > .008, 'seated leg follow-through must change the knee pose');
});

test('one-shot action curves keep the seat, broom and supporting grip fixed', () => {
  const rider = createWizard();
  setAction(rider, 'idle', 0);
  const seat = worldPosition(rider, 'pelvis');
  const grip = worldPosition(rider, 'hand.L');
  const tail = worldPosition(rider, 'broomTail');
  for (const name of ['boost_start', 'boost_end', 'cast']) {
    const duration = rider.userData.characterAnimation.actions.get(name).getClip().duration;
    for (const phase of [0, .15, .3, .5, .75, .99, 1]) {
      setAction(rider, name, phase * duration);
      assert.ok(worldPosition(rider, 'pelvis').distanceTo(seat) < 1e-5, `${name}: seat drift`);
      assert.ok(worldPosition(rider, 'hand.L').distanceTo(grip) < 1e-5, `${name}: grip drift`);
      assert.ok(worldPosition(rider, 'gripContact').distanceTo(grip) < .003, `${name}: supporting elbow IK missed the handle`);
      assert.ok(worldPosition(rider, 'broomTail').distanceTo(tail) < 1e-5, `${name}: broom moved independently of seat`);
    }
  }
});

test('rider exports a complete mask and felt hat with no exposed-face material', () => {
  const rider = createWizard();
  for (const name of ['rider-mask', 'rider-hat-brim', 'rider-hat-crown']) {
    const node = rider.getObjectByName(name);
    assert.ok(node, `Missing ${name}`);
    assert.ok(skinnedMeshes(node).length > 0);
  }
  const { json } = parseGLB(originals.get('wizard'));
  assert.ok(json.materials.some((material) => material.name === 'Rider brushed antique silver'));
  assert.ok(json.materials.some((material) => material.name === 'Deep indigo wizard hat felt'));
  assert.ok(json.materials.every((material) => !/skin|iris|pupil|sclera/i.test(material.name)));
});

test('tailored rider has separate sleeves and a slim two-panel cape', () => {
  const rider = createWizard();
  for (const name of ['Tailored_coat_torso', 'Independent_set_in_sleeve_L', 'Independent_set_in_sleeve_R']) {
    assert.ok(rider.getObjectByName(name), `missing independently authored garment ${name}`);
  }
  const meshes = skinnedMeshes(rider.getObjectByName('rider-cape'));
  assert.ok(meshes.length >= 2, 'cape must preserve wool and substantial lining');
  const bounds = new Box3();
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox(); bounds.union(mesh.geometry.boundingBox);
  }
  const size = bounds.getSize(new Vector3());
  assert.ok(size.x < .85, `cape broadside silhouette widened to ${size.x}`);
  assert.ok(size.y > .8, 'heavy cape must descend below shoulder height');
  assert.ok(size.z > .9 && size.z < 1.4, 'cape should trail with a bounded gravity silhouette');
});

test('upper cape clears the underlying coat in neutral, boost and cast poses', () => {
  const rider = createWizard();
  const torso = rider.getObjectByName('Tailored_coat_torso');
  const cape = rider.getObjectByName('rider-cape');
  const ray = new Raycaster(); let samples = 0;
  for (const [action, time] of [['idle', 0], ['boost', 1.3], ['cast', .18], ['boost_start', .15]]) {
    setAction(rider, action, time);
    for (const x of [-.15, -.06, .06, .15]) for (const y of [.43, .50, .57, .63]) {
      ray.set(new Vector3(x, y, 2), new Vector3(0, 0, -1));
      const bodyHit = ray.intersectObject(torso, true)[0];
      const capeHit = ray.intersectObject(cape, true)[0];
      if (!bodyHit || !capeHit) continue;
      samples++;
      assert.ok(capeHit.point.z > bodyHit.point.z + .003,
        `${action}: cape cuts through upper back at x=${x}, y=${y}; gap=${capeHit.point.z - bodyHit.point.z}`);
    }
  }
  assert.ok(samples >= 32, `expected representative upper-back intersections, found ${samples}`);
});

test('thin chest layers remain outside the coat through flight and cast deformation', t => {
  const rider = createWizard();
  const torso = rider.getObjectByName('Tailored_coat_torso');
  const ray = new Raycaster(); let samples = 0, smallestGap = Infinity;
  const layers = ['Notched riding lapel -1', 'Notched riding lapel 1',
    'Claret waistcoat panel -1', 'Claret waistcoat panel 1', 'Inset ivory linen shirt'];
  for (const [action, time] of [['idle', 0], ['boost', 1.3], ['cast', .18], ['cast', .45], ['boost_start', .15]]) {
    setAction(rider, action, time);
    for (const name of layers) {
      const layer = rider.getObjectByName(PropertyBinding.sanitizeNodeName(name));
      assert.ok(layer?.isSkinnedMesh, `${name}: keep the independently cut chest panel`);
      const positions = layer.geometry.attributes.position;
      const checkPoint = point => {
        ray.set(new Vector3(point.x, point.y, -1.5), new Vector3(0, 0, 1));
        const hit = ray.intersectObject(torso, true)[0];
        if (!hit) return;
        const gap = hit.point.z - point.z;
        samples++; smallestGap = Math.min(smallestGap, gap);
        assert.ok(gap > .001, `${action} ${name}: layer crosses the coat at ${point.toArray()}; gap ${gap}`);
      };
      for (let i = 0; i < positions.count; i += 47) {
        checkPoint(layer.getVertexPosition(i, new Vector3()).applyMatrix4(layer.matrixWorld));
      }
      const indices = layer.geometry.index;
      for (let i = 0; i < indices.count; i += 177) {
        const center = new Vector3();
        for (let j = 0; j < 3; j++) center.add(layer.getVertexPosition(indices.getX(i + j), new Vector3()));
        checkPoint(center.divideScalar(3).applyMatrix4(layer.matrixWorld));
      }
    }
  }
  assert.ok(samples > 200, `expected representative panel intersections, found ${samples}`);
  t.diagnostic(`Chest layers: ${samples} deformed surface samples; minimum forward clearance ${(smallestGap * 1000).toFixed(2)} mm`);
});

test('exported cloth changes shape, loops continuously and stays finite for every action', () => {
  for (const factory of [createWizard, createWisp]) {
    const group = factory();
    const meshes = skinnedMeshes(group);
    // Multi-material glTF nodes are Groups with one SkinnedMesh per primitive.
    const cloth = factory === createWizard ? skinnedMeshes(group.getObjectByName('rider-cape'))[0] : meshes[0];
    const index = cloth.geometry.attributes.position.count - 1;
    let clothMotion = 0;
    const bounds = new Box3();
    for (const name of group.userData.characterAnimation.actions.keys()) {
      const duration = group.userData.characterAnimation.actions.get(name).getClip().duration;
      const oneShotDuration = { boost_start: .2, boost_end: .35, cast: .6, ground_cast:.6, mount:1.2, dismount:1.2 }[name];
      if (factory === createWizard) assert.ok(Math.abs(duration - (oneShotDuration || {ground_idle:2,walk:1,run:.7}[name] || 4)) < 1e-5, 'clips must start at zero and use the authored duration');
      setAction(group, name, 0);
      const start = cloth.getVertexPosition(index, new Vector3());
      for (const time of [0, .0625, .125, .25, .375, .5, .625, .75, .875, .999975].map((phase) => phase * duration)) {
        setAction(group, name, time);
        const moving = cloth.getVertexPosition(index, new Vector3());
        clothMotion = Math.max(clothMotion, moving.distanceTo(start));
        for (const mesh of meshes) {
          const positions = mesh.geometry.attributes.position;
          for (let i = 0; i < positions.count; i += 53) {
            const vertex = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
            assert.ok(vertex.toArray().every(Number.isFinite));
            bounds.expandByPoint(vertex);
          }
        }
      }
      setAction(group, name, duration - .0001);
      const loopDistance = cloth.getVertexPosition(index, new Vector3()).distanceTo(start);
      if (!oneShotDuration) assert.ok(loopDistance < .003, `${group.userData.characterAnimation.kind} ${name} loop seam: ${loopDistance}`);
    }
    assert.ok(clothMotion > .012, 'cloth must actually deform across a loop');
    const size = bounds.getSize(new Vector3());
    assert.ok(size.x < 4 && size.y < 4 && size.z < 5, `unexpected animated extent ${size.toArray()}`);
  }
});

test('input blending changes the pose and reduced-motion holds a chosen idle frame', () => {
  const rider = createWizard();
  const head = rider.userData.characterAnimation.head;
  const before = head.quaternion.clone();
  for (let i = 0; i < 90; i++) updateCharacter(rider, { dt: 1 / 60, speed: 1, turn: -.8, vertical: .2 });
  assert.ok(head.quaternion.angleTo(before) > .04);
  const sum = [...rider.userData.characterAnimation.weights.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-5);
  updateCharacter(rider, { dt: .016, reducedMotion: true });
  const frozen = head.quaternion.clone();
  const cloth = skinnedMeshes(rider.getObjectByName('rider-cape'))[0];
  rider.updateMatrixWorld(true);
  const frozenVertex = cloth.getVertexPosition(0, new Vector3());
  for (let i = 0; i < 60; i++) updateCharacter(rider, { dt: .016, speed: 1, turn: 1, reducedMotion: true });
  rider.updateMatrixWorld(true);
  assert.deepEqual(head.quaternion.toArray(), frozen.toArray());
  assert.ok(cloth.getVertexPosition(0, new Vector3()).distanceTo(frozenVertex) < 1e-8);
});

function assertNormalized(group) {
  const { actions, weights } = group.userData.characterAnimation;
  const sum = [...weights.values()].reduce((a, b) => a + b, 0);
  const effective = [...actions.values()].reduce((a, action) => a + action.getEffectiveWeight(), 0);
  assert.ok(Math.abs(sum - 1) < 1e-10, `stored action sum ${sum}`);
  assert.ok(Math.abs(effective - 1) < 1e-10, `effective action sum ${effective}`);
  for (const weight of weights.values()) assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1);
}

test('explicit boost intent starts immediately and interruptions settle into the latest intent', () => {
  const rider = createWizard();
  const animation = rider.userData.characterAnimation;
  updateCharacter(rider, { dt: .016, speed: 0, boost: true });
  assert.equal(animation.transition.name, 'boost_start');
  assert.ok(animation.weights.get('boost_start') > .25, 'start pose must react before speed has risen');
  updateCharacter(rider, { dt: .02, speed: .25, boost: false });
  assert.equal(animation.transition.name, 'boost_end');
  updateCharacter(rider, { dt: .01, speed: .3, boost: true });
  assert.equal(animation.transition.name, 'boost_start');
  assert.ok(Math.abs(animation.actions.get('boost_start').time - .01) < 1e-9, 'interrupted start restarts at its first sample');
  for (let i = 0; i < 90; i++) {
    updateCharacter(rider, { dt: 1 / 60, speed: 1, boost: true });
    assertNormalized(rider);
  }
  assert.equal(animation.transition, null);
  assert.ok(animation.weights.get('boost') > .999);
  for (let i = 0; i < 100; i++) {
    updateCharacter(rider, { dt: 1 / 60, speed: .45, boost: false });
    assertNormalized(rider);
  }
  assert.equal(animation.transition, null);
  assert.ok(animation.weights.get('cruise') > .999);
  assert.ok(animation.weights.get('boost_start') < 1e-7 && animation.weights.get('boost_end') < 1e-7);
});

test('cast uses the shipped authored action, releases once, then returns to flight', () => {
  const rider = createWizard();
  const wandBefore = worldPosition(rider, 'wandTip');
  const request = requestCharacterCast(rider);
  assert.deepEqual(request, { accepted: true, releaseDelay: .18, duration: .6, sequence: 1 });
  assert.equal(CHARACTER_ACTION_TIMING.castRelease, .18);
  let events = 0; let releaseAt = 0; let maximumTravel = 0;
  for (let frame = 1; frame <= 100; frame++) {
    const event = updateCharacter(rider, { dt: .01, speed: .45, boost: false });
    if (event.castReleased) { events++; releaseAt = frame * .01; assert.equal(event.castSequence, request.sequence); }
    rider.updateMatrixWorld(true);
    maximumTravel = Math.max(maximumTravel, worldPosition(rider, 'wandTip').distanceTo(wandBefore));
    assertNormalized(rider);
  }
  assert.equal(events, 1);
  assert.ok(Math.abs(releaseAt - .18) < 1e-9);
  assert.ok(maximumTravel > .2, `cast must visibly wind up and extend the wand: ${maximumTravel}`);
  assert.equal(rider.userData.characterAnimation.cast.active, false);
  assert.ok(rider.userData.characterAnimation.weights.get('cast') < 1e-5);
  assert.ok(rider.userData.characterAnimation.weights.get('cruise') > .999);
});

test('repeated cast requests and cancellation cannot emit a stale release', () => {
  const rider = createWizard();
  const a = requestCharacterCast(rider);
  updateCharacter(rider, { dt: .1, speed: .4 });
  const b = requestCharacterCast(rider);
  assert.equal(b.sequence, a.sequence + 1);
  assert.equal(updateCharacter(rider, { dt: .1 }).castReleased, false);
  const event = updateCharacter(rider, { dt: .1 });
  assert.equal(event.castReleased, true);
  assert.equal(event.castSequence, b.sequence);
  assert.equal(updateCharacter(rider, { dt: .1 }).castReleased, false);
  const c = requestCharacterCast(rider);
  updateCharacter(rider, { dt: .1 });
  assert.equal(cancelCharacterCast(rider), true);
  assertNormalized(rider);
  for (let i = 0; i < 10; i++) assert.equal(updateCharacter(rider, { dt: .1 }).castReleased, false);
  assert.equal(rider.userData.characterAnimation.cast.sequence, c.sequence);
  assert.equal(cancelCharacterCast(rider), false);
});

test('pause and zero dt freeze pose, cloth, blend state and cast event clock', () => {
  const rider = createWizard();
  requestCharacterCast(rider);
  updateCharacter(rider, { dt: .1, boost: true, speed: .2, vertical: .7 });
  const snapshot = () => {
    const poses = [];
    rider.traverse(node => { if (node.isBone) poses.push([...node.position.toArray(), ...node.quaternion.toArray()]); });
    const a = rider.userData.characterAnimation;
    return JSON.stringify({ poses, time: a.mixer.time, cast: a.cast, transition: a.transition, weights: [...a.weights] });
  };
  const before = snapshot();
  for (let i = 0; i < 20; i++) {
    assert.equal(updateCharacter(rider, { dt: 0, boost: false, vertical: -1 }).castReleased, false);
    assert.equal(updateCharacter(rider, { dt: .1, paused: true, boost: false, reducedMotion: true }).castReleased, false);
  }
  assert.equal(snapshot(), before);
  assert.equal(updateCharacter(rider, { dt: .079, boost: true }).castReleased, false);
  assert.equal(updateCharacter(rider, { dt: .021, boost: true }).castReleased, true);
});

test('reduced motion retains one cast release event while holding a static pose', () => {
  const rider = createWizard();
  updateCharacter(rider, { dt: .016, reducedMotion: true });
  const head = rider.userData.characterAnimation.head;
  const before = head.quaternion.clone();
  requestCharacterCast(rider);
  let events = 0;
  for (let i = 0; i < 12; i++) {
    const event = updateCharacter(rider, { dt: .1, speed: 1, boost: true, reducedMotion: true });
    events += Number(event.castReleased);
    assert.equal(head.quaternion.angleTo(before), 0);
    assertNormalized(rider);
  }
  assert.equal(events, 1);
  assert.equal(rider.userData.characterAnimation.cast.active, false);
  const next = requestCharacterCast(rider);
  updateCharacter(rider, { dt: .1, reducedMotion: true });
  const event = updateCharacter(rider, { dt: .1, reducedMotion: false });
  assert.equal(event.castSequence, next.sequence);
  assert.equal(event.castReleased, true);
  assert.ok(rider.userData.characterAnimation.weights.get('cast') > 0);
});

test('cape follows a torso turn with delayed orientation and settles without unstable weights', () => {
  const rider = createWizard();
  const cape = rider.getObjectByName(PropertyBinding.sanitizeNodeName('cape.C0'));
  const chest = rider.getObjectByName('chest');
  rider.updateMatrixWorld(true);
  const beforeCape = cape.getWorldQuaternion(new Quaternion());
  const beforeChest = chest.getWorldQuaternion(new Quaternion());
  rider.rotation.y = .8;
  updateCharacter(rider, { dt: .016 });
  const capeMotion = cape.getWorldQuaternion(new Quaternion()).angleTo(beforeCape);
  const torsoMotion = chest.getWorldQuaternion(new Quaternion()).angleTo(beforeChest);
  assert.ok(torsoMotion > .7 && capeMotion < torsoMotion * .6, 'cloth must lag a sharp torso turn');
  for (let i = 0; i < 100; i++) { updateCharacter(rider, { dt: .016 }); assertNormalized(rider); }
  const settled = cape.getWorldQuaternion(new Quaternion()).angleTo(beforeCape);
  assert.ok(settled > .7 && settled < .9, 'cape must settle behind the torso rather than lag indefinitely');
});


test('ground poses plant sole anchors and isolated broom visibility preserves clothing and wand',()=>{
 const rider=createWizard();setAction(rider,'ground_idle',0);
 for(const side of ['L','R'])assert.ok(Math.abs(worldPosition(rider,'sole.'+side).y-CHARACTER_GROUND_MOTION.soleY)<.003,side+' '+worldPosition(rider,'sole.'+side).y);
 const feet=rider.userData.characterAnimation.feet;assert.equal(feet.length,2);
 updateCharacter(rider,{dt:.02,mode:'grounded'});
 const parts=rider.userData.characterAnimation.broom;assert.ok(parts.length>=3);assert.ok(parts.every(p=>!p.visible));
 assert.equal(rider.getObjectByName('rider-mask').visible,true);assert.ok(rider.userData.wandTip);
 updateCharacter(rider,{dt:.02,mode:'flying'});assert.ok(parts.every(p=>p.visible));
});
test('authored stance foot displacement cancels world travel throughout walk and run contact',()=>{
 const rider=createWizard();
 for(const [name,speed,duration,contact]of [['walk',1.6,1,.58],['run',3.8,.7,.36]]){
  for(const side of ['L','R']){
   const offset=side==='L'?0:.5;let origin;
   for(const p of [.025,.075,.15,.25,.33].filter(p=>p<contact)){
    const phase=(p-offset+1)%1;setAction(rider,name,phase*duration);
    const foot=worldPosition(rider,'sole.'+side);foot.z-=speed*p*duration;
    if(!origin)origin=foot.clone();
    assert.ok(Math.abs(foot.y-CHARACTER_GROUND_MOTION.soleY)<.006,`${name} ${side} foot height ${foot.y}`);
    assert.ok(Math.abs(foot.z-origin.z)<.006,`${name} ${side} foot slid ${foot.z-origin.z}`);
   }
  }
 }
});
test('grounded cast retains a standing pose and emits its release once even with reduced motion',()=>{
 for(const reducedMotion of [false,true]){
  const rider=createWizard();updateCharacter(rider,{dt:.02,mode:'grounded'});
  assert.equal(requestCharacterCast(rider).accepted,true);let releases=0;
  for(let i=0;i<45;i++){const result=updateCharacter(rider,{dt:.02,mode:'grounded',reducedMotion});releases+=Number(result.castReleased);}
  assert.equal(releases,1);assert.ok(Math.abs(worldPosition(rider,'sole.L').y-CHARACTER_GROUND_MOTION.soleY)<.003);
 }
});
test('mount and dismount endpoints match standing and flight while pause freezes the selected transition',()=>{
 const rider=createWizard();
 setAction(rider,'ground_idle',0);const standing=worldPosition(rider,'head');
 setAction(rider,'mount',0);assert.ok(worldPosition(rider,'head').distanceTo(standing)<.001);
 setAction(rider,'idle',0);const flying=worldPosition(rider,'head');
 setAction(rider,'mount',1.2);assert.ok(worldPosition(rider,'head').distanceTo(flying)<.002);
 for(const name of ['sole.L','sole.R','calf.L','calf.R','hand.L']){setAction(rider,'idle',0);const expected=worldPosition(rider,name);setAction(rider,'mount',1.2);assert.ok(worldPosition(rider,name).distanceTo(expected)<.003,name+' mount endpoint');}
 updateCharacter(rider,{dt:.02,mode:'mounting',transitionProgress:.5});const midpoint=worldPosition(rider,'head');
 updateCharacter(rider,{dt:.02,paused:true,mode:'mounting',transitionProgress:1});assert.ok(worldPosition(rider,'head').distanceTo(midpoint)<1e-9);
});

test('ground contact report measures dense samples and standing body clearance',t=>{
 const rider=createWizard();let maxHeight=0,maxDrift=0;
 for(const [name,speed,duration,contact]of [['walk',1.6,1,.58],['run',3.8,.7,.36]])for(const side of ['L','R']){
  let origin;for(let i=1;i<36;i++){
   const p=contact*i/36,phase=(p-(side==='L'?0:.5)+1)%1;setAction(rider,name,phase*duration);
   const foot=worldPosition(rider,'sole.'+side);foot.z-=speed*p*duration;
   origin??=foot.clone();maxHeight=Math.max(maxHeight,Math.abs(foot.y-CHARACTER_GROUND_MOTION.soleY));maxDrift=Math.max(maxDrift,Math.abs(foot.z-origin.z));
  }
 }
 setAction(rider,'ground_idle',0);const bounds=new Box3();
 for(const mesh of skinnedMeshes(rider)){
  if(mesh.userData.broomPart)continue;
  for(let i=0;i<mesh.geometry.attributes.position.count;i+=13)bounds.expandByPoint(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
 }
 t.diagnostic(`Ground sole height error ${(maxHeight*1000).toFixed(3)} mm; stance drift ${(maxDrift*1000).toFixed(3)} mm; stand bounds ${bounds.min.toArray()} / ${bounds.max.toArray()}; full height above sole ${(bounds.max.y-CHARACTER_GROUND_MOTION.soleY).toFixed(3)} m`);
 assert.ok(maxHeight<.006);assert.ok(maxDrift<.006);
});

test('runtime foot correction follows a slope and preserves pause without changing actor displacement',()=>{
 const rider=createWizard();rider.position.y=1.3;
 const support={x:0,z:0,y:0,normal:{x:-.2,y:1,z:0}};
 updateCharacter(rider,{dt:.02,mode:'grounded',groundSupport:support});
 for(const side of ['L','R']){const sole=worldPosition(rider,'sole.'+side);assert.ok(Math.abs(sole.y-.2*sole.x)<.007,side+' slope '+sole.y);}
 const before=worldPosition(rider,'sole.L');updateCharacter(rider,{dt:.1,paused:true,mode:'grounded',groundSupport:{...support,y:4}});
 assert.ok(worldPosition(rider,'sole.L').distanceTo(before)<1e-9);assert.equal(rider.position.y,1.3);
});

test('actual distance motion retains the stance foot through idle-to-walk blending',()=>{
 const rider=createWizard();rider.position.y=1.3;const groundSupport={x:0,z:0,y:0,normal:{x:0,y:1,z:0}};
 updateCharacter(rider,{dt:.02,mode:'grounded',groundSupport});const planted=worldPosition(rider,'sole.L');
 for(let i=1;i<=10;i++){rider.position.z=-i*.032;updateCharacter(rider,{dt:.02,mode:'grounded',groundSpeed:1.6,gaitPhase:.29+i*.02,groundSupport});const foot=worldPosition(rider,'sole.L');assert.ok(foot.distanceTo(planted)<.007,'frame '+i+' stance shifted '+foot.distanceTo(planted)+' lock '+JSON.stringify(rider.userData.characterAnimation.feet[0].lock));}
});
