import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { archingUnderstoryBladeGeometry, understoryLaminaGeometry, understoryFlowerGeometry, understoryFernFrondGeometry, understoryPose, understoryCurveStemGeometry, understoryRacemeCurve, understoryPedicelCurve, understoryLeafPairParameters } from '../src/yuanmingyuan/garden-understory-geometry.js';
import { createGardenUnderstoryStudy } from '../src/yuanmingyuan/garden-understory-study.js';
import { gardenUnderstoryStudyViews } from '../src/yuanmingyuan/garden-understory-study-views.js';

function checkSurface(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, color = g.attributes.color, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), face = new THREE.Vector3(), normal = new THREE.Vector3();
  assert.equal(p.count, n.count); assert.equal(p.count, color.count); assert.equal(p.count, uv.count);
  for (const attribute of [p, n, uv, color]) assert.ok(attribute.array.every(Number.isFinite), g.name);
  for (let i = 0; i < p.count; i++) { normal.fromBufferAttribute(n, i); assert.ok(Math.abs(normal.length() - 1) < 2e-5, `${g.name}: nonunit normal ${i}`); }
  let minimumArea = Infinity, opposed = 0;
  for (let i = 0; i < g.index.count; i += 3) {
    a.fromBufferAttribute(p, g.index.getX(i)); b.fromBufferAttribute(p, g.index.getX(i + 1)); c.fromBufferAttribute(p, g.index.getX(i + 2));
    face.crossVectors(b.sub(a), c.sub(a)); minimumArea = Math.min(minimumArea, face.length() * .5);
    assert.ok(face.lengthSq() > 1e-24, `${g.name}: zero/degenerate face ${i / 3}`);
    normal.set(0, 0, 0); for (let j = 0; j < 3; j++) normal.add(new THREE.Vector3().fromBufferAttribute(n, g.index.getX(i + j)));
    if (face.dot(normal) <= 0) opposed++;
  }
  assert.equal(opposed, 0, `${g.name}: normals face against actual winding`);
  return { vertices: p.count, triangles: g.index.count / 3, minimumArea };
}

test('a sedge leaf actually arches down and has a curved folded transverse section with finite normals', () => {
  const g = archingUnderstoryBladeGeometry();
  try {
    checkSurface(g); const p = g.attributes.position, starts = g.userData.rowStarts, middle = starts[17], left = new THREE.Vector3().fromBufferAttribute(p, middle), right = new THREE.Vector3().fromBufferAttribute(p, middle + 8), ridge = new THREE.Vector3().fromBufferAttribute(p, middle + 4);
    assert.ok(g.boundingBox.max.y > p.getY(g.userData.tipVertex) + .2); assert.ok(ridge.distanceTo(left.clone().lerp(right, .5)) > .0006);
    assert.ok(p.getY(0) < 0); assert.equal(starts.at(-1), p.count - 1);
  } finally { g.dispose(); }
});

test('serrated veined leaves have true silhouette teeth and curvature instead of a flat alpha card', () => {
  const g = understoryLaminaGeometry(), smooth = understoryLaminaGeometry({ serration: 0 });
  try {
    checkSurface(g); const p = g.attributes.position; let changedEdges = 0;
    for (const start of g.userData.rowStarts.slice(1, -1)) if (Math.abs(p.getX(start) - smooth.attributes.position.getX(start)) > .00001) changedEdges++;
    assert.ok(changedEdges > 10); assert.ok(g.boundingBox.max.z > .003); assert.equal(p.getY(0), 0); assert.equal(g.userData.tipVertex, p.count - 1);
  } finally { g.dispose(); smooth.dispose(); }
});

