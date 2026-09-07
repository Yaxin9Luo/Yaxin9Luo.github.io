#!/usr/bin/env python3
"""Acquire the selected CC0 world materials; use --verify for an offline audit.

Requires Python 3, curl, and Pillow with WebP support. Sources are cached under work/;
the committed browser assets are self-hosted and do not call provider APIs.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import re
import subprocess
import time
import zipfile

from PIL import Image, ImageStat, features


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "work/asset-acquisition/downloads"
OUTPUT = ROOT / "world/public/textures"
USER_AGENT = "YaxinLivingGrimoireAssetBuilder/1.0 (+https://yaxin9luo.github.io)"
CC0 = "https://creativecommons.org/publicdomain/zero/1.0/"
POLY_LICENSE = "https://polyhaven.com/license"
AMBIENT_LICENSE = "https://docs.ambientcg.com/license/"

POLY_MATERIALS = [
    ("castle-masonry", "old_stone_wall_02", "2k", 2048),
    ("slate-roof", "roof_slates_02", "2k", 2048),
    ("mossy-rock", "mossy_rock", "1k", 1024),
    ("forest-ground", "forest_floor", "1k", 1024),
    ("meadow", "aerial_grass_rock", "1k", 1024),
    ("aged-wood", "weathered_planks", "1k", 1024),
    ("pine-bark", "pine_bark", "1k", 1024),
    ("wool-cloth", "poly_wool_herringbone", "1k", 1024),
    ("dark-leather", "brown_leather", "1k", 1024),
]


def digest(data, algorithm="sha256"):
    return hashlib.new(algorithm, data).hexdigest()


def fetch(url, cache_name, expected_md5=None, expected_size=None):
    target = CACHE / cache_name
    if target.exists():
        raw = target.read_bytes()
        if (not expected_md5 or digest(raw, "md5") == expected_md5) and (
            not expected_size or len(raw) == expected_size
        ):
            return raw
    CACHE.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            # Some macOS network routes terminate TLS 1.3 handshakes to the
            # providers' object storage. TLS 1.2 keeps certificate verification
            # enabled and works without changing the user's global proxy.
            response = subprocess.run([
                "curl", "--fail", "--location", "--silent", "--show-error",
                "--tlsv1.2", "--tls-max", "1.2",
                "--max-time", "120", "--user-agent", USER_AGENT, url,
            ], check=True, capture_output=True)
            raw = response.stdout
            if expected_size and len(raw) != expected_size:
                raise ValueError(f"Source size mismatch: {url}")
            if expected_md5 and digest(raw, "md5") != expected_md5:
                raise ValueError(f"Source MD5 mismatch: {url}")
            target.write_bytes(raw)
            return raw
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def fetch_json(url, cache_name):
    return json.loads(fetch(url, cache_name))


def publish_image(slug, role, raw, source, max_size, opacity=None):
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    original_size = list(image.size)
    if opacity is not None:
        mask = Image.open(io.BytesIO(opacity)).convert("L")
        if mask.size != image.size:
            raise ValueError("Foliage color/opacity dimensions disagree")
        image.putalpha(mask)
    image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    directory = OUTPUT / slug
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{role}.webp"
    # The original maps are JPEG. Keep hero maps at 2K and use high-quality WebP
    # for delivery; record normal angular error rather than claiming losslessness.
    # Opacity stays lossless, including the color image's embedded WebP alpha.
    lossless = role == "alpha"
    quality = 90 if role == "color" else 95
    buffer = io.BytesIO()
    image.save(buffer, "WEBP", lossless=lossless, quality=quality, method=6, exact=True)
    encoded = buffer.getvalue()
    temporary = target.with_suffix(".webp.tmp")
    temporary.write_bytes(encoded)
    temporary.replace(target)
    decoded = Image.open(io.BytesIO(encoded))
    decoded.load()
    result = {
        "path": f"/textures/{slug}/{target.name}",
        "bytes": len(encoded),
        "sha256": digest(encoded),
        "width": decoded.width,
        "height": decoded.height,
        "channels": decoded.mode,
        "colorSpace": "sRGB" if role == "color" else "linear / no color conversion",
        "encoding": {"format": "WebP", "lossless": lossless, "quality": quality, "method": 6},
        "sourceDimensions": original_size,
        "source": {**source, "sha256": digest(raw)},
    }
    if role == "normal":
        result["normalConvention"] = "OpenGL (+Y)"
        original_pixels, decoded_pixels = image.load(), decoded.convert("RGB").load()
        errors = []
        for y in range(0, image.height, 8):
            for x in range(0, image.width, 8):
                a = [value / 127.5 - 1 for value in original_pixels[x, y]]
                b = [value / 127.5 - 1 for value in decoded_pixels[x, y]]
                denominator = math.sqrt(sum(value * value for value in a) * sum(value * value for value in b))
                cosine = sum(u * v for u, v in zip(a, b)) / max(denominator, 1e-12)
                errors.append(math.degrees(math.acos(min(1, max(-1, cosine)))))
        errors.sort()
        result["normalCompressionErrorDegrees"] = {
            "samplingStridePixels": 8,
            "sampleCount": len(errors),
            "mean": round(sum(errors) / len(errors), 4),
            "percentile95": round(errors[int(len(errors) * 0.95)], 4),
            "percentile99": round(errors[int(len(errors) * 0.99)], 4),
        }
    if opacity is not None:
        result["alphaSourceSha256"] = digest(opacity)
        result["hasEmbeddedOpacity"] = True
    print(f"  {result['path']} {decoded.width}×{decoded.height}: {len(encoded):,} bytes", flush=True)
    return result


def poly_material(slug, asset_id, resolution, max_size):
    print(f"Poly Haven: {asset_id}", flush=True)
    info_url = f"https://api.polyhaven.com/info/{asset_id}"
    files_url = f"https://api.polyhaven.com/files/{asset_id}"
    info = fetch_json(info_url, f"{asset_id}-info.json")
    files = fetch_json(files_url, f"{asset_id}-files.json")
    result = {
        "provider": "Poly Haven",
        "assetId": asset_id,
        "title": info["name"],
        "authors": info.get("authors", {}),
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}",
        "metadataUrls": [info_url, files_url],
        "license": "CC0-1.0",
        "licenseUrl": CC0,
        "providerLicenseUrl": POLY_LICENSE,
        "sourceDimensionsMillimeters": info.get("dimensions"),
        "tileMeters": [round(value / 1000, 4) for value in info.get("dimensions", [])],
        "files": {},
    }
    for role, provider_key in [("color", "Diffuse"), ("normal", "nor_gl"), ("roughness", "Rough")]:
        item = files[provider_key][resolution]["jpg"]
        raw = fetch(item["url"], f"{asset_id}-{role}-{resolution}.jpg", item["md5"], item["size"])
        result["files"][role] = publish_image(slug, role, raw, {
            "url": item["url"], "md5": item["md5"], "bytes": item["size"],
            "verification": "Provider MD5 and declared byte size verified before conversion",
        }, max_size)
    return result


def ambient_material(slug, asset_id, roles, has_alpha=False):
    print(f"ambientCG: {asset_id}", flush=True)
    metadata_url = f"https://ambientcg.com/api/v2/full_json?id={asset_id}&include=downloadData"
    metadata = fetch_json(metadata_url, f"{asset_id}-info.json")
    asset = next(value for value in metadata["foundAssets"] if value["assetId"] == asset_id)
    downloads = asset["downloadFolders"]["default"]["downloadFiletypeCategories"]["zip"]["downloads"]
    download = next(value for value in downloads if value["attribute"] == "1K-JPG")
    archive = fetch(download["downloadLink"], download["fileName"], expected_size=download["size"])
    zip_file = zipfile.ZipFile(io.BytesIO(archive))
    if zip_file.testzip():
        raise ValueError(f"Corrupt source archive: {asset_id}")
    images = {}
    suffixes = {"color": "Color", "normal": "NormalGL", "roughness": "Roughness", "metalness": "Metalness", "alpha": "Opacity"}
    for role in roles:
        member = next(name for name in zip_file.namelist() if re.search(rf"_{suffixes[role]}\.(jpg|png)$", name))
        images[role] = (member, zip_file.read(member))
    result = {
        "provider": "ambientCG", "assetId": asset_id, "title": asset["displayName"],
        "authors": {"ambientCG / Lennart Demes": "Provider"},
        "sourceUrl": asset["shortLink"], "metadataUrls": [metadata_url],
        "license": "CC0-1.0", "licenseUrl": CC0, "providerLicenseUrl": AMBIENT_LICENSE,
        "creationMethod": asset.get("creationMethod"),
        "tileMeters": None,
        "physicalScaleNote": "No usable physical dimensions published by provider; choose an artistic UV scale.",
        "sourceArchive": {"url": download["downloadLink"], "bytes": len(archive), "sha256": digest(archive),
                          "verification": "Declared archive size and all ZIP CRC checks verified; no upstream cryptographic checksum is supplied by this API."},
        "files": {},
    }
    if has_alpha:
        result["atlas"] = {"columns": 3, "rows": 2, "note": "Six photographed leaves. Color map includes opacity; use alphaTest, not alpha blending, for dense foliage."}
    for role, (member, raw) in images.items():
        result["files"][role] = publish_image(slug, role, raw, {
            "archiveUrl": download["downloadLink"], "archiveMember": member,
            "bytes": len(raw), "verification": "ZIP member CRC verified; SHA-256 recorded locally",
        }, 1024, opacity=images["alpha"][1] if has_alpha and role == "color" else None)
    return result


def poly_environment(asset_id, resolution, filename):
    print(f"Poly Haven HDRI: {asset_id}", flush=True)
    info_url = f"https://api.polyhaven.com/info/{asset_id}"
    files_url = f"https://api.polyhaven.com/files/{asset_id}"
    info = fetch_json(info_url, f"{asset_id}-info.json")
    files = fetch_json(files_url, f"{asset_id}-files.json")
    item = files["hdri"][resolution]["hdr"]
    raw = fetch(item["url"], f"{asset_id}_{resolution}.hdr", item["md5"], item["size"])
    dimensions = re.search(rb"-Y (\d+) \+X (\d+)", raw[:2048])
    if not raw.startswith(b"#?RADIANCE") or not dimensions:
        raise ValueError("Environment is not a valid Radiance RGBE file")
    directory = OUTPUT / "environment"
    directory.mkdir(parents=True, exist_ok=True)
    temporary = directory / f"{filename}.tmp"
    temporary.write_bytes(raw)
    temporary.replace(directory / filename)
    return {
        "provider": "Poly Haven", "assetId": asset_id, "title": info["name"],
        "authors": info.get("authors", {}), "sourceUrl": f"https://polyhaven.com/a/{asset_id}",
        "metadataUrls": [info_url, files_url], "license": "CC0-1.0", "licenseUrl": CC0,
        "providerLicenseUrl": POLY_LICENSE, "path": f"/textures/environment/{filename}",
        "width": int(dimensions[2]), "height": int(dimensions[1]), "colorSpace": "Linear HDR RGBE",
        "bytes": len(raw), "sha256": digest(raw), "md5": item["md5"], "downloadUrl": item["url"],
        "verification": "Provider MD5, byte size, Radiance header and dimensions verified; unmodified source file",
    }


def verify():
    manifest = json.loads((OUTPUT / "manifest.json").read_text())
    entries = [file for material in manifest["materials"].values() for file in material["files"].values()]
    entries.append(manifest["environment"])
    if "sky" in manifest:
        entries.append(manifest["sky"])
    total = 0
    for entry in entries:
        target = ROOT / "world/public" / entry["path"].lstrip("/")
        raw = target.read_bytes()
        if len(raw) != entry["bytes"] or digest(raw) != entry["sha256"]:
            raise ValueError(f"Output checksum mismatch: {entry['path']}")
        total += len(raw)
        if target.suffix == ".webp":
            image = Image.open(target)
            image.load()
            if list(image.size) != [entry["width"], entry["height"]]:
                raise ValueError(f"Output dimensions mismatch: {target}")
            # A provider may intentionally supply nearly uniform roughness or
            # metalness. Only albedo/normal must carry visible surface detail.
            if target.stem in ("color", "normal") and max(ImageStat.Stat(image.convert("RGB")).stddev) < 0.2:
                raise ValueError(f"Unexpected constant texture: {target}")
    foliage = Image.open(OUTPUT / "foliage/color.webp")
    if foliage.mode != "RGBA" or not (0 in foliage.getchannel("A").getextrema() and foliage.getchannel("A").getextrema()[1] == 255):
        raise ValueError("Foliage is missing its real opacity channel")
    print(f"Verified {len(entries)} published maps/HDRI: {total:,} bytes ({total / 1024**2:.2f} MiB)", flush=True)
    return total


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Only verify local output hashes, dimensions and texture variation")
    args = parser.parse_args()
    if args.verify:
        verify()
        return
    if not features.check("webp"):
        raise RuntimeError("Pillow must include WebP support")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    materials = {slug: poly_material(slug, asset, resolution, size) for slug, asset, resolution, size in POLY_MATERIALS}
    materials["oxidized-copper"] = ambient_material("oxidized-copper", "Metal058C", ["color", "normal", "roughness", "metalness"])
    materials["foliage"] = ambient_material("foliage", "LeafSet001", ["color", "normal", "roughness", "alpha"], has_alpha=True)
    manifest = {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "generator": "scripts/fetch-world-assets.py", "pillowVersion": Image.__version__,
        "license": "CC0-1.0", "licenseUrl": CC0,
        "notes": "Self-hosted CC0 asset derivatives. No runtime API dependency. Color maps use sRGB; all scalar/normal maps use no color-space conversion. Normal maps are OpenGL +Y. Procedural copper includes the provider's metalness map. WebP delivery is lossy except opacity; sampled normal angular error is recorded.",
        "materials": materials,
        "environment": poly_environment("moonless_golf", "1k", "night.hdr"),
        "sky": poly_environment("kloppenheim_06_puresky", "2k", "sky.hdr"),
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (OUTPUT / "LICENSE.txt").write_text(
        "All material and HDRI files in this directory derive from CC0 1.0 Universal assets.\n"
        f"License: {CC0}\nPoly Haven: {POLY_LICENSE}\nambientCG: {AMBIENT_LICENSE}\n"
        "See manifest.json for exact authors, asset/download URLs, transformations, dimensions and checksums.\n"
        "Provider preview renders are not included in the shipped asset set.\n"
    )
    total = verify()
    if total > 26 * 1024**2:
        raise RuntimeError("Published texture set exceeds the 26 MiB upper budget; review resolutions before shipping.")


if __name__ == "__main__":
    main()
