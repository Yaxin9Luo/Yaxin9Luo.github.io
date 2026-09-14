const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

// Contemporary exhibition planting, in the existing four authored beds.
// Metres and original tree scale are retained; these are not surveyed historic trees.
export const yangquelongGardenLayout=freeze({
 id:'yangquelong-small-garden-composition-r1',
 evidence:'contemporary-authored-garden-in-existing-exhibition-bed-footprints',
 historicallySurveyed:false,historicalPlantingVerified:false,visualAcceptance:false,
 placements:[
  {id:'pine-west-north',bed:'west-north',position:[-12.55,.02,-13.0],yaw:Math.PI/2-.06,scale:1},
  {id:'pine-west-south',bed:'west-south',position:[-13.05,.02,13.2],yaw:-Math.PI/2+.05,scale:1},
  {id:'pine-east-north',bed:'east-north',position:[8.8,.02,-15.25],yaw:Math.PI/2+.035,scale:1},
  {id:'pine-east-south',bed:'east-south',position:[8.3,.02,14.8],yaw:-Math.PI/2-.05,scale:1},
 ],
 source:{pineId:'spreading-garden-pine-r4',pineMeshes:12,pineTriangles:37342804,
  pineBounds:{min:[-3.3998170397238856,-.18688172101974487,-2.563792023412943],max:[2.937463447502971,4.599488066691889,2.0048601219067876]},
  surfaceMeshes:211,surfaceTriangles:2597108,sourceArchitectureMeshes:207,sourceArchitectureTriangles:2596852,waters:9},
});

export const yangquelongGardenViews=freeze({
 garden:{label:'完整小庭园 · Complete contemporary garden',groups:[],direction:[-1,.45,.38],margin:1.06,framing:'complete-mesh-bounds'},
 gardenreverse:{label:'庭园反向全景 · Reverse complete garden',groups:[],direction:[-1,.52,-.28],margin:1.06,framing:'complete-mesh-bounds'},
});

export const yangquelongGardenCaptureProfile=freeze({
 assetId:'yangquelong-garden-r1',view:'garden',light:'day',review:'still',
 browserViewport:{width:1714,height:880},canvasCSS:{width:1408,height:880},
 native:{width:3520,height:2200,pixelRatio:2.5,aspect:1.6},fov:40,
 sourceQuality:'full original geometry, original 4K architecture/soil and 1K pine maps',
 geometryIsolation:[],crop:null,animationTime:0,
 lightingIntent:'Keep exposure 1 and existing reviewed direct PBR day materials. Frame first; inspect pale-stone separation and east-channel reflections before changing light.',
});
