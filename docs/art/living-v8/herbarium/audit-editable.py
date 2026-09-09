"""Audit the actual saved editable scenes, including packed images and runtime provenance."""
import bpy
import hashlib
import json
import struct
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
ROOT = EVIDENCE.parents[3]
MODELS = ROOT / 'work/living-v8/exports/herbarium'
manifest = json.loads((MODELS / 'manifest.json').read_text())
results = {}
for kind, expected in manifest['assets'].items():
    path = MODELS / (kind + '.blend')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected['editableSha256']
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene = bpy.context.scene
    assert scene['runtime_glb_sha256'] == expected['sha256']
    glb = (MODELS / (kind + '.glb')).read_bytes()
    json_size = struct.unpack_from('<I', glb, 12)[0]
    gltf = json.loads(glb[20:20 + json_size])
    binary = glb[28 + json_size:]
    encoded_images = set()
    for image in gltf['images']:
        view = gltf['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        encoded_images.add(hashlib.sha256(binary[start:start + view['byteLength']]).hexdigest())
    source = bpy.data.texts['herbarium-assets.js'].as_string()
    assert hashlib.sha256(source.encode()).hexdigest() == manifest['authoring']['sha256']
    metadata = json.loads(bpy.data.texts['PARTS_AND_SUPPORT.json'].as_string())
    assert metadata['actualBounds'] == expected['bounds']
    meshes = [obj for obj in scene.objects if obj.type == 'MESH']
    assert len(meshes) == expected['batches']
    low, high = [float('inf')] * 3, [-float('inf')] * 3
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        for vertex in obj.data.vertices:
            p = obj.matrix_world @ vertex.co
            runtime = (p.x, p.z, -p.y)
            for axis in range(3):
                low[axis] = min(low[axis], runtime[axis])
                high[axis] = max(high[axis], runtime[axis])
        assert obj.data.materials and obj['source_asset'] == kind
    assert triangles == expected['triangles'], (kind, triangles, expected['triangles'])
    for actual, target in ((low, expected['bounds']['min']), (high, expected['bounds']['max'])):
        assert max(abs(a - b) for a, b in zip(actual, target)) < 1e-5, (kind, actual, target)
    images = []
    for image in bpy.data.images:
        if image.name in ('Render Result', 'Viewer Node'):
            continue
        assert image.packed_file and image.packed_file.size > 0, (kind, image.name, 'image not packed')
        assert image.size[0] > 0 and image.size[1] > 0
        packed_sha = hashlib.sha256(image.packed_file.data).hexdigest()
        assert packed_sha in encoded_images, (kind, image.name, 'packed pixels differ from GLB image')
        images.append({'name': image.name, 'size': list(image.size), 'packedBytes': image.packed_file.size, 'encodedImageSha256': packed_sha})
    assert images
    assert {image['encodedImageSha256'] for image in images} == encoded_images
    results[kind] = {'editableSha256': expected['editableSha256'], 'sourceSha256': manifest['authoring']['sha256'],
                     'runtimeGLBSha256': expected['sha256'], 'meshes': len(meshes), 'triangles': triangles,
                     'actualRuntimeBounds': {'min': low, 'max': high}, 'packedImages': images}
    print('EDITABLE_AUDIT_PASS', kind, triangles, 'triangles', len(images), 'packed images')
(EVIDENCE / 'editable-audit.json').write_text(json.dumps(results, indent=2) + '\n')
