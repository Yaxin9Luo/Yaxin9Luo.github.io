"""Original fantasy characters using a CC0 Blender Studio head and Poly Haven PBR."""
import bpy, bmesh, math, random, json, sys, hashlib
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'world/public/models/characters'
QA = ROOT.parent / 'qa'
OUT.mkdir(parents=True, exist_ok=True); QA.mkdir(parents=True, exist_ok=True)
PREVIEW = "--preview" in sys.argv
random.seed(417)
TAU = math.tau
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials): bpy.data.materials.remove(data)

def v(p): return Vector((p[0], -p[2], p[1]))
def image(name, color, kind='cloth'):
    n = 256; yy, xx = np.mgrid[0:n,0:n].astype(float); u=xx/n; w=yy/n
    rng=np.random.default_rng(88)
    noise=rng.normal(0, .015, (n,n))
    if kind=='wood':
        bands=np.sin((u*25 + .16*np.sin(w*TAU*2)+.05*np.sin(w*TAU*7))*TAU)
        grain=.83+.12*bands+.035*np.sin((u*93+.3*np.sin(w*TAU))*TAU)+noise
    elif kind=='leather':
        grain=.92+noise*2+.045*np.sin(u*TAU*19)*np.sin(w*TAU*17)
    else:
        weave=(np.sin(u*TAU*64)*np.sin(w*TAU*64))
        grain=.91+.07*weave+noise+.025*np.sin((u+w)*TAU*3)
    pixels=np.ones((n,n,4),dtype=np.float32)
    for k in range(3): pixels[:,:,k]=np.clip(color[k]*grain,0,1)
    im=bpy.data.images.new(name,width=n,height=n,alpha=True)
    im.pixels.foreach_set(pixels.ravel()); im.pack(); return im

pbr_images={}
def pbr_image(folder,channel):
    key=(folder,channel)
    if key not in pbr_images:
        path=ROOT/'world/public/textures'/folder/(channel+'.webp')
        im=bpy.data.images.load(str(path),check_existing=True)
        if channel!='color':im.colorspace_settings.name='Non-Color'
        im.pack();pbr_images[key]=im
    return pbr_images[key]

def mat(name, color, rough=.7, metal=0, kind=None, emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    if kind in {'cloth','leather'}:
        folder='wool-cloth' if kind=='cloth' else 'dark-leather'
        # Real CC0 scanned albedo, OpenGL normal and roughness maps from Poly Haven.
        uv=m.node_tree.nodes.new('ShaderNodeTexCoord');mapping=m.node_tree.nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value=(3.7,3.7,1) if kind=='cloth' else (2.5,2.5,1)
        m.node_tree.links.new(uv.outputs['UV'],mapping.inputs['Vector'])
        nodes={}
        for channel in ['color','normal','roughness']:
            tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=pbr_image(folder,channel);nodes[channel]=tex
            m.node_tree.links.new(mapping.outputs['Vector'],tex.inputs['Vector'])
        tint=m.node_tree.nodes.new('ShaderNodeMix');tint.data_type='RGBA';tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1
        tint.inputs[7].default_value=(*color,1) if kind=='cloth' else (.25,.24,.22,1)
        m.node_tree.links.new(nodes['color'].outputs['Color'],tint.inputs[6]);m.node_tree.links.new(tint.outputs[2],bs.inputs['Base Color'])
        normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.75 if kind=='cloth' else .55
        m.node_tree.links.new(nodes['normal'].outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
        m.node_tree.links.new(nodes['roughness'].outputs['Color'],bs.inputs['Roughness'])
    elif kind:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image(name+'-albedo',color,kind);m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    return m

M={
 'coat':mat('Midnight tailored wool',(.11,.23,.32),.9,kind='cloth'),
 'coatEdge':mat('Blue black tailored seams',(.11,.19,.24),.9,kind='cloth'),
 'lining':mat('Oxblood silk lining',(.285,.059,.09),.6,kind='cloth'),
 'scarf':mat('Burgundy woven scarf',(.37,.062,.1),.84,kind='cloth'),
 'goldcloth':mat('Ochre scarf threads',(.72,.47,.16),.82,kind='cloth'),
 'shirt':mat('Ivory linen collar',(.7,.68,.59),.86,kind='cloth'),
 'pants':mat('Dark fitted trousers',(.075,.095,.103),.85,kind='cloth'),
 'leather':mat('Weathered boot leather',(.07,.048,.033),.75,kind='leather'),
 'belt':mat('Waxed brown leather',(.13,.084,.05),.75,kind='leather'),
 'wood':mat('Walnut broom shaft',(.44,.24,.105),.42,kind='wood'),
 'twig':mat('Birch broom twigs',(.51,.34,.16),.79,kind='wood'),
 'twigDark':mat('Dark broom twigs',(.30,.16,.065),.86,kind='wood'),
 'brass':mat('Aged brass',(.54,.35,.12),.35,.77),
 'skin':mat('Natural warm skin',(.50,.315,.215),.67),
 'lip':mat('Lips and ear shade',(.36,.17,.13),.71),
 'hair':mat('Dark chestnut hair',(.009,.005,.003),.95),
 'eye':mat('Dark iris',(.017,.026,.025),.25),
 'white':mat('Eye ivory',(.47,.44,.4),.4),
 'wraith':mat('Midnight spectral mantle',(.075,.15,.35),.92,kind='cloth'),
 'wraithEdge':mat('Moon blue silk',(.13,.26,.45),.87,kind='cloth'),
 'void':mat('Hood darkness',(.0003,.0005,.0009),1),
 'spirit':mat('Icy spectral eyes',(.15,.63,.88),.35,emission=3),
 'ivory':mat('Ancient ivory porcelain',(.61,.59,.49),.48),
 'embroidery':mat('Antique gold embroidery',(.53,.34,.12),.68,.30),
 'iris':mat('Amber brown iris',(.12,.071,.026),.37),
 'pupil':mat('Black pupil',(.003,.004,.005),.22),
}

def mesh(name,verts,faces,material,subdiv=0,smooth=True,uv=None):
    data=bpy.data.meshes.new(name);data.from_pydata([v(p) for p in verts],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)
    for p in data.polygons:p.use_smooth=smooth
    layer=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        for li in p.loop_indices:
            vi=data.loops[li].vertex_index
            if uv: layer.data[li].uv=uv[vi]
            else:
                point=verts[vi];layer.data[li].uv=(point[0]*2+point[2]*.7,point[1]*2)
    if subdiv:
        mod=obj.modifiers.new('Tailored surface smoothing','SUBSURF');mod.levels=subdiv;mod.render_levels=subdiv
    return obj

def loft(name,rings,material,segments=24,fold=0,subdiv=1,caps=True):
    verts=[];uv=[]
    for j,(cx,cy,cz,rx,rz) in enumerate(rings):
        for i in range(segments):
            a=i/segments*TAU;f=1+fold*math.cos(a*9+j*.75)
            verts.append((cx+math.sin(a)*rx*f,cy,cz-math.cos(a)*rz*f));uv.append((i/segments*math.pi*(rx+rz),cy-rings[0][1]))
    faces=[]
    for j in range(len(rings)-1):
        for i in range(segments): faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    if caps:faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+i for i in range(segments))])
    return mesh(name,verts,faces,material,subdiv,uv=uv)

