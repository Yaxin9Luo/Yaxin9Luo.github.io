from pathlib import Path
import difflib
source=Path('world/src/herbarium-assets.js');s=source.read_text();original=s
s=s.replace("bindHerbariumTextureSets(sets);return materials;", "await Promise.all(['fern_02','periwinkle_plant','potted_plant_01'].map(kind=>loadHerbariumBotanicalAssets({kind,...options})));bindHerbariumTextureSets(sets);return materials;")
a=s.index('function daisy(');b=s.index('function rosette(',a)
s=s[:a]+'''function sourcePieces(id,variant=0){const variants=botanicalAssets.get(id);if(!variants)throw new Error(`Call and await loadHerbariumAssets before constructing planted gardens (${id} not prepared).`);return variants[variant].pieces;}
function sourcePlant(b,id,variant,x,y,z,scale,turn=0,partFilter=null){
  const pieces=sourcePieces(id,variant),placement=new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromAxisAngle(UP,turn),V(scale,scale,scale)),prefix=`${id} collection ${b.group.userData.parts.length}`;
  for(const piece of pieces){if(partFilter&&!partFilter(piece))continue;const g=piece.geometry.clone().applyMatrix4(piece.matrix).applyMatrix4(placement);b.add(g,piece.key,`${prefix}/${piece.name}`,V(),null,{keepUV:true,role:piece.name.endsWith('_pebbles')?'substrate':'plant',attachedTo:'original rooted source specimen'});g.dispose();}
  const used=b.group.userData.sourceAssets??=[];if(!used.some(s=>s.id===id))used.push({id,...botanicalCatalog[id],license:'CC0',sourceURL:`https://polyhaven.com/a/${id}`});
  b.group.userData.originalAuthoring='Original authored architecture and planting composition, incorporating attributed CC0 photographic plant geometry and full 4K material pixels.';
  return prefix;
}
let sourceSubstrateHeight;
function pottedSubstrateHeight(){
  if(sourceSubstrateHeight!==undefined)return sourceSubstrateHeight;const part=sourcePieces('potted_plant_01').find(p=>p.name.endsWith('_pebbles')),mesh=new THREE.Mesh(part.geometry,getHerbariumMaterials()[part.key]);mesh.matrixAutoUpdate=false;mesh.matrix.copy(part.matrix);mesh.updateMatrixWorld(true);const hits=new THREE.Raycaster(V(0,1,0),V(0,-1,0)).intersectObject(mesh);if(!hits.length)throw new Error('Original potted substrate does not support its plant centre.');return sourceSubstrateHeight=hits[0].point.y;
}
function groundPlant(b,id,variant,x,z,scale,seed,baseY=0){sourcePlant(b,id,variant,x,baseY,z,scale,seed*2.399);b.group.userData.plantRoots.push({species:id,root:[x,baseY,z],support:'continuous planted soil'});}
function fullPottedPlant(b,x,z,scale,seed,baseY=0){const prefix=sourcePlant(b,'potted_plant_01',0,x,baseY,z,scale,seed*2.399);b.group.userData.plantRoots.push({species:'potted_plant_01',root:[x,baseY+pottedSubstrateHeight()*scale,z],support:'original pebble substrate',supportPart:`${prefix}/potted_plant_01_pebbles`});}
function pottedCollection(b,x,z,potScale,species,seed,baseY=0){
  const prefix=sourcePlant(b,'potted_plant_01',0,x,baseY,z,potScale,seed*2.399,p=>p.name.endsWith('_pot')||p.name.endsWith('_pebbles')),y=baseY+pottedSubstrateHeight()*potScale;
  if(species==='fern'){sourcePlant(b,'fern_02',seed%2?0:2,x,y,z,potScale*(seed%2?.90:1.12),seed*2.399);b.group.userData.plantRoots.push({species:'fern_02',root:[x,y,z],support:'original pebble substrate',supportPart:`${prefix}/potted_plant_01_pebbles`});}
  else for(let i=0;i<3;i++){const angle=i*2.399,px=x+Math.cos(angle)*potScale*.065,pz=z+Math.sin(angle)*potScale*.065;sourcePlant(b,'periwinkle_plant',0,px,y,pz,potScale*(2.25+i*.20),seed+i*2.399);b.group.userData.plantRoots.push({species:'periwinkle_plant',root:[px,y,pz],support:'original pebble substrate',supportPart:`${prefix}/potted_plant_01_pebbles`});}
}
''' +s[b:]
a=s.index('  // Authored practical interior:');b=s.index('  b.group.userData.clearPassages=',a)
s=s[:a]+'''  // Unequal end/back collections: full photographed trees, lower fern urns and pink-flower pots.
  for(const[x,z,scale,seed]of[[-5.2,-1.2,2.2,4],[-3.6,-2.6,1.75,7],[4.7,-1.65,2.4,10],[6.1,.15,1.55,13]])fullPottedPlant(b,x,z,scale,seed);
  for(const[x,z,scale,seed]of[[-6.1,.7,1.3,3],[-4.25,-.65,1.15,8],[-2.45,-2.9,1.05,5],[3.15,-2.85,1.4,11],[5.8,-1.6,1.12,14],[5.55,1.15,1.3,17]])pottedCollection(b,x,z,scale,'fern',seed);
  for(const[x,z,scale,seed]of[[-5.35,1.7,.72,21],[-3.0,-2.5,.65,24],[3.0,-1.4,.80,27],[6.35,1.75,.60,30]])pottedCollection(b,x,z,scale,'flowers',seed);
  for(const side of[-1,1]){const x=side*3.6,z=1.50;b.box('wood','Workbench thick top',2.8,.14,1.05,x,1.30,z,{collider:true});for(const dx of[-1.15,1.15])for(const dz of[-.37,.37])b.box('wood','Workbench joined leg',.13,1.25,.13,x+dx,.625,z+dz,{collider:true});b.box('wood','Workbench lower shelf',2.54,.09,.86,x,.33,z);
    pottedCollection(b,x-.75,z+.05,.58,'fern',side+6,1.38);pottedCollection(b,x+.30,z-.10,.48,'flowers',side+11,1.38);fullPottedPlant(b,x+.98,z+.03,.62,side+15,1.38);
    pottedCollection(b,x-.55,z,.38,'fern',side+21,.38);pottedCollection(b,x+.5,z,.33,'flowers',side+26,.38);
  }
  pottedCollection(b,-2.30,3.29,.78,'flowers',35);pottedCollection(b,2.35,3.25,.64,'fern',37);
''' +s[b:]
a=s.index('  for(let i=0;i<Math.ceil(length*5.8);');b=s.index('  for(let i=0;i<Math.ceil(length*.55);',a)
s=s[:a]+'''  // Interlocking fern crowns form the continuous middle mass; flowering stems rise through it in unequal drifts.
  for(let i=0;i<Math.ceil(length*2.2);i++){
    const x=-length/2+.82+rand()*(length-1.64),z=.12+(rand()-.5)*.16+Math.sin(x*.74+seed)*.09,variant=i%3?0:2,p=transform(x,0,z),scale=variant===0?.95+rand()*.30:1.25+rand()*.40;
    groundPlant(b,'fern_02',variant,p.x,p.z,scale,seed+i*19,p.y);
  }
  for(let i=0;i<Math.ceil(length*6.7);i++){
    const row=i%4,margin=row<2?.58:.28,x=-length/2+margin+rand()*(length-margin*2),drift=Math.sin(x*.81+seed*.17),zz=row===0?Math.min(.42,width*.28):row===1?.10:-Math.min(.48,width*.32),z=zz+(rand()-.5)*.16+Math.sin(x*.74+seed)*.09,p=transform(x,0,z),scale=row===0?(drift>.10?2.6+rand()*.7:1.65+rand()*.35):row===1?1.70+rand()*.6:.85+rand()*.65;
    groundPlant(b,'periwinkle_plant',0,p.x,p.z,scale,seed+1300+i,p.y);
  }
''' +s[b:]
# Preserve stone and all structural geometry. Reduce broad contrast only in the painted iron finish.
s=s.replace("if(sets['castle-masonry']?.color)sets['castle-masonry']={...sets['castle-masonry'],color:stoneAlbedo(sets['castle-masonry'].color)};", "if(sets['castle-masonry']?.color)sets['castle-masonry']={...sets['castle-masonry'],color:stoneAlbedo(sets['castle-masonry'].color)};if(sets['oxidized-copper']?.color)sets['oxidized-copper']={...sets['oxidized-copper'],color:quietPaintAlbedo(sets['oxidized-copper'].color)};")
s=s.replace("iron:material('verdigris primary iron','#466357'", "iron:material('verdigris primary iron','#476d5d'")
s+='''\nconst paintDerivatives=new WeakMap();
function quietPaintAlbedo(source){
  if(paintDerivatives.has(source))return paintDerivatives.get(source);const image=source.image,{width,height}=image;let pixels=image.data;if(!pixels){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);pixels=context.getImageData(0,0,width,height).data;}
  const data=new Uint8Array(width*height*4);for(let i=0;i<data.length;i+=4){const l=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255,value=Math.round((.78+.17*l)*255);data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;}
  const texture=new THREE.DataTexture(data,width,height);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=source.flipY;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=8;texture.needsUpdate=true;texture.name='Restrained painted iron pigment over original copper surface relief';texture.userData={sharedAsset:true,source:'oxidized-copper/color.webp',derivation:'Full-resolution original luminance retained in narrow painted-iron contrast range; original normal/roughness/metalness channels retained.'};paintDerivatives.set(source,texture);return texture;
}
'''
Path('docs/art/living-v8/herbarium/r4-botanical-draft.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),s.splitlines(True),fromfile='world/src/herbarium-assets.js',tofile='world/src/herbarium-assets.js')))
