"""Capture missing review views from a saved motion source; never replace evidence.

Blender -b --python .../capture-dog-review.py -- sadaharu-motion-r8 [--complete]
"""
import bpy
import hashlib
import json
import shutil
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
DOC = ROOT / 'docs/art/living-v8/companions'
args = sys.argv[sys.argv.index('--') + 1:]
evidence = DOC / args[0]
record = evidence / 'review.json'
metadata = json.loads((record if record.exists() else DOC / 'sadaharu-motion-review.json').read_text())
assert all(Path(frame['image']).parent.name == evidence.name for frame in metadata['renders'])
model = ROOT / metadata['model']
assert hashlib.sha256(model.read_bytes()).hexdigest() == metadata['sha256']
snapshot = evidence / 'sadaharu-motion.blend'
if not snapshot.exists():
    shutil.copy2(ROOT / metadata['source'], snapshot)
metadata['source'] = str(snapshot.relative_to(ROOT))
metadata['source_sha256'] = hashlib.sha256(snapshot.read_bytes()).hexdigest()
record.write_text(json.dumps(metadata, indent=2) + '\n')
bpy.ops.wm.open_mainfile(filepath=str(snapshot))
scene = bpy.context.scene
rig = bpy.data.objects['SadaharuRig']
camera = scene.camera
captures = [
    ('idle-profile', 'idle', 0, 'profile'),
    ('sit-profile-mid', 'sit', .625, 'profile'),
    ('walk-right-f006', 'walk', 1.05, 'right'),
    ('walk-right-f007', 'walk', 1.225, 'right'),
]
if '--complete' in args:
    captures.extend((f'walk-profile-f{i:03}', 'walk', 1.4*i/8, 'profile') for i in range(8))
    for clip, duration in [('sit', 1.25), ('stand', 1.1)]:
        captures.extend((f'{clip}-profile-f{i:03}', clip, duration*i/4, 'profile') for i in range(5))
    captures.extend([
        ('sniff-threequarter', 'sniff', 1.2, 'threequarter'),
        ('greet-threequarter-f000', 'greet', .22, 'threequarter'),
        ('greet-threequarter-f001', 'greet', .65, 'threequarter'),
    ])
for name, clip, time, view in captures:
    path = evidence / (name + '.png')
    existing = next((frame for frame in metadata['renders'] if Path(frame['image']).name == path.name), None)
    if existing:
        assert hashlib.sha256(path.read_bytes()).hexdigest() == existing['sha256']
        continue
    assert not path.exists(), f'Refusing to overwrite unregistered evidence {path}'
    rig.animation_data.action = bpy.data.actions[clip]
    scene.frame_set(round(time * scene.render.fps))
    location, look, scale = {
        'profile': ((-8,.3,2.25),(0,.3,1.4),4.5),
        'right': ((8,.3,2.25),(0,.3,1.4),4.5),
        'threequarter': ((4.8,-6.8,3.6),(0,.25,1.45),4.5),
    }[view]
    camera.location = location
    camera.data.ortho_scale = scale
    camera.rotation_euler = (Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    metadata['renders'].append(dict(image=str(path.relative_to(ROOT)), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        model_sha256=metadata['sha256'], clip=clip, time=time, sampled_time=scene.frame_current/scene.render.fps,
        camera=location, target=look, scale=scale))
    record.write_text(json.dumps(metadata, indent=2) + '\n')
(DOC / 'sadaharu-motion-review.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('CAPTURES_READY', evidence, len(metadata['renders']))
