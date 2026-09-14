import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import {decodeXianfashanTexturePixels} from './xianfashan-materials.js';

const manifestPath='/textures/yuanmingyuan/fangwaiguan-material-r4/manifest.json';
const roles=['marble','plaster','paving'],channels=['color','normal','roughness'];
const roughnessRanges={marble:[.56,.84],plaster:[.78,.98],paving:[.66,.94]};
const digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),byte=>byte.toString(16).padStart(2,'0')).join('');

export function cutSurfaceRoughness(data,range){
  const result=new Uint8Array(data.length),[low,high]=range;
  for(let i=0;i<data.length;i+=4){
    for(let channel=0;channel<3;channel++)result[i+channel]=Math.round(255*low+(high-low)*data[i+channel]);
    result[i+3]=data[i+3];
  }
  return result;
}

function mineralColor(data,target,variationScale){
  const result=new Uint8Array(data.length);
  let mean=0;for(let i=0;i<data.length;i+=4)mean+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];mean/=data.length/4;
  for(let i=0;i<data.length;i+=4){
    const variation=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]-mean)*variationScale;
    for(let channel=0;channel<3;channel++)result[i+channel]=Math.round(Math.max(0,Math.min(255,target[channel]+variation)));
    result[i+3]=data[i+3];
  }
  return result;
}
export const whitewashedPlasterColor=data=>mineralColor(data,[207,202,189],.18);
export const courtyardPavingColor=data=>mineralColor(data,[168,173,165],.5);

/** Reuse the established full-resolution byte/bitmap decoder. The source
 * package and every map are specific to this optional material study. */
export async function prepareFangwaiguanMaterialPixels({signal,fetchFile=fetchPublicAsset}={}) {
  signal?.throwIfAborted();
  const response=await fetchFile(manifestPath,{signal});
  if(!response.ok)throw new Error(`Fangwaiguan material manifest: HTTP ${response.status}`);
  const manifest=await response.json();
  if(manifest.id!=='fangwaiguan-material-r4-candidate'||manifest.version!==1)throw new Error('Unknown Fangwaiguan material package.');
  const pixels={manifest,maps:{}};
  for(const role of roles){
    const source=manifest.sources?.[role];
    if(source?.width!==4096||source?.height!==4096||!(source.tileMetres>0)||source.license!=='CC0-1.0')throw new Error(`Incomplete 4K material source: ${role}`);
    pixels.maps[role]={};
    for(const channel of channels){
      const file=source.files?.[channel];
      if(!file?.path?.startsWith('/textures/yuanmingyuan/fangwaiguan-material-r4/')||!/^([a-f0-9]{64})$/.test(file.sha256))throw new Error(`Missing material map: ${role}/${channel}`);
      signal?.throwIfAborted();const downloaded=await fetchFile(file.path,{signal});
      if(!downloaded.ok)throw new Error(`Fangwaiguan ${role}/${channel}: HTTP ${downloaded.status}`);
      const bytes=await downloaded.arrayBuffer();
      if(bytes.byteLength!==file.bytes)throw new Error(`Truncated material map: ${role}/${channel}`);
      let entry=await decodeXianfashanTexturePixels(bytes,{...file,width:4096,height:4096},{signal});
      if(channel==='roughness'){
        // The downloaded marble is a polished slab. Preserve its relative
        // microvariation while authoring the response of cut outdoor stone.
        // Store the calibrated pixels directly so standard PBR/GLB export
        // carries the same response without a custom runtime shader.
        const data=cutSurfaceRoughness(entry.data,roughnessRanges[role]);
        entry={...entry,data,sourceDecodedSha256:entry.decodedSha256,decodedSha256:await digest(data),calibration:{kind:'authored-cut-surface-roughness',range:roughnessRanges[role]}};
      }
      if(role==='plaster'&&channel==='color'){
        const data=whitewashedPlasterColor(entry.data);
        entry={...entry,data,sourceDecodedSha256:entry.decodedSha256,decodedSha256:await digest(data),calibration:{kind:'authored-pale-limewash',targetSRGB:[207,202,189],sourceLuminanceVariation:.18,historicalColourVerified:false}};
      }
      if(role==='paving'&&channel==='color'){
        const data=courtyardPavingColor(entry.data);
        entry={...entry,data,sourceDecodedSha256:entry.decodedSha256,decodedSha256:await digest(data),calibration:{kind:'authored-neutral-courtyard-stone',targetSRGB:[168,173,165],sourceLuminanceVariation:.5,historicalColourVerified:false}};
      }
      pixels.maps[role][channel]=entry;
    }
  }
  signal?.throwIfAborted();return pixels;
}