def tube(name,points,radii,material,sides=10,subdiv=1,oval=1):
    verts=[];uv=[];pts=[Vector(p) for p in points];lengths=[0]
    for k in range(1,len(pts)):lengths.append(lengths[-1]+(pts[k]-pts[k-1]).length)
    for j,point in enumerate(pts):
        tangent=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized();ref=Vector((0,0,1))
        if abs(tangent.dot(ref))>.93:ref=Vector((1,0,0))
        x=tangent.cross(ref).normalized();y=tangent.cross(x).normalized()
        for i in range(sides):
            a=i/sides*TAU;rr=radii[j]*(1+.05*math.sin(a*5+j*2)) if material in [M['coat'],M['wraith']] else radii[j];co=point+x*math.cos(a)*rr+y*math.sin(a)*rr*oval;verts.append(tuple(co));uv.append((i/sides,j/(len(pts)-1)) if material in [M['wood'],M['twig'],M['twigDark']] else (i/sides*TAU*radii[j],lengths[j]))
    faces=[]
    for j in range(len(pts)-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    faces+=[tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+i for i in range(sides))]
    return mesh(name,verts,faces,material,subdiv,uv=uv)

def tailored_sleeve(name,points,radii,material,oval=.78,phase=0):
    verts=[];uv=[];pts=[Vector(p) for p in points];sides=20;distance=0
    samples=[]
    for j in range(len(pts)-1):
        for k in range(4):
            t=k/4;samples.append((pts[j].lerp(pts[j+1],t),radii[j]*(1-t)+radii[j+1]*t,(j+t)/(len(pts)-1)))
    samples.append((pts[-1],radii[-1],1))
    for j,(point,radius,t) in enumerate(samples):
        if j:distance+=(point-samples[j-1][0]).length
        tangent=(samples[min(j+1,len(samples)-1)][0]-samples[max(0,j-1)][0]).normalized()
        x=tangent.cross(Vector((0,0,1))).normalized();y=tangent.cross(x).normalized()
        for i in range(sides):
            a=i/sides*TAU
            elbow=math.exp(-((t-.55)/.17)**2);cuff=math.exp(-((t-.89)/.10)**2)
            folds=(.065*math.sin(a*3+phase)+.025*math.sin(a*7+t*6)+.15*elbow*math.sin(t*57+a*2)+.085*cuff*math.sin(t*89+a*2.5))
            rr=radius*(1+folds);co=point+x*math.cos(a)*rr+y*math.sin(a)*rr*oval
            verts.append(tuple(co));uv.append((i/sides*TAU*radius,distance))
    faces=[]
    for j in range(len(samples)-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(samples)-1)*sides+i for i in range(sides))])
    return mesh(name,verts,faces,material,1,uv=uv)

def curve(name,points,thickness,material,res=2):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=4;data.bevel_depth=thickness;data.bevel_resolution=res
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for b,p in zip(spline.bezier_points,points):b.co=v(p);b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(material);return obj

def ellipsoid(name,point,scale,material,segments=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=v(point));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    return o

def empty(name,point):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=v(point);return o

