"""Offline negative security probe. Expected vulnerable-source exit: 1.

Compile only named tracked functions; replace writers with memory-only spies.
Never import either application, read configuration, connect or open a listener.
This is source reachability evidence, not deployed ingress/exploit evidence.
"""
import ast
import base64
import hashlib
import io
import json
import re
import sys
from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from urllib.parse import urlparse

repo = Path(sys.argv[1]).resolve()
evidence = []
def selected(path, names, namespace, class_name=None):
    text = (repo / path).read_text()
    tree = ast.parse(text)
    nodes = tree.body
    if class_name:
        nodes = next(n for n in nodes if isinstance(n, ast.ClassDef) and n.name == class_name).body
    chosen = [n for n in nodes if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in names]
    assert len(chosen) == len(names), 'Source declarations changed; review probe'
    for node in chosen:
        node.decorator_list = []
    exec(compile(ast.Module(body=chosen, type_ignores=[]), path, 'exec'), namespace)
    evidence.append({'file': path, 'sha256': hashlib.sha256(text.encode()).hexdigest()})

writes = []
ns = dict(json=json, HTTPStatus=HTTPStatus, urlparse=urlparse,
          PUBLIC_SCORE_API_PATH='/api/public-score/by-token', TOKEN_API_PATH='/api/token',
          update_cookie=lambda value: writes.append('center-cookie'))
selected('taiko/server.py', ['do_POST'], ns, 'SongDataHandler')
body = json.dumps({'token': 'synthetic-not-an-upstream-credential'}).encode()
replies = []
request = SimpleNamespace(path='/api/token', headers={'Content-Length': str(len(body))},
                          rfile=io.BytesIO(body), send_json=lambda status, payload: replies.append(int(status)))
ns['do_POST'](request)
center = {'route': '/api/token', 'anonymousWriterCalls': len(writes), 'response': replies[-1]}

ns = dict(base64=base64, json=json, re=re, Any=Any)
selected('miku_bot/sekai/upload/taiko_login.py', ['TaikoLoginError', '_decode_jwt_part', 'validate_taiko_token'], ns)
encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
# Deliberately expired payload and dummy signature; all values are synthetic.
token = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode({'id': 1, 'exp': 1}) + '.c3ludGhldGlj'
upload_writes = []
ns.update(request=SimpleNamespace(path='/uploadTaikoLogin', content_length=256,
          get_json=lambda silent=True: {'token': token}), UPLOAD_SERVICE_NAME='sekai',
          update_taiko_config=lambda value: upload_writes.append('upload-cookie'))
selected('miku_bot/sekai/upload/server.py', ['_route_enabled_for_service', '_guard_service_routes', 'uploadTaikoLogin'], ns)
assert ns['_guard_service_routes']() is None
reply = ns['uploadTaikoLogin']()
upload = {'route': '/uploadTaikoLogin', 'anonymousWriterCalls': len(upload_writes),
          'expiredDummySignatureAccepted': bool(upload_writes), 'response': reply.get('code') if isinstance(reply, dict) else reply[1]}
failed = center['anonymousWriterCalls'] > 0 or upload['anonymousWriterCalls'] > 0
print(json.dumps({'securityGate': 'FAIL' if failed else 'REVIEW_REQUIRED', 'productionAccess': False,
                  'diskWrites': 0, 'checks': [center, upload], 'sourceEvidence': evidence}))
sys.exit(1 if failed else 2)  # Absence of this reproduction is not blanket PASS.
