export const QUALITY = {
  high: { dpr: 2.5, maxPixels: 8_500_000, samples: 4, shadows: true, mapSize: 4096 },
  balanced: { dpr: 2, maxPixels: 5_000_000, samples: 2, shadows: true, mapSize: 2048 },
  low: { dpr: 1.25, maxPixels: 2_000_000, samples: 0, shadows: false, mapSize: 1024 },
};

// A stable limit on framebuffer allocation, independent of frame rate or visits
// to busy parts of the map. The selected quality never silently deteriorates.
export function renderPixelRatio(mode, width, height, deviceRatio = 1) {
  const quality = QUALITY[mode] || QUALITY.high;
  const pixels = Math.max(1, Number.isFinite(width) ? width : 1) * Math.max(1, Number.isFinite(height) ? height : 1);
  const native = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Math.min(native, quality.dpr, Math.sqrt(quality.maxPixels / pixels));
}