def cloth_panel(name,top,bottom,width,material,rows=12,cols=14,flutter=.05,ragged=False):
    vertices=[];uv=[]
    for j in range(rows+1):
        t=j/rows
        for i in range(cols+1):
            u=i/cols;cx=top[0]*(1-t)+bottom[0]*t;cy=top[1]*(1-t)+bottom[1]*t;cz=top[2]*(1-t)+bottom[2]*t
            x=cx+(u-.5)*width*(.55+.45*t)+math.sin(t*3.1)*flutter*.25;fold=math.sin(u*math.pi*2.3+t*1.9)+.38*math.sin(u*math.pi*5.1-t*2.6);y=cy+fold*flutter*t-.075*math.sin(t*math.pi);z=cz+fold*flutter*(.4+t)
            if ragged and j==rows:y-=.13*(i%3==0)+.03*math.sin(i*7)
            vertices.append((x,y,z));uv.append((u*width,t*(Vector(bottom)-Vector(top)).length))
    faces=[]
    for j in range(rows):
        for i in range(cols):
            k=j*(cols+1)+i;faces.append((k,k+1,k+cols+2,k+cols+1))
    o=mesh(name,vertices,faces,material,1,uv=uv);mod=o.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.009
    if name.startswith('Coat tail') or name=='rider-cape':
        for side in ([0,cols//2,cols] if name=='rider-cape' else [0,cols]):
            points=[(vertices[j*(cols+1)+side][0],vertices[j*(cols+1)+side][1],vertices[j*(cols+1)+side][2]+.006) for j in range(0,rows+1,2)]
            curve(name+' sewn edge '+str(side),points,.0025,M['coatEdge'],1)
    return o

def button(name,p,r=.022):return ellipsoid(name,p,(r,r,.008),M['brass'],12,6)

def researcher_head():
    """Real anatomical topology; the source is Blender Studio's CC0 asset bundle."""
    source=OUT/'source/blender-studio-head-cc0.blend'
    with bpy.data.libraries.load(str(source)) as (_, data):
        data.objects=['GEO-head_animation_realistic','GEO-head_animation_realistic.sclera.R','GEO-head_animation_realistic.sclera.L','GEO-head_animation_realistic.iris.R','GEO-head_animation_realistic.iris.L']
    head_objects=list(data.objects)
    for o in head_objects:bpy.context.collection.objects.link(o)
    bpy.context.view_layer.update()
    head=next(o for o in head_objects if o.name=='GEO-head_animation_realistic')
    inv=head.matrix_world.inverted();scale=1.45
    def mapped(co):return Vector((co.x*scale,-co.y*scale+.12,.79+(co.z-.04)*scale))
    bm=bmesh.new();bm.from_mesh(head.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<.108],context='VERTS');bm.to_mesh(head.data);bm.free()
    for vert in head.data.vertices:
        if vert.co.z<.16:
            radius=.060+.06*(vert.co.z-.108)
            vert.co.x=max(-radius,min(radius,vert.co.x))
    original=[v.co.copy() for v in head.data.vertices]
    # Natural variations in a vertex-color layer, including subtle lips and cheek warmth.
    color=head.data.color_attributes.new(name='SkinTone',type='FLOAT_COLOR',domain='POINT')
    for i,co in enumerate(original):
        cheek=math.exp(-((abs(co.x)-.046)/.026)**2-((co.z-.253)/.03)**2)*max(0,min(1,-co.y*12))
        lip=math.exp(-(co.x/.03)**6-((co.z-.212)/.009)**2)*max(0,min(1,(-co.y-.08)*35))
        beard=math.exp(-(co.x/.052)**4-((co.z-.195)/.027)**2)*max(0,min(1,(-co.y-.085)*23))
        noise=.015*math.sin(co.x*1257+co.z*865)
        base=np.array([.49,.302,.205])+np.array([.04,-.015,-.01])*cheek+np.array([-.075,-.10,-.06])*lip-np.array([.035,.026,.014])*beard+noise
        color.data[i].color=(*np.clip(base,0,1),1)
    skin=M['skin'];nodes=skin.node_tree.nodes;bs=nodes.get('Principled BSDF');vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='SkinTone';skin.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
    bs.inputs['Subsurface Weight'].default_value=.045
    bs.inputs['Specular IOR Level'].default_value=.24
    M['hair'].node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.08
    # The actual anatomical cranium also defines the hair cap.
    hair_faces=[]
    for poly in head.data.polygons:
        good=True
        for index in poly.vertices:
            co=original[index];threshold=.273+.098*max(0,min(1,(-co.y+.02)/.15))+.008*math.sin(co.x*46+1.1)
            if co.z<threshold or (abs(co.x)>.085 and co.z<.315):good=False;break
        if good:hair_faces.append(tuple(poly.vertices))
    used=sorted({i for f in hair_faces for i in f});remap={i:j for j,i in enumerate(used)}
    verts=[]
    for i in used:
        co=original[i];normal=head.data.vertices[i].normal
        bump=.004+.003*math.sin(co.x*35+co.y*14)*math.sin(co.z*35)
        p=mapped(co+normal*bump);verts.append((p.x,p.z,-p.y))
    hair=mesh('Anatomical fitted hair cap',verts,[tuple(remap[i] for i in f) for f in hair_faces],M['hair'],1)
    # Cortu Johnstone's CC0 textured hair cards, refitted to the realistic cranium.
    src=OUT/'source/cortu-short-messy-hair';hairverts=[];hairuv=[];hairfaces=[]
    for line in (src/'short_messy.obj').read_text().splitlines():
        items=line.split()
        if not items:continue
        if items[0]=='v':hairverts.append((float(items[1])*.154,1.05+(float(items[2])-5.9282)*.174,-float(items[3])*.185-.12))
        elif items[0]=='vt':hairuv.append(tuple(map(float,items[1:3])))
        elif items[0]=='f':hairfaces.append([tuple(int(x)-1 for x in token.split('/')[:2]) for token in items[1:]])
    hairmat=mat('Cortu natural chestnut hair cards',(.08,.05,.026),.78)
    nodes=hairmat.node_tree.nodes;bs=nodes.get('Principled BSDF');tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(src/'short_messy_diff.png'));tex.image.pack()
    mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[7].default_value=(.034,.021,.013,1)
    hairmat.node_tree.links.new(tex.outputs['Color'],mix.inputs[6]);hairmat.node_tree.links.new(mix.outputs[2],bs.inputs['Base Color']);hairmat.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
    bs.inputs['Specular IOR Level'].default_value=.15;hairmat.surface_render_method='DITHERED';hairmat.use_transparent_shadow=True
    data=bpy.data.meshes.new('Natural short messy hair cards');data.from_pydata([v(p) for p in hairverts],[],[[p[0] for p in face] for face in hairfaces]);data.update();layer=data.uv_layers.new(name='UVMap')
    for poly,face in zip(data.polygons,hairfaces):
        poly.use_smooth=True
        for li,(_,ui) in zip(poly.loop_indices,face):layer.data[li].uv=hairuv[ui]
    obj=bpy.data.objects.new('Cortu CC0 short messy hair',data);bpy.context.collection.objects.link(obj);obj.data.materials.append(hairmat)
    sub=obj.modifiers.new('Soft hair card curves','SUBSURF');sub.levels=1;sub.render_levels=1
    back=obj.copy();back.data=obj.data.copy();bpy.context.collection.objects.link(back);back.name='Cortu refitted back hair cards'
    for vert in back.data.vertices:
        vert.co.x*=-.95;vert.co.y=.24-.95*vert.co.y;vert.co.z-=.018
    # Keep source ocular anatomy and transform every mesh in the same anatomical frame.
    for o in head_objects:
        local=inv@o.matrix_world
        if 'sclera' in o.name:
            o.data.materials.clear()
            for material in [M['white'],M['iris'],M['pupil']]:o.data.materials.append(material)
            for poly in o.data.polygons:
                co=poly.center;rad=math.hypot(co.x,co.z)
                poly.material_index=2 if co.y<-.01 and rad<.0045 else 1 if co.y<-.01 and rad<.0092 else 0
        for vert in o.data.vertices:vert.co=mapped(local@vert.co)
        o.matrix_world.identity()
        if 'sclera' not in o.name:
            o.data.materials.clear();o.data.materials.append(M['skin'] if o==head else M['eye'])
        o.name='Blender Studio anatomical '+('head' if o==head else o.name.rsplit('.',2)[-2]+'.'+o.name[-1])
        for p in o.data.polygons:p.use_smooth=True
        sub=o.modifiers.new('Anatomical surface subdivision','SUBSURF');sub.levels=1;sub.render_levels=1
    # Eyebrows follow the real brow ridge rather than floating in front of the face.
    bpy.context.view_layer.update();face=BVHTree.FromObject(head,bpy.context.evaluated_depsgraph_get())
    for side in [-1,1]:
        pts=[]
        for j in range(7):
            x=side*(.026+j*.010);y=1.189+.010*math.sin(j/6*math.pi)-.013*j/6
            hit=face.ray_cast(v((x,y,-1)),v((0,0,1)),2)[0]
            if hit:pts.append((x,y,-hit.y-.002))
        if pts:curve('Natural tapered brow '+str(side),pts,.0019,M['hair'],1)

