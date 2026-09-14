import * as THREE from 'three';

export const poolWaterStudyId='xieqiqu-pool-water-r1';
const evidence='Authored moving water and small impact splashes; not a measured historical flow rate.';
const random=i=>{let n=Math.imul(i+127,1597334677);n=Math.imul(n^(n>>>16),2246822507);return ((n^(n>>>13))>>>0)/4294967296;};
const check=(ok,message)=>{if(!ok)throw new Error('Pool water: '+message);};

/** Ballistic droplets, measured relative to the existing stream landing.
 * Size correction keeps gravity and drop dimensions consistent on small fish. */
export function samplePoolSplash(index,time,scale=1){
  check(Number.isInteger(index)&&index>=0&&Number.isFinite(time)&&Number.isFinite(scale)&&scale>0,'finite splash time and positive scale required');
  const lifetime=.20+random(index*5)*.16,age=((time+random(index*5+1)*lifetime)%lifetime+lifetime)%lifetime;
  const phase=age/lifetime,angle=random(index*5+2)*Math.PI*2,speed=.17+random(index*5+3)*.26;
  const radius=(.004+random(index*5+4)*.008)*Math.sin(Math.PI*phase)**.35/scale;
  return {position:[Math.cos(angle)*speed*age/scale,(.003+4.905*age*(lifetime-age))/scale,Math.sin(angle)*speed*age/scale],radius,phase};
}

/** The shared loft assigns .5 to both cap centres. Keep the original UVs and
 * shape, but give this water-only view a correct longitudinal coordinate. */
export function createPoolFlowGeometry(source,{start,end}){
  check(source?.isBufferGeometry&&source.attributes.uv&&[start,end].every(p=>p?.length===3&&p.every(Number.isFinite)),'stream geometry and original endpoints required');
  const geometry=source.clone(),p=geometry.attributes.position,uv=geometry.attributes.uv,values=new Float32Array(p.count),a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),v=new THREE.Vector3();let first=0,last=0;
  try{
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);let t=uv.getY(i);
      if(v.distanceToSquared(a)<1e-12){t=0;first++;}else if(v.distanceToSquared(b)<1e-12){t=1;last++;}
      check(Number.isFinite(t)&&t>=0&&t<=1,'stream UV must retain its original 0 to 1 domain');values[i]=t;
    }
    check(first>0&&last>0,'both actual stream cap centres must be found');
    geometry.setAttribute('poolStreamT',new THREE.BufferAttribute(values,1));geometry.userData={...source.userData,waterStudy:poolWaterStudyId,capCoordinatesCorrected:true};return geometry;
  }catch(error){geometry.dispose();throw error;}
}

/** Reversible material/impact study on an exclusively owned pool context.
 * Original mesh positions, water sheet, stream path and map pixels stay intact.
 * Release this view before its context; original materials remain context-owned. */
