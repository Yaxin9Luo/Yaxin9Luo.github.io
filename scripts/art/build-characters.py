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
QA = Path(next((x.split('=',1)[1] for x in sys.argv if x.startswith('--qa=')), str(ROOT.parent / 'qa/production-v3/characters')))
SOURCE = OUT / 'source/blender-studio-anatomy-cc0.blend'
UPSTREAM = ROOT.parent.parent / 'work/character-assets/human-base-meshes/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend'
QUICK = '--preview' in sys.argv
ONLY = next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--only=')), None)
NO_RENDER = '--no-render' in sys.argv
SURFACE = next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--material=')), 'hybrid')
MATERIAL_AB = '--material-ab' in sys.argv
VIEWS = next((x.split('=', 1)[1].split(',') for x in sys.argv if x.startswith('--views=')), None)
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
    bpy.data.orphans_purge(do_recursive=True)

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

def srgb_encode(linear):
    return np.where(linear<=.0031308,12.92*linear,1.055*np.power(linear,1/2.4)-.055)

def scanned_surface(m, bs, color, rough, family, mode):
    """Pack traceable scan detail at provider scale, preserving the linear palette.

    The hybrid keeps a dyed pigment, using a restrained scan luminance rather
    than uniformly brightening the material. Normals/roughness stay Non-Color.
    """
    directory=ROOT/'world/public/textures'/family
    m['surfaceFamily']=family;m['tileMeters']=.27 if family=='wool-cloth' else .40
    m['surfaceVariant']=mode
    rider_wool=family=='wool-cloth' and m.name.startswith(('Academy midnight wool','Tailored deep indigo facing','Claret worsted waistcoat'))
    for socket in ['Base Color','Normal','Roughness']:
        for link in list(bs.inputs[socket].links):m.node_tree.links.remove(link)
    albedo=bpy.data.images.load(str(directory/'color.webp'),check_existing=False)
    albedo.colorspace_settings.name='Non-Color'
    w,h=albedo.size;encoded=np.asarray(albedo.pixels[:],dtype=np.float32).reshape(h,w,4)[:,:,:3]
    linear=np.where(encoded<=.04045,encoded/12.92,((encoded+.055)/1.055)**2.4)
    luminance=np.sum(linear*np.asarray([.2126,.7152,.0722]),axis=2)
    variation=np.maximum(.1,luminance/max(.001,float(luminance.mean())))
    # The close-review rider keeps more of the woven scan's dyed-fiber detail.
    # The guardian and leather retain their separately reviewed surface treatment.
    variation=np.power(variation,1 if mode=='scans' else (.50 if rider_wool else .22))
    variation/=variation.mean()
    pigment=np.clip(np.asarray(color)[None,None,:]*variation[:,:,None],0,1)
    pixels=np.ones((h,w,4),dtype=np.float32);pixels[:,:,:3]=srgb_encode(pigment)
    image=bpy.data.images.new(m.name+' dyed scan pigment',width=w,height=h,alpha=True)
    image.colorspace_settings.name='sRGB';image.pixels.foreach_set(pixels.ravel());image.pack()
    texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
    m.node_tree.links.new(texture.outputs['Color'],bs.inputs['Base Color'])
    bpy.data.images.remove(albedo)
    normal=bpy.data.images.load(str(directory/'normal.webp'),check_existing=True)
    normal.colorspace_settings.name='Non-Color';normal.pack()
    texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=normal
    node=m.node_tree.nodes.new('ShaderNodeNormalMap')
    node.inputs['Strength'].default_value=(.60 if mode=='scans' else (.48 if rider_wool else .32)) if family=='wool-cloth' else .46
    m.node_tree.links.new(texture.outputs['Color'],node.inputs['Color']);m.node_tree.links.new(node.outputs['Normal'],bs.inputs['Normal'])
    source=bpy.data.images.load(str(directory/'roughness.webp'),check_existing=True)
    source.colorspace_settings.name='Non-Color'
    w,h=source.size;pixels=np.asarray(source.pixels[:],dtype=np.float32).reshape(h,w,4).copy()
    values=pixels[:,:,:3].mean(axis=2)
    # Keep authored macro roughness while retaining the scan's local response.
    values=np.clip(rough+(values-values.mean())*(.85 if mode=='scans' else (.62 if rider_wool else .48)),.14,.98)
    pixels[:,:,:3]=values[:,:,None];pixels[:,:,3]=1
    image=bpy.data.images.new(m.name+' scan roughness',width=w,height=h,alpha=True)
    image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(pixels.ravel());image.pack()
    texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
    m.node_tree.links.new(texture.outputs['Color'],bs.inputs['Roughness'])

def material(name, color, rough=.7, metal=0, cloth=False, emission=0, scan=None):
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
    if scan:
        m['tileMeters']=.27 if scan=='wool-cloth' else .4
        m['surfaceFamily']=scan;m['surfaceVariant']=SURFACE
        if SURFACE!='authored':scanned_surface(m,bs,color,rough,scan,SURFACE)
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1)
        bs.inputs['Emission Strength'].default_value=emission
    return m

