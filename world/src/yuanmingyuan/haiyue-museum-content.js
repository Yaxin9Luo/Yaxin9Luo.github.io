// Pure optional catalogue content. Integration is owned by the main-scene task.
import { haiyueSources as records } from './haiyue-layout.js';
const b = (zh, en) => ({ zh, en });
export const haiyueMuseumSources = {
  'haiyue-lin-2024': { title: b(records.research.title, 'Lin Zhiyi · An initial reconstruction study of Haiyue Kaijin'), url: records.research.url, kind: b('圆明园管理处刊载 · 现代复原研究', 'Park-published modern reconstruction research'), date: '2024-06-27', publicImagesBundled: false },
  'haiyue-park-site': { title: b(records.site.title, 'Yuanmingyuan Park · Haiyue Kaijin'), url: records.site.url, kind: b('圆明园管理处 · 景点说明', 'Yuanmingyuan Park · Site description'), date: '2011-01-05', publicImagesBundled: false },
};
export const haiyueEntries = [
  {
    id: 'haiyue-kaijin', region: 'changchunyuan', kind: 'architecture', title: b('海岳开襟', 'Haiyue Kaijin'),
    lead: b('圆台托起方楼，四面码头向湖面展开。', 'A square pavilion rises from circular terraces, with four landings opening toward the lake.'),
    sign: b('由白石码头登台，循廊看向湖心高楼。', 'Climb from the white-stone landing and look through the galleries toward the central pavilion.'),
    paragraphs: [b('海岳开襟位于长春园思永斋以北的湖中，1747年建成。官方记载这组建筑在1860年幸存，后经修缮，1900年毁于战乱。', 'Completed in 1747 on the lake north of Siyongzhai in Changchunyuan, Haiyue Kaijin survived 1860 according to the park’s account. It was repaired later and destroyed in 1900.'), b('这件独立模型选择1859—1860年的晚期组合，保留三层正楼、南北配殿和东西配殿。双圆台与四向码头构成登临路线。', 'This standalone interpretation selects the late ensemble around 1859–1860: a three-storey pavilion and four surrounding halls, approached across two circular terraces from four cardinal landings.')],
    sources: ['haiyue-park-site', 'haiyue-lin-2024'], related: ['haiyue-main-pavilion', 'haiyue-periods', 'haiyue-water-approach'], images: ['haiyueLateEnsemble'],
    note: b('建筑位置、层高和细部根据公开图纸作比例推定，未经原始测绘校准。', 'Positions, levels and details are proportional interpretations of published plans, without original survey calibration.'),
  },
  {
    id: 'haiyue-main-pavilion', region: 'changchunyuan', kind: 'architecture', title: b('四面楼阁与十字脊', 'Four-sided pavilion and cross ridge'),
    lead: b('从廊柱之间向外看，楼层逐级收进。', 'The storeys recede above open galleries and surrounding views.'),
    sign: b('看外廊与内室的层次，再辨认四面山花。', 'Compare the outer galleries with the inner rooms, then look for the four gabled faces.'),
    paragraphs: [b('研究文章中的晚期方案采用底层四面各五间、上两层各三间的楼阁。底层与二层的外廊环绕内室，形成不同高度的观湖空间；模型参照图示的西侧楼梯组织登楼路线。', 'The published late-period proposal gives five bays on each ground-floor face and three on each upper face. Galleries surround the ground-floor and middle rooms, offering views from different heights. The model follows the illustrated western stair position for its route upward.'), b('黄瓦绿边、青绿枋心及栏板雕纹采用同代工艺类比与原创设计。其作用是帮助观察结构层次，不能据此认定为海岳原物颜色和纹样。', 'Yellow tiles with green margins, blue-green beams and carved rails combine period comparisons with original design. They clarify the construction but do not establish Haiyue’s original colours or patterns.')],
    sources: ['haiyue-lin-2024'], related: ['haiyue-kaijin', 'haiyue-periods'], images: ['haiyueLateEnsemble', 'haiyueStoneDetail'],
    note: b('第二层11.5米、第三层8.5米来自现代复原图的可读标注；楼梯位置有图示，具体步数与转折由本模型解释。', 'The 11.5 m second storey and 8.5 m third storey are readable dimensions in a modern proposal. A western stair is shown there, while its treads and turns are interpreted here.'),
  },
  {
    id: 'haiyue-periods', region: 'changchunyuan', kind: 'history', title: b('分清早期、晚期与后来的木桥', 'Distinguishing the successive ensembles'),
    lead: b('看起来更繁复的组合，未必属于同一年。', 'The more elaborate arrangement does not necessarily belong to the same date.'),
    sign: b('比较正楼抱厦与配殿，辨认改建后的变化。', 'Compare the pavilion’s projections and the side halls to identify the changes.'),
    paragraphs: [b('论文的时期对照将正楼四抱厦、方亭、曲廊和牌坊列入较早的组合；晚期配殿改为南北五间并出三间抱厦，另有东西三间配殿。西侧木桥则在光绪时期增设。', 'The study places the pavilion’s four projections, corner pavilions, curved galleries and ceremonial arches in the earlier ensemble. The late plan has five-bay north and south halls with three-bay projections, plus three-bay east and west halls. The western timber bridge was added in the Guangxu period.')],
    sources: ['haiyue-lin-2024'], related: ['haiyue-kaijin', 'haiyue-main-pavilion'], images: [],
    note: b('东西配殿的重檐顶属于研究者的推定；低清全岛图不足以确认南北两抱厦的逐项朝向和尺寸。', 'The double-eave roofs of the east and west halls are the researcher’s hypothesis. The small whole-island reproduction cannot establish every orientation or dimension of the north and south projections.'),
  },
  {
    id: 'haiyue-water-approach', region: 'changchunyuan', kind: 'landscape', title: b('从流香渚泛舟登岛', 'Approaching the island from Liuxiangzhu'),
    lead: b('从西岸入湖，先见白石圆台，再见高楼。', 'From the western shore, the circular stone terrace appears beneath the rising pavilion.'),
    sign: b('在码头回望西岸，再转身沿石阶登台。', 'Look back toward the western shore before turning to climb the terrace steps.'),
    paragraphs: [b('流香渚位于海岳开襟西岸，是临水设有船埠的重檐方亭。园方介绍将它作为清帝从明春门进入长春园后放舟之处；湖心岛东西南北均有码头。', 'Liuxiangzhu stood on the western shore, a double-eave square pavilion with a landing. The park describes it as a departure point after entering Changchunyuan through Mingchunmen; the island had landings on all four sides.'), b('东岸半月台与岛楼隔水相望。光绪时期后来增设的西侧木桥改变了登岛方式，本件晚期模型选择更早的水路，保留船埠和石阶。', 'Banyuetai, the Half-Moon Terrace on the eastern shore, faced the island across the water. A western timber bridge later added in the Guangxu period changed access to the island. This interpretation retains the earlier boat approach and stone steps.')],
    sources: ['haiyue-park-site', 'haiyue-lin-2024'], related: ['haiyue-kaijin', 'haiyue-periods'], images: [],
    note: b('流香渚和半月台不属于这件独立岛上建筑组合；码头尺寸、水位与石阶级数是比例解释。', 'Liuxiangzhu and the Half-Moon Terrace lie outside this standalone island ensemble. Landing dimensions, water level and stair counts are proportional interpretations.'),
  },

];
