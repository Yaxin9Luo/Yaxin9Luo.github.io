export const locations = [
  { id:'about', icon:'castle', name:{en:'The Grand Academy',zh:'中央魔法学院'}, subtitle:{en:'Meet the researcher',zh:'认识研究者'}, x:0,z:-20,y:5,radius:20, color:'#dfbd7e',number:'I' },
  { id:'publications', icon:'book', name:{en:'The Infinite Library',zh:'无尽图书馆'}, subtitle:{en:'Papers & discoveries',zh:'论文与发现'}, x:-44,z:0,y:4,radius:12,color:'#b2c5aa',number:'II' },
  { id:'projects', icon:'spark', name:{en:'The Artificer’s Atelier',zh:'造物者工坊'}, subtitle:{en:'Ideas made real',zh:'让想法成为现实'}, x:40,z:24,y:3,radius:11,color:'#d7a087',number:'III' },
  { id:'research', icon:'orbit', name:{en:'The Astral Observatory',zh:'星象研究台'}, subtitle:{en:'Research horizons',zh:'研究的远方'}, x:-48,z:-49,y:4,radius:12,color:'#b6b3d6',number:'IV' },
  { id:'journey', icon:'compass', name:{en:'The Wayfarer’s Ruins',zh:'旅人的古迹'}, subtitle:{en:'A winding journey',zh:'一路走来的故事'}, x:-29,z:45,y:3,radius:10,color:'#b9cbb7',number:'V' },
  { id:'contact', icon:'feather', name:{en:'The Owl Post',zh:'猫头鹰邮局'}, subtitle:{en:'Let’s make a connection',zh:'捎来一封信'}, x:43,z:-42,y:4,radius:11,color:'#e0c28e',number:'VI' },
];
export const ringPositions = [
  [10,8,42],[5,10,26],[-13,12,15],[-28,11,4],[-29,15,-18],[-18,23,-41],[15,25,-44],[29,16,-17],[29,11,8],[17,8,31],
];
export const crystalPositions = [[9,7,34],[-20,8,32],[-38,8,17],[-55,9,-22],[-28,11,-49],[24,9,-44],[54,8,-17],[35,8,40]];
export const wispPositions = [[20,7,27],[-19,8,25],[-55,7,19],[54,9,7],[29,10,-53],[-24,9,-61]];
export const spawn = {x:9,y:8,z:48};
export const spellDefinitions = [
  {id:'lumos', name:{en:'Lumos',zh:'荧光闪烁'}, subtitle:{en:'A swift bolt of starlight',zh:'迅捷的星光弹'},color:'#a9e5ef',cost:7,cooldown:.26,damage:1,speed:49},
  {id:'incendio',name:{en:'Incendio',zh:'火焰熊熊'},subtitle:{en:'An ember burst that spreads',zh:'绽放并扩散的火焰'},color:'#ffb16c',cost:20,cooldown:.8,damage:2,speed:35,radius:7},
  {id:'avada',name:{en:'Avada Kedavra',zh:'阿瓦达索命'},subtitle:{en:'A powerful emerald curse',zh:'强力的翡翠色咒语'},color:'#a2f29a',cost:38,cooldown:1.5,damage:4,speed:58},
];