M={}
def materials():
    global M
    M={
      'coat':material('Academy midnight wool',(.052,.105,.175),.84,cloth='wool',scan='wool-cloth'),
      'edge':material('Tailored deep indigo facing',(.032,.061,.112),.86,cloth='twill',scan='wool-cloth'),
      'vest':material('Claret worsted waistcoat',(.22,.032,.048),.82,cloth='twill',scan='wool-cloth'),
      'lining':material('Burgundy satin lining',(.22,.032,.048),.43,cloth='satin'),
      'scarf':material('Claret woven scarf',(.30,.052,.061),.84,cloth='wool'),
      'shirt':material('Warm ivory linen',(.64,.57,.43),.88,cloth='twill'),
      'pants':material('Graphite twill riding trousers',(.037,.054,.068),.9,cloth='twill'),
      'leather':material('Dark walnut riding leather',(.054,.030,.020),.48,scan='dark-leather'),
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
      'guardian':material('Guardian indigo wool',(.048,.087,.20),.82,cloth=True,scan='wool-cloth'),
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
        n=P(poly.normal);axis=max(range(3),key=lambda k:abs(n[k]));tile=float(mat.get('tileMeters',.333333))
        for li in poly.loop_indices:
            vi=d.loops[li].vertex_index
            p=verts[vi]
            projected=(p[2],p[1]) if axis==0 else (p[0],p[2]) if axis==1 else (p[0],p[1])
            layer.data[li].uv=uv[vi] if uv else (projected[0]/tile,projected[1]/tile)
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
        if kind=='coat':
            # A cut front panel bridges the sternum/pectoral hollows instead of
            # tracing every muscle from the anatomy source. Ease is in the panel;
            # the later fold pass only compresses it near seams and the belt.
            front_weight=smoothstep(.025,.10,-original[i].y)*(1-smoothstep(.125,.185,abs(co.x)))
            front_weight*=smoothstep(.935,.99,co.z)*(1-smoothstep(1.345,1.395,co.z))
            depth=float(np.interp(co.z,[.94,1.02,1.10,1.18,1.25,1.32,1.39],[-.155,-.158,-.160,-.163,-.155,-.122,-.079]))
            curvature=float(np.interp(co.z,[1.0,1.16,1.26,1.39],[3.5,2.9,2.0,1.8]))
            co.y=mix(co.y,depth+curvature*co.x*co.x,front_weight)
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
            bezier([(s*.247,.634,-.328),(s*.224,.548,-.368),(s*.186,.485,-.362),(s*.165,.450,-.343)],.015,.009)
            bezier([(s*.235,.536,-.279),(s*.209,.443,-.307),(s*.197,.335,-.283),(s*.199,.245,-.216)],.021,.009)
            # Diagonal, unequal slack gathers terminate at the cinched side waist.
            # Repeated horizontal, mirrored crests made the old coat look muscular.
            if side=='L':
                bezier([(-.072,.260,-.350),(-.125,.291,-.354),(-.179,.333,-.298),(-.207,.376,-.241)],.020,.008)
                bezier([(-.151,.246,-.312),(-.180,.270,-.278),(-.205,.298,-.226),(-.219,.319,-.190)],.014,.006)
            else:
                bezier([(.098,.259,-.343),(.150,.307,-.330),(.195,.367,-.269),(.212,.425,-.241)],.025,.007)
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
    # Cut chest layers follow the finished cloth, with the same skin weights.
    # Offsetting a second copy of the naked body caused layers to intersect after
    # cloth sculpting and made the approximated piping weights slide through it.
    bpy.context.view_layer.update();body_surface=BVHTree.FromObject(source,bpy.context.evaluated_depsgraph_get())
    def front(x,z,offset=.028):
        hit=body_surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)[0]
        return Vector((x,hit.y-offset if hit else -.15,z))
    coat_weights=[{coat.vertex_groups[g.group].name:g.weight for g in v.groups} for v in coat.data.vertices]
    torso_faces=[tuple(f.vertices) for f in coat.data.polygons
      if sum(sum(coat_weights[i].get(key,0) for key in ['upper.L','fore.L','upper.R','fore.R']) for i in f.vertices)/len(f.vertices)<.25]
    coat_surface=BVHTree.FromPolygons([v.co.copy() for v in coat.data.vertices],torso_faces)
    coat_skin=cloth_skin_weights(coat)
    def on_coat(x,z,lift):
        source_p=front(x,z);q=r.source_point(source_p,adult_weights(source_p))
        hit=coat_surface.ray_cast(V(q+Vector((0,0,-.45))),V((0,0,1)),.9)
        if hit[0] is None:hit=coat_surface.find_nearest(V(q))
        normal=hit[1]
        if normal.dot(V((0,0,-1)))<0:normal=-normal
        p=P(hit[0]+normal*lift)
        return p,coat_skin(P(hit[0])),P(normal)
    def panel(name,pattern,mat,lift,roll=0,thickness=.0024):
        # Longitudinal samples resolve the bent chest without rounding off the
        # actual pattern notch. Close edge rows make a narrow sewn turn, not padding.
        samples=[]
        for a,b in zip(pattern,pattern[1:]):
            for t in np.linspace(0,1,4,endpoint=False):samples.append(tuple(mix(x,y,t) for x,y in zip(a,b)))
        samples.append(pattern[-1]);across=[0,.025,.075,.20,.40,.60,.80,.925,.975,1]
        vv=[];ww=[];ff=[]
        for z,inner,outer in samples:
            for u in across:
                p,w,_=on_coat(mix(inner,outer,u),z,lift+roll*math.sin(u*math.pi))
                vv.append(p);ww.append(w)
        count=len(across)
        for j in range(len(samples)-1):
            for i in range(count-1):k=j*count+i;ff.append((k,k+1,k+count+1,k+count))
        if pattern[0][1]>pattern[0][2]:ff=[tuple(reversed(f)) for f in ff]
        o=mesh(name,vv,ff,mat);r.bind(o,ww)
        solid=o.modifiers.new('Sewn cloth panel thickness','SOLIDIFY');solid.thickness=thickness;solid.offset=-1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_move_up(modifier=solid.name);bpy.ops.object.modifier_apply(modifier=solid.name)
        o['layerClearanceMeters']=lift-thickness
        return o,vv,count
    panel('Inset ivory linen shirt',[(1.384,-.071,.071),(1.345,-.073,.073),(1.28,-.041,.041),(1.248,-.008,.008)],M['shirt'],.005,thickness=.0015)
    vest_pattern=[(1.384,.061,.082),(1.35,.044,.101),(1.31,.018,.088),(1.27,0,.078),
                  (1.19,0,.071),(1.10,0,.056),(1.006,0,.048)]
    for side in [-1,1]:
        panel('Claret waistcoat panel '+str(side),[(z,side*inner,side*outer) for z,inner,outer in vest_pattern],M['vest'],.0085,thickness=.0025)
    for side in [-1,1]:
        pattern=[(1.389,.056,.090),(1.355,.058,.120),(1.331,.063,.140),
                 (1.308,.064,.120),(1.300,.061,.133),(1.251,.050,.107),
                 (1.183,.032,.078),(1.116,.015,.052),(1.067,.008,.022)]
        o,vv,count=panel('Notched riding lapel '+str(side),[(z,side*inner,side*outer) for z,inner,outer in pattern],M['edge'],.016,.0025,.0032)
        lapel_skin=cloth_skin_weights(o)
        # A restrained wool topstitch sits on the panel and shares its deformation.
        stitch=[vv[i+1] for i in range(0,len(vv),count)]
        r.bind(curve('Lapel sewn edge '+str(side),stitch,.00075,M['edge']),lapel_skin)
    for z in [1.055,1.125,1.195,1.259]:
        q,w,normal=on_coat(0,z,.012)
        r.bind(ellipsoid('Antique waistcoat button',q,(.0065,.0065,.0025),M['brass'],12,6),w)
    # Low-relief darts terminate into the belt. Projected stitches share exact
    # surface skinning; approximate torso weights previously exposed floating cords.
    for side in [-1,1]:
        pts=[on_coat(side*float(np.interp(z,[1.04,1.17,1.29],[.105,.093,.116])),z,.0012)[0] for z in np.linspace(1.04,1.29,30)]
        r.bind(curve('Tailored front dart '+str(side),pts,.00085,M['edge']),coat_skin)
    belt_surface=BVHTree.FromPolygons([v.co.copy() for v in source.data.vertices],
      [tuple(f.vertices) for f in source.data.polygons if all(abs(source.data.vertices[i].co.x)<.22 for i in f.vertices)])
    vv=[];ww=[];ff=[];sides=64
    for z in [.975,.981,1.021,1.027]:
        for i in range(sides):
            a=i/sides*TAU;radial=Vector((math.sin(a),-math.cos(a),0))
            hit,normal,*_=belt_surface.ray_cast(radial+Vector((0,0,z)),-radial,2)
            p=hit+normal*.029 if hit is not None else Vector((.18*math.sin(a),-.14*math.cos(a),z))
            amount=smoothstep(.94,1.065,z);w={'pelvis':1-amount,'spine':amount}
            q=r.source_point(p,w);hit=coat_surface.find_nearest(V(q))
            vv.append(P(hit[0]+hit[1]*.006));ww.append(coat_skin(P(hit[0])))
    for j in range(3):
        for i in range(sides):ff.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    belt=mesh('Fitted waist riding belt',vv,ff,M['leather'],0);r.bind(belt,ww)
    belt_skin=cloth_skin_weights(belt)
    for j in [0,3]:r.bind(curve('Belt stitched raised edge',vv[j*sides:(j+1)*sides]+[vv[j*sides]],.0024,M['leatherEdge']),belt_skin)
    buckle=[]
    for x,z in [(-.034,.981),(.034,.981),(.034,1.023),(-.034,1.023),(-.034,.981)]:
        buckle.append(on_coat(x,z,.013)[0])
    r.bind(curve('Belt brass buckle',buckle,.0048,M['brass']),coat_skin)
    for side in [-1,1]:
        q,w,_=on_coat(side*.095,1.002,.011)
        r.bind(ellipsoid('Waist belt brass stud '+str(side),q,(.0045,.0045,.003),M['brass'],10,6),w)
    # The scarf is tucked into the standing collar. Its compact lower fold turns
    # under itself instead of spreading into a thin bib across the shoulders.
    vv=[];ff=[];cols=32
    profile=[(.086,.072,.884,-.322),(.094,.074,.860,-.318),(.101,.075,.813,-.314),
             (.106,.076,.796,-.312),(.107,.076,.788,-.311),(.104,.072,.784,-.311),
             (.100,.070,.792,-.311)]
    for radius,depth,y,z in profile:
        for i in range(cols):
            a=i/cols*TAU
            fold=.0035*math.exp(-((a-1.2)/.3)**2)-.0025*math.exp(-((a-3.9)/.4)**2)
            vv.append(((radius+fold)*math.sin(a),y+.008*math.sin(a+.35),z-(depth+fold)*math.cos(a)))
    for j in range(len(profile)-1):
        for i in range(cols):ff.append((j*cols+i,j*cols+(i+1)%cols,(j+1)*cols+(i+1)%cols,(j+1)*cols+i))
    cowl=mesh('Draped claret scarf cowl',vv,ff,M['scarf'],1)
    cowl.data.materials.append(M['lining'])
    thick=cowl.modifiers.new('Scarf cowl sewn thickness','SOLIDIFY');thick.thickness=.004;thick.offset=0
    thick.material_offset=1;thick.material_offset_rim=1;r.bind(cowl,'chest')
    for side in [-1,1]:
        p=(side*.20,.675,-.318)
        r.bind(ellipsoid('Cape shoulder brooch '+str(side),p,(.021,.022,.008),M['brass'],16,8),'chest')
    r.bind(curve('Draped cape clasp',[(-.20,.672,-.330),(-.12,.61,-.357),(0,.585,-.379),(.12,.611,-.357),(.20,.672,-.330)],.0025,M['brass']),'chest')

