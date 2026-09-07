export const locations = [
  { id:'about', icon:'castle', name:{en:'The Grand Academy',zh:'中央魔法学院'}, subtitle:{en:'Meet the researcher',zh:'认识研究者'}, x:0,z:-38,y:9,radius:34,height:78, color:'#dfbd7e',number:'I' },
  { id:'publications', icon:'book', name:{en:'The Infinite Library',zh:'无尽图书馆'}, subtitle:{en:'Papers & discoveries',zh:'论文与发现'}, x:-70,z:7,y:7,radius:14,height:24,color:'#b2c5aa',number:'II' },
  { id:'projects', icon:'spark', name:{en:'The Artificer’s Atelier',zh:'造物者工坊'}, subtitle:{en:'Ideas made real',zh:'让想法成为现实'}, x:64,z:37,y:6,radius:14,height:20,color:'#d7a087',number:'III' },
  { id:'research', icon:'orbit', name:{en:'The Astral Observatory',zh:'星象研究台'}, subtitle:{en:'Research horizons',zh:'研究的远方'}, x:-84,z:-72,y:7,radius:14,height:28,color:'#b6b3d6',number:'IV' },
  { id:'journey', icon:'compass', name:{en:'The Wayfarer’s Ruins',zh:'旅人的古迹'}, subtitle:{en:'A winding journey',zh:'一路走来的故事'}, x:-45,z:70,y:5,radius:13,height:17,color:'#b9cbb7',number:'V' },
  { id:'contact', icon:'feather', name:{en:'The Owl Post',zh:'猫头鹰邮局'}, subtitle:{en:'Let’s make a connection',zh:'捎来一封信'}, x:80,z:-65,y:8,radius:14,height:25,color:'#e0c28e',number:'VI' },
];
export const worldBounds = {x:170,z:158,ceiling:130};
export const islands=[{x:0,z:16,rx:108,rz:94,y:6},{x:-84,z:-72,rx:34,rz:33,y:7},{x:80,z:-65,rx:34,rz:33,y:8}];
export const bridges={research:[[-54,-39],[-70,-57]],contact:[[48,-37],[65,-51]]};
export const court={x:0,z:35,y:6};
export const exhibitSites=[
  {id:'autodesign',x:45,z:54,y:6,color:'#647998'},
  {id:'dvin',x:80,z:57,y:6,color:'#734e64'},
  {id:'apl',x:-51,z:25,y:7,color:'#546f6b'},
];
export const mapPoint=(x,z)=>({x:90+x/1.95,y:90+z/1.95});
export const ringPositions = [
  [18,14,62],[10,18,32],[-25,23,22],[-56,24,13],[-62,38,-26],[-47,69,-68],[14,105,-80],[56,65,-36],[61,27,24],[34,17,58],
];
export const crystalPositions = [[15,12,51],[-32,12,48],[-63,14,24],[-83,16,-33],[-42,39,-74],[32,91,-56],[89,20,-24],[56,13,60]];
export const wispPositions = [[32,12,40],[-28,13,42],[-86,14,28],[87,17,11],[48,31,-78],[-42,33,-87]];
export const spawn = {x:18,y:18,z:74};
export const spellDefinitions = [
  {id:'lumos', name:{en:'Lumos',zh:'荧光闪烁'}, subtitle:{en:'A swift bolt of starlight',zh:'迅捷的星光弹'},color:'#a9e5ef',cost:7,cooldown:.26,damage:1,speed:49},
  {id:'incendio',name:{en:'Incendio',zh:'火焰熊熊'},subtitle:{en:'An ember burst that spreads',zh:'绽放并扩散的火焰'},color:'#ffb16c',cost:20,cooldown:.8,damage:2,speed:35,radius:7},
  {id:'avada',name:{en:'Avada Kedavra',zh:'阿瓦达索命'},subtitle:{en:'A powerful emerald curse',zh:'强力的翡翠色咒语'},color:'#a2f29a',cost:38,cooldown:1.5,damage:4,speed:58},
];
