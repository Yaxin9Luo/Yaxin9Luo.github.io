import * as THREE from 'three';

const glyphs = [
  [-.3,-.35,0,.35,.3,-.35],[-.3,0,.3,0],[0,-.4,0,.4],
  [-.3,-.3,.3,.3,-.3,.3,.3,-.3],[-.3,-.35,-.3,.35,.3,0,-.3,-.35],
];
export function createPortal(color='#b5d5c8') {
  const group=new THREE.Group();group.name='Runic portal';
  const uniforms={time:{value:0},tint:{value:new THREE.Color(color)}};
  const membrane=new THREE.Mesh(new THREE.PlaneGeometry(5.7,5.7),new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 v;void main(){v=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 v;uniform float time;uniform vec3 tint;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      void main(){float r=length(v);if(r>1.)discard;float a=atan(v.y,v.x);
        float cloud=n(v*4.+vec2(sin(a+time*.3),cos(a-time*.2))*1.5)+n(v*11.-time*.12)*.4;
        float spiral=pow(.5+.5*sin(a*3.-r*15.+time*1.5+cloud*3.),7.);
        float edge=exp(-pow((r-.91)*42.,2.));float inner=exp(-pow((r-.84)*87.,2.));
        float filaments=pow(.5+.5*sin(a*37.+cloud*4.+time),16.)*smoothstep(.7,.94,r);
        float core=(1.-smoothstep(.1,.87,r))*(.06+spiral*.12);
        float energy=edge*1.05+inner*.35+filaments*.5+core+spiral*.16;
        vec3 c=mix(tint,vec3(.9,1.,1.),clamp(edge*.7+inner*.3,0.,1.));
        gl_FragColor=vec4(c*energy*1.6,clamp(energy,0.,1.)*(1.-smoothstep(.97,1.,r)));
      }`}));
  const depth=new THREE.Mesh(new THREE.CircleGeometry(2.51,64),new THREE.MeshBasicMaterial({color:'#0a1823',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));depth.position.z=-.055;group.add(depth);group.add(membrane);
  const rune=new THREE.Group();group.add(rune);
  const lineMat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.9,toneMapped:false});
  for(let i=0;i<16;i++){
    const values=glyphs[i%glyphs.length],pts=[];for(let j=0;j<values.length;j+=2)pts.push(new THREE.Vector3(values[j]*.4,values[j+1]*.4,0));
    const glyph=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat);const a=i/16*Math.PI*2;
    glyph.position.set(Math.sin(a)*3.04,Math.cos(a)*3.04,.05);glyph.rotation.z=-a;rune.add(glyph);
  }
  const glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,toneMapped:false});
  const outer=new THREE.Mesh(new THREE.TorusGeometry(3.23,.013,4,128),glow);group.add(outer);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(2.85,.022,4,128),glow);group.add(inner);
  const count=100,positions=new Float32Array(count*3),phases=[];
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2;phases.push(a);positions[i*3]=Math.sin(a)*2.75;positions[i*3+1]=Math.cos(a)*2.75;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const particles=new THREE.Points(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{tint:uniforms.tint},vertexShader:'void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(42./-p.z,1.,5.);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 tint;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(tint*2.,pow(1.-d*2.,2.));}'}));group.add(particles);
  group.userData.update=(time,reduced=false)=>{
    uniforms.time.value=reduced?0:time;rune.rotation.z=reduced?0:-time*.07;outer.rotation.y=reduced?0:Math.sin(time*.2)*.025;
    if(reduced)return;for(let i=0;i<count;i++){const a=phases[i]+time*.3,r=2.75+Math.sin(i*7+time)*.1;positions[i*3]=Math.sin(a)*r;positions[i*3+1]=Math.cos(a)*r;positions[i*3+2]=Math.sin(i+time)*.12;}geometry.attributes.position.needsUpdate=true;
  };
  return group;
}

export function createShield() {
  const uniforms={time:{value:0},strength:{value:.65}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec3 n;varying vec3 eye;varying vec2 v;void main(){v=uv;vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:`varying vec3 n;varying vec3 eye;varying vec2 v;uniform float time;uniform float strength;
      void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.8);float meridian=pow(.5+.5*sin(v.x*100.+sin(v.y*45.)+time*.8),22.);float bands=pow(.5+.5*sin(v.y*90.-time*.7),22.);float energy=rim*.7+(meridian+bands)*.028+exp(-pow((v.y-fract(time*.14))*35.,2.))*.13;gl_FragColor=vec4(vec3(.25,.72,.91)*(1.+rim),energy*strength);}`});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(2.1,48,32),material);mesh.name='Protego membrane';
  mesh.userData.update=(time,reduced=false,strength=.65)=>{uniforms.time.value=reduced?0:time;uniforms.strength.value=strength;};return mesh;
}

/** Small, staged effects follow the actual action; they never cover the reader. */
export function createActionEffects() {
  const group=new THREE.Group();group.name='Action choreography';
  const focus=new THREE.Group();focus.visible=false;group.add(focus);
  const material=new THREE.MeshBasicMaterial({color:'#b6e5ee',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  for(const [radius,tilt]of [[.25,0],[.36,.65]]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.009,8,80),material);ring.rotation.x=tilt;focus.add(ring);
  }
  const core=new THREE.Mesh(new THREE.SphereGeometry(.06,20,12),material);focus.add(core);
  const bursts=Array.from({length:5},()=>{
    const mat=material.clone(),ring=new THREE.Mesh(new THREE.TorusGeometry(1,.013,8,96),mat);
    ring.visible=false;group.add(ring);return {ring,life:0,duration:1,size:1};
  });
  let charge=0,release=0,cursor=0,phase=0;
  return {group,
    charge(color){charge=1;release=0;material.color.set(color);focus.visible=true;},
    release(){charge=0;release=.18;},
    cancel(){charge=release=0;focus.visible=false;},
    burst(position,color,size=2.5,duration=.7,ground=false){const b=bursts[cursor++%bursts.length];b.life=b.duration=duration;b.size=size;b.ring.position.copy(position);b.ring.material.color.set(color);b.ring.rotation.set(ground?-Math.PI/2:0,0,0);b.ring.visible=true;},
    update(dt,time,wand,camera,reduced=false){
      const delta=Math.max(0,Math.min(dt||0,.1));
      phase+=delta;
      if(charge||release>0){
        if(wand)focus.position.copy(wand);if(camera)focus.quaternion.copy(camera.quaternion);
        release=Math.max(0,release-delta);material.opacity=charge ? .5 : release/.18*.7;
        focus.scale.setScalar(reduced ? .8 : charge ? (.85+.08*Math.sin(phase*12)) : 1.1+(1-release/.18)*.6);
        if(!reduced){focus.children[0].rotation.z=phase*1.8;focus.children[1].rotation.z=-phase*1.2;}
        focus.visible=Boolean(charge||release>0);
      }
      for(const b of bursts){if(b.life<=0)continue;b.life=Math.max(0,b.life-delta);const t=1-b.life/b.duration;b.ring.visible=b.life>0;b.ring.material.opacity=(1-t)*.62;b.ring.scale.setScalar(b.size*(reduced?.8:.35+.65*(1-(1-t)**3)));}
    },
  };
}