def standing_collar():
    verts=[];faces=[];sides=36;rows=5
    # Open in the front, rising gently at the nape with a folded gold edge.
    for j in range(rows+1):
        t=j/rows
        for i in range(sides+1):
            a=.45+i/sides*(TAU-.9);r=.125+.075*t
            verts.append((math.sin(a)*r,.835+t*(.115+.025*math.cos(a)), -.15-math.cos(a)*r*.70))
    for j in range(rows):
        for i in range(sides):k=j*(sides+1)+i;faces.append((k,k+1,k+sides+2,k+sides+1))
    o=mesh('Standing tailored collar',verts,faces,M['coat'],1);m=o.modifiers.new('Sewn collar thickness','SOLIDIFY');m.thickness=.008
    curve('Standing collar gold piping',verts[-(sides+1):],.003,M['embroidery'],1)

def flowing_cape():
    rows=40;cols=40
    def point(u,t,inside=0):
        # Wide shoulder attachment, widening fan of cloth and a wind-lifted asymmetrical hem.
        q=u*2-1;width=.32+.39*math.sin(t*math.pi*.63)
        x=q*width+.09*math.sin(t*2.4)*t
        fold=(.045*math.sin(q*8.0+t*.5)+.022*math.sin(q*14.0-t*1.7))*math.sin(t*math.pi*.85)
        y=.79-1.05*t+.07*math.sin(t*math.pi)+fold-.18*q*q*(.2+.8*t)+.07*q*t
        z=.015+1.34*t-.12*q*q*(1-t)+.10*math.sin(q*4+t*2.6)*t+inside
        return (x,y,z)
    verts=[point(i/cols,j/rows) for j in range(rows+1) for i in range(cols+1)]
    uv=[(i/cols*1.5,j/rows*1.7) for j in range(rows+1) for i in range(cols+1)]
    faces=[]
    for j in range(rows):
        for i in range(cols):k=j*(cols+1)+i;faces.append((k,k+1,k+cols+2,k+cols+1))
    cape=mesh('rider-cape',verts,[tuple(reversed(f)) for f in faces],M['coat'],1,uv=uv);cape.data.materials.append(M['lining'])
    solid=cape.modifiers.new('Lined heavy wool cape','SOLIDIFY');solid.thickness=.009;solid.material_offset=1;solid.material_offset_rim=1;solid.offset=-1
    for side in [0,1]:
        for offset in [.006,.025]:
            u=offset if side==0 else 1-offset
            curve('rider-cape embroidered border '+str(side)+str(offset),[point(u,j/32,.012) for j in range(33)],.0027,M['embroidery'],1)
    for t in [.973,.993]:curve('rider-cape embroidered hem '+str(t),[point(i/48,t,.012) for i in range(49)],.0027,M['embroidery'],1)
    # Small celestial stitchwork is evaluated on the cloth surface itself.
    for u0 in [.19,.5,.79]:
        t0=.79 if u0!=.5 else .72
        for rad in [.047,.066]:curve('rider-cape astrolabe embroidery', [point(u0+rad*math.cos(a),t0+rad*.65*math.sin(a),.013) for a in np.linspace(0,TAU,37)],.0013,M['embroidery'],1)
        curve('rider-cape constellation spoke',[point(u0-.075,t0,.013),point(u0+.075,t0,.013)],.0013,M['embroidery'],1)
        curve('rider-cape constellation spoke',[point(u0,t0-.05,.013),point(u0,t0+.05,.013)],.0013,M['embroidery'],1)
    # Small matching brooches and a slack chain keep the front garment restrained.
    for side in [-1,1]:button('Antique cape brooch',(side*.115,.775,-.30),.017)
    curve('Fine cape fastening chain',[(-.115,.775,-.306),(-.06,.744,-.329),(0,.732,-.34),(.06,.744,-.329),(.115,.775,-.306)],.0022,M['embroidery'],1)