def separate_rider_sleeves(r):
    """Cut the finished anatomical coat into torso and independent set-in sleeves.

    Both sides retain the exact original boundary vertices and normals. A narrow
    raised seam is sewn over the join; it is not a second inflated arm volume.
    """
    coat=bpy.data.objects['Anatomically tailored coat and sleeves']
    surface=BVHTree.FromPolygons([v.co.copy() for v in coat.data.vertices],[tuple(p.vertices) for p in coat.data.polygons])
    regions={name:[] for name in ['torso','L','R']}
    weights=[{coat.vertex_groups[g.group].name:g.weight for g in v.groups} for v in coat.data.vertices]
    for poly in coat.data.polygons:
        sums={side:sum(sum(weights[i].get(k+side,0) for k in ['upper.','fore.']) for i in poly.vertices)/len(poly.vertices) for side in ['L','R']}
        side=max(sums,key=sums.get);regions[side if sums[side]>.52 else 'torso'].append(tuple(poly.vertices))
    for region,faces in regions.items():
        used=sorted({i for face in faces for i in face});indices={old:new for new,old in enumerate(used)}
        vertices=[P(coat.data.vertices[i].co) for i in used]
        name='Tailored coat torso' if region=='torso' else 'Independent set in sleeve '+region
        obj=mesh(name,vertices,[tuple(indices[i] for i in face) for face in faces],M['coat'])
        r.bind(obj,[weights[i] for i in used])
        obj.data.normals_split_custom_set_from_vertices([coat.data.vertices[i].normal for i in used])
        if region=='torso':continue
        counts=defaultdict(int)
        for face in faces:
            for a,b in zip(face,face[1:]+face[:1]):counts[tuple(sorted((a,b)))]+=1
        adjacency=defaultdict(list)
        for (a,b),count in counts.items():
            if count==1:adjacency[a].append(b);adjacency[b].append(a)
        remaining=set(adjacency)
        while remaining:
            first=min(remaining);ring=[];current=first;previous=None
            while current not in ring:
                ring.append(current);remaining.discard(current)
                choices=[i for i in adjacency[current] if i!=previous]
                if not choices:break
                previous,current=current,choices[0]
            if len(ring)<4:continue
            points=[P(coat.data.vertices[i].co) for i in ring]
            center=sum(points,Vector((0,0,0)))/len(points)
            if center.y<.48:continue
            tree=cloth_skin_weights(obj)
            for _ in range(5):points=[points[(i-1)%len(points)]*.25+p*.5+points[(i+1)%len(points)]*.25 for i,p in enumerate(points)]
            projected=[]
            for p in points:
                hit=surface.find_nearest(V(p));projected.append(P(hit[0]+hit[1]*.002))
            points=projected
            points.append(points[0])
            r.bind(curve('Set in shoulder seam '+region,points,.0025,M['edge']),tree)
    bpy.data.objects.remove(coat,do_unlink=True)

def cape_point(u,t):
    q=u*2-1;width=.278+.095*t+.018*math.sin(t*math.pi)
    x=q*width+.018*t*t
    # Heavy shoulder cloth has a continuously descending gravity silhouette.
    # It clears the back/seat, then trails; there is no convex umbrella midspan.
    y=.687-.91*t-.16*t*t+.023*q*t
    z=-.105+.76*t+.46*t*t-.075*q*q*(1-t)
    # A fitted shoulder yoke clears the underlying back before the hanging panels
    # descend. Without this clearance a gravity profile cuts through the coat.
    z+=.16*(1-math.exp(-t/.065))*math.exp(-t/.25)
    y-=.027*(1-q*q)*math.exp(-((t-.17)/.16)**2)
    for centre,drift,amplitude,width in [(-.77,.025,.045,.17),(-.34,-.045,-.062,.17),(.27,.04,.066,.16),(.74,-.025,-.047,.15)]:
        fold=amplitude*math.exp(-((q-centre-drift*t)/width)**2)*math.sin(t*math.pi*.93)**.65
        z+=fold;y+=fold*.22
    # Split tails cut upward in the centre. The turned hem exposes a narrow lining.
    notch=.17*math.exp(-(q/.17)**2)*smoothstep(.63,1,t)
    y+=notch;z-=notch*.50
    roll=smoothstep(.90,.985,t)
    y+=.018*roll-.009*smoothstep(.987,1,t);z-=.026*roll
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
    if t is None:t=clamp((p.z+.14)/1.24)
    if u is None:u=clamp((p.x-.018*t*t)/(.278+.095*t+.018*math.sin(t*math.pi))/2+.5)
    if u<.5:a,b,f='L','C',u*2
    else:a,b,f='C','R',(u-.5)*2
    result=defaultdict(float)
    for key,weight in chain_weights(t,'cape.'+a,4).items():result[key]+=weight*(1-f)
    for key,weight in chain_weights(t,'cape.'+b,4).items():result[key]+=weight*f
    return dict(result)

def cloth_surface(name,point,rows,cols,mat,rig,weight,lining=None,thickness=.007):
    vv=[];ww=[];uv=[]
    tile=float(mat.get('tileMeters',.333333));longitudes=np.zeros(cols+1)
    for j in range(rows+1):
        across=0
        for i in range(cols+1):
            u=i/cols;t=j/rows;p=point(u,t)
            if i:across+=(p-vv[-1]).length
            if j:longitudes[i]+=(p-vv[(j-1)*(cols+1)+i]).length
            vv.append(p);ww.append(weight(p,u,t));uv.append((across/tile,longitudes[i]/tile))
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
    panels=[]
    for side in [-1,1]:
        def panel(u,t,side=side):
            full_u=u*.5 if side<0 else .5+u*.5
            p=cape_point(full_u,t)
            p.x+=side*.018*smoothstep(.55,1,t)*(1-abs(full_u*2-1))
            return p
        panels.append(cloth_surface('Cape left panel' if side<0 else 'Cape right panel',panel,40,20,M['coat'],r,
          lambda p,u,t,side=side:cape_weights(p,u*.5 if side<0 else .5+u*.5,t),M['lining'],.011))
    bpy.ops.object.select_all(action='DESELECT')
    for p in panels:p.select_set(True)
    bpy.context.view_layer.objects.active=panels[0];bpy.ops.object.join();cape=panels[0];cape.name='rider-cape'
    cape_skin=cloth_skin_weights(cape)
    for u in [.006,.994]:
        pts=[cape_point(u,t)+Vector((0,.002,-.006)) for t in np.linspace(0,1,31)]
        r.bind(curve('Cape fine sewn brass edge',pts,.0028,M['brass']),cape_skin)
    for side in [-1,1]:
        values=np.linspace(.005,.49,25) if side<0 else np.linspace(.51,.995,25)
        pts=[cape_point(u,.995)+Vector((side*.018*(1-abs(u*2-1)),.004,-.005)) for u in values]
        r.bind(curve('Cape split lined hem piping '+str(side),pts,.0027,M['brass']),cape_skin)
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
            radius=.119+.004*math.sin(t*math.pi)
            vv.append((math.sin(a)*radius,.778+.095*t+.022*t*(1-math.cos(a))/2,-.310-math.cos(a)*radius*.82))
    for j in range(rows):
        for i in range(cols):k=j*(cols+1)+i;ff.append((k,k+cols+1,k+cols+2,k+1))
    # Counter-clockwise outside faces keep satin on the inside of the turned
    # collar. The former winding put the glossy lining over the visible wool.
    collar=mesh('Turned wool riding collar',vv,ff,M['edge'],1);collar.data.materials.append(M['lining'])
    solid=collar.modifiers.new('True lined riding collar thickness','SOLIDIFY');solid.thickness=.0055;solid.material_offset=1;solid.material_offset_rim=1
    r.bind(collar,'chest')
    cowl=bpy.data.objects['Draped claret scarf cowl']
    def surface(o):return BVHTree.FromPolygons([v.co.copy() for v in o.data.vertices],[tuple(f.vertices) for f in o.data.polygons])
    intersections=surface(collar).overlap(surface(cowl))
    if intersections:raise RuntimeError(f'Scarf must sit inside the turned collar; {len(intersections)} intersecting triangle pairs')
    print('TAILORING_CLEARANCE scarf/collar: no intersecting triangle pairs')


