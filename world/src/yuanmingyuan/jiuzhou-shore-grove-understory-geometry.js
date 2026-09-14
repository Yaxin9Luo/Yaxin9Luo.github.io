import * as THREE from 'three';
import {VegetationGeometryBatch,seededGardenRandom} from './vegetation-geometry.js';
import {understoryLaminaGeometry,understoryPose,understoryCurveStemGeometry} from './garden-understory-geometry.js';
const V=(...p)=>new THREE.Vector3(...p),TAU=Math.PI*2;

// Pointed lamina topology and folded cross-section derived from the retained
// garden-understory-geometry.js. New growth controls, no alpha proxy surfaces.
function finish(name, p, indices, colors, uv, data) {
  const g = new THREE.BufferGeometry(); g.name = name;
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); g.userData = data; return g;
}

// One endpoint per tip prevents the zero-area fans produced by a collapsed
// rectangular grid. All interior rows retain curved, continuous lamina normals.
function pointedSurface({ name, rows, columns, sample, colorAt, data }) {
  if (!Number.isInteger(rows) || rows < 4 || !Number.isInteger(columns) || columns < 2 || columns % 2) throw new Error('Understory surfaces need integer rows and an even number of transverse segments.');
  const p = [], colors = [], uv = [], indices = [], rowStarts = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows; rowStarts.push(p.length / 3);
    for (let column = 0; column < (row === 0 || row === rows ? 1 : columns + 1); column++) {
      const u = row === 0 || row === rows ? 0 : column / columns * 2 - 1, point = sample(t, u), c = colorAt(t, u);
      p.push(point.x, point.y, point.z); colors.push(c.r, c.g, c.b); uv.push((u + 1) / 2, t);
    }
  }
  for (let column = 0; column < columns; column++) indices.push(0, rowStarts[1] + column + 1, rowStarts[1] + column);
  for (let row = 1; row < rows - 1; row++) for (let column = 0; column < columns; column++) {
    const a = rowStarts[row] + column, b = rowStarts[row + 1] + column; indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  for (let column = 0; column < columns; column++) indices.push(rowStarts[rows - 1] + column, rowStarts[rows - 1] + column + 1, rowStarts[rows]);
  return finish(name, p, indices, colors, uv, { ...data, rowStarts, rows, columns, rootVertex: 0, tipVertex: rowStarts[rows], opaqueCurvedLamina: true });
}

export function shoreSedgeBladeGeometry({ height = .42, reach = .32, emergence = .32, lift = .58, width = .009, tipY = .07, angle = 0, base = [0, -.006, 0], sway = .024, twist = .25, rows = 44, columns = 8, color = '#748a4b', paleEdge = .15, name = 'understory-sedge-arched-blade' } = {}) {
  if (![height, reach, width].every(v => Number.isFinite(v) && v > 0) || ![tipY, angle, sway, twist, paleEdge, emergence, lift, ...base].every(Number.isFinite)) throw new Error('Invalid understory blade dimensions.');
  const start = V(...base), direction = V(Math.cos(angle), 0, Math.sin(angle)), side = V(-Math.sin(angle), 0, Math.cos(angle));
  const curve = new THREE.CubicBezierCurve3(start, start.clone().add(V(0, height * lift, 0)).addScaledVector(direction, reach * emergence), start.clone().add(V(0, height * 1.18, 0)).addScaledVector(direction, reach * .62).addScaledVector(side, sway), start.clone().add(V(0, tipY, 0)).addScaledVector(direction, reach));
  const baseColor = new THREE.Color(color), cream = new THREE.Color('#b9be84'), dark = new THREE.Color('#475d35');
  return pointedSurface({ name, rows, columns, data: { body: 'shore-r4-early-outward-folded-sedge-leaf', emergence, lift, base: [...base], height, reach, width, tipY, root: [...base], controlPoints: [curve.v0, curve.v1, curve.v2, curve.v3].map(v => v.toArray()), veinCrossSectionSegments: columns },
    sample(t, u) {
      const centre = curve.getPoint(t), tangent = curve.getTangent(t), across = side.clone().applyAxisAngle(tangent, twist * t); across.addScaledVector(tangent, -across.dot(tangent)).normalize();
      const normal = across.clone().cross(tangent).normalize(), profile = Math.sin(Math.PI * t) ** .30 * (1 - .72 * t ** 3), half = width * .5 * profile;
      const fold = width * (.15 * (1 - Math.abs(u)) + .021 * Math.cos(u * Math.PI * 4)) * profile * Math.sin(Math.PI * t);
      return centre.addScaledVector(across, u * half).addScaledVector(normal, fold);
    },
    colorAt(t, u) { return baseColor.clone().lerp(dark, (1 - t) * .12).lerp(cream, paleEdge * Math.abs(u) ** 8 + .055 * (1 - Math.abs(u))).multiplyScalar(.93 + .13 * t); },
  });
}


