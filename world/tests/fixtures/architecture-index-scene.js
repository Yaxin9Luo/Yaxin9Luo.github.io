import {BoxGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Vector3} from 'three';

// Small actual meshes only: a broad floor, equal-height overlaps, thin jambs,
// dense individual paving and several overhead instance layers.
export function architectureIndexScene({side=24,position=[563,4.85,-350],rotationY=.31,scale=1}={}){
  const group=new Group(),geometry=new BoxGeometry(),material=new MeshBasicMaterial(),matrix=new Matrix4(),ownedInstances=[];
  group.position.fromArray(position);group.rotation.y=rotationY;group.scale.setScalar(scale);
  const add=(name,p,s)=>{const mesh=new Mesh(geometry,material);mesh.name=name;mesh.position.fromArray(p);mesh.scale.fromArray(s);group.add(mesh);return mesh;};
  const floor=add('wide-first-equal-floor',[0,-.1,0],[130,.2,90]);
  add('second-equal-floor',[0,-.1,0],[90,.2,130]);
  add('thin-door-left',[-2,1.5,2],[.08,3,1]);add('thin-door-right',[2,1.5,2],[.08,3,1]);
  const count=side*side*4,instances=new InstancedMesh(geometry,material,count);instances.name='paving-and-overhead-instances';ownedInstances.push(instances);
  for(let layer=0;layer<4;layer++)for(let i=0;i<side*side;i++){
    const x=(i%side-(side-1)/2)*.43,z=(Math.floor(i/side)-(side-1)/2)*.43,y=layer?layer*3+.1:-.1;
    instances.setMatrixAt(layer*side*side+i,matrix.makeScale(.39,.2,.39).setPosition(x,y,z));
  }
  group.add(instances);group.updateMatrixWorld(true);
  const point=(x,y,z)=>new Vector3(x,y,z).applyMatrix4(group.matrixWorld);
  return {group,geometry,material,instances,floor,point,position,
    queries(count=360){return Array.from({length:count},(_,i)=>{const p=point((i%20)*.381-3.6,0,Math.floor(i/20)*.399-3.5);return {x:p.x,z:p.z,maxY:position[1]+.65*scale,minY:position[1]-.4*scale};});},
    dispose(){for(const instance of ownedInstances)instance.dispose();geometry.dispose();material.dispose();group.clear();},
  };
}
