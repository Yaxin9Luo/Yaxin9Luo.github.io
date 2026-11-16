/*! PaintSim recipes — the palette. Everything in this file is data; edit it, or add your own with PaintSim.define().

    A MATERIAL recipe (all fields optional; `base` inherits from another recipe):
      color, color2   the one or two tones loaded on the brush: hex, [r,g,b] 0–1, a pigment name, or a mix of them by parts,
                      {mix:{ultramarine:1,'cadmium yellow':2}} — mixed as pigments, so blue and yellow make green
      blend           how strongly the two tones streak across the bristles (0–1)
      opacity         cover of one pass (for a stain: its strength — it deepens by absorption, so two thin coats equal one full one)
      mode            'body' (opaque paint, the default) or 'stain' (transparent: darkens what is beneath)
      film            for stains: how much of a surface film it leaves (0 sinks in like watercolour, 1 like varnish)
      body            thickness of the paint film → relief
      ridges, grain   tone variation between bristle clumps / between single hairs
      level           0 keeps every bristle furrow (oil) … 1 flows out flat (enamel)
      gloss, sharp    strength of the highlight, and how tight it is (0 satin … 1 mirror)
      metal           0–1: reflects like metal, tinted by its own colour
      flake           {amount,hue,spread,chroma,size,sparkle,sheen,drift}: glitter and interference colour
      dry             how readily it breaks up on the tooth (dry brush)
      charge          how full the brush is loaded (1.15 normal; ~.55 for chalk that only dusts the tooth)
      reach           how far a loaded brush travels before running out (page units; 0 = never)
      open            how wet the laid paint stays (0 dries at once … 1 stays workable); surface.dry() dries everything
      water, flow     for water media: how much water a touch brings, and the share of its pigment that stays afloat in it.
                      Afloat pigment moves when time passes — surface.flow(t), surface.dry() — but only where it is wet
      merge           laid into wet paint, how far it melts into it (as pigment) instead of lying on top
      pickup          how much of the wet paint beneath is taken up per unit travelled and mixed, as pigment, into what the brush carries
      bury            how completely it hides the relief beneath (0 thin … 1 slab)
      rim, gran       stains only: darker drying edge; pigment settling into the tooth
      uneven, soft    for fill(): cloudiness of the layer; softness of its edge (body colour is brushed in along the fill's `angle`,
                      as streaky as `ridges` and as furrowed as `level` allows)
      cushion         {height,round}: fill() lays it on a raised bed (leaf on gesso)
      texture         weathering, a list of {mask…, effect…} applied in page space:
        mask: 'noise' {scale,amount,soft} · 'ridge' {scale,width} · 'cells' {scale,width} (craquelure)
              'speck' {scale,amount,size} · 'lines' {scale,length,angle} · 'grain' {scale} · 'tooth'
        effect where the mask is 1: color (+mix) · tone (multiply) · height · lip (raised edge) ·
              gloss / sharp / metal / flake (new value) · cover (0 = the paint is missing there)
        signed:true makes height/tone swing both ways around the mask's middle; invert:true flips the mask   */
