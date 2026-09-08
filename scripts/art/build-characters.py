"""Reproducible anatomical, skinned academy characters. Blender 5.1 CLI.

The CC0 body supplies garment topology, not a prebuilt finished character.
The masks, hat, cloth, props, weights and actions are authored here.
Coordinates supplied to the art helpers are X right, Y up, Z back (Three.js).
"""
from pathlib import Path
from collections import defaultdict
import bpy, bmesh, math, random, json, sys, hashlib
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'world/public/models/characters'
QA = ROOT.parent / 'qa/academy-v2'
SOURCE = OUT / 'source/blender-studio-anatomy-cc0.blend'
UPSTREAM = ROOT.parent.parent / 'work/character-assets/human-base-meshes/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend'
QUICK = '--preview' in sys.argv
ONLY = next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--only=')), None)
NO_RENDER = '--no-render' in sys.argv
OUT.mkdir(parents=True, exist_ok=True); QA.mkdir(parents=True, exist_ok=True)
random.seed(187)
TAU = math.tau

def V(p): return Vector((p[0], -p[2], p[1]))
def P(p): return Vector((p.x, p.z, -p.y))
def S(p): return Vector((p[0]*1.4, (p[2]-.86)*1.4, p[1]*1.4))
def mix(a,b,t): return a*(1-t)+b*t
def clamp(x,a=0,b=1): return min(b,max(a,x))
def smoothstep(a,b,x):
    t=clamp((x-a)/(b-a)); return t*t*(3-2*t)

def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)

def pigment_weave(color):
    """Encode the linear palette and its quiet weave for an eight-bit sRGB image."""
    n=256;yy,xx=np.mgrid[0:n,0:n]
    grain=1+.023*np.sin(xx*TAU/4)*np.sin(yy*TAU/4)+.012*np.sin((xx+yy)*TAU/64)
    grain+=np.random.default_rng(79).normal(0,.004,(n,n))
    pixels=np.ones((n,n,4),dtype=np.float32)
    linear=np.clip(np.asarray(color)[None,None,:]*grain[:,:,None],0,1)
    # Non-float image.pixels stores encoded channel values. Passing these linear
    # values directly to a default sRGB image would decode the palette twice.
    pixels[:,:,:3]=np.where(linear<=.0031308,12.92*linear,1.055*np.power(linear,1/2.4)-.055)
    return pixels

