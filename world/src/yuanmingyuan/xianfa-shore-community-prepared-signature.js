const encoder=new TextEncoder();
export function stableShoreJSON(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Nonfinite prepared metadata');return Object.is(value,-0)?'"$negative-zero"':JSON.stringify(value);}
  if(Array.isArray(value))return '['+value.map(stableShoreJSON).join(',')+']';
  if(typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw new Error('Unsupported prepared metadata');
  return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stableShoreJSON(value[k])).join(',')+'}';
}
export async function shoreSHA256(value){
  const bytes=typeof value==='string'?encoder.encode(value):value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export const shoreObjectSHA=value=>shoreSHA256(stableShoreJSON(value));
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const plainFacts=value=>{
  if(Array.isArray(value))return value.map(plainFacts);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['geometryUUID','recordId','groupUUID'].includes(k)).map(([k,v])=>[k,plainFacts(v)]));
  return value;
};

/** Complete selected support and query facts, independent of UUIDs, capture
 * tags, probe lists and rendering-only colours/UVs. The unchanged exporter
 * scans every current source face, so a new intruding face cannot be missed. */
export function shoreTerrainSignatureData(snapshot){
  if(snapshot.schema!=='yuanmingyuan-live-terrain-regions-v1')throw new Error('Unknown live terrain schema');
  const supports=snapshot.geometries.filter(g=>['soil','detail','patch'].includes(g.phase));
  for(const g of supports)if(g.worldMatrix.some((n,i)=>n!==identity[i]))throw new Error('Prepared shoreline requires original world-space support coordinates');
  const states=snapshot.facts.replacementStates.filter(s=>snapshot.regions.some(r=>s.bounds.minX<=r.maxX&&s.bounds.maxX>=r.minX&&s.bounds.minZ<=r.maxZ&&s.bounds.maxZ>=r.minZ));
  if(states.some(s=>s.active))throw new Error('Private active replacement cannot validate prepared shoreline');
  return {schema:snapshot.schema,regions:snapshot.regions,terrain:{name:snapshot.terrain.name,layoutId:snapshot.terrain.layoutId,worldMatrix:snapshot.terrain.worldMatrix},semantics:snapshot.semantics,
    supports:supports.map(g=>({name:g.geometryName,meshName:g.meshName,meshOrder:g.meshOrder,body:g.body,phase:g.phase,patchId:g.patchId,worldMatrix:g.worldMatrix,indexType:g.sourceIndexType,sourceVertexIndices:g.sourceVertexIndices,sourceTriangleIndices:g.sourceTriangleIndices,indices:g.indices,position:g.attributes.position,normal:g.attributes.normal??null,regionTriangleOrdinals:g.regionTriangleOrdinals,toleranceRetainedTriangleIndices:g.toleranceRetainedTriangleIndices})),
    facts:plainFacts({...snapshot.facts,replacementStates:states})};
}

const textureKeys=['name','mapping','channel','wrapS','wrapT','magFilter','minFilter','anisotropy','format','internalFormat','type','rotation','matrixAutoUpdate','generateMipmaps','premultiplyAlpha','flipY','unpackAlignment','colorSpace'];
export function shoreTextureSettings(texture){
  const result=Object.fromEntries(textureKeys.map(k=>[k,texture[k]??null]));
  for(const k of ['offset','repeat','center'])result[k]=texture[k].toArray();
  result.matrix=texture.matrix.toArray();result.width=texture.image?.width;result.height=texture.image?.height;
  result.encodedSha256=texture.userData?.encodedSha256??null;return result;
}
/** Includes all ordinary material own scalar/vector/define state. Listeners,
 * UUID and upload version are lifecycle fields, not appearance. Shader hooks
 * are rejected separately; textures keep their original live objects. */
export function shoreMaterialSettings(material){
  const result={};
  for(const key of Object.keys(material).sort()){
    if(['uuid','version','_listeners'].includes(key))continue;
    const value=material[key];if(value===undefined)continue;
    if(value===null||['string','number','boolean'].includes(typeof value))result[key]=value;
    else if(value.isTexture)result[key]={texture:shoreTextureSettings(value)};
    else if(value.isColor||value.isVector2||value.isVector3||value.isMatrix3||value.isEuler)result[key]=value.toArray();
    else if(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)result[key]=value;
    else throw new Error('Unsupported prepared material field '+key);
  }
  return result;
}
