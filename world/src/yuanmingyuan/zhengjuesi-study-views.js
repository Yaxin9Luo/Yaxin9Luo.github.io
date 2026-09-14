// Pure framing records: loading the studio catalogue must not load geometry.
// Detail views retain complete named buildings but hide unrelated foreground
// halls. The two ensemble views intentionally preserve all site relationships.
export const zhengjuesiViews = {
  threequarter: { label: '正觉寺 · 南门至后楼', groups: [], direction: [.57, .62, 1] },
  aerial: { label: '两路四进院落 · 平面', groups: [], direction: [.10, 1, .15] },
  gate: { label: '山门 · 石券与八字墙', groups: ['zhengjuesi-shanmen', 'zhengjuesi-south-wall'], isolate: ['zhengjuesi-shanmen', 'zhengjuesi-south-wall'], direction: [.28, .24, 1], margin: 1.14 },
  gateArch: { label: '山门 · 真实券洞与门槛', groups: ['zhengjuesi-shanmen'], isolate: ['zhengjuesi-shanmen'], direction: [.27, .16, 1], crop: { min: [.26, 0, 0], max: [.74, .73, 1] }, margin: 1.12 },
  tianwang: { label: '天王殿 · 五间歇山', groups: ['zhengjuesi-tianwangdian'], isolate: ['zhengjuesi-tianwangdian'], direction: [.56, .42, 1], margin: 1.16 },
  mainHall: { label: '历史三圣殿 · 单檐庑殿', groups: ['zhengjuesi-sanshengdian'], isolate: ['zhengjuesi-sanshengdian'], direction: [.63, .48, 1], margin: 1.15 },
  mainRear: { label: '三圣殿 · 后三间抱厦', groups: ['zhengjuesi-sanshengdian'], isolate: ['zhengjuesi-sanshengdian'], direction: [.65, .50, -1], margin: 1.13 },
  wenshu: { label: '文殊亭 · 无斗拱八方重檐', groups: ['zhengjuesi-wenshuting'], isolate: ['zhengjuesi-wenshuting'], direction: [.36, .29, 1], margin: 1.12 },
  wenshuJoinery: { label: '文殊亭 · 菱花窗与檐下彩画', groups: ['zhengjuesi-wenshuting'], isolate: ['zhengjuesi-wenshuting'], direction: [.24, .10, 1], crop: { min: [.17, 0, .30], max: [.83, .57, 1] }, margin: 1.12 },
  wenshuRoof: { label: '文殊亭 · 双层八角瓦作', groups: ['zhengjuesi-wenshuting'], isolate: ['zhengjuesi-wenshuting'], direction: [.74, .90, .82], crop: { min: [0, .38, 0], max: [1, 1, 1] }, margin: 1.14 },
  zuishang: { label: '最上楼 · 二层硬山与转角房', groups: ['zhengjuesi-zuishanglou', 'zhengjuesi-west-shunshan', 'zhengjuesi-east-shunshan'], isolate: ['zhengjuesi-zuishanglou', 'zhengjuesi-west-shunshan', 'zhengjuesi-east-shunshan'], direction: [.36, .35, 1], margin: 1.13 },
  westPaintwork: { label: '西五佛殿 · 枋心与梁架', groups: ['zhengjuesi-west-wufodian'], isolate: ['zhengjuesi-west-wufodian'], direction: [1, .26, .35], margin: 1.13 },
  monks: { label: '东跨院 · 僧房与通路', groups: ['zhengjuesi-monks-court'], isolate: ['zhengjuesi-monks-court'], direction: [1, .80, .45], margin: 1.12 },
};
