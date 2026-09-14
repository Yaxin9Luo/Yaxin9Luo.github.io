import * as THREE from 'three';
import { namedGroup } from './study-geometry.js';
import { getGardenGroup } from './garden-layout.js';
import { JiuzhouBuilder } from './jiuzhou-architecture.js';
import { jiuzhouPlan, jiuzhouSources } from './jiuzhou-layout.js';
import { buildJiuzhouNineHall, buildJiuzhouRegularHall, buildJiuzhouTongdaoStage, buildJiuzhouCornerHouse, buildJiuzhouConnectingSuites } from './jiuzhou-buildings.js';
import { buildJiuzhouCourtyards, buildJiuzhouShore, jiuzhouStudyShoreline } from './jiuzhou-courtyards.js';
import { buildJiuzhouRuyiBridge, buildJiuzhouExternalLandings } from './jiuzhou-bridges.js';
import { jiuzhouStudySections, jiuzhouFeatureSection, jiuzhouSectionSelection } from './jiuzhou-sections.js';

// The production factory always constructs real tile courses. Small fixtures
// call the individual builders; there is no reduced-detail production mode.
export function createJiuzhouStudy({ sections = Object.keys(jiuzhouStudySections) } = {}) {
  const selectedSections = jiuzhouSectionSelection(sections);
  const b = new JiuzhouBuilder('jiuzhou'), root = new THREE.Group(); root.name = 'yuanmingyuan-jiuzhou-study';
  root.userData = { body: 'late-xianfeng-jiuzhou-qingyan-core-study', period: jiuzhouPlan.period, selectedSections, historicReconstructionComplete: false };
  try {
    if (selectedSections.includes('waterfront')) buildJiuzhouShore(b, root);
    const halls = namedGroup(root, 'jiuzhou-halls-and-residential-courts', { body: 'differentiated-core-buildings-in-dated-three-route-plan', selectedSections });
    for (const spec of jiuzhouPlan.core) {
      if (!selectedSections.includes(jiuzhouFeatureSection('routes', spec.route))) continue;
      if (spec.id === 'jiuzhou-qingyan-hall') buildJiuzhouNineHall(b, halls);
      else if (spec.id === 'jiuzhou-tongdao-stage') buildJiuzhouTongdaoStage(b, halls);
      else if (spec.id === 'jiuzhou-west-corner-house') buildJiuzhouCornerHouse(b, halls);
      else buildJiuzhouRegularHall(b, halls, spec);
    }
    if (selectedSections.includes('central')) buildJiuzhouConnectingSuites(b, root);
    buildJiuzhouCourtyards(b, root, { sections: selectedSections });
    if (selectedSections.includes('waterfront')) { buildJiuzhouRuyiBridge(b, root); buildJiuzhouExternalLandings(b, root); }
    b.flush(); b.releasePrototypes(); root.updateMatrixWorld(true);
    const usedMaterials = new Set(), usedTextures = new Set(), usedGeometries = new Set(); let meshCount = 0, triangleCount = 0, instancedMeshCount = 0, tileInstanceCount = 0, instanceMatrixBytes = 0;
    root.traverse(node => {
      if (!node.isMesh) return; meshCount++; usedGeometries.add(node.geometry); triangleCount += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node.isInstancedMesh ? node.count : 1);
      if (node.isInstancedMesh) { instancedMeshCount++; tileInstanceCount += node.count; instanceMatrixBytes += node.instanceMatrix.array.byteLength; }
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) { usedMaterials.add(material); for (const value of Object.values(material)) if (value?.isTexture) usedTextures.add(value); }
    });
    for (const [owned, used] of [[b.materials, usedMaterials], [b.textures, usedTextures]]) for (const resource of owned) if (!used.has(resource)) { resource.dispose(); owned.delete(resource); }
    let geometryAttributeBytes = 0, geometryIndexBytes = 0, storedTriangles = 0, texturePixelBytes = 0;
    for (const geometry of usedGeometries) { for (const attribute of Object.values(geometry.attributes)) geometryAttributeBytes += attribute.array.byteLength; geometryIndexBytes += geometry.index?.array.byteLength ?? 0; storedTriangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3; }
    for (const texture of usedTextures) texturePixelBytes += texture.image?.data?.byteLength ?? 0;
    const bounds = new THREE.Box3().setFromObject(root), anchor = getGardenGroup('jiuzhou-qingyan');
    const diagnostics = {
      assetId: 'jiuzhou', period: jiuzhouPlan.period, selectedSections, meshCount, triangleCount,
      bufferStorage: { geometryAttributeBytes, geometryIndexBytes, instanceMatrixBytes, texturePixelBytes, totalBytes: geometryAttributeBytes + geometryIndexBytes + instanceMatrixBytes + texturePixelBytes, storedTriangles, instancedMeshCount, tileInstanceCount, triangleCountIncludesAllInstances: true, gpuAllocationMeasured: false },
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new THREE.Vector3()).toArray() },
      resourceOwnership: { geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size, instanceMeshes: b.instanceMeshes?.size ?? 0, sharedAcrossFactories: false, temporaryGeometryDisposals: b.temporaryDisposals },
      buildings: b.buildings, walkways: b.walkways, sources: jiuzhouSources, measuredControls: jiuzhouPlan.measuredControls,
      placement: { groupId: 'jiuzhou-qingyan', globalAnchor: [...anchor.position], localFacing: '+Z south; +X east', rootTranslationApplied: false, coordinatesSurveyed: false, scale: 1 },
      shoreline: { localOutline: jiuzhouStudyShoreline, evidence: 'proportional trace of published modern 1860 plan, compared with original 1859 drawing', originalSurveyRecovered: false, noLakeBed: true, currentGeneralizedGardenIslandNeedsIndependentAlignment: true },
      imageSources: [], textureProvenance: 'original authored paint and woodgrain; no research PDF image is packaged or presented as a surviving surface',
      authoredInterpretations: ['member dimensions not printed in the cited records', 'continuous roof curvature and tile profiles', 'original paintwork composition within documented motif families', 'unmeasured court and gallery coordinates and heights', 'L-roof corner-house elevations and stairs', 'theatre upper xieshan interpretation from published comparative research', 'Ruyi intermediate stone-beam arrangement and exact foliage', 'platform-room outlines and door positions; category reported in archival research (He upper pp36,38), with a modern roof comparison (He middle p43 fig18-5); exact roof pitch, construction, drainage and coping are inferred'],
      omitted: ['complete servants quarters and all original interior partitions/furnishings', 'four bridge superstructures retained only as labelled landing interfaces', 'external mainland and the other eight islands', 'lake bed, water surface and living vegetation', 'Zhengda Guangming and the southern imperial courts'],
      landscapeSockets: [{ kind: 'garden-planting', region: 'shendetang-front-court', polygon: [[-53, -6.4], [-34, -6.4], [-34, 2], [-53, 2]], speciesAndExactPlantPositionsUnconfirmed: true }, { kind: 'garden-planting', region: 'western-courts', polygon: [[-89, -13], [-83, -13], [-83, 3], [-89, 3]], speciesAndExactPlantPositionsUnconfirmed: true }],
      visualAcceptance: false, integrationAcceptance: false,
    };
    return { group: root, diagnostics, dispose() { b.dispose(); root.clear(); } };
  } catch (error) { b.dispose(); root.clear(); throw error; }
}

export { jiuzhouStudyViews } from './jiuzhou-study-views.js';
export { jiuzhouStudySections } from './jiuzhou-sections.js';
export const createJiuzhouCentralStudy = () => createJiuzhouStudy({ sections: ['central'] });
export const createJiuzhouWesternStudy = () => createJiuzhouStudy({ sections: ['western'] });
export const createJiuzhouEasternStudy = () => createJiuzhouStudy({ sections: ['eastern'] });
export const createJiuzhouWaterfrontStudy = () => createJiuzhouStudy({ sections: ['waterfront'] });