def rider_broom(r):
    points=[(-.025,.205,-1.66),(-.009,.178,-1.56),(.004,.135,-1.40),(0,.076,-1.01),(0,-.027,-.40),(0,-.103,.06),(.008,-.198,.79),(0,-.205,1.29)]
    radii=[.015,.028,.039,.035,.034,.038,.045,.049]
    r.bind(swept_lobe('Hand carved tapered bent walnut broom',points,radii,radii,M['wood'],24,1),'broom')
    # The operational grip is directly beneath the curled left hand.
    for start,count,pitch in [(-1.38,10,.025),(-.98,13,.019)]:
        for j in range(count):
            z=start+j*pitch;y=.076+(-.027-.076)*((z+1.01)/.61)
            pts=[(.039*math.sin(a),y+.039*math.cos(a),z+a/TAU*pitch) for a in np.linspace(0,TAU,25)]
            r.bind(curve('Leather broom grip wrap',pts,.0055,M['leather']),'broom')
    for a in [1.8,2.15,2.65,4.25,4.7]:
        pts=[Vector(p)+Vector((math.sin(a)*rad*.998,math.cos(a)*rad*.998,0)) for p,rad in zip(points[3:],radii[3:])]
        r.bind(curve('Carved lengthwise walnut grain',pts,.0012,M['twigDark']),'broom')
    # A continuous stepped metal sleeve binds the structured tail, with raised lips
    # and actual rivet heads. It replaces two oversized floating wire rings.
    vv=[];ff=[];sides=48
    profile=[(.80,.050),(.812,.054),(.825,.068),(.84,.069),(.855,.062),(.972,.071),(.987,.079),(1.003,.079),(1.016,.070)]
    for z,radius in profile:
        for i in range(sides):
            a=i/sides*TAU;vv.append((radius*math.sin(a),-.201+radius*.87*math.cos(a),z))
    for j in range(len(profile)-1):
        for i in range(sides):ff.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    collar=mesh('Stepped brass broom binding collar',vv,ff,M['brass'],1)
    solid=collar.modifiers.new('Ferrule wall thickness','SOLIDIFY');solid.thickness=.004;r.bind(collar,'broom')
    for z,radius in [(.872,.065),(.955,.071)]:
        for i in range(8):
            a=i/8*TAU+.15
            r.bind(ellipsoid('Peened ferrule rivet',(radius*math.sin(a),-.201+radius*.87*math.cos(a),z),(.005,.005,.005),M['brass'],10,6),'broom')
    for i in range(9):
        a=i/9*TAU
        p=[(.035*math.sin(a),-.20+.035*math.cos(a),.84),(.07*math.sin(a),-.23+.06*math.cos(a),1.20),(.115*math.sin(a),-.31+.10*math.cos(a),1.56),(.08*math.sin(a+.2),-.36+.07*math.cos(a+.2),1.88+.06*math.sin(i*3))]
        r.bind(swept_lobe('Bound birch core bundle '+str(i),p,[.015,.034,.024,.0007],[.012,.024,.016,.0007],M['twig'] if i%3 else M['twigDark'],10,1),'broom')
    for i in range(112):
        a=i/112*TAU+random.uniform(-.05,.05);rad=random.uniform(.08,.165);length=random.uniform(.79,1.13)
        pts=[]
        for t in [0,.19,.42,.67,.86,1]:
            spread=.035+(rad-.035)*math.sin(t*math.pi*.80)
            angle=a+.10*math.sin(t*3+i*.7)
            pts.append((spread*math.sin(angle)+.012*math.sin(t*5+i)*t,-.201-.16*t+spread*.78*math.cos(angle),.91+length*t))
        thickness=random.uniform(.0025,.0051)
        radii=[thickness*.85,thickness,thickness*.86,thickness*.60,thickness*.34,.0002]
        r.bind(swept_lobe('Curved individual birch twig '+str(i),pts,radii,[w*.8 for w in radii],M['twigDark'] if i%3 else M['twig'],6,0),'broom')
    for z in [1.06,1.10]:
        pts=[(.079*math.sin(a),-.219+.065*math.cos(a),z+.004*math.sin(a*3)) for a in np.linspace(0,TAU,49)]
        r.bind(curve('Waxed thread secondary tail binding',pts,.005,M['leather']),'broom')
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
        # Broad forehead and cheek planes meet at supported bevels; the mask
        # should read as chased silver rather than a smoothly inflated face.
        profile_q=[0,.18,.52,.75,1];profile_z=[1,.98,.78,.46,0]
        z=side+(front-side)*float(np.interp(abs(q),profile_q,profile_z))
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
    shell=mask.modifiers.new('Ceremonial mask wall thickness','SOLIDIFY');shell.thickness=.007;shell.offset=-1
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
        ripple=(.027*math.sin(a+.4)+.016*math.sin(a*2-1))*t*t
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
        angle=math.atan2(p.x,-p.z-.293)
        amount=.009*math.exp(-((p.y-1.28)/.055)**2)*math.sin(angle*3+p.y*30)
        amount+=.008*math.exp(-((p.y-1.47)/.12)**2)*math.sin(angle*2+p.y*19)
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
    rider_gloves_boots(r);rider_garment_linings(r);separate_rider_sleeves(r);rider_cloth(r);rider_broom(r)
    for o in bpy.context.scene.objects:
        if o.type=='MESH' and o.vertex_groups.get('broom'):o['broomPart']=True
    for side in ['L','R']:
        ankle=r.bones['foot.'+side][0]
        r.anchor('sole.'+side,ankle+Vector((0,-.20,.017)),'foot.'+side)
        r.anchor('toe.'+side,ankle+Vector((0,-.172,-.25)),'foot.'+side)
    r.obj['groundMotion']=GROUND_SPEC
    r.anchor('gripContact',r.bones['hand.L'][0],'fore.L')
    for o in [source,*eyes]:bpy.data.objects.remove(o,do_unlink=True)
    return r

def guardian_panel(u,t,side=0):
    if side==0:
        q=u*2-1;width=.255+.09*math.sin(t*math.pi)-.185*t**2
        x=q*width+.31*math.sin(t*3.2)*t+.24*t*t
        y=.68-1.86*t+.10*math.sin(q*5+.4)*t**6
        z=.07+.18*t+.19*math.sin(t*math.pi)-.13*(1-q*q)
        for center,depth in [(-.78,.032),(-.39,-.043),(.04,.031),(.45,-.036),(.79,.024)]:
            z+=depth*math.exp(-((q-center-.075*math.sin(t*3))/ .15)**2)*(1-.35*t)
        y+=.045*math.exp(-(q/.14)**2)*smoothstep(.72,1,t)
        z+=.009*math.sin(q*27+t*11)*math.exp(-((t-.12)/.13)**2)
    else:
        q=u*2-1;width=.14+.11*math.sin(t*math.pi)
        x=side*(.31+.32*math.sin(t*2.4)+.26*t)+(q*width*((1-t)**.55+.02))+.10*math.sin(t*5)*t
        y=.79-1.35*t+.25*math.sin(t*math.pi)+side*.15*t
        z=.035+.70*t+.070*math.cos(q*5+t*3)+.018*math.cos(q*13+t*4)*math.sin(t*math.pi)
    return Vector((x,y,z))