def material(name, color, rough=.7, metal=0, cloth=False, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    bs.inputs['Specular IOR Level'].default_value=.3
    if cloth:
        # Original, low-contrast weave. No scanner noise obscuring the tailored planes.
        im=bpy.data.images.new(name+' authored weave',width=256,height=256,alpha=True)
        im.colorspace_settings.name='sRGB';im.pixels.foreach_set(pigment_weave(color).ravel());im.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=im
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        bs.inputs['Sheen Weight'].default_value=.025 if rough>.6 else .08
        bs.inputs['Sheen Roughness'].default_value=.6
        if cloth in ['wool','twill','satin']:
            # Tangent-space thread relief and roughness survive GLB export. These
            # are interlaced warp/weft fibers, not broad noise on the garment mesh.
            n=512;yy,xx=np.mgrid[0:n,0:n];period=8 if cloth=='wool' else 6.4
            warp=np.cos((xx/period%1-.5)*math.pi)**2
            weft=np.cos((yy/period%1-.5)*math.pi)**2
            cross=(np.floor(xx/period)+np.floor(yy/period))%4<2
            height=np.where(cross,warp,weft)
            dy,dx=np.gradient(height)
            strength=.40 if cloth=='wool' else .29 if cloth=='twill' else .13
            normal=np.dstack((-dx*strength,-dy*strength,np.ones_like(dx)))
            normal/=np.linalg.norm(normal,axis=2)[:,:,None]
            pixels=np.ones((n,n,4),dtype=np.float32);pixels[:,:,:3]=normal*.5+.5
            image=bpy.data.images.new(name+' woven normal',width=n,height=n,alpha=True)
            image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(pixels.ravel());image.pack()
            texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
            nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.36
            m.node_tree.links.new(texture.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
            pixels[:,:,:3]=np.clip(rough+.045*(.5-height),.12,.97)[:,:,None]
            image=bpy.data.images.new(name+' woven roughness',width=n,height=n,alpha=True)
            image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(pixels.ravel());image.pack()
            texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
            m.node_tree.links.new(texture.outputs['Color'],bs.inputs['Roughness'])
            bs.inputs['Sheen Weight'].default_value=.12 if cloth=='wool' else .055
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1)
        bs.inputs['Emission Strength'].default_value=emission
    return m

M={}
def materials():
    global M
    M={
      'coat':material('Academy midnight wool',(.052,.105,.175),.84,cloth='wool'),
      'edge':material('Tailored deep indigo facing',(.032,.061,.112),.76,cloth='twill'),
      'lining':material('Burgundy satin lining',(.22,.032,.048),.43,cloth='satin'),
      'scarf':material('Claret woven scarf',(.30,.052,.061),.73,cloth='wool'),
      'shirt':material('Warm ivory linen',(.64,.57,.43),.88,cloth=True),
      'pants':material('Graphite twill riding trousers',(.037,.054,.068),.9,cloth='twill'),
      'leather':material('Dark walnut riding leather',(.054,.030,.020),.48),
      'leatherEdge':material('Warm leather edge',(.15,.079,.034),.58),
      'sole':material('Boot sole',(.018,.023,.028),.88),
      'brass':material('Antique brass',(.48,.29,.094),.33,.75),
      'silver':material('Moonlit silver',(.54,.65,.71),.3,.76),
      'maskSilver':material('Rider brushed antique silver',(.38,.43,.46),.39,.68),
      'maskInset':material('Rider oxidized silver insets',(.087,.12,.145),.54,.57),
      'hat':material('Deep indigo wizard hat felt',(.017,.027,.052),.95,cloth=True),
      'hatEdge':material('Felt turned brim stitching',(.051,.068,.090),.9),
      'wood':material('Polished walnut broom',(.22,.094,.035),.45),
      'twig':material('Honey birch bristles',(.19,.09,.031),.81),
      'twigDark':material('Deep birch bristles',(.13,.063,.026),.86),
      'guardian':material('Guardian indigo wool',(.048,.087,.20),.82,cloth=True),
      'guardianSilk':material('Guardian moon blue satin',(.085,.17,.31),.51,cloth=True),
      'guardianInner':material('Guardian twilight lining',(.027,.041,.084),.74,cloth=True),
      'ivory':material('Carved ivory porcelain',(.69,.64,.49),.47),
      'void':material('Recessed mask darkness',(.001,.004,.009),.98),
      'spirit':material('Restrained glacial soul light',(.055,.35,.55),.28,emission=1.5),
    }

def mesh(name, verts, faces, mat, sub=0, uv=None, smooth=True):
    d=bpy.data.meshes.new(name); d.from_pydata([V(p) for p in verts],[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o)
    d.materials.append(mat)
    for poly in d.polygons: poly.use_smooth=smooth
    layer=d.uv_layers.new(name='UVMap')
    for poly in d.polygons:
        for li in poly.loop_indices:
            vi=d.loops[li].vertex_index
            layer.data[li].uv=uv[vi] if uv else (verts[vi][0]*3+verts[vi][2]*.3,verts[vi][1]*3)
    if sub:
        mod=o.modifiers.new('Designed surface subdivision','SUBSURF'); mod.levels=sub; mod.render_levels=sub
    return o

def curve(name, points, radius, mat, res=1):
    d=bpy.data.curves.new(name,'CURVE'); d.dimensions='3D'; d.resolution_u=2; d.bevel_depth=radius; d.bevel_resolution=res
    s=d.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for b,p in zip(s.bezier_points,points): b.co=V(p); b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); d.materials.append(mat); return o

def ellipsoid(name, pos, scale, mat, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=V(pos))
    o=bpy.context.object; o.name=name; o.scale=(scale[0],scale[2],scale[1]); o.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return o

def rounded_box(name, pos, scale, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos)); o=bpy.context.object; o.name=name
    o.scale=(scale[0],scale[2],scale[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    b=o.modifiers.new('Soft sewn edges','BEVEL'); b.width=bevel; b.segments=3
    n=o.modifiers.new('Weighted planes','WEIGHTED_NORMAL'); n.keep_sharp=True
    return o

def loft(name, rings, mat, sides=24, sub=1, caps=True):
    verts=[]
    for cx,cy,cz,rx,rz in rings:
        for i in range(sides):
            a=i/sides*TAU; verts.append((cx+rx*math.sin(a),cy,cz-rz*math.cos(a)))
    faces=[]
    for j in range(len(rings)-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    if caps:faces += [tuple(range(sides-1,-1,-1)),tuple((len(rings)-1)*sides+i for i in range(sides))]
    return mesh(name,verts,faces,mat,sub)

def swept_lobe(name, points, widths, depths, mat, sides=12, sub=1):
    """Tapered sculptural volume, used for hair/wood rather than the human body."""
    pts=[Vector(p) for p in points]; verts=[]
    for j,p in enumerate(pts):
        t=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
        ref=Vector((0,1,0))
        if abs(t.dot(ref))>.9:ref=Vector((1,0,0))
        x=t.cross(ref).normalized(); y=t.cross(x).normalized()
        for i in range(sides):
            a=i/sides*TAU; groove=1+.045*math.cos(a*4+j*.3)
            verts.append(tuple(p+x*widths[j]*math.cos(a)*groove+y*depths[j]*math.sin(a)))
    faces=[]
    for j in range(len(pts)-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    faces += [tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+i for i in range(sides))]
    return mesh(name,verts,faces,mat,sub)

def finish(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    if o.type=='CURVE': bpy.ops.object.convert(target='MESH')
    for mod in list(o.modifiers):
        if mod.type!='ARMATURE': bpy.ops.object.modifier_apply(modifier=mod.name)
    if o.type=='MESH':
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
    return o

class Rig:
    def __init__(self,name):
        self.name=name; self.bones={}; self.source={}; self.transforms={}; self.obj=None
    def bone(self,name,head,tail,parent=None,source=None,deform=True):
        self.bones[name]=(Vector(head),Vector(tail),parent,deform)
        if source:self.source[name]=(S(source[0]),S(source[1]))
    def build(self):
        data=bpy.data.armatures.new(self.name); o=bpy.data.objects.new(self.name,data); bpy.context.collection.objects.link(o)
        bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
        for name,(head,tail,parent,deform) in self.bones.items():
            b=data.edit_bones.new(name); b.head=V(head); b.tail=V(tail); b.use_deform=deform
            if parent:b.parent=data.edit_bones[parent]
        bpy.ops.object.mode_set(mode='OBJECT'); self.obj=o
        for name,(a,b) in self.source.items():
            h,t,_,_=self.bones[name]
            va,vb,vt,vh=V(a),V(b),V(t),V(h)
            q=(vb-va).rotation_difference(vt-vh)
            # Length correction along the source bone, radial anatomy unchanged.
            u=(vb-va).normalized(); length=(vt-vh).length/(vb-va).length
            stretch=Matrix.Identity(3)+(length-1)*Matrix([[u[i]*u[j] for j in range(3)] for i in range(3)])
            self.transforms[name]=Matrix.Translation(vh)@q.to_matrix().to_4x4()@stretch.to_4x4()@Matrix.Translation(-va)
        return self
    def source_point(self,p,weights):
        source=V(S(p)); result=Vector((0,0,0))
        for name,w in weights.items():result+=(self.transforms[name]@source)*w
        return P(result)
    def bind(self,o,weights):
        finish(o)
        if callable(weights):
            weights=[weights(P(v.co)) for v in o.data.vertices]
        elif isinstance(weights,str):weights=[{weights:1} for _ in o.data.vertices]
        elif isinstance(weights,dict):weights=[weights for _ in o.data.vertices]
        names={n for row in weights for n in row}
        groups={n:o.vertex_groups.new(name=n) for n in names}
        for i,row in enumerate(weights):
            total=sum(row.values())
            for n,w in row.items():
                if w>0.00001:groups[n].add([i],w/total,'REPLACE')
        mod=o.modifiers.new('Academy skeletal deformation','ARMATURE'); mod.object=self.obj
        o.parent=self.obj
        return o
    def anchor(self,name,p,bone):
        o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
        o.parent=self.obj; o.parent_type='BONE'; o.parent_bone=bone
        bpy.context.view_layer.update(); o.matrix_world=Matrix.Translation(V(p)); return o

def adult_weights(p):
    x,y,z=p; side='L' if x<0 else 'R'; ax=abs(x)
    if z>1.43:return {'head':1}
    if z>1.36 and ax<.105:
        t=smoothstep(1.365,1.455,z); return {'neck':1-t,'head':t}
    if (ax>.185 and z>.84) or (ax>.152 and z>1.25):
        if z>1.245:
            t=smoothstep(.145,.215,ax); return {'chest':1-t,'upper.'+side:t}
        t=smoothstep(1.035,1.145,z)
        return {'upper.'+side:t,'fore.'+side:1-t}
    if z>.835:
        if z>1.24:
            t=smoothstep(1.31,1.40,z);return {'chest':1-t,'neck':t}
        if z>1.05:
            t=smoothstep(1.075,1.225,z);return {'spine':1-t,'chest':t}
        t=smoothstep(.94,1.065,z);return {'pelvis':1-t,'spine':t}
    if z>.72:
        t=smoothstep(.735,.855,z);return {'pelvis':t,'thigh.'+side:1-t}
    if z>.36:
        t=smoothstep(.38,.50,z);return {'thigh.'+side:t,'calf.'+side:1-t}
    if z>.12:return {'calf.'+side:1}
    return {'foot.'+side:1}

def rider_rig():
    r=Rig('AcademyRiderRig')
    r.bone('root',(0,0,0),(0,.18,0),None)
    r.bone('pelvis',(0,.075,.06),(0,.30,-.035),'root',((0,0,.86),(0,0,1.03)))
    r.bone('spine',(0,.30,-.035),(0,.55,-.18),'pelvis',((0,0,1.03),(0,.005,1.22)))
    r.bone('chest',(0,.55,-.18),(0,.79,-.305),'spine',((0,.005,1.22),(0,-.015,1.40)))
    r.bone('neck',(0,.79,-.305),(0,.885,-.34),'chest',((0,-.015,1.40),(0,-.04,1.48)))
    r.bone('head',(0,.885,-.34),(0,1.15,-.34),'neck',((0,-.04,1.48),(0,-.04,1.67)))
    joints={
      'L':((- .255,.665,-.23),(-.305,.415,-.475),(-.055,.19,-.83),(-.04,.12,-.86),(-.135,.045,.065),(-.29,-.245,-.425),(-.27,-.735,-.10),(-.285,-.845,-.305)),
      'R':((.255,.665,-.205),(.385,.40,-.36),(.325,.29,-.71),(.31,.255,-.78),(.135,.045,.065),(.32,-.16,-.42),(.335,-.66,.075),(.35,-.765,-.13)),
    }
    for side,j in joints.items():
        s=-1 if side=='L' else 1; sh,el,wr,hand,hip,knee,ankle,toe=j
        r.bone('clavicle.'+side,(0,.642,-.222),sh,'chest',((0,0,1.315),(s*.175,0,1.32)))
        r.bone('upper.'+side,sh,el,'clavicle.'+side,((s*.175,0,1.32),(s*.29,-.005,1.08)))
        r.bone('fore.'+side,el,wr,'upper.'+side,((s*.29,-.005,1.08),(s*.365,-.045,.89)))
        # Root-parented grip targets let the animated chest lean while IK keeps contact.
        r.bone('hand.'+side,wr,hand,'root')
        r.bone('thigh.'+side,hip,knee,'pelvis',((s*.10,.005,.84),(s*.145,.025,.45)))
        r.bone('calf.'+side,knee,ankle,'thigh.'+side,((s*.145,.025,.45),(s*.204,.033,.09)))
        r.bone('foot.'+side,ankle,toe,'calf.'+side,((s*.204,.033,.09),(s*.23,-.11,.022)))
    r.bone('broom',(0,-.08,.08),(0,-.18,1.5),'root')
    for side,q in [('L',-1),('C',0),('R',1)]:
        for j in range(4):
            h=cape_point((q+1)/2,j/4); t=cape_point((q+1)/2,(j+1)/4)
            r.bone('cape.'+side+str(j),h,t,'chest' if j==0 else 'cape.'+side+str(j-1))
    for j in range(4):r.bone('scarf.'+str(j),scarf_point(.5,j/4),scarf_point(.5,(j+1)/4),'chest' if j==0 else 'scarf.'+str(j-1))
    for side in ['L','R']:
        s=-1 if side=='L' else 1
        for j in range(3):r.bone('tail.'+side+str(j),tail_point(s,.5,j/3),tail_point(s,.5,(j+1)/3),'pelvis' if j==0 else 'tail.'+side+str(j-1))
    r.build()
    for side in ['L','R']:
        con=r.obj.pose.bones['fore.'+side].constraints.new('IK');con.name='Stable broom grip' if side=='L' else 'Wand wrist follows hand'
        con.target=r.obj;con.subtarget='hand.'+side;con.chain_count=2;con.use_stretch=False
    return r

def source_body():
    if not SOURCE.exists():
        if not UPSTREAM.exists():raise FileNotFoundError('Missing retained anatomy source and upstream bundle')
        with bpy.data.libraries.load(str(UPSTREAM)) as (_,data):data.objects=['GEO-body_male_realistic','GEO-body_male_realistic.eye.L','GEO-body_male_realistic.eye.R']
        body=data.objects[0]
        for o in data.objects:
            for mod in list(o.modifiers):o.modifiers.remove(mod)
        SOURCE.parent.mkdir(parents=True,exist_ok=True);bpy.data.libraries.write(str(SOURCE),set(data.objects),fake_user=True,compress=True)
        for o in data.objects:bpy.data.objects.remove(o,do_unlink=True)
    with bpy.data.libraries.load(str(SOURCE)) as (_,data):data.objects=['GEO-body_male_realistic','GEO-body_male_realistic.eye.L','GEO-body_male_realistic.eye.R']
    for o in data.objects:bpy.context.collection.objects.link(o)
    body=data.objects[0];body.location=(0,0,0);bpy.context.view_layer.update()
    return data.objects

def anatomy_piece(name,source,rig,keep,mat,inflate=0,sub=1,kind='coat',cut_high=None):
    """Select garment topology from anatomy before shaping/posing, no limb tubes."""
    original=[v.co.copy() for v in source.data.vertices]
    faces=[tuple(p.vertices) for p in source.data.polygons if keep(p,original)]
    if cut_high is not None:
        temp=bpy.data.meshes.new('Garment pattern cutting');temp.from_pydata(original,[],faces);temp.update()
        bm=bmesh.new();bm.from_mesh(temp)
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,cut_high),plane_no=(0,0,1),clear_outer=True,clear_inner=False)
        bm.to_mesh(temp);bm.free()
        original=[v.co.copy() for v in temp.vertices];normals=[v.normal.copy() for v in temp.vertices]
        faces=[tuple(p.vertices) for p in temp.polygons]
    else:normals=[v.normal.copy() for v in source.data.vertices]
    used=sorted({i for f in faces for i in f});remap={i:j for j,i in enumerate(used)}
    source_points=[];weights=[]
    for i in used:
        co=original[i].copy();normal=normals[i]
        amount=inflate
        if kind=='coat' and abs(co.x)<.18:
            amount+=.008*math.exp(-((co.z-1.18)/.18)**2)+.004*math.exp(-((co.z-1.34)/.055)**2)
        elif kind=='coat':amount+=.004*math.exp(-((co.z-1.07)/.08)**2)
        co+=normal*amount
        w=adult_weights(original[i]);source_points.append(co);weights.append(w)
    verts=[rig.source_point(co,w) for co,w in zip(source_points,weights)]
    obj=mesh(name,verts,[tuple(remap[i] for i in f) for f in faces],mat,0)
    for attr in list(obj.data.attributes):
        if attr.name.startswith('.sculpt'):obj.data.attributes.remove(attr)
    # Assign weights before subdivision so Blender interpolates the actual topology.
    rig.bind(obj,weights)
    if sub:
        mod=obj.modifiers.new('Anatomical garment finish','SUBSURF');mod.levels=sub;mod.render_levels=sub
        # Apply subdivision above the live armature.
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if cut_high is not None:bpy.data.meshes.remove(temp)
    return obj


def sculpt_garment(obj,rig,kind):
    """Sculpt tapered ridge/valley strokes at specific loaded cloth regions.

    Curves are projected onto the posed anatomical surface. The broad panels
    between elbows, knees, seams and belt remain untouched and carry tension.
    """
    vertices=[v.co.copy() for v in obj.data.vertices]
    faces=[tuple(p.vertices) for p in obj.data.polygons]
    xyz=np.asarray([tuple(P(p)) for p in vertices],dtype=float)
    normals=np.asarray([tuple(P(v.normal)) for v in obj.data.vertices],dtype=float)
    groups=[{obj.vertex_groups[g.group].name:g.weight for g in v.groups} for v in obj.data.vertices]
    masks={}
    for side in ['L','R']:
        names=['upper.'+side,'fore.'+side] if kind=='coat' else ['thigh.'+side,'calf.'+side]
        masks[side]=np.asarray([sum(w.get(name,0) for name in names) for w in groups])
    masks['torso']=np.clip(1-masks['L']-masks['R'],0,1)
    trees={name:BVHTree.FromPolygons(vertices,[f for f in faces if max(mask[i] for i in f)>.25]) for name,mask in masks.items()}
    displacement=np.zeros(len(vertices));strokes=[];region='torso'
    def stroke(points,width,amplitude):
        projected=[];directions=[];tree=trees[region]
        def keep_segment():
            if len(projected)<6:return
            length=sum(float(np.linalg.norm(b-a)) for a,b in zip(projected,projected[1:]))
            strength=amplitude*min(1,length/(width*6))
            strokes.append((projected.copy(),directions.copy(),width,strength,region))
        for p in points:
            hit=tree.find_nearest(V(p))
            if hit and hit[0] is not None:
                q=np.asarray(P(hit[0]));normal=np.asarray(P(hit[1]))
                # Nearest-point projection can jump across a bent elbow/knee or
                # from chest to back. Never sculpt a bridge through that gap.
                if projected and (np.linalg.norm(q-projected[-1])>.030 or normal@directions[-1]<.75):
                    keep_segment();projected.clear();directions.clear()
                projected.append(q);directions.append(normal)
        keep_segment()
    def bezier(points,width,amplitude):
        a,b,c,d=map(Vector,points)
        stroke([a*(1-t)**3+b*3*t*(1-t)**2+c*3*t*t*(1-t)+d*t**3 for t in np.linspace(0,1,33)],width,amplitude)
    def arc(center,axis,normal,radius,offset,width,amplitude,spread=1.42,skew=0):
        normal=(normal-axis*axis.dot(normal)).normalized();across=axis.cross(normal).normalized()
        stroke([center+axis*(offset+.018*(1-math.cos(a))+skew*math.sin(a))+radius*(normal*math.cos(a)+across*math.sin(a)) for a in np.linspace(-spread,spread,37)],width,amplitude)
    for side,s in [('L',-1),('R',1)]:
        region=side
        if kind=='coat':
            shoulder,elbow=rig.bones['upper.'+side][:2];wrist=rig.bones['fore.'+side][1]
            axis=(wrist-elbow).normalized();inner=((shoulder-elbow).normalized()+axis).normalized()
            for offset,width,amplitude,skew in [(0.018,.023,.015,.020),(.081,.025,.014,-.020),(.141,.023,.009,.025)]:
                arc(elbow,axis,inner,.102,offset,width,amplitude,1.48,skew*s)
            for offset,amplitude in [(-.044,.012),(-.082,.008)]:
                arc(wrist,axis,-inner,.069,offset,.012,amplitude,1.45,-.012*s)
            outer=-inner
            for shift in [-.032,.040]:
                points=[mix(shoulder,elbow,.36)+outer*.089+Vector((0,0,shift)),mix(shoulder,elbow,.67)+outer*.101,
                        elbow+outer*.107+Vector((0,0,shift*.4)),mix(elbow,wrist,.39)+outer*.080]
                bezier(points,.024,.010)
            region='torso'
            bezier([(s*.247,.634,-.328),(s*.211,.535,-.400),(s*.155,.427,-.369),(s*.111,.338,-.340)],.020,.016)
            bezier([(s*.235,.536,-.279),(s*.192,.439,-.333),(s*.191,.315,-.283),(s*.199,.222,-.216)],.018,.015)
            for level,amp in [(.275,.015),(.323,.014),(.368,.010)]:
                bezier([(s*.066,level-.018,-.356),(s*.115,level+.008,-.35),(s*.164,level+.029,-.307),(s*.22,level+.037,-.231)],.015,amp)
            bezier([(s*.198,.618,-.086),(s*.128,.505,.069),(s*.139,.341,.109),(s*.166,.236,.108)],.027,.012)
        else:
            hip,knee=rig.bones['thigh.'+side][:2];ankle=rig.bones['calf.'+side][1]
            axis=(ankle-knee).normalized();front=Vector((0,0,-1))
            for offset,width,amplitude,skew in [(-.035,.015,.014,.013),(.036,.014,.021,-.015),(.099,.016,.014,.019)]:
                arc(knee,axis,front,.109,offset,width,amplitude,1.62,skew*s)
            inner=((hip-knee).normalized()+axis).normalized()
            for offset in [-.018,.049]:arc(knee,axis,inner,.11,offset,.015,.016,1.4,.015*s)
            thigh=(knee-hip).normalized()
            for offset in [.070,.130]:arc(hip,thigh,Vector((-s,0,-.45)),.119,offset,.018,.014,1.27,.018*s)
    for points,directions,width,amplitude,region in strokes:
        distance=np.full(len(vertices),100.0);along=np.zeros(len(vertices));direction=np.zeros_like(xyz)
        count=len(points)-1
        for index,(a,b) in enumerate(zip(points,points[1:])):
            ab=b-a;length=ab@ab
            if length<1e-10:continue
            t=np.clip(np.sum((xyz-a)*ab,axis=1)/length,0,1)
            delta=xyz-(a+t[:,None]*ab);d=np.sum(delta*delta,axis=1)
            choose=d<distance;distance[choose]=d[choose];along[choose]=(index+t[choose])/count
            direction[choose]=directions[index]*(1-t[choose,None])+directions[index+1]*t[choose,None]
        taper=np.maximum(0,np.sin(along*math.pi))**.55
        # A soft crest and its two shallow troughs form the cloth fold.
        profile=np.exp(-distance/(width*.53)**2)-.32*np.exp(-distance/width**2)
        alignment=np.clip((np.sum(normals*direction,axis=1)-.25)/.75,0,1)
        displacement+=amplitude*taper*profile*alignment*masks[region]
    displacement=np.clip(displacement,-.017,.045)
    for vertex,p,n,d in zip(obj.data.vertices,xyz,normals,displacement):vertex.co=V(p+n*d)
    obj.data.update()
    print('SCULPTED_GARMENT',kind,'strokes',len(strokes),'peak',float(np.max(np.abs(displacement))))


def torso_weights(p):
    t=smoothstep(.25,.62,p.y)
    return {'spine':1-t,'chest':t}

def rider_tailoring(source,r):
    sets=source.data.attributes.get('.sculpt_face_set')
    coatsets={1,18,19,20,21,11,12}
    coat=anatomy_piece('Anatomically tailored coat and sleeves',source,r,
      lambda f,v:sets.data[f.index].value in coatsets and all(v[i].z>.845 for i in f.vertices),M['coat'],.013,2,cut_high=1.402)
    pants=anatomy_piece('Anatomical seated riding trousers',source,r,
      lambda f,v:all(.255<v[i].z<1.004 and abs(v[i].x)<.26 for i in f.vertices),M['pants'],.010,2,'pants')
    sculpt_garment(coat,r,'coat');sculpt_garment(pants,r,'pants')
    # Fitted front V and folded lapels, sampled on the anatomy rather than a hard collar ring.
    bpy.context.view_layer.update();body_surface=BVHTree.FromObject(source,bpy.context.evaluated_depsgraph_get())
    def front(x,z,offset=.028):
        hit=body_surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)[0]
        return Vector((x,hit.y-offset if hit else -.15,z))
    rows=18;cols=8;vv=[];ff=[];weights=[]
    for j in range(rows+1):
        t=j/rows;z=.966+t*.371;width=.032+.051*t
        for i in range(cols+1):
            p=front((i/cols*2-1)*width,z,.032);w=adult_weights(p);vv.append(r.source_point(p,w));weights.append(w)
    for j in range(rows):
        for i in range(cols):k=j*(cols+1)+i;ff.append((k,k+1,k+cols+2,k+cols+1))
    waistcoat=mesh('Fitted claret waistcoat',vv,ff,M['lining']);r.bind(waistcoat,weights)
    for side in [-1,1]:
        vv=[];ff=[];ww=[];edge=[]
        for j in range(15):
            t=j/14;z=1.342-.275*t;inner=.045*(1-t)+.014*t;outer=.123*(1-t)+.038*t
            for i in range(5):
                p=front(side*mix(inner,outer,i/4),z,.043+.006*math.sin(i/4*math.pi));w=adult_weights(p);vv.append(r.source_point(p,w));ww.append(w)
            edge.append(vv[-5])
        for j in range(14):
            for i in range(4):k=j*5+i;ff.append((k,k+1,k+6,k+5))
        o=mesh('Soft rolled lapel '+str(side),vv,ff,M['edge']);r.bind(o,ww)
        r.bind(curve('Lapel understated piping '+str(side),edge,.0017,M['brass']),torso_weights)
    for z in [1.004,1.085,1.164,1.239]:
        p=front(0,z,.045);q=r.source_point(p,adult_weights(p));r.bind(ellipsoid('Antique waistcoat button',q,(.010,.010,.005),M['brass'],12,6),adult_weights(p))
    # Quiet seam lines and belt make the torso fitted without surface noise.
    for side in [-1,1]:
        pts=[r.source_point(front(side*x,z,.033),adult_weights((side*x,0,z))) for x,z in [(.108,1.31),(.105,1.22),(.092,1.12),(.104,1.015)]]
        r.bind(curve('Tailored princess seam '+str(side),pts,.0017,M['edge']),torso_weights)
    belt=loft('Waist riding belt',[(0,.169,.011,.221,.158),(0,.199,-.003,.216,.156),(0,.234,-.022,.208,.152)],M['leather'],32,0)
    r.bind(belt,'pelvis')
    r.bind(curve('Belt brass buckle',[(-.033,.166,-.160),(.033,.166,-.160),(.033,.218,-.184),(-.033,.218,-.184),(-.033,.166,-.160)],.005,M['brass']),'pelvis')
    # The scarf is tucked into the standing collar. Its compact lower fold turns
    # under itself instead of spreading into a thin bib across the shoulders.
    vv=[];ff=[];cols=32
    profile=[(.087,.079,.883,-.337),(.105,.088,.861,-.328),(.124,.098,.810,-.311),
             (.143,.112,.788,-.308),(.145,.114,.775,-.309),(.141,.110,.768,-.309),
             (.131,.103,.778,-.308)]
    for radius,depth,y,z in profile:
        for i in range(cols):
            a=i/cols*TAU
            vv.append((radius*math.sin(a),y+.006*math.sin(a+.35),z-depth*math.cos(a)))
    for j in range(len(profile)-1):
        for i in range(cols):ff.append((j*cols+i,j*cols+(i+1)%cols,(j+1)*cols+(i+1)%cols,(j+1)*cols+i))
    cowl=mesh('Draped claret scarf cowl',vv,ff,M['scarf'],1)
    cowl.data.materials.append(M['lining'])
    thick=cowl.modifiers.new('Scarf cowl sewn thickness','SOLIDIFY');thick.thickness=.010;thick.offset=0
    thick.material_offset=1;thick.material_offset_rim=1;r.bind(cowl,'chest')
    for side in [-1,1]:
        p=(side*.20,.675,-.318)
        r.bind(ellipsoid('Cape shoulder brooch '+str(side),p,(.021,.022,.008),M['brass'],16,8),'chest')
    r.bind(curve('Draped cape clasp',[(-.20,.672,-.330),(-.12,.61,-.357),(0,.585,-.379),(.12,.611,-.357),(.20,.672,-.330)],.0025,M['brass']),'chest')

def cape_point(u,t):
    q=u*2-1;width=.295+.38*math.sin(t*math.pi*.86)+.025*t
    x=q*width+.045*t*t
    y=.70-.36*t-.40*t**3+.16*math.sin(t*math.pi)+.075*q*t
    z=-.105+1.55*t+.06*math.sin(t*math.pi)-.10*q*q*(1-t)
    # Cloth hangs between the shoulder fastenings before the wind lifts it.
    y-=.060*(1-q*q)*math.exp(-((t-.15)/.11)**2)
    # Four long folds spread from the shoulders; open panels stay taut between them.
    for centre,drift,amplitude,width in [(-.72,.08,.055,.15),(-.24,-.04,-.067,.20),(.24,.09,.073,.18),(.73,-.06,-.040,.13)]:
        fold=amplitude*math.exp(-((q-centre-drift*t)/width)**2)*math.sin(t*math.pi)**.72
        y+=fold;z+=fold*.38
    # The rear and side hems turn over gradually, revealing the heavy lining.
    roll=smoothstep(.86,.98,t)
    y+=.066*roll*(.8+.2*q)-.022*smoothstep(.985,1,t)
    z-=.043*roll*roll
    y+=.022*math.exp(-((abs(q)-.965)/.027)**2)*math.sin(t*math.pi)
    return Vector((x,y,z))

def scarf_point(u,t):
    return Vector((.107+.20*t+.11*math.sin(t*4)*t+(u-.5)*(.125-.035*t),.812-.16*t+.19*math.sin(t*math.pi)-.018*math.cos(u*TAU)*t,-.24+1.25*t+.025*math.cos(u*TAU+t*4)))

def tail_point(side,u,t):
    x=side*(.12+.18*t)+(u-.5)*(.24+.18*math.sin(t*math.pi))
    y=.145-.64*t+.09*math.sin(t*math.pi)+side*.052*t
    z=.145+1.04*t
    for centre,amp in [(.18,.041),(.49,-.034),(.80,.037)]:
        fold=amp*math.exp(-((u-centre-.025*side*t)/.10)**2)*math.sin(t*math.pi)**.6
        z+=fold;y+=fold*.35
    y+=.045*smoothstep(.86,.97,t)-.016*smoothstep(.98,1,t)
    z-=.028*smoothstep(.88,1,t)
    return Vector((x,y,z))

def chain_weights(t,prefix,count):
    f=clamp(t*count-.35,0,count-1);i=int(f);j=min(i+1,count-1);v=f-i
    return {prefix+str(i):1-v,prefix+str(j):v} if i!=j else {prefix+str(i):1}

def cape_weights(p,u=None,t=None):
    if t is None:t=clamp((p.z+.21)/1.48)
    if u is None:u=clamp((p.x-.06*t*t)/(.32+.315*math.sin(t*math.pi*.81))/2+.5)
    if u<.5:a,b,f='L','C',u*2
    else:a,b,f='C','R',(u-.5)*2
    result=defaultdict(float)
    for key,weight in chain_weights(t,'cape.'+a,4).items():result[key]+=weight*(1-f)
    for key,weight in chain_weights(t,'cape.'+b,4).items():result[key]+=weight*f
    return dict(result)

def cloth_surface(name,point,rows,cols,mat,rig,weight,lining=None,thickness=.007):
    vv=[];ww=[];uv=[]
    for j in range(rows+1):
        for i in range(cols+1):
            u=i/cols;t=j/rows;p=point(u,t);vv.append(p);ww.append(weight(p,u,t));uv.append((u*2,t*2))
    ff=[]
    for j in range(rows):
        for i in range(cols):k=j*(cols+1)+i;ff.append((k,k+1,k+cols+2,k+cols+1))
    o=mesh(name,vv,ff,mat,0,uv)
    # Bind first. Subdivision and thickness interpolate both weights and material indices.
    rig.bind(o,ww)
    if lining:o.data.materials.append(lining)
    sub=o.modifiers.new('Soft large cloth folds','SUBSURF');sub.levels=1;sub.render_levels=1
    solid=o.modifiers.new('Real cloth thickness and lining','SOLIDIFY');solid.thickness=thickness;solid.offset=0
    if lining:solid.material_offset=1;solid.material_offset_rim=1
    bpy.context.view_layer.objects.active=o
    for m in [sub,solid]:
        while o.modifiers.find(m.name)>0:bpy.ops.object.modifier_move_up(modifier=m.name)
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def cloth_skin_weights(obj):
    """Transfer the actual neighboring cloth weights to piping and embroidery."""
    obj.data.calc_loop_triangles()
    vertices=[v.co.copy() for v in obj.data.vertices]
    triangles=[tuple(t.vertices) for t in obj.data.loop_triangles]
    tree=BVHTree.FromPolygons(vertices,triangles,all_triangles=True)
    weights=[{obj.vertex_groups[g.group].name:g.weight for g in v.groups} for v in obj.data.vertices]
    def sample(point):
        hit=tree.find_nearest(V(point));ids=triangles[hit[2]]
        a,b,c=[vertices[i] for i in ids];v0=b-a;v1=c-a;v2=hit[0]-a
        d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1)
        denominator=d00*d11-d01*d01
        if abs(denominator)<1e-14:return weights[ids[0]]
        v=(d11*d20-d01*d21)/denominator;w=(d00*d21-d01*d20)/denominator
        result=defaultdict(float)
        for index,factor in zip(ids,[1-v-w,v,w]):
            for name,weight in weights[index].items():result[name]+=weight*max(0,factor)
        return dict(result)
    return sample

