"""Fetch the official 4K CC0 scan sources; verify publisher MD5 and retain SHA256.

The files/info JSON are saved from the public API or identical pageProps data
in the official asset page. No third party mirrors or preview renders are used.
"""
import concurrent.futures
import hashlib
import json
import os
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[3]
SOURCES = ROOT / "work/production-v3/environment-sources"

def fetch(task):
    asset, relative, item = task
    target = SOURCES / asset / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or hashlib.md5(target.read_bytes()).hexdigest() != item["md5"]:
        proxy = ["--proxy", os.environ["ACADEMY_ASSET_PROXY"]] if os.environ.get("ACADEMY_ASSET_PROXY") else []
        subprocess.run(["curl", "--http1.1", "-sS", "-L", "--fail", "--retry", "3", "--connect-timeout", "15", "--max-time", "180", *proxy, item["url"], "-o", str(target)], check=True)
    data = target.read_bytes()
    assert len(data) == item["size"], str(target)
    assert hashlib.md5(data).hexdigest() == item["md5"], str(target)
    return {"asset": asset, "file": str(target.relative_to(ROOT)), "url": item["url"], "bytes": len(data), "publisherMD5": item["md5"], "sha256": hashlib.sha256(data).hexdigest()}

tasks = []
catalog = json.loads((ROOT / "world/public/models/environment/scans/sources.json").read_text())
SOURCES.mkdir(parents=True, exist_ok=True)
for source in catalog["assets"]:
    asset = source["id"]
    package = source["package"]
    (SOURCES / f"{asset}-info.json").write_text(json.dumps(source["info"], indent=2) + "\n")
    tasks.append((asset, f"{asset}_4k.gltf", package))
    tasks.extend((asset, relative, item) for relative, item in package["include"].items())
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, tasks))
(SOURCES / "downloads.json").write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps({"files": len(results), "bytes": sum(item["bytes"] for item in results)}, indent=2))
