"""Bounded installed CLI protocol smoke; execute only through run_qa.sh."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--python', required=True)
args = parser.parse_args()
assert Path(args.python).is_absolute()
root = Path(tempfile.mkdtemp(prefix='viewer-r4-modules-', dir='/var/tmp'))
try:
    env = {'PATH': '/usr/bin:/bin', 'TAIKO_RUNTIME_ROOT': str(root), 'TAIKO_CENTER_ROOT': str(root),
           'TAIKO_USERDATA_DIR': str(root / 'userdata'), 'TAIKO_RUNTIME_ENV_FILE': str(root / 'absent.env'),
           'TAIKO_WAHLAP_CONFIG_PATH': str(root / 'absent.json'), 'TAIKO_ACCOUNT_CACHE_DIR': str(root / 'cache'),
           'HIROBA_CRED_KEY': 'synthetic-r4-local-key', 'PYTHONPATH': str(root), 'PYTHONHOME': str(root)}
    (root / 'taiko_bot.py').write_text('raise RuntimeError("cwd injection")\n')
    modules = ['account_sync', 'source_mutation', 'qq_migration', 'hiroba_credential']
    results = []
    for name in modules:
        command = [args.python, '-I', '-m', 'taiko_bot.cli.' + name + '_cli']
        # Malformed JSON is rejected before SQL, credentials, or acquisition.
        run = subprocess.run(command, input=b'{', stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             cwd=root, env=env, timeout=15)
        assert run.returncode == 0 and len(run.stdout) < 16384 and len(run.stderr) < 8192, name + ' launch failed'
        payload = json.loads(run.stdout)
        assert payload['ok'] is False and payload['status'] == 400 and payload['error'] == 'invalid_request', name
        results.append({'module': command[-1], 'malformedRequest': 'PASS'})
    request = {'operationId': 'a' * 32, 'mode': 'fingerprint', 'email': 'synthetic@example.test',
               'password': 'synthetic-password', 'principal': 'onebot_v11:12345', 'target': '111'}
    replies = []
    for _ in range(2):
        run = subprocess.run([args.python, '-I', '-m', 'taiko_bot.cli.hiroba_credential_cli'],
                             input=json.dumps(request).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             cwd=root, env=env, timeout=15)
        assert run.returncode == 0
        reply = json.loads(run.stdout)
        assert reply['ok'] is True and len(reply['result']['intentHash']) == 64
        replies.append(reply)
    assert replies[0] == replies[1], 'Fingerprint retry must be stable'
    empty = root / 'empty'
    subprocess.run(['/usr/bin/python3', '-I', '-m', 'venv', '--without-pip', str(empty)], check=True, timeout=30)
    for name in modules:
        run = subprocess.run([str(empty / 'bin/python'), '-I', '-m', 'taiko_bot.cli.' + name + '_cli'],
                             input=b'{', stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=root, env=env, timeout=10)
        assert run.returncode != 0 and not run.stdout, 'Missing package must not fall back: ' + name
    print(json.dumps({'status': 'PASS_SCOPED', 'modules': results, 'credentialFingerprintRetry': 'PASS',
                      'missingPackageAllFour': 'PASS', 'poisonedCwdAndPythonEnvironment': 'PASS',
                      'scope': 'No SQL/network/private credential access; successful mutations covered separately by isolated SQL suites.'}))
finally:
    shutil.rmtree(root)