def rider_cloth(r):
    cape=cloth_surface('rider-cape',cape_point,40,32,M['coat'],r,cape_weights,M['lining'],.014)
    cape_skin=cloth_skin_weights(cape)
    for u in [.006,.994]:
        pts=[cape_point(u,t)+Vector((0,.002,-.006)) for t in np.linspace(0,1,31)]
        r.bind(curve('Cape fine sewn brass edge',pts,.0028,M['brass']),cape_skin)
    pts=[cape_point(u,.995)+Vector((0,.004,-.005)) for u in np.linspace(0,1,41)]
    r.bind(curve('Cape lined hem piping',pts,.0034,M['brass']),cape_skin)
    # One subdued celestial device, kept large enough to read without gold noise.
    for radius in [.042,.059]:
        pts=[cape_point(.72+radius*math.cos(a),.74+radius*.66*math.sin(a))+Vector((0,.006,-.010)) for a in np.linspace(0,TAU,41)]
        r.bind(curve('Cape observatory emblem',pts,.0017,M['brass']),cape_skin)
    scarf=cloth_surface('rider-scarf',scarf_point,32,8,M['scarf'],r,lambda p,u,t:chain_weights(t,'scarf.',4),M['lining'],.010)
    scarf.data.materials.append(M['brass'])
    scarf_skin=cloth_skin_weights(scarf)
    for t in [.81,.86,.94]:
        r.bind(curve('Scarf woven end stripe',[scarf_point(u,t) for u in np.linspace(0,1,9)],.0022,M['brass']),scarf_skin)
    for side in [-1,1]:
        tag='L' if side<0 else 'R'
        tail=cloth_surface('Split riding coat tail '+tag,lambda u,t:tail_point(side,u,t),32,18,M['coat'],r,lambda p,u,t:chain_weights(t,'tail.'+tag,3),M['lining'],.013)
        tail_skin=cloth_skin_weights(tail)
        for u in [.015,.985]:
            pts=[tail_point(side,u,t)+Vector((0,.001,-.008)) for t in np.linspace(0,1,41)]
            r.bind(curve('Coat tail sewn facing '+tag,pts,.0024,M['edge']),tail_skin)

