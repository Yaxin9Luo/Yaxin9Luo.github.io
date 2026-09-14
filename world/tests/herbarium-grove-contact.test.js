import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createGroveContactFixture,classifyGroveContact,probeGroveOffsets} from './helpers/herbarium-grove-contact.js';
import {herbariumRegionalCommunities} from '../src/herbarium-layout.js';

test('authored grove bridge retains its complete connected body clear of the actual silver branch instance',async()=>{
  const fixture=await createGroveContactFixture();
  try{
    const report=await classifyGroveContact(fixture,{classifyAlpha:!!process.env.HERBARIUM_CONTACT_REPORT});
    if(process.env.HERBARIUM_CONTACT_PROBE)report.offsetProbes=probeGroveOffsets(fixture,[[0,.3],[.3,0],[.5,0],[0,.5],[.4,.4],[0,.75],[.65,.35],[0,1]]);
    if(process.env.HERBARIUM_CONTACT_REPORT)await writeFile(process.env.HERBARIUM_CONTACT_REPORT,JSON.stringify(report,null,2)+'\n');
    const region=herbariumRegionalCommunities.find(r=>r.id==='conservatory-grove-woody'),community=fixture.district.communities.find(c=>c.name.endsWith(region.id));
    assert.equal(community.children.length,region.plants.length);assert.equal(community.children.filter(p=>p.userData.canonicalCommunityPlant).length,48);
    const boxes=community.children.map(plant=>{const box=new THREE.Box3().setFromObject(plant).expandByScalar(.035);box.min.y=-Infinity;box.max.y=Infinity;return box;}),unseen=new Set(boxes.map((_,i)=>i)),pending=[0];unseen.delete(0);
    while(pending.length){const i=pending.pop();for(const j of unseen)if(boxes[i].intersectsBox(boxes[j])){unseen.delete(j);pending.push(j);}}
    assert.equal(unseen.size,0,'the authored grove cannot lose its connected body');
    // Same conservative final gate as the whole-scene test; exact/alpha contact
    // diagnostics explain the failure but do not replace or relax the gate.
    assert.equal(report.branchTrianglesInsidePlantBounds,0,JSON.stringify({root:report.plant.position,branchTriangles:report.branchTrianglesInsidePlantBounds,actualContacts:report.actualContactSegments,visibleContacts:report.visibleContactSegments}));
  }finally{fixture.dispose();}
});