def wizard():
    objects_before=set(bpy.data.objects)
    # The upper sleeve starts inside the shoulder shell, without a ball-like cap.
    coat=loft('Tailored charcoal coat',[(0,.01,.04,.25,.15),(0,.08,.01,.22,.145),(0,.25,-.025,.205,.145),(0,.43,-.075,.235,.166),(0,.64,-.13,.275,.172),(0,.78,-.155,.27,.15),(0,.83,-.16,.215,.13),(0,.86,-.16,.135,.10)],M['coat'],32,.018,1)
    bpy.context.view_layer.update()
    front=BVHTree.FromObject(coat,bpy.context.evaluated_depsgraph_get())
    def coat_point(x,y,lift=.008):
        hit=front.ray_cast(v((x,y,-2)),v((0,0,1)),4)[0]
        if hit is None:raise ValueError('Coat panel left the torso surface')
        return (x,y,-hit.y-lift)
    # Dense ruled patches conform to the evaluated coat, rather than crossing ngons.
    vv=[];ff=[];rows=12;cols=6
    for j in range(rows+1):
        t=j/rows;y=.24+t*.49;width=.10-.025*t
        for i in range(cols+1):vv.append(coat_point((i/cols*2-1)*width,y,.006))
    for j in range(rows):
        for i in range(cols):k=j*(cols+1)+i;ff.append((k,k+1,k+cols+2,k+cols+1))
    mesh('Conforming charcoal waistcoat',vv,ff,M['pants'])
    for s in [-1,1]:
        vv=[];ff=[];edge=[];rows=15;cols=4
        for j in range(rows+1):
            t=j/rows;y=.78-.35*t;inner=.067*(1-t)+.024*t;outer=.208*(1-t)+.045*t
            for i in range(cols+1):vv.append(coat_point(s*(inner+(outer-inner)*i/cols),y,.015+.003*math.sin(i/cols*math.pi)))
            edge.append(coat_point(s*inner,y,.019))
        for j in range(rows):
            for i in range(cols):k=j*(cols+1)+i;ff.append((k,k+1,k+cols+2,k+cols+1))
        lapel=mesh('Fitted rolled lapel '+str(s),vv,ff,M['coatEdge'])
        solid=lapel.modifiers.new('Lapel sewn thickness','SOLIDIFY');solid.thickness=.004
        curve('Fine lapel seam '+str(s),edge[::3],.002,M['coatEdge'],1)
        arm=[(s*.235,.765,-.13),(s*.279,.714,-.17),(s*.304,.63,-.225),(s*.327,.535,-.30),(s*.348,.437,-.377),(s*.354,.411,-.401),(s*.335,.381,-.445),(s*.274,.30,-.60),(s*.187,.215,-.708),(s*.10,.12,-.80)]
        sleeve=tailored_sleeve('Tailored coat sleeve '+str(s),arm,[.070,.087,.083,.077,.061,.065,.068,.071,.064,.058],M['coat'],.80,s*.4)
        # A quiet raised seam follows the outer sleeve, with the elbow compressed.
        bpy.context.view_layer.update();sleeve_surface=BVHTree.FromObject(sleeve,bpy.context.evaluated_depsgraph_get());seam=[]
        for cx,cy,cz in arm[1:-1]:
            hit=sleeve_surface.ray_cast(v((cx,cy,-2)),v((0,0,1)),4)[0]
            if hit:seam.append((cx,cy,-hit.y-.002))
        curve('Sleeve sewn seam '+str(s),seam,.0018,M['coatEdge'],1)
        tube('Leather cuff '+str(s),[(s*.123,.17,-.762),(s*.103,.13,-.79),(s*.086,.08,-.823)],[.061,.061,.055],M['leather'],16,1)
        # Anatomical palms and four curled fingers close around the handle.
        ellipsoid('Gloved palm '+str(s),(s*.066,.055,-.858),(.065,.073,.054),M['leather'],20,10)
        for j in range(4):
            z=-.832-j*.025;curve('Curled finger '+str(s)+str(j),[(s*.082,.08,z),(s*.028,.037,z-.015),(s*.016,-.01,z-.012),(s*.062,-.029,z)],.012,M['leather'],2)
        curve('Opposing thumb '+str(s),[(s*.10,.10,-.845),(s*.039,.092,-.89),(s*.013,.055,-.91)],.017,M['leather'],2)
        # Bent thighs and calves, with shaped knees rather than straight cylinders.
        tube('Trousers leg '+str(s),[(s*.16,.025,.04),(s*.29,-.17,-.08),(s*.355,-.405,-.33),(s*.36,-.475,-.36),(s*.37,-.72,-.12)],[.155,.14,.12,.105,.076],M['pants'],14,1,.8)
        tube('Riding boot shaft '+str(s),[(s*.37,-.61,-.19),(s*.374,-.77,-.11),(s*.38,-.94,-.08),(s*.38,-1.0,-.12)],[.087,.083,.078,.08],M['leather'],14,1,.8)
        # Foot: narrow ankle, defined heel, long rounded toe and sole.
        loft('Sculpted riding boot '+str(s),[(s*.38,-1.075,-.245,.093,.208),(s*.38,-1.04,-.25,.095,.218),(s*.38,-.986,-.238,.092,.207),(s*.38,-.94,-.16,.066,.115)],M['leather'],24,0,1)
        loft('Boot layered sole '+str(s),[(s*.38,-1.09,-.245,.095,.213),(s*.38,-1.077,-.245,.098,.217),(s*.38,-1.063,-.245,.096,.214)],M['pants'],24,0,0)
        curve('Boot side seam '+str(s),[(s*.443,-.69,-.19),(s*.452,-.89,-.17),(s*.455,-1.02,-.32)],.0035,M['belt'],1)
        # Individual split coat-tails flow behind the saddle with cloth folds.
        cloth_panel('Coat tail '+str(s),(s*.12,.16,.13),(s*.25,-.48+.08*s,1.02+.09*s),.48,M['coat'],14,16,.035)
        cloth_panel('Burgundy tail lining '+str(s),(s*.12,.14,.115),(s*.25,-.492+.08*s,1.003+.09*s),.43,M['lining'],12,14,.028)
    # Wide belt conforming to waist with buckle and keeper.
    loft('Waist leather belt',[(0,.16,-.023,.22,.153),(0,.20,-.027,.215,.151),(0,.245,-.036,.21,.151)],M['belt'],32,0,0)
    curve('Rectangular brass buckle',[(-.058,.164,-.194),(.057,.164,-.194),(.057,.231,-.203),(-.058,.231,-.203),(-.058,.164,-.194)],.009,M['brass'],1)
    for yy in [.31,.405,.50,.595]:button('Waistcoat button',coat_point(0,yy,.021),.014)
    for s in [-1,1]:curve('Welt pocket '+str(s),[coat_point(s*.075,.28,.012),coat_point(s*.155,.285,.012)],.005,M['coatEdge'],1)
    researcher_head()
    standing_collar()
    # Scarf collar, long trailing burgundy silk, woven ochre stripes and fringe.
    loft('Burgundy scarf collar',[(0,.855,-.173,.113,.091),(0,.90,-.175,.118,.094),(0,.953,-.197,.109,.093)],M['scarf'],28,.014,1)
    for yy in [.872,.922]:loft('Scarf collar gold thread',[(0,yy,-.185,.116,.094),(0,yy+.016,-.185,.116,.095)],M['goldcloth'],28,0,0)
    scarf=cloth_panel('rider-scarf',(.12,.92,-.04),(.30,.76,.98),.18,M['scarf'],36,8,.02)
    scarf.data.materials.append(M['goldcloth'])
    for face in scarf.data.polygons:
        if face.index//8 in [11,17,29,33]:face.material_index=1
    for i,vertex in enumerate(list(scarf.data.vertices)[-9:]):
        co=vertex.co;point=(co.x,co.z,-co.y)
        curve('Scarf fringe '+str(i),[point,(point[0]+.002*math.sin(i),point[1]-.024,point[2]+.034)],.0018,M['goldcloth'],1)
    # Broom shaft has a curved handle, leather grip, ferrules and a dense twig head.
    shaft=[(0,.06,-1.73),(.015,.01,-1.56),(0,-.025,-1.12),(0,-.075,-.42),(0,-.365,.42),(0,-.36,1.24)]
    tube('Curved walnut broom shaft',shaft,[.045,.05,.045,.045,.05,.06],M['wood'],16,1)
    for j in range(14):
        z=-1.52+j*.027
        curve('Leather handle wrap '+str(j),[(math.sin(a)*.051,.008+math.cos(a)*.052,z+(a/TAU)*.024) for a in np.linspace(0,TAU,17)],.006,M['belt'],1)
    for z in [.94,1.08]:
        tube('Broom brass ferrule',[(0,-.361,z-.025),(0,-.361,z),(0,-.361,z+.025)],[.132,.135,.13],M['brass'],24,0)
    for i in range(72):
        a=i/72*TAU;r=.11+random.random()*.19;length=1.78+random.random()*.28
        p=[(math.sin(a)*.055,-.36+math.cos(a)*.055,.87),(math.sin(a)*r*.6,-.36+math.cos(a)*r*.4,1.28),(math.sin(a)*r,-.43+math.cos(a)*r*.6,1.70),(math.sin(a)*r*.78,-.47+math.cos(a)*r*.45,length)]
        tube('Birch bristle '+str(i),p,[.017,.014,.011,.0025],M['twig'] if i%3 else M['twigDark'],5,0)
    # Bound field-notebook pouch and restrained brass fittings.
    pouch=loft('Belt field notebook pouch',[(.224,.13,.025,.079,.105),(.229,.20,.024,.086,.11),(.223,.34,.018,.076,.10)],M['belt'],16,0,1)
    curve('Pouch flap seam',[(.29,.275,-.062),(.292,.26,.095),(.20,.25,.13)],.004,M['coatEdge'],1)
    button('Pouch clasp',(.283,.253,-.059),.018)
    curve('Carved wand',[(.10,.105,-.88),(.11,.14,-1.17),(.105,.18,-1.62)],.016,M['wood'],2)
    for z in [-.92,-.965]:ellipsoid('Wand brass ring',(.10,.11,z),(.025,.025,.014),M['brass'],12,6)
    empty('wandTip',(.105,.18,-1.64));empty('broomTail',(0,-.45,1.99))
    # Cape is a separate shoulder mantle anchored for subtle engine cloth motion.
    flowing_cape()
    unify_coat()
    return list(set(bpy.data.objects)-objects_before)