def rider_gloves_boots(r):
    # Flattened glove palms and four tapered fingers: the contact is authored to the prop.
    for side in ['L','R']:
        left=side=='L';wr=r.bones['hand.'+side][0];hand=r.bones['hand.'+side][1]
        palm=rounded_box('Fitted glove palm '+side,hand,(.081,.075,.098),M['leather'],.023);r.bind(palm,'hand.'+side)
        palm_tree=BVHTree.FromPolygons([v.co.copy() for v in palm.data.vertices],[tuple(p.vertices) for p in palm.data.polygons])
        seam=[(-.082,.147,-.829),(-.084,.119,-.850),(-.078,.096,-.885)] if left else [(.270,.277,-.747),(.268,.258,-.780),(.277,.232,-.813)]
        for shift in [-.007,.007]:
            points=[]
            for p in seam:
                hit=palm_tree.find_nearest(V(Vector(p)+Vector((0,0,shift))))
                points.append(P(hit[0]+hit[1]*.001))
            r.bind(curve('Glove back double stitching '+side,points,.0010,M['leatherEdge']),'hand.'+side)
        for i in range(4):
            z=hand.z+.037-i*.023
            if left:
                points=[(-.066,.145,z),(-.018,.125,z-.01),(.027,.079,z-.011),(.014,.047,z),(-.018,.062,z+.004)]
            else:
                points=[(.278,.282,z),(.319,.27,z-.006),(.348,.235,z-.001),(.324,.216,z+.004)]
            widths=[.010,.011,.010,.008,.0065] if left else [.010,.011,.009,.007]
            r.bind(swept_lobe('Glove curled finger '+side+str(i),points,widths,[w*.82 for w in widths],M['leather'],12,1),'hand.'+side)
        thumb=[(-.075,.159,-.832),(-.064,.176,-.88),(-.017,.161,-.909)] if left else [(.285,.294,-.760),(.277,.265,-.807),(.314,.236,-.805)]
        r.bind(swept_lobe('Glove opposing thumb '+side,thumb,[.0135,.014,.009],[.011,.011,.007],M['leather'],14,1),'hand.'+side)
        # Boot shaft follows the lower-leg anatomical direction and slims into an ankle.
        knee=r.bones['calf.'+side][0];ankle=r.bones['foot.'+side][0];toe=r.bones['foot.'+side][1]
        points=[mix(knee,ankle,t) for t in [.34,.43,.60,.83,1.0]]
        shaft=swept_lobe('Sculpted riding boot shaft '+side,points,[.090,.086,.074,.063,.057],[.071,.071,.065,.059,.061],M['leather'],16,1);r.bind(shaft,'calf.'+side)
        x=ankle.x;y=ankle.y;z=ankle.z
        rings=[(x,y-.155,z-.095,.071,.159),(x,y-.137,z-.097,.073,.164),(x,y-.098,z-.103,.075,.159),(x,y-.035,z-.056,.064,.105),(x,y+.045,z-.005,.054,.059)]
        r.bind(loft('Sculpted long boot toe '+side,rings,M['leather'],24,1),'foot.'+side)
        r.bind(loft('Boot layered welt sole '+side,[(x,y-.172,z-.10,.074,.160),(x,y-.15,z-.10,.076,.165),(x,y-.139,z-.10,.075,.162)],M['sole'],24,0),'foot.'+side)
        r.bind(rounded_box('Boot low heel '+side,(x,y-.183,z+.017),(.125,.034,.075),M['sole'],.009),'foot.'+side)
        collar=points[0];r.bind(swept_lobe('Boot cuff band '+side,[collar,points[1]],[.093,.09],[.075,.075],M['leatherEdge'],16,0),'calf.'+side)
        # A single small buckle replaces the old dangling seam cords.
        bp=collar+Vector((-.085 if left else .085,-.016,-.015))
        r.bind(rounded_box('Boot brass keeper '+side,bp,(.012,.032,.035),M['brass'],.005),'calf.'+side)

