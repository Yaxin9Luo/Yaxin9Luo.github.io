// Pure review data. Importing these views cannot construct vegetation or load
// its materials. The near reference and both candidate tiers use one camera.
export const willowLodReviewViews = Object.freeze({
  near: { label: '原柳近景 · 完整冠形', direction: [.62, .20, 1], distance: 16, compare: ['near'], targetHeight: 4.1 },
  midFront: { label: '中景正面 · 冠幅与透光', direction: [.22, .08, 1], distance: 80, compare: ['near', 'mid'], targetHeight: 4.1 },
  midBack: { label: '中景背光 · 叶色与层次', direction: [-.25, .10, -1], distance: 80, compare: ['near', 'mid'], targetHeight: 4.1 },
  midSide: { label: '中景侧面 · 垂枝体积', direction: [1, .10, .13], distance: 80, compare: ['near', 'mid'], targetHeight: 4.1 },
  farFront: { label: '远景正面 · 实际观看尺度', direction: [.22, .06, 1], distance: 750, compare: ['near', 'far'], targetHeight: 4.1 },
  farSide: { label: '远景侧面 · 冠缘与空隙', direction: [1, .08, .13], distance: 750, compare: ['near', 'far'], targetHeight: 4.1 },
  transition: { label: '距离过渡 · 0/25/50/75/100%', direction: [.62, .20, 1], distance: 80, compare: ['near', 'mid'], phases: [0, .25, .5, .75, 1], targetHeight: 4.1 },
});
