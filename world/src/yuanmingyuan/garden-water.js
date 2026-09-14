import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {triangulateSurface} from './terrain-geometry.js';
import {createFrameReflectionCache} from './frame-reflection-cache.js';
import {prepareGardenReflectionViews} from './garden-reflection-views.js';
import {prepareGardenReflectionCrop,withGardenReflectionCrop} from './garden-reflection-crop.js';

const waterShader={name:'Museum calm reflective water',uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},time:{value:0},eye:{value:new THREE.Vector3()},sunDirection:{value:new THREE.Vector3()},sunColor:{value:new THREE.Color()},night:{value:0},waveScale:{value:1}},
vertexShader:`uniform mat4 textureMatrix;varying vec4 vMirror;varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vMirror=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*world;}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 color,eye,sunDirection,sunColor;uniform float time,night,waveScale;varying vec4 vMirror;varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  vec2 rippleGradient(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
    float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+1.);
    return du*vec2(mix(b-a,d-c,u.y),mix(c-a,d-b,u.x));
  }
  void main(){vec2 p=vWorld.xz;float t=time*.30;
    float footprint=max(length(dFdx(p)),length(dFdy(p)));
    float medium=1.-smoothstep(.5,2.2,footprint),fine=1.-smoothstep(.14,.65,footprint);
    mat2 turn=mat2(.8,.6,-.6,.8);
    // Advected, differently rotated ripple fields break the former regular
    // cosine bands. Pixel footprints suppress only unresolvable frequencies.
    vec2 slope=(rippleGradient(p*.055+vec2(t*.09,-t*.04))*.018+
      turn*rippleGradient(turn*p*.27+vec2(t*.34,t*.21)+17.3)*.033*medium+
      rippleGradient(p*1.17+vec2(-t*.47,t*.19)+91.1)*.014*fine)*waveScale;
    vec3 n=normalize(vec3(-slope.x,1.,-slope.y)),view=normalize(eye-vWorld);float fresnel=.05+.95*pow(1.-max(0.,dot(view,n)),5.);
    vec2 uv=vMirror.xy/vMirror.w+slope*.016;vec3 reflection=texture2D(tDiffuse,clamp(uv,.001,.999)).rgb;
    float sun=pow(max(0.,dot(reflect(-normalize(sunDirection),n),view)),230.);
    vec3 col=mix(color*(.72+.12*dot(n,normalize(sunDirection))),reflection,.24+fresnel*.7)+sunColor*sun*.62;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`};