def wraith():
    before=set(bpy.data.objects)
    # Slender, flowing silhouette with longitudinal gravity folds and an open tapered hem.
    rows=32;sides=64
    def robe(a,t):
        phase=a+.18*t
        radius=.245+.14*math.sin(t*math.pi*.8)-.10*t*t
        fold=(.034*math.cos(phase*7+.4)+.015*math.cos(phase*11-1.0))*(.25+.75*t)
        y=.85-2.04*t+(.14*math.sin(a*2+.8)+.09*math.cos(a*3-.5))*t**5
        x=math.sin(a)*(radius+fold)+.10*t*t
        z=-math.cos(a)*(radius+fold)*.68+.22*t*t
        return (x,y,z)
    verts=[robe(i/sides*TAU,j/rows) for j in range(rows+1) for i in range(sides)]
    faces=[]
    for j in range(rows):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    body=mesh('Draped spectral gown',verts,faces,M['wraith'],1,uv=[(i/sides*1.8,j/rows*2) for j in range(rows+1) for i in range(sides)])
    mod=body.modifiers.new('Woven gown thickness','SOLIDIFY');mod.thickness=.006
    for a in [-.48,.48]:
        curve('Long embroidered gown seam',[tuple(Vector(robe(a,t))+Vector((0,0,-.008))) for t in np.linspace(.12,.98,36)],.002,M['embroidery'],1)
    # A continuous shoulder yoke with a gently biased hem, not a scalloped ruff.
    rr=14;cc=64;vv=[];ff=[]
    def yoke(a,t):
        radius=.135+(.375-.135)*math.sin(t*math.pi*.5)
        crease=.013*math.sin(a*6+.7)*math.sin(t*math.pi)
        return (math.sin(a)*(radius+crease),.945+(.655+.045*math.cos(a)-.945)*t, .045-math.cos(a)*(radius+crease)*.66)
    for j in range(rr+1):
        for i in range(cc):vv.append(yoke(i/cc*TAU,j/rr))
    for j in range(rr):
        for i in range(cc):ff.append((j*cc+i,j*cc+(i+1)%cc,(j+1)*cc+(i+1)%cc,(j+1)*cc+i))
    yoke_mesh=mesh('Continuous moon shoulder mantle',vv,ff,M['wraith'],1);so=yoke_mesh.modifiers.new('Mantle woven thickness','SOLIDIFY');so.thickness=.006
    curve('Moon mantle fine gold border',[tuple(Vector(yoke(a,.975))+Vector((0,.003,-.003))) for a in np.linspace(0,TAU,65)],.0025,M['embroidery'],1)
    # The shoulder mantle fans into two swept wings of cloth, rather than rigid human arms.
    def wing(side,u,t):
        width=(.21+.20*math.sin(t*math.pi))*(1-t)**.38+.009
        x=side*(.29+.34*t-.045*t*t+(u-.5)*width)+.05*math.sin(t*4+side)*t
        y=.74-.055*u-1.59*t+.16*math.sin(t*math.pi)+.075*side*t
        z=.04+.36*t+.19*math.sin(u*math.pi)-.15*u+.065*math.sin(t*7+u*3)
        fold=.033*math.sin(u*math.pi*4.5+t*.6)*(.2+.8*t)
        return (x,y+fold,z+fold)
    for side in [-1,1]:
        rr=28;cc=24;vv=[wing(side,i/cc,j/rr) for j in range(rr+1) for i in range(cc+1)];ff=[]
        for j in range(rr):
            for i in range(cc):k=j*(cc+1)+i;ff.append((k,k+1,k+cc+2,k+cc+1))
        o=mesh('Long moon mantle '+str(side),vv,ff,M['wraithEdge'],1,uv=[(i/cc*.7,j/rr*1.7) for j in range(rr+1) for i in range(cc+1)])
        so=o.modifiers.new('Mantle hem thickness','SOLIDIFY');so.thickness=.006
        for u in [.012,.04,.97]:curve('Mantle sewn gold edge',[tuple(Vector(wing(side,u,t))+Vector((0,.004,-.007))) for t in np.linspace(0,1,36)],.0023,M['embroidery'],1)
        # A free tapering streamer with gentle twist gives a clean floating contour.
        rr=30;cc=10;vv=[];ff=[]
        for j in range(rr+1):
            t=j/rr;cx=side*(.18+.20*math.sin(t*2.9))+.05*t;cy=.13-1.52*t;cz=.12+.53*t+.09*math.sin(t*4+side)*t
            width=.105*(1-t)**.7+.005
            for i in range(cc+1):
                u=i/cc*2-1;vv.append((cx+u*width,cy+.04*math.sin(u*3+t*5)*t,cz+.09*u*math.sin(t*4)+.035*math.sin(u*5+t*2)))
        for j in range(rr):
            for i in range(cc):k=j*(cc+1)+i;ff.append((k,k+1,k+cc+2,k+cc+1))
        o=mesh('Tapered spectral streamer '+str(side),vv,ff,M['wraithEdge'],1);so=o.modifiers.new('Fine streamer thickness','SOLIDIFY');so.thickness=.004
    # Deep cloth hood is now proportional to the slender mask and folds into the high collar.
    loft('Close draped cowl',[(0,.70,.07,.215,.14),(0,.89,.045,.19,.18),(0,1.12,.04,.21,.215),(0,1.36,.05,.155,.16),(0,1.48,.06,.04,.06)],M['wraith'],40,.035,1)
    # Original ivory ceremonial mask: convex cheek planes, a nose ridge and almond eye insets.
    rows=36;cols=32
    def mask(u,t,lift=0):
        width=.245*math.sin(math.pi*(.18+.66*t))*(1-.40*t)*(1-.94*t**4)
        x=u*width;y=1.43-.57*t+.06*(1-u*u)*(1-t)**4
        z=-.237-.057*(1-u*u)-.060*math.exp(-(u/.22)**2-((t-.48)/.25)**2)+.035*t*t-lift
        return (x,y,z)
    vv=[mask(i/cols*2-1,j/rows) for j in range(rows+1) for i in range(cols+1)];ff=[]
    for j in range(rows):
        for i in range(cols):
            u=(i+.5)/cols*2-1;t=(j+.5)/rows
            # A continuous ceramic surface avoids stair-stepped holes after simplification.
            k=j*(cols+1)+i;ff.append((k,k+1,k+cols+2,k+cols+1))
    m=mesh('Sculpted ivory moon mask',vv,ff,M['ivory'],1);so=m.modifiers.new('Ceramic mask shell','SOLIDIFY');so.thickness=.012
    for side in [-1,1]:
        eye_center=mask(side*.52,.35,.009)
        ellipsoid('Dark almond eye inset '+str(side),eye_center,(.039,.011,.003),M['void'],24,12)
        eye=ellipsoid('Recessed cyan eye '+str(side),(eye_center[0],eye_center[1],eye_center[2]-.003),(.030,.006,.002),M['spirit'],24,12)
        eye.rotation_euler[1]=side*.10
        for shift in [-.016,.016]:curve('Mask eye engraving '+str(side)+str(shift),[mask(side*u,.348+shift+.02*math.sin((u-.27)*math.pi/.5),.003) for u in np.linspace(.25,.78,15)],.0014,M['embroidery'],1)
        curve('Mask cheek inlay '+str(side),[mask(side*u,t,.003) for u,t in [(.66,.42),(.56,.51),(.33,.69),(.17,.85)]],.0018,M['embroidery'],1)
    curve('Mask central engraved crest',[mask(0,t,.003) for t in np.linspace(.05,.95,23)],.0019,M['embroidery'],1)
    # Two slender, outward-swept moon-crown arms; all original ornamental forms.
    for side in [-1,1]:
        pts=[(side*.13,1.32,-.08),(side*.245,1.42,-.055),(side*.285,1.61,-.045),(side*.235,1.79,-.025),(side*.16,1.86,.015)]
        tube('Antique crescent crown '+str(side),pts,[.023,.025,.016,.009,.0008],M['brass'],10,1,.34)
        curve('Crown moon silver edge '+str(side),[(x,y,z-.008) for x,y,z in pts],.0025,M['ivory'],1)
    # Neck ribbons and a luminous central focus replace the old dangling diamond placard.
    for side in [-1,1]:
        curve('Fine moon shoulder chain '+str(side),[(side*.32,.68,-.14),(side*.25,.52,-.23),(side*.15,.40,-.28),(0,.39,-.29)],.003,M['embroidery'],1)
        for j in range(4):
            xx=side*(.09+j*.05);button('Shoulder chain clasp',(xx,.41+j*.048,-.27+j*.023),.009)
    crystal=mesh('Luminous archive crystal',[(0,.64,-.27),(.065,.51,-.27),(0,.36,-.27),(-.065,.51,-.27),(0,.51,-.33),(0,.51,-.245)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,5,1),(1,5,2),(2,5,3),(3,5,0)],M['spirit'],0,smooth=False)
    curve('Crystal gold bezel',[(0,.655,-.273),(.078,.51,-.273),(0,.345,-.273),(-.078,.51,-.273),(0,.655,-.273)],.004,M['brass'],1)
    return list(set(bpy.data.objects)-before)

