import * as THREE from 'three';
import {getBotanicalParts} from './botanical-cache.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {applyEnvironmentWind,attachWindShadows,updateEnvironmentWind} from './environment-wind.js';

const up=new THREE.Vector3(0,1,0);
export function updateGroveWind(seconds,reducedMotion=false){updateEnvironmentWind(seconds,reducedMotion);}
const treeDetail={near:{leafStride:1,branchScale:1,stepScale:1},mid:{leafStride:2,branchScale:.68,stepScale:.65},far:{leafStride:4,branchScale:.45,stepScale:.45}};

function plantRandom(seed){let value=(seed|0)||1;return()=>{value=(Math.imul(value,1664525)+1013904223)|0;return(value>>>0)/4294967296;};}
const axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1);
function atHeight(path,y){let low=0,high=1;for(let i=0;i<16;i++){const t=(low+high)/2;if(path.getPoint(t).y<y)low=t;else high=t;}return path.getPoint((low+high)/2);}
const petalShape=new THREE.Shape();
petalShape.moveTo(0,.02);petalShape.bezierCurveTo(-.18,.10,-.57,.47,-.47,.77);petalShape.bezierCurveTo(-.44,.99,-.20,1.05,0,.96);petalShape.bezierCurveTo(.20,1.05,.44,.99,.47,.77);petalShape.bezierCurveTo(.57,.47,.18,.10,0,.02);
const roundedPetal=petalShape.getPoints(6).slice(0,-1);
const plantColors={
  silver:['#516f5c','#6e8870','#859a7d','#a7b298'],
  pine:['#365f50','#4b7358','#6c895f','#879c70'],
  cherry:['#59765e','#78916f','#b47d99','#ce99b2'],
  lilac:['#59765e','#78916f','#a69abe','#c5b6d0'],
};
const plantMaps=new Map();
function botanicalMaps(bark=false,pine=false){
  const key=bark?'bark':pine?'needle':'leaf';if(plantMaps.has(key))return plantMaps.get(key);
  const width=128,height=256,values=new Float32Array(width*height),color=new Uint8Array(width*height*4),normal=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/(width-1),v=y/(height-1),mid=Math.exp(-Math.pow((u-.5)/.015,2));let relief,tone;
    if(bark){
      const wander=1.1*Math.sin(v*Math.PI*8)+.38*Math.sin(v*Math.PI*19),grain=Math.sin(u*Math.PI*36+wander)*.4+Math.sin(u*Math.PI*62+wander*1.4)*.18;
      const split=Math.pow(Math.max(0,Math.sin(u*Math.PI*46+wander*.9)),11)*(.16+.84*Math.pow(Math.sin(v*Math.PI*7+u*11),2));
      let knot=0;for(const[ku,kv]of[[.22,.28],[.68,.61],[.43,.86]]){const r=Math.hypot((u-ku)/.075,(v-kv)/.066);knot+=Math.sin(r*8)*Math.exp(-r*r*.8);}
      relief=.45+grain*.13-split*.14+knot*.07;tone=.85+grain*.07-split*.075+knot*.04;
    }else{
      let vein=0;for(let row=0;row<7;row++){const path=.09+row*.119+Math.abs(u-.5)*(.63+row*.018);vein=Math.max(vein,Math.exp(-Math.pow((v-path)/.0045,2)));}
      relief=.42+mid*.20+(pine?0:vein*.065);tone=.88+mid*.07+(pine?Math.sin(u*57)*.025:vein*.022)+Math.sin(v*43+u*37)*.012;
    }
    values[y*width+x]=relief;const i=(y*width+x)*4,shade=Math.round(THREE.MathUtils.clamp(tone,0,1)*255);color[i]=shade;color[i+1]=shade;color[i+2]=shade;color[i+3]=255;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const h=(px,py)=>values[THREE.MathUtils.clamp(py,0,height-1)*width+THREE.MathUtils.clamp(px,0,width-1)],n=new THREE.Vector3((h(x-1,y)-h(x+1,y))*(bark?4:2),(h(x,y-1)-h(x,y+1))*(bark?3:2),1).normalize(),i=(y*width+x)*4;
    normal[i]=(n.x*.5+.5)*255;normal[i+1]=(n.y*.5+.5)*255;normal[i+2]=(n.z*.5+.5)*255;normal[i+3]=255;
  }
  const texture=(data,srgb)=>{const map=new THREE.DataTexture(data,width,height);map.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;map.wrapS=map.wrapT=bark?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.anisotropy=8;map.needsUpdate=true;map.name=`Authored ${key} ${srgb?'pigment':'relief'}`;return map;};
  const result={map:texture(color,true),normalMap:texture(normal,false)};plantMaps.set(key,result);return result;
}
function plantMaterial(name,bark=false,pine=false){
  const m=new THREE.MeshStandardMaterial({name,color:'#ffffff',vertexColors:true,...botanicalMaps(bark,pine),normalScale:new THREE.Vector2(bark?.55:.18,bark?.55:.18),roughness:bark?.94:.78,metalness:0,side:bark?THREE.FrontSide:THREE.DoubleSide});
  if(!bark){
    applyEnvironmentWind(m);
    const windCompile=m.onBeforeCompile,windKey=m.customProgramCacheKey();
    m.onBeforeCompile=shader=>{
      windCompile(shader);
      shader.vertexShader='varying vec3 crownPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncrownPosition=position;');
      shader.fragmentShader='varying vec3 crownPosition;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
        // Enclosed lower boughs receive less diffuse sky; the outer crown
        // retains its petal pigment and direct-light response.
        float crownInterior=(1.-smoothstep(.8,3.4,length(crownPosition.xz)))*smoothstep(1.5,3.,crownPosition.y)*(1.-smoothstep(4.,7.5,crownPosition.y));
        reflectedLight.indirectDiffuse*=1.-crownInterior*.22;
        #if NUM_DIR_LIGHTS > 0
          float transmitted=max(0.,dot(-normal,directionalLights[0].direction));
          reflectedLight.directDiffuse+=directionalLights[0].color*diffuseColor.rgb*transmitted*.055;
        #endif`);
    };
    m.customProgramCacheKey=()=>`${windKey}-botanical-diffuse-v5`;
  }
  return m;
}
class PlantBuilder {
  constructor(kind,seed,detail='near'){this.detail=treeDetail[detail]||treeDetail.near;this.detailName=detail;this.kind=kind;this.rand=plantRandom(seed);this.wood=[];this.positions=[];this.colors=[];this.uv=[];this.leafCount=0;this.twigCount=0;this.flowerCount=0;this.palette=plantColors[kind].map(c=>new THREE.Color(c));}
  triangle(a,b,c,colors,uvs){for(const[i,p]of[a,b,c].entries()){this.positions.push(p.x,p.y,p.z);const tint=colors[i];this.colors.push(tint.r,tint.g,tint.b);this.uv.push(...uvs[i]);}}
  leaf(base,direction,length,width,tint=null,roll=0){
    const forward=direction.clone().normalize(),side=new THREE.Vector3().crossVectors(forward,Math.abs(forward.y)>.94?axisX:up).normalize();
    side.applyAxisAngle(forward,roll);const normal=new THREE.Vector3().crossVectors(side,forward).normalize();
    const p=(x,y,z)=>base.clone().addScaledVector(side,x*width).addScaledVector(normal,y*length).addScaledVector(forward,z*length);
    const outline=[[0,0,0],[-.19,-.005,.10],[-.33,-.011,.20],[-.44,-.020,.35],[-.50,-.032,.48],[-.47,-.045,.61],[-.39,-.057,.74],[-.25,-.075,.88],[0,-.10,1],[.25,-.075,.88],[.39,-.057,.74],[.47,-.045,.61],[.50,-.032,.48],[.44,-.020,.35],[.33,-.011,.20],[.19,-.005,.10]],selectedOutline=this.detailName==='far'?(this.kind==='cherry'||this.kind==='lilac'?[0,2,4,6,8,10,12,14]:[0,3,5,8,11,13]).map(i=>outline[i]):outline.filter((_,i)=>i%this.detail.leafStride===0),ring=selectedOutline.map(v=>p(...v)),middle=p(0,.026,.48);
    const color=tint||this.palette[Math.floor(this.rand()*(this.kind==='cherry'||this.kind==='lilac'?2:this.palette.length))];
    const edge=color.clone().multiplyScalar(.96),ridge=color.clone().multiplyScalar(1.025);
    for(let i=0;i<selectedOutline.length;i++){const next=(i+1)%selectedOutline.length;this.triangle(middle,ring[i],ring[next],[ridge,edge,edge],[[.5,.48],[selectedOutline[i][0]+.5,selectedOutline[i][2]],[selectedOutline[next][0]+.5,selectedOutline[next][2]]]);}
    this.leafCount++;
  }
  needle(base,direction,length,width,roll=0){
    const forward=direction.clone().normalize(),side=new THREE.Vector3().crossVectors(forward,Math.abs(forward.y)>.93?axisX:up).normalize().applyAxisAngle(forward,roll),normal=new THREE.Vector3().crossVectors(side,forward).normalize(),p=(x,y,z)=>base.clone().addScaledVector(side,x*width).addScaledVector(normal,y*width).addScaledVector(forward,z*length);
    const points=[p(0,0,0),p(-.5,0,.38),p(0,-.25,1),p(.5,0,.38)],center=p(0,.13,.42),c=this.palette[Math.floor(this.rand()*4)];
    if(this.detailName==='near')for(let i=0;i<4;i++)this.triangle(center,points[i],points[(i+1)%4],[c,c,c],[[.5,.42],[i<2?0:1,i/4],[i<1?0:1,(i+1)/4]]);
    else {
      this.triangle(points[0],points[1],points[2],[c,c,c],[[.5,0],[0,.38],[.5,1]]);
      this.triangle(points[0],points[2],points[3],[c,c,c],[[.5,0],[.5,1],[1,.38]]);
    }
    this.leafCount++;
  }
  bloom(center,radius,detailed=false){
    const angle=this.rand()*Math.PI*2,tilt=.18+this.rand()*.82,radial=Math.sqrt(1-tilt*tilt),normal=new THREE.Vector3(Math.cos(angle)*radial,tilt,Math.sin(angle)*radial),side=new THREE.Vector3().crossVectors(normal,axisZ).normalize(),tangent=new THREE.Vector3().crossVectors(side,normal).normalize();
    for(let petal=0;petal<5;petal++){
      const a=angle+petal*Math.PI*2/5,forward=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(tangent,Math.sin(a)),across=new THREE.Vector3().crossVectors(normal,forward).normalize(),p=(x,y,z)=>center.clone().addScaledVector(forward,z*radius).addScaledVector(across,x*radius).addScaledVector(normal,y*radius);
      const tint=this.palette[2].clone().lerp(this.palette[3],this.rand());
      if(detailed){
        const middle=p(0,.08,.5),surface=(v,f)=>{const x=v.x*f,z=.5+(v.y-.5)*f;return p(x,.025+z*z*.19+Math.pow(Math.abs(x),1.4)*.12,z);},inner=roundedPetal.map(v=>surface(v,.5)),outer=roundedPetal.map(v=>surface(v,1)),iv=roundedPetal.map(v=>[.5+v.x*.5,.5+(v.y-.5)*.5]),ov=roundedPetal.map(v=>[.5+v.x,v.y]),edge=tint.clone().lerp(new THREE.Color('#eed2d4'),.13);
        for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length;this.triangle(middle,inner[i],inner[j],[tint,tint,tint],[[.5,.5],iv[i],iv[j]]);this.triangle(inner[i],outer[i],outer[j],[tint,edge,edge],[iv[i],ov[i],ov[j]]);this.triangle(inner[i],outer[j],inner[j],[tint,edge,tint],[iv[i],ov[j],iv[j]]);}
      }else{
        const outline=[[0,0,.03],[-.38,.04,.38],[-.47,.13,.76],[-.26,.20,1],[0,.18,.95],[.26,.20,1],[.47,.13,.76],[.38,.04,.38]],ring=outline.map(v=>p(...v)),middle=p(0,.09,.52);
        if(this.detailName==='near')for(let i=0;i<8;i++){const j=(i+1)%8;this.triangle(middle,ring[i],ring[j],[tint,tint,tint],[[.5,.5],[outline[i][0]+.5,outline[i][2]],[outline[j][0]+.5,outline[j][2]]]);}
        else for(let i=1;i<7;i++)this.triangle(ring[0],ring[i],ring[i+1],[tint,tint,tint],[[.5,.03],[outline[i][0]+.5,outline[i][2]],[outline[i+1][0]+.5,outline[i+1][2]]]);
      }
    }
    const gold=new THREE.Color('#d9b974'),tip=center.clone().addScaledVector(normal,radius*.20);
    if(detailed){
      const core=new THREE.SphereGeometry(radius*.15,12,6);core.translate(...center.clone().addScaledVector(normal,radius*.11).toArray());
      const p=core.attributes.position,uv=core.attributes.uv,index=core.index;
      for(let i=0;i<index.count;i+=3){const v=[index.getX(i),index.getX(i+1),index.getX(i+2)];this.triangle(...v.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),[gold,gold,gold],v.map(j=>[uv.getX(j),uv.getY(j)]));}core.dispose();
      for(let i=0;i<8;i++){const a=i*Math.PI/4,radial=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(tangent,Math.sin(a)),base=center.clone().addScaledVector(radial,radius*.13),tip=base.clone().addScaledVector(normal,radius*(.22+(i%2)*.05)).addScaledVector(radial,radius*.07),w=radius*.012;
        for(const axis of[side,tangent]){const first=base.clone().addScaledVector(axis,w),second=base.clone().addScaledVector(axis,-w),end=tip.clone().addScaledVector(axis,w),other=tip.clone().addScaledVector(axis,-w);this.triangle(first,second,end,[gold,gold,gold],[[0,0],[1,0],[0,1]]);this.triangle(second,other,end,[gold,gold,gold],[[1,0],[1,1],[0,1]]);}
      }
    }else for(let i=0;i<6;i++){const a=i*Math.PI/3,b=(i+1)*Math.PI/3,first=center.clone().addScaledVector(side,Math.cos(a)*radius*.17).addScaledVector(tangent,Math.sin(a)*radius*.17),second=center.clone().addScaledVector(side,Math.cos(b)*radius*.17).addScaledVector(tangent,Math.sin(b)*radius*.17);this.triangle(tip,first,second,[gold,gold,gold],[[.5,.5],[0,0],[1,0]]);}
    this.flowerCount++;
  }
  branch(points,radius,tip,segments=6){
    const trunk=radius>.25,path=new THREE.CatmullRomCurve3(points),sourceSteps=radius<.04?2:Math.max(2,(points.length-1)*(trunk?8:radius>.10?4:3)),steps=this.detailName==='near'?sourceSteps:Math.max(2,Math.ceil(sourceSteps*this.detail.stepScale)),p=[],uv=[],c=[],indices=[];
    if(this.detailName!=='near')segments=Math.max(trunk?12:4,Math.ceil(segments*this.detail.branchScale));
    const barkLight=new THREE.Color(this.herbaceous?'#809970':'#999681'),barkDark=new THREE.Color(this.herbaceous?'#4f7050':'#5d6154');
    for(let row=0;row<=steps;row++){
      const t=trunk?Math.pow(row/steps,1.4):row/steps,center=path.getPoint(t),tangent=path.getTangent(t).normalize(),side=new THREE.Vector3().crossVectors(tangent,Math.abs(tangent.y)>.95?axisX:up).normalize(),normal=new THREE.Vector3().crossVectors(tangent,side).normalize();
      const collar=trunk?Math.exp(-Math.max(0,center.y)*4):0,r=THREE.MathUtils.lerp(radius,tip,t)+(trunk?radius*.35*collar:radius>.04?radius*.17*Math.exp(-t*9):0);
      for(let i=0;i<=segments;i++){
        const a=i/segments*Math.PI*2,rootRidge=Math.pow(Math.max(0,Math.cos(a*5+.3+.15*Math.sin(a*3))),4)*(1+.1*Math.sin(a*2+.5)),ridge=1+Math.sin(a*3+t*4+.4)*.04+Math.cos(t*13+a*5)*.025+radius*1.7/r*rootRidge*collar,q=center.clone().addScaledVector(side,Math.cos(a)*r*ridge).addScaledVector(normal,Math.sin(a)*r*ridge);
        p.push(q.x,q.y,q.z);uv.push(i/segments,t*4);const shade=.48+.12*Math.sin(a*3+t*4+.6)+.06*Math.sin(t*27+a*5);const color=barkDark.clone().lerp(barkLight,shade);c.push(color.r,color.g,color.b);
        if(row<steps&&i<segments){const n=row*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(indices);g.computeVertexNormals();this.wood.push(g.toNonIndexed());g.dispose();this.twigCount++;return path;
  }
  spray(start,direction,length,leafScale=1){
    const flower=this.kind==='cherry'||this.kind==='lilac';
    const forward=direction.clone().normalize(),side=new THREE.Vector3().crossVectors(forward,Math.abs(forward.y)>.92?axisX:up).normalize(),end=start.clone().addScaledVector(forward,length),middle=start.clone().lerp(end,.5).addScaledVector(up,.07*length);
    const twig=this.branch([start,middle,end],.014*leafScale,.003*leafScale,4);
    for(let i=0;i<(flower?4:7);i++){
      const t=flower?.10+i*.24:.07+i*.136;
      for(const sign of[-1,1]){
        const base=twig.getPoint(t),out=forward.clone().multiplyScalar(.30+(i/7)*.3).addScaledVector(side,sign*(.78-this.rand()*.15)).addScaledVector(up,.10+(this.rand()-.5)*.4).normalize();
        this.leaf(base,out,(.27+this.rand()*.09)*leafScale,(.11+this.rand()*.035)*leafScale,null,(this.rand()-.5)*.85);
        if(flower){
          const flowerBase=base.clone().addScaledVector(out,.17*leafScale);
          this.bloom(flowerBase,(.13+this.rand()*.025)*leafScale);
          if(i%2===0)this.bloom(flowerBase.clone().addScaledVector(up,.075).addScaledVector(side,sign*.11),.105*leafScale);
        }
      }
    }
    this.leaf(end.clone().addScaledVector(forward,-.07),forward,.31*leafScale,.12*leafScale);
    if(flower)for(let i=0;i<5;i++){const a=i*Math.PI*2/5;this.bloom(end.clone().addScaledVector(side,Math.cos(a)*.16*leafScale).addScaledVector(up,.07+Math.sin(a)*.12),.12*leafScale);}
  }
  coniferSpray(start,direction,length,scale=1){
    const forward=direction.clone().normalize(),side=new THREE.Vector3().crossVectors(forward,up).normalize(),end=start.clone().addScaledVector(forward,length),twig=this.branch([start,start.clone().lerp(end,.55).addScaledVector(up,.04),end],.015*scale,.003,4);
    for(let row=0;row<12;row++)for(const sign of[-1,1])for(let fan=0;fan<3;fan++){
      const t=.04+row*.079,base=twig.getPoint(t),direction=forward.clone().multiplyScalar(.24+fan*.23).addScaledVector(side,sign*(.7-fan*.16)).addScaledVector(up,(fan-1)*.55+.12).normalize();
      this.needle(base,direction,(.26+this.rand()*.13)*(1-t*.34)*scale,(.056+this.rand()*.024)*scale,(this.rand()-.5)*1.1);
    }
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;this.needle(end,forward.clone().addScaledVector(side,Math.cos(a)*.45).addScaledVector(up,Math.sin(a)*.45),.24*scale,.05*scale,a);}
  }
  finish(name){
    const rawWood=mergeGeometries(this.wood),wood=mergeVertices(rawWood,1e-5);rawWood.dispose();let foliage=new THREE.BufferGeometry();
    foliage.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));foliage.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));foliage.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
    const smooth=mergeVertices(foliage,1e-5);smooth.computeVertexNormals();foliage.dispose();foliage=smooth;
    this.wood.forEach(g=>g.dispose());const group=new THREE.Group();group.name=name;
    const branchMesh=new THREE.Mesh(wood,plantMaterial('Ridged silver bark and tapered twigs',true)),leafMesh=new THREE.Mesh(foliage,plantMaterial(`Detailed ${this.kind} foliage with authored vein relief`,false,this.kind==='pine'));
    branchMesh.name='Curved trunk, branches and fine leaf-bearing twigs';leafMesh.name='Overlapping botanical leaf sprays';attachWindShadows(leafMesh);
    for(const mesh of[branchMesh,leafMesh]){mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
    group.branchesMesh=branchMesh;group.leavesMesh=leafMesh;group.userData.botanicalDetail={leaves:this.leafCount,branches:this.twigCount,flowers:this.flowerCount};group.userData.detailLevel=this.detailName;return group;
  }
}
function createBroadleafTree(kind,seed,detail){
  const b=new PlantBuilder(kind,seed,detail),rand=b.rand,flower=kind==='cherry'||kind==='lilac';
  if(flower)return createFloweringTree(b,kind,seed);
  const trunk=[new THREE.Vector3(0,-.04,0),new THREE.Vector3(.10,1.7,.04),new THREE.Vector3(-.04,3.2,.07),new THREE.Vector3(.21,4.9,-.06),new THREE.Vector3(-.08,6.45,.08),new THREE.Vector3(.13,8.1,.04)];
  const stem=b.branch(trunk,.28,.024,30);
  for(let i=0;i<11;i++){
    const t=i/10,a=i*2.399+seed*.07,start=atHeight(stem,2.7+t*3.75),radius=2.0-Math.pow(t,2)*.8,center=new THREE.Vector3(Math.cos(a)*radius,4.7+t*3.2,Math.sin(a)*radius),bend=start.clone().lerp(center,.50).add(new THREE.Vector3(0,.20,0));
    const bough=b.branch([start,bend,center],.105-t*.05,.017,10);
    for(let fan=0;fan<4;fan++){
      const angle=a+(fan-1.5)*.51,origin=bough.getPoint(.34+(fan%3)*.14),end=center.clone().add(new THREE.Vector3(Math.cos(angle)*(.40+rand()*.25),.10+(fan%2)*.22,Math.sin(angle)*(.40+rand()*.25)));
      const branch=b.branch([origin,origin.clone().lerp(end,.5).addScaledVector(up,.08),end],.026,.008,5);
      for(let shoot=0;shoot<(flower?4:6);shoot++){
        const u=.10+shoot*(flower?.23:.155),root=branch.getPoint(u),az=angle+(shoot%2?-1:1)*(.55+rand()*.48),direction=new THREE.Vector3(Math.cos(az),.22+rand()*.62,Math.sin(az));
        b.spray(root,direction,.68+rand()*.36,.88+rand()*.26);
      }
    }
  }
  for(let i=0;i<7;i++){const a=i*2.39,start=atHeight(stem,7.1+i*.11);b.spray(start,new THREE.Vector3(Math.cos(a)*.7,.9,Math.sin(a)*.7),.6+rand()*.35,.85);}
  return b.finish(`Detailed ${kind} grove tree`);
}

