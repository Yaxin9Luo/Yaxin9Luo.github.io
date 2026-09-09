"""Author the Living Academy companions in an isolated background Blender process.

Run with background Blender, followed by one stage flag after --:
  no flag: Elizabeth static; --elizabeth-motion: accepted Elizabeth rig/sign;
  --sadaharu-static: Sadaharu static; --sadaharu-motion: accepted dog rig/clips.
Motion stages consume the immutable accepted static .blend snapshots in docs.
Existing review directories are never overwritten; reruns get a UTC suffix.
Reference artwork is never loaded as a material or exported with the model.
"""
import bpy
import bmesh
import hashlib
import json
import math
import sys
import random
import bisect
from datetime import datetime, timezone
from pathlib import Path
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'world/public/models/companions'
DOC = ROOT / 'docs/art/living-v8/companions'
for directory in (OUT, DOC):
    directory.mkdir(parents=True, exist_ok=True)


def review_directory(name):
    path=DOC/name
    if path.exists() and any(path.iterdir()):
        path=DOC/f'{name}-{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")}'
    path.mkdir(parents=True,exist_ok=True)
    return path


def build_elizabeth_motion():
    """Skin the accepted r4 mesh without rebuilding its accepted static evidence."""
    bpy.ops.wm.open_mainfile(filepath=str(DOC/'elizabeth-static-r4/elizabeth-static.blend'))
    scene=bpy.context.scene
    actor=bpy.data.objects['Elizabeth']
    evidence=review_directory('elizabeth-motion-r2')
    bpy.ops.object.select_all(action='DESELECT')
    armature=bpy.data.armatures.new('Elizabeth independent skeleton')
    rig=bpy.data.objects.new('ElizabethRig',armature)
    bpy.context.collection.objects.link(rig)
    rig.parent=actor
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=armature.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=armature.edit_bones[parent]
    bone('Root',(0,0,0),(0,0,.1))
    bone('Body',(0,0,1.30),(0,0,2.70),'Root')
    for sign,side in [(-1,'L'),(1,'R')]:
        bone('Arm'+side,(sign*.70,-.045,1.79),(sign*.835,-.045,1.49),'Body')
        bone('Flipper'+side,(sign*.835,-.045,1.49),(sign*.943,-.045,1.145),'Arm'+side)
        bone('Foot'+side,(sign*.40,-.28,.15),(sign*.40,-.68,.12),'Root')
        bone('Sole'+side,(sign*.40,-.55,.008),(sign*.40,-.55,.058),'Foot'+side)
    bone('GripR',(.942,-.045,1.20),(.943,-.045,1.145),'FlipperR')
    grip_rest=Vector((.943,-.069,1.145))
    bone('SignSocket',grip_rest,grip_rest+Vector((0,0,.15)),'Root')
    bpy.ops.object.mode_set(mode='OBJECT')
    rest={b.name:b.matrix_local.copy() for b in armature.bones}
    for b in rig.pose.bones:b.rotation_mode='QUATERNION'
    def bind(obj,weights):
        obj.parent=actor
        obj.vertex_groups.clear()
        groups={name:obj.vertex_groups.new(name=name) for name in armature.bones.keys()}
        for vertex in obj.data.vertices:
            for name,weight in weights(vertex.co).items():
                if weight>1e-5:groups[name].add([vertex.index],weight,'REPLACE')
        modifier=obj.modifiers.new('Independent companion skin','ARMATURE');modifier.object=rig
    def smoothstep(x):
        x=max(0,min(1,x));return x*x*(3-2*x)
    def shell_weights(v):
        x,y,z=v
        threshold=.67+max(0,1.78-z)*.28
        wing=smoothstep((abs(x)-threshold)/.10)*smoothstep((z-1.09)/.055)*smoothstep((1.94-z)/.08)
        side='R' if x>0 else 'L'
        lower=smoothstep((1.56-z)/.17)
        grip=smoothstep((1.22-z)/.05) if side=='R' else 0
        return {'Body':1-wing,'Arm'+side:wing*(1-lower),'Flipper'+side:wing*lower*(1-grip),'GripR':wing*lower*grip}
    for obj in list(actor.children_recursive):
        if obj.type!='MESH':continue
        if obj.name=='ContinuousShell':bind(obj,shell_weights)
        elif obj.name.startswith('WebFoot'):bind(obj,lambda v,n='Foot'+obj.name[-1]:{n:smoothstep((.29-v.z)/.15),'Body':1-smoothstep((.29-v.z)/.15)})
        else:bind(obj,lambda v:{'Body':1})
    def mat(name,color):
        m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
        p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.8
        return m
    wood=mat('Sign warm pale wood',(.48,.29,.12));face=mat('Sign face replace per instance',(.97,.96,.91))
    def cube(name,position,size,material):
        bpy.ops.mesh.primitive_cube_add(size=1,location=position)
        obj=bpy.context.object;obj.name=name;obj.dimensions=size
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        obj.data.materials.append(material)
        bevel=obj.modifiers.new('Soft board corners','BEVEL');bevel.width=.012;bevel.segments=3
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=bevel.name)
        if name=='SignFace':
            uv=obj.data.uv_layers.active
            xs=[v.co.x for v in obj.data.vertices];zs=[v.co.z for v in obj.data.vertices]
            for loop in obj.data.loops:
                co=obj.data.vertices[loop.vertex_index].co
                uv.data[loop.index].uv=((co.x-min(xs))/(max(xs)-min(xs)),(co.z-min(zs))/(max(zs)-min(zs)))
        bind(obj,lambda v:{'SignSocket':1});return obj
    cube('SignBoard',grip_rest+Vector((0,0,.88)),(1.55,.054,.94),wood)
    cube('SignFace',grip_rest+Vector((0,-.030,.88)),(1.48,.008,.87),face)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.023,depth=1.46,location=grip_rest+Vector((0,0,.49)))
    staff=bpy.context.object;staff.name='SignStaff'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    staff.data.materials.append(wood)
    for polygon in staff.data.polygons:polygon.use_smooth=True
    bind(staff,lambda v:{'SignSocket':1})
    rig.animation_data_create()
    specifications={'idle':3.0,'walk':1.2,'sign_raise':.55,'sign_hold':2.5,'sign_lower':.50}
    actions={}
    scene.render.fps=40
    def around_head(name,axis,angle):
        p=rig.pose.bones[name];head=p.head.copy()
        p.matrix=Matrix.Translation(head)@Matrix.Rotation(angle,4,axis)@Matrix.Translation(-head)@p.matrix
        bpy.context.view_layer.update()
    def pose(kind,t):
        for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
        progress=0
        if kind=='sign_raise':
            q=max(0,min(1,t/.55));progress=smoothstep(q)+.045*math.sin(math.pi*q)*math.sin(2*math.pi*q)
        elif kind=='sign_hold':progress=1
        elif kind=='sign_lower':progress=1-smoothstep(t/.5)
        phase=t/specifications[kind]
        bob=.005*math.sin(math.tau*phase) if kind=='idle' else 0
        if kind=='walk':bob=.014*(1-math.cos(math.tau*phase*2))
        rig.pose.bones['Body'].matrix=Matrix.Translation((0,0,bob))@rest['Body']
        bpy.context.view_layer.update()
        if kind=='walk':
            stride=.64;stance=.60;span=stride*stance
            for offset,side in [(0,'L'),(.5,'R')]:
                p=(phase+offset)%1
                if p<stance:forward=-span/2+span*p/stance;lift=0;pitch=0
                else:
                    swing=(p-stance)/(1-stance);forward=span/2-span*swing
                    lift=.125*math.sin(math.pi*swing);pitch=0
                foot=rig.pose.bones['Foot'+side]
                foot.matrix=Matrix.Translation((0,forward,lift))@rest['Foot'+side]
                if pitch:around_head('Foot'+side,'X',pitch)
        around_head('ArmL','Y',.020*math.sin(math.tau*phase) if kind in ['idle','walk'] else .045*progress)
        around_head('ArmR','Y',-1.43*progress)
        around_head('FlipperR','Y',-.07*progress)
        around_head('GripR','Z',-1.0*progress)
        grip=rig.pose.bones['GripR'].tail.copy()+Vector((0,-.024,0))
        carry=(Matrix.Rotation(-1.7,4,'X')@Matrix.Rotation(math.pi/2,4,'Z')).to_quaternion()
        orientation=carry.slerp(Matrix.Identity(4).to_quaternion(),progress).to_matrix().to_4x4()@rest['SignSocket'].to_3x3().to_4x4()
        rig.pose.bones['SignSocket'].matrix=Matrix.Translation(grip)@orientation
        bpy.context.view_layer.update()
    for name,duration in specifications.items():
        action=bpy.data.actions.new(name);rig.animation_data.action=action;actions[name]=action
        frames=round(duration*scene.render.fps)
        for i in range(frames+1):
            frame=i;scene.frame_set(frame);pose(name,duration*i/frames)
            for p in rig.pose.bones:
                p.keyframe_insert(data_path='location',frame=frame,group=p.name)
                p.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=p.name)
                p.keyframe_insert(data_path='scale',frame=frame,group=p.name)
        action.use_fake_user=True
        action['duration_seconds']=duration
    rig.animation_data.action=actions['idle'];scene.frame_set(0);pose('idle',0)
    actor['stage']='elizabeth-motion-review-r2'
    actor['walk_stride_m']=.64;actor['walk_duration_s']=1.2
    actor['socket_contract']='SignSocket at GripR.tail plus front contact offset 0.024 m; board/shaft have real thickness.'
    bpy.ops.object.select_all(action='DESELECT')
    actor.select_set(True);rig.select_set(True)
    for obj in actor.children_recursive:obj.select_set(True)
    temporary=OUT/'elizabeth.glb'
    bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_extras=True)
    digest=hashlib.sha256(temporary.read_bytes()).hexdigest()
    target=OUT/f'elizabeth.{digest[:12]}.glb';temporary.replace(target)
    # Review-only editable type, never part of the exported mesh/sign texture.
    bpy.ops.object.text_add()
    text=bpy.context.object;text.name='REVIEW_original_sign_text'
    text.data.body='Just passing by?\nWelcome.';text.data.align_x='CENTER';text.data.align_y='CENTER';text.data.size=.165
    text.data.space_line=1.15;text.data.extrude=.0005
    text.data.materials.append(bpy.data.materials['Face — charcoal ink'])
    desired=Matrix.Translation(grip_rest+Vector((0,-.038,.88)))@Euler((math.pi/2,0,0)).to_matrix().to_4x4()
    skin=rig.pose.bones['SignSocket'].matrix@rest['SignSocket'].inverted()
    text.parent=rig;text.parent_type='BONE';text.parent_bone='SignSocket'
    bpy.context.view_layer.update();text.matrix_world=skin@desired
    ground_ink=mat('REVIEW ground reference',(.12,.13,.15))
    for y in [-1,-.5,0,.5,1,1.5]:
        bpy.ops.mesh.primitive_cube_add(size=1,location=(0,y,.001))
        line=bpy.context.object;line.name='REVIEW_ground_reference';line.dimensions=(3,.007,.002);line.data.materials.append(ground_ink)
    camera=scene.camera
    frames=[]
    def render(name,clip,t,location,target_point,scale=4.1):
        rig.animation_data.action=actions[clip];scene.frame_set(round(t*scene.render.fps))
        camera.data.type='ORTHO';camera.data.ortho_scale=scale;camera.location=location
        camera.rotation_euler=(Vector(target_point)-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(evidence/(name+'.png'));bpy.ops.render.render(write_still=True)
        frames.append({'image':str((evidence/(name+'.png')).relative_to(ROOT)),'clip':clip,'time':t,'model_sha256':digest,'camera':list(location),'target':list(target_point),'scale':scale})
    render('idle-front-f000','idle',0,(0,-8,1.6),(0,0,1.6))
    for i,t in enumerate([0,.1375,.275,.4125,.55]):render(f'sign-raise-front-f{i:03}','sign_raise',t,(0,-8,1.75),(.55,0,1.75),4.55)
    render('sign-hold-threequarter-f000','sign_hold',0,(4.8,-6.8,3.3),(.3,0,1.6),4.3)
    render('sign-grip-close-f000','sign_hold',0,(3.5,-6,2.6),(1.1,-.02,1.95),1.5)
    for i in range(8):render(f'walk-profile-f{i:03}','walk',1.2*i/8,(-8,0,2.15),(0,0,1.40),3.7)
    render('walk-threequarter-swing-f000','walk',.9,(-4.8,-6.8,3.3),(0,0,1.5),4.1)
    rig.animation_data.action=actions['idle'];scene.frame_set(0)
    camera.location=(4.8,-6.8,3.3);camera.data.ortho_scale=4.3
    camera.rotation_euler=(Vector((.3,0,1.6))-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'elizabeth.blend'))
    metadata={'stage':'MOTION_ART_REVIEW_PENDING','model':str(target.relative_to(ROOT)),'sha256':digest,'source':'world/public/models/companions/elizabeth.blend','actions':specifications,'stride_m':.64,'reference_walk_speed_mps':.64/1.2,'stance_fraction':.6,'anchors':['Root','Body','ArmL','ArmR','FlipperL','FlipperR','GripR','FootL','FootR','SoleL','SoleR','SignSocket'],'sign':{'original_text':{'zh':'路过也欢迎。','en':'Just passing by? Welcome.'},'face_node':'SignFace','board_node':'SignBoard','staff_node':'SignStaff','socket_node':'SignSocket','grip_bone':'GripR','grip_offset_blender':[0,-.024,0]},'renders':frames}
    (DOC/'elizabeth-motion-review.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print('ELIZABETH_MOTION_REVIEW_READY',target,digest)


def build_sadaharu_static():
    """Author a connected canine body from anatomical lofts and a continuous tail."""
    bpy.ops.wm.open_mainfile(filepath=str(DOC/'elizabeth-static-r4/elizabeth-static.blend'))
    prior=bpy.data.objects['Elizabeth']
    for obj in list(prior.children_recursive)+[prior]:bpy.data.objects.remove(obj,do_unlink=True)
    scene=bpy.context.scene
    evidence=review_directory('sadaharu-static-r6')
    actor=bpy.data.objects.new('Sadaharu',None);bpy.context.collection.objects.link(actor)
    def mat(name,color,roughness=.8):
        m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
        p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness;p.inputs['Specular IOR Level'].default_value=.22
        return m
    white=mat('Sadaharu warm white coat',(.93,.925,.905));pink=mat('Sadaharu soft pink ears',(.64,.29,.25))
    black=mat('Sadaharu charcoal eyes and nose',(.018,.016,.022),.48)
    brow=mat('Sadaharu curled grey brown brows',(.24,.20,.17))
    collar=mat('Sadaharu burgundy collar',(.12,.006,.015));highlight=mat('Sadaharu eye catchlight',(.98,.98,.97))
    def mesh(name,vertices,faces,material):
        data=bpy.data.meshes.new(name+' topology');data.from_pydata(vertices,[],faces);data.update()
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.parent=actor;data.materials.append(material)
        for p in data.polygons:p.use_smooth=True
        return obj
    def rings(name,rows,material,cap=True):
        n=len(rows[0]);faces=[]
        for j in range(len(rows)-1):
            for k in range(n):faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
        if cap:faces.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+k for k in range(n))])
        return mesh(name,[v for row in rows for v in row],faces,material)
    def catmull(controls,steps=5):
        out=[]
        for i in range(len(controls)-1):
            p0,p1,p2,p3=[controls[min(len(controls)-1,max(0,i+o))] for o in [-1,0,1,2]]
            for j in range(steps):
                t=j/steps;out.append(tuple(.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(len(p1))))
        return out+[controls[-1]]
    def vertical(name,controls,material=white):
        return rings(name,[[(x+rx*math.cos(a),y+ry*math.sin(a),z) for a in [k*math.tau/48 for k in range(48)]] for x,y,z,rx,ry in catmull(controls)],material)
    def ellipsoid(name,center,scale,material=white):
        x,y,z=center;rx,ry,rz=scale
        return rings(name,[[(x+rx*math.sin(p)*math.cos(a),y+ry*math.sin(p)*math.sin(a),z+rz*math.cos(p)) for a in [k*math.tau/48 for k in range(48)]] for p in [.002+j*(math.pi-.004)/32 for j in range(33)]],material)
    def tube(name,controls,material=white,sides=24):
        points=catmull(controls);rows=[]
        for i,p in enumerate(points):
            tangent=(Vector(points[min(len(points)-1,i+1)][:3])-Vector(points[max(0,i-1)][:3])).normalized()
            u=tangent.cross(Vector((1,0,0))).normalized()
            if u.length<.001:u=tangent.cross(Vector((0,1,0))).normalized()
            v=tangent.cross(u).normalized()
            rows.append([tuple(Vector(p[:3])+max(.003,p[3])*(u*math.cos(a)+v*math.sin(a))) for a in [k*math.tau/sides for k in range(sides)]])
        return rings(name,rows,material)
    solids=[]
    trunk=[(-.48,1.42,.035,.04),(-.26,1.40,.43,.55),(.12,1.33,.56,.61),(.55,1.24,.54,.54),(1.00,1.20,.49,.48),(1.38,1.20,.43,.44),(1.64,1.17,.20,.25),(1.72,1.17,.025,.03)]
    solids.append(rings('RibcageLoft',[[ (rx*math.cos(a),y,z+rz*math.sin(a)) for a in [k*math.tau/64 for k in range(64)]] for y,z,rx,rz in catmull(trunk)],white))
    solids.append(vertical('NeckLoft',[(0,-.12,1.38,.32,.30),(0,-.24,1.64,.43,.36),(0,-.38,1.91,.44,.37),(0,-.52,2.18,.42,.34)]))
    head_controls=[(0,-.58,1.84,.18,.18),(0,-.60,1.95,.48,.38),(0,-.61,2.12,.62,.49),(0,-.61,2.33,.61,.48),(0,-.60,2.50,.55,.42),(0,-.58,2.65,.43,.33),(0,-.56,2.76,.20,.17),(0,-.56,2.79,.018,.015)]
    solids.append(vertical('BroadHeadLoft',head_controls))
    for sign,side in [(-1,'L'),(1,'R')]:
        solids.append(ellipsoid('ShortMuzzle'+side,(sign*.17,-1.035,2.075),(.24,.275,.205)))
        solids.append(vertical('Foreleg'+side,[(sign*.40,-.20,.21,.145,.16),(sign*.39,-.13,.43,.16,.18),(sign*.39,-.035,.92,.18,.195),(sign*.37,-.05,1.40,.245,.25),(sign*.32,.025,1.55,.18,.20),(sign*.27,.035,1.67,.08,.12),(sign*.22,.04,1.72,.02,.03)]))
        solids.append(vertical('Hindleg'+side,[(sign*.40,1.23,.20,.14,.16),(sign*.41,1.36,.42,.155,.175),(sign*.42,1.25,.69,.19,.19),(sign*.42,1.015,.95,.255,.235),(sign*.38,1.17,1.18,.285,.27),(sign*.28,1.19,1.40,.18,.20),(sign*.18,1.20,1.55,.06,.10)]))
        for y,label in [(-.30,'Front'),(1.13,'Back')]:
            solids.append(vertical(label+'Paw'+side,[(sign*.40,y,.018,.18,.29),(sign*.40,y,.048,.235,.335),(sign*.40,y,.16,.23,.32),(sign*.40,y+.025,.265,.15,.205),(sign*.40,y+.05,.30,.10,.135)]))
        # Thick outer ears blend into the head; inset pink surfaces remain separate.
        ear_rows=[]
        for width,yoff in [(1,.03),(1,0),(.89,-.055)]:
            cx=sign*.56;cz=2.70
            outline=[(sign*.30,2.59),(sign*.62,2.52),(sign*.73,2.71),(sign*.82,3.02),(sign*.51,2.91),(sign*.36,2.77)]
            ear_rows.append([(cx+(x-cx)*width,-.47+yoff-.15*(3.065-z)/.57,cz+(z-cz)*width) for x,z in outline])
        ear=rings('OuterEar'+side,ear_rows,white)
        bpy.context.view_layer.objects.active=ear
        bevel_ear=ear.modifiers.new('Soft ear cartilage rim','BEVEL');bevel_ear.width=.016;bevel_ear.segments=2
        bpy.ops.object.modifier_apply(modifier=bevel_ear.name);solids.append(ear)
        pink_points=[(sign*.385,-.697,2.695),(sign*.592,-.681,2.620),(sign*.704,-.581,2.921)]
        pink_ear=mesh('InnerEar'+side,pink_points+[(x,y+.018,z) for x,y,z in pink_points],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],pink)
        bevel=pink_ear.modifiers.new('Inset ear rim','BEVEL');bevel.width=.025;bevel.segments=3
        bpy.context.view_layer.objects.active=pink_ear;bpy.ops.object.modifier_apply(modifier=bevel.name)
        for x,y,z,dx,dy,dz in [(sign*.54,-.56,2.18,sign*.12,.025,-.065),(sign*.50,-.44,1.98,sign*.10,-.025,-.09),(sign*.20,-.50,1.62,sign*.025,-.065,-.21)]:
            solids.append(tube('CoatTuft'+side+str(z),[(x,y,z,.105),(x+dx*.6,y+dy*.6,z+dz*.6,.065),(x+dx,y+dy,z+dz,.009)]))
    tail_controls=[(0,1.43,1.43,.15),(.01,1.70,1.62,.18),(.04,1.82,1.90,.195),(.065,1.60,2.12,.205),(.08,1.28,2.14,.195),(.06,1.10,1.96,.16),(.025,1.25,1.83,.09),(.01,1.39,1.84,.025)]
    solids.append(tube('ContinuousCurledTail',tail_controls,sides=32))
    # Recalculate before union; the result is one connected soft anatomical surface.
    for obj in solids:
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:]);bm.to_mesh(obj.data);bm.free()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in solids:obj.select_set(True)
    body=solids[0];bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name='SadaharuCoat'
    remesh=body.modifiers.new('Connected canine anatomical union','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.016;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    relax=body.modifiers.new('Soft continuous coat','SMOOTH');relax.factor=.55;relax.iterations=4;bpy.ops.object.modifier_apply(modifier=relax.name)
    decimate=body.modifiers.new('Curvature preserving runtime surface','DECIMATE');decimate.ratio=.32;bpy.ops.object.modifier_apply(modifier=decimate.name)
    for v in body.data.vertices:
        if v.co.z<.035:v.co.z=.018
    bm=bmesh.new();bm.from_mesh(body.data)
    for _ in range(7):
        updates=[]
        for v in bm.verts:
            if v.co.z<.075 and v.link_edges:
                average=sum((edge.other_vert(v).co for edge in v.link_edges),Vector())/len(v.link_edges)
                updates.append((v,v.co.lerp(average,.4)))
        for v,co in updates:
            v.co.x=co.x;v.co.y=co.y
    bm.to_mesh(body.data);bm.free()
    for p in body.data.polygons:p.use_smooth=True
    body['construction']='Connected ribcage/neck/head/legs/paws/ears and continuous curled tail, fused from custom anatomical lofts.'
    # Bake sub-millimetre directional strand relief onto the continuous anatomy.
    bpy.context.view_layer.objects.active=body
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(72),island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')
    nodes=white.node_tree.nodes;links=white.node_tree.links;shader=nodes['Principled BSDF']
    coordinate=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1,1,.12)
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=155;noise.inputs['Detail'].default_value=2
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.25;bump.inputs['Distance'].default_value=.006
    links.new(coordinate.outputs['Generated'],mapping.inputs[0]);links.new(mapping.outputs[0],noise.inputs['Vector']);links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    baked=bpy.data.images.new('Sadaharu authored fine coat tangent normal',width=2048,height=2048,alpha=False)
    baked.colorspace_settings.name='Non-Color';image_node=nodes.new('ShaderNodeTexImage');image_node.image=baked;nodes.active=image_node
    scene.render.bake.use_clear=True;scene.render.bake.margin=12
    bpy.ops.object.bake(type='NORMAL')
    baked.pack()
    normal_node=nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=4;links.new(image_node.outputs['Color'],normal_node.inputs['Color']);links.new(normal_node.outputs['Normal'],shader.inputs['Normal'])
    for node in [coordinate,mapping,noise,bump]:nodes.remove(node)
    scene.cycles.transparent_max_bounces=48
    # Fine original alpha hair texture on short, surface-following bent cards.
    # Native RGBA stays packed in the GLB and .blend; never flatten the alpha.
    fur_material=mat('Sadaharu fine directional white fur',(.93,.925,.905),.96)
    fur_material.use_backface_culling=False
    nodes=fur_material.node_tree.nodes;links=fur_material.node_tree.links
    shader=nodes['Principled BSDF'];texture=nodes.new('ShaderNodeTexImage')
    texture.image=bpy.data.images.load(str(ROOT/'docs/art/living-v8/white-fur-tuft.png'))
    texture.image.pack();texture.interpolation='Linear';texture.extension='CLIP'
    # Native alpha supplies fine hair coverage; constant white avoids repeated
    # albedo clump patches while the base carries baked strand relief.
    cutoff=nodes.new('ShaderNodeMath');cutoff.operation='GREATER_THAN';cutoff.inputs[1].default_value=.22
    links.new(texture.outputs['Alpha'],cutoff.inputs[0]);links.new(cutoff.outputs[0],shader.inputs['Alpha'])
    shader.inputs['Specular IOR Level'].default_value=.10
    body.data.calc_loop_triangles()
    triangles=list(body.data.loop_triangles);areas=[];total=0
    for triangle in triangles:
        total+=triangle.area;areas.append(total)
    surface=BVHTree.FromPolygons([v.co for v in body.data.vertices],[t.vertices for t in triangles],all_triangles=True)
    rng=random.Random(4917);fur_vertices=[];fur_faces=[];fur_uv=[]
    tail_path=catmull(tail_controls)
    for _ in range(5000):
        triangle=triangles[bisect.bisect_left(areas,rng.random()*total)]
        a,b,c=[body.data.vertices[i].co for i in triangle.vertices]
        u=math.sqrt(rng.random());v=rng.random();centre=a*(1-u)+b*u*(1-v)+c*u*v
        if centre.z<.09:continue
        # Sparse, very short face coat keeps TV round eyes and brows readable.
        face=centre.y<-.84 and abs(centre.x)<.47 and 1.94<centre.z<2.68
        if face:continue
        normal=(b-a).cross(c-a).normalized()
        length=.037 if centre.z<1.4 else .042
        desired=Vector((0,.50,-1))
        if centre.z>1.64 and centre.y>1.0:
            nearest=min(range(len(tail_path)),key=lambda i:(centre-Vector(tail_path[i][:3])).length_squared)
            desired=Vector(tail_path[min(len(tail_path)-1,nearest+1)][:3])-Vector(tail_path[max(0,nearest-1)][:3]);length=.062
        elif centre.y<-.35 and 1.2<centre.z<1.85:length=.055
        elif centre.z>1.98 and abs(centre.x)>.38:desired=Vector((centre.x*.8,.2,-1));length=.048
        if centre.z>2.70:length=.027
        if face:length=.035
        direction=desired-normal*desired.dot(normal)
        if direction.length<.05:direction=Vector((0,1,0))-normal*normal.y
        direction.normalize();side=normal.cross(direction).normalized()
        length*=rng.uniform(.8,1.2);width=length*.95
        start=len(fur_vertices)
        for row in range(5):
            t=row/4
            for column in range(3):
                across=column/2-.5
                candidate=centre+direction*length*(t-.2)+side*width*across
                nearest,n,_,_=surface.find_nearest(candidate)
                # Roots lie within the base; only the feathered tips lift softly.
                position=nearest+n*(-.0005+.005*t*t+.001*(1-4*across*across))
                fur_vertices.append(tuple(position));fur_uv.append((column/2,t))
        for row in range(4):
            for column in range(2):
                k=start+row*3+column;fur_faces.append((k,k+1,k+4,k+3))
    fur=mesh('FineDirectionalFurCards',fur_vertices,fur_faces,fur_material)
    fur.visible_shadow=False
    fur['no_cast_shadow']=True
    uv=fur.data.uv_layers.new(name='Fur native alpha UV')
    for loop in fur.data.loops:uv.data[loop.index].uv=fur_uv[loop.vertex_index]
    fur['construction']='Short gently bent cards follow fused anatomical surface; original native alpha hair texture, cutoff 0.22.'
    fur['texture_source']='docs/art/living-v8/white-fur-tuft-source.json'
    toe_ink=mat('Sadaharu subtle toe folds',(.52,.51,.49),1)
    for sign,side in [(-1,'L'),(1,'R')]:
        for y,label in [(-.30,'Front'),(1.13,'Back')]:
            for offset in [-.075,.075]:
                points=[]
                for i in range(7):
                    py=y-.275+i*.07/6
                    co,n,_,_=surface.ray_cast(Vector((sign*.40+offset,py,.8)),Vector((0,0,-1)))
                    if co:points.append((*tuple(co+n*.0015),.0028))
                if len(points)>2:tube(label+'ToeFold'+side+str(offset),points,toe_ink,8)
    # Face surface follows the broad head; no painted character texture.
    for sign,side in [(-1,'L'),(1,'R')]:
        eye_rows=[]
        for radius in [.001,.25,.50,.75,1]:
            row=[]
            for i in range(64):
                angle=i*math.tau/64;x=sign*.255+.093*radius*math.cos(angle);z=2.36+.097*radius*math.sin(angle)
                co,_,_,_=surface.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
                row.append((x,co.y-.004-.014*(1-radius*radius),z))
            eye_rows.append(row)
        # A surface-following eye disk has no non-planar back-cap polygon.
        # That cap crossed the curved front and made a faceted lower crescent.
        rings('Eye'+side,eye_rows,black,cap=False)
        ellipsoid('EyeCatchlight'+side,(sign*.255-.026,-1.081,2.393),(.021,.008,.025),highlight)
        points=[(sign*.37,2.575,.016),(sign*.30,2.600,.026),(sign*.225,2.578,.029),(sign*.202,2.525,.026),(sign*.23,2.515,.017)]
        controls=[]
        for x,z,r in points:
            ry=.42+(2.5-z)*.65;rx=.55+(2.5-z)*.8
            y=-.60-ry*math.sqrt(max(.05,1-(x/rx)**2))-.016
            controls.append((x,y,z,r))
        tube('CurledBrow'+side,controls,brow,16)
        tube('MouthCurve'+side,[(0,-1.303,2.072,.009),(sign*.07,-1.298,2.037,.010),(sign*.15,-1.267,2.041,.007)],black,12)
    # A rounded triangular nose, not a long wolf muzzle.
    nose_outline=[(-.112,2.205),(-.079,2.240),(0,2.247),(.079,2.240),(.112,2.205),(.067,2.155),(0,2.132),(-.067,2.155)]
    nose=rings('RoundedTriangleNose',[[(x*scale,y+.060,2.19+(z-2.19)*scale) for x,z in nose_outline] for scale,y in [(.72,-1.29),(1,-1.33),(.90,-1.367),(.05,-1.376)]],black)
    bpy.context.view_layer.objects.active=nose
    subdiv=nose.modifiers.new('Round nose edges','SUBSURF');subdiv.levels=2;bpy.ops.object.modifier_apply(modifier=subdiv.name)
    # Continuous collar follows the sloped neck and is partly covered by white tufts.
    centre=Vector((0,-.360,1.895));normal=Vector((0,-.48,.82)).normalized();u=Vector((1,0,0));v=normal.cross(u).normalized()
    collar_rows=[]
    for i in range(97):
        a=i*math.tau/96;radial=u*math.cos(a)*.458+v*math.sin(a)*.310
        direction=radial.normalized();collar_rows.append([tuple(centre+radial+direction*.043*math.cos(b)+normal*.063*math.sin(b)) for b in [j*math.tau/12 for j in range(12)]])
    rings('ContinuousBurgundyCollar',collar_rows,collar)
    actor['character_design']='Sadaharu / Gintama TV base design; original authored mesh, underlying character design not ours.'
    actor['stage']='sadaharu-static-review-r6';actor['forward_gltf']='+Z'
    for obj in actor.children_recursive:
        if obj.type=='MESH':
            bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:]);bm.to_mesh(obj.data);bm.free()
    bpy.ops.object.select_all(action='DESELECT');actor.select_set(True)
    for obj in actor.children_recursive:obj.select_set(True)
    temporary=OUT/'sadaharu-static.glb'
    bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True)
    digest=hashlib.sha256(temporary.read_bytes()).hexdigest();target=OUT/f'sadaharu-static.{digest[:12]}.glb';temporary.replace(target)
    camera=scene.camera;camera.data.type='ORTHO'
    views={'front':((0,-8,1.55),(0,.30,1.55),3.8),'profile-left':((-8,.3,1.55),(0,.3,1.55),4.5),'profile-right':((8,.3,1.55),(0,.3,1.55),4.5),'back':((0,8,1.55),(0,.3,1.55),3.8),'threequarter':((4.8,-6.8,3.6),(0,.25,1.45),4.25),'face':((0,-8,2.38),(0,-.6,2.38),1.85),'tail':((4,5,3.25),(0,1.25,1.7),2.6),'feet':((3,-4,1.5),(0,.20,.30),2.8)}
    frames=[]
    for name,(location,look,scale) in views.items():
        camera.location=location;camera.data.ortho_scale=scale;camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(evidence/(name+'.png'));bpy.ops.render.render(write_still=True)
        frames.append({'image':str((evidence/(name+'.png')).relative_to(ROOT)),'model_sha256':digest,'camera':location,'target':look,'scale':scale})
    camera.location=views['threequarter'][0];camera.data.ortho_scale=4.25;camera.rotation_euler=(Vector(views['threequarter'][1])-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sadaharu.blend'))
    (DOC/'sadaharu-static-review.json').write_text(json.dumps({'stage':'STATIC_ART_REVIEW_PENDING','model':str(target.relative_to(ROOT)),'sha256':digest,'source':'world/public/models/companions/sadaharu.blend','inference':'Standing canine anatomy and back/side volume are authored inferences; TV front face and collar/ears/brows have priority.','renders':frames},indent=2)+'\n')
    print('SADAHARU_STATIC_REVIEW_READY',target,digest)


def build_sadaharu_motion():
    """Rig the accepted r6 anatomy and bake original quadruped motion in place."""
    bpy.ops.wm.open_mainfile(filepath=str(DOC/'sadaharu-static-r6/sadaharu-static.blend'))
    scene=bpy.context.scene;actor=bpy.data.objects['Sadaharu']
    evidence=review_directory('sadaharu-motion-r12')
    # Browser A/B shows the continuous fine-normal body is more coherent.
    # Keep the experimental layer editable, hidden and outside actor/export.
    optional_fur=bpy.data.objects.get('FineDirectionalFurCards')
    if optional_fur:
        optional_fur.parent=None;optional_fur.hide_render=True;optional_fur.hide_set(True)
        optional_fur.name='REVIEW optional fine fur layer'
    bpy.ops.object.select_all(action='DESELECT')
    data=bpy.data.armatures.new('Sadaharu independent quadruped skeleton')
    rig=bpy.data.objects.new('SadaharuRig',data);bpy.context.collection.objects.link(rig);rig.parent=actor
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    definitions={}
    def bone(name,head,tail,parent=None):
        b=data.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=data.edit_bones[parent]
        definitions[name]=(Vector(head),Vector(tail))
    bone('Root',(0,0,0),(0,0,.12))
    bone('Pelvis',(0,1.15,1.20),(0,.65,1.30),'Root')
    bone('Spine',(0,.65,1.30),(0,.10,1.45),'Pelvis')
    bone('Chest',(0,.10,1.45),(0,-.30,1.80),'Spine')
    bone('Neck',(0,-.30,1.80),(0,-.52,2.12),'Chest')
    bone('Head',(0,-.52,2.12),(0,-.61,2.62),'Neck')
    bone('Jaw',(0,-.72,2.02),(0,-1.15,2.02),'Head')
    for sign,side in [(-1,'L'),(1,'R')]:
        bone('Ear'+side,(sign*.43,-.60,2.62),(sign*.77,-.50,2.97),'Head')
    tail=[(0,1.43,1.43),(.025,1.79,1.82),(.065,1.60,2.12),(.08,1.28,2.14),(.025,1.25,1.83),(.01,1.39,1.84)]
    for i in range(5):bone(f'Tail{i+1:02}',tail[i],tail[i+1],'Pelvis' if i==0 else f'Tail{i:02}')
    chains={}
    for sign,side in [(-1,'L'),(1,'R')]:
        for prefix,points,parent,sole in [
            ('Front',[(sign*.37,-.05,1.40),(sign*.39,-.035,.82),(sign*.40,-.17,.30),(sign*.40,-.23,.17),(sign*.40,-.53,.10)],'Chest',(sign*.40,-.40,.018)),
            ('Hind',[(sign*.38,1.17,1.20),(sign*.42,1.015,.83),(sign*.41,1.36,.42),(sign*.40,1.23,.19),(sign*.40,.94,.10)],'Pelvis',(sign*.40,1.03,.018)),
        ]:
            names=[prefix+part+side for part in ['Upper','Lower','Foot','Paw']]
            for i,name in enumerate(names):bone(name,points[i],points[i+1],parent if i==0 else names[i-1])
            bone(prefix+'Sole'+side,sole,Vector(sole)+Vector((0,0,.05)),names[-1])
            chains[prefix+side]={'points':[Vector(p) for p in points],'names':names,'prefix':prefix,'side':side}
    bpy.ops.object.mode_set(mode='OBJECT')
    rest={b.name:b.matrix_local.copy() for b in data.bones}
    for p in rig.pose.bones:p.rotation_mode='QUATERNION'
    def smooth(x):
        x=max(0,min(1,x));return x*x*(3-2*x)
    def segment_distance(v,a,b):
        delta=b-a;return (v-a-delta*max(0,min(1,(v-a).dot(delta)/delta.length_squared))).length
    def near_weights(v,names):
        scores=sorted([(name,1/(.055+segment_distance(v,*definitions[name]))**4) for name in names],key=lambda item:-item[1])[:3]
        total=sum(score for _,score in scores);return {name:score/total for name,score in scores}
    def weights(v):
        x,y,z=v;side='R' if x>0 else 'L'
        tail_distance=min(segment_distance(v,*definitions[f'Tail{i:02}']) for i in range(1,6))
        blend=smooth((y-.86)/.22)*smooth((z-1.34)/.22)*smooth((.42-tail_distance)/.14)
        if blend>1e-6:
            result={name:amount*blend for name,amount in near_weights(v,[f'Tail{i:02}' for i in range(1,6)]).items()};result['Pelvis']=1-blend;return result
        # A fixed, continuous four-influence field avoids changing the set of
        # surviving bones at each vertex when body/leg influences are truncated.
        rear=smooth((y-.12)/.98)
        body={'Chest':1-rear,'Pelvis':rear}
        prefix='Front' if y<.55 else 'Hind'
        along_leg=1-smooth((y-.10)/.36) if prefix=='Front' else smooth((y-.65)/.38)
        strength=smooth((abs(x)-.19)/.16)*(1-smooth((z-(.82 if prefix=='Front' else .70))/.75))*along_leg
        strength=max(strength,1-smooth((z-.40)/.25))
        if prefix=='Hind':
            # Inner lower thigh follows the leg rather than being pulled below
            # the seated belly by a dominant Pelvis influence. Feather to zero
            # above .95 m, preserving the accepted outer haunch and trunk.
            inner_leg=smooth((abs(x)-.10)/.20)*(1-smooth((z-.65)/.30))*along_leg
            strength=max(strength,inner_leg)
        if z<.23:leg={prefix+'Paw'+side:1}
        elif z<.36:
            lower=smooth((z-.23)/.13);leg={prefix+'Paw'+side:1-lower,prefix+'Foot'+side:lower}
        elif z<.62:
            lower=smooth((z-.36)/.26)
            leg={prefix+'Foot'+side:1-lower,prefix+'Lower'+side:lower}
        else:
            upper=smooth((z-.62)/.35)
            leg={prefix+'Lower'+side:1-upper,prefix+'Upper'+side:upper}
        result={name:amount*(1-strength) for name,amount in body.items()}
        for name,amount in leg.items():result[name]=amount*strength
        # Feather neck bending through the nape rather than changing to 100%
        # Neck at a horizontal ring. The collar uses the same surface field.
        neck=smooth((z-1.30)/.62)*(1-smooth((y-.03)/.47))
        if neck>0:
            head=smooth((z-1.83)/.30);ear=smooth((z-2.60)/.23)*smooth((abs(x)-.28)/.20)
            upper={'Neck':(1-head)*(1-ear),'Head':head*(1-ear),'Ear'+side:ear}
            result={name:amount*(1-neck) for name,amount in result.items()}
            for name,amount in upper.items():result[name]=result.get(name,0)+amount*neck
        return {name:amount for name,amount in result.items() if amount>1e-8}
    for obj in list(actor.children_recursive):
        if obj.type!='MESH':continue
        obj.vertex_groups.clear();groups={name:obj.vertex_groups.new(name=name) for name in data.bones.keys()}
        body_weights=None
        if obj.name=='SadaharuCoat':
            body_weights=[weights(v.co) for v in obj.data.vertices]
        for v in obj.data.vertices:
            if obj.name.startswith('InnerEar'):values={'Ear'+obj.name[-1]:1}
            elif obj.name.startswith(('Eye','CurledBrow','Mouth','RoundedTriangle')):values={'Head':1}
            elif 'ToeFold' in obj.name:values={('Front' if obj.name.startswith('Front') else 'Hind')+'Paw'+('R' if 'R-' in obj.name or 'R0' in obj.name else 'L'):1}
            else:values=body_weights[v.index] if body_weights else weights(v.co)
            values=dict(sorted(values.items(),key=lambda item:-item[1])[:4]);total=sum(values.values());values={name:value/total for name,value in values.items()}
            for name,value in values.items():
                if value>1e-6:groups[name].add([v.index],value,'REPLACE')
        modifier=obj.modifiers.new('Independent quadruped skin','ARMATURE');modifier.object=rig
    def point_bone(name,head,tail):
        old=definitions[name][1]-definitions[name][0];new=tail-head
        rotation=old.rotation_difference(new).to_matrix().to_4x4()
        matrix=Matrix.Translation(head)@rotation@rest[name].to_3x3().to_4x4()
        scale=Matrix.Identity(4)
        # Keep torso/tail transforms rigid: inherited non-uniform torso scale
        # produced shears that glTF TRS tracks cannot reproduce cleanly.
        if name.startswith(('FrontUpper','FrontLower','HindUpper','HindLower')):scale[1][1]=new.length/old.length
        rig.pose.bones[name].matrix=matrix@scale
        bpy.context.view_layer.update()
    def two_bone(root,target,points):
        a,b,c=points[:3];l1=(b-a).length;l2=(c-b).length
        delta=target-root;distance=delta.length;direction=delta.normalized()
        # A short smooth reach adjustment avoids hard IK snapping near extension.
        reach=max(1,distance/(l1+l2-.002));l1*=reach;l2*=reach
        along=(l1*l1-l2*l2+distance*distance)/(2*distance)
        height=math.sqrt(max(0,l1*l1-along*along))
        bend=b-a-(c-a)*(b-a).dot(c-a)/(c-a).length_squared
        bend-=direction*bend.dot(direction)
        if bend.length<1e-5:bend=Vector((0,1,0))-direction*direction.y
        return root+direction*along+bend.normalized()*height
    durations={'idle':3.0,'walk':1.4,'sit':1.25,'stand':1.1,'sniff':2.4,'greet':2.6}
    phases={'FrontL':0,'HindR':.75,'FrontR':.5,'HindL':.25};stride=.76;stance=.72
    scene.render.fps=40;rig.animation_data_create();actions={}
    def pose(kind,t):
        for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
        bpy.context.view_layer.update()
        phase=t/durations[kind];sitting=smooth(phase) if kind=='sit' else 1-smooth(phase) if kind=='stand' else 0
        sniff=math.sin(math.pi*phase)**2 if kind=='sniff' else 0
        walk=kind=='walk';bob=-.032+.011*math.cos(math.tau*phase*2) if walk else .005*math.sin(math.tau*phase) if kind=='idle' else 0
        sway=.018*math.sin(math.tau*phase) if walk else 0
        def body_point(p):
            q=p.copy();rear=smooth((p.y-.10)/1.35)
            q.y+=sitting*.20*rear;q.z+=bob-sitting*.76*rear-sniff*.10*(1-rear);q.x+=sway
            return q
        for name in ['Pelvis','Spine','Chest']:
            a,b=definitions[name];point_bone(name,body_point(a),body_point(b))
        neck_head=body_point(definitions['Neck'][0]);neck_head.y-=sniff*.12
        neck_transform=Matrix.Translation(neck_head)@Matrix.Rotation(sniff*.75,4,'X')@Matrix.Translation(-definitions['Neck'][0])
        for name in ['Neck','Head','Jaw','EarL','EarR']:
            a,b=definitions[name];a=neck_transform@a;b=neck_transform@b
            if name!='Neck' and kind=='greet':
                pivot=neck_transform@definitions['Head'][0];tilt=Matrix.Rotation(.13*math.sin(math.tau*phase),4,'Y');a=pivot+tilt.to_3x3()@(a-pivot);b=pivot+tilt.to_3x3()@(b-pivot)
            if name.startswith('Ear'):
                angle=(.04 if kind=='idle' else .06)*math.sin(math.tau*phase+(0 if name.endswith('L') else .5))
                b=a+Matrix.Rotation(angle,3,'Y')@(b-a)
            point_bone(name,a,b)
        tail_base=body_point(Vector(tail[0]));wag=(.21 if kind=='greet' else .04 if walk else .025)*math.sin(math.tau*phase*(3 if kind=='greet' else 1))
        tail_transform=Matrix.Translation(tail_base)@Matrix.Rotation(wag,4,'Z')@Matrix.Translation(-Vector(tail[0]))
        for i in range(1,6):
            name=f'Tail{i:02}';a,b=definitions[name];point_bone(name,tail_transform@a,tail_transform@b)
        for key,chain in chains.items():
            points=chain['points'];delta=Vector((0,0,0))
            if sitting and chain['prefix']=='Hind':delta=Vector(((-1 if chain['side']=='L' else 1)*.07*sitting,-.28*sitting,0))
            if walk:
                p=(phase+phases[key])%1;span=stride*stance
                if p<stance:delta.y=-span/2+span*p/stance
                else:
                    swing=(p-stance)/(1-stance);delta.y=span/2-span*swing;delta.z=.13*math.sin(math.pi*swing)
            root=body_point(points[0]);target=points[2]+delta
            elbow=two_bone(root,target,points)
            point_bone(chain['names'][0],root,elbow);point_bone(chain['names'][1],elbow,target)
            point_bone(chain['names'][2],target,points[3]+delta);point_bone(chain['names'][3],points[3]+delta,points[4]+delta)
        bpy.context.view_layer.update()
    for name,duration in durations.items():
        action=bpy.data.actions.new(name);actions[name]=action;rig.animation_data.action=action;action.use_fake_user=True
        frames=round(duration*scene.render.fps)
        for i in range(frames+1):
            scene.frame_set(i);pose(name,duration*i/frames)
            for p in rig.pose.bones:
                p.keyframe_insert(data_path='location',frame=i,group=p.name);p.keyframe_insert(data_path='rotation_quaternion',frame=i,group=p.name);p.keyframe_insert(data_path='scale',frame=i,group=p.name)
    rig.animation_data.action=actions['idle'];scene.frame_set(0);pose('idle',0)
    actor['stage']='sadaharu-motion-review-r12';actor['walk_stride_m']=stride;actor['walk_duration_s']=1.4
    bpy.ops.object.select_all(action='DESELECT');actor.select_set(True)
    for obj in actor.children_recursive:obj.select_set(True)
    temporary=OUT/'sadaharu.glb'
    bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_extras=True)
    digest=hashlib.sha256(temporary.read_bytes()).hexdigest();target=OUT/f'sadaharu.{digest[:12]}.glb';temporary.replace(target)
    ground=bpy.data.materials.new('REVIEW dog ground guide');ground.diffuse_color=(.15,.16,.18,1);ground.use_nodes=True;ground.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.15,.16,.18,1)
    for y in [-1,-.5,0,.5,1,1.5,2]:
        bpy.ops.mesh.primitive_cube_add(size=1,location=(0,y,.001));line=bpy.context.object;line.name='REVIEW ground reference';line.dimensions=(3,.006,.002);line.data.materials.append(ground)
    camera=scene.camera;frames=[]
    def render(name,clip,time,view='profile'):
        rig.animation_data.action=actions[clip];scene.frame_set(round(time*scene.render.fps))
        location,look,scale={'profile':((-8,.3,2.25),(0,.3,1.4),4.5),'right':((8,.3,2.25),(0,.3,1.4),4.5),'runtime':((4.8,-6.55,3.4),(0,.25,1.6),4.4),'threequarter':((4.8,-6.8,3.6),(0,.25,1.45),4.5),'front':((0,-8,1.9),(0,.3,1.4),4.0)}[view]
        camera.location=location;camera.data.ortho_scale=scale;camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler()
        saved_resolution=(scene.render.resolution_x,scene.render.resolution_y)
        if view=='runtime':
            scene.render.resolution_x=1835;scene.render.resolution_y=1440
            frame=camera.data.view_frame(scene=scene);height=max(p.y for p in frame)-min(p.y for p in frame)
            camera.data.ortho_scale*=4.4/height;scale=camera.data.ortho_scale
        path=evidence/(name+'.png');scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        frames.append({'image':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'model_sha256':digest,'clip':clip,'time':time,'camera':location,'target':look,'scale':scale})
        scene.render.resolution_x,scene.render.resolution_y=saved_resolution
    if '--sniff-check' in sys.argv:
        render('sniff-threequarter','sniff',1.2,'threequarter')
        render('sniff-profile','sniff',1.2)
        render('sit-threequarter','sit',1.25,'threequarter')
        render('sit-runtime-threequarter','sit',1.25,'runtime')
        render('walk-profile-f006','walk',1.05)
    else:
        render('idle-threequarter','idle',0,'threequarter')
        render('sit-profile-f004','sit',1.25)
        render('sit-threequarter','sit',1.25,'threequarter')
        render('sit-runtime-threequarter','sit',1.25,'runtime')
        render('walk-profile-f006','walk',1.05)
        render('walk-profile-f007','walk',1.225)
        render('walk-right-f006','walk',1.05,'right')
        render('walk-right-f007','walk',1.225,'right')
        if '--pose-check' not in sys.argv:
            for i in range(8):
                if i not in [6,7]:render(f'walk-profile-f{i:03}','walk',1.4*i/8)
            for clip in ['sit','stand']:
                for i in range(5):
                    if clip=='sit' and i==4:continue
                    render(f'{clip}-profile-f{i:03}',clip,durations[clip]*i/4)
            render('sniff-threequarter','sniff',1.2,'threequarter')
            for i,time in enumerate([.22,.65]):render(f'greet-threequarter-f{i:03}','greet',time,'threequarter')
    rig.animation_data.action=actions['idle'];scene.frame_set(0)
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sadaharu.blend'))
    metadata={'stage':'MOTION_ART_REVIEW_PENDING','model':str(target.relative_to(ROOT)),'sha256':digest,'source':'world/public/models/companions/sadaharu.blend','actions':durations,'stride_m':stride,'reference_walk_speed_mps':stride/1.4,'stance_fraction':stance,'sole_clearance_m':.018,'phases':phases,'bones':list(definitions),'renders':frames}
    (DOC/'sadaharu-motion-review.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print('SADAHARU_MOTION_REVIEW_READY',target,digest)


if '--sadaharu-motion' in sys.argv:
    build_sadaharu_motion()
    sys.exit(0)
if '--sadaharu-static' in sys.argv:
    build_sadaharu_static()
    sys.exit(0)
if '--elizabeth-motion' in sys.argv:
    build_elizabeth_motion()
    sys.exit(0)

# This process starts without opening a .blend and never touches the user's GUI.
RENDERS=review_directory('elizabeth-static-r4')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.world.color = (0.2, 0.2, 0.2)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.39, .42, .46, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5


def material(name, rgba, roughness=.7):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = .24
    return mat


WHITE = material('Shell — soft ivory white', (.92, .915, .885, 1), .83)
EYE_WHITE = material('Eyes — shallow chalk white', (.965, .96, .935, 1), .78)
INK = material('Face — charcoal ink', (.006, .005, .006, 1), .78)
YELLOW = material('Beak and webbing — warm yellow', (1, .53, .025, 1), .72)
SEAM = material('Bill seam — shaded ochre', (.27, .14, .012, 1), .82)
FLOOR = material('Studio neutral grey', (.245, .26, .285, 1), .9)

root = bpy.data.objects.new('Elizabeth', None)
bpy.context.collection.objects.link(root)
root['character_design'] = 'Elizabeth / Gintama, TV base design; original authored mesh, not an original character design.'
root['stage'] = 'static-art-review-4'
root['forward_blender'] = '-Y'
root['forward_gltf'] = '+Z'
root['height_m'] = 3.0
root['body_width_height_ratio'] = .5


def mesh_object(name, vertices, faces, mat, parent=root):
    mesh = bpy.data.meshes.new(name + ' geometry')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    if mat:
        mesh.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def link_rings(rings, name, mat, caps=True):
    count = len(rings[0])
    faces = []
    for j in range(len(rings) - 1):
        for k in range(count):
            a = j * count + k
            b = j * count + (k + 1) % count
            faces.append((a, b, b + count, a + count))
    if caps:
        faces.extend([tuple(reversed(range(count))), tuple((len(rings) - 1) * count + k for k in range(count))])
    return mesh_object(name, [v for ring in rings for v in ring], faces, mat)


def radius(z):
    if z <= 2.02:
        q = (z - .20) / 1.82
        return .733 + .014 * math.sin(math.pi * q), .535 + .055 * math.sin(math.pi * q / 2)
    q = max(0, 1 - ((z - 2.02) / .98) ** 2) ** .5
    return .733 * q, .59 * q


def front(x, z):
    rx, ry = radius(z)
    return -ry * math.sqrt(max(.002, 1 - (x / rx) ** 2))


segments = 128
rings = []
zs = [.22, .23, .245, .265] + [.29 + i * 1.73 / 35 for i in range(36)]
zs += [2.02 + .98 * math.sin(i * math.pi / 2 / 40) for i in range(1, 40)]
zs += [2.9995]
for z in zs:
    rx, ry = radius(z)
    ring = []
    for k in range(segments):
        a = 2 * math.pi * k / segments
        # A broad front arc and two minute side irregularities, not a ruffled skirt.
        hem = -.082 * abs(math.sin(a)) ** 2 + .003 * math.cos(3 * a)
        dz = hem * max(0, 1 - (z - .22) / .36) ** 2
        ring.append((rx * math.cos(a), ry * math.sin(a), z + dz))
    rings.append(ring)
body = link_rings(rings, 'ContinuousShell', WHITE, caps=False)
# Close the crown, then return the real hem into a shallow internal cavity.
mesh = body.data
verts = [tuple(v.co) for v in mesh.vertices]
faces = [tuple(p.vertices) for p in mesh.polygons]
faces.append(tuple((len(rings) - 1) * segments + k for k in range(segments)))
for z, inset in [(.223, .021), (.25, .032), (.33, .04), (.43, .09)]:
    start = len(verts)
    prev = 0 if z == .223 else start - segments
    rx, ry = radius(z)
    for k in range(segments):
        a = 2 * math.pi * k / segments
        dz = (-.082 * abs(math.sin(a)) ** 2 + .003 * math.cos(3 * a)) * max(0, 1 - (z - .22) / .36) ** 2
        verts.append(((rx - inset) * math.cos(a), (ry - inset) * math.sin(a), z + dz))
    for k in range(segments):
        kn = (k + 1) % segments
        faces.append((prev + kn, prev + k, start + k, start + kn))
faces.append(tuple(reversed(range(len(verts) - segments, len(verts)))))
newmesh = bpy.data.meshes.new('Continuous shell with returned hem')
newmesh.from_pydata(verts, [], faces)
newmesh.materials.append(WHITE)
body.data = newmesh
bpy.data.meshes.remove(mesh)

# Explicit lofted flippers merge into the shell; there are no ball shoulders.
wings = []
for sign, label in [(-1, 'L'), (1, 'R')]:
    sections = [(.63, 1.87, .06, .105), (.734, 1.765, .117, .096), (.800, 1.625, .123, .073), (.866, 1.45, .106, .052), (.916, 1.295, .073, .037), (.943, 1.185, .038, .021), (.943, 1.145, .008, .009)]
    controls=sections
    sections=[]
    for section in range(len(controls)-1):
        p0,p1,p2,p3=[controls[min(len(controls)-1,max(0,section+offset))] for offset in [-1,0,1,2]]
        for step in range(5):
            t=step/5
            sections.append(tuple(.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(4)))
    sections.append(controls[-1])
    wrings = []
    for i, (x, z, width, depth) in enumerate(sections):
        before, after = sections[max(0, i - 1)], sections[min(len(sections) - 1, i + 1)]
        tangent = Vector((sign * (after[0] - before[0]), 0, after[1] - before[1])).normalized()
        normal = Vector((-tangent.z, 0, tangent.x))
        wrings.append([tuple(Vector((sign * x, -.045, z)) + normal * width * math.cos(a) + Vector((0, depth * math.sin(a), 0))) for a in [k * math.tau / 32 for k in range(32)]])
    wings.append(link_rings(wrings, f'FlipperLoft{label}', WHITE))
for obj in [body] + wings:
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
bpy.context.view_layer.objects.active=body
for wing in wings:
    union=body.modifiers.new('Local continuous shoulder union','BOOLEAN')
    union.operation='UNION'
    union.solver='EXACT'
    union.object=wing
    bpy.ops.object.modifier_apply(modifier=union.name)
    bpy.data.objects.remove(wing,do_unlink=True)
# Keep the analytic hem and dome intact. Relax only the shoulder attachment.
shoulder=body.vertex_groups.new(name='ShoulderTransition')
for vertex in body.data.vertices:
    x,y,z=vertex.co
    weight=min(1,max(0,(abs(x)-.58)/.17))*max(0,1-abs(z-1.65)/.37)
    if weight>0:
        shoulder.add([vertex.index],weight,'REPLACE')
smooth=body.modifiers.new('Relax only attached shoulder','SMOOTH')
smooth.vertex_group=shoulder.name
smooth.factor=.42
smooth.iterations=8
bpy.ops.object.modifier_apply(modifier=smooth.name)
for poly in body.data.polygons:
    poly.use_smooth = True
body['construction'] = 'One connected returned-hem shell with fused custom loft flippers; no intersecting sphere parts.'


def tube(name, points, thickness, mat, sides=10):
    rings = []
    for i, p in enumerate(points):
        p = Vector(p)
        tangent = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        u = tangent.cross(Vector((0, 1, 0))).normalized()
        if u.length < .01:
            u = tangent.cross(Vector((1, 0, 0))).normalized()
        v = tangent.cross(u).normalized()
        rings.append([tuple(p + thickness * (u * math.cos(j * math.tau / sides) + v * math.sin(j * math.tau / sides))) for j in range(sides)])
    return link_rings(rings, name, mat)


def eye_disk(name, cx, cz, rad, mat, lift):
    rings = []
    for r in [.001, .25, .5, .75, 1]:
        ring = []
        for j in range(64):
            a = j * math.tau / 64
            x, z = cx + rad * r * math.cos(a), cz + rad * r * math.sin(a)
            ring.append((x, front(x, z) - lift - .002 * (1 - r * r), z))
        rings.append(ring)
    return link_rings(rings, name, mat)


for cx, side in [(-.30, 'L'), (.30, 'R')]:
    cz, rad = 2.515, .136
    eye_disk('EyeWhite' + side, cx, cz, rad, EYE_WHITE, .0045)
    outline = []
    for j in range(97):
        a = j * math.tau / 96
        x, z = cx + rad * math.cos(a), cz + rad * math.sin(a)
        outline.append((x, front(x, z) - .006, z))
    tube('EyeOutline' + side, outline, .0033, INK)
    eye_disk('Pupil' + side, cx, cz, .0117, INK, .0085)
    for i, angle in enumerate([50, 90, 130]):
        a = math.radians(angle)
        points = []
        for j in range(9):
            r = rad + .050 * j / 8
            x, z = cx + r * math.cos(a), cz + r * math.sin(a)
            points.append((x, front(x, z) - .006 - .004 * (j / 8) ** 2, z))
        tube(f'UpperLash{side}{i + 1}', points, .0035, INK)


def bill_half(name, upper):
    rings = []
    for j in range(25):
        phi = .001 + (math.pi / 2 - .001) * j / 24
        ring=[]
        for a in [k*math.tau/96 for k in range(96)]:
            x=.333*math.sin(phi)*math.cos(a)
            seam=2.170+.024*(1-(x/.333)**2)
            z=seam+.002+.173*math.cos(phi) if upper else seam-.002-.185*math.cos(phi)
            ring.append((x,-.604+.156*math.sin(phi)*math.sin(a),z))
        rings.append(ring)
    return link_rings(rings, name, YELLOW)


bill_half('BeakUpper', True)
bill_half('BeakLower', False)
seam_rings = [[(.332 * math.cos(a), -.604 + .154 * math.sin(a), 2.170+.024*math.sin(a)**2+offset) for a in [k * math.tau / 96 for k in range(96)]] for offset in [-.002,.002]]
link_rings(seam_rings, 'BeakSeam', SEAM)


def bezier_outline(points, steps=10):
    out = []
    for p0, c0, c1, p1 in points:
        for i in range(steps):
            t = i / steps
            out.append(tuple((1-t)**3 * p0[k] + 3*(1-t)**2*t*c0[k] + 3*(1-t)*t*t*c1[k] + t**3*p1[k] for k in (0, 1)))
    return out


# Each foot is a single thick webbed fan with three rounded tips and two recesses.
outline = bezier_outline([
    ((-.12,.075),(-.22,.03),(-.245,-.19),(-.275,-.43)),
    ((-.275,-.43),(-.289,-.52),(-.28,-.535),(-.24,-.49)),
    ((-.24,-.49),(-.20,-.444),(-.16,-.425),(-.11,-.435)),
    ((-.11,-.435),(-.074,-.48),(-.086,-.535),(-.041,-.545)),
    ((-.041,-.545),(-.011,-.547),(.010,-.466),(.073,-.436)),
    ((.073,-.436),(.127,-.448),(.18,-.51),(.234,-.502)),
    ((.234,-.502),(.267,-.496),(.19,-.297),(.164,-.15)),
    ((.164,-.15),(.15,.00),(.107,.063),(.071,.081)),
    ((.071,.081),(.02,.105),(-.06,.11),(-.12,.075)),
])
for sign, side in [(-1,'L'),(1,'R')]:
    rings = []
    angle = sign * math.radians(13)
    for ri,(scale, z) in enumerate([(.035,.128),(.25,.124),(.50,.118),(.72,.100),(.87,.071),(.96,.043),(1,.028),(.985,.010),(.88,.008),(.035,.008)]):
        ring=[]
        for x, y in outline:
            x, y = x * scale, -.20 + (y + .20) * scale
            # Mirroring gives the outward fan a balanced pair of footprints.
            x *= sign
            px = x * math.cos(angle) - y * math.sin(angle)
            py = x * math.sin(angle) + y * math.cos(angle)
            # The rear web rises continuously into its concealed foot root.
            bump=.26*math.exp(-((x/.10)**4+((y-.044)/.087)**4)) if ri<7 else 0
            ring.append((sign * .40 + px, -.295 + py, z+bump))
        rings.append(ring)
    foot = link_rings(rings, 'WebFoot' + side, YELLOW)
    foot['toe_count'] = 3
    foot['sole_z_m'] = .008
    bpy.context.view_layer.objects.active=foot
    subdivision=foot.modifiers.new('Smooth connected web and concealed heel','SUBSURF')
    subdivision.levels=2
    bpy.ops.object.modifier_apply(modifier=subdivision.name)

# Export only the actual actor, not the review floor/lights/cameras.
for obj in root.children_recursive:
    if obj.type == 'MESH':
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(obj.data)
        bm.free()
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for obj in root.children_recursive:
    obj.select_set(True)
temp_glb = OUT / 'elizabeth-static.glb'
bpy.ops.export_scene.gltf(filepath=str(temp_glb), export_format='GLB', use_selection=True, export_yup=True, export_animations=False, export_extras=True)
digest = hashlib.sha256(temp_glb.read_bytes()).hexdigest()
glb = OUT / f'elizabeth-static.{digest[:12]}.glb'
temp_glb.replace(glb)

# A saved neutral studio is part of the editable source and never exported.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,0))
floor = bpy.context.object
floor.name = 'REVIEW_floor'
floor.data.materials.append(FLOOR)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z','Y').to_euler()


for name, location, energy, size, tint in [
    ('REVIEW_key',(-3.8,-4.5,6),600,4,(1,.95,.87)),
    ('REVIEW_fill',(4,-2.5,3.4),360,3.5,(.85,.91,1)),
    ('REVIEW_rim',(1.0,4,5),500,3,(1,1,1)),
]:
    bpy.ops.object.light_add(type='AREA',location=location)
    light=bpy.context.object
    light.name=name
    light.data.energy=energy
    light.data.shape='DISK'
    light.data.size=size
    light.data.color=tint
    aim(light,(0,0,1.5))

bpy.ops.object.camera_add()
camera=bpy.context.object
camera.name='REVIEW_camera'
camera.data.type='ORTHO'
camera.data.ortho_scale=3.7
scene.camera=camera

views = {
    'front': ((0,-8,1.52),(0,0,1.52),3.7),
    'profile-left': ((-8,0,1.52),(0,0,1.52),3.7),
    'profile-right': ((8,0,1.52),(0,0,1.52),3.7),
    'back': ((0,8,1.52),(0,0,1.52),3.7),
    'threequarter': ((4.8,-6.8,3.3),(0,0,1.48),3.7),
    'face': ((0,-8,2.48),(0,-.35,2.48),1.44),
    'feet': ((2,-4,1.6),(0,-.36,.15),1.70),
    'low-threequarter': ((2.4,-4,.10),(0,-.1,.38),2.3),
}
metrics = {'schema':1,'stage':'STATIC_ART_REVIEW_PENDING','model':str(glb.relative_to(ROOT)), 'sha256':digest,'source':'world/public/models/companions/elizabeth.blend','original_authored_geometry':True,'tv_reference':'work/living-v8/research/references/elizabeth-tv.gif','not_official_design_ownership':True,'coordinates':{'blender_up':'+Z','blender_forward':'-Y','gltf_up':'+Y','gltf_forward':'+Z'},'authored_height_m':3,'body_width_height_ratio':.498,'eyes':{'diameter_m':.272,'centres_x_m':[-.3,.3],'centre_z_m':2.515,'pupil_diameter_m':.0234,'upper_lashes_per_eye':3},'mesh_objects':{},'renders':{}}
for obj in root.children_recursive:
    if obj.type=='MESH':
        obj.data.calc_loop_triangles()
        metrics['mesh_objects'][obj.name]={'vertices':len(obj.data.vertices),'triangles':len(obj.data.loop_triangles)}

def render(name, view, silhouette=False, floor_color=None):
    location,target,scale=view
    camera.data.type='PERSP' if name=='low-threequarter' else 'ORTHO'
    camera.data.lens=58
    camera.location=location
    camera.data.ortho_scale=scale
    aim(camera,target)
    if floor_color:
        FLOOR.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*floor_color,1)
    path=RENDERS/(name+'.png')
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    metrics['renders'][name]={'path':str(path.relative_to(ROOT)),'asset_sha256':digest,'clip':'static','time':0,'camera_position':location,'camera_target':target,'projection':camera.data.type,'orthographic_scale':scale if camera.data.type=='ORTHO' else None,'lens_mm':camera.data.lens if camera.data.type=='PERSP' else None,'silhouette':silhouette}

