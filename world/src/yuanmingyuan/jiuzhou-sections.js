// Pure loading boundaries. These divide the dated model into independent
// courts; they neither change scale/detail nor construct a hidden whole model.
export const jiuzhouStudySections = {
  central: {
    label: { zh: '中路三殿、抱厦与同道戏院', en: 'Central halls, rear addition and Tongdao theatre' },
    routes: ['central', 'central-west', 'central-east'],
    courts: ['central-front', 'central-rear', 'tongdao-theatre-court'],
    galleries: ['central-fore-west', 'central-fore-east', 'central-rear-west', 'central-rear-east', 'shende-to-tongdao'],
    walls: [],
  },
  western: {
    label: { zh: '慎德堂与西路园居', en: 'Shendetang and western courts' },
    routes: ['west', 'far-west', 'west-garden'],
    courts: ['shende-garden', 'jifu-front', 'xingcun-front'],
    galleries: ['shende-west', 'shende-east', 'jifu-west', 'jifu-east'],
    walls: ['west-outer', 'west-front', 'west-north', 'jifu-shende', 'west-garden-front'],
  },
  eastern: {
    label: { zh: '天地一家春与东西六座两院', en: 'Tiandiyijiachun and the two eastern courts' },
    routes: ['east', 'inner-east'],
    courts: ['tiandi-front', 'tiandi-rear', 'inner-east-middle', 'inner-east-east'],
    galleries: ['tiandi-west', 'tiandi-east', 'inner-east-middle-north-link', 'inner-east-middle-court-side', 'inner-east-east-court-side'],
    walls: ['inner-east-dividing', 'inner-east-south', 'tiandi-east-boundary', 'tiandi-south-east', 'tiandi-south-west', 'north-fifteen-rooms'],
  },
  waterfront: {
    label: { zh: '岛岸、如意桥与桥头接口', en: 'Shore, Ruyi Bridge and landing interfaces' },
    routes: [], courts: [], galleries: [], walls: [],
  },
};

export function jiuzhouFeatureSection(kind, id) {
  const result = Object.entries(jiuzhouStudySections).find(([, section]) => section[kind]?.includes(id));
  if (!result) throw new Error(`No Jiuzhou section owns ${kind}:${id}`);
  return result[0];
}

export function jiuzhouSectionSelection(sections) {
  if (!Array.isArray(sections) || !sections.length || sections.some(id => !Object.hasOwn(jiuzhouStudySections, id))) throw new Error('Jiuzhou sections must select central, western, eastern or waterfront.');
  return [...new Set(sections)];
}
