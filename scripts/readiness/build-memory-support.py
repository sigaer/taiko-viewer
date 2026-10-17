#!/usr/bin/env python3
"""Package fixed Sakura shared-memory source without modifying any source repo.
Use scripts/memory/run_qa.sh for local candidate packaging only; no deployment.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile

SOURCE = '/home/sigaer/git/Sakura_bot'
REVISION = '63be19a5c35ba98831b3eeec1746f36fed049a7e'
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
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault', type=Path, required=True)
    parser.add_argument('--builder-wheel', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args=parser.parse_args()
    BUILDER_WHEEL=args.builder_wheel.resolve()
    if sha(BUILDER_WHEEL) != '51a52592b3b99e102b609654876bd65f19f999935166d1352678931132b0c670':
        parser.error('exact builder wheel required')
    vault=args.vault.resolve()
    if str(vault).startswith(('/tmp/', '/var/tmp/')) or not vault.is_dir() or vault.stat().st_mode & 0o077:
        parser.error('existing private persistent vault required')
    scratch=Path(os.environ['QA_RUN_TMPDIR']).resolve()
    if scratch != Path(os.environ['QA_RUN_DIR']).resolve()/'scratch' or not scratch.is_dir() or not scratch.is_relative_to(vault/'runs'):
        parser.error('owned QA scratch required')
    evidence_path=args.output.resolve()
    if not evidence_path.is_relative_to(vault) or evidence_path.is_relative_to(scratch):
        parser.error('evidence must remain in persistent vault outside scratch')
    if evidence_path.exists():
        raise RuntimeError('packaging evidence already exists; do not overwrite prior run')
    workspace=Path(tempfile.mkdtemp(prefix='taiko-shared-memory-wheel-',dir=vault))
    temporary=Path(tempfile.mkdtemp(prefix='memory-build-',dir=scratch))
    source=temporary/'source'
    package=source/'runtime_memory'
    package.mkdir(parents=True)
    origins={}
    for name in FILES:
        relative='runtime_memory/'+name
        content=git('show',REVISION+':'+relative)
        (package/name).write_bytes(content)
        origins[relative]={'blob':git('rev-parse',REVISION+':'+relative).decode().strip(),'sha256':sha(package/name)}
    (source/'pyproject.toml').write_text(METADATA)
    builder=temporary/'builder'
    output=workspace/'wheels'
    output.mkdir()
    env={'PATH':'/usr/bin:/bin','TMPDIR':str(temporary),'PIP_CACHE_DIR':str(temporary/'pip-cache'),'PYTHONDONTWRITEBYTECODE':'1','PIP_CONFIG_FILE':'/dev/null','PIP_NO_INDEX':'1','PIP_DISABLE_PIP_VERSION_CHECK':'1',
         'SOURCE_DATE_EPOCH':git('show','-s','--format=%ct',REVISION).decode().strip()}
    logs={}
    def run(command,label):
        log=workspace/(label+'.log')
        with log.open('w') as handle:
            result=subprocess.run([str(x) for x in command],cwd=temporary,env=env,stdout=handle,stderr=subprocess.STDOUT,timeout=120)
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
    evidence={'status':'PASS_EXACT_REBUILD' if sha(wheel)=='1e6197b0c4298808e70038cc5de3fff8c2f6517888514c996648a140091f9724' else 'REBUILT_HASH_DIFF_SOURCE_PARITY','owner':'Sakura_bot shared infrastructure','upstreamReleaseClaim':False,
              'sourceCommit':REVISION,'sourceFiles':origins,'sourceByteParity':True,
              'versionMeaning':'1.1.0 is the pre-existing shared artifact version; distribution metadata was added only for this local integration build.',
              'packagingMetadata':METADATA,'packagingMetadataSha256':sha(source/'pyproject.toml'),
              'buildTool':{'file':BUILDER_WHEEL.name,'sha256':sha(BUILDER_WHEEL)},
              'wheel':{'file':str(wheel),'sha256':sha(wheel)},'logs':logs,'workspace':str(workspace),'temporaryWorkspace':str(temporary)}
    evidence_path.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':evidence['status'],'wheel':str(wheel),'output':str(evidence_path)}))

if __name__=='__main__':
    main()