(function(P){
'use strict';

/* A pigment is a colour, or {color, scatter, strength} where it matters for mixing:
     scatter   how opaque the pigment is, 0–1 (titanium white 1, a transparent lake about .1). An opaque pigment
               carries its own lightness into a mix; a transparent one only tints. Unset, it is guessed from how pale it is.
     strength  tinting strength: how far a little of it goes in a mix (1 is ordinary; prussian blue 2.5)             */
const pg=(color,scatter,strength)=>({color,scatter,strength});
Object.assign(P.pigments,{
  'titanium white':pg('#f6f3ea',1),'lead white':'#efe9d8','ivory black':'#1b1a1c','lamp black':pg('#0e0e10',undefined,1.5),"payne's grey":'#333d4d',
  'ultramarine':pg('#1c2f8c',.1),'cobalt blue':'#2456a8','cerulean':pg('#3b83b5',.45),'prussian blue':pg('#12284a',.08,2.5),'indigo':'#232a4a',
  'phthalo green':pg('#0d5a4c',.08,2),'viridian':pg('#2a7a62',.12),'sap green':'#55702e','terre verte':pg('#6f7f5a',.2,.5),
  'cadmium yellow':pg('#f2c21b',.6),'naples yellow':pg('#ecd79a',.8),'yellow ochre':pg('#c79a3a',.45),'raw sienna':'#b5722f','burnt sienna':'#8a3d1f','raw umber':'#6a5335','burnt umber':'#4d2f1e',
  'cadmium red':pg('#d2301f',.45),'vermilion':pg('#e2452a',.45),'alizarin crimson':pg('#8e1a2c',.08,1.3),'rose madder':pg('#c8506a',.12),'dioxazine violet':pg('#3f1f6b',.08,2.5),
  'gold':'#ffd47a','silver':'#eceae4','copper':'#f2a37f','bronze':'#d8a75e','iron':'#9a9da3'
});

const M=P.materials;

/* ---------------------------------------------------------------- media */
M['oil']={family:'oil',note:'thick and slow; holds every bristle mark; blends with what is wet beneath',
  color:'ultramarine',color2:'#4a6fd0',blend:.6,opacity:.96,body:1.15,ridges:.3,grain:.06,level:0,gloss:.32,sharp:.5,dry:.28,reach:320,open:.9,pickup:.025,merge:.2,bury:.75};
M['oil glaze']={base:'oil',note:'transparent colour in medium, floated over dry paint',
  color:'alizarin crimson',color2:null,mode:'stain',film:.8,opacity:.5,body:.12,ridges:.12,grain:.03,level:.7,gloss:.55,sharp:.65,rim:.1,gran:.05,dry:.05,reach:500,open:.6,pickup:0,bury:.1};
M['gouache']={family:'water',note:'opaque, velvety, dries flat',
  color:'vermilion',opacity:.94,body:.5,ridges:.12,grain:.03,level:.35,gloss:.05,sharp:.2,dry:.3,reach:240,open:.15,pickup:.012,water:.35,flow:.3,bury:.5};
M['watercolour']={family:'water',note:'a stain: pools at its edge and settles into the tooth',
  color:'viridian',mode:'stain',opacity:.45,body:0,ridges:.25,grain:.08,rim:.7,gran:.55,dry:.12,reach:340,open:.5,water:.9,flow:.8,uneven:.6,soft:1};
M['water']={note:'clean water: wet the paper with it, and what is laid there next will bleed',
  color:'#ffffff',mode:'stain',opacity:1,body:0,ridges:0,grain:0,rim:0,gran:0,gloss:0,dry:0,reach:0,open:0,water:1,flow:1,uneven:0,soft:1};
M['tempera']={family:'water',note:'egg tempera: thin, quick-drying, satin',
  color:'yellow ochre',opacity:.88,body:.28,ridges:.18,grain:.05,level:.2,gloss:.12,sharp:.3,dry:.22,reach:210,open:.05,bury:.4};
M['acrylic']={family:'water',note:'plastic body, satin; no blending once it is down',
  color:'cadmium yellow',opacity:.95,body:.7,ridges:.22,grain:.04,level:.45,gloss:.24,sharp:.45,dry:.3,reach:260,open:.05,bury:.6};
M['enamel']={family:'oil',note:'levels itself glass-smooth; high gloss',
  color:'#a3161c',opacity:.98,body:.45,ridges:.04,grain:.01,level:.95,gloss:.9,sharp:.9,dry:.04,reach:600,open:.7,pickup:.015,merge:.35,bury:.85};
M['varnish']={family:'oil',note:'clear glossy film, faintly yellow',
  color:'#fff6dc',mode:'stain',film:1,opacity:.9,body:.2,ridges:.03,level:.95,gloss:.85,sharp:.85,rim:0,gran:0,dry:.03,reach:600,bury:.6};
M['ink']={family:'ink',note:'carbon ink: dense, slightly glossy',
  color:'#15100e',opacity:.95,body:.16,ridges:.03,grain:.02,level:.6,gloss:.35,sharp:.6,dry:.12,reach:600,water:.5,flow:.5,bury:.3};
M['iron gall ink']={family:'ink',note:'brown-black; sinks in and pools where the pen pauses',
  color:'#3a2616',mode:'stain',film:.3,opacity:.86,body:.1,rim:.5,gran:.22,gloss:.25,sharp:.5,dry:.1,reach:500,water:.45,flow:.3};
M['pastel']={family:'dry',note:'powder held only by the tooth of the ground',
  color:'cerulean',opacity:.9,body:.14,ridges:.25,grain:.12,gloss:0,sharp:.1,dry:.95,charge:.6,open:.8,pickup:.03,merge:.35,bury:.1};
M['charcoal']={base:'pastel',note:'soft black, breaks on every ridge',color:'#1d1b1b',opacity:.85,dry:1.05,charge:.66,pickup:.04};
M['graphite']={family:'dry',note:'grey with a faint metallic sheen',
  color:'#55585d',opacity:.6,body:.05,ridges:.2,grain:.1,gloss:.35,sharp:.45,metal:.35,dry:.9,charge:.7,open:.5,pickup:.015,merge:.25,bury:.05};
M['limewash']={family:'wall',note:'chalky wall paint, cloudy',
  color:'#e6e0d0',opacity:.82,body:.3,ridges:.3,grain:.08,level:.2,gloss:0,dry:.4,reach:240,
  texture:[{mask:'noise',scale:26,amount:.45,soft:.2,tone:.9},{mask:'grain',scale:.9,signed:true,height:.25,tone:.96}]};
M['spray paint']={family:'wall',note:'thin, even, satin — made for the spray brushes',
  color:'#d4366a',opacity:.92,body:.08,ridges:0,grain:.02,level:.9,gloss:.3,sharp:.5,dry:0,reach:400,bury:.2};

/* ---------------------------------------------------------------- metal */
const burnish={mask:'lines',scale:.55,length:13,angle:1.45,signed:true,height:.3};
M['gold leaf']={family:'metal',note:'leaf on a raised gesso cushion: burnishing marks, hairline wrinkles, red bole where it has worn through',
  color:'gold',opacity:1,body:.25,ridges:.05,grain:.02,level:.9,gloss:.5,sharp:.7,metal:1,dry:.05,bury:1,soft:.3,uneven:.25,cushion:{height:3,round:2},
  texture:[burnish,{mask:'ridge',scale:13,width:.007,height:-.5,tone:.8},{mask:'noise',scale:6,amount:.025,soft:.03,color:'#75281a',metal:0,gloss:.1,height:-.5}]};
M['old gold']={base:'gold leaf',note:'gilding rubbed thin and dulled',sharp:.45,
  texture:[burnish,{mask:'ridge',scale:11,width:.01,height:-.5,tone:.75},{mask:'noise',scale:9,amount:.2,soft:.05,color:'#75281a',metal:0,gloss:.08,height:-.5},{mask:'noise',scale:60,amount:.5,soft:.3,tone:.82,seed:2}]};
M['silver leaf']={base:'gold leaf',note:'cooler and brighter; tarnishes brown-violet in patches',color:'silver',sharp:.8,
  texture:[burnish,{mask:'ridge',scale:13,width:.007,height:-.5,tone:.8},{mask:'noise',scale:30,amount:.3,soft:.15,color:'#5b4a44',mix:.65,metal:.55,sharp:.3}]};
M['copper leaf']={base:'gold leaf',note:'warm; verdigris beginning in specks',color:'copper',
  texture:[burnish,{mask:'ridge',scale:13,width:.007,height:-.5,tone:.8},{mask:'speck',scale:7,amount:.35,size:.32,color:'#4f9c8c',metal:0,gloss:0,height:.4}]};
M['shell gold']={family:'metal',note:'powdered gold in gum: a paint, so it shows the brush',
  color:'#f2c561',color2:'#c9993a',blend:.5,opacity:.95,body:.35,ridges:.25,grain:.06,level:.3,gloss:.4,sharp:.35,metal:.85,dry:.3,reach:200,bury:.6,
  flake:{amount:.35,hue:44,spread:.05,chroma:.5,size:.5,sparkle:1,sheen:0}};
M['bronze paint']={base:'shell gold',note:'',color:'bronze',color2:'#a57a3c',flake:{amount:.25,hue:36,spread:.05,chroma:.5,size:.5,sparkle:1,sheen:0}};
M['aluminium paint']={base:'shell gold',note:'',color:'#dcdfe2',color2:'#b4b8bd',sharp:.45,flake:{amount:.3,hue:210,spread:.1,chroma:.1,size:.5,sparkle:1,sheen:0}};
M['iron']={family:'metal',note:'dark brushed metal',
  color:'iron',opacity:1,body:.3,ridges:.08,grain:.03,level:.8,gloss:.4,sharp:.5,metal:.92,dry:.1,bury:.9,
  texture:[{mask:'lines',scale:.6,length:18,angle:.15,signed:true,height:.28,tone:.94}]};

/* ---------------------------------------------------------------- sparkle and interference */
M['iridescent teal']={family:'sparkle',note:'dark body full of interference flakes — beetle wing, magpie gloss',
  color:'#0d2a30',color2:'#123f52',blend:.7,opacity:.92,body:.4,ridges:.35,grain:.08,gloss:.3,sharp:.5,dry:.4,reach:200,bury:.5,
  flake:{amount:.95,hue:185,spread:.28,chroma:.75,size:.9,sparkle:1,sheen:.6}};
M['iridescent violet']={base:'iridescent teal',note:'',color:'#1c1233',color2:'#2a1c55',flake:{amount:.95,hue:275,spread:.28,chroma:.75,size:.9,sparkle:1,sheen:.6}};
M['pearl']={family:'sparkle',note:'white that turns colour as the light moves',
  color:'#c6c0b7',opacity:.95,body:.5,ridges:.1,grain:.02,level:.5,gloss:.5,sharp:.6,dry:.25,reach:260,bury:.6,
  flake:{amount:.8,hue:200,spread:.9,chroma:.55,size:.6,sparkle:.45,sheen:.75,drift:26}};
M['gold glitter']={family:'sparkle',note:'coarse flakes in a clear amber medium',
  color:'#8a6418',opacity:.9,body:.5,ridges:.1,level:.5,gloss:.4,sharp:.7,dry:.2,reach:300,bury:.5,
  flake:{amount:1,hue:44,spread:.06,chroma:.65,size:1.6,sparkle:1.5,sheen:.2}};
M['diamond dust']={family:'sparkle',note:'colourless: adds white sparkle to whatever is beneath',
  color:'#ffffff',mode:'stain',film:1,opacity:.9,body:.15,ridges:.05,level:.6,gloss:.4,sharp:.7,rim:0,gran:0,dry:.1,reach:400,bury:.1,
  flake:{amount:1,hue:0,spread:1,chroma:.1,size:1.4,sparkle:1.6,sheen:0}};
M['holographic']={family:'sparkle',note:'every flake a different colour',
  color:'#a9adb6',opacity:.95,body:.3,ridges:.05,level:.7,gloss:.5,sharp:.75,metal:.85,dry:.15,reach:300,bury:.6,
  flake:{amount:1,hue:0,spread:1,chroma:.9,size:1.2,sparkle:1.4,sheen:.55,drift:9}};
M['oil slick']={family:'sparkle',note:'black gloss with a thin-film rainbow and no glitter',
  color:'#0b0b0e',opacity:.97,body:.35,ridges:.03,level:.95,gloss:.9,sharp:.9,dry:.04,reach:600,bury:.8,
  flake:{amount:.85,hue:300,spread:2,chroma:.7,size:.5,sparkle:0,sheen:1.25,drift:38}};

/* ---------------------------------------------------------------- weathered, aged, wasteland */
M['rust']={family:'wasteland',note:'crusted iron oxide: dark scale, fresh orange bloom, pits',
  color:'#8a3c16',color2:'#b5541c',blend:.9,opacity:.95,body:.7,ridges:.3,grain:.12,gloss:.02,sharp:.1,dry:.5,reach:200,bury:.8,
  texture:[{mask:'noise',scale:34,amount:.45,soft:.12,color:'#4a1f10',mix:.85},{mask:'noise',scale:9,amount:.3,soft:.08,color:'#c9661f',mix:.8,seed:3},
    {mask:'grain',scale:.8,signed:true,height:.55,tone:.8},{mask:'speck',scale:6,amount:.1,size:.28,color:'#2a120a',height:-.6}]};
M['rusted steel']={family:'wasteland',note:'bare steel with rust breaking through',
  color:'#8f949b',opacity:1,body:.3,ridges:.06,level:.8,gloss:.4,sharp:.5,metal:.9,dry:.1,bury:.9,
  texture:[{mask:'lines',scale:.6,length:16,angle:.2,signed:true,height:.2},{mask:'noise',scale:28,amount:.5,soft:.05,color:'#7a3415',metal:0,gloss:0,height:.5},
    {mask:'noise',scale:7,amount:.3,soft:.1,color:'#b5561f',mix:.7,metal:0,seed:5},{mask:'grain',scale:.8,signed:true,height:.25}]};
M['verdigris']={family:'wasteland',note:'copper patina: chalky green, pale bloom, metal showing through',
  color:'#3f8f82',color2:'#69b3a0',blend:.8,opacity:.95,body:.5,ridges:.2,grain:.1,gloss:.02,sharp:.1,dry:.5,reach:200,bury:.7,
  texture:[{mask:'noise',scale:22,amount:.4,soft:.15,color:'#a9d6c5',mix:.8},{mask:'noise',scale:12,amount:.18,soft:.04,color:'#6b3a22',mix:.9,metal:.5,gloss:.3,height:-.4,seed:7},
    {mask:'grain',scale:.9,signed:true,height:.4,tone:.85}]};
M['chipped enamel']={base:'enamel',family:'wasteland',note:'old machine paint: chips, scratches, dulled by grime — put it over rust',
  color:'#3f8a8c',gloss:.6,sharp:.7,body:.6,
  texture:[{mask:'noise',scale:24,amount:.13,soft:.012,cover:0},{mask:'noise',scale:5,amount:.05,soft:.02,cover:0,seed:4},{mask:'ridge',scale:40,width:.006,cover:.1,seed:9},
    {mask:'noise',scale:60,amount:.5,soft:.3,tone:.85,gloss:.25,seed:1}]};
M['cracked oil']={base:'oil',family:'wasteland',note:'old oil paint: craquelure with cupped edges under yellowed varnish',
  color:'#b39a6c',color2:'#c9b182',gloss:.4,
  texture:[{mask:'cells',scale:11,width:.04,color:'#3a2a1c',mix:.85,height:-.9,lip:.5,gloss:.05},{mask:'noise',scale:70,amount:.5,soft:.3,tone:.86}]};
M['peeling paint']={family:'wasteland',note:'chalky paint curling off in plates',
  color:'#c9c4b2',opacity:.97,body:.9,ridges:.1,level:.6,gloss:.08,sharp:.2,dry:.2,reach:300,bury:.9,
  texture:[{mask:'cells',scale:20,width:.05,color:'#3a3128',height:-.8,lip:.9},{mask:'noise',scale:30,amount:.22,soft:.012,cover:0},{mask:'noise',scale:50,amount:.5,soft:.3,tone:.9,seed:2}]};
M['cracked earth']={family:'wasteland',note:'dried mud',
  color:'#9a7b55',color2:'#b39468',blend:.6,opacity:.97,body:1.3,ridges:.2,grain:.08,level:.5,gloss:0,dry:.4,reach:300,bury:.9,
  texture:[{mask:'cells',scale:24,width:.09,color:'#3d2c1c',height:-1.6,lip:.4},{mask:'cells',scale:7,width:.05,color:'#5a422b',mix:.6,height:-.5,seed:2},{mask:'grain',scale:1,signed:true,height:.3,tone:.9}]};
M['concrete']={family:'wasteland',note:'cast grey: pits, pale aggregate, hairline cracks',
  color:'#9b9a96',opacity:.97,body:.6,ridges:.15,grain:.08,level:.4,gloss:0,dry:.45,reach:300,bury:.8,
  texture:[{mask:'noise',scale:40,amount:.5,soft:.25,tone:.88},{mask:'speck',scale:4,amount:.5,size:.28,color:'#55534f',height:-.7},{mask:'speck',scale:9,amount:.3,size:.2,color:'#c9c7c0',seed:3},
    {mask:'ridge',scale:60,width:.004,color:'#3a3836',height:-.8,seed:5},{mask:'grain',scale:.8,signed:true,height:.35}]};
M['soot']={family:'wasteland',note:'a dry black stain; best sprayed or scrubbed on',
  color:'#2b2622',mode:'stain',film:.1,opacity:.5,body:0,ridges:.2,grain:.1,gloss:0,rim:0,gran:.35,dry:.3,uneven:.8,soft:3};
M['dust']={family:'wasteland',note:'pale powder that settles on everything',
  color:'#b7a98f',opacity:.5,body:.08,ridges:.2,grain:.15,gloss:0,sharp:.1,dry:.9,charge:.7,bury:.05};

/* ---------------------------------------------------------------- brushes
   shape 'round' (width follows pressure) | 'flat' (constant width) · width · profile (pressure curve)
   clump (width of a bristle clump, units) · streak / jit / body / reach / pickup / opacity (multiply the paint's own)
   charge (how full it is loaded) · varLen (length of the chatter along the stroke) · dry / level (added to the paint's own) · rag (ragged ends) · wobble · var (pressure tremor) · taper (0 = thick to the edge)
   edge (ridge pushed up at the sides) · gaps (missing bristles, fan brush) · nib (fixed pen angle)
   load (the furthest so lightly loaded a brush can go; paints that never run out — chalk, leaf — ignore it)
   kind:'spray' with density and drop:[min,max] throws droplets instead
   blend (0–1): a brush that carries no paint of its own; it picks up the wet paint it touches and lays it down again     */
const B=P.brushes;
B['round']={note:'pointed sable: swells and thins with pressure',shape:'round',width:14,profile:'leaf',clump:3,streak:1,wobble:.3,var:.1};
B['filbert']={note:'rounded flat: feather-shaped touches',shape:'round',width:20,profile:'feather',clump:2.6,streak:1.2,wobble:.3};
B['flat']={note:'flat hog bristle: square, streaky, ragged ends',shape:'flat',width:26,profile:'flat',clump:2.4,streak:1.5,rag:5,wobble:.4,var:.12,taper:.5,edge:.12};
B['mop']={note:'big soft wash brush',shape:'round',width:44,profile:'leaf',clump:5,streak:.5,wobble:.5};
B['liner']={note:'long thin rigger for hairs and hatching',shape:'round',width:2.2,profile:'hair',clump:3,streak:.5,wobble:.5,var:.3,reach:1.6};
B['dry']={note:'stiff brush, almost no paint: catches only the tooth',shape:'flat',width:26,profile:'flat',clump:2,streak:1.8,rag:8,dry:.5,load:170,charge:.85,wobble:.5};
B['fan']={note:'spread hairs with gaps between',shape:'flat',width:34,profile:'taper',clump:1.6,streak:1.6,gaps:.42,rag:6,dry:.2};
B['knife']={note:'palette knife: a flat slab with a raised edge that skips where it is dragged thin',shape:'flat',width:28,profile:'flat',clump:60,streak:.25,jit:.4,body:2.4,level:.85,taper:0,edge:.5,rag:3,dry:.35,vary:.13,varLen:24,bury:1};
B['pen']={note:'quill or dip pen',shape:'round',width:1.5,profile:'pen',clump:3,streak:.2,var:.35,wobble:.3,body:.5};
B['nib']={note:'broad calligraphy nib held at a fixed angle',shape:'flat',width:5,profile:'flat',nib:-.7,clump:3,streak:.2,var:.15,body:.5};
B['blender']={note:'a clean, soft, dry brush: it carries no paint, only pulls wet paint about and softens its edges',shape:'flat',width:26,profile:'taper',clump:2.5,blend:.7,wobble:.4,rag:6};
B['finger']={note:'a fingertip or paper stump, for smudging chalk and charcoal',shape:'round',width:11,profile:'feather',clump:4,blend:.9,pickup:.2,wobble:.3};
B['spray']={note:'airbrush / spray can: a soft cloud of fine droplets',kind:'spray',width:36,density:.78,drop:[.3,.8],profile:'full'};
B['spatter']={note:'flicked from a stiff brush: few, large drops',kind:'spray',width:60,density:.05,drop:[.6,3.2],profile:'full'};

/* ---------------------------------------------------------------- grounds
   kind 'vellum' | 'paper' | 'canvas' | 'panel' · color · tooth (how strongly the texture catches light and dry paint) · pitch (canvas thread spacing)
   cockle (how far the support is from flat: it moves the sheen of gloss and metal about; vellum .5, paper .4, canvas .2, panel .1) */
const G=P.grounds;
G['vellum']={kind:'vellum',color:'#ecdfbf',tooth:.13};
G['paper']={kind:'paper',color:'#f1ede2',tooth:.24};
G['canvas']={kind:'canvas',color:'#e9e3d3',tooth:.4,pitch:2.3};
G['panel']={kind:'panel',color:'#efebe0',tooth:.07};
G['toned panel']={base:'panel',color:'#d6cdba'};
G['toned canvas']={base:'canvas',color:'#9a8466'};
G['black paper']={base:'paper',color:'#1e1d1f',vary:.4};

/* ---------------------------------------------------------------- lighting set-ups
   surface.light('window') — or a recipe of your own. Besides the single values (relief, contrast, cavity, shadow, softbox, cockle,
   exposure, shoulder) a set-up may list up to four lamps:
     azimuth, elevation   where the lamp stands (0 right, 90 below, 180 left, 270 above) and how high
     strength, color      how much of the light it gives (all the lamps together about 1) and its tint
     ambient: true        light from everywhere: shows colour, no relief, no shine
     pool: {at, radius}   a lamp close by: bright at `at` (0–1 across and down the picture), falling off over `radius` (in widths)
   and a lens, for a close-up: lens: {focus: [x, y] (0–1), depth (widths that stay sharp), blur (units, at the far corner),
   vignette, contrast, grain}. render() applies it; flush() does not.   */
const L=P.lights;
L['raking']={note:'the default: one lamp low on the upper left, so every ridge shows'};
L['studio']={note:'two lamps at 45° either side, as on a copy stand: even, little shadow',
  lamps:[{azimuth:205,elevation:45,strength:.55},{azimuth:335,elevation:45,strength:.45}],contrast:.4,shadow:.1,softbox:.45,shoulder:.3};
L['flat']={note:'no direction at all, like a scanner: colour only',lamps:[{ambient:true}],softbox:0,cavity:.03};
L['window']={note:'cool daylight from a window on the left, warm room light filling in',
  lamps:[{azimuth:185,elevation:36,strength:.8,color:'#eef3ff'},{ambient:true,strength:.22,color:'#ffedd2'}],contrast:.45,shadow:.14,softbox:.55,shoulder:.3};
L['two lamps']={note:'a warm lamp from the upper left and a weaker cool one from the right',
  lamps:[{azimuth:215,elevation:28,strength:.72,color:'#ffe6c6'},{azimuth:20,elevation:40,strength:.33,color:'#d3e2ff'}],shoulder:.3};
L['gallery']={note:'a spotlight from above that leaves the corners darker',
  lamps:[{azimuth:270,elevation:48,strength:1.12,color:'#fff3df',pool:{at:[.5,.38],radius:.8}},{ambient:true,strength:.1}],softbox:.4,shoulder:.35};
L['candle']={note:'one small warm flame low at the lower left; the far side falls into dusk',
  lamps:[{azimuth:125,elevation:14,strength:1.25,color:'#ffbf78',pool:{at:[.2,.85],radius:.55}},{ambient:true,strength:.09,color:'#93a8ff'}],contrast:.65,shadow:.34,softbox:.2,shoulder:.45};
L['macro']={note:'a close-up lens on the default lamp: sharp in the middle, soft toward the edges, darker corners',
  lens:{focus:[.5,.5],depth:.3,blur:5,vignette:.35,contrast:.16,grain:1}};
})(PaintSim);

export {};