function tube(batch,curve,radii,segments,radialSegments,color){
 const g=understoryCurveStemGeometry({curve,radii,segments,radialSegments,color});batch.add(g);g.dispose();
}

/** Independently bowed/twisted mature frond, with the original bipinnate
 * topology, exact attached rachises, 28x6 pinnule surfaces and real gaps. */
export function shoreFernFrondGeometry({length,width,arch,sideBend=0,pairs=13,seed,leafColor}){
 const rng=seededGardenRandom(seed),stem=new VegetationGeometryBatch('shore-r4-fern-rachises'),foliage=new VegetationGeometryBatch('shore-r4-fern-pinnules'),attachments=[];
 const points=[V(0,-.008,0),V(sideBend*.12,length*.24,-.006),V(sideBend*.63,length*.72,-arch*.26),V(sideBend,length,-arch)];
 const main=new THREE.CatmullRomCurve3(points,false,'centripetal');
 tube(stem,main,[.0025,.0019,.0010,.00018],42,9,'#738554');
 const leafLength=.032,leafWidth=.013;
 const leaf=understoryLaminaGeometry({length:leafLength,width:leafWidth,curl:.0018,rows:28,columns:6,teeth:6,serration:.10,profile:.56,veinHeight:.00015,cup:.075,color:leafColor,edgeColor:new THREE.Color(leafColor).multiplyScalar(.8),seed});
 let pinnules=0,pinnae=0;
 for(let row=0;row<pairs;row++)for(const side of [-1,1]){
  const t=.19+row/pairs*.75+(side>0?.008:0),anchor=main.getPointAt(t),tangent=main.getTangentAt(t);
  const roll=.20*Math.sin(t*5+seed*.01)+(rng()-.5)*.13;
  const across=tangent.clone().cross(V(0,0,1)).normalize().applyAxisAngle(tangent,roll),normal=across.clone().cross(tangent).normalize();
  const envelope=Math.sin(Math.PI*(.12+row/pairs*.85))**.74*(1-.39*row/pairs);
  const reach=width*.5*envelope*(.85+rng()*.24);
  const tip=anchor.clone().addScaledVector(across,side*reach).addScaledVector(tangent,reach*(.23+rng()*.18)).addScaledVector(normal,-reach*(.10+rng()*.18));
  const middle=anchor.clone().lerp(tip,.48).addScaledVector(normal,reach*.075);
  const pinna=new THREE.CatmullRomCurve3([anchor,middle,tip],false,'centripetal');
  tube(stem,pinna,[.00060*(1-.40*t),.00029,.00008],18,6,'#7b8f55');
  const count=Math.max(3,Math.round(7*envelope)),nodePitch=pinna.getLength()*.78/count,rowPitch=main.getLength()*.75/pairs;
  const pinnaNormal=normal.clone().applyAxisAngle(tangent,(rng()-.5)*.22);
  for(let node=0;node<count;node++)for(const edge of [-1,1]){
   const s=.10+node/count*.78+(edge>0?.012:0),origin=pinna.getPointAt(s),axis=pinna.getTangentAt(s);
   const lateral=pinnaNormal.clone().cross(axis).normalize().multiplyScalar(edge),direction=lateral.multiplyScalar(.86).addScaledVector(axis,.44).normalize();
   const taper=(.72+.28*Math.sin(Math.PI*s))*(.69+.31*envelope),size=.94+rng()*.12;
   const actualLength=Math.min(.037,rowPitch*.91)*taper*size,actualWidth=Math.min(.017,Math.max(.006,nodePitch*1.14))*(.92+rng()*.14);
   const vertexOffset=foliage.positions.length/3,matrix=understoryPose(origin,direction,pinnaNormal,[actualWidth/leafWidth,actualLength/leafLength,actualLength/leafLength]);foliage.add(leaf,matrix,.89+rng()*.19);pinnules++;
   attachments.push({vertexOffset,root:origin.toArray(),matrix:[...matrix.elements],parent:'pinna',row,side,parameter:s,actualLength,actualWidth});
  }
  const origin=pinna.getPointAt(.86),direction=pinna.getPointAt(1).sub(origin).normalize(),tipLength=origin.distanceTo(pinna.getPointAt(1))+.004;
  const vertexOffset=foliage.positions.length/3,matrix=understoryPose(origin,direction,pinnaNormal,[Math.min(.014,nodePitch)/leafWidth,tipLength/leafLength,.55]);foliage.add(leaf,matrix,.95);pinnules++;pinnae++;
  attachments.push({vertexOffset,root:origin.toArray(),matrix:[...matrix.elements],parent:'pinna-tip',row,side});
 }
 const origin=main.getPointAt(.90),terminalLength=origin.distanceTo(main.getPointAt(1))+.006;
 const vertexOffset=foliage.positions.length/3,matrix=understoryPose(origin,main.getPointAt(1).sub(origin),V(0,0,1),[.84,terminalLength/leafLength,.45]);foliage.add(leaf,matrix);pinnules++;
 attachments.push({vertexOffset,root:origin.toArray(),matrix:[...matrix.elements],parent:'main-tip'});leaf.dispose();
 const wood=stem.finish(),lamina=foliage.finish();
 wood.userData={body:'shore-r4-fern-rachises',root:points[0].toArray(),mainControlPoints:points.map(p=>p.toArray())};
 lamina.userData={body:'shore-r4-bipinnate-curved-pinnules',pinnae,pinnules,attachments,rows:28,columns:6};
 return {wood,lamina,data:{root:points[0].toArray(),length,width,arch,sideBend,pinnae,pinnules,seed,young:false}};
}