def guardian_back(u,t):
    q=u*2-1
    return Vector((q*(.30+.1*math.sin(t*math.pi)-.21*t*t)-.16*t*t,.77-1.78*t+.13*math.sin(q*5)*t**5,
      .12+.55*t+.18*smoothstep(0,.20,t)+.062*math.cos(q*9+t*3)+.012*math.sin(q*21-t*2)*(1-t)))

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
    o=mesh('Sculpted porcelain guardian mask',vv,ff,M['ivory'],1)
    solid=o.modifiers.new('Guardian porcelain eye aperture thickness','SOLIDIFY');solid.thickness=.007;solid.offset=-1
    r.bind(o,'mask')
    # The dark cavity follows the actual curved face; an ellipsoid placed at a
    # single depth protrudes at the outer corners and reads as a painted eyelash.
    r.bind(mesh('Guardian recessed curved eye lining',[p+Vector((0,0,.018)) for p in vv],backing,M['void'],1),'mask')
    for side in [-1,1]:
        points=[mix(face_point(4,side*a),face_point(5,side*a),.50)+Vector((0,0,.006)) for a in [.31,.43,.57,.71,.82]]
        r.bind(curve('Guardian inset soul slit '+str(side),points,.0018,M['spirit']),'mask')
        r.bind(curve('Guardian cheek gold inset '+str(side),[(side*.123,1.00,-.236),(side*.095,.947,-.253),(side*.058,.874,-.237),(.006*side,.789,-.208)],.0024,M['brass']),'mask')
        # Leave the eye apertures uninterrupted: separate brow and cheek inlays.
        for rows in [[(7,.49),(6,.58)],[(3,.84),(2,.79),(1,.66),(0,.2)]]:
            edge=[face_point(j,side*a)+Vector((0,0,-.003)) for j,a in rows]
            r.bind(curve('Guardian carved facial edge '+str(side),edge,.0016,M['silver']),'mask')
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
    front=cloth_surface('Guardian S curved front robe',guardian_panel,36,28,M['guardian'],r,gown_weights,M['guardianInner'],.010)
    front_skin=cloth_skin_weights(front)
    for u in [.018,.982]:
        r.bind(curve('Guardian robe sewn facing',[guardian_panel(u,t)+Vector((0,0,-.005)) for t in np.linspace(.02,.99,61)],.0024,M['guardianSilk']),front_skin)
    cloth_surface('Guardian swept back train',guardian_back,32,24,M['guardianInner'],r,lambda p,u,t:chain_weights(t,'train.',4),M['guardianSilk'],.011)
    for side in [-1,1]:
        tag='L' if side<0 else 'R'
        panel=cloth_surface('Guardian floating shoulder panel '+tag,lambda u,t:guardian_panel(u,t,side),32,18,M['guardianSilk'],r,lambda p,u,t:chain_weights(t,'wing.'+tag,4),M['guardianInner'],.010)
        panel_skin=cloth_skin_weights(panel)
        pts=[guardian_panel(.02,t,side)+Vector((0,.004,-.006)) for t in np.linspace(0,1,31)]
        r.bind(curve('Guardian moon wing piping '+tag,pts,.0024,M['brass']),panel_skin)
        for t in [.21,.235]:
            r.bind(curve('Guardian woven shoulder band '+tag,[guardian_panel(u,t,side)+Vector((0,0,-.004)) for u in np.linspace(.03,.97,25)],.0017,M['silver']),panel_skin)
    # A fitted chest plate and overlapping pointed shoulder yokes establish a waist.
    torso=loft('Guardian upper draped core',[(0,.35,.08,.110,.087),(0,.43,.067,.139,.10),(0,.65,.042,.218,.123),(0,.82,.032,.235,.113),(0,.89,.03,.12,.085)],M['guardian'],40,1);r.bind(torso,'core')
    vv=[];ff=[];sides=40
    for radius,y in [(.115,.891),(.20,.85),(.35,.774),(.43,.731),(.435,.718)]:
        for i in range(sides):
            a=i/sides*TAU;vv.append((math.sin(a)*radius,y+.018*math.cos(a*2)+.009*math.sin(a*8)*(radius/.43),.035-math.cos(a)*radius*.65))
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
    scene=bpy.context.scene;scene.render.fps=100;scene.frame_start=1;scene.frame_end=401
    r.obj.animation_data_create()
    states=['idle','cruise','turn_left','turn_right','boost','boost_start','boost_end','cast'] if kind=='wizard' else ['idle','approach','channel']
    for state in states:
        act=bpy.data.actions.new(state);act.use_fake_user=True;r.obj.animation_data.action=act
        last={'boost_start':21,'boost_end':36,'cast':61}.get(state,401)
        for frame in range(1,last+1,1 if last<401 else 16):
            t=(frame-1)/(last-1);phase=t*TAU if last==401 else 0
            for p in r.obj.pose.bones:
                p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
                for constraint in p.constraints:
                    constraint.influence=1;constraint.keyframe_insert(data_path='influence',frame=frame)
            if kind=='wizard':
                speed={'idle':.15,'cruise':.45,'turn_left':.55,'turn_right':.55,'boost':1,'cast':.45,
                       'boost_start':mix(.45,1,smoothstep(.06,.83,t)),'boost_end':mix(1,.45,smoothstep(.04,.92,t))}[state]
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
                if state=='cast':
                    seconds=t*.6
                    windup=smoothstep(0,.105,seconds)*(1-smoothstep(.105,.18,seconds))
                    release=smoothstep(.10,.18,seconds)*(1-smoothstep(.26,.60,seconds))
                    bones['hand.R'].location+=basis@V((.025*windup+.045*release,.115*windup+.165*release,.15*windup-.16*release))
                    bones['hand.R'].rotation_euler.x+=.17*windup-.34*release
                    bones['hand.R'].rotation_euler.z-=.12*release
                    bones['chest'].rotation_euler.y+=.045*windup-.060*release
                    bones['head'].rotation_euler.y-=.035*release
                bones['thigh.L'].rotation_euler.x=-.026*speed+.022*math.sin(phase+.8)-direction*.012
                bones['thigh.R'].rotation_euler.x=.038*speed+.026*math.sin(phase+1.8)-direction*.014
                bones['calf.L'].rotation_euler.x=-.058*speed+.029*math.sin(phase+1)
                bones['calf.R'].rotation_euler.x=-.105*speed+.032*math.sin(phase+1.5)
                bones['foot.L'].rotation_euler.x=-.045*speed+.012*math.sin(phase+1.4)
                bones['foot.R'].rotation_euler.x=-.064*speed+.014*math.sin(phase+2)
                for side,s in [('L',-1),('C',0),('R',1)]:
                    for j in range(4):
                        p=bones['cape.'+side+str(j)]
                        cloth_speed=speed
                        if state=='boost_start':cloth_speed=mix(.45,1,smoothstep(.18+j*.10,1.05+j*.12,t))
                        elif state=='boost_end':cloth_speed=mix(1,.45,smoothstep(.12+j*.08,.94+j*.10,t))
                        p.rotation_euler.x=(.009+.017*j)*math.sin(phase-j*.74+s*.23)*(.6+.65*cloth_speed)+cloth_speed*.043*j
                        p.rotation_euler.z=(.005+.009*j)*math.sin(phase-j*.58+s*.35)+direction*.018*j
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
                p.keyframe_insert(data_path='scale',frame=frame,group=p.name)
        print('ACTION_AUTHORED',state,len(r.obj.pose.bones))
    r.obj.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)