function createFloweringTree(b,kind,seed){
  const rand=b.rand,lean=kind==='cherry'?1:-1;
  const stem=b.branch([new THREE.Vector3(0,-.04,0),new THREE.Vector3(.20*lean,1.4,-.12),new THREE.Vector3(-.28*lean,2.9,.12),new THREE.Vector3(.26*lean,4.7,.06),new THREE.Vector3(.65*lean,6.7,-.19)],.43,.037,36);
  // Wide, irregular boughs give the blossoms a mature silhouette and a readable trunk.
  for(let i=0;i<14;i++){
    const t=i/13,a=i*2.399+seed*.17,start=atHeight(stem,2.1+t*3.1),radius=3.35-Math.pow(t,2)*1.40+(rand()-.5)*.55;
    const end=new THREE.Vector3(Math.cos(a)*radius,4.3+t*2.2+(rand()-.5)*.5,Math.sin(a)*radius);
    const bough=b.branch([start,start.clone().lerp(end,.38).addScaledVector(up,-.36),end.clone().addScaledVector(up,-.22),end],.16-t*.073,.025,14);
    for(let fan=0;fan<5;fan++){
      const angle=a+(fan-2)*.44,origin=bough.getPoint(.33+(fan%3)*.18),tip=end.clone().add(new THREE.Vector3(Math.cos(angle)*(.50+rand()*.35),.23+(fan%2)*.27,Math.sin(angle)*(.50+rand()*.35)));
      const twig=b.branch([origin,origin.clone().lerp(tip,.52).addScaledVector(up,.16),tip],.043,.009,8);
      for(let shoot=0;shoot<5;shoot++){
        const root=twig.getPoint(.10+shoot*.20),az=angle+(shoot%2?-1:1)*(.6+rand()*.6);
        b.spray(root,new THREE.Vector3(Math.cos(az),.28+rand()*.48,Math.sin(az)),.75+rand()*.37,.94+rand()*.27);
      }
    }
  }
  for(let i=0;i<9;i++){const a=i*2.39,start=atHeight(stem,5.75+i*.095);b.spray(start,new THREE.Vector3(Math.cos(a)*.9,.9,Math.sin(a)*.9),.9,1.1);}
  return b.finish(`Mature ${kind} tree — arched boughs and five-petal blossom clusters`);
}
const cachedPlantSurfaces=new Map();
function createCachedGroveTree(kind,detail,parts){
  if(!cachedPlantSurfaces.has(kind)){
    const materials=[plantMaterial('Ridged silver bark and tapered twigs',true),plantMaterial(`Detailed ${kind} foliage with authored vein relief`,false,kind==='pine')];
    for(const material of materials){material.userData.sharedAsset=true;for(const value of Object.values(material))if(value?.isTexture)value.userData.sharedAsset=true;}
    cachedPlantSurfaces.set(kind,materials);
  }
  const [bark,foliage]=cachedPlantSurfaces.get(kind),group=new THREE.Group();group.name=parts.name||`Detailed ${kind} grove tree`;
  const branchMesh=new THREE.Mesh(parts.branches,bark),leafMesh=new THREE.Mesh(parts.leaves,foliage);
  branchMesh.name='Curved trunk, branches and fine leaf-bearing twigs';leafMesh.name='Overlapping botanical leaf sprays';attachWindShadows(leafMesh);
  for(const mesh of[branchMesh,leafMesh]){mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  group.branchesMesh=branchMesh;group.leavesMesh=leafMesh;group.userData.botanicalDetail={...parts.botanicalDetail};group.userData.detailLevel=detail;return group;
}
export function createGroveTreeSource(kind='silver',seed=0,detail='near'){return kind==='pine'?createPineTree(seed,detail):createBroadleafTree(kind,seed,detail);}
export function createGroveTree(kind='silver',seed=0,detail='near'){
  const parts=getBotanicalParts(kind,seed,detail);return parts?createCachedGroveTree(kind,detail,parts):createGroveTreeSource(kind,seed,detail);
}

function createPineTree(seed,detail){
  const b=new PlantBuilder('pine',seed,detail),rand=b.rand;
  const stem=b.branch([new THREE.Vector3(0,-.04,0),new THREE.Vector3(.09,3,.04),new THREE.Vector3(-.06,6.4,.10),new THREE.Vector3(.10,9.45,0)],.29,.015,30);
  for(let tier=0;tier<7;tier++)for(let spoke=0;spoke<5;spoke++){
    const a=spoke*Math.PI*2/5+tier*.71+seed*.09,y=2.15+tier*.98+(rand()-.5)*.25,radius=2.40-tier*.275,start=atHeight(stem,y+.32),end=new THREE.Vector3(Math.cos(a)*radius,y+.16,Math.sin(a)*radius),bend=start.clone().lerp(end,.55).addScaledVector(up,-.16);
    const bough=b.branch([start,bend,end],.075-tier*.006,.009,10);
    for(let fan=0;fan<6;fan++){
      const t=.11+fan*.16,root=bough.getPoint(t),angle=a+(fan%2?-1:1)*(.43+rand()*.25),dir=new THREE.Vector3(Math.cos(angle),-.10+(fan%3)*.25+rand()*.13,Math.sin(angle));
      b.coniferSpray(root,dir,(.86-tier*.058)*(1+rand()*.13),.91-tier*.041);
    }
  }
  for(let i=0;i<10;i++){const a=i*2.4;b.coniferSpray(atHeight(stem,8.35+i*.08),new THREE.Vector3(Math.cos(a)*.44,1,Math.sin(a)*.44),.58,.64);}
  return b.finish('Detailed layered silver pine');
}

export function createGroveShrub(kind='silver',seed=24){
  const b=new PlantBuilder(kind,seed);
  for(let i=0;i<12;i++){
    const a=i*2.4,root=new THREE.Vector3(Math.cos(a)*.13,0,Math.sin(a)*.13),end=new THREE.Vector3(Math.cos(a)*.38,.40+(i%3)*.12,Math.sin(a)*.38),stem=b.branch([root,root.clone().lerp(end,.5).addScaledVector(up,.09),end],.022,.006,5);
    for(let node=0;node<3;node++){const side=node%2?-1:1;b.spray(stem.getPoint(.17+node*.34),new THREE.Vector3(Math.cos(a+side*.6)*.8,.54,Math.sin(a+side*.6)*.8),.30,.57);}
  }
  return b.finish('Fine-leaved garden shrub');
}

export function createGardenFlower(kind='cherry',seed=0){
  const b=new PlantBuilder(kind,seed);b.herbaceous=true;
  for(let i=0;i<3;i++){
    const a=i*2.4+seed,root=new THREE.Vector3(Math.cos(a)*.045,0,Math.sin(a)*.045),tip=new THREE.Vector3(Math.cos(a)*.12,.26+i*.095,Math.sin(a)*.12);b.branch([root,root.clone().lerp(tip,.55),tip],.008,.004,4);
    b.leaf(root.clone().lerp(tip,.36),new THREE.Vector3(Math.cos(a+1),.3,Math.sin(a+1)),.15,.066);b.leaf(root.clone().lerp(tip,.62),new THREE.Vector3(Math.cos(a-1),.3,Math.sin(a-1)),.13,.061);
    const lateral=tip.clone().add(new THREE.Vector3(Math.cos(a)*.10,-.07,Math.sin(a)*.10)),joint=root.clone().lerp(tip,.62);
    b.branch([joint,joint.clone().lerp(lateral,.5).addScaledVector(up,.01),lateral],.0045,.0025,6);
    b.bloom(tip,.09,true);b.bloom(lateral,.069,true);
  }
  return b.finish('Botanical flower spray with petals and stamens');
}
