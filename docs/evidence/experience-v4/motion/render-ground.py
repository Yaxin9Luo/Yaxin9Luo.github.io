import bpy,math,sys
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
V=lambda p:Vector((p[0],-p[2],p[1]))
scene=bpy.context.scene;rig=bpy.data.objects['AcademyRiderRig'];scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=840;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.12,.16,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.view_settings.view_transform='AgX'
for o in list(scene.objects):
 if o.get('broomPart'):o.hide_render=True
bpy.ops.mesh.primitive_plane_add(size=200,location=V((0,-1.30,0)));floor=bpy.context.object
mat=bpy.data.materials.new('Neutral review floor');mat.diffuse_color=(.09,.11,.12,1);floor.data.materials.append(mat)
def light(name,pos,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=V(pos);o.rotation_euler=(V((0,.1,0))-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',(-3,4,-4),750,(1,.88,.73),3.4);light('Fill',(3,2,-2),420,(.65,.8,1),3);light('Rim',(1,3,3),900,(.66,.8,1),2.8)
camera=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'));scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=3.75
cases=[('stand-day','ground_idle',1,(0,.35,-6)),('stand-night','ground_idle',1,(0,.35,-6)),('mount-middle','mount',61,(-4,1,-6)),('cast-release','ground_cast',19,(-4,1,-6)),('stand-front','ground_idle',1,(0,.35,-6)),('stand-side','ground_idle',1,(6,.35,0)),('stand-back','ground_idle',1,(0,.35,6)),('walk-contact','walk',1,(-4,1,-6)),('walk-passing','walk',76,(-4,1,-6)),('run-contact','run',1,(-4,1,-6)),('run-flight','run',32,(-4,1,-6))]
selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for name,state,frame,pos in cases:
 if selected and name not in selected:continue
 bpy.data.objects['Key'].data.energy=1100 if name.endswith('day') else 240 if name.endswith('night') else 750
 bpy.data.objects['Key'].data.color=(.55,.72,1) if name.endswith('night') else (1,.88,.73)
 bpy.data.objects['Fill'].data.energy=150 if name.endswith('night') else 420
 scene.world.node_tree.nodes['Background'].inputs[1].default_value=.18 if name.endswith('night') else .5
 rig.animation_data.action=bpy.data.actions[state];scene.frame_set(frame)
 for o in scene.objects:
  if o.get('broomPart'):o.hide_render=state!='mount'
 camera.location=V(pos);camera.rotation_euler=(V((0,.17,.02))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