# Ground clips retain the flight bind pose. Absolute joint targets are converted
# through each bone's rest/parent matrices; the exported animation is ordinary skinning.
GROUND_ACTIONS={'ground_idle':2.0,'walk':.72,'run':.58,'mount':1.20,'dismount':1.20,'ground_cast':.60}
GROUND_SPEC={'soleY':-1.30,'height':3.28,'walkSpeed':3.2,'runSpeed':7.2,'walkCycle':.72,'runCycle':.58,
             'walkContact':.52,'runContact':.32,'mountDuration':1.20,'dismountDuration':1.20,
             'castRelease':.18,'castDuration':.60}

def ground_pose(r,state,t):
    bones=r.obj.pose.bones;data=r.obj.data.bones;matrices={}
    phase=t*TAU;walking=state=='walk';running=state=='run';moving=walking or running
    contact=GROUND_SPEC['runContact' if running else 'walkContact']
    cycle_distance=GROUND_SPEC['runSpeed' if running else 'walkSpeed']*GROUND_ACTIONS[state] if moving else 0
    sway=-(.025 if running else .018)*math.sin(phase) if moving else .003*math.sin(phase)
    # Low, continuous walk clearance; the run compresses under load and rises
    # through its real aerial phase. The flight bind pose itself is untouched.
    bob=.10*math.cos(phase*2-1.2*math.pi) if running else -.059*math.cos(phase*2) if walking else .003*math.cos(phase)
    if running:bob-=.045*((1+math.cos(phase*2))*.5)**4
    hip=Vector((sway,(.08 if running else .099 if walking else .11)+bob,.035))
    hip_yaw=(.095 if running else .065)*math.cos(phase) if moving else .004*math.sin(phase)
    chest_yaw=-(.13 if running else .075)*math.cos(phase) if moving else 0
    lean=.16 if running else .035 if walking else 0
    def posed(name):
        if name in matrices:return matrices[name]
        b=data[name]
        return posed(b.parent.name)@b.parent.matrix_local.inverted()@b.matrix_local if b.parent else b.matrix_local.copy()
    def put(name,head,tail=None,rotation=None,stretch=False):
        b=data[name];rest=b.matrix_local;rot=rest.to_quaternion();scale=Vector((1,1,1))
        if tail is not None:
            direction=V(Vector(tail)-Vector(head));rot=(b.tail_local-b.head_local).rotation_difference(direction)@rot
            if stretch:scale=Vector((1,1,1))*(direction.length/b.length)
        if rotation is not None:rot=rotation@rot
        matrix=Matrix.LocRotScale(V(head),rot,scale);matrices[name]=matrix
        parent=posed(b.parent.name) if b.parent else Matrix.Identity(4)
        bones[name].matrix_basis=b.convert_local_to_pose(matrix,b.matrix_local,parent_matrix=parent,
          parent_matrix_local=b.parent.matrix_local if b.parent else Matrix.Identity(4),invert=True)
        return P(matrix@Vector((0,b.length,0)))
    def joint_between(a,b,l1,l2,out):
        axis=b-a;distance=min(axis.length,l1+l2-.001);unit=axis.normalized()
        along=(l1*l1-l2*l2+distance*distance)/(2*distance)
        pole=Vector(out);pole=(pole-unit*pole.dot(unit)).normalized()
        return a+unit*along+pole*math.sqrt(max(.0001,l1*l1-along*along))
    head=hip
    for name in ['pelvis','spine','chest','neck','head']:
        # Pelvis and shoulders rotate against each other; the head remains quiet.
        yaw=hip_yaw if name=='pelvis' else hip_yaw*.3 if name=='spine' else chest_yaw if name=='chest' else chest_yaw*.25 if name=='neck' else 0
        local_lean=lean*.5 if name in ['neck','head'] else lean
        length=data[name].length;tail=head+Vector((0,length*math.cos(local_lean),-length*math.sin(local_lean)))
        head=put(name,head,tail,Quaternion(V((0,1,0)),yaw))
    for side,sign in [('L',-1),('R',1)]:
        p=(t+(0 if side=='L' else .5))%1
        heel_z=.035;lift=0;roll=0
        if moving:
            if p<contact:
                heel_z+=cycle_distance*(p-contact/2)
                roll=(.16 if running else .23)*(1-smoothstep(0,contact*.23,p))
                roll-=(.82 if running else .62)*smoothstep(contact*.62,contact,p)
            else:
                swing=(p-contact)/(1-contact);u=swing;u2=u*u;u3=u2*u
                start=cycle_distance*contact/2;velocity=cycle_distance*(1-contact)
                # Match stance velocity at each end instead of stopping both
                # feet at a smoothstep endpoint and abruptly reversing them.
                heel_z+=(2*u3-3*u2+1)*start+(u3-2*u2+u)*velocity+(-2*u3+3*u2)*(-start)+(u3-u2)*velocity
                lift=(.57 if running else .115)*math.sin(math.pi*swing)**(1.45 if running else 1.25)
                roll=(-.82 if running else -.62)+( .98 if running else .85)*smoothstep(0,1,swing)
                roll-=(.32 if running else .09)*math.sin(math.pi*swing)
        foot_rotation=Quaternion(Vector((1,0,0)),roll)
        heel=foot_rotation@Vector((0,-.20,.017));toe=foot_rotation@Vector((0,-.172,-.25))
        # A rigid boot rolls about its low heel first, then its actual toe. The
        # switch is continuous at the angle where both anchors reach the floor.
        toe_contact=toe.y<heel.y
        pivot=toe if toe_contact else heel
        pivot_z=heel_z+(-.267 if toe_contact else 0)
        ankle=Vector((sign*.145,GROUND_SPEC['soleY']+lift-pivot.y,pivot_z-pivot.z))
        hip_joint=P(posed('pelvis')@data['pelvis'].matrix_local.inverted()@data['thigh.'+side].head_local)
        # The flight rig's left forearm and right calf were lengthened to reach
        # the broom. Only ground poses restore matched anatomical segment sizes.
        knee=joint_between(hip_joint,ankle,.625,.635,(0,0,-1))
        put('thigh.'+side,hip_joint,knee,stretch=True);put('calf.'+side,knee,ankle,stretch=True)
        put('foot.'+side,ankle,rotation=Quaternion(V((1,0,0)),roll))
        clavicle='clavicle.'+side
        clav_head=P(posed('chest')@data['chest'].matrix_local.inverted()@data[clavicle].head_local)
        shoulder=clav_head+Vector((sign*.255,.018,-sign*.255*math.sin(chest_yaw)))
        put(clavicle,clav_head,shoulder,stretch=True)
        swing_angle=(.88 if running else .45)*math.cos(phase+(.18*math.pi if running else 0)+(0 if side=='L' else math.pi)) if moving else .035+.012*math.sin(phase+sign)
        bend=(1.52+.10*math.sin(phase+(0 if side=='L' else math.pi))) if running else .34+.05*math.sin(phase+(0 if side=='L' else math.pi)) if walking else .22
        upper=Vector((sign*.07,-math.cos(swing_angle),math.sin(swing_angle))).normalized()
        fore=Vector((-sign*.035,-math.cos(swing_angle-bend),math.sin(swing_angle-bend))).normalized()
        elbow=shoulder+upper*.355;wrist=elbow+fore*.395
        if state=='ground_cast' and side=='R':
            seconds=t*.6;release=smoothstep(.10,.18,seconds)*(1-smoothstep(.30,.60,seconds))
            windup=smoothstep(0,.10,seconds)*(1-smoothstep(.10,.18,seconds))
            wrist+=Vector((-.025*release,.23*windup+.46*release,-.15*windup-.37*release))
            elbow=joint_between(shoulder,wrist,.355,.395,(sign*.2,0,.8));fore=(wrist-elbow).normalized()
        put('upper.'+side,shoulder,elbow,stretch=True);put('fore.'+side,elbow,wrist,stretch=True)
        hand_direction=Vector((fore.x,-math.cos(clamp(swing_angle-bend,-1.98,-.70)),math.sin(clamp(swing_angle-bend,-1.98,-.70)))).normalized() if running else fore
        put('hand.'+side,wrist,wrist+hand_direction*data['hand.'+side].length)
    # The cloth hangs at rest and trails with the hips. Its distal waves lag the
    # shoulders, with greater drag and recovery in the running clip.
    for side,sign in [('L',-1),('C',0),('R',1)]:
        name='cape.'+side+'0';head=P(posed('chest')@data['chest'].matrix_local.inverted()@data[name].head_local)
        for j in range(4):
            name='cape.'+side+str(j);wave=(.016+.018*j)*math.sin(phase-j*.88+sign*.25)*(1.8 if running else 1)
            drag=(.18 if running else .065 if walking else 0)*(j+1)/4
            end=head+Vector((sign*.014+wave*.5,-data[name].length*.94,(.23 if j==0 else .07 if j==1 else .035)+wave+drag))
            head=put(name,head,end)
    head=P(posed('chest')@data['chest'].matrix_local.inverted()@data['scarf.0'].head_local)
    for j in range(4):
        name='scarf.'+str(j);end=head+Vector((.055,-data[name].length*.87,.08+(.055 if running else .018 if walking else 0)+.025*math.sin(phase-j*.8)))
        head=put(name,head,end)
    for side,sign in [('L',-1),('R',1)]:
        name='tail.'+side+'0';head=P(posed('pelvis')@data['pelvis'].matrix_local.inverted()@data[name].head_local)
        for j in range(3):
            name='tail.'+side+str(j);wave=.02*math.sin(phase-j*.8+sign)
            end=head+Vector((sign*.026,-data[name].length*.91,.065+wave+(.095 if running else .03 if walking else 0)))
            head=put(name,head,end)
    return {p.name:p.matrix_basis.copy() for p in bones}

