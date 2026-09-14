const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const xieqiquCourtGardenR1Evidence=freeze({
  id:'xieqiqu-court-garden-r1',historicallySurveyed:false,nativeReviewed:false,
  description:'Contemporary low garden beds and differentiated court paving, composed from the north copperplate relationship; dimensions, colour, plant identity and exact pattern are not historical measurements.',
  sources:[
    'https://www.dpm.org.cn/learing_detail/379500.html',
    'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html',
  ],
  sourceReview:'work/yuanmingyuan/garden-understory-native-r2/review.json',
});
export function roundedCourtGardenRing(cx,cz,width,depth,radius,segments=10){
  if(![cx,cz,width,depth,radius].every(Number.isFinite)||width<=2*radius||depth<=2*radius||radius<=0)throw new Error('Invalid court garden outline');
  const points=[],hx=width/2-radius,hz=depth/2-radius;
  for(const [x,z,start]of [[hx,-hz,-Math.PI/2],[hx,hz,0],[-hx,hz,Math.PI/2],[-hx,-hz,Math.PI]])
    for(let i=0;i<=segments;i++){const a=start+i/segments*Math.PI/2;points.push([cx+x+Math.cos(a)*radius,cz+z+Math.sin(a)*radius]);}
  return points;
}
export function createXieqiquCourtGardenR1Layout(){
  const beds=[],placements=[];
  for(const side of [-1,1]){
    const word=side<0?'west':'east';
    const add=(label,cx,cz,width,depth,radius)=>{
      const bed={id:word+'-'+label,cx:side*cx,cz,width,depth,radius};
      bed.apron=roundedCourtGardenRing(bed.cx,cz,width+.70,depth+.70,radius+.35);
      bed.outer=roundedCourtGardenRing(bed.cx,cz,width,depth,radius);
      bed.inner=roundedCourtGardenRing(bed.cx,cz,width-.42,depth-.42,radius-.21);
      beds.push(bed);return bed;
    };
    const north=add('north-parterre',21.9,-37.45,12.0,6.5,1.05);
    // Repeated ribbons are deliberate garden rhythm. Every placement retains
    // the complete reviewed botanical source; no substitute tuft geometry.
    for(let row=0;row<4;row++)for(let col=0;col<10;col++){
      const x=north.cx+side*(-4.7+col*1.045),z=-39.70+row*1.50;
      placements.push({id:north.id+'-sedge-'+row+'-'+col,bedId:north.id,species:'sedge',x,z,scale:1.12+(col%3)*.045,yaw:side*(col*.41+row*.37)});
    }
    for(const [i,dx]of [-3.6,-1.2,1.2,3.6].entries())placements.push({
      id:north.id+'-flower-'+i,bedId:north.id,species:'flower-shrub',x:north.cx+side*dx,z:-37.45,scale:1.22+(i%2)*.10,yaw:side*(.22+i*.73),
    });
    const south=add('south-ribbon',20.4,-18.9,10.4,2.3,.70);
    for(let row=0;row<2;row++)for(let col=0;col<9;col++)placements.push({
      id:south.id+'-sedge-'+row+'-'+col,bedId:south.id,species:'sedge',
      x:south.cx+side*(-4.0+col),z:-19.28+row*.76,scale:.94+(col%3)*.035,yaw:side*(col*.47+row*.66),
    });
  }
  const reservations=[
    {id:'north-south-axis',polygon:[[-8,-51],[8,-51],[8,41],[-8,41]]},
    {id:'north-transverse-passage',polygon:[[-34,-30.25],[32,-30.25],[32,-25.75],[-34,-25.75]]},
    {id:'north-stair-foot-space',polygon:[[-26,-16],[26,-16],[26,-8],[-26,-8]]},
    {id:'bridge-north-landing',polygon:[[-51,-4.5],[-44,-4.5],[-44,1],[-51,1]]},
  ];
  for(const side of [-1,1])for(const [x,z]of [[23.4,-23],[8.9,-38],[20,28]])reservations.push({
    id:'existing-urn-'+side+'-'+x+'-'+z,circle:[side*x,z,1.15],
  });
  reservations.push({id:'north-pool-ring',circle:[0,-27,8.30]});
  return freeze({id:xieqiquCourtGardenR1Evidence.id,evidence:xieqiquCourtGardenR1Evidence,beds,placements,reservations,
    levels:{apronTop:.016,soilTop:.112,borderTop:.155,rootBurial:.003},
    sourceLayout:{regions:[{id:xieqiquCourtGardenR1Evidence.id,placements:placements.map(p=>({species:p.species}))}]},
  });
}
