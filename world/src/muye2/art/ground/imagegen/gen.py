#!/usr/bin/env python3
"""Scenery from the images endpoint (the figures' pipeline, lab/game-studies/imagegen/gen.py, re-cut for the ground).

usage: python3 gen.py <name> <slot-file> [size] [extra-json]
  The prompt is prompts/frame.txt + the slot file. Saved as raw/<name>.png with raw/<name>.prompt.txt (the exact prompt).
  extra-json: body fields, e.g. '{"background":"transparent","quality":"high"}'; "images": [paths] sends them as
  references to the edit endpoint.
Settings come from lab/game-studies/.imagegen.env (git-ignored). Nothing from it is printed or written.
"""
import base64, json, os, sys, time, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__))
ENV = os.path.join(HERE, '..', '..', '..', '..', '..', '..', 'lab', 'game-studies', '.imagegen.env')

def env():
    out = {}
    for line in open(ENV):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1); out[k.strip()] = v.strip().strip('"').strip("'")
    return out

def main():
    name, slot = sys.argv[1], sys.argv[2]
    size = sys.argv[3] if len(sys.argv) > 3 else '1536x1024'
    extra = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
    prompt = open(os.path.join(HERE, 'prompts', os.environ.get('GEN_FRAME', 'frame.txt'))).read().strip() + '\n\n' + open(slot).read().strip()
    e = env(); images = extra.pop('images', None)
    body = {'model': e['FRIDAY_IMAGE_MODEL'], 'prompt': prompt, 'n': 1, 'size': size, **extra}
    url = e['FRIDAY_IMAGE_URL']
    if images:
        body['image'] = [base64.b64encode(open(os.path.join(HERE, p), 'rb').read()).decode() for p in images]
        url = url.replace('/generations', '/edits')
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + e['FRIDAY_IMAGE_APP_ID']})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as r: data = json.loads(r.read())
    except urllib.error.HTTPError as err:
        import re
        body = err.read()[:600].decode('utf8', 'replace'); body = re.sub(r'App:\S*', 'App:<hidden>', body); body = re.sub(r'(?i)(bearer|key|token)\S*', '<hidden>', body)
        print(name, 'HTTP', err.code, body[:300] if err.code != 429 else ''); sys.exit(2 if err.code == 429 else 1)
    dt = time.time() - t0
    os.makedirs(os.path.join(HERE, 'raw'), exist_ok=True)
    open(os.path.join(HERE, 'raw', name + '.png'), 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
    if images: extra['images'] = images
    open(os.path.join(HERE, 'raw', name + '.prompt.txt'), 'w').write(f'size: {size}\nextra: {json.dumps(extra)}\nseconds: {dt:.0f}\n\n{prompt}\n')
    print(name, f'{dt:.0f}s')

if __name__ == '__main__':
    main()