def transition_legs(r,ground,flight,progress):
    data=r.obj.data.bones;bones=r.obj.pose.bones
    def matrix(name,bases=None):
        b=data[name];local=b.matrix_local
        parent=matrix(b.parent.name,bases) if b.parent else Matrix.Identity(4)
        parent_rest=b.parent.matrix_local if b.parent else Matrix.Identity(4)
        return parent@parent_rest.inverted()@local@(bases[name] if bases is not None else bones[name].matrix_basis)
    def put(name,head,tail=None,rotation=None):
        b=data[name];q=b.matrix_local.to_quaternion();scale=Vector((1,1,1))
        if tail is not None:
            direction=V(tail-head);q=(b.tail_local-b.head_local).rotation_difference(direction)@q
            scale=Vector((1,1,1))*(direction.length/b.length)
        if rotation:q=rotation
        parent=matrix(b.parent.name) if b.parent else Matrix.Identity(4)
        bones[name].matrix_basis=b.convert_local_to_pose(Matrix.LocRotScale(V(head),q,scale),b.matrix_local,
            parent_matrix=parent,parent_matrix_local=b.parent.matrix_local if b.parent else Matrix.Identity(4),invert=True)
    for side,s in [('L',-1),('R',1)]:
        amount=smoothstep(.36 if side=='L' else .18,.93 if side=='L' else .82,progress)
        name='foot.'+side;gm=matrix(name,ground);fm=matrix(name,flight)
        ankle=P(gm.translation).lerp(P(fm.translation),amount)
        ankle+=Vector((s*.16,.17,0))*math.sin(math.pi*amount)
        hip=P(matrix('pelvis')@data['pelvis'].matrix_local.inverted()@data['thigh.'+side].head_local)
        ground_hip=P(matrix('thigh.'+side,ground).translation);ground_knee=P(matrix('calf.'+side,ground).translation)
        l1=mix((ground_knee-ground_hip).length,data['thigh.'+side].length,amount)
        l2=mix((P(gm.translation)-ground_knee).length,data['calf.'+side].length,amount)
        axis=ankle-hip;distance=min(axis.length,l1+l2-.001);unit=axis.normalized()
        along=(l1*l1-l2*l2+distance*distance)/(2*distance);pole=Vector((0,0,-1)).lerp(P(matrix('calf.'+side,flight).translation)-hip,amount);pole=(pole-unit*pole.dot(unit)).normalized()
        knee=hip+unit*along+pole*math.sqrt(max(.0001,l1*l1-along*along))
        put('thigh.'+side,hip,knee);put('calf.'+side,knee,ankle)
        put(name,ankle,rotation=gm.to_quaternion().slerp(fm.to_quaternion(),amount))

def animate_ground(r):
    scene=bpy.context.scene
    # Flight frame at t=0 is the exact endpoint shared by the new transitions.
    r.obj.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
    flight={p.name:p.bone.convert_local_to_pose(p.matrix,p.bone.matrix_local,
        parent_matrix=p.parent.matrix if p.parent else Matrix.Identity(4),
        parent_matrix_local=p.parent.bone.matrix_local if p.parent else Matrix.Identity(4),invert=True) for p in r.obj.pose.bones}
    for state,duration in GROUND_ACTIONS.items():
        action=bpy.data.actions.new(state);action.use_fake_user=True;r.obj.animation_data.action=action
        last=round(duration*100)+1
        frames=range(1,last+1)
        for frame in frames:
            t=(frame-1)/(last-1)
            for p in r.obj.pose.bones:
                p.rotation_mode='XYZ';p.matrix_basis=Matrix.Identity(4)
                for constraint in p.constraints:
                    constraint.influence=0;constraint.keyframe_insert(data_path='influence',frame=frame)
            if state in ['mount','dismount']:
                ground=ground_pose(r,'ground_idle',0)
                amount=smoothstep(.12,.88,t if state=='mount' else 1-t)
                for p in r.obj.pose.bones:
                    ga,gq,gs=ground[p.name].decompose();fa,fq,fs=flight[p.name].decompose()
                    local=smoothstep(.05,.57,t if state=='mount' else 1-t) if p.name.startswith('hand.') else amount
                    p.matrix_basis=Matrix.LocRotScale(ga.lerp(fa,local),gq.slerp(fq,local),gs.lerp(fs,local))
                transition_legs(r,ground,flight,t if state=='mount' else 1-t)
            else:ground_pose(r,state,t)
            for p in r.obj.pose.bones:
                p.keyframe_insert(data_path='rotation_euler',frame=frame,group=p.name)
                p.keyframe_insert(data_path='location',frame=frame,group=p.name)
                p.keyframe_insert(data_path='scale',frame=frame,group=p.name)
        print('GROUND_ACTION_AUTHORED',state,duration)
    r.obj.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)

