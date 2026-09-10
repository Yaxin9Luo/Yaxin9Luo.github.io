// Authored Blender exports. Research source images are never runtime textures.
export const companionManifest=Object.freeze({
  elizabeth:Object.freeze({
    name:'Elizabeth',phase:'ready',url:'/models/companions/elizabeth.02e4aa775c59.glb',
    sha256:'02e4aa775c594be6a008fbdb0430b2e69c0160216da808d981b353cd9b4adb44',
    source:'/models/companions/elizabeth.blend',forward:[0,0,1],height:3,
    actions:['idle','walk','sign_raise','sign_hold','sign_lower'],
    durations:{idle:3,walk:1.2,sign_raise:.55,sign_hold:2.5,sign_lower:.5},
    walk:{stride:.64,duration:1.2,stance:.6},
    soles:[{name:'SoleL',bone:'FootL',phase:0,clearance:.008},{name:'SoleR',bone:'FootR',phase:.5,clearance:.008}],
    sign:{socket:'SignSocket',grip:'GripR',face:'SignFace',board:'SignBoard',staff:'SignStaff'},
  }),
  sadaharu:Object.freeze({
    name:'Sadaharu',phase:'ready',url:'/models/companions/sadaharu.f55e04dc95af.glb',
    sha256:'f55e04dc95af8b1ff29450b0b63953db30f2130a9af3681e7fcf8724cc7209a0',
    source:'/models/companions/sadaharu.blend',forward:[0,0,1],height:3.1,
    actions:['idle','walk','sit','stand','sniff','greet'],
    durations:{idle:3,walk:1.4,sit:1.25,stand:1.1,sniff:2.4,greet:2.6},
    walk:{stride:.76,duration:1.4,stance:.72},
    soles:[
      {name:'FrontSoleL',bone:'FrontFootL',phase:0,clearance:.018},
      {name:'HindSoleR',bone:'HindFootR',phase:.75,clearance:.018},
      {name:'FrontSoleR',bone:'FrontFootR',phase:.5,clearance:.018},
      {name:'HindSoleL',bone:'HindFootL',phase:.25,clearance:.018},
    ],
  }),
});

export const originalCompanionSign=Object.freeze({zh:'路过也欢迎。',en:'Just passing by? Welcome.'});