for name,view in views.items():
    render(name,view)
render('front-bright',views['front'],floor_color=(.76,.77,.79))
render('front-dark',views['front'],floor_color=(.048,.055,.07))
FLOOR.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.245,.26,.285,1)
saved_materials={obj:[mat for mat in obj.data.materials] for obj in root.children_recursive if obj.type=='MESH'}
silhouette=material('REVIEW_silhouette',(0,0,0,1),1)
silhouette.node_tree.nodes.clear()
silhouette_output=silhouette.node_tree.nodes.new('ShaderNodeOutputMaterial')
silhouette_emission=silhouette.node_tree.nodes.new('ShaderNodeEmission')
silhouette_emission.inputs['Color'].default_value=(0,0,0,1)
silhouette.node_tree.links.new(silhouette_emission.outputs['Emission'],silhouette_output.inputs['Surface'])
for obj in saved_materials:
    obj.data.materials.clear()
    obj.data.materials.append(silhouette)
for name in ['front','profile-right','back']:
    render('silhouette-'+name,views[name],True,floor_color=(.8,.8,.8))
for obj,mats in saved_materials.items():
    obj.data.materials.clear()
    for mat in mats:
        obj.data.materials.append(mat)
FLOOR.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.245,.26,.285,1)
camera.location=views['threequarter'][0]
camera.data.ortho_scale=3.7
aim(camera,views['threequarter'][1])
scene['asset_sha256']=digest
scene['review_status']='Awaiting root and independent artist static art gate; no animation authored.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'elizabeth.blend'))
(DOC/'elizabeth-static-review.json').write_text(json.dumps(metrics,indent=2)+'\n')
print('STATIC_REVIEW_READY',str(glb),digest)
