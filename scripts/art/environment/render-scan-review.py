"""Review the exact runtime GLBs under three lighting states, in isolated Blender."""
import bpy
import json
import pathlib
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[3]
OUTPUT=ROOT.parent/"qa/academy-v3/environment"
OUTPUT.mkdir(parents=True,exist_ok=True)

def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()

for asset in ["rock_face_02","rock_moss_set_02"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=str(ROOT/"world/public/models/environment/scans"/f"{asset}.glb"))
    objects=[o for o in scene.objects if o.type=="MESH"]
    bpy.context.view_layer.update()
    # Match runtime individual grounding; source set translations are a
    # presentation layout and several pieces otherwise hover over one floor.
    for obj in objects:
        bottom=min((obj.matrix_world@Vector(v)).z for v in obj.bound_box)
        obj.location.z-=bottom
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box]
    low=Vector(tuple(min(p[k] for p in points) for k in range(3)))
    high=Vector(tuple(max(p[k] for p in points) for k in range(3)))
    center=(low+high)*.5;size=high-low;extent=max(size)
    bpy.ops.object.camera_add(location=center+Vector((.78,-1.3,.78))*extent)
    camera=bpy.context.object;camera.data.type="ORTHO";aim(camera,center);scene.camera=camera
    bpy.context.view_layer.update()
    projected=[camera.matrix_world.inverted()@p for p in points]
    width=max(p.x for p in projected)-min(p.x for p in projected)
    height=max(p.y for p in projected)-min(p.y for p in projected)
    camera.data.ortho_scale=max(width,height*1300/900)*1.15
    bpy.ops.mesh.primitive_plane_add(size=extent*30,location=(center.x,center.y,low.z-.025))
    ground=bpy.context.object;material=bpy.data.materials.new("Neutral warm grey review floor");material.diffuse_color=(.10,.13,.12,1);material.use_nodes=True;material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(.10,.13,.12,1);material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.98;ground.data.materials.append(material)
    world=bpy.data.worlds.new("Review environment");world.use_nodes=True;scene.world=world
    bpy.ops.object.light_add(type="SUN",location=center+Vector((-1,-.8,2))*extent)
    key=bpy.context.object;key.data.angle=.14;aim(key,center)
    bpy.ops.object.light_add(type="AREA",location=center+Vector((1,.3,1.2))*extent)
    rim=bpy.context.object;rim.data.shape="DISK";rim.data.size=extent*.85;aim(rim,center)
    scene.render.engine="CYCLES";scene.cycles.samples=20;scene.cycles.use_denoising=True
    scene.render.resolution_x=1300;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.view_settings.view_transform="AgX"
    modes={"neutral":((.58,.64,.67),.5,(1,.96,.90),2.0,(.84,.90,1),16),"day":((.53,.68,.85),.75,(1,.94,.80),3.0,(.78,.87,1),24),"night":((.11,.19,.32),.32,(.52,.72,1),.65,(1,.58,.28),6)}
    for mode,(sky,ambient,key_color,energy,rim_color,power) in modes.items():
        world.node_tree.nodes["Background"].inputs["Color"].default_value=(*sky,1);world.node_tree.nodes["Background"].inputs["Strength"].default_value=ambient
        key.data.color=key_color;key.data.energy=energy;rim.data.color=rim_color;rim.data.energy=extent*extent*power
        scene.render.filepath=str(OUTPUT/f"{asset}-{mode}.png");bpy.ops.render.render(write_still=True)
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/f"{asset}-review.blend"),compress=True)
    print(json.dumps({"asset":asset,"boundsMetres":list(size),"triangles":sum(len(o.data.polygons) for o in objects),"output":str(OUTPUT)}),flush=True)