/** One actual coiled shoot: continuous stem and attached folded emerging
 * pinnules, not a recolored mature frond. Used by only one sparse variant. */
export function shoreFernFiddleheadGeometry({height=.28,radius=.043,seed=482}={}){
 const rng=seededGardenRandom(seed),wood=new VegetationGeometryBatch('shore-r4-fiddlehead-stem'),green=new VegetationGeometryBatch('shore-r4-fiddlehead-pinnules');
 const points=[V(0,-.009,0),V(.006,height*.33,0),V(.003,height*.75,.001),V(0,height,.002)];
 for(let i=1;i<=36;i++){const t=i/36,angle=t*Math.PI*2.3,r=radius*(1-.84*t);points.push(V(-radius+r*Math.cos(angle),height+r*Math.sin(angle),.002+.009*t));}
 const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');
 tube(wood,curve,[.0036,.0032,.0027,.0017],96,10,'#87975b');
 const leaf=understoryLaminaGeometry({length:.018,width:.008,curl:.007,cup:.12,rows:28,columns:6,teeth:5,serration:.08,color:'#829552',edgeColor:'#5e793f',seed});
 const attachments=[];
 for(let i=0;i<14;i++){
  const t=.53+i/14*.43,origin=curve.getPointAt(t),tangent=curve.getTangentAt(t);
  const normal=V(0,0,1),outward=normal.clone().cross(tangent).normalize().multiplyScalar(i%2?1:-1);
  const vertexOffset=green.positions.length/3,matrix=understoryPose(origin,tangent.clone().multiplyScalar(.68).addScaledVector(outward,.32),normal,[.65+rng()*.35,.65+rng()*.40,.65]);
  green.add(leaf,matrix,.94+rng()*.08);attachments.push({vertexOffset,root:origin.toArray(),matrix:[...matrix.elements]});
 }
 leaf.dispose();
 const stem=wood.finish(),lamina=green.finish();lamina.userData={body:'shore-r4-folded-new-pinnules',attachments};
 return {wood:stem,lamina,data:{root:points[0].toArray(),height,radius,turns:1.15,controlPoints:points.map(p=>p.toArray()),young:true}};
}
