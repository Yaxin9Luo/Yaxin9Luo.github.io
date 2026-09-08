import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Vector3, Box3, PropertyBinding } from 'three';
import { loadCharacterAssets, createWizard, createWisp, updateCharacter } from '../src/characters.js';

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
  for (const [key, action] of actions) action.setEffectiveWeight(key === name ? 1 : 0);
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
    assert.ok(triangles <= (kind === 'wizard' ? 400000 : 30000));
    assert.ok(buffer.length <= (kind === 'wizard' ? 12000000 : 3000000));
    assert.ok(json.skins.length >= 1);
    const required = kind === 'wizard' ? ['idle', 'cruise', 'turn_left', 'turn_right', 'boost'] : ['idle', 'approach', 'channel'];
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

test('embedded cloth pigment PNGs decode to the intended linear palette with subtle weave variation', t => {
  const palette = {
    wizard: {
      'Academy midnight wool': [.052, .105, .175],
      'Burgundy satin lining': [.22, .032, .048],
      'Graphite twill riding trousers': [.037, .054, .068],
      'Claret woven scarf': [.30, .052, .061],
      'Deep indigo wizard hat felt': [.017, .027, .052],
      'Tailored deep indigo facing': [.032, .061, .112],
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
      assert.ok(relativeVariation > .005 && relativeVariation < .04, `${name}: preserve a subtle, non-flat weave`);
      t.diagnostic(`${name}: RGB8 mean ${encodedSum.map(value => (value / count).toFixed(2))}; linear mean ${mean.map(value => value.toFixed(5))}`);
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
      if (factory === createWizard) assert.ok(Math.abs(duration - 4) < 1e-5, 'rider loops must start at zero without a frame-one delay');
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
      assert.ok(loopDistance < .003, `${group.userData.characterAnimation.kind} ${name} loop seam: ${loopDistance}`);
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
