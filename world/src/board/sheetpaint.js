// The sheets' bits of paint: small PaintSim pictures (title stroke, phase dabs, underline, washes, the model/harness
// mix) that the panels' HTML shows as CSS images. paint(PaintSim, scale) -> {name: dataURL}.
function sprite(P, W, H, scale, seed, materials, work) {
  const s = P.create({ width: W, height: H, scale, seed, ground: { base: 'canvas', color: '#FFFFFF', tooth: .22, pitch: 2.3 }, define: { materials } });
  const B = s.buffers, h0 = Float32Array.from(B.HT), r0 = Float32Array.from(B.CR), g0 = Float32Array.from(B.CG), b0 = Float32Array.from(B.CB);
  work(s);
  s.dry();
  s.render();
  const w = s.pxWidth, h = s.pxHeight, px = s.pixels, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const dist = Math.abs(B.CR[i] - r0[i]) + Math.abs(B.CG[i] - g0[i]) + Math.abs(B.CB[i] - b0[i]);
    d[j] = px[j]; d[j + 1] = px[j + 1]; d[j + 2] = px[j + 2];
    d[j + 3] = Math.min(255, Math.max(0, Math.max((B.HT[i] - h0[i]) * 2600, dist * 9) * 255));
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
function paint(P, scale = 2) {
  const oil = (color, color2, body = 1.2, more) => Object.assign({ base: 'oil', color, color2, blend: .6, body, reach: 0, merge: 0, pickup: 0 }, more);
  const thin = { gloss: 0, ridges: .03, grain: .01 };
  const M = {
    ultra: oil('#121C78', '#2233B0', 1.25), cobalt: oil('#2B45C8', '#4A69E4', 1.3), line: oil('#1B2A9E', '#3350D0', .7),
    blue: oil('#2A43C6', '#5673EA', 1.9), amber: oil('#E2823F', '#F3AA78', 1.9), mint: oil('#16936B', '#4FC29A', 1.9),
    pale: oil('#DCE2FA', '#E6EAFC', .28, thin), 'wash mm': oil('#D3DAF9', '#E3E8FC', .3, thin), 'wash ev': oil('#FADCC6', '#FCE9DA', .3, thin), 'wash pt': oil('#C9EBDD', '#DDF4EA', .3, thin),
    'wet blue': oil('#2A43C6', '#5673EA', 1.7, { merge: .5, pickup: .35 }), 'wet mint': oil('#16936B', '#4FC29A', 1.7, { merge: .5, pickup: .35 }),
  };
  // a loaded dab: the brush set down, pushed a little way and lifted
  const dab = (kind, seed) => sprite(P, 40, 40, scale, seed, M, s => {
    const ring = Array.from({ length: 9 }, (_, k) => { const a = 2.2 + k / 8 * Math.PI * 2; return [20 + Math.cos(a) * 4.5, 20.5 + Math.sin(a) * 4]; });
    s.paint({ material: kind, brush: { base: 'round', width: 22, clump: 5, streak: .6, rag: 1.5 }, path: ring });
    s.paint({ material: { base: kind, body: 1.5 }, brush: { base: 'round', width: 9, rag: 1 }, path: [[15, 19], [20, 15.5], [25, 17]], opacity: .7 });
  });
  const wash = (kind, seed) => sprite(P, 240, 96, scale, seed, M, s => {
    s.paint({ material: kind, brush: { base: 'flat', width: 44, rag: 14, wobble: .5, dry: 0, streak: .3 }, path: [[10, 30], [120, 27], [230, 31]] });
    s.paint({ material: kind, brush: { base: 'flat', width: 44, rag: 18, wobble: .5, dry: .05, streak: .3 }, path: [[226, 66], [118, 69], [14, 65]] });
  });
  return {
    swash: sprite(P, 300, 66, scale, 3, M, s => {
      s.paint({ material: 'ultra', brush: { base: 'flat', width: 44, rag: 12, wobble: .6, dry: .06, edge: .2 }, path: [[14, 35], [150, 31], [286, 34]], tone2: .05 });
      s.paint({ material: 'cobalt', brush: { base: 'flat', width: 15, rag: 8, dry: .3 }, path: [[30, 21], [170, 18], [262, 21]], opacity: .85 });
    }),
    mm: dab('blue', 21), ev: dab('amber', 22), pt: dab('mint', 23),
    under: sprite(P, 150, 10, scale, 7, M, s => s.paint({ material: 'line', brush: { base: 'round', width: 3.6, rag: 4, wobble: .3, dry: .22 }, path: [[4, 5.4], [75, 4.4], [146, 5.6]], pressure: [1, .8, .9] })),
    stroke: sprite(P, 360, 16, scale, 8, M, s => s.paint({ material: 'cobalt', brush: { base: 'round', width: 7.5, rag: 10, wobble: .5, dry: .2 }, path: [[6, 8.5], [120, 6.8], [240, 9], [354, 7.4]], pressure: [1, .85, .9, .6], load: 520 })),
    chip: sprite(P, 130, 26, scale, 9, M, s => s.paint({ material: 'pale', brush: { base: 'flat', width: 23, rag: 5, wobble: .3, dry: 0, streak: .3 }, path: [[5, 13.2], [65, 12.8], [125, 13.2]] })),
    'wash-mm': wash('wash mm', 31), 'wash-ev': wash('wash ev', 32), 'wash-pt': wash('wash pt', 33),
    // the loop: two loaded dabs laid side by side and pulled into each other while wet
    mix: sprite(P, 300, 190, scale, 41, M, s => {
      const ring = (cx, cy, r, from) => Array.from({ length: 11 }, (_, k) => { const a = from + k / 10 * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .9]; });
      s.paint({ material: 'wet blue', brush: { base: 'round', width: 58, clump: 6, streak: .6, rag: 2 }, path: ring(104, 96, 17, 2.4) });
      s.paint({ material: 'wet mint', brush: { base: 'round', width: 58, clump: 6, streak: .6, rag: 2 }, path: ring(196, 96, 17, -.7) });
      s.paint({ material: 'wet blue', brush: { base: 'round', width: 22, rag: 4 }, path: [[118, 76], [150, 80], [182, 98]], opacity: .85 });
      s.paint({ material: 'wet mint', brush: { base: 'round', width: 22, rag: 4 }, path: [[182, 116], [150, 112], [118, 96]], opacity: .85 });
    }),
  };
}

export {paint};