def rider_garment_linings(r):
    """Finish the actual open edge loops of the anatomical garment.

    The shoulder lining uses the coat's own boundary vertices/weights. The glove
    sleeve connects the real cuff ring to the palm instead of guessing a tube axis.
    """
    coat=bpy.data.objects['Anatomically tailored coat and sleeves']
    counts=defaultdict(int)
    for poly in coat.data.polygons:
        for edge in poly.edge_keys:counts[tuple(sorted(edge))]+=1
    adjacent=defaultdict(list)
    for (a,b),count in counts.items():
        if count==1:adjacent[a].append(b);adjacent[b].append(a)
    remaining=set(adjacent)
    while remaining:
        start=min(remaining);indices=[];previous=None;current=start
        while current not in indices:
            indices.append(current);remaining.discard(current)
            choices=[i for i in adjacent[current] if i!=previous]
            if not choices:break
            previous,current=current,choices[0]
        if len(indices)<3:continue
        ring=[P(coat.data.vertices[i].co) for i in indices]
        centre=sum(ring,Vector((0,0,0)))/len(ring)
        original_weights=[]
        for i in indices:
            original_weights.append({coat.vertex_groups[g.group].name:g.weight for g in coat.data.vertices[i].groups})
        if centre.y>.6:
            kind='Fitted shoulder and collar interior';mat=M['edge'];bone='chest'
            targets=[]
            for p in ring:
                a=math.atan2(p.x,-(p.z+.313))
                targets.append(Vector((.089*math.sin(a),.856+.006*math.cos(a),-.320-.079*math.cos(a))))
        elif centre.y>.14:
            side='L' if centre.x<0 else 'R';bone='hand.'+side;kind='Connected leather sleeve lining '+side;mat=M['leather']
            palm=r.bones[bone][1]
            targets=[palm+(p-centre)*.58 for p in ring]
            # A closed six-sided cross-section turns the wool back around the
            # actual cuff boundary, above the leather wrist lining.
            axis=(r.bones['fore.'+side][0]-centre).normalized();cv=[];cw=[];cf=[];n=len(ring)
            for offset,roll in [(.034,.002),(.030,.007),(.007,.007),(0,.003),(.006,-.002),(.030,-.002)]:
                for i,p in enumerate(ring):
                    cv.append(p+axis*offset+(p-centre).normalized()*roll);cw.append(original_weights[i])
            for j in range(6):
                for i in range(n):cf.append((j*n+i,j*n+(i+1)%n,((j+1)%6)*n+(i+1)%n,((j+1)%6)*n+i))
            r.bind(mesh('Turned tailored wrist cuff '+side,cv,cf,M['edge']),cw)
        else:
            kind='Finished inner coat hem';mat=M['lining'];bone='pelvis'
            targets=[centre+(p-centre)*.90+Vector((0,.027,0)) for p in ring]
        vertices=[];weights=[];faces=[];n=len(ring)
        for j,t in enumerate([0,.45,1]):
            for i,(a,b) in enumerate(zip(ring,targets)):
                vertices.append(mix(a,b,t))
                w={key:value*(1-t) for key,value in original_weights[i].items()}
                w[bone]=w.get(bone,0)+t;weights.append(w)
        for j in range(2):
            for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        lining=mesh(kind,vertices,faces,mat)
        r.bind(lining,weights)
        solid=lining.modifiers.new('Turned lining wall thickness','SOLIDIFY');solid.thickness=.008;solid.offset=-.5
        bpy.context.view_layer.objects.active=lining
        while lining.modifiers.find(solid.name)>0:bpy.ops.object.modifier_move_up(modifier=solid.name)
        bpy.ops.object.modifier_apply(modifier=solid.name)
    # The standing collar is a lined, open-front garment with a rounded folded edge.
    rows=3;cols=32;vv=[];ff=[]
    for j in range(rows+1):
        t=j/rows
        for i in range(cols+1):
            a=.40+(TAU-.80)*i/cols
            radius=.119+.008*math.sin(t*math.pi)
            vv.append((math.sin(a)*radius,.778+.095*t+.022*t*(1-math.cos(a))/2,-.310-math.cos(a)*radius*.82))
    for j in range(rows):
        for i in range(cols):k=j*(cols+1)+i;ff.append((k,k+1,k+cols+2,k+cols+1))
    collar=mesh('Thick lined open front riding collar',vv,ff,M['edge'],1);collar.data.materials.append(M['lining'])
    solid=collar.modifiers.new('True lined riding collar thickness','SOLIDIFY');solid.thickness=.015;solid.material_offset=1;solid.material_offset_rim=1
    r.bind(collar,'chest')


def rider_broom(r):
    points=[(0,.16,-1.61),(.004,.135,-1.40),(0,.076,-1.01),(0,-.027,-.40),(0,-.103,.06),(0,-.198,.79),(0,-.205,1.29)]
    r.bind(swept_lobe('Hand carved walnut broom',points,[.038,.041,.036,.036,.039,.046,.051],[.038,.041,.036,.036,.039,.046,.051],M['wood'],16,1),'broom')
    for j in range(15):
        z=-1.40+j*.026
        y=.135+(.076-.135)*((z+1.40)/.39)
        pts=[(.043*math.sin(a),y+.043*math.cos(a),z+a/TAU*.026) for a in np.linspace(0,TAU,17)]
        r.bind(curve('Leather broom grip wrap',pts,.0045,M['leather']),'broom')
    for z in [.86,1.025]:
        pts=[(.105*math.sin(a),-.198+.088*math.cos(a),z) for a in np.linspace(0,TAU,33)]
        r.bind(curve('Antique broom ferrule',pts,.013,M['brass'],2),'broom')
    # Seven bristle volumes, a few loose tapered strands. Their silhouette has hierarchy.
    for i in range(11):
        a=i/11*TAU
        p=[(.04*math.sin(a),-.20+.04*math.cos(a),.84),(.085*math.sin(a),-.22+.085*math.cos(a),1.20),(.16*math.sin(a),-.29+.14*math.cos(a),1.58),(.12*math.sin(a),-.33+.11*math.cos(a),1.98+.06*math.sin(i*3))]
        r.bind(swept_lobe('Swept birch bundle '+str(i),p,[.020,.058,.045,.001],[.020,.039,.028,.001],M['twig'] if i%3 else M['twigDark'],10,1),'broom')
    for i in range(48):
        a=i/48*TAU
        rad=.14+random.random()*.025
        pts=[(.06*math.sin(a),-.20+.06*math.cos(a),1.03),(rad*.75*math.sin(a),-.25+rad*.6*math.cos(a),1.42),(rad*math.sin(a),-.34+rad*.8*math.cos(a),1.84+random.random()*.18)]
        r.bind(swept_lobe('Loose birch contour '+str(i),pts,[.003,.004,.0004],[.003,.004,.0004],M['twigDark'] if i%3 else M['twig'],5,0),'broom')
    wand=[(.312,.252,-.804),(.30,.285,-1.02),(.273,.359,-1.48)]
    r.bind(swept_lobe('Walnut wand',wand,[.017,.013,.004],[.017,.013,.004],M['wood'],12,1),'hand.R')
    r.bind(ellipsoid('Wand antique pommel',wand[0],(.021,.023,.024),M['brass'],12,8),'hand.R')
    r.anchor('wandTip',(.273,.359,-1.48),'hand.R')
    r.anchor('broomTail',(0,-.33,2.00),'broom')

