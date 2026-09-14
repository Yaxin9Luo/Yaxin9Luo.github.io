// Pure review metadata: importing this file never constructs plant geometry.
export const gardenUnderstoryStudyViews = Object.freeze([
  { id: 'understory-whole', label: '细叶、羽状蕨与低花灌木', groups: ['garden-understory-study'], direction: [-1, .42, 1], padding: 1.1 },
  { id: 'understory-sedge', label: '细叶丛的弧线与纵脊', groups: ['understory-sedge'], direction: [-1, .35, 1], padding: 1.1 },
  { id: 'understory-fern', label: '两级羽片与自然舒展', groups: ['understory-fern'], direction: [.6, .6, 1], padding: 1.12 },
  { id: 'understory-pinnules', label: '真实叶齿、叶脉和羽片间隙', groups: ['understory-fern-frond-04'], direction: [.3, .7, 1], padding: 1.15 },
  // Derived from the actual seeded frond-04 pose's local +Z direction. Keep
  // the older nearly edge-on camera above for a direct R1/R2 comparison.
  { id: 'understory-frond-face', label: '羽片正面叶展与覆盖', groups: ['understory-fern-frond-04'], direction: [-.3386116881, .7724227245, -.5373129995], padding: 1.12 },
  { id: 'understory-shrub', label: '弧枝、对生叶与疏密花簇', groups: ['understory-flower-shrub'], direction: [-1, .3, 1], padding: 1.12 },
  { id: 'understory-flower', label: '真实花瓣、花蕊与着生', groups: ['understory-shrub-flowering-spray-01'], direction: [.3, .5, 1], padding: 1.12 },
  { id: 'understory-roots', label: '植株基部和局部组合', groups: ['garden-understory-study'], direction: [-1, .10, 1], padding: 1.05 },
]);
