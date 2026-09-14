// Pure bilingual content. The main catalogue owner chooses when to integrate it.
// Source photographs are linked to their institutions, not redistributed here.
import { zhengjuesiSources as records } from './zhengjuesi-layout.js';
const b = (zh, en) => ({ zh, en });
const kinds = {
  'official-site-description': b('圆明园管理处 · 景点介绍', 'Yuanmingyuan Park · Site description'),
  'institutional-architectural-research': b('圆明园研究 · 建筑史', 'Yuanmingyuan Research · Architectural history'),
  'park-published-historical-study': b('圆明园研究 · 史料研究', 'Yuanmingyuan Research · Historical study'),
  'commissioned-iconography-study': b('园方委托 · 造像研究', 'Park-commissioned iconographic study'),
  'commissioned-restoration-research': b('央美研究中心 · 复原研究', 'CAFA research centre · Restoration study'),
  'palace-museum-journal-study': b('故宫学刊 · 造像史研究', 'Studies of the Palace Museum · Sculpture history'),
  'heritage-authority-construction-record': b('北京市文物局 · 施工记录', 'Beijing heritage authority · Construction record'),
  'contractor-account-published-by-industry-association': b('修缮施工方 · 实践记录', 'Restoration contractor · Construction account'),
};

const englishTitles = {
  'park-zhengjuesi': 'Yuanmingyuan Park · Zhengjuesi',
  'qi-zhang-2021': 'Qi Shuang and Zhang Fengwu · The architecture of Zhengjuesi and Chengde Shuxiangsi',
  'wu-zhengjuesi': 'Wu Fengchun · Tibetan Buddhism and Zhengjuesi',
  'park-wenshu-2016': 'Yuanmingyuan Park and Beijing Tianxin Yingguo · Study of the Zhengjuesi Manjushri sculpture',
  'cafa-wenshu-2020': 'CAFA Yuanmingyuan Research Centre · Reconstructing the Zhengjuesi Manjushri sculpture',
  'dpm-zhang-2021': 'Zhang Mengzeng · The historical evolution of the Zhengjuesi Manjushri image',
  'beijing-restoration-2011': 'Beijing Municipal Cultural Heritage Bureau · Progress on rebuilding Zhengjuesi',
  'contractor-2012': 'Zhang Fengliang · Construction practice in the Zhengjuesi reconstruction',
};
export const zhengjuesiSources = Object.fromEntries(records.map(source => [source.id, {
  title: b(source.title, englishTitles[source.id]), url: source.url,
  kind: kinds[source.type], date: source.date,
  publicImagesBundled: false,
}]));