def rider_mask_hat(r):
    """A complete silver face mask and tailored felt hat, with no exposed face."""
    # A fitted fabric hood/neck closes the silhouette below the face and behind the hat.
    hood=loft('Rider fitted dark head cowl',[(0,.747,-.302,.073,.083),(0,.814,-.305,.084,.088),(0,.897,-.299,.085,.089),(0,.983,-.283,.119,.109),(0,1.093,-.276,.133,.119),(0,1.180,-.281,.12,.13),(0,1.214,-.287,.052,.063)],M['hat'],32,1)
    r.bind(hood,'head')
    # Deliberate forehead, brow, cheek, bridge and tapered jaw profiles. Eye slits
    # are real apertures with a recessed dark backing, not painted-on eye spheres.
    profile=[(.866,.025,-.453,-.347),(.888,.056,-.483,-.348),(.923,.086,-.507,-.340),
             (.957,.111,-.519,-.328),(.991,.124,-.517,-.315),(1.028,.133,-.520,-.303),
             (1.049,.132,-.521,-.297),(1.067,.130,-.530,-.292),(1.077,.131,-.538,-.285),
             (1.099,.133,-.518,-.278),(1.142,.126,-.486,-.268),(1.179,.114,-.463,-.255),(1.206,.086,-.431,-.246)]
    cols=40;vv=[];ff=[];back=[]
    def face_at(q,y,width,front,side):
        z=side+(front-side)*(1-abs(q)**1.42)
        # A raised nasal ridge, not the old smooth oval mask.
        z-=.050*math.exp(-(q/.20)**2-((y-1.01)/.055)**2)
        z-=.010*math.exp(-((abs(q)-.68)/.18)**2-((y-.981)/.031)**2)
        return Vector((q*width,y,z))
    def mask_point(row,q):
        p=face_at(q,*profile[row])
        if row in [6,7,8]:p.y+=.018*smoothstep(.20,.82,abs(q))
        elif row==9:p.y+=.009*smoothstep(.20,.82,abs(q))
        return p
    for row,(y,width,front,side) in enumerate(profile):
        for i in range(cols+1):
            q=i/cols*2-1
            p=mask_point(row,q)
            vv.append(p);back.append(p+Vector((0,0,.012)))
    for j in range(len(profile)-1):
        for i in range(cols):
            q=(i+.5)/cols*2-1;k=j*(cols+1)+i
            if not (j==6 and .23<abs(q)<.79):ff.append((k,k+1,k+cols+2,k+cols+1))
    mask=mesh('rider-mask',vv,ff,M['maskSilver'],1)
    shell=mask.modifiers.new('Ceremonial mask wall thickness','SOLIDIFY');shell.thickness=.006;shell.offset=-1
    r.bind(mask,'head')
    all_faces=[]
    for j in range(len(profile)-1):
        for i in range(cols):k=j*(cols+1)+i;all_faces.append((k,k+1,k+cols+2,k+cols+1))
    r.bind(mesh('Recessed dark full mask backing',back,all_faces,M['void'],0),'head')
    # Quiet gold inlays follow the mask's surface; silver facial planes remain dominant.
    for side in [-1,1]:
        points=[]
        for row,q in [(9,.78),(8,.82),(5,.80),(3,.76),(1,.43)]:
            points.append(mask_point(row,side*q)+Vector((0,0,-.009)))
        r.bind(curve('Mask cheek engraved brass '+str(side),points,.0017,M['brass']),'head')
        # The brow ridge is already in the supported mask rows. No overlapping
        # tube is laid across the aperture, so the edge cannot look torn.
    crest=[face_at(0,*profile[row])+Vector((0,0,-.003)) for row in [12,11,10,9]]
    r.bind(curve('Mask central antiqued crest',crest,.0026,M['brass']),'head')
    # The brim is a thick, softly curled oval. Crown and brim meet under a real band.
    rows=8;cols=48;vv=[];ff=[]
    def brim_point(a,t):
        rx=mix(.139,.343,t);rz=mix(.151,.365,t)
        ripple=(.023*math.sin(a+.4)+.012*math.sin(a*2-1))*t*t
        upturn=.044*max(0,math.sin(a-1.1))**3*t**3
        return Vector((math.sin(a)*rx,1.184-.037*t+.010*math.sin(t*math.pi)+ripple+upturn,-.293-math.cos(a)*rz))
    for j in range(rows+1):
        for i in range(cols):vv.append(brim_point(i/cols*TAU,j/rows))
    for j in range(rows):
        for i in range(cols):ff.append((j*cols+i,j*cols+(i+1)%cols,(j+1)*cols+(i+1)%cols,(j+1)*cols+i))
    brim=mesh('rider-hat-brim',vv,ff,M['hat'],1)
    solid=brim.modifiers.new('Felt brim thickness','SOLIDIFY');solid.thickness=.013;solid.offset=-.4;r.bind(brim,'head')
    for t in [.952,.989]:r.bind(curve('Wizard hat brim seam',[brim_point(a,t)+Vector((0,.003,0)) for a in np.linspace(0,TAU,57)],.0016,M['hatEdge']),'head')
    rings=[(0,1.163,-.293,.144,.155),(0,1.180,-.293,.151,.163),(0,1.204,-.293,.153,.163),(-.005,1.245,-.287,.148,.155),
           (-.013,1.330,-.277,.128,.133),(-.030,1.441,-.254,.106,.111),(-.051,1.544,-.225,.078,.085),
           (-.057,1.635,-.177,.052,.059),(-.037,1.706,-.121,.031,.037),(.018,1.751,-.077,.021,.024),
           (.071,1.749,-.042,.011,.014),(.108,1.730,-.019,.002,.003)]
    crown=loft('rider-hat-crown',rings,M['hat'],40,1)
    # Small sewn compression folds live at the base, leaving a clean upper silhouette.
    for vertex in crown.data.vertices:
        p=P(vertex.co)
        amount=.006*math.exp(-((p.y-1.28)/.055)**2)*math.sin(math.atan2(p.x,-p.z-.293)*3+p.y*30)
        vertex.co.z+=amount
    r.bind(crown,'head')
    band=loft('Wizard hat claret leather band',[(0,1.187,-.292,.157,.169),(-.002,1.217,-.291,.159,.168),(-.005,1.252,-.288,.154,.162),(-.006,1.262,-.287,.152,.160)],M['lining'],40,1,caps=False)
    thick=band.modifiers.new('Leather hat band thickness','SOLIDIFY');thick.thickness=.007
    r.bind(band,'head')
    buckle=[(-.045,1.209,-.460),(.025,1.209,-.461),(.025,1.254,-.458),(-.045,1.254,-.457),(-.045,1.209,-.460)]
    r.bind(curve('Hat antique brass buckle',buckle,.0045,M['brass'],1),'head')
    r.bind(curve('Hat buckle pin',[(-.011,1.210,-.465),(-.011,1.252,-.462)],.0028,M['brass']),'head')
    # One long subdued seam makes the tip read as cut and sewn felt, not a rigid cone.
    seam=[Vector((cx-rx*.63,cy,cz+rz*.70)) for cx,cy,cz,rx,rz in rings[2:-1]]
    r.bind(curve('Hat crown tailored seam',seam,.0017,M['hatEdge']),'head')


def wizard():
    r=rider_rig();source,*eyes=source_body()
    rider_tailoring(source,r);rider_mask_hat(r)
    rider_gloves_boots(r);rider_garment_linings(r);rider_cloth(r);rider_broom(r)
    r.anchor('gripContact',r.bones['hand.L'][0],'fore.L')
    for o in [source,*eyes]:bpy.data.objects.remove(o,do_unlink=True)
    return r

def guardian_panel(u,t,side=0):
    if side==0:
        q=u*2-1;width=.255+.09*math.sin(t*math.pi)-.185*t**2
        x=q*width+.31*math.sin(t*3.2)*t+.24*t*t
        y=.68-1.86*t+.10*math.sin(q*5+.4)*t**6
        z=.07+.18*t+.19*math.sin(t*math.pi)+.040*math.cos(q*10+t*2)*(1-.45*t)-.13*(1-q*q)
    else:
        q=u*2-1;width=.14+.11*math.sin(t*math.pi)
        x=side*(.31+.32*math.sin(t*2.4)+.26*t)+(q*width*((1-t)**.55+.02))+.10*math.sin(t*5)*t
        y=.79-1.35*t+.25*math.sin(t*math.pi)+side*.15*t
        z=.035+.70*t+.08*math.cos(q*5+t*3)
    return Vector((x,y,z))

def guardian_back(u,t):
    q=u*2-1
    return Vector((q*(.30+.1*math.sin(t*math.pi)-.21*t*t)-.16*t*t,.77-1.78*t+.13*math.sin(q*5)*t**5,.12+.55*t+.08*math.cos(q*9+t*3)))

def guardian_rig():
    r=Rig('ArchiveGuardianRig');r.bone('root',(0,0,0),(0,.2,0))
    r.bone('core',(0,.15,.03),(0,.69,.03),'root');r.bone('mask',(0,.83,-.02),(0,1.25,-.02),'core')
    for side,q in [('L',-1),('C',0),('R',1)]:
        for j in range(4):r.bone('gown.'+side+str(j),guardian_panel((q+1)/2,j/4),guardian_panel((q+1)/2,(j+1)/4),'core' if j==0 else 'gown.'+side+str(j-1))
    for side,q in [('L',-1),('R',1)]:
        for j in range(4):r.bone('wing.'+side+str(j),guardian_panel(.5,j/4,q),guardian_panel(.5,(j+1)/4,q),'core' if j==0 else 'wing.'+side+str(j-1))
    for j in range(4):r.bone('train.'+str(j),guardian_back(.5,j/4),guardian_back(.5,(j+1)/4),'core' if j==0 else 'train.'+str(j-1))
    return r.build()

