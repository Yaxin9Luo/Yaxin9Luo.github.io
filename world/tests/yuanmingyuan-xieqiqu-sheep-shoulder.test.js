import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCopperSheepBodyGeometry} from '../src/yuanmingyuan/xieqiqu-copper-sheep.js';

// The production scalar field, grid spacing, redistribution and sculpting are
// evaluated only in one 48-cell shoulder window. The cut window boundary is
// intentionally excluded: this is a local failure fixture, not a closed owner.
test('actual shoulder windows keep the carved forward and rear-facing folds consistently shaded',()=>{
  for(const firstX of [26,78]){
    const geometry=createCopperSheepBodyGeometry({sampleWindow:{start:[firstX,65,80],count:48}});
    let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
    try{
      assert.equal(geometry.userData.partialAuthoringFixture,true);
      assert.ok(geometry.userData.shoulderRefinement.trianglesBefore<45000,'only sample a local base window');assert.ok(geometry.index.count/3<400000,'the locally refined patch remains bounded');
      assert.ok(geometry.userData.fleece.maximumDisplacement>.021,'retain the authored relief height');
      const p=geometry.attributes.position,n=geometry.attributes.normal,ids=geometry.index.array,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();let checked=0;const rejected=[];
      for(let i=0;i<ids.length;i+=3){
        a.fromBufferAttribute(p,ids[i]);b.fromBufferAttribute(p,ids[i+1]);c.fromBufferAttribute(p,ids[i+2]);
        const x=Math.abs((a.x+b.x+c.x)/3),y=(a.y+b.y+c.y)/3,z=(a.z+b.z+c.z)/3;
        if(x<.09||x>.21||y<.80||y>1.22||z<.44||z>.64)continue;checked++;
        normal.set(n.getX(ids[i])+n.getX(ids[i+1])+n.getX(ids[i+2]),n.getY(ids[i])+n.getY(ids[i+1])+n.getY(ids[i+2]),n.getZ(ids[i])+n.getZ(ids[i+1])+n.getZ(ids[i+2]));
        const dot=b.sub(a).cross(c.sub(a)).normalize().dot(normal.normalize());if(dot<=0)rejected.push({face:i/3,center:[x,y,z],dot});
      }
      assert.ok(checked>7500);assert.equal(rejected.length,0,JSON.stringify(rejected.slice(0,3)));
    }finally{geometry.dispose();assert.equal(disposed,1);}
  }
});

test('a local authoring window cannot silently escape the requested production grid',()=>{
  for(const sampleWindow of [{start:[78,65,80],count:100},{start:[-1,65,80],count:48},{start:[120,65,80],count:48}])assert.throws(()=>createCopperSheepBodyGeometry({sampleWindow}),/sampling window/);
});
