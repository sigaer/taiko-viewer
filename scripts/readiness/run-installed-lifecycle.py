#!/usr/bin/env python3
"""Adapt only frozen test-helper discovery for an isolated installed role test.
No runtime source directory is added by this launcher. Run via bounded QA.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import runpy
import sys

CANDIDATE=Path('/var/tmp/taiko-final-ownership-20261015/taiko')
ASSETS=Path('/var/tmp/taiko-phase2fe-20261014/assets')
PRODUCTS=('taiko_bot','taiko_store','taiko_application','sakura_taiko_core','sakura_taiko_contract','runtime_memory')

def sha(path):
    value=hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda:source.read(65536),b''):
            value.update(chunk)
    return value.hexdigest()

def origins():
    output={}
    root=Path(sys.prefix).resolve()
    for name in PRODUCTS:
        spec=importlib.util.find_spec(name)
        assert spec and spec.origin and Path(spec.origin).resolve().is_relative_to(root), 'product package escaped installed environment'
        output[name]=spec.origin
    for name,module in list(sys.modules.items()):
        if any(name==prefix or name.startswith(prefix+'.') for prefix in PRODUCTS):
            filename=getattr(module,'__file__',None)
            if filename:
                assert Path(filename).resolve().is_relative_to(root), 'loaded product module escaped installed environment'
    return output

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',choices=('center','client'),required=True)
    parser.add_argument('--work',type=Path,required=True)
    args=parser.parse_args()
    assert sys.flags.isolated==1, 'launcher requires -I'
    assert args.work.is_absolute() and args.work.resolve().is_relative_to('/var/tmp'), 'synthetic work root required'
    args.work.mkdir(parents=True,exist_ok=True)
    evidence=args.work/'launcher-evidence.json'
    if evidence.exists():
        raise RuntimeError('prior launcher evidence must not be overwritten')
    baseline=Path('/var/tmp/taiko-lifecycle-20261015')/('baseline-'+args.host)
    helpers={'sqlite_fixture':CANDIDATE/'tests/lifecycle/sqlite_fixture.py',
             'freeze':CANDIDATE/'tests/recommendation/freeze.py'}
    harness=CANDIDATE/'tests/lifecycle/events.py'
    fixture=CANDIDATE/'packages/taiko-application/tests/fixture.py'
    whitelist=[harness,fixture,baseline/'plugins/taiko.py',*helpers.values()]
    report={'status':'FAIL','host':args.host,'interpreter':sys.executable,
            'testHelperHashes':[{'file':str(path),'sha256':sha(path)} for path in whitelist],
            'scope':'Frozen test harness, sqlite synthetic adapter, fixture and AST oracle only; installed product package origins required.',
            'oraclePathNote':'events.py inserts tests/recommendation for its freeze oracle; freeze is preloaded by exact filename and hash. No product source import is permitted.'}
    try:
        report['originsBefore']=origins()
        for name,path in helpers.items():
            assert name not in sys.modules, 'test helper already imported'
            spec=importlib.util.spec_from_file_location(name,path)
            assert spec and spec.loader
            module=importlib.util.module_from_spec(spec)
            sys.modules[name]=module
            spec.loader.exec_module(module)
        sys.argv=[str(harness),'--representative','--host',args.host,'--baseline',str(baseline),
                  '--work',str(args.work),'--assets',str(ASSETS),'--application',str(CANDIDATE)]
        try:
            runpy.run_path(str(harness),run_name='__main__')
        except SystemExit as error:
            if error.code not in (0,None):
                raise
        report['originsAfter']=origins()
        report['status']='PASS_INSTALLED_ROLE_REPRESENTATIVE_LIFECYCLE'
    finally:
        evidence.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'launcherStatus':report['status'],'evidence':str(evidence)}))

if __name__=='__main__':
    main()
