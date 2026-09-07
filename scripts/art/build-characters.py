"""Original character geometry with CC0 Poly Haven cloth/leather, built in isolated Blender."""
import bpy, math, random, json, sys
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
        tint.inputs[7].default_value=(*color,1) if kind=='cloth' else (.75,.68,.57,1)
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
 'coat':mat('Charcoal herringbone wool',(.155,.185,.193),.86,kind='cloth'),
 'coatEdge':mat('Raised wool seams',(.205,.223,.22),.84,kind='cloth'),
 'lining':mat('Oxblood silk lining',(.285,.059,.09),.6,kind='cloth'),
 'scarf':mat('Burgundy woven scarf',(.37,.062,.1),.84,kind='cloth'),
 'goldcloth':mat('Ochre scarf threads',(.72,.47,.16),.82,kind='cloth'),
 'shirt':mat('Ivory linen collar',(.7,.68,.59),.86,kind='cloth'),
 'pants':mat('Dark fitted trousers',(.075,.095,.103),.85,kind='cloth'),
 'leather':mat('Weathered boot leather',(.12,.065,.037),.5,kind='leather'),
 'belt':mat('Waxed brown leather',(.21,.105,.044),.53,kind='leather'),
 'wood':mat('Walnut broom shaft',(.44,.24,.105),.42,kind='wood'),
 'twig':mat('Birch broom twigs',(.51,.34,.16),.79,kind='wood'),
 'twigDark':mat('Dark broom twigs',(.30,.16,.065),.86,kind='wood'),
 'brass':mat('Aged brass',(.54,.35,.12),.35,.77),
 'skin':mat('Warm skin',(.39,.235,.15),.78),
 'lip':mat('Lips and ear shade',(.36,.17,.13),.71),
 'hair':mat('Dark auburn hair',(.018,.010,.007),.84),
 'eye':mat('Dark iris',(.017,.026,.025),.25),
 'white':mat('Eye ivory',(.36,.32,.26),.6),
 'wraith':mat('Midnight spectral mantle',(.095,.12,.145),.89,kind='cloth'),
 'wraithEdge':mat('Weathered slate cloth',(.22,.245,.25),.88,kind='cloth'),
 'void':mat('Hood darkness',(.0003,.0005,.0009),1),
 'spirit':mat('Icy spectral eyes',(.21,.63,.62),.4,emission=4),
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
    # Tapered cloth cross-sections follow the upper arm, elbow and forearm.
    verts=[];uv=[];pts=[Vector(p) for p in points];sides=14;distance=0
    for j,point in enumerate(pts):
        if j:distance+=(point-pts[j-1]).length
        tangent=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
        x=tangent.cross(Vector((0,0,1))).normalized();y=tangent.cross(x).normalized()
        for i in range(sides):
            a=i/sides*TAU
            fold=.09*math.sin(a*3+phase)+.035*math.sin(a*7+j*.8+phase)
            rr=radii[j]*(1+fold)
            co=point+x*math.cos(a)*rr+y*math.sin(a)*rr*oval
            verts.append(tuple(co));uv.append((i/sides*TAU*radii[j],distance))
    faces=[]
    for j in range(len(pts)-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+i for i in range(sides))])
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
        tube('Leather cuff '+str(s),[(s*.123,.17,-.762),(s*.103,.13,-.79),(s*.086,.08,-.823)],[.071,.071,.064],M['belt'],12,1)
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
    head_before=set(bpy.data.objects)
    # Neck, non-spherical head/jaw, brows, eyelids, nose and cheek planes.
    loft('Neck',[(0,.80,-.17,.078,.073),(0,.92,-.20,.082,.068),(0,1.02,-.225,.072,.065)],M['skin'],20,0,1)
    head_before=set(bpy.data.objects)
    loft('Anatomical face and cranium',[(0,.95,-.244,.06,.066),(0,1.002,-.254,.102,.082),(0,1.065,-.246,.139,.102),(0,1.16,-.24,.15,.12),(0,1.245,-.22,.151,.134),(0,1.335,-.202,.151,.131),(0,1.41,-.193,.12,.107),(0,1.46,-.19,.06,.047)],M['skin'],32,0,2)
    for s in [-1,1]:
        ellipsoid('Sculpted ear '+str(s),(s*.152,1.17,-.21),(.03,.062,.031),M['skin'],16,10)
        ellipsoid('Ear concha '+str(s),(s*.173,1.17,-.224),(.009,.035,.019),M['lip'],12,8)
        ellipsoid('Eye socket '+str(s),(s*.062,1.245,-.338),(.043,.025,.014),M['lip'],20,10)
        ellipsoid('Eye '+str(s),(s*.062,1.246,-.349),(.032,.013,.01),M['white'],16,8)
        ellipsoid('Iris '+str(s),(s*.058,1.246,-.358),(.012,.012,.003),M['eye'],12,8)
        curve('Upper eyelid '+str(s),[(s*.029,1.247,-.356),(s*.061,1.26,-.358),(s*.097,1.247,-.345)],.005,M['skin'],2)
        curve('Natural brow '+str(s),[(s*.026,1.287,-.345),(s*.062,1.296,-.345),(s*.107,1.281,-.33)],.007,M['hair'],2)
    mesh('Modeled nose planes',[(0,1.28,-.346),(-.014,1.235,-.354),(.014,1.235,-.354),(-.024,1.174,-.371),(.024,1.174,-.371),(0,1.182,-.397),(0,1.155,-.366)],[(0,1,2),(1,3,5),(1,5,2),(2,5,4),(3,6,5),(4,5,6)],M['skin'],1)
    curve('Upper lip',[(-.042,1.102,-.341),(-.018,1.11,-.348),(0,1.106,-.351),(.02,1.111,-.346),(.044,1.103,-.338)],.006,M['lip'],2)
    curve('Lower lip',[(-.038,1.1,-.341),(0,1.094,-.35),(.038,1.1,-.337)],.006,M['skin'],2)
    # Close-fitted scalp surface and short swept strands follow the skull.
    vertices=[];faces=[];sides=32;rows=12
    for j in range(rows+1):
        for i in range(sides):
            az=i/sides*TAU;edge=1.57-.39*math.cos(az);theta=(.018+j/rows*.982)*edge
            vertices.append((.158*math.sin(theta)*math.sin(az),1.29+.205*math.cos(theta),-.197-.144*math.sin(theta)*math.cos(az)))
    for j in range(rows):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    mesh('Close fitted swept hair',vertices,faces,M['hair'],1)
    for i in range(17):
        x=-.138+i*.01725;f=math.sqrt(1-(x/.159)**2)
        points=[(x-.009*math.sin(t)+.006*math.sin(i*1.9+t*3),1.292+.208*f*math.cos(t),-.197+.147*f*math.sin(t)) for t in np.linspace(-1.13,1.67,7)]
        curve('Swept scalp strand '+str(i),points,.0015+random.random()*.0008,M['hair'],1)
    # Adult proportions: reduce the head around the jaw and shorten the forehead.
    for o in set(bpy.data.objects)-head_before:
        def proportion(co):
            return Vector((co.x*.86, .20+(co.y-.20)*.88, .95+(co.z-.95)*.77))
        if o.type=='MESH':
            if o.location.length<.0001:
                for vertex in o.data.vertices:vertex.co=proportion(vertex.co)
            else:
                o.location=proportion(o.location);o.scale.x*=.86;o.scale.y*=.88;o.scale.z*=.77
        elif o.type=='CURVE':
            for spline in o.data.splines:
                for point in spline.bezier_points:point.co=proportion(point.co)
    # Sewn collar tips lie over the coat beside the scarf knot.
    for side in [-1,1]:
        mesh('Ivory sewn collar '+str(side),[(side*.087,.91,-.262),(side*.142,.855,-.257),(side*.125,.793,-.308),(side*.074,.848,-.284)],[(0,1,2,3)],M['shirt'])
        curve('Collar stitch '+str(side),[(side*.092,.9,-.267),(side*.13,.85,-.264),(side*.122,.81,-.303)],.0018,M['goldcloth'],1)
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
    cape=cloth_panel('rider-cape',(0,.76,.01),(0,.18,.63),.67,M['coat'],12,20,.030)
    return list(set(bpy.data.objects)-objects_before)

