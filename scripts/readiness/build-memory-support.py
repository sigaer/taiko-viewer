#!/usr/bin/env python3
"""Package fixed Sakura shared-memory source without modifying any source repo.
Use scripts/memory/run_build.sh. This is local integration packaging, not release.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / 'docs/platform-architecture-audit'
SOURCE = '/home/sigaer/git/Sakura_bot'
REVISION = '63be19a5c35ba98831b3eeec1746f36fed049a7e'
BUILDER_WHEEL = Path('/var/tmp/taiko-final-ownership-20261015/wheel-env/lib/python3.11/site-packages/virtualenv/seed/wheels/embed/setuptools-84.0.0-py3-none-any.whl')
FILES = ('__init__.py', 'cache.py', 'metrics.py', 'store.py', '_build_sqlite.py')
METADATA = '''[build-system]
requires = ["setuptools==84.0.0"]
build-backend = "setuptools.build_meta"
[project]
name = "python-memory-runtime"
version = "1.1.0"
description = "Local integration packaging of Sakura shared resident-memory tools"
requires-python = ">=3.11"
[tool.setuptools]
packages = ["runtime_memory"]
'''

def sha(path):
    value=hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda:source.read(1024*1024),b''):
            value.update(chunk)
    return value.hexdigest()

def git(*args):
    result=subprocess.run(['git','-C',SOURCE,*args],capture_output=True,check=True,timeout=20)
    if len(result.stdout)>1_000_000:
        raise RuntimeError('source object exceeds bound')
    return result.stdout

def main():
    evidence_path=AUDIT/'evidence/runtime-memory-package-20261016.json'
    if evidence_path.exists():
        raise RuntimeError('packaging evidence already exists; do not overwrite prior run')
    workspace=Path(tempfile.mkdtemp(prefix='taiko-shared-memory-wheel-',dir='/var/tmp'))
    source=workspace/'source'
    package=source/'runtime_memory'
    package.mkdir(parents=True)
    origins={}
    for name in FILES:
        relative='runtime_memory/'+name
        content=git('show',REVISION+':'+relative)
        (package/name).write_bytes(content)
        origins[relative]={'blob':git('rev-parse',REVISION+':'+relative).decode().strip(),'sha256':sha(package/name)}
    (source/'pyproject.toml').write_text(METADATA)
    builder=workspace/'builder'
    output=workspace/'wheels'
    output.mkdir()
    env={'PATH':'/usr/bin:/bin','TMPDIR':str(workspace),'PIP_CONFIG_FILE':'/dev/null','PIP_NO_INDEX':'1','PIP_DISABLE_PIP_VERSION_CHECK':'1',
         'SOURCE_DATE_EPOCH':git('show','-s','--format=%ct',REVISION).decode().strip()}
    logs={}
    def run(command,label):
        log=workspace/(label+'.log')
        with log.open('w') as handle:
            result=subprocess.run([str(x) for x in command],cwd=workspace,env=env,stdout=handle,stderr=subprocess.STDOUT,timeout=120)
        logs[label]={'exitCode':result.returncode,'sha256':sha(log)}
        if log.stat().st_size>1_000_000 or result.returncode:
            raise RuntimeError('packaging failed at '+label)
    run(['/usr/bin/python3','-m','venv',builder],'venv')
    python=builder/'bin/python'
    run([python,'-I','-m','pip','install','--no-index','--no-deps','--no-cache-dir',BUILDER_WHEEL],'builder-install')
    run([python,'-I','-m','pip','wheel','--no-index','--no-deps','--no-cache-dir','--no-build-isolation','--wheel-dir',output,source],'wheel')
    wheels=list(output.glob('python_memory_runtime-1.1.0-*.whl'))
    if len(wheels)!=1:
        raise RuntimeError('unexpected shared wheel output')
    wheel=wheels[0]
    with zipfile.ZipFile(wheel) as archive:
        actual=[name for name in archive.namelist() if name.startswith('runtime_memory/')]
        if sorted(actual)!=sorted('runtime_memory/'+name for name in FILES):
            raise RuntimeError('shared wheel includes unexpected source files')
        for name in FILES:
            if hashlib.sha256(archive.read('runtime_memory/'+name)).hexdigest()!=origins['runtime_memory/'+name]['sha256']:
                raise RuntimeError('packaging changed shared implementation bytes')
    original=AUDIT/'runtime-role-locks.json'
    supplement=json.loads(original.read_text())
    supplement.update({'parentManifest':'runtime-role-locks.json','parentManifestSha256':sha(original),
                       'packagingEvidence':'evidence/runtime-memory-package-20261016.json',
                       'scope':'New 94-distribution integration candidate; original 93-distribution acceptance remains unchanged.'})
    for role,value in supplement['roles'].items():
        lock=AUDIT/value['requirements']
        lines=lock.read_text().splitlines()
        lines.append('python-memory-runtime==1.1.0 --hash=sha256:'+sha(wheel))
        target=AUDIT/'runtime-locks'/(role+'-with-memory.requirements.txt')
        target.write_text('\n'.join(lines)+'\n')
        value['requirements']='runtime-locks/'+target.name
        value['requirementsSha256']=sha(target)
        value['environmentIdentity']='sha256:'+sha(target)
        value['wheels'].append({'name':'python-memory-runtime','version':'1.1.0','file':str(wheel),'sha256':sha(wheel)})
        value['qaInterpreter']=None
        value['rebuildEvidence']=None
    (AUDIT/'runtime-role-locks-with-memory.json').write_text(json.dumps(supplement,ensure_ascii=False,indent=2)+'\n')
    evidence={'status':'PASS_LOCAL_INTEGRATION_PACKAGING','owner':'Sakura_bot shared infrastructure','upstreamReleaseClaim':False,
              'sourceCommit':REVISION,'sourceFiles':origins,'sourceByteParity':True,
              'versionMeaning':'1.1.0 is the pre-existing shared artifact version; distribution metadata was added only for this local integration build.',
              'packagingMetadata':METADATA,'packagingMetadataSha256':sha(source/'pyproject.toml'),
              'buildTool':{'file':BUILDER_WHEEL.name,'sha256':sha(BUILDER_WHEEL)},
              'wheel':{'file':str(wheel),'sha256':sha(wheel)},'logs':logs,'workspace':str(workspace)}
    evidence_path.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':evidence['status'],'wheel':str(wheel),'supplement':'runtime-role-locks-with-memory.json'}))

if __name__=='__main__':
    main()