def unify_coat():
    pieces=[o for o in bpy.context.scene.objects if o.name=='Tailored charcoal coat' or o.name.startswith('Tailored coat sleeve')]
    bpy.ops.object.select_all(action='DESELECT')
    for o in pieces:
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();coat=pieces[0];coat.name='Continuous tailored riding coat'
    remesh=coat.modifiers.new('Continuous sewn shoulder structure','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.007;remesh.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=coat.modifiers.new('Soft fabric transitions','SMOOTH');smooth.factor=.45;smooth.iterations=3;bpy.ops.object.modifier_apply(modifier=smooth.name)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')

def prepare(objects,target):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    for o in objects:
        if o.type not in {'MESH','CURVE'}:continue
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
        bpy.context.view_layer.objects.active=o
        if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
        for mod in list(o.modifiers):
            try:bpy.ops.object.modifier_apply(modifier=mod.name)
            except:pass
        if o.type=='MESH':
            for p in o.data.polygons:p.use_smooth=True
    # Textile details move with their cloth attachments.
    for anchor,prefixes in [('rider-scarf',('Scarf fringe',)),('rider-cape',('rider-cape embroidered','rider-cape astrolabe','rider-cape constellation','rider-cape sewn edge'))]:
        cloth=bpy.data.objects.get(anchor)
        if cloth:
            details=[o for o in bpy.context.scene.objects if o.name.startswith(prefixes)]
            bpy.ops.object.select_all(action='DESELECT');cloth.select_set(True)
            for o in details:o.select_set(True)
            bpy.context.view_layer.objects.active=cloth
            if details:bpy.ops.object.join()
    objects=list(bpy.context.scene.objects)
    total=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH')
    ratio=min(1,target/total)
    for o in objects:
        if o.type!='MESH' or len(o.data.polygons)<80:continue
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Game mesh detail budget','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Pivot cloth at its attachment so game animation cannot orbit it around feet.
    for name,point in [('rider-cape',(0,.76,.01)),('rider-scarf',(.12,.92,-.04))]:
        o=next((o for o in objects if o.name==name),None)
        if o:
            shift=v(point)
            for vertex in o.data.vertices:vertex.co-=shift
            o.location=shift
    # Consolidate static geometry by material; separate motion anchors stay named.
    keep={'rider-cape','rider-scarf','wandTip','broomTail'};groups={}
    for o in objects:
        if o.name not in bpy.data.objects or o.type!='MESH' or o.name in keep:continue
        key=o.data.materials[0].name if o.data.materials else 'none';groups.setdefault(key,[]).append(o)
    for name,items in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        bpy.ops.object.join();items[0].name=name
    return [o for o in bpy.context.scene.objects if o.type in {'MESH','EMPTY'} and not o.name.startswith('Studio')]

