#!/usr/bin/env python3
"""Recover exact locked wheels into a persistent vault; run under the QA wrapper."""
import argparse, hashlib, json, os, shutil, time, urllib.request
from pathlib import Path

BUILDER_SHA = '51a52592b3b99e102b609654876bd65f19f999935166d1352678931132b0c670'
def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--lock', type=Path, required=True)
    p.add_argument('--vault', type=Path, required=True)
    p.add_argument('--loopback-proxy-port', type=int)
    p.add_argument('--download', action='store_true')
    a = p.parse_args()
    if a.loopback_proxy_port is not None:
        if not 1 <= a.loopback_proxy_port <= 65535: p.error('invalid proxy port')
        urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({'http': 'http://127.0.0.1:' + str(a.loopback_proxy_port), 'https': 'http://127.0.0.1:' + str(a.loopback_proxy_port)})))
    vault = a.vault.resolve()
    if str(vault).startswith(('/tmp/', '/var/tmp/')) or not vault.is_dir() or vault.stat().st_mode & 0o077:
        p.error('existing private persistent vault required')
    out = vault / 'wheelhouse'; out.mkdir(exist_ok=True)
    report_path = vault / ('wheel-recovery-' + str(time.time_ns()) + '.json')
    expected = {w['sha256']: w for role in json.loads(a.lock.read_text())['roles'].values() for w in role['wheels']}
    expected[BUILDER_SHA] = {'name':'setuptools','version':'84.0.0','file':'setuptools-84.0.0-py3-none-any.whl','sha256':BUILDER_SHA}
    found = {}; errors = []
    report = {'schemaVersion':1,'lockFile':str(a.lock.resolve()),'lockSha256':sha(a.lock),'artifacts':found,'errors':errors,'productionAccess':False,'proxyMode':'loopback' if a.loopback_proxy_port else 'none'}
    def accept(path, digest):
        target = out / Path(expected[digest]['file']).name
        if target.exists() and sha(target) != digest: raise RuntimeError('conflicting wheel output')
        if path != target: shutil.copyfile(path, target)
        found[digest] = {'file':str(target),'sha256':digest,'bytes':target.stat().st_size,'name':expected[digest]['name'],'version':expected[digest]['version']}
    try:
        candidates = list(out.glob('*.whl'))
        for root in (Path('/root/.cache/pip/wheels'),Path('/usr/lib/python3.11/ensurepip/_bundled')):
            if root.is_dir(): candidates.extend(root.rglob('*.whl'))
        cache = Path('/root/.cache/pip/http-v2')
        if cache.is_dir(): candidates.extend(cache.rglob('*.body'))
        for path in candidates:
            if path.is_symlink() or path.stat().st_size > 200_000_000: continue
            digest = sha(path)
            if digest in expected and digest not in found: accept(path, digest)
        if a.download:
            deadline = time.monotonic() + 1200
            private = {'taiko-bot','python-memory-runtime','taiko-application','sakura-taiko-contract','sakura-taiko-core'}
            for digest,w in expected.items():
                if digest in found or w['name'] in private: continue
                if time.monotonic() > deadline: raise TimeoutError('download deadline')
                # Query metadata only; accept payload exclusively by the original locked digest.
                try:
                    url = 'https://pypi.org/pypi/' + w['name'] + '/' + w['version'] + '/json'
                    with urllib.request.urlopen(url,timeout=30) as response: metadata = json.loads(response.read(2_000_000))
                    match = [x for x in metadata['urls'] if x['digests']['sha256']==digest and x['filename'].endswith('.whl')]
                    if len(match)!=1: raise RuntimeError('exact locked PyPI wheel unavailable')
                    temp = out / (digest + '.partial')
                    with urllib.request.urlopen(match[0]['url'],timeout=60) as response, temp.open('xb') as output:
                        size=0
                        while True:
                            chunk=response.read(1024*1024)
                            if not chunk: break
                            size+=len(chunk)
                            if size>200_000_000 or time.monotonic()>deadline: raise RuntimeError('download bound')
                            output.write(chunk)
                    if sha(temp)!=digest: raise RuntimeError('download digest mismatch')
                    accept(temp,digest); temp.unlink()
                except Exception as exc:
                    # Never persist proxy URLs or credentials from transport exception messages.
                    errors.append({'name':w['name'],'version':w['version'],'errorType':type(exc).__name__})
    finally:
        report['missing']=[{'name':w['name'],'version':w['version'],'sha256':h} for h,w in expected.items() if h not in found]
        report['status']='PASS_EXACT_ARTIFACTS' if not report['missing'] else 'INCOMPLETE'
        report_path.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'report':str(report_path),'recovered':len(found),'missing':len(report['missing'])}))
if __name__=='__main__': main()