// Each horizontal elevation gets one planar reflection. Lake island holes are
// retained from the terrain Boolean; the sea is cut around the authored coast.
export function createGardenWater({terrain,layout,resolution=2048}={}){
  const group=new THREE.Group();group.name='Garden lakes and sea';const sheets=[],owned=new Set(),levels=new Map(),records=[];let reflecting=false,disposed=false,epoch=0,reflectionCropEnabled=false;
  const emptyCounts=()=>({attempt:0,capture:0,reuse:0,recursion:0,backFacing:0,override:0,failure:0});
  for(const surface of terrain.waterSurfaces){if(!levels.has(surface.worldY))levels.set(surface.worldY,[]);levels.get(surface.worldY).push(surface.geometry);}
  const sea=triangulateSurface([{outer:[[-7000,-7000],[7000,-7000],[7000,7000],[-7000,7000]],holes:[terrain.coastPolygon||layout.exhibition.coast.polygon]}],{edgeLength:Infinity});owned.add(sea);levels.set(layout.exhibition.seaY,[sea]);
  for(const [height,geometries] of levels){
    const geometry=mergeGeometries(geometries).rotateX(Math.PI/2);owned.add(geometry);
    const sheet=new Reflector(geometry,{textureWidth:resolution,textureHeight:resolution,multisample:4,clipBias:.0002,shader:waterShader,color:height===0?0x276a75:0x548d84});
    // The normal/depth prepass must never invoke a reflector with the scene's
    // override material, which would overwrite its beauty texture with normals.
    sheet.isWater=true;
    sheet.rotation.x=-Math.PI/2;sheet.position.y=height+.006;sheet.name=height===0?'Open sea':'Connected garden lakes';sheet.material.uniforms.waveScale.value=height===0?1.5:.72;
    const reflect=sheet.onBeforeRender,cache=createFrameReflectionCache();
    const record={height,planeY:sheet.position.y,resolution:[resolution,resolution],samples:4,frame:emptyCounts(),total:emptyCounts(),crop:{frame:{windows:0,full:0},total:{windows:0,full:0},last:null},cache,cropStamp:null};records.push(record);
    const count=name=>{record.frame[name]++;record.total[name]++;};
    const rotation=new THREE.Matrix4(),normal=new THREE.Vector3(),position=new THREE.Vector3(),view=new THREE.Vector3(),viewport=new THREE.Vector4();
    const capture=function(renderer,scene,camera){
      if(disposed)return;count('attempt');
      if(reflecting){count('recursion');return;}
      if(scene.overrideMaterial){count('override');return;}
      // Match r185 Reflector's early exit so capture counts mean a real nested
      // render, rather than a callback that returned before writing its target.
      position.setFromMatrixPosition(sheet.matrixWorld);view.setFromMatrixPosition(camera.matrixWorld).negate().add(position);
      normal.set(0,0,1).applyMatrix4(rotation.extractRotation(sheet.matrixWorld));
      if(view.dot(normal)>0&&!sheet.forceUpdate){count('backFacing');return;}
      if(reflectionCropEnabled){
        const p=sheet.geometry.attributes.position,i=sheet.geometry.index,t=sheet.getRenderTarget(),tex=t.texture;
        if(typeof renderer.getCurrentViewport==='function')renderer.getCurrentViewport(viewport);else viewport.set(0,0,0,0);
        // The legacy cache knows camera/target matrices only. Pixel footprints,
        // shader/filter edits and geometry version changes also invalidate a
        // cropped result, including two calls within the same outer epoch.
        const stamp=[...viewport.toArray(),camera.viewport??null,...(camera.viewport?.toArray()??[]),sheet.onBeforeRender,p,p?.version,p?.data?.version,i,i?.version,sheet.geometry.drawRange.start,sheet.geometry.drawRange.count,sheet.material.vertexShader,sheet.material.fragmentShader,sheet.material.uniforms.waveScale?.value,tex.minFilter,tex.magFilter,tex.generateMipmaps,tex.anisotropy,tex.wrapS,tex.wrapT,...t.viewport.toArray(),...t.scissor.toArray(),t.scissorTest];
        if(!record.cropStamp||stamp.length!==record.cropStamp.length||!stamp.every((value,i)=>value===record.cropStamp[i])){cache.clear();record.cropStamp=stamp;}
      }
      const target=sheet.getRenderTarget(),key={epoch,renderer,scene,camera,near:camera.near,far:camera.far,layers:camera.layers.mask,
        width:target.width,height:target.height,cameraWorld:camera.matrixWorld.elements,cameraProjection:camera.projectionMatrix.elements,surfaceWorld:sheet.matrixWorld.elements};
      try{
        const captured=cache.run(key,()=>{
          reflecting=true;const visible=sheets.map(peer=>peer.visible),previousTarget=renderer.getRenderTarget();
          const cubeFace=renderer.getActiveCubeFace?.(),mipmap=renderer.getActiveMipmapLevel?.(),xr=renderer.xr.enabled,shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate;
          const hasViewport=typeof renderer.getCurrentViewport==='function';if(hasViewport)renderer.getCurrentViewport(viewport);
          try{
            for(const peer of sheets)if(peer!==sheet)peer.visible=false;
            if(reflectionCropEnabled){
              let crop={kind:'full',reason:'unsupported-water-draw',rect:[0,0,target.width,target.height],areaFraction:1};
              try{
                if(sheet.onBeforeRender===capture&&sheet.material.vertexShader===waterShader.vertexShader&&sheet.material.fragmentShader===waterShader.fragmentShader){
                  const predicted=prepareGardenReflectionViews([sheet],camera,{clipBias:.0002})[0];
                  if(predicted)crop=prepareGardenReflectionCrop(sheet,camera,predicted.camera,{mainViewportWidth:hasViewport?viewport.z:0,mainViewportHeight:hasViewport?viewport.w:0,waveScale:sheet.material.uniforms.waveScale.value});
                }
              }catch(error){crop.reason=`crop-preparation-failed: ${error.message}`;}
              const mode=crop.kind==='window'?'windows':'full';record.crop.frame[mode]++;record.crop.total[mode]++;record.crop.last=crop;
              // getReflectionCamera is the actual r185 API; stock would create
              // the same cached camera at the start of this capture. The pure
              // reflectionViews API still never creates or mutates that cache.
              withGardenReflectionCrop(renderer,target,sheet.getReflectionCamera(camera),crop,()=>reflect.call(sheet,renderer,scene,camera));
            }else reflect.call(sheet,renderer,scene,camera);
          }
          catch(error){
            // Stock Reflector restores these only on success. A failed capture
            // must leave the main render usable for a retry of the same view.
            renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;
            renderer.setRenderTarget(previousTarget,cubeFace,mipmap);if(hasViewport)renderer.state.viewport(viewport);
            throw error;
          }finally{for(let i=0;i<sheets.length;i++)sheets[i].visible=visible[i];reflecting=false;}
        },{force:epoch===0||sheet.forceUpdate});
        count(captured?'capture':'reuse');
      }catch(error){count('failure');throw error;}
    };
    sheet.onBeforeRender=capture;
    sheets.push(sheet);group.add(sheet);
  }
  // This is called once before each outer render. Paused captures with identical
  // time still own a fresh epoch; renderer.info.frame counts nested renders too.
  function update(time,sample,camera){if(disposed)return;epoch++;for(const record of records){record.frame=emptyCounts();record.crop.frame={windows:0,full:0};}for(const sheet of sheets){const u=sheet.material.uniforms;u.time.value=time;u.eye.value.copy(camera.position);u.sunDirection.value.copy(sample.lightDirection);u.sunColor.value.copy(sample.key).multiplyScalar(sample.keyIntensity*.4);u.night.value=sample.night;u.color.value.copy(sample.water).lerp(new THREE.Color(0x75a48c),.20*(1-sample.night));}}
  function snapshot(){return {epoch,disposed,reflectionCropEnabled,policy:'same outer update and most recent exact view only',sheets:records.map(({cache,cropStamp,crop,frame,total,...record})=>({...record,resolution:[...record.resolution],crop:JSON.parse(JSON.stringify(crop)),cached:cache.hasValue,frame:{...frame},total:{...total}}))};}
  function setReflectionCropEnabled(enabled){if(disposed)return false;if(typeof enabled!=='boolean')throw new Error('Reflection crop requires a boolean.');if(enabled!==reflectionCropEnabled){reflectionCropEnabled=enabled;for(const record of records){record.cache.clear();record.cropStamp=null;record.crop.last=null;}}return reflectionCropEnabled;}
  function reflectionViews(camera){return disposed?[]:prepareGardenReflectionViews(sheets,camera,{clipBias:.0002});}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const record of records)record.cache.clear();for(const sheet of sheets){sheet.onBeforeRender=()=>{};sheet.dispose();}for(const geometry of owned)geometry.dispose();sheets.length=0;owned.clear();levels.clear();group.clear();}
  return {group,update,dispose,sheets,snapshot,reflectionViews,setReflectionCropEnabled};
}
