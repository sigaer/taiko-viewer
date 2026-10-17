"""Bounded compatibility caller for the already installed center Writer.

Only explicitly admitted Sources delegate. Other legacy calls are unchanged.
The durable Source list is not removed when the My Taiko read rollout rolls back.
No score/history algorithm or Publication format is implemented here.
"""
from __future__ import annotations
import json, os, re, shlex, stat, subprocess, sys
from pathlib import Path

POLICY = '/var/lib/taiko/viewer-rollout/source-ingress.json'
MAX_BYTES = 32 * 1024 * 1024

def _policy(path):
    with open(path, 'rb') as f:
        info = os.fstat(f.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > 8192 or info.st_mode & 0o022:
            raise RuntimeError('Publication ingress policy unavailable')
        raw = f.read(8193)
    p = json.loads(raw)
    if p.get('schemaVersion') != 1 or not isinstance(p.get('sourceIds'), list) or len(p['sourceIds']) > 20:
        raise RuntimeError('Publication ingress policy unavailable')
    if any(not isinstance(v, str) or not re.fullmatch(r'[0-9]{1,25}', v) for v in p['sourceIds']):
        raise RuntimeError('Publication ingress policy unavailable')
    for k in ['python', 'root', 'userdataDir', 'envFile']:
        if not isinstance(p.get(k), str) or not os.path.isabs(p[k]):
            raise RuntimeError('Publication ingress policy unavailable')
    return p

def _delegate(operation, identity, data, source, policy_path):
    p = _policy(policy_path)
    if str(identity) not in p['sourceIds']:
        return False
    raw = json.dumps({'operation': operation, 'identity': str(identity), 'data': data, 'source': source}, ensure_ascii=False).encode()
    if len(raw) > MAX_BYTES:
        raise RuntimeError('Publication ingress request too large')
    # No credentials, score bodies or raw subprocess diagnostics in argv/logs.
    done = subprocess.run([p['python'], '-I', str(Path(__file__).resolve()), '--worker', str(policy_path)], input=raw,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=150,
                          env={'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'})
    if done.returncode:
        raise RuntimeError('Publication ingress unavailable')
    return True

def save_if_selected(identity, data, *, source=None, policy_path=POLICY):
    return _delegate('save', identity, data, source, policy_path)

def dispatch_if_selected(identity, data, *, policy_path=POLICY):
    return _delegate('dispatch', identity, data, None, policy_path)

def _worker(path):
    p = _policy(path)
    env = {}
    for raw in Path(p['envFile']).read_text().splitlines():
        if '=' not in raw or raw.strip().startswith('#'):
            continue
        k, v = raw.split('=', 1)
        values = shlex.split(v)
        if len(values) == 1:
            env[k.strip()] = values[0]
    for field in ['HOST', 'PORT', 'USER', 'PASSWORD', 'NAME']:
        value = env.get('TAIKO_DB_' + field) or env.get('NUXT_DB_' + field)
        if value is not None:
            os.environ['TAIKO_DB_' + field] = value
    os.environ['TAIKO_RUNTIME_ROOT'] = p['root']
    os.environ['TAIKO_USERDATA_DIR'] = p['userdataDir']
    os.environ['TAIKO_RUNTIME_ENV_FILE'] = str(Path(p['root'])/'absent-ingress.env')
    raw = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise RuntimeError('bounded request')
    request = json.loads(raw)
    if request.get('identity') not in p['sourceIds'] or not isinstance(request.get('data'), dict):
        raise RuntimeError('invalid identity')
    if request.get('operation') == 'save':
        from taiko_bot.runtime.player.center.userdata_storage import save_userdata
        save_userdata(request['identity'], request['data'], source=request.get('source'))
    elif request.get('operation') == 'dispatch':
        from taiko_bot.services.sync_dispatch_server import write_local_snapshot
        write_local_snapshot(request['identity'], request['data'])
    else:
        raise RuntimeError('invalid operation')

if __name__ == '__main__':
    try:
        if len(sys.argv) != 3 or sys.argv[1] != '--worker':
            raise RuntimeError('explicit worker invocation required')
        _worker(sys.argv[2])
    except Exception:
        sys.stderr.write('Publication ingress unavailable\n')
        sys.exit(1)
