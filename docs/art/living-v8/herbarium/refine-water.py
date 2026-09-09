from pathlib import Path
p=Path('world/src/herbarium-assets.js');s=p.read_text();a=s.index('function lily(');b=s.index('function bench(',a)
s=s[:a]+'''function prepareLilyMaterials(){
  const m=getHerbariumMaterials();if(m.lily)return;const size=1024,pigment=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),relief=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=(x/size-.5)*2,v=(y/size-.5)*2,r=Math.hypot(u,v),a=Math.atan2(v,u),primary=Math.exp(-((Math.sin(a*8+.14*Math.sin(r*8+a*2))*r/.018)**2)),secondary=Math.exp(-((Math.sin(a*24+r*24+.35*Math.sin(a*8))*r/.026)**2))*.35,noise=Math.sin(x*.17+y*.27)*Math.sin(x*.63-y*.13),tone=.89+.065*Math.sin(a*3+r*11)+.035*noise+.04*primary+.025*secondary,i=(y*size+x)*4;relief[y*size+x]=primary*.08+secondary*.018+noise*.0015;pigment[i]=75*tone;pigment[i+1]=108*tone;pigment[i+2]=57*tone;pigment[i+3]=255;}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const h=(xx,yy)=>relief[Math.max(0,Math.min(size-1,yy))*size+Math.max(0,Math.min(size-1,xx))],n=V((h(x-1,y)-h(x+1,y))*1.5,(h(x,y-1)-h(x,y+1))*1.5,1).normalize(),i=(y*size+x)*4;normal[i]=(n.x*.5+.5)*255;normal[i+1]=(n.y*.5+.5)*255;normal[i+2]=(n.z*.5+.5)*255;normal[i+3]=255;}
  const texture=(data,srgb)=>{const t=new THREE.DataTexture(data,size,size);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=8;t.needsUpdate=true;t.name=`Original waterlily ${srgb?'pigment':'branching vein relief'} 1024`;t.userData.sharedAsset=true;return t;};
  m.lily=new THREE.MeshPhysicalMaterial({name:'Herbarium living waterlily lamina',map:texture(pigment,true),normalMap:texture(normal,false),normalScale:new THREE.Vector2(.40,.40),roughness:.40,clearcoat:.24,clearcoatRoughness:.28,side:THREE.DoubleSide,vertexColors:true,userData:{sharedAsset:true}});
  m.lilyPink=material('waterlily rose petals','#deb5c2',{roughness:.52,side:THREE.DoubleSide,vertexColors:true});m.lilyIvory=material('waterlily ivory petals','#f0ead9',{roughness:.55,side:THREE.DoubleSide,vertexColors:true});m.lilyPollen=material('waterlily golden anthers','#d8b74e',{roughness:.63});
}
function lilyPetal(b,center,angle,length,width,rise,key,seed){
  const rows=16,columns=6,p=[],uv=[],colors=[],index=[],c=Math.cos(angle),s=Math.sin(angle);
  for(let j=0;j<=rows;j++){const t=j/rows,span=Math.sin(Math.PI*t)**.84*width;for(let k=0;k<=columns;k++){const side=k/columns*2-1,along=length*t,across=span*side,y=rise*(t*t*.92+.28*Math.sin(t*Math.PI))-.018*Math.sin(t*Math.PI)*side*side;p.push(center.x+c*along-s*across,center.y+y,center.z+s*along+c*across);uv.push(k/columns,t);const tone=.80+.20*t+.025*Math.sin(seed*1.3+j*.24);colors.push(tone,tone,tone);} }
  for(let j=0;j<rows;j++)for(let k=0;k<columns;k++){const a=j*(columns+1)+k;index.push(a,a+columns+1,a+1,a+1,a+columns+1,a+columns+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();b.add(g,key,'Curved waterlily petal',V(),null,{keepUV:true,role:'plant',attachedTo:'waterlily receptacle'});g.dispose();
}
function lily(b,x,z,r,seed){
  prepareLilyMaterials();const rand=rng(seed),p=[],uv=[],colors=[],index=[],padY=.184+(seed%7)*.001,n=112,rings=18,stride=n+1;
  // Two very thin, gently cupped surfaces share an organic notched perimeter; no coarse flat triangle fan or raised straight spokes.
  for(let side=0;side<2;side++)for(let j=0;j<=rings;j++){const t=j/rings;for(let i=0;i<=n;i++){const notch=.06+.10*t*t,a=notch+(Math.PI*2-notch*2)*i/n,rr=r*t*(1+.024*Math.sin(a*5+seed)+.012*Math.sin(a*11)),y=padY+.006*t*t+.0028*Math.sin(a*3+seed)*t+.002*Math.sin(a*7)*t*t-side*.002;p.push(x+rr*Math.cos(a),y,z+rr*Math.sin(a));uv.push(.5+rr*Math.cos(a)/(2*r*1.04),.5+rr*Math.sin(a)/(2*r*1.04));const tone=.94+(seed%5)*.022-.07*side;colors.push(tone,tone,tone);}}
  const layer=(rings+1)*stride;for(let side=0;side<2;side++)for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=side*layer+j*stride+i,tri=[a,a+stride,a+1,a+1,a+stride,a+stride+1];index.push(...(side?tri.reverse():tri));}
  for(let i=0;i<n;i++){const a=rings*stride+i,c=layer+a;index.push(a,a+1,c,a+1,c+1,c);}
  for(const edge of[0,n])for(let j=0;j<rings;j++){const a=j*stride+edge,c=layer+a;index.push(a,c,a+stride,c,c+stride,a+stride);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();b.add(g,'lily','Smooth notched floating waterlily lamina',V(),null,{keepUV:true,role:'plant',attachedTo:'water rooted rhizome'});g.dispose();
  b.tube('submerged','Lily submerged petiole',[V(x-.12,-.31,z+.06),V(x-.06,-.12,z+.03),V(x,padY,z)],.006,{role:'plant'});
  if(seed%4===0){const top=V(x+r*.16,.246,z-r*.16);b.tube('submerged','Waterlily blossom stalk',[V(top.x,-.28,top.z),top],.008,{role:'plant'});
    for(let layer=0;layer<3;layer++){const count=14-layer*3;for(let j=0;j<count;j++){const angle=j/count*Math.PI*2+layer*.37+rand()*.025;lilyPetal(b,top.clone().add(V(0,layer*.006,0)),angle,r*(.63-layer*.11),r*(.125-layer*.018),r*(.12+layer*.12),seed%8?'lilyPink':'lilyIvory',seed+j);}}
    b.sphere('lilyPollen','Small waterlily receptacle',top.clone().add(V(0,.015,0)),[r*.075,.010,r*.075]);
    for(let j=0;j<38;j++){const a=j*2.399,d=r*.08*Math.sqrt(j/38),base=top.clone().add(V(Math.cos(a)*d,.012,Math.sin(a)*d)),tip=base.clone().add(V(Math.cos(a)*.006,.020+rand()*.026,Math.sin(a)*.006));b.tube('lilyPollen','Fine waterlily stamen',[base,base.clone().lerp(tip,.5).add(V(Math.cos(a)*.003,0,Math.sin(a)*.003)),tip],.0015,{role:'plant'});b.sphere('lilyPollen','Rounded waterlily anther',tip,[.0026,.006,.0026]);}
  }
}
''' +s[b:]
s=s.replace("['leaf','lime','sage','submerged'].includes(bucket.key)","['leaf','lime','sage','lily','submerged'].includes(bucket.key)")
p.write_text(s)
p=Path('world/src/herbarium-studio.js');s=p.read_text().replace('THREE.PCFSoftShadowMap','THREE.PCFShadowMap');s=s.replace("function setLight(mode)",'''function setWaterOptics(mode){const m=getHerbariumMaterials().water,refraction=mode==='refraction';Object.assign(m,{transmission:refraction?.965:0,thickness:refraction?.48:0,transparent:!refraction,opacity:refraction?1:.88,depthWrite:refraction,metalness:refraction?0:.035,roughness:refraction?.045:.075});m.color.set(refraction?'#e0eeea':'#426558');m.needsUpdate=true;el('water-optics').value=mode;}
function setLight(mode)''')
s=s.replace("el('specimen-controls').hidden=!group.userData.botanicalSource;", "el('specimen-controls').hidden=!group.userData.botanicalSource;el('water-controls').hidden=kind!=='water';")
s=s.replace("candidate:query.get('candidate')||null,assetVersion:","candidate:query.get('candidate')||null,waterOptics:kind==='water'?el('water-optics').value:null,assetVersion:")
s=s.replace("el('light').onchange=", "el('water-optics').onchange=()=>setWaterOptics(el('water-optics').value);el('light').onchange=")
s=s.replace("resize();setLight(light);", "resize();setLight(light);setWaterOptics(query.get('water-optics')||'surface');")
p.write_text(s)
p=Path('world/herbarium-studio.html');s=p.read_text().replace('<label>View</label>', '<div id="water-controls" hidden><label for="water-optics">Pond optics comparison</label><select id="water-optics"><option value="surface">Reflective surface blend</option><option value="refraction">R4 screen refraction</option></select></div><label>View</label>');p.write_text(s)
