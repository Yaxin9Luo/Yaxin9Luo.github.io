"""Render the exact exported garden meshes in isolated Blender neutral lighting.

/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/art/environment/render-assets.py -- courtyard reading
"""
import bpy
import json
import pathlib
import sys
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "world/public/models/environment"
QA = ROOT.parent / "qa/academy-v2/environment-assets"
QA.mkdir(parents=True, exist_ok=True)
NAMES = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["courtyard", "reading"]

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

for name in NAMES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=str(OUTPUT / f"{name}.glb"))
    points = [obj.matrix_world @ Vector(corner) for obj in scene.objects if obj.type == "MESH" for corner in obj.bound_box]
    low = Vector(tuple(min(p[k] for p in points) for k in range(3)))
    high = Vector(tuple(max(p[k] for p in points) for k in range(3)))
    center = (low + high) * 0.5
    size = high - low
    extent = max(size.x, size.y, size.z)
    bpy.ops.object.camera_add(location=(center.x + extent * .69, center.y - extent * .92, center.z + extent * .81))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = extent * 1.30
    if name.startswith("grove-"):
        camera.data.ortho_scale = extent * 1.55
    elif name == "garden-flower":
        camera.data.ortho_scale = extent * 1.70
    aim(camera, center)
    scene.camera = camera

    botanical = name.startswith("grove-") or name in ("garden-flower", "garden-shrub")
    # Plant factories define the soil plane at zero; their buried roots should
    # meet that plane here just as they do in the runtime garden beds.
    bpy.ops.mesh.primitive_plane_add(size=extent * 12, location=(0, 0, 0 if botanical else low.z - .035))
    floor = bpy.context.object
    floor.name = "Neutral studio floor (not part of the runtime model)"
    ground = bpy.data.materials.new("Neutral warm grey")
    ground.use_nodes = True
    ground.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.13, .15, .14, 1)
    ground.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .95
    floor.data.materials.append(ground)
    world = bpy.data.worlds.new("Neutral asset review")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.56, .63, .67, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
    scene.world = world
    bpy.ops.object.light_add(type="SUN", location=(extent, -extent, extent * 2))
    sun = bpy.context.object
    sun.data.energy = 2.1
    sun.data.angle = .15
    sun.data.color = (1, .94, .84)
    aim(sun, center)
    bpy.ops.object.light_add(type="AREA", location=(-extent, extent * .5, extent * 1.2))
    fill = bpy.context.object
    fill.data.energy = extent * extent * 32
    fill.data.shape = "DISK"
    fill.data.size = extent
    fill.data.color = (.8, .88, 1)
    aim(fill, center)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.render.filepath = str(QA / f"{name}-studio.png")
    bpy.ops.render.render(write_still=True)
    if name == "courtyard":
        camera.location = (0, -1, 61)
        camera.data.ortho_scale = 47
        aim(camera, (0, 0, 0))
        scene.render.resolution_x = 1100
        scene.render.resolution_y = 1300
        scene.render.filepath = str(QA / "courtyard-plan.png")
        bpy.ops.render.render(write_still=True)
        camera.location = (15, -34, 13)
        camera.data.ortho_scale = 35
        aim(camera, (0, -2, 2.5))
        scene.render.resolution_x = 1400
        scene.render.resolution_y = 900
        scene.render.filepath = str(QA / "courtyard-low.png")
        bpy.ops.render.render(write_still=True)
    details = {
        "post": ((8, -8, 6), (4.3, -3.15, 2.2), 5.3),
        "journey": ((-4, 0, 6), (-7.7, 4.7, 2.05), 4.2),
        "astral": ((-1, -8, 5), (-5, -3.5, 2.1), 5.2),
        "reading": ((9, 0, 5), (5, 5.5, 1.6), 6.0),
        "grove-silver": ((6, -10, 7), (0, 0, 5.8), 4.2),
        "grove-pine": ((6, -10, 7), (0, 0, 4.8), 3.0),
        "grove-cherry": ((6, -10, 7), (0, 0, 5.8), 3.0),
    }
    if name in details:
        location, target, scale = details[name]
        camera.location = location
        camera.data.ortho_scale = scale
        aim(camera, target)
        scene.render.resolution_x = 1200
        scene.render.resolution_y = 900
        scene.render.filepath = str(QA / f"{name}-detail.png")
        bpy.ops.render.render(write_still=True)
    if name == "reading":
        camera.location = (4.2, -4.9, 4.5)
        camera.data.ortho_scale = 3.8
        aim(camera, (1.8, -2.5, 2.1))
        scene.render.filepath = str(QA / "reading-desk-detail.png")
        bpy.ops.render.render(write_still=True)
    if name.startswith("grove-"):
        camera.location = (3, -5, 2.4)
        camera.data.ortho_scale = 2.7
        aim(camera, (0, 0, 0.9))
        scene.render.filepath = str(QA / f"{name}-base.png")
        bpy.ops.render.render(write_still=True)
        camera.location = (15, -24, 13)
        camera.data.ortho_scale = 38
        aim(camera, center)
        scene.render.resolution_x = 512
        scene.render.resolution_y = 512
        scene.render.filepath = str(QA / f"{name}-distance.png")
        bpy.ops.render.render(write_still=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene["source_asset"] = str(OUTPUT / f"{name}.glb")
    bpy.ops.wm.save_as_mainfile(filepath=str(QA / f"{name}-studio.blend"), compress=True)
    print(json.dumps({"asset": name, "size": list(size), "studio": str(QA / f"{name}-studio.png")}), flush=True)