test('one bipinnate frond has real gaps and every original pinnule root contacts its actual rachis mesh', () => {
  const frond = understoryFernFrondGeometry();
  try {
    checkSurface(frond.wood); checkSurface(frond.lamina);
    const { attachments, pinnules, pinnae } = frond.lamina.userData; assert.ok(pinnae >= 24 && pinnules > 200);
    const positions = frond.lamina.attributes.position, perLeaf = positions.count / attachments.length; assert.ok(Number.isInteger(perLeaf));
    const bvh = new MeshBVH(frond.wood, { indirect: true }), point = new THREE.Vector3(); let maximumGap = 0;
    for (let i = 0; i < attachments.length; i++) {
      point.fromBufferAttribute(positions, i * perLeaf); const nearest = bvh.closestPointToPoint(point, {}); maximumGap = Math.max(maximumGap, nearest.distance);
      assert.ok(nearest.distance < .0014, `floating pinnule ${i}: actual wood distance ${nearest.distance}`);
    }
    assert.ok(maximumGap > 0); assert.ok(frond.lamina.index.count / 3 > 20000);
    // Each pointed leaf is a disconnected lamina attached to wood, not one
    // face spanning the spaces between neighbours. Its source indices cannot
    // cross into the next pinnule's vertex interval.
    for (let i = 0; i < frond.lamina.index.count; i += 3) {
      const leaf = Math.floor(frond.lamina.index.getX(i) / perLeaf);
      assert.equal(Math.floor(frond.lamina.index.getX(i + 1) / perLeaf), leaf); assert.equal(Math.floor(frond.lamina.index.getX(i + 2) / perLeaf), leaf);
    }
  } finally { frond.wood.dispose(); frond.lamina.dispose(); }
});

test('real fern leaves occupy a leafy silhouette and cover the main tip without filling all the gaps', () => {
  const frond=understoryFernFrondGeometry({length:.6402416372671724,width:.2804860249906778,curl:.16151169953518546,seed:612});
  try {
    const bvh=new MeshBVH(frond.lamina,{indirect:true}),ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,0,-1));let hits=0;
    // Independent rays count the union, not the sum of overlapping leaf areas.
    for(let y=0;y<140;y++)for(let x=0;x<72;x++){
      ray.origin.set(-.18+(x+.5)*.005,(y+.5)*.005,1);
      if(bvh.raycastFirst(ray,THREE.DoubleSide))hits++;
    }
    const area=hits*.005*.005;assert.ok(area>.040,`skeleton-like projected coverage remains (${area})`);assert.ok(area<.10,'fern silhouette became a filled panel');
    assert.ok(bvh.closestPointToPoint(new THREE.Vector3(.009,.6402416372671724,-.16151169953518546),{}).distance<.002,'bare main rachis projects beyond its terminal leaf');
  } finally {frond.wood.dispose();frond.lamina.dispose();}
});

test('the five flower petals join the real calyx and retain neutral ivory instead of green leaf shading', () => {
  const flower = understoryFlowerGeometry();
  try {
    checkSurface(flower.lamina); checkSurface(flower.centre); const p = flower.lamina.attributes.position, colors = flower.lamina.attributes.color, perPetal = p.count / 5, bvh = new MeshBVH(flower.centre, { indirect: true });
    assert.ok(Number.isInteger(perPetal));
    for (let i = 0; i < 5; i++) assert.ok(bvh.closestPointToPoint(new THREE.Vector3().fromBufferAttribute(p, i * perPetal), {}).distance < .00002);
    for (let i = 0; i < colors.count; i++) assert.ok(colors.getX(i) > colors.getY(i) && colors.getY(i) > colors.getZ(i), 'ivory petals became green');
    assert.ok(flower.centre.boundingBox.max.y > .006); assert.equal(flower.data.stamens, 10);
  } finally { flower.lamina.dispose(); flower.centre.dispose(); }
});

test('attachment frames keep the actual origin and normal under rotated nonuniform placement', () => {
  const origin = new THREE.Vector3(-3, 4, 2), direction = new THREE.Vector3(.7, .6, -.2), facing = new THREE.Vector3(.1, 1, .3), m = understoryPose(origin, direction, facing, [.8, 1.4, .9]);
  assert.ok(new THREE.Vector3().applyMatrix4(m).distanceTo(origin) < 1e-12); assert.ok(m.determinant() > 0);
  const normal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(m)); assert.ok(normal.dot(facing) > 0); assert.ok(Math.abs(normal.dot(direction)) < 1e-12);
});