def consolidate(r):
    """Merge by principal material, preserving all named cloth and socket objects."""
    groups=defaultdict(list);keep={'rider-cape','rider-scarf','rider-mask','rider-hat-brim','rider-hat-crown',
      'Tailored coat torso','Independent set in sleeve L','Independent set in sleeve R',
      'Notched riding lapel -1','Notched riding lapel 1','Claret waistcoat panel -1','Claret waistcoat panel 1','Inset ivory linen shirt'}
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH' or o.name in keep:continue
        groups[('broom' if o.get('broomPart') else '',o.data.materials[0].name)].append(o)
    for (part,mat),objects in groups.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=('rider-broom-' if part else '')+mat
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
    bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,
      export_apply=False,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,
      export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
      export_anim_slide_to_zero=True,export_frame_step=1,export_skins=True,export_all_influences=False,export_def_bones=True)
    raw,data=normalize_sheen(file)
    triangles=0
    for m in data.get('meshes',[]):
        for p in m['primitives']:triangles+=data['accessors'][p['indices']]['count']//3 if 'indices' in p else data['accessors'][p['attributes']['POSITION']]['count']//3
    info={'file':kind+'.glb','triangles':triangles,'bytes':len(raw),'meshes':len(data.get('meshes',[])),'skins':len(data.get('skins',[])),
      'bones':len(r.obj.data.bones),'animations':[a.get('name') for a in data.get('animations',[])],
      'sha256':hashlib.sha256(raw).hexdigest()}
    info['surfaceVariant']=SURFACE
    if kind=='wizard':info['groundMotion']=GROUND_SPEC
    info['actionDurations']={a['name']:max(data['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in data.get('animations',[])}
    if not info['skins'] or len(info['animations'])<(8 if kind=='wizard' else 3):raise RuntimeError('Skeletal export contract failed: '+str(info))
    if triangles>(500000 if kind=='wizard' else 120000) and not QUICK:raise RuntimeError('Triangle budget exceeded: '+str(info))
    if len(raw)>(24000000 if kind=='wizard' else 12000000):raise RuntimeError('GLB byte budget exceeded: '+str(info))
    (OUT/'source').mkdir(exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/(kind+'-academy-rig.blend')),compress=True)
    return info

def studio(r,kind,only_view=None,prefix='character-'):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12 if QUICK else 40;scene.cycles.use_denoising=True
    scene.render.resolution_x=1050;scene.render.resolution_y=1150;scene.render.resolution_percentage=80 if QUICK else 100
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
    if kind=='wizard':views.append(('broom',(-3,.6,.6)))
    if kind=='wizard':views += [('textile',(-.8,.8,-1.8)),('leather',(-1.6,-.52,-.8))]
    if kind=='wraith':views += [('face',(-.38,1.25,-2.8))]
    for label,pos in views:
        if only_view and label!=only_view:continue
        if not only_view and VIEWS and label not in VIEWS:continue
        camera.data.ortho_scale=(4.6 if label=='side' else 3.9) if kind=='wizard' else 3.55
        target=Vector((0,.04,.14)) if kind=='wizard' else Vector((.04,.22,.1))
        if label=='garment':camera.data.ortho_scale=2.15;target=Vector((0,.31,-.29))
        if label=='broom':camera.data.ortho_scale=2.30;target=Vector((0,-.14,1.06))
        if label=='textile':camera.data.ortho_scale=.82;target=Vector((-.04,.52,-.30))
        if label=='leather':camera.data.ortho_scale=.50;target=Vector((-.26,-.67,-.15))
        if label=='face' and kind=='wraith':camera.data.ortho_scale=1.23;target=Vector((0,1.16,-.08))
        camera.location=V(pos);camera.rotation_euler=(V(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(QA/(prefix+kind+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
    if kind=='wizard' and (only_view=='face' or (not only_view and (not VIEWS or 'face' in VIEWS))):
        camera.data.ortho_scale=1.20;camera.location=V((-.55,1.43,-2.7));camera.rotation_euler=(V((0,1.295,-.30))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(QA/(prefix+'wizard-face.png'));bpy.ops.render.render(write_still=True)
    # Actual rig frames establish deformation evidence separate from the base views.
    camera.data.ortho_scale=3.9 if kind=='wizard' else 3.55
    camera.location=V((-4,2,-6));camera.rotation_euler=(V((0,.08,.10))-camera.location).to_track_quat('-Z','Y').to_euler()
    for state in (['boost','turn_left','turn_right','boost_start','boost_end','cast'] if kind=='wizard' else ['approach','channel']):
        if only_view and state!=only_view:continue
        if not only_view and VIEWS and state not in VIEWS:continue
        r.obj.animation_data.action=bpy.data.actions[state];scene.frame_set({'boost_start':16,'boost_end':22,'cast':19}.get(state,134))
        scene.render.filepath=str(QA/(prefix+kind+'-'+state+'.png'));bpy.ops.render.render(write_still=True)
    r.obj.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
    for o in [floor,camera,*lights]:bpy.data.objects.remove(o,do_unlink=True)

def material_comparison(r,kind):
    global SURFACE,M
    original=M.copy();variant=SURFACE
    slots=[(o,i,next((key for key,mat in original.items() if mat==slot.material),None),slot.material)
      for o in bpy.context.scene.objects if o.type=='MESH' for i,slot in enumerate(o.material_slots)]
    for mode in ['authored','scans','hybrid']:
        SURFACE=mode;materials()
        for o,index,key,prior in slots:
            if key:o.material_slots[index].material=M[key]
        for view in ['textile','leather']:studio(r,kind,view,'material-'+mode+'-')
    for o,index,key,prior in slots:o.material_slots[index].material=prior
    SURFACE=variant;M=original

def record_sources():
    file=OUT/'source/sources.json'
    provenance=json.loads(file.read_text())
    texture_manifest=json.loads((ROOT/'world/public/textures/manifest.json').read_text())
    provenance['sources']=[entry for entry in provenance['sources'] if entry.get('assetId') not in ['poly_wool_herringbone','brown_leather']]
    consumed=[]
    for family in ['wool-cloth','dark-leather']:
        source=texture_manifest['materials'][family]
        provenance['sources'].append({key:source[key] for key in ['assetId','title','provider','authors','sourceUrl','license','licenseUrl','tileMeters']})
        for channel in ['color','normal','roughness']:
            asset=source['files'][channel];path=ROOT/'world/public'/asset['path'].lstrip('/')
            digest=hashlib.sha256(path.read_bytes()).hexdigest()
            if digest!=asset['sha256']:raise RuntimeError('Changed retained texture source: '+str(path))
            consumed.append({'file':asset['path'],'bytes':path.stat().st_size,'sha256':digest,'role':channel,'tileMeters':source['tileMeters']})
    generated=provenance['generated']
    generated['originalWork']='Masks, hat, garment cutting, independent sleeves and seams, lapels, cuffs, fitted belt, gravity-shaped split cape, carved/bound broom, guardian layered drapery, rigs, weights, eight flight and six ground rider actions and three guardian actions.'
    generated['materials']='Selected hybrid: linear garment palette multiplied by restrained normalized scan luminance, explicitly encoded to sRGB. Coat, pressed lapel facings and worsted waistcoat use wool scan detail at 0.27 m; leather at 0.40 m. Normal and roughness images remain Non-Color. Satin lining, linen shirt, trousers, scarf and felt retain authored weave. Full authored/scans/hybrid comparisons use identical geometry, lights and cameras.'
    generated['builderSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    generated['textureInputs']=consumed
    generated['groundMotion']=GROUND_SPEC
    generated['actionTimingsSeconds']={'boost_start':.2,'boost_end':.35,'cast':.6,'cast_release':.18}
    generated['rigSourceRecords']=[{'file':name,'bytes':(OUT/'source'/name).stat().st_size,'sha256':hashlib.sha256((OUT/'source'/name).read_bytes()).hexdigest()} for name in generated['rigSources']]
    generated['artReferences']=[{'url':url,'usage':'Reference URL supplied in production brief; no model or texture copied'} for url in
      ['https://www.artstation.com/artwork/39w5PA','https://www.artstation.com/artwork/xDJ9mm','https://ellierpbrown.artstation.com/projects/JvwR5d']]
    file.write_text(json.dumps(provenance,indent=2)+'\n')

summary=[]
for kind,build in [('wizard',wizard),('wraith',wraith)]:
    if ONLY and ONLY!=kind:continue
    clear();materials();rig=build();consolidate(rig);animate(rig,kind)
    if kind=='wizard':animate_ground(rig)
    summary.append(export(rig,kind))
    if not NO_RENDER:studio(rig,kind)
    if MATERIAL_AB and kind=='wizard':material_comparison(rig,kind)
manifest=OUT/'manifest.json'
if ONLY and manifest.exists():
    prior=json.loads(manifest.read_text());summary += [x for x in prior.get('assets',[]) if x['file']!=ONLY+'.glb']
manifest.write_text(json.dumps({'generator':'Blender 5.1.2; production v3 independent garment patterns, masked rider, gravity cape, hybrid scanned surfaces and fourteen baked rider actions','coordinateSystem':'Y up; forward -Z','assets':summary},indent=2)+'\n')
record_sources()
print('CHARACTER_ASSETS_COMPLETE '+json.dumps(summary))