export const zhengjuesiEntries = [
  {
    id: 'zhengjuesi', region: 'qichunyuan', kind: 'architecture', title: b('正觉寺', 'Zhengjuesi'),
    lead: b('一道独立南门，连接皇家佛寺与园中道路。', 'An independent southern entrance joined the imperial temple to paths inside the garden.'),
    sign: b('入山门，循中轴走向八角文殊亭。', 'Enter the gate and follow the axis toward the octagonal Wenshu Pavilion.'),
    paragraphs: [
      b('正觉寺建于1773年，位于绮春园正宫门西。南侧单设山门，北门与园内相通。中轴由山门、天王殿、正觉殿、文殊亭及最上楼组成，东侧另有僧人居住的跨院。', 'Completed in 1773 west of Qichunyuan’s main palace entrance, Zhengjuesi had its own southern gate and a northern connection to the garden. Its axis passed through the gate, Tianwangdian, Zhengjuedian, Wenshuting and Zuishanglou, with a separate monks’ court to the east.'),
      b('寺院地坪基本平坦，石台将后部殿、亭、楼连接起来。三组配殿分列两侧，院落由开阔逐渐转向紧凑。', 'The courts were essentially level. Raised stone platforms connected the later halls and pavilion, while three pairs of side halls enclosed spaces that became more compact toward the rear.'),
    ],
    sources: ['park-zhengjuesi', 'qi-zhang-2021'], related: ['zhengjuesi-shanmen', 'zhengjuesi-wenshuting', 'zhengjuesi-periods'], images: [],
    note: b('当前建筑组合依据文献形制和公开研究图建立；院落坐标、跨距与细部尺寸为比例推定。', 'This architectural interpretation uses published historical forms and research plans; its coordinates, spans and detail dimensions are proportional estimates.'),
  },
  {
    id: 'zhengjuesi-shanmen', region: 'qichunyuan', kind: 'architecture', title: b('山门与四体匾额', 'The gate and its four-script inscription'),
    lead: b('灰瓦红墙间，一座石券门迎向寺前道路。', 'A stone arch opens through red walls beneath grey roof tiles.'),
    sign: b('走近石券，细看八字墙上的莲花。', 'Approach the stone arch and the lotus reliefs on the splayed walls.'),
    paragraphs: [
      b('山门面阔三间，使用歇山屋顶。清代描述和旧照片留下了石券门、两侧八字墙与莲花石饰的线索。门匾以汉、满、藏、蒙四种文字书写寺名。', 'The three-bay gate had a hip-and-gable roof. Historical descriptions and old photographs record the stone arch, splayed side walls and lotus reliefs. Its name plaque combined Chinese, Manchu, Tibetan and Mongolian.'),
    ],
    sources: ['park-zhengjuesi', 'wu-zhengjuesi', 'park-wenshu-2016'], related: ['zhengjuesi', 'zhengjuesi-periods'], images: [],
    note: b('模型仅转录已确认的中文寺名，字形为当代解释；未冒充乾隆手迹或补造其余三种文字。', 'Only the confirmed Chinese name is transcribed in the model, using contemporary letter forms. It does not reproduce Qianlong’s handwriting or invent the other three inscriptions.'),
  },
  {
    id: 'zhengjuesi-wenshuting', region: 'qichunyuan', kind: 'architecture', title: b('文殊亭', 'Wenshu Pavilion'),
    lead: b('八方重檐之下，曾供奉骑狮文殊。', 'An image of Manjushri riding a lion once stood beneath the eight-sided double roof.'),
    sign: b('抬头看两层檐口，再循菱花窗看向亭内。', 'Look up at the two eaves, then through the diamond lattice into the pavilion.'),
    paragraphs: [
      b('文殊亭位于正觉殿后，是无斗拱的八方重檐攒尖建筑。遗存建筑后来一度被改成单檐，现代修缮恢复了重檐形式。', 'Behind Zhengjuedian stood the octagonal Wenshu Pavilion, with two pyramidal eaves and no dougong bracket sets. The surviving structure was later altered to a single eave; the modern repair restored the double-eave form.'),
      b('一张受损旧照保留了正觉寺文殊像的部分面貌。园方与研究机构又整理了档案、同类造像和复原建议；相似寺院的佛像可以帮助比较，却不能直接视作正觉寺原像。', 'A damaged historical photograph preserves part of the Zhengjuesi image. Institutional studies combine archives, comparative sculptures and restoration proposals; related temple images aid comparison but are not the original Zhengjuesi object.'),
    ],
    sources: ['qi-zhang-2021', 'park-wenshu-2016', 'cafa-wenshu-2020', 'dpm-zhang-2021'], related: ['zhengjuesi', 'zhengjuesi-periods'], images: [],
    note: b('本轮保留亭内空间，未制作细节仍不充分的完整造像。', 'The pavilion interior is retained in this study; a complete sculpture awaits sufficient evidence for its missing details.'),
  },
  {
    id: 'zhengjuesi-zuishanglou', region: 'qichunyuan', kind: 'architecture', title: b('最上楼与后院', 'Zuishanglou and the rear court'),
    lead: b('七间后楼收住中轴，北院门再通向园林。', 'The seven-bay rear building closes the axis before a northern gateway returns to the garden.'),
    sign: b('看硬山端墙与上下相贯的木构。', 'Look at the flush gable walls and timber framing through both floors.'),
    paragraphs: [
      b('最上楼为二层硬山建筑，面阔七间、进深三间，两侧另接较低的顺山房。现代复建记录特别说明其穿插梁与檐柱、金柱相贯的做法。', 'Zuishanglou was a two-storey flush-gable building, seven bays wide and three deep, flanked by lower rooms. Modern reconstruction records describe through-beams joining the eave and inner columns.'),
    ],
    sources: ['qi-zhang-2021', 'park-zhengjuesi', 'contractor-2012'], related: ['zhengjuesi', 'zhengjuesi-wenshuting'], images: [],
    note: b('楼板、梁架与楼梯均为实体结构；楼梯具体位置属于当代空间解释。', 'Floors, beams and stairs are modelled as solid structures. The precise stair position is a contemporary spatial interpretation.'),
  },
  {
    id: 'zhengjuesi-periods', region: 'qichunyuan', kind: 'history', title: b('幸存、损毁与重建', 'Survival, loss and reconstruction'),
    lead: b('同一座寺院，不能只用一张今天的照片理解。', 'The temple’s history reaches beyond any single photograph of its present form.'),
    sign: b('比较历史屋顶与现代复建，辨认不同年代。', 'Compare historical roofs and modern rebuilding to distinguish their periods.'),
    paragraphs: [
      b('正觉寺主体在1860年幸存，随后仍经历门窗、佛像和建筑的损失。三圣殿至1933年已不存。2002年后展开保护修缮，部分殿宇于2009—2011年重建。', 'The main temple survived 1860 but later suffered losses to joinery, sculpture and buildings. Sanshengdian was gone by 1933. Conservation began after 2002, with several buildings reconstructed in 2009–2011.'),
      b('历史研究记载三圣殿为单檐庑殿、后接三间抱厦；现代施工照片则显示重檐歇山形式。这件模型采用前者，并将现代修缮留下的材色与工艺资料另作参考。', 'Historical studies describe Sanshengdian with a single-eave hipped roof and a three-bay rear annex. Modern construction photographs show a double-eave hip-and-gable version. This model follows the former, using modern fabric separately to inform materials and workmanship.'),
      b('修缮前后记录中有26株古树留存，但其逐株坐标尚未核实；本模型没有据此伪造一份清代种植图。', 'Records around the repair period mention 26 surviving old trees. Their individual positions have not been verified, so the study does not present an invented Qing planting plan.'),
    ],
    sources: ['cafa-wenshu-2020', 'dpm-zhang-2021', 'beijing-restoration-2011', 'contractor-2012', 'qi-zhang-2021'], related: ['zhengjuesi', 'zhengjuesi-shanmen', 'zhengjuesi-wenshuting'], images: [],
  },
];