export function configureFangwaiguanMaterials(builder,pixels){
  const manifest=pixels?.manifest;
  if(manifest?.id!=='fangwaiguan-material-r4-candidate')throw new Error('Prepare the Fangwaiguan R4 material package first.');
  const maps={};
  // Validate all inputs before taking ownership of GPU texture resources.
  for(const role of roles)for(const channel of channels){
    const source=manifest.sources?.[role],entry=pixels.maps?.[role]?.[channel],file=source?.files?.[channel];
    if(!entry||entry.width!==source.width||entry.height!==source.height||entry.channels!==4||entry.origin!=='lower-left'||!(entry.data instanceof Uint8Array)||entry.data.length!==entry.width*entry.height*4||entry.encodedSha256!==file?.sha256)throw new Error(`Invalid decoded Fangwaiguan map: ${role}/${channel}`);
  }
  for(const role of roles){
    const source=manifest.sources[role];maps[role]={};
    for(const channel of channels){
      const entry=pixels.maps[role][channel],texture=new THREE.DataTexture(entry.data,entry.width,entry.height,THREE.RGBAFormat);
      texture.name=`fangwaiguan-r4-${role}-${channel}`;
      texture.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
      texture.generateMipmaps=true;texture.anisotropy=8;texture.repeat.setScalar(1/source.tileMetres);texture.needsUpdate=true;
      texture.userData={provider:source.provider,source:source.sourceURL,license:source.license,physicalTileMetres:source.tileMetres,scaleEvidence:source.scaleEvidence,encodedSha256:entry.encodedSha256,decodedSha256:entry.decodedSha256,sourceResolution:[entry.width,entry.height],upload:'RGBA8, provider 16-bit files converted where applicable',...(entry.calibration?{calibration:entry.calibration,sourceDecodedSha256:entry.sourceDecodedSha256}:{})};
      builder.textures.add(texture);maps[role][channel]=texture;
    }
  }
  builder.metricMaterials=new Set();
  for(const [name,role,colour,normal,roughness] of [
    ['stone','marble',0xe3dfd3,.18,.94],
    ['carving','marble',0xf1efe6,.12,.92],
    ['warmBlock','marble',0xe5dccb,.16,.96],
    ['coolBlock','marble',0xdce1db,.16,.94],
    ['recess','marble',0xa8aea2,.12,1],
    ['paving','paving',0xe4dfd3,.34,1],
    ['plaster','plaster',0xffffff,.22,1],
  ]){
    const material=builder.m[name],surface=maps[role];
    material.color.set(colour);material.map=surface.color;material.normalMap=surface.normal;material.normalScale.set(normal,normal);material.roughnessMap=surface.roughness;material.roughness=roughness;
    material.userData={...material.userData,materialStudy:'fangwaiguan-r4-candidate',textureRole:role,surfaceUV:'metre projection in the authored asset frame; original positions/normals unchanged',evidence:'contemporary colour and mineral-surface interpretation; not sampled historical finishes'};
    builder.metricMaterials.add(material);
  }
  // Glazed ceramics remain distinct from the mineral surfaces.
  for(const [name,colour] of [['tile',0x326f63],['variedTile',0x3c7968],['blueTile',0x345f78],['variedBlueTile',0x3b6b83]]){
    const material=builder.m[name];material.color.set(colour);material.clearcoat=.42;material.clearcoatRoughness=.23;
  }
  builder.m.copper.color.set(0x796a47);builder.m.copper.roughness=.55;
  builder.materialStudy={id:manifest.id,artApproved:false,sourceRoles:roles.map(role=>({role,asset:manifest.sources[role].asset,source:manifest.sources[role].sourceURL,tileMetres:manifest.sources[role].tileMetres,files:manifest.sources[role].files,uploadedMaps:Object.fromEntries(channels.map(channel=>[channel,{...maps[role][channel].userData}])),roughnessCalibration:roughnessRanges[role],...(role==='plaster'?{colourInterpretation:'authored pale limewash, target sRGB 207/202/189; photographed luminance variation retained at 18 percent'}:{})})),surfacePositionsAndNormalsChanged:false,uvChanged:true,uvMapping:'authored-asset-metre-dominant-plane',textureResolution:4096};
}

/** The builder already uses individual nonindexed triangles. Project into
 * the common authored frame, including parent translations/rotations, so a
 * two-metre column and a ten-centimetre moulding have the same grain size. */
export function projectFangwaiguanSurfaceUVs(geometry,frame=new THREE.Matrix4()){
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  if(geometry.index||!p||!n||p.count!==n.count||p.count%3)throw new Error('Metric material projection needs complete nonindexed triangles.');
  let uv=geometry.attributes.uv;
  if(!uv||uv.count!==p.count){uv=new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2);geometry.setAttribute('uv',uv);}
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(frame),normal=new THREE.Vector3(),point=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){
    normal.set(n.getX(i)+n.getX(i+1)+n.getX(i+2),n.getY(i)+n.getY(i+1)+n.getY(i+2),n.getZ(i)+n.getZ(i+1)+n.getZ(i+2)).applyMatrix3(normalMatrix);
    const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z),axis=ay>=ax&&ay>=az?'y':ax>=az?'x':'z';
    const sign=normal[axis]<0?-1:1;
    for(let j=0;j<3;j++){
      const at=i+j;point.fromBufferAttribute(p,at).applyMatrix4(frame);
      if(axis==='y')uv.setXY(at,point.x,-sign*point.z);
      else if(axis==='x')uv.setXY(at,-sign*point.z,point.y);
      else uv.setXY(at,sign*point.x,point.y);
    }
  }
  uv.needsUpdate=true;return geometry;
}