export function createXieqiquPoolWaterStudy({context,signal}={}){
  signal?.throwIfAborted();check(context?.group?.isGroup&&!context.disposed&&context.mounts?.length===4,'live four-fish pool context required');
  const bindings=[],geometryBindings=[],materialCopies=new Map(),drops=[],owned=new Set(),listening=new Set(),timeUniform={value:0};let disposed=false,invalidated=false;
  const diagnostics={id:poolWaterStudyId,evidence,archiveCompatible:false,visualAccepted:false,sourceGeometryChanged:false,sourceMapPixelsChanged:false,streamGeometryViews:4,streamCapCoordinatesCorrected:true,dropCount:128,landingAnchors:[],materialBindings:0,poolSurfaceBindings:0,landingRippleBindings:0,landingRippleStudy:'thin-annular-glints-r3'};
  const invalidate=()=>{invalidated=true;for(const {mesh}of [...drops,...bindings])mesh.visible=false;};
  const watch=resource=>{if(!listening.has(resource)){listening.add(resource);resource.addEventListener('dispose',invalidate);}};
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);const errors=[];
    for(const resource of listening)resource.removeEventListener('dispose',invalidate);listening.clear();
    for(const {mesh}of drops){mesh.removeFromParent();try{mesh.dispose();}catch(error){errors.push(error);}}drops.length=0;
    for(const {mesh,source,copy,visible,renderOrder}of bindings)if(mesh.material===copy){mesh.material=source;mesh.renderOrder=renderOrder;if(!invalidated)mesh.visible=visible;}bindings.length=0;
    for(const {mesh,source,copy}of geometryBindings)if(mesh.geometry===copy)mesh.geometry=source;geometryBindings.length=0;
    for(const resource of owned)try{resource.dispose();}catch(error){errors.push(error);}owned.clear();materialCopies.clear();
    if(errors.length)throw new AggregateError(errors,'Pool water cleanup failed');
  }
  function materialFor(source,viewRole){
    let copies=materialCopies.get(source);if(!copies){copies=new Map();materialCopies.set(source,copies);}
    if(copies.has(viewRole))return copies.get(viewRole);
    check(source.isMeshPhysicalMaterial,'source water must use physical material');
    const material=source.clone();owned.add(material);copies.set(viewRole,material);
    material.userData={...source.userData,studyId:poolWaterStudyId,evidence,borrowedMaps:true,viewRole};material.name=source.name+(viewRole==='landing-ripple'?'-thin-ripple-r3':'-clear-moving-r1');
    // Transmission retains the submerged stone. A small dissolved-water tint
    // avoids the grey, opaque sheet in the first real pool capture.
    if(viewRole==='pool-surface'){
      material.color.set('#b4d7cf');material.roughness=.115;material.transmission=.82;material.thickness=.52;material.opacity=1;
      material.attenuationColor.set('#78b5a8');material.attenuationDistance=2.8;
      material.normalScale.set(.34,.34);material.clearcoat=.32;material.clearcoatRoughness=.12;material.clearcoatNormalScale.set(.23,.23);
    }else if(viewRole==='landing-ripple'){
      // These are millimetre-high crests on top of the existing pool, not a
      // second half-metre volume of green water. Keep the source maps borrowed.
      // Almost full transmission disappeared against the transmitted basin in
      // native closeups. Aerated crests retain a little diffuse light while
      // the broken, soft envelope prevents solid concentric bands.
      material.color.set('#e7f6f2');material.roughness=.14;material.transmission=.38;material.thickness=.008;material.opacity=.86;
      material.transparent=true;material.depthWrite=false;material.attenuationColor.set(0xffffff);material.attenuationDistance=Infinity;
      material.normalScale.set(.22,.22);material.clearcoat=.72;material.clearcoatRoughness=.09;material.clearcoatNormalScale.set(.18,.18);
      material.onBeforeCompile=shader=>{
        check(shader.vertexShader.includes('#include <begin_vertex>')&&shader.fragmentShader.includes('#include <alphamap_fragment>'),'r185 ripple shader anchors unavailable');
        shader.uniforms.poolRippleTime=timeUniform;
        // fountainRippleGeometry stores its original XZ in uv - .5; the
        // builder preserves these coordinates through scaling and merging.
        shader.vertexShader='varying vec2 vPoolRippleUV;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPoolRippleUV=uv;');
        shader.fragmentShader='uniform float poolRippleTime; varying vec2 vPoolRippleUV;\n'+shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
          vec2 rippleP=vPoolRippleUV-vec2(.5);
          float rippleR=length(rippleP),rippleAngle=atan(rippleP.y,rippleP.x);
          float ringDistance=min(abs(rippleR-.30),min(abs(rippleR-.64),abs(rippleR-1.0)));
          float softEdge=1.-smoothstep(.30,1.,ringDistance/.09);
          float outwardFade=mix(1.,.40,smoothstep(.21,1.09,rippleR));
          float arc=.14+.86*smoothstep(-.15,.75,.65*sin(3.*rippleAngle+4.7*rippleR-.45*poolRippleTime)+.35*cos(2.*rippleAngle-.33*poolRippleTime));
          float arrival=.38+.62*(.5+.5*cos(9.*rippleR-3.1*poolRippleTime));
          diffuseColor.a*=softEdge*outwardFade*arc*arrival;`);
      };
      material.customProgramCacheKey=()=>poolWaterStudyId+'-thin-landing-ripple-r3';
    }else{
      material.color.set('#f0ffff');material.roughness=.055;material.transmission=1;material.opacity=1;material.clearcoat=.12;
      material.normalScale.set(.13,.20);material.alphaMap=null;
      material.onBeforeCompile=shader=>{
        check(shader.vertexShader.includes('#include <begin_vertex>')&&shader.fragmentShader.includes('#include <alphamap_fragment>'),'r185 water shader anchors unavailable');
        shader.uniforms.poolFlowTime=timeUniform;
        shader.vertexShader='attribute float poolStreamT; varying vec2 vPoolStreamUV;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPoolStreamUV=vec2(uv.x,poolStreamT);');
        shader.fragmentShader='uniform float poolFlowTime; varying vec2 vPoolStreamUV;\n'+shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
          float streamT=clamp(vPoolStreamUV.y,0.,1.);
          float packet=.5+.5*sin(streamT*100.-poolFlowTime*24.);
          float movingSheen=.79+.21*sin(streamT*46.-poolFlowTime*12.+sin(vPoolStreamUV.x*6.2831853));
          float breakup=mix(1.,mix(.25,1.,smoothstep(.18,.64,packet)),smoothstep(.58,1.,streamT));
          diffuseColor.a*=movingSheen*breakup;`);
      };
      material.customProgramCacheKey=()=>poolWaterStudyId+'-moving-stream-cap-t-r2';
    }
    for(const resource of [source,...Object.values(source).filter(value=>value?.isTexture)])watch(resource);
    return material;
  }
  function update(time){
    if(disposed||invalidated||!Number.isFinite(time)||context.disposed)return;
    timeUniform.value=time%3600;
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
    for(const {mesh,end,mountScale,seed}of drops){
      for(let i=0;i<32;i++){
        const sample=samplePoolSplash(i+seed,time,mountScale);position.fromArray(sample.position).add(end);scale.set(sample.radius*.77,sample.radius*1.28,sample.radius*.77);
        mesh.setMatrixAt(i,matrix.compose(position,rotation,scale));
      }
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  try{
    // The builder merges by parent/material. In the four real flow groups a
    // surface mesh is the landing ripple; the same material outside those
    // groups belongs to the basin. Classify before rebinding by source identity.
    const landingRipples=new Set();
    for(const mount of context.mounts){
      check(mount.flow?.isGroup,'original fish flow group required');let count=0;
      mount.flow.traverse(mesh=>{if(mesh.isMesh&&!Array.isArray(mesh.material)&&mesh.material?.userData.category==='water'&&mesh.material.userData.role==='surface'){check(mesh.geometry?.attributes.uv,'original landing ripple UV required');landingRipples.add(mesh);count++;}});
      check(count>0,'original landing ripple required in each fish flow');
    }
    const waterMeshes=[];context.group.traverse(mesh=>{if(mesh.isMesh&&!Array.isArray(mesh.material)&&mesh.material?.userData.category==='water')waterMeshes.push(mesh);});
    check(waterMeshes.some(mesh=>mesh.material.userData.role==='surface')&&waterMeshes.some(mesh=>mesh.material.userData.role==='flow'),'surface and flow meshes are both required');
    for(const mesh of waterMeshes){
      const source=mesh.material,viewRole=landingRipples.has(mesh)?'landing-ripple':source.userData.role==='surface'?'pool-surface':'flow',copy=materialFor(source,viewRole);
      bindings.push({mesh,source,copy,visible:mesh.visible,renderOrder:mesh.renderOrder});mesh.material=copy;watch(mesh.geometry);
      // Transparent sorting uses each mesh's centre. The large pool plane can
      // otherwise cover its near landing crests when the camera moves closer.
      if(viewRole==='landing-ripple')mesh.renderOrder=2;
      if(viewRole==='pool-surface')diagnostics.poolSurfaceBindings++;if(viewRole==='landing-ripple')diagnostics.landingRippleBindings++;
    }
    for(const mount of context.mounts){
      const endpoint=context.diagnostics.waterEndpoints.find(value=>value.id===mount.group.name+'-jet');check(endpoint,'original stream endpoint required');
      mount.flow.traverse(mesh=>{
        if(!mesh.isMesh||mesh.material?.userData.role!=='flow')return;
        const source=mesh.geometry,copy=createPoolFlowGeometry(source,endpoint);owned.add(copy);geometryBindings.push({mesh,source,copy});mesh.geometry=copy;
        watch(source);
      });
    }
    const geometry=new THREE.SphereGeometry(1,16,10);owned.add(geometry);
    const material=new THREE.MeshPhysicalMaterial({color:0xf3ffff,metalness:0,ior:1.333,roughness:.06,transmission:.94,thickness:.016,transparent:true,opacity:1,depthWrite:false,clearcoat:.12});
    material.name=poolWaterStudyId+'-impact-droplets';material.userData={category:'water',role:'flow',evidence};owned.add(material);
    for(let i=0;i<4;i++){
      signal?.throwIfAborted();const mount=context.mounts[i],endpoint=context.diagnostics.waterEndpoints.find(value=>value.id===mount.group.name+'-jet');
      check(mount.flow?.isGroup&&endpoint?.end?.length===3&&endpoint.end.every(Number.isFinite),'original stream endpoint required');
      const mountScale=mount.placement.size;check(Number.isFinite(mountScale)&&mountScale>0,'actual fish size required');
      const end=new THREE.Vector3(...endpoint.end),mesh=new THREE.InstancedMesh(geometry,material,32);mesh.name=mount.group.name+'-landing-splash';mesh.renderOrder=3;
      // An explicit bound covers every ballistic phase, avoiding both per-frame
      // allocation and culling from an uninitialised instance bounding sphere.
      mesh.boundingSphere=new THREE.Sphere(end.clone().add(new THREE.Vector3(0,.12/mountScale,0)),.34/mountScale);
      mount.flow.add(mesh);drops.push({mesh,end,mountScale,seed:i*127});diagnostics.landingAnchors.push({id:endpoint.id,localEnd:[...endpoint.end],scale:mountScale});
    }
    diagnostics.materialBindings=bindings.length;diagnostics.resourceOwnership={materialViews:[...materialCopies.values()].reduce((sum,copies)=>sum+copies.size,0),materials:[...owned].filter(resource=>resource.isMaterial).length,geometries:[...owned].filter(resource=>resource.isBufferGeometry).length,instancedMeshes:drops.length,textures:0};update(0);signal?.addEventListener('abort',dispose,{once:true});
    return {diagnostics,update,dispose,get disposed(){return disposed;},get invalidated(){return invalidated;}};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Pool water preparation failed',{cause:error});}throw error;}
}
