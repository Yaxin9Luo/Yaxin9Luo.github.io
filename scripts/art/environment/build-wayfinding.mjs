import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {environmentSignLabels} from '../../../world/src/environment-signage.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
GlobalFonts.registerFromPath(path.join(root,'world/public/fonts/inter.ttf'),'Academy Inter');
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Academy Chinese');
const output=path.join(root,'world/public/textures/wayfinding');await fs.mkdir(output,{recursive:true});
for(const label of environmentSignLabels){
  const canvas=createCanvas(1536,594),ctx=canvas.getContext('2d');
  ctx.fillStyle='#273f47';ctx.fillRect(0,0,1536,594);
  ctx.strokeStyle='#a99160';ctx.lineWidth=3;ctx.strokeRect(20,20,1496,554);ctx.strokeRect(34,34,1468,526);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f0e7d1';
  ctx.font='600 103px "Academy Inter"';ctx.fillText(label.en,768,139);
  ctx.font='85px "Academy Chinese"';ctx.fillText(label.zh,768,255);
  ctx.fillStyle='#bba778';ctx.fillRect(567,333,402,2);
  ctx.font='500 38px "Academy Inter"';ctx.fillText(label.motif,768,404);
  ctx.font='39px "Academy Chinese"';ctx.fillText(label.motifZh,768,474);
  await fs.writeFile(path.join(output,`${label.id}.png`),canvas.toBuffer('image/png'));
}
console.log(`Prepared ${environmentSignLabels.length} bilingual physical signs.`);