def wraith():
    before=set(bpy.data.objects)
    # Pleated mantle has layered thickness and an irregular torn hem.
    def mantle(name,top,bottom,r0,r1,material,phase=0,segments=48,rows=17):
        verts=[];uv=[]
        for j in range(rows+1):
            t=j/rows
            for i in range(segments):
                a=i/segments*TAU
                fold=(math.sin(a*5+.7+phase)+.42*math.sin(a*8-.8))*(.015+.038*t)
                r=r0*(1-t)+r1*t-.055*math.sin(t*math.pi)+fold
                hem=.055*math.sin(a*3+phase)+.034*math.sin(a*5+.4)
                if bottom>-.2:hem=-.12*math.cos(a-.5)-.065*math.sin(a*2+phase)
                else:
                    for notch in [.7,3.7,5.1]:
                        delta=(a-notch+math.pi)%TAU-math.pi;hem-=.06*math.exp(-delta*delta/.022)
                y=top*(1-t)+bottom*t+hem*t**3
                center_x=.016*math.sin(t*3+phase);center_z=.07*math.sin(t*2)
                if bottom>-.2:
                    # The shoulder layer follows the underlying robe with real clearance.
                    # Independent radii previously let the two cloth surfaces cross.
                    u=max(0,min(1,(.73-y)/1.86))
                    under_fold=(math.sin(a*5+1.0)+.42*math.sin(a*8-.8))*(.015+.038*u)
                    r=.33*(1-u)+.52*u-.055*math.sin(u*math.pi)+under_fold+.042
                    center_x=.016*math.sin(u*3+.3);center_z=.07*math.sin(u*2)
                verts.append((math.sin(a)*r+center_x,y,-math.cos(a)*r*.68+center_z))
                uv.append((i/segments*2,t*2))
        faces=[]
        for j in range(rows):
            for i in range(segments):faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
        o=mesh(name,verts,faces,material,1,uv=uv);so=o.modifiers.new('Layered cloth thickness','SOLIDIFY');so.thickness=.008;return o
    mantle('Full ragged spectral robe',.73,-1.13,.33,.52,M['wraith'],.3,48,17)
    mantle('Weathered shoulder mantle',.74,-.025,.33,.42,M['wraithEdge'],1.1,40,9)
    mantle('Inner torn shroud',.55,-1.38,.28,.33,M['wraithEdge'],2.4,36,11)
    # Large forward opening, depth to the hood, no spherical visible face.
    verts=[];uv=[];steps=15;sides=40
    profile=[(0,1.78),(.23,1.48),(.32,1.13),(.235,.80),(0,.73),(-.235,.80),(-.32,1.13),(-.23,1.48)]
    def hood_edge(a):
        q=a/TAU*8;k=int(q)%8;t=q-math.floor(q);p=profile[k];n=profile[(k+1)%8];return (p[0]*(1-t)+n[0]*t,p[1]*(1-t)+n[1]*t)
    for j in range(steps):
        t=j/steps;scale=math.cos(t*math.pi*.5)
        for i in range(sides):
            a=i/sides*TAU;fold=1+.035*math.cos(a*7+t*3)
            hx,hy=hood_edge(a);verts.append((hx*scale*fold,1.18-.43*t+(hy-1.18)*scale,-.43+.065*math.cos(a)*scale+t*.74));uv.append((i/sides,t))
    faces=[]
    for j in range(steps-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    pole=len(verts);verts.append((0,.75,.31));uv.append((.5,1))
    for i in range(sides):faces.append(((steps-1)*sides+i,(steps-1)*sides+(i+1)%sides,pole))
    hood=mesh('Deep folded hood',verts,faces,M['wraith'],1,uv=uv);so=hood.modifiers.new('Hood lined opening','SOLIDIFY');so.thickness=.028
    curve('Hood folded rim',[(hood_edge(a)[0],hood_edge(a)[1],-.438+.065*math.cos(a)) for a in np.linspace(0,TAU,41)],.018,M['wraithEdge'],2)
    mask=[(px*.83,1.19+(py-1.19)*.86,-.338) for px,py in profile]
    mask.append((0,1.19,-.31))
    mesh('Recessed hood darkness',mask,[(i,(i+1)%8,8) for i in range(8)],M['void'])
    for s in [-1,1]:
        eye=ellipsoid('Spectral eye '+str(s),(s*.102,1.285,-.363),(.047,.012,.012),M['spirit'],16,8);eye.rotation_euler[1]=s*.10
        # Thin, asymmetrical draped sleeves preserve the existing hand anchors.
        arm=[(s*.265,.715,.04),(s*(.385 if s<0 else .35),.57,.025 if s<0 else .09),(s*(.46 if s<0 else .425),.405,.015 if s<0 else .09),(s*(.47 if s<0 else .455),.32,-.025 if s<0 else .055),(s*.50,.17,-.055),(s*.55,.015,-.10),(s*.58,-.17,-.135),(s*.58,-.25,-.14)]
        tailored_sleeve('Thin layered spectral sleeve '+str(s),arm,[.077,.094,.083,.066,.072,.064,.073,.09],M['wraith'],.82,s*.8)
        tube('Spectral wrist '+str(s),[(s*.59,-.19,-.12),(s*.60,-.25,-.17),(s*.59,-.29,-.20)],[.064,.055,.043],M['wraithEdge'],10,1)
        for k in range(3):
            xx=s*(.56+k*.031);tube('Partly concealed spectral claw '+str(s)+str(k),[(xx,-.26,-.20),(xx+s*.008,-.30-k*.012,-.23),(xx-s*.012,-.345-k*.009,-.26)],[.018,.014,.007],M['wraithEdge'],6,1)
    # A fractured brass talisman gives the little guardian a readable center.
    curve('Talisman chain',[(-.18,.65,-.30),(-.12,.50,-.35),(0,.38,-.36),(.12,.50,-.35),(.18,.65,-.30)],.008,M['brass'],1)
    mesh('Ancient diamond talisman',[(0,.47,-.385),(.061,.38,-.395),(0,.29,-.38),(-.061,.38,-.395),(0,.38,-.425)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],M['brass'])
    return list(set(bpy.data.objects)-before)

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
    for anchor,prefixes in [('rider-scarf',('Scarf fringe',)),('rider-cape',('rider-cape sewn edge',))]:
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
    return {'file':filename,'triangles':tris,'meshes':sum(o.type=='MESH' for o in objects),'bytes':(OUT/filename).stat().st_size}

def studio(objects,name):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=10 if PREVIEW else 40;scene.cycles.use_denoising=True
    scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=75 if PREVIEW else 100
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.085,.095,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.47));floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(mat('Studio matte',(.075,.087,.095),.85))
    def area(name,p,power,size,color):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=v(p);o.rotation_euler=(v((0,.3,0))-o.location).to_track_quat('-Z','Y').to_euler();return o
    lights=[area('Studio key',(-3,5,-4),700,4.5,(1,.86,.69)),area('Studio fill',(4,2,-1),430,3,(.62,.8,1)),area('Studio rim',(0,4,4),900,3,(.9,.76,.49))]
    data=bpy.data.cameras.new('Studio camera');camera=bpy.data.objects.new('Studio camera',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=4.2 if name=='wizard' else 3.7
    for label,point in [('review' if PREVIEW else 'front',(-4,2.0,-6))]:
        camera.location=v(point);camera.rotation_euler=(v((0,.17,.12 if name=='wizard' else 0))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(QA/(name+'-studio-'+label+'.png'));bpy.ops.render.render(write_still=True)
    for o in [floor,camera,*lights]:bpy.data.objects.remove(o,do_unlink=True)

summary=[]
for name,build in [('wizard',wizard),('wraith',wraith)]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    objects=prepare(build(),42500 if name=='wizard' else 12500)
    if not PREVIEW:summary.append(export(objects,name+'.glb'))
    studio(objects,name)
if not PREVIEW:(OUT/'manifest.json').write_text(json.dumps({'generator':'Blender 5.1.2; original geometry, Poly Haven CC0 cloth/leather PBR and original wood patterns','assets':summary},indent=2))
print('CHARACTER_ASSETS_COMPLETE '+json.dumps(summary))
