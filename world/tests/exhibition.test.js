import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseContentRoute, contentHash, ReadingMemory, MediaSelection} from '../src/exhibition-state.js';
import {selectedProjects, getProject, publicationRole} from '../src/exhibition-content.js';
import {publications} from '../src/content.js';
import {renderPaperDetail, renderProjectDetail} from '../src/journal.js';
import {resolveRiderCollision} from '../src/collision.js';

test('entity routes round trip; invalid entities return a readable collection', () => {
  const route={kind:'project',id:'autodesign',mediaIndex:2,spatial:true};
  assert.deepEqual(parseContentRoute(contentHash(route)),route);
  assert.deepEqual(parseContentRoute('#paper/no-such-paper'),{kind:'section',id:'publications'});
  assert.deepEqual(parseContentRoute('#project/%E0%A4'),{kind:'section',id:'projects'});
  assert.equal(parseContentRoute('#paper/dvin').id,'dvin');
  assert.equal(parseContentRoute('#project/autodesign?media=999').mediaIndex,getProject('autodesign').media.length-1);
  assert.equal(parseContentRoute(''),null);
});

test('reading memory keeps each work and clamps invalid media without losing scroll', () => {
  const memory=new ReadingMemory();
  memory.save('project','autodesign',{mediaIndex:2,scrollTop:620});
  memory.save('paper','dvin',{scrollTop:188});
  assert.deepEqual(memory.read('project','autodesign'),{mediaIndex:2,scrollTop:620});
  assert.equal(memory.read('paper','dvin').scrollTop,188);
  memory.save('project','autodesign',{mediaIndex:-20});
  assert.deepEqual(memory.read('project','autodesign'),{mediaIndex:0,scrollTop:620});
});

test('late media and failed media never replace the current completed selection', async () => {
  const displayed=[],pending=[];
  const selection=new MediaSelection(src=>new Promise((resolve,reject)=>pending.push({src,resolve,reject})),item=>displayed.push(item));
  const a=selection.select('a'),b=selection.select('b');
  pending[1].resolve('B');await b;pending[0].resolve('A');await a;
  assert.deepEqual(displayed,['B']);
  const broken=selection.select('missing');pending[2].reject(new Error('missing'));await broken;
  assert.deepEqual(displayed,['B']);
  assert.equal(selection.error,true);
});

test('every selected project has honest author roles and traceable, existing media', () => {
  assert.equal(selectedProjects.length,8);
  assert.equal(getProject('figmirror').kind,'software');
  assert.equal(publicationRole(publications.find(p=>p.id==='autodesign')).en,'Co-first author');
  assert.equal(publicationRole(publications.find(p=>p.id==='dvin')).en,'Co-author');
  for(const project of selectedProjects)for(const media of project.media){
    assert.ok(media.caption.en&&media.caption.zh);assert.ok(media.source.startsWith('https://'));
    assert.ok(['output','method','process'].includes(media.kind));
    assert.ok(fs.existsSync(new URL(media.src.startsWith('/media/')?'../public'+media.src:'../..'+media.src,import.meta.url)),media.src);
  }
});

test('FigMirror is an accessible software project without an invented paper or authorship',()=>{
  assert.equal(publications.some(p=>p.id==='figmirror'),false);
  assert.equal(parseContentRoute('#project/figmirror').id,'figmirror');
  for(const lang of ['en','zh']){
    const html=renderProjectDetail('figmirror',lang);
    assert.ok(html.includes('FigMirror'));
    assert.ok(html.includes('https://github.com/VILA-Lab/FigMirror'));
    assert.ok(html.includes(getProject('figmirror').contribution[lang]));
    assert.ok(!html.includes('data-action="paper"'));
    assert.ok(!html.includes('Published paper'));
    assert.ok(!html.includes('已发表论文'));
  }
});

