"""Isolated architecture asset review. Blender --background --factory-startup only.

Run from repository root:
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/art/architecture/render-assets.py -- castle library observatory workshop owlery ruins
"""
import bpy
import json
import math
import pathlib
import sys
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "world/public/models/architecture"
NAMES = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["castle"]

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

for name in NAMES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=str(OUTPUT / f"{name}.glb"))
    architecture = [obj for obj in scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(corner) for obj in architecture for corner in obj.bound_box]
    low = Vector(tuple(min(p[k] for p in points) for k in range(3)))
    high = Vector(tuple(max(p[k] for p in points) for k in range(3)))
    center = (low + high) * 0.5
    size = high - low
    radius = max(size.x, size.y, size.z)

    # glTF Y-up becomes Blender Z-up. Front +Z becomes Blender -Y.
    bpy.ops.object.camera_add(location=(center.x + radius * 1.02, center.y - radius * 1.65, center.z + radius * 0.61))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = radius * 1.24
    aim(camera, center + Vector((0, 0, size.z * 0.015)))
    scene.camera = camera

    bpy.ops.mesh.primitive_plane_add(size=radius * 20, location=(0, 0, low.z - 0.035))
    floor = bpy.context.object
    floor.name = "Studio ground; not part of the exported game asset"
    ground = bpy.data.materials.new("Neutral charcoal studio")
    ground.diffuse_color = (0.085, 0.102, 0.105, 1)
    ground.use_nodes = True
    ground.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.085, 0.102, 0.105, 1)
    ground.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 0.92
    floor.data.materials.append(ground)

    world = bpy.data.worlds.new("Neutral review illumination")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.36, 0.43, 0.52, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    scene.world = world
    bpy.ops.object.light_add(type="SUN", location=(radius, -radius, radius * 2))
    sun = bpy.context.object
    sun.data.energy = 2.8
    sun.data.angle = 0.12
    sun.data.color = (1.0, 0.91, 0.78)
    aim(sun, center)
    for offset, energy, color in [((-1.3, -.8, 1.6), 48, (.76, .86, 1)), ((.8, .8, 1.8), 82, (1, .87, .69))]:
        bpy.ops.object.light_add(type="AREA", location=center + Vector(offset) * radius)
        light = bpy.context.object
        light.data.energy = energy * radius * radius
        light.data.shape = "DISK"
        light.data.size = radius * 1.1
        light.data.color = color
        aim(light, center)

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.render.filepath = str(OUTPUT / f"{name}-studio.png")
    bpy.ops.render.render(write_still=True)
    # Studio .blend contains the inspectable asset, camera, and reproducible lighting.
    bpy.ops.file.pack_all()
    for image in bpy.data.images:
        if image.packed_file and image.filepath:
            source = pathlib.Path(image.filepath)
            image.filepath = f"//../../textures/{source.parent.name}/{source.name}"
    scene.render.filepath = f"//{name}-studio.png"
    scene["source_asset"] = f"//{name}.glb"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / f"{name}-studio.blend"), compress=True)
    print(json.dumps({"asset": name, "render": scene.render.filepath, "size": list(size)}), flush=True)