test('a downward mother stem joins the actual flowering tube without the old upward elbow', () => {
  const mother = new THREE.CubicBezierCurve3(new THREE.Vector3(0,-.012,0),new THREE.Vector3(.04,.40,0),new THREE.Vector3(.32,.57,.01),new THREE.Vector3(.47,.34,.02));
  const axis = understoryRacemeCurve(mother.getPointAt(1),mother.getTangentAt(1),.105);
  const a = understoryCurveStemGeometry({curve:mother,radii:[.004,.003,.001,.00044],segments:70,radialSegments:12}), b = understoryCurveStemGeometry({curve:axis,radii:[.00044,.00030,.00016],segments:28,radialSegments:12});
  const centre = (g,row) => {const v=new THREE.Vector3();for(let i=0;i<12;i++)v.add(new THREE.Vector3().fromBufferAttribute(g.attributes.position,row*13+i));return v.multiplyScalar(1/12);};
  try {
    checkSurface(a);checkSurface(b);
    const before=centre(a,70).sub(centre(a,69)).normalize(),after=centre(b,1).sub(centre(b,0)).normalize();
    assert.ok(before.angleTo(after)<.035,'rendered tube has a hard join instead of a continuous tangent');
    assert.ok(centre(a,70).distanceTo(centre(b,0))<2e-8,'the two rendered stems do not meet');
    const p=b.attributes.position;
    for(let row=0;row<=28;row++)assert.ok(centre(b,row).distanceTo(axis.getPointAt(row/28))<3e-8,'geometry and botanical attachment curve diverge');
    for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));
  } finally {a.dispose();b.dispose();}
});

test('long and short shoots retain leaf nodes through their ends at actual centimetre spacing', () => {
  for(const reach of [.17,.72]){
    const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(),new THREE.Vector3(0,reach*.8,0),new THREE.Vector3(reach*.7,reach*.9,0),new THREE.Vector3(reach,reach*.6,0)),parameters=understoryLeafPairParameters(curve,.03);
    assert.ok(parameters.length>4);
    for(let i=1;i<parameters.length;i++)assert.ok(curve.getPointAt(parameters[i]).distanceTo(curve.getPointAt(parameters[i-1]))<=.030001,'bare internode exceeds intended leaf spacing');
    assert.ok(curve.getLength()*(1-parameters.at(-1))<.06,'shoot has a bare terminal rod');
  }
});

test('the actual short flower pedicel failure no longer turns back through its tube', () => {
  // Captured from production failure stem 40. The old first control point
  // pushes down before returning to an upward-facing flower, folding the tube.
  const points = [[.33329203248897604,.2618845136003287,-.025267508068789267],[.33568264745948617,.25868262147619686,-.025448745173696552],[.3281032273730785,.2687227923915715,-.02640293740603942],[.32570622069729405,.27188178556001097,-.02692745733702152]].map(p => new THREE.Vector3(...p));
  const oldCurve = new THREE.CubicBezierCurve3(...points), axis = points[1].clone().sub(points[0]).normalize(), outward = points[3].clone().sub(points[2]).normalize();
  const curve = understoryPedicelCurve(points[0], points[3], outward, axis), oldTube = understoryCurveStemGeometry({ curve: oldCurve, radii: [.0004,.0003,.0002], segments: 9, radialSegments: 6 }), tube = understoryCurveStemGeometry({ curve, radii: [.0004,.0003,.0002], segments: 9, radialSegments: 6 });
  try {
    assert.throws(() => checkSurface(oldTube), /winding/, 'recorded production counterexample should detect the old self-turn');
    checkSurface(tube);
    const chord = points[3].clone().sub(points[0]).normalize();
    for (let i=0;i<=60;i++) assert.ok(curve.getTangent(i/60).dot(chord) > .9, 'pedicel locally reverses away from its flower');
    for (const [row,expected] of [[0,points[0]],[9,points[3]]]) {
      const centre = new THREE.Vector3();for(let side=0;side<6;side++)centre.add(new THREE.Vector3().fromBufferAttribute(tube.attributes.position,row*7+side));centre.multiplyScalar(1/6);
      assert.ok(centre.distanceTo(expected)<3e-8,'actual tube left the parent or flower root');
    }
  } finally { oldTube.dispose(); tube.dispose(); }
});

