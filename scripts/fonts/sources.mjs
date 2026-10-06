// Source fonts for the blog, fetched from the google/fonts repository and verified by SHA-256.
// They are not committed (≈45 MB); the build keeps them in world/.cache/font-sources (cached in CI).
//   node scripts/fonts/sources.mjs      → download whatever is missing
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE_DIR = process.env.BLOG_FONT_SOURCES || path.join(root, 'world/.cache/font-sources');
const RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl/';

export const SOURCES = {
  sansSC: {file: 'NotoSansSC[wght].ttf', url: `${RAW}notosanssc/NotoSansSC%5Bwght%5D.ttf`, sha256: 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da'},
  serifSC: {file: 'NotoSerifSC[wght].ttf', url: `${RAW}notoserifsc/NotoSerifSC%5Bwght%5D.ttf`, sha256: '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9'},
  sourceSerif: {file: 'SourceSerif4[opsz,wght].ttf', url: `${RAW}sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf`, sha256: '97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b'},
  sourceSerifItalic: {file: 'SourceSerif4-Italic[opsz,wght].ttf', url: `${RAW}sourceserif4/SourceSerif4-Italic%5Bopsz,wght%5D.ttf`, sha256: '15fbc7e4679489a501998c3669272637a6646388ef7e4bd77eebb5bf967a1f42'},
};

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const sourcePath = key => path.join(SOURCE_DIR, SOURCES[key].file);

/** The verified bytes of a source font, or null when it is missing or does not match its hash. */
export function readSource(key) {
  const file = sourcePath(key);
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  return sha(bytes) === SOURCES[key].sha256 ? bytes : null;
}

/** Download the missing sources. Never throws: the blog falls back to system CJK fonts without them. */
export async function fetchSources(keys = Object.keys(SOURCES), log = console.log) {
  mkdirSync(SOURCE_DIR, {recursive: true});
  const ok = [];
  for (const key of keys) {
    if (readSource(key)) { ok.push(key); continue; }
    try {
      const response = await fetch(SOURCES[key].url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (sha(bytes) !== SOURCES[key].sha256) throw new Error('SHA-256 mismatch (upstream file changed; update scripts/fonts/sources.mjs)');
      writeFileSync(sourcePath(key), bytes);
      ok.push(key);
      log(`font source: ${SOURCES[key].file} (${(bytes.length / 1e6).toFixed(1)} MB)`);
    } catch (error) {
      log(`font source unavailable: ${SOURCES[key].file}: ${error.message}`);
    }
  }
  return ok;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await fetchSources();
