import * as THREE from 'three';

const TAU=Math.PI*2;
const tuftSeeds=[72631,185057,390241];

/** Complete, independently seeded tufts; no landscape RNG is consumed here. */
export function createGrassTuftVariants(){return tuftSeeds.map(createGrassTuftGeometry);}

export function createGrassTuftGeometry(seed=tuftSeeds[0]){
  let state=seed;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};
  const positions=[],colors=[],uv=[],indices=[],rootIndices=[],blades=[];
  const dark=new THREE.Color('#53785b'),light=new THREE.Color('#b1c795'),color=new THREE.Color();
  const fan=rand()*TAU,spread=.72+rand()*.28,clusterAspect=.72+rand()*.35;
  const tangent=new THREE.Vector3(),across=new THREE.Vector3(),foldNormal=new THREE.Vector3();
  for(let blade=0;blade<32;blade++){
    const angle=fan+(rand()-.5)*TAU*spread,clusterAngle=rand()*TAU,radius=Math.sqrt(rand())*.0115;
    const lobe=fan+(blade%3)*TAU/3,bx=Math.cos(lobe)*.003+Math.cos(clusterAngle)*radius,bz=Math.sin(lobe)*.003+Math.sin(clusterAngle)*radius*clusterAspect;
    const height=.18+rand()*.35,width=.006+rand()*.008,lean=.12+rand()*.20,sideBend=(rand()-.5)*.042,twist=(rand()-.5)*.68,fold=.001+rand()*.001;
    const dx=Math.cos(angle),dz=Math.sin(angle),start=positions.length/3;
    for(let row=0;row<9;row++){
      const t=row/8,bend=lean*t*t,sway=sideBend*Math.sin(Math.PI*t)*t;
      const x=bx+dx*bend-dz*sway,y=t*height,z=bz+dz*bend+dx*sway;
      const neck=.13+.87*THREE.MathUtils.smoothstep(t,0,.25),taper=1-THREE.MathUtils.smoothstep(t,.25,1),halfWidth=width*neck*taper/2;
      const curveDerivative=sideBend*(Math.PI*Math.cos(Math.PI*t)*t+Math.sin(Math.PI*t));
      tangent.set(dx*2*lean*t-dz*curveDerivative,height,dz*2*lean*t+dx*curveDerivative).normalize();
      across.set(-Math.sin(angle+twist*t),0,Math.cos(angle+twist*t));
      across.addScaledVector(tangent,-across.dot(tangent)).normalize();foldNormal.crossVectors(across,tangent).normalize();
      color.copy(dark).lerp(light,t*.82);
      // A single tip closes both folded halves without coincident vertices or
      // zero-area terminal triangles. The basal neck has no raised fold.
      for(const side of row===8?[0]:[-1,0,1]){
        const ridge=side===0?fold*THREE.MathUtils.smoothstep(t,0,.25)*taper:0;
        positions.push(x+across.x*side*halfWidth+foldNormal.x*ridge,y+across.y*side*halfWidth+foldNormal.y*ridge,z+across.z*side*halfWidth+foldNormal.z*ridge);
        colors.push(color.r,color.g,color.b);uv.push((side+1)/2,t);
        if(row===0)rootIndices.push(positions.length/3-1);
      }
      if(row>0){
        const previous=start+(row-1)*3,current=start+row*3;
        if(row===8)indices.push(previous,previous+1,current,previous+1,previous+2,current);
        else for(let side=0;side<2;side++)indices.push(previous+side,previous+side+1,current+side,previous+side+1,current+side+1,current+side);
      }
    }
    blades.push({start,count:positions.length/3-start});
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.grass={seed,blades,rootIndices};return geometry;
}

/** Tilt only the tuft's rooted plane; keep its accepted centre and scale. */
export function grassTangentPlacement(placement,heightAt){
  const {x,z}=placement,normal=new THREE.Vector3(),sample=heightAt.surfaceAt?.(x,z);
  if(sample?.normal)normal.copy(sample.normal);
  else {
    const epsilon=.025,dx=(heightAt(x+epsilon,z)-heightAt(x-epsilon,z))/(2*epsilon),dz=(heightAt(x,z+epsilon)-heightAt(x,z-epsilon))/(2*epsilon);
    normal.set(-dx,1,-dz);
  }
  if(![normal.x,normal.y,normal.z].every(Number.isFinite)||normal.lengthSq()===0)throw new RangeError('Grass needs a finite terrain normal');
  normal.normalize();
  const up=new THREE.Vector3(0,1,0),rotation=new THREE.Quaternion().setFromUnitVectors(up,normal);
  rotation.multiply(new THREE.Quaternion().setFromAxisAngle(up,placement.r||0));
  const euler=new THREE.Euler().setFromQuaternion(rotation,'XYZ');
  return {...placement,rx:euler.x,r:euler.y,rz:euler.z};
}