test('the added fern inspection camera faces the real frond frame while the legacy angle stays available', () => {
  const m=new THREE.Matrix4().fromArray([-.8460173042012136,0,.5331554379279191,0,.4118213759358739,.6351087581714897,.6534829910687439,0,-.33861168809477743,.7724227244804934,-.5373129994628242,0,.012626834245080348,-.006,.02040987645595304,1]);
  const front=new THREE.Vector3(0,0,1).transformDirection(m),view=gardenUnderstoryStudyViews.find(v=>v.id==='understory-frond-face'),legacy=gardenUnderstoryStudyViews.find(v=>v.id==='understory-pinnules');
  assert.ok(front.dot(new THREE.Vector3(...view.direction).normalize())>.9999);assert.deepEqual(legacy.direction,[.3,.7,1]);
});

test('an extreme allowed frond keeps real foliage above soil even when its rotated AABB extends underground', () => {
  const frond = understoryFernFrondGeometry({ length: .55, width: .30, curl: .175 }), matrix = understoryPose(new THREE.Vector3(0, -.006, 0), new THREE.Vector3(.94, .66, 0), new THREE.Vector3(0, 1, 0)), actual = new THREE.Box3(), conservative = new THREE.Box3(), point = new THREE.Vector3();
  try {
    for (const geometry of [frond.wood, frond.lamina]) {
      conservative.union(geometry.boundingBox.clone().applyMatrix4(matrix));
      for (let i = 0; i < geometry.attributes.position.count; i++) { point.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(matrix); actual.expandByPoint(point); if (geometry === frond.lamina) assert.ok(point.y > 0, 'real fern foliage enters soil'); }
    }
    assert.ok(actual.min.y > -.02); assert.ok(conservative.min.y < -.1);
  } finally { frond.wood.dispose(); frond.lamina.dispose(); }
});

test('new geometry is deterministic and changes only with its explicit seed', () => {
  const a = understoryFernFrondGeometry({ pairs: 4, seed: 71 }), b = understoryFernFrondGeometry({ pairs: 4, seed: 71 }), c = understoryFernFrondGeometry({ pairs: 4, seed: 72 });
  try { assert.deepEqual(a.lamina.attributes.position.array, b.lamina.attributes.position.array); assert.notDeepEqual(a.lamina.attributes.position.array, c.lamina.attributes.position.array); }
  finally { for (const item of [a, b, c]) { item.wood.dispose(); item.lamina.dispose(); } }
});

test('invalid selections and already-aborted requests fail before constructing a specimen', () => {
  assert.throws(() => createGardenUnderstoryStudy({ specimens: [] }), /selection/); assert.throws(() => createGardenUnderstoryStudy({ specimens: ['pine'] }), /selection/);
  const controller = new AbortController(); controller.abort(); assert.throws(() => createGardenUnderstoryStudy({ signal: controller.signal }), /abort/i);
  assert.ok(gardenUnderstoryStudyViews.length >= 6); assert.equal(new Set(gardenUnderstoryStudyViews.map(v => v.id)).size, gardenUnderstoryStudyViews.length);
});