def export(objects,filename):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=next(o for o in objects if o.type=='MESH')
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_image_format='WEBP',export_image_quality=90,export_cameras=False,export_lights=False)
    tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH')
    return {'file':filename,'triangles':tris,'meshes':sum(o.type=='MESH' for o in objects),'bytes':(OUT/filename).stat().st_size,'sha256':hashlib.sha256((OUT/filename).read_bytes()).hexdigest()}

def studio(objects,name):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=10 if PREVIEW else 40;scene.cycles.use_denoising=True
    scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=75 if PREVIEW else 100
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.085,.095,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.47));floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(mat('Studio matte',(.075,.087,.095),.85))
    def area(name,p,power,size,color):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=v(p);o.rotation_euler=(v((0,.3,0))-o.location).to_track_quat('-Z','Y').to_euler();return o
    lights=[area('Studio key',(-3,5,-4),580,3.2,(1,.90,.79)),area('Studio fill',(4,2,-1),230,3,(.62,.8,1)),area('Studio rim',(0,4,4),800,2.5,(.72,.86,1))]
    data=bpy.data.cameras.new('Studio camera');camera=bpy.data.objects.new('Studio camera',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=3.9 if name=='wizard' else 3.7
    for label,point in [('review' if PREVIEW else 'front',(-4,2.0,-6)), *[('back-review' if PREVIEW else 'back',(4,1.5,6))]]:
        camera.location=v(point);camera.rotation_euler=(v((0,.17,.12 if name=='wizard' else 0))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(QA/(name+'-studio-'+label+'.png'));bpy.ops.render.render(write_still=True)
    if name=='wizard':
        data.ortho_scale=.86;camera.location=v((-.68,1.32,-2.8));camera.rotation_euler=(v((0,1.16,-.2))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(QA/'wizard-face-review.png');bpy.ops.render.render(write_still=True)
    for o in [floor,camera,*lights]:bpy.data.objects.remove(o,do_unlink=True)

summary=[]
for name,build in [('wizard',wizard),('wraith',wraith)]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    objects=prepare(build(),85000 if name=='wizard' else 27500)
    if not PREVIEW:summary.append(export(objects,name+'.glb'))
    studio(objects,name)
if not PREVIEW:(OUT/'manifest.json').write_text(json.dumps({'generator':'Blender 5.1.2; original clothing/creature/broom, Blender Studio CC0 realistic head, Cortu Johnstone CC0 hair, Poly Haven CC0 cloth/leather' ,'assets':summary},indent=2))
print('CHARACTER_ASSETS_COMPLETE '+json.dumps(summary))
