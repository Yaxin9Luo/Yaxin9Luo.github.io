"""Package unchanged scan geometry and native 4K PBR maps into local GLBs.

Re-encode JPEG pixels as WebP without resizing. All original source files are
retained under work/production-v3/environment-sources with publisher hashes.
"""
import copy
import hashlib
import io
import json
import pathlib
import struct
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
SOURCES = ROOT / "work/production-v3/environment-sources"
OUTPUT = ROOT / "world/public/models/environment/scans"
OUTPUT.mkdir(parents=True, exist_ok=True)
records = []

def padded(data, byte=b"\0"):
    return data + byte * ((-len(data)) % 4)

for asset in ["rock_face_02", "rock_moss_set_02"]:
    source_dir = SOURCES / asset
    source = json.loads((source_dir / f"{asset}_4k.gltf").read_text())
    gltf = copy.deepcopy(source)
    source_buffer = (source_dir / source["buffers"][0]["uri"]).read_bytes()
    data = bytearray(padded(source_buffer))
    maps = []
    for image in gltf["images"]:
        original = source_dir / image.pop("uri")
        pixels = Image.open(original).convert("RGB")
        normal = "nor_gl" in original.name
        quality = 100 if normal else 95
        encoded = io.BytesIO()
        pixels.save(encoded, "WEBP", quality=quality, method=6)
        payload = encoded.getvalue()
        view = len(gltf["bufferViews"])
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(data), "byteLength": len(payload)})
        image.update({"mimeType": "image/webp", "bufferView": view})
        data.extend(padded(payload))
        maps.append({"source": original.name, "width": pixels.width, "height": pixels.height,
                     "encoding": f"WebP quality {quality}, method 6, no resizing", "bytes": len(payload),
                     "sha256": hashlib.sha256(payload).hexdigest(),
                     "colorSpace": "sRGB" if "diff" in original.name else "non-color"})
    for texture in gltf["textures"]:
        texture["extensions"] = {"EXT_texture_webp": {"source": texture.pop("source")}}
    gltf["extensionsUsed"] = ["EXT_texture_webp"]
    gltf["extensionsRequired"] = ["EXT_texture_webp"]
    gltf["buffers"] = [{"byteLength": len(data)}]
    for material in gltf["materials"]:
        arm = material["pbrMetallicRoughness"]["metallicRoughnessTexture"]["index"]
        material["occlusionTexture"] = {"index": arm, "strength": .75}
        material["extras"] = {"source": f"https://polyhaven.com/a/{asset}", "license": "CC0-1.0", "scan": True}
    gltf["asset"]["extras"] = {"source": f"https://polyhaven.com/a/{asset}", "license": "CC0-1.0", "geometry": "Original publisher triangles, normals and UVs unchanged", "units": "metres"}
    doc = padded(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    binary = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(doc) + 8 + len(data)) + struct.pack("<II", len(doc), 0x4e4f534a) + doc + struct.pack("<II", len(data), 0x004e4942) + data
    target = OUTPUT / f"{asset}.glb"
    target.write_bytes(binary)
    info = json.loads((SOURCES / f"{asset}-info.json").read_text())
    meshes = []
    for node in source["nodes"]:
        if "mesh" not in node:
            continue
        for primitive in source["meshes"][node["mesh"]]["primitives"]:
            position = source["accessors"][primitive["attributes"]["POSITION"]]
            meshes.append({"name": node["name"], "triangles": source["accessors"][primitive["indices"]]["count"] // 3,
                           "sourceLocalBounds": {"min": position["min"], "max": position["max"]},
                           "sourceNodeScale": node.get("scale", [1, 1, 1])})
    record = {"id": asset, "source": f"https://polyhaven.com/a/{asset}", "authors": info["authors"],
              "license": "CC0-1.0", "licenseURL": "https://polyhaven.com/license", "file": target.name,
              "bytes": len(binary), "sha256": hashlib.sha256(binary).hexdigest(), "units": "metres",
              "sourceBuffer": {"byteOffset": 0, "byteLength": len(source_buffer), "sha256": hashlib.sha256(source_buffer).hexdigest()},
              "geometry": "Original 4K glTF vertex/index buffer unchanged; no decimation", "triangles": sum(m["triangles"] for m in meshes),
              "runtimePlacement": "Each piece keeps source scale, is centred in XZ and grounded at minY; source layout translations are omitted.",
              "meshes": meshes, "textures": maps}
    records.append(record)
    print(json.dumps({"asset": asset, "triangles": record["triangles"], "bytes": len(binary)}), flush=True)
(OUTPUT / "manifest.json").write_text(json.dumps({"version": 3, "builder": "scripts/art/environment/build-rock-scans.py",
    "originalDownloads": "work/production-v3/environment-sources/downloads.json", "assets": records}, indent=2) + "\n")
(OUTPUT / "LICENSE.txt").write_text("Poly Haven scans: CC0 1.0 Universal.\nRock Face 02: Dario Barresi (All), Rico Cilliers (processing).\nRock Moss Set 02: Kless Gyzen (All).\nhttps://polyhaven.com/a/rock_face_02\nhttps://polyhaven.com/a/rock_moss_set_02\nhttps://polyhaven.com/license\nhttps://creativecommons.org/publicdomain/zero/1.0/\nOriginal geometry and source material maps retained locally; see manifest.json for derivative encoding and hashes.\n")
