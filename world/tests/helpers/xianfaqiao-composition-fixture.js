import * as THREE from 'three';
import {flowerOutline} from '../../src/yuanmingyuan/xieqiqu-geometry.js';
import {extrudedPolygon} from '../../src/yuanmingyuan/study-geometry.js';
import {xianfaqiaoArchive} from '../../src/yuanmingyuan/xianfaqiao-integration.js';
import {createGardenTerrain} from '../../src/yuanmingyuan/garden-terrain.js';
import {createGardenWater} from '../../src/yuanmingyuan/garden-water.js';
import {pointInPolygon} from '../../src/yuanmingyuan/garden-layout.js';
import {polygonBooleanRegions} from '../../src/yuanmingyuan/terrain-geometry.js';

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
export function compositionOwner(id,events=[]){
  const group=new THREE.Group(),stone=new THREE.MeshStandardMaterial(),water=new THREE.MeshStandardMaterial({transparent:true}),geometries=[],sheets=[];
  group.name=`${id}-component-fixture`;water.userData={category:'water',role:'surface'};
  const subgroup=name=>{const result=new THREE.Group();result.name=name;group.add(result);return result;};
  const polygon=(parent,ring,bottom,top,material,holes=[])=>{const geometry=extrudedPolygon(ring,bottom,top,holes),mesh=new THREE.Mesh(geometry,material);geometries.push(geometry);parent.add(mesh);return mesh;};
  // These tiny real components exercise the source owner/triangle contract.
  // The assigned manifest identity is a test input, never archive verification.
  if(id==='xianfaqiao'){
    polygon(group,rect(-18.2,-2.5,18.2,2.5),.9,1.25,stone);
    const lake=subgroup('xianfaqiao-study-water-channel');
    polygon(lake,rect(-16.2,-10,16.2,10),-1.81,-1.70,stone);
    sheets.push(polygon(lake,rect(-16.1,-10,16.1,10),-.726,-.72,water));
  }else if(id==='xieqiqu'){
    group.userData.assetId='xieqiqu-complete-group';
    const profiles=[['xieqiqu-south-haitang-pool','haitang',26,13,8.5],['xieqiqu-north-chrysanthemum-pool','chrysanthemum',-27,4.8,4.8]].map(([name,kind,z,rx,rz])=>{
      const outer=flowerOutline(kind,0,z,rx,rz);return {name,outer,inner:outer.map(([x,pz])=>[x*.957,z+(pz-z)*.957])};
    });
    polygon(group,rect(-52,-51,52,40.75),-.65,0,stone,profiles.map(p=>p.outer));
    for(const {name,outer,inner} of profiles){const pool=subgroup(name);polygon(pool,outer,-.6,.43,stone,[inner]);polygon(pool,inner,-.61,-.45,stone);sheets.push(polygon(pool,inner,.114,.13,water));}
    const lake=subgroup('xieqiqu-south-lake-foreground');
    polygon(lake,rect(-52,40.755,52,52.005),-.95,-.85,stone);
    sheets.push(polygon(lake,rect(-52,40.755,52,52.005),-.214,-.2,water));
    polygon(lake,rect(-52,40.67,52,41.11),-.875,.225,stone);
  }else throw new Error(`Unexpected fixture asset: ${id}`);
  let disposed=false;
  const owner={group,sheets,updates:[],disposeCalls:0,disposedSheets:null,diagnostics:{assetId:id==='xieqiqu'?'xieqiqu-complete-group':'xianfaqiao-study'},
    ...(id==='xianfaqiao'?{archive:{id,glbSHA256:xianfaqiaoArchive.glbSHA256}}:{}),
    get disposed(){return disposed;},update(time){if(disposed)throw new Error('Updating released owner');owner.updates.push(time);},
    dispose(){owner.disposeCalls++;if(disposed)return;disposed=true;owner.disposedSheets=sheets.map(mesh=>({visible:mesh.visible,navigation:mesh.userData.navigation}));events.push(`dispose:${id}`);for(const g of geometries)g.dispose();stone.dispose();water.dispose();group.clear();},
  };
  return owner;
}

export function compositionGround(plan,{north=-615}={}){
  const coast=rect(275,north,478,-437),clip=ring=>polygonBooleanRegions([coast,ring],p=>pointInPolygon(p,coast)&&pointInPolygon(p,ring)).regions;
  const layout={id:'bounded-composition-fixture',exhibition:{groundY:4,seaY:0,coast:{polygon:coast}},
    gardens:plan.layout.gardens.filter(g=>['yuanmingyuan','changchunyuan'].includes(g.id)).map(g=>({...g,boundary:clip(g.boundary)[0].outer})),
    channels:[],waterBodies:[],ornamentalWaters:[],islands:[],landforms:[],bridges:[]};
  const terrain=createGardenTerrain({layout,assetCourts:plan.courts,assetPads:plan.pads,assetPaths:plan.paths});
  terrain.group.updateWorldMatrix(true);const water=createGardenWater({terrain,layout,reflectionResolution:8});
  return {terrain,water,dispose(){water.dispose();terrain.dispose();}};
}
