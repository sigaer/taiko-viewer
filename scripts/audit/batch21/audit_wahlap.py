"""Read-only, bounded API observations. Raw authenticated responses stay private."""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path('/var/tmp/taiko-batch21-20261124/evidence/wahlap-private') / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')
ROOT.mkdir(mode=0o700, exist_ok=True)
os.umask(0o077)
token = json.loads(Path('/home/sigaer/taiko/config.json').read_text())['cookie']
session = requests.Session()
session.trust_env = False
session.proxies.update({'https': 'http://127.0.0.1:18888'})
session.headers.update({'Authorization': token, 'Content-Type': 'application/json',
    'Referer': 'https://servicewechat.com/wxeafab0667490cd23/21/page-frame.html',
    'User-Agent': 'Mozilla/5.0 MicroMessenger/8.0'})

def schema(value):
    if isinstance(value, dict):
        return {k: schema(v) for k, v in value.items()}
    if isinstance(value, list):
        return {'type': 'list', 'length': len(value), 'first': schema(value[0]) if value else None}
    return type(value).__name__

observations = []
queries = [('played', {'page': 1, 'pageSize': 20, 'sort': 1, 'isPlayed': True}),
           ('unplayed', {'page': 1, 'pageSize': 20, 'sort': 1, 'isPlayed': False}),
           ('all', {'page': 1, 'pageSize': 20, 'sort': 1}),
           ('all-page2', {'page': 2, 'pageSize': 20, 'sort': 1})]
for name, payload in queries:
    response = session.post('https://wl-taiko.wahlap.net/api/user/all/songs', json=payload, timeout=(10, 35))
    body = response.content
    (ROOT / (name + '.json')).write_bytes(body)
    value = response.json()
    data = value.get('data') or {}
    rows = data.get('list') or []
    observation = {'name': name, 'query': payload, 'fetchedAt': datetime.now(timezone.utc).isoformat(),
        'httpStatus': response.status_code, 'headers': {k: v for k, v in response.headers.items()
        if k.lower() in {'date', 'etag', 'last-modified', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining'}},
        'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'schema': schema(value),
        'envelope': {k: v for k, v in value.items() if k != 'data'},
        'metadata': {k: v for k, v in data.items() if k != 'list'},
        'ids': [r.get('id') for r in rows], 'firstSong': rows[:1]}
    observations.append(observation)
    (ROOT / 'observations.json').write_text(json.dumps(observations, ensure_ascii=False, indent=2))
    print(json.dumps(observation, ensure_ascii=False), flush=True)
    if not response.ok or value.get('status') != 0 or not rows:
        break
    time.sleep(2)
