"""Freeze public catalog responses without changing runtime catalogs."""
import hashlib
import json
import os
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import requests

os.umask(0o077)
root = Path('/var/tmp/taiko-batch21-20261124/evidence/wahlap-private/full')
root.mkdir(mode=0o700, parents=True, exist_ok=False)
session = requests.Session(); session.trust_env = False
session.proxies['https'] = 'http://127.0.0.1:18888'
session.headers.update({'Authorization': json.loads(Path('/home/sigaer/taiko/config.json').read_text())['cookie'],
    'Referer': 'https://servicewechat.com/wxeafab0667490cd23/21/page-frame.html'})
rows = []; total = None; manifest = []
for page in range(1, 6):
    payload = {'page': page, 'pageSize': 500, 'sort': 1}
    response = session.post('https://wl-taiko.wahlap.net/api/user/all/songs', json=payload, timeout=(10,35))
    response.raise_for_status(); value = response.json()
    assert value['status'] == 0
    data = value['data']; assert isinstance(data['total'], int)
    if total is None: total = data['total']
    assert data['total'] == total
    part = data['list']; assert isinstance(part, list) and len(part) <= 500
    body = response.content; (root / f'page-{page}.json').write_bytes(body)
    manifest.append({'page': page, 'rows': len(part), 'total': total, 'httpStatus': response.status_code,
        'fetchedAt': datetime.now(timezone.utc).isoformat(), 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)})
    rows.extend(part)
    if not part: break
    time.sleep(2)
assert len(rows) == total
response = session.post('https://wl-taiko.wahlap.net/api/user/all/songs', json={'page':1,'pageSize':3000,'sort':1}, timeout=(10,35))
response.raise_for_status(); value = response.json(); assert value['status'] == 0
(root / 'single-page.json').write_bytes(response.content)
assert value['data']['total'] == total and value['data']['list'] == rows
by_id = {}
for row in rows: by_id.setdefault(row['id'], []).append(row)
conflicts = {str(i): group for i, group in by_id.items() if any(
    any(row.get(k) != group[0].get(k) for k in ['song_name_jp',*[f'level_{d}' for d in range(1,6)]])
    for row in group[1:])}
summary = {'complete': True, 'totalRows':total,'uniqueSongs':len(by_id),
    'duplicateRows':sum(len(g)-1 for g in by_id.values()), 'conflicts':conflicts,
    'pages':manifest, 'singlePageMatches':True,
    'allFields':sorted({k for row in rows for k in row}),
    'sevenConflicts':{str(i):by_id.get(i) for i in [1210,226,197,1103,106,301,663]}}
(root / 'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
(root / 'rows.json').write_text(json.dumps(rows,ensure_ascii=False))
print(json.dumps(summary, ensure_ascii=False),flush=True)