test('complete three-form source is finite, grounded, independently disposable and stays out of the main scene', { skip: process.env.UNDERSTORY_PRODUCTION !== '1' }, () => {
  const started = performance.now(), before = process.memoryUsage(), study = createGardenUnderstoryStudy(), buildMs = performance.now() - started, afterBuild = process.memoryUsage(), seen = new Map(), geometries = new Set(), materials = new Set();
  const specimenStats = study.parts.map(part => {
    let triangles = 0, meshes = 0, minimumLeafY = Infinity; const buffers = new Set(), point = new THREE.Vector3();
    part.traverse(node => {
      if (!node.isMesh) return; meshes++; triangles += node.geometry.index.count / 3;
      for (const a of [node.geometry.index, ...Object.values(node.geometry.attributes)]) buffers.add(a.array.buffer);
      if (node.material.name === 'understory-physical-leaf') for (let i=0;i<node.geometry.attributes.position.count;i++) minimumLeafY=Math.min(minimumLeafY,point.fromBufferAttribute(node.geometry.attributes.position,i).applyMatrix4(node.matrixWorld).y);
    });
    return { id: part.userData.id, meshes, triangles, uniqueBufferBytes: [...buffers].reduce((n,b)=>n+b.byteLength,0), minimumActualLeafY: minimumLeafY, leaves: part.userData.leaves, flowers: part.userData.flowers, sprays: part.userData.sprays };
  });
  try {
    assert.equal(study.parts.length, 3); assert.equal(study.diagnostics.mainSceneAllowed, false); assert.equal(study.diagnostics.nativeReviewed, false);
    study.group.traverse(node => { if (!node.isMesh) return; checkSurface(node.geometry); geometries.add(node.geometry); materials.add(node.material); assert.equal(node.material.transparent, false); assert.equal(node.material.opacity, 1); assert.equal(node.material.alphaTest, 0); assert.equal(node.castShadow, true); assert.equal(node.receiveShadow, true); });
    for (const part of study.parts) { assert.ok(part.userData.rootPoints.length > 0); for (const root of part.userData.rootPoints) assert.ok(root[1] < 0 && root[1] > -.05); }
    for (const part of specimenStats) if (part.id !== 'sedge') assert.ok(part.minimumActualLeafY > 0, `${part.id}: actual foliage enters soil`);
    const shrub=study.parts.find(p=>p.userData.id==='flower-shrub'),wood=shrub.getObjectByName('understory-shrub-connected-wood'),foliage=shrub.getObjectByName('understory-shrub-veined-leaves'),woodBvh=new MeshBVH(wood.geometry,{indirect:true});
    const leafVertices=foliage.geometry.attributes.position.count/shrub.userData.leaves;assert.ok(Number.isInteger(leafVertices));
    for(let i=0;i<shrub.userData.leaves;i++)assert.ok(woodBvh.closestPointToPoint(new THREE.Vector3().fromBufferAttribute(foliage.geometry.attributes.position,i*leafVertices),{}).distance<.0008,'leaf petiole no longer meets actual wood');
    for(const shoot of shrub.userData.leafShoots)for(let i=1;i<shoot.points.length;i++)assert.ok(new THREE.Vector3(...shoot.points[i]).distanceTo(new THREE.Vector3(...shoot.points[i-1]))<.034,'production shoot still has a long bare internode');
    for(const raceme of shrub.userData.floweringShoots){
      const flowerMesh=shrub.getObjectByName(`${raceme.name}-petals`);assert.ok(Number.isInteger(flowerMesh.geometry.attributes.position.count/raceme.count));
      assert.ok(raceme.count>=12&&raceme.count<=18);assert.ok(new THREE.Vector3(...raceme.motherTangent).angleTo(new THREE.Vector3(...raceme.startTangent))<.001,'production flowering axis has an elbow');
    }
    for (const view of gardenUnderstoryStudyViews) for (const name of view.groups) assert.ok(study.group.getObjectByName(name), `missing review group ${name}`);
    assert.ok(study.diagnostics.triangles > 400000); assert.ok(study.diagnostics.bounds.max[1] < .9); assert.equal(study.diagnostics.textures, 0);
    for (const resource of [...geometries, ...materials]) { seen.set(resource, 0); resource.addEventListener('dispose', () => seen.set(resource, seen.get(resource) + 1)); }
    study.dispose(); study.dispose(); assert.ok([...seen.values()].every(n => n === 1));
    if (process.env.UNDERSTORY_REPORT_PATH) writeFileSync(process.env.UNDERSTORY_REPORT_PATH, JSON.stringify({
      diagnostics: study.diagnostics, specimenStats, buildMs, totalMs: performance.now() - started, memory: { before, afterBuild, afterDispose: process.memoryUsage(), processResourceUsage: process.resourceUsage() },
      validation: { allActualTrianglesFiniteAndNondegenerate: true, normalsAgreeWithActualWinding: true, rootsBelowLocalDatum: true, actualFernAndShrubLeavesAboveSoil: true, allActualShrubLeavesContactWood: true, racemesTangentContinuous: true, reviewGroupsResolved: true, opaqueAndNormalShadowPasses: true },
      disposed: { uniqueGeometries: geometries.size, uniqueMaterials: materials.size, allDisposedExactlyOnce: [...seen.values()].every(n => n === 1) },
      sourceFactoriesConstructed: 1, gpuInvoked: false, nativeReviewed: false,
    }, null, 2) + '\n');
  } finally { study.dispose(); }
});
