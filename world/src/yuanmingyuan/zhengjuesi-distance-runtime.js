import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import {archiveSHA256,loadYuanmingyuanArchive} from './asset-archive.js';
import {overviewAffineScaleBound,projectedOverviewError} from './asset-overview.js';

const validSHA=value=>/^[a-f0-9]{64}$/.test(value??'');
const checkpoint=signal=>{if(signal?.aborted)throw signal.reason??new DOMException('Distance load aborted','AbortError');};

export function validateBuildingDistanceReport(report){
  if(report?.schema!==1||report.kind!=='yuanmingyuan-building-distance'||!validSHA(report.sourceArchiveDigest)||report.fullArchiveRetained!==true||report.texturePixelsUnchanged!==true||report.originalInstances!==report.representedInstances||!Number.isFinite(report.maximumErrorArchiveWorld)||report.maximumErrorArchiveWorld<0||!Number.isFinite(report.requestedMaximumErrorWorld)||report.maximumErrorArchiveWorld>report.requestedMaximumErrorWorld||!Array.isArray(report.sourceRootWorldMatrix)||report.sourceRootWorldMatrix.length!==16)throw new Error('Invalid or incomplete building distance report.');
  const matrix=new THREE.Matrix4().fromArray(report.sourceRootWorldMatrix);overviewAffineScaleBound(matrix);if(matrix.determinant()<=0)throw new Error('Invalid distance root transform.');
  const bounds=report.boundsArchiveWorld;if(!bounds||![bounds.min,bounds.max].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||bounds.min.some((value,i)=>value>bounds.max[i]))throw new Error('Invalid full source bounds in distance report.');
  return report;
}

/** The original archive decoder still validates both compressed transfer and
 * decompressed bytes. The native token is the full MANIFEST SHA, binding both
 * the report and encoded geometry/material files. A report-only SHA would not
 * prevent replacing the archive beneath an already reviewed report. */
export async function loadBuildingDistanceArchive({manifestURL,expectedManifestSHA256,expectedReportSHA256,approvedDistanceSHA256}={}, {signal,fetchImpl=fetchPublicAsset,onProgress,yieldControl}={}){
  checkpoint(signal);if(!manifestURL)throw new Error('A distance manifest URL is required.');
  const base=new URL(manifestURL,globalThis.location?.href),response=await fetchImpl(base.href,{signal});if(!response.ok)throw new Error(`Distance manifest HTTP ${response.status}`);
  const manifestBytes=await response.arrayBuffer(),manifestSHA256=await archiveSHA256(manifestBytes),manifest=JSON.parse(new TextDecoder().decode(manifestBytes));checkpoint(signal);
  if(expectedManifestSHA256!==undefined&&expectedManifestSHA256!==manifestSHA256)throw new Error('Distance manifest SHA256 mismatch.');
  if(manifest.kind!=='yuanmingyuan-building-distance-pilot'||!validSHA(manifest.distance?.sha256))throw new Error('This is not a building distance archive.');
  const report=validateBuildingDistanceReport(manifest.distance.report),reportSHA256=await archiveSHA256(new TextEncoder().encode(JSON.stringify(report)));
  if(reportSHA256!==manifest.distance.sha256||(expectedReportSHA256!==undefined&&expectedReportSHA256!==reportSHA256)||manifest.id!==report.id+'-distance')throw new Error('Distance report SHA256 or identity mismatch.');
  const descriptor={...manifest,glb:{...manifest.glb,url:new URL(manifest.glb.url,base).href},runtime:{...manifest.runtime,url:new URL(manifest.runtime.url,base).href}};
  const asset=await loadYuanmingyuanArchive(descriptor,{signal,fetchImpl,onProgress,yieldControl}),inverseRoot=new THREE.Matrix4().fromArray(report.sourceRootWorldMatrix).invert();let disposed=false;
  return {
    ...asset,distance:{report,reportSHA256,manifestSHA256,manifestURL:base.href,fullSourceNativeReview:report.provenance?.sourceArchiveVisualReview??'not supplied'},
    evaluate({camera,physicalWidth,physicalHeight,pixelBudget=.5,approvedDistanceSHA256:approval=approvedDistanceSHA256}={}){
      if(disposed)return {eligible:false,geometricEligible:false,needsDetail:true,reason:'distance-disposed'};
      asset.group.updateWorldMatrix(true,true);const placementMatrix=new THREE.Matrix4().multiplyMatrices(asset.group.matrixWorld,inverseRoot),geometry=projectedOverviewError({camera,physicalWidth,physicalHeight,pixelBudget,bounds:report.boundsArchiveWorld,error:report.maximumErrorArchiveWorld,placementMatrix}),approved=approval===manifestSHA256;
      return {...geometry,geometricEligible:geometry.eligible,eligible:approved&&geometry.eligible,nativeApproved:approved,needsDetail:!approved||!geometry.eligible,reason:!approved?'native-distance-review-required':geometry.eligible?'geometry-within-physical-pixel-budget':'physical-pixel-budget-exceeded',reportSHA256,manifestSHA256};
    },
    dispose(){if(disposed)return;disposed=true;asset.dispose();},
  };
}

/** Hysteresis avoids switching back and forth at one threshold. Both switch
 * directions remain below the declared physical pixel budget. This is an
 * opaque geometry swap, not an unverified transparency fade or a native pass. */
export function createBuildingDistanceSelection({enterRatio=.8}={}){
  if(!Number.isFinite(enterRatio)||enterRatio<=0||enterRatio>=1)throw new Error('Distance entry ratio must be strictly between zero and one.');let mode='full';
  return {
    update(evaluation,{fullReady=true}={}){
      const previous=mode,canEnter=evaluation.eligible&&evaluation.projectedErrorPhysicalPixels<=evaluation.pixelBudget*enterRatio;
      mode=mode==='distance'?evaluation.eligible?'distance':'full':canEnter?'distance':'full';
      return {mode:mode==='full'&&!fullReady?'none':mode,requestedMode:mode,needsDetail:mode==='full',changed:mode!==previous,reason:evaluation.reason,transition:'opaque-hysteretic-swap; requires native motion review'};
    },
    reset(){mode='full';},
  };
}