def gown_weights(p,u=None,t=None):
    if t is None:t=clamp((.68-p.y)/1.86)
    if u is None:u=clamp((p.x-.31*math.sin(t*3.2)*t-.24*t*t)/max(.04,2*(.255+.09*math.sin(t*math.pi)-.185*t*t))+.5)
    if u<.5:a,b,f='L','C',u*2
    else:a,b,f='C','R',(u-.5)*2
    result=defaultdict(float)
    for n,w in chain_weights(t,'gown.'+a,4).items():result[n]+=w*(1-f)
    for n,w in chain_weights(t,'gown.'+b,4).items():result[n]+=w*f
    return dict(result)

def guardian_mask(r):
    # Ring profiles articulate brow, cheek, nose and tapered jaw; an actual open eye cavity.
    rings=[(.745,.015,-.199),(.84,.089,-.249),(.94,.146,-.252),
           (1.025,.159,-.261),(1.044,.158,-.258),(1.063,.151,-.253),(1.079,.149,-.249),
           (1.19,.132,-.217),(1.28,.047,-.151)]
    sides=32;vv=[];ff=[]
    def face_point(j,a):
        height,width,front=rings[j];x=math.sin(a)*width
        z=-.10+math.cos(a)*(front+.10)
        if math.cos(a)>0:
            z-=.026*math.exp(-(x/.043)**2)*math.sin(j/(len(rings)-1)*math.pi)
            if j in [2,3,4,5]:z+=.014*math.exp(-((abs(x)-.08)/.041)**2)
        return Vector((x,height,z))
    for j,(height,width,front) in enumerate(rings):
        for i in range(sides):vv.append(face_point(j,i/sides*TAU))
    backing=[]
    for j in range(len(rings)-1):
        for i in range(sides):
            # Open eye sockets between brow and cheek rows, each 4 segments wide.
            centre=(i+.5)/sides*TAU;x=math.sin(centre)
            face=(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i)
            eye=j==4 and math.cos(centre)>.5 and .23<abs(x)<.83
            if not eye:ff.append(face)
            if 3<=j<=5 and math.cos(centre)>.3 and .12<abs(x)<.92:backing.append(face)
    ff+=[tuple(range(sides-1,-1,-1)),tuple((len(rings)-1)*sides+i for i in range(sides))]
    o=mesh('Sculpted porcelain guardian mask',vv,ff,M['ivory'],1);r.bind(o,'mask')
    # The dark cavity follows the actual curved face; an ellipsoid placed at a
    # single depth protrudes at the outer corners and reads as a painted eyelash.
    r.bind(mesh('Guardian recessed curved eye lining',[p+Vector((0,0,.018)) for p in vv],backing,M['void'],1),'mask')
    for side in [-1,1]:
        points=[mix(face_point(4,side*a),face_point(5,side*a),.50)+Vector((0,0,.006)) for a in [.31,.43,.57,.71,.82]]
        r.bind(curve('Guardian inset soul slit '+str(side),points,.0018,M['spirit']),'mask')
        r.bind(curve('Guardian cheek gold inset '+str(side),[(side*.123,1.00,-.236),(side*.095,.947,-.253),(side*.058,.874,-.237),(.006*side,.789,-.208)],.0024,M['brass']),'mask')
    r.bind(curve('Mask forehead crest',[(0,1.253,-.168),(0,1.21,-.218),(0,1.145,-.255),(0,1.095,-.282)],.004,M['brass']),'mask')
    r.bind(mesh('Carved central mask planes',[(0,1.176,-.249),(-.027,1.04,-.275),(0,.912,-.263),(.027,1.04,-.275),(0,1.039,-.311)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],M['ivory'],0,smooth=False),'mask')
    # A substantial crescent pair with a shoulder and blade silhouette, not antenna wires.
    for side in [-1,1]:
        points=[(side*.105,1.187,-.025),(side*.238,1.252,.005),(side*.290,1.397,.032),(side*.257,1.557,.031),(side*.169,1.672,.006)]
        r.bind(swept_lobe('Guardian crescent crown '+str(side),points,[.043,.049,.036,.019,.0007],[.017,.019,.013,.009,.0007],M['brass'],12,1),'mask')
        r.bind(curve('Crown cool engraved edge '+str(side),[Vector(p)+Vector((0,0,-.017)) for p in points],.0022,M['silver']),'mask')
    # A segmented rear hood carries the crown without swallowing the face.
    hood=loft('Guardian fitted moon hood',[(0,.795,.035,.10,.115),(0,.89,.038,.17,.15),(0,1.08,.041,.178,.15),(0,1.24,.04,.145,.12),(0,1.32,.055,.04,.055)],M['guardian'],32,1)
    r.bind(hood,'mask')

def wraith():
    r=guardian_rig()
    cloth_surface('Guardian S curved front robe',guardian_panel,20,16,M['guardian'],r,gown_weights,M['guardianInner'])
    cloth_surface('Guardian swept back train',guardian_back,20,14,M['guardianInner'],r,lambda p,u,t:chain_weights(t,'train.',4),M['guardianSilk'])
    for side in [-1,1]:
        tag='L' if side<0 else 'R'
        cloth_surface('Guardian floating shoulder panel '+tag,lambda u,t:guardian_panel(u,t,side),20,10,M['guardianSilk'],r,lambda p,u,t:chain_weights(t,'wing.'+tag,4),M['guardianInner'])
        pts=[guardian_panel(.02,t,side)+Vector((0,.004,-.006)) for t in np.linspace(0,1,31)]
        r.bind(curve('Guardian moon wing piping '+tag,pts,.0024,M['brass']),lambda p:chain_weights(clamp((.79-p.y)/1.35),'wing.'+tag,4))
    # A fitted chest plate and overlapping pointed shoulder yokes establish a waist.
    torso=loft('Guardian upper draped core',[(0,.26,.065,.125,.102),(0,.41,.042,.148,.11),(0,.65,.021,.236,.135),(0,.82,.01,.25,.12),(0,.89,.015,.12,.09)],M['guardian'],32,1);r.bind(torso,'core')
    vv=[];ff=[];sides=40
    for radius,y in [(.115,.891),(.20,.85),(.35,.774),(.43,.731),(.435,.718)]:
        for i in range(sides):
            a=i/sides*TAU;vv.append((math.sin(a)*radius,y+.018*math.cos(a*2),.035-math.cos(a)*radius*.65))
    for j in range(4):
        for i in range(sides):ff.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    mantle=mesh('Guardian continuous pointed shoulder mantle',vv,ff,M['guardianSilk'],1)
    solid=mantle.modifiers.new('Mantle thickness','SOLIDIFY');solid.thickness=.010;r.bind(mantle,'core')
    r.bind(curve('Guardian shoulder mantle border',vv[-sides:]+[vv[-sides]],.0027,M['brass']),'core')
    guardian_mask(r)
    for side in [-1,1]:
        pts=[(side*.21,.717,-.145),(side*.15,.588,-.169),(side*.076,.512,-.157),(0,.496,-.166)]
        r.bind(curve('Guardian chain '+str(side),pts,.0023,M['brass']),'core')
    crystal=mesh('Guardian restrained archive crystal',[(0,.647,-.163),(.036,.567,-.180),(0,.488,-.166),(-.036,.567,-.180),(0,.568,-.232),(0,.568,-.144)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,5,1),(1,5,2),(2,5,3),(3,5,0)],M['spirit'],0,smooth=False)
    r.bind(crystal,'core')
    r.bind(curve('Guardian crystal bezel',[(0,.656,-.166),(.043,.567,-.184),(0,.477,-.168),(-.043,.567,-.184),(0,.656,-.166)],.0035,M['brass']),'core')
    return r