test('paper objects open one exact work and projects expose independent media controls', () => {
  for(const lang of ['en','zh'])for(const paper of publications){
    const html=renderPaperDetail(paper.id,lang);
    assert.ok(html.includes(paper.title.en));
    assert.ok(html.includes(`data-entity-id="${paper.id}"`));
    assert.ok(!html.includes('undefined'));
    for(const other of publications.filter(p=>p.id!==paper.id))assert.ok(!html.includes(`data-entity-id="${other.id}"`));
  }
  const html=renderProjectDetail('autodesign','zh',2);
  assert.ok(html.includes('data-action="media-next"'));
  assert.ok(html.includes('data-action="exhibition"'));
  assert.ok(html.includes(getProject('autodesign').media[2].src));
  assert.ok(html.includes('共同一作'));
});

test('the physical stage has named controls, a usable camera and honest project selection', async () => {
  const THREE=await import('three');const {createExhibitionStage}=await import('../src/exhibits.js');
  const scene=new THREE.Scene(),stage=createExhibitionStage(scene,()=>6);
  assert.ok(stage.interactiveTargets.length>=7);
  assert.ok(stage.interactiveTargets.every(mesh=>mesh.userData.exhibition?.action));
  assert.ok(stage.camera.position.distanceTo(stage.camera.target)>12);
  assert.equal(stage.camera.framingBounds.length,3,'screen, title and workbench retain their actual depths');
  const required=new Map([['exhibition-screen-frame',0],['exhibition-title-frame',1],['exhibition-desk-edge',2],['exhibition-desk-leg',2]]),found=[];
  stage.group.traverse(object=>{
    if(!required.has(object.name))return;
    const meshBounds=new THREE.Box3().setFromObject(object);
    assert.ok(stage.camera.framingBounds[required.get(object.name)].containsBox(meshBounds),`${object.name} is included in the physical framing contract`);
    assert.ok(stage.camera.bounds.containsBox(meshBounds));found.push(object.name);
  });
  assert.equal(found.length,7,'framing includes all four desk legs as well as the title, screen and tabletop');
  assert.ok(stage.camera.bounds.getSize(new THREE.Vector3()).x<17,'adjacent project boards do not shrink the main work unnecessarily');
  stage.setProject('dvin');assert.equal(stage.projectId,'dvin');
  stage.setProject('invalid');assert.equal(stage.projectId,'dvin');
  stage.setMedia(100);assert.equal(stage.mediaIndex,0);
  assert.ok(new THREE.Box3().setFromObject(stage.group).getSize(new THREE.Vector3()).x>18);
  stage.dispose();assert.equal(scene.children.length,0);
});

test('session restoration keeps media and reading position across a reload',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const first=new ReadingMemory(storage);first.save('project','autodesign',{mediaIndex:4,scrollTop:918});
  const reloaded=new ReadingMemory(storage);
  assert.deepEqual(reloaded.read('project','autodesign'),{mediaIndex:4,scrollTop:918});
});

test('the exhibition blocks its thick screen and desk while keeping side and under-desk passages open',async()=>{
  const THREE=await import('three');const {createExhibitionStage}=await import('../src/exhibits.js');
  const stage=createExhibitionStage(new THREE.Scene(),()=>6),origin=stage.group.position;
  try{
    assert.ok(Array.isArray(stage.colliders)&&stage.colliders.length>0);
    const probe=(x,y,z)=>resolveRiderCollision({x:origin.x+x,y:origin.y+y,z:origin.z+z},{x:0,y:0,z:-4},stage.colliders);
    const screen=probe(0,8,-4.15);assert.equal(screen.collided,true);assert.equal(screen.colliderId,'exhibition/screen');assert.ok(screen.position.z>origin.z-3.2);
    assert.equal(probe(0,3.4,3.66).collided,true,'the desk is a solid surface');
    assert.equal(probe(0,.55,0).collided,true,'the platform is a solid surface');
    for(const x of [-9.3,9.3])assert.equal(probe(x,8,-4.15).collided,false,'both sides of the screen remain open');
    for(const z of [1.8,3.66,5.5])assert.equal(probe(0,2,z).collided,false,'the desk does not become a floor-to-top wall');
    assert.equal(probe(0,8,-1).collided,false,'the viewing aisle stays open');
    assert.equal(resolveRiderCollision(screen.position,{x:0,y:0,z:0},stage.colliders).collided,false,'collision recovery leaves no embedded rider');
  }finally{stage.dispose();}
});
