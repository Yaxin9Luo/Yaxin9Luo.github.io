import {readFile} from 'node:fs/promises';

let revision=0;
const moduleURL=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');

// Test-only access to the actual private Builder; Three still performs each merge.
// Imports resolve against the production file even when reading an entry archive.
export async function loadHerbariumBuilder(path=new URL('../../src/herbarium-assets.js',import.meta.url)){
  const utils=import.meta.resolve('three/addons/utils/BufferGeometryUtils.js');
  const wrapper=moduleURL(`import * as original from '${utils}';
export const hooks={};
export function mergeGeometries(...args){hooks.beforeMerge?.(...args);const result=original.mergeGeometries(...args);hooks.afterMerge?.(result,...args);return result;}
export function mergeVertices(...args){hooks.beforeWeld?.(...args);return original.mergeVertices(...args);}
//# sourceURL=herbarium-test-merges-${revision++}.js`);
  const {hooks}=await import(wrapper),base=new URL('../../src/herbarium-assets.js',import.meta.url);
  const code=(await readFile(path,'utf8')).replace(/from '([^']+)'/g,(_all,specifier)=>`from '${specifier==='three/addons/utils/BufferGeometryUtils.js'?wrapper:specifier.startsWith('.')?new URL(specifier,base).href:import.meta.resolve(specifier)}'`);
  const url=moduleURL(code+`\nexport {Builder,sourcePlant};\n//# sourceURL=herbarium-test-builder-${revision}.js`);
  return {...await import(url),hooks,url};
}

export async function loadHerbariumConsumer(path,assetURL,overrides={}){
  const code=(await readFile(path,'utf8')).replace(/from '([^']+)'/g,(_all,specifier)=>`from '${overrides[specifier]||(specifier==='./herbarium-assets.js'?assetURL:specifier.startsWith('.')?new URL(specifier,new URL('../../src/herbarium-community.js',import.meta.url)).href:import.meta.resolve(specifier))}'`);
  const url=moduleURL(code+`\n//# sourceURL=herbarium-test-consumer-${revision++}.js`);
  return {...await import(url),url};
}