def animate(r,kind):
    scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=97
    r.obj.animation_data_create()
    states=['idle','cruise','turn_left','turn_right','boost'] if kind=='wizard' else ['idle','approach','channel']
    for state in states:
        act=bpy.data.actions.new(state);act.use_fake_user=True;r.obj.animation_data.action=act
        for frame in range(1,98,4):
            t=(frame-1)/96;phase=t*TAU
            for p in r.obj.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
            if kind=='wizard':
                speed={'idle':.15,'cruise':.45,'turn_left':.55,'turn_right':.55,'boost':1}[state]
                direction=-1 if state=='turn_left' else 1 if state=='turn_right' else 0
                bones=r.obj.pose.bones
                bones['spine'].rotation_euler.x=.023*math.sin(phase)-.095*speed
                bones['spine'].rotation_euler.y=direction*.035
                bones['chest'].rotation_euler.x=.026*math.sin(phase+.5)-.105*speed
                bones['chest'].rotation_euler.y=direction*.115
                bones['head'].rotation_euler.x=.175*speed+.020*math.sin(phase+.7)
                bones['head'].rotation_euler.y=direction*.18+.024*math.sin(phase)
                bones['head'].rotation_euler.z=direction*.025
                bones['neck'].rotation_euler.y=direction*.035
                for side,s in [('L',-1),('R',1)]:
                    name='clavicle.'+side;basis=r.obj.data.bones[name].matrix_local.to_3x3().inverted()
                    lift=s*(.018*math.sin(phase+s*.6)-.016*speed)
                    forward=s*(.061*speed+.018*math.sin(phase+s*.7))+direction*.020
                    q=Quaternion((basis@V((0,0,1))).normalized(),lift)@Quaternion((basis@V((0,1,0))).normalized(),forward)
                    bones[name].rotation_euler=q.to_euler()
                bones['hand.R'].rotation_euler.x=.027*math.sin(phase+.3)
                bones['hand.R'].rotation_euler.z=direction*.045
                basis=r.obj.data.bones['hand.R'].matrix_local.to_3x3().inverted()
                bones['hand.R'].location=basis@V((.008*math.sin(phase+.6),.015*speed+.008*math.sin(phase),-.020*speed))
                bones['thigh.L'].rotation_euler.x=-.026*speed+.022*math.sin(phase+.8)-direction*.012
                bones['thigh.R'].rotation_euler.x=.038*speed+.026*math.sin(phase+1.8)-direction*.014
                bones['calf.L'].rotation_euler.x=-.058*speed+.029*math.sin(phase+1)
                bones['calf.R'].rotation_euler.x=-.105*speed+.032*math.sin(phase+1.5)
                bones['foot.L'].rotation_euler.x=-.045*speed+.012*math.sin(phase+1.4)
                bones['foot.R'].rotation_euler.x=-.064*speed+.014*math.sin(phase+2)
                for side,s in [('L',-1),('C',0),('R',1)]:
                    for j in range(4):
                        p=bones['cape.'+side+str(j)]
                        p.rotation_euler.x=(.014+.025*j)*math.sin(phase-j*.74+s*.23)*(.6+.80*speed)+speed*.034*j
                        p.rotation_euler.z=(.007+.011*j)*math.sin(phase-j*.58+s*.35)+direction*.021*j
                for j in range(4):
                    p=bones['scarf.'+str(j)];p.rotation_euler.x=(.023+.019*j)*math.sin(phase-j*.75)+.025*speed
                    p.rotation_euler.z=(.018+.018*j)*math.sin(phase-j*.55+.7)+direction*.023
                for side,s in [('L',-1),('R',1)]:
                    for j in range(3):
                        p=bones['tail.'+side+str(j)];p.rotation_euler.x=(.010+.026*j)*math.sin(phase-j*.8+s*.4)+.029*speed
                        p.rotation_euler.z=direction*.012*j
            else:
                bones=r.obj.pose.bones;strength={'idle':.4,'approach':.72,'channel':1}[state]
                bones['core'].rotation_euler.x=.022*math.sin(phase)
                bones['core'].rotation_euler.z=.026*math.sin(phase+.4)
                bones['mask'].rotation_euler.y=.07*math.sin(phase+.9)
                bones['mask'].rotation_euler.x=-.06*(state=='channel')+.024*math.sin(phase+.3)
                for side,s in [('L',-1),('C',0),('R',1)]:
                    for j in range(4):
                        p=bones['gown.'+side+str(j)];p.rotation_euler.x=(.018+.022*j)*math.sin(phase-j*.75+s*.25)
                        p.rotation_euler.z=(.010+.016*j)*math.sin(phase-j*.6+s*.4)
                for side,s in [('L',-1),('R',1)]:
                    for j in range(4):
                        p=bones['wing.'+side+str(j)];p.rotation_euler.z=s*(.022+.07*strength)+(.018+.020*j)*math.sin(phase-j*.72+s*.7)
                        p.rotation_euler.x=(.018+.025*j)*math.sin(phase-j*.6+s)
                for j in range(4):
                    p=bones['train.'+str(j)];p.rotation_euler.x=(.02+.018*j)*math.sin(phase-j*.8+.8)
                    p.rotation_euler.z=(.012+.014*j)*math.sin(phase-j*.64)
            for p in r.obj.pose.bones:
                p.keyframe_insert(data_path='rotation_euler',frame=frame,group=p.name)
                p.keyframe_insert(data_path='location',frame=frame,group=p.name)
        print('ACTION_AUTHORED',state,len(r.obj.pose.bones))
    r.obj.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)

def consolidate(r):
    """Merge by principal material, preserving all named cloth and socket objects."""
    groups=defaultdict(list);keep={'rider-cape','rider-scarf','rider-mask','rider-hat-brim','rider-hat-crown'}
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH' or o.name in keep:continue
        groups[o.data.materials[0].name].append(o)
    for mat,objects in groups.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=mat
    for o in bpy.context.scene.objects:
        if o.type=='MESH':
            for poly in o.data.polygons:poly.use_smooth=True

def normalize_sheen(file):
    """Carry Principled's static sheen weight in glTF's linear RGB factor.

    Blender 5.1's sheen exporter writes Tint after only testing Weight != 0.
    Read the source sockets instead of multiplying the exported factor, making
    this correction idempotent if the upstream exporter later handles Weight.
    Only JSON material factors change; all binary chunks remain byte-identical.
    """
    raw=file.read_bytes();length=int.from_bytes(raw[12:16],'little')
    data=json.loads(raw[20:20+length])
    for item in data.get('materials',[]):
        sheen=item.get('extensions',{}).get('KHR_materials_sheen')
        if sheen is None:continue
        source=bpy.data.materials.get(item['name'])
        shader=source.node_tree.nodes.get('Principled BSDF') if source and source.use_nodes else None
        if shader is None:raise RuntimeError('Missing authored sheen material: '+item['name'])
        weight=shader.inputs['Sheen Weight'];tint=shader.inputs['Sheen Tint']
        if weight.is_linked or tint.is_linked:raise RuntimeError('Sheen normalization requires static sockets: '+item['name'])
        sheen['sheenColorFactor']=[float(channel*weight.default_value) for channel in tint.default_value[:3]]
    payload=json.dumps(data,separators=(',',':')).encode('utf-8')
    payload+=b' '*((-len(payload))%4)
    chunks=len(payload).to_bytes(4,'little')+raw[16:20]+payload+raw[20+length:]
    corrected=raw[:8]+(12+len(chunks)).to_bytes(4,'little')+chunks
    temporary=file.with_suffix('.glb.tmp');temporary.write_bytes(corrected);temporary.replace(file)
    return corrected,data

def export(r,kind):
    bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=r.obj
    file=OUT/(kind+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_yup=True,
      export_apply=False,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,
      export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
      export_anim_slide_to_zero=True,export_frame_step=2,export_skins=True,export_all_influences=False,export_def_bones=True)
    raw,data=normalize_sheen(file)
    triangles=0
    for m in data.get('meshes',[]):
        for p in m['primitives']:triangles+=data['accessors'][p['indices']]['count']//3 if 'indices' in p else data['accessors'][p['attributes']['POSITION']]['count']//3
    info={'file':kind+'.glb','triangles':triangles,'bytes':len(raw),'meshes':len(data.get('meshes',[])),'skins':len(data.get('skins',[])),
      'bones':len(r.obj.data.bones),'animations':[a.get('name') for a in data.get('animations',[])],
      'sha256':hashlib.sha256(raw).hexdigest()}
    if not info['skins'] or len(info['animations'])<(5 if kind=='wizard' else 3):raise RuntimeError('Skeletal export contract failed: '+str(info))
    if triangles>(400000 if kind=='wizard' else 30000) and not QUICK:raise RuntimeError('Triangle budget exceeded: '+str(info))
    if len(raw)>(12000000 if kind=='wizard' else 3000000):raise RuntimeError('GLB byte budget exceeded: '+str(info))
    (OUT/'source').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/(kind+'-academy-rig.blend')),compress=True)
    return info

def studio(r,kind,only_view=None):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12 if QUICK else 40;scene.cycles.use_denoising=True
    scene.render.resolution_x=1050;scene.render.resolution_y=1150;scene.render.resolution_percentage=70 if QUICK else 100
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.085,.105,.15,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='AgX'
    floor_mat=material('Studio midnight floor',(.065,.078,.10),.86)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.42));floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(floor_mat)
    def area(name,pos,power,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
        o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=V(pos);o.rotation_euler=(V((0,.3,0))-o.location).to_track_quat('-Z','Y').to_euler();return o
    lights=[area('Studio warm key',(-3,4.5,-4),680,3.4,(1,.88,.72)),area('Studio moon fill',(3.5,2,-2),390,3,(.64,.80,1)),area('Studio moon rim',(1,4,3),920,2.8,(.62,.78,1))]
    camera=bpy.data.objects.new('Studio camera',bpy.data.cameras.new('Studio camera'));scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO'
    views=[('front',(-.8,1.4,-6)),('three-quarter',(-4,2.0,-6)),('side',(-6,1.15,.05)),('back',(4,1.7,6))]
    if kind=='wizard':views.append(('garment',(-3.4,.95,-4.5)))
    for label,pos in views:
        if only_view and label!=only_view:continue
        camera.data.ortho_scale=(4.6 if label=='side' else 3.9) if kind=='wizard' else 3.55
        target=Vector((0,.04,.14)) if kind=='wizard' else Vector((.04,.22,.1))
        if label=='garment':camera.data.ortho_scale=2.15;target=Vector((0,.31,-.29))
        camera.location=V(pos);camera.rotation_euler=(V(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(QA/('character-'+kind+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
    if kind=='wizard' and (not only_view or only_view=='face'):
        camera.data.ortho_scale=1.20;camera.location=V((-.55,1.43,-2.7));camera.rotation_euler=(V((0,1.295,-.30))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(QA/'character-wizard-face.png');bpy.ops.render.render(write_still=True)
    # Actual rig frames establish deformation evidence separate from the base views.
    camera.data.ortho_scale=3.9 if kind=='wizard' else 3.55
    camera.location=V((-4,2,-6));camera.rotation_euler=(V((0,.08,.10))-camera.location).to_track_quat('-Z','Y').to_euler()
    for state in (['boost','turn_left','turn_right'] if kind=='wizard' else ['approach','channel']):
        if only_view and state!=only_view:continue
        r.obj.animation_data.action=bpy.data.actions[state];scene.frame_set(33)
        scene.render.filepath=str(QA/('character-'+kind+'-'+state+'.png'));bpy.ops.render.render(write_still=True)
    r.obj.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
    for o in [floor,camera,*lights]:bpy.data.objects.remove(o,do_unlink=True)

summary=[]
for kind,build in [('wizard',wizard),('wraith',wraith)]:
    if ONLY and ONLY!=kind:continue
    clear();materials();rig=build();consolidate(rig);animate(rig,kind)
    summary.append(export(rig,kind))
    if not NO_RENDER:studio(rig,kind)
manifest=OUT/'manifest.json'
if ONLY and manifest.exists():
    prior=json.loads(manifest.read_text());summary += [x for x in prior.get('assets',[]) if x['file']!=ONLY+'.glb']
manifest.write_text(json.dumps({'generator':'Blender 5.1.2; anatomical garment topology, original masked academy rider, tailored felt hat, skinned cloth and baked actions','coordinateSystem':'Y up; forward -Z','assets':summary},indent=2)+'\n')
print('CHARACTER_ASSETS_COMPLETE '+json.dumps(summary))
