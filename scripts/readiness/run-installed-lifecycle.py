#!/usr/bin/env python3
"""Adapt only frozen test-helper discovery for an isolated installed role test.
No runtime source directory is added by this launcher. Run via bounded QA.
"""
import argparse
import ast
import os
import shutil
import hashlib
import importlib.util
import json
from pathlib import Path
import runpy
import sys

CANDIDATE=Path('/home/sigaer/taiko/.worktrees/taiko082-recovered-20261016')
VAULT=Path('/home/sigaer/taiko/qa-vault')
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
    args=parser.parse_args()
    assert sys.flags.isolated==1, 'launcher requires -I'
    assert 'development-qa.slice' in Path('/proc/self/cgroup').read_text(), 'bounded QA required'
    scratch=Path(os.environ['QA_RUN_TMPDIR']).resolve()
    evidence_root=Path(os.environ['QA_EVIDENCE_DIR']).resolve()
    manifest_path=Path(os.environ['QA_ARTIFACT_MANIFEST']).resolve()
    assert manifest_path.is_relative_to(VAULT) and not manifest_path.stat().st_mode & 0o077
    manifest=json.loads(manifest_path.read_text())
    role=manifest['roles'][args.host]
    assert Path(sys.executable).absolute()==Path(role['python']).absolute(), 'wrong role interpreter'
    identity=Path(role['originEvidenceFile'])
    assert sha(identity)==role['originEvidenceSha256'], 'role evidence changed'
    assert sha(Path(role['lockFile']))==role['lockSha256'], 'role lock changed'
    assert sha(Path(role['wheelFile']))==role['wheelSha256'], 'role wheel changed'
    assets=Path(manifest['assetsRoot']).resolve()
    assert assets.is_relative_to(VAULT/'sources') and assets.is_dir()
    assert sha(Path(manifest['assetsManifestFile']))==manifest['assetsManifestSha256'], 'synthetic asset manifest changed'
    assert scratch.is_relative_to(VAULT/'runs') and evidence_root.is_relative_to(VAULT/'runs')
    work=scratch/('lifecycle-'+args.host);work.mkdir()
    evidence=evidence_root/('lifecycle-'+args.host+'-launcher.json')
    if evidence.exists():raise RuntimeError('prior evidence must not be overwritten')
    # Identify fixed source by digest, not a possibly mislabeled restoration folder.
    expected_baseline={'center':'81909fde7fd1eaa9c45dbaf2a7f69987307f363029c6a83169ad35a113807c83',
                       'client':'3b55ebb67e983d7f8c52015e6fe0ffbc9be237671b1cdb6c751a883ebf1110bb'}
    matches=[label for label in ('center','client') if sha(VAULT/'sources/lifecycle-original'/('baseline-'+label)/'plugins/taiko.py')==expected_baseline[args.host]]
    assert len(matches)==1, 'fixed baseline missing or ambiguous'
    source_host=matches[0]
    original_baseline=VAULT/'sources/lifecycle-original'/('baseline-'+source_host)
    baseline_text=(original_baseline/'plugins/taiko.py').read_text()
    if args.host=='center':
        assert '_SETTINGS = get_settings()' not in baseline_text and 'fetch_game_login_qr_image' in baseline_text
    else:
        assert '_SETTINGS = get_settings()' in baseline_text and 'fetch_center_bind_info' in baseline_text
    source_paths=['tests/lifecycle/events.py','tests/lifecycle/sqlite_fixture.py',
                  'tests/recommendation/freeze.py','packages/taiko-application/tests/fixture.py']
    application=work/'harness'
    helper_hashes=[]
    for relative in source_paths:
        source=CANDIDATE/relative;target=application/relative
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        helper_hashes.append({'file':str(source),'sha256':sha(source)})
    baseline=work/'baseline';(baseline/'plugins').mkdir(parents=True)
    shutil.copyfile(original_baseline/'plugins/taiko.py',baseline/'plugins/taiko.py')
    helper_hashes.append({'file':str(original_baseline/'plugins/taiko.py'),'sha256':sha(original_baseline/'plugins/taiko.py')})
    harness=application/'tests/lifecycle/events.py'
    original=harness.read_text()
    old="if event=='open' and isinstance(args[0],str) and args[0].startswith(('/home/sigaer/','/opt/','/etc/taiko')):"
    new="if event=='open' and isinstance(args[0],str) and args[0].startswith(('/home/sigaer/','/opt/','/etc/taiko')) and not any(Path(args[0]).resolve().is_relative_to(root) for root in (a.work.resolve(), a.assets.resolve(), Path(sys.prefix).resolve(), Path("+repr(str(evidence_root))+"))):"
    assert original.count(old)==1, 'unexpected audit guard source'
    adapted=original.replace(old,new)
    assertions=lambda text:[ast.dump(n,include_attributes=False) for n in ast.walk(ast.parse(text)) if isinstance(n,ast.Assert)]
    assert assertions(original)==assertions(adapted), 'business assertions changed'
    harness.write_text(adapted)
    os.environ.update(TAIKO_RUNTIME_ENV_FILE=str(work/'absent.env'),MPLCONFIGDIR=str(work/'mpl'),XDG_CACHE_HOME=str(work/'cache'))
    report={'status':'FAIL','host':args.host,'interpreter':sys.executable,'manifest':str(manifest_path),'manifestSha256':sha(manifest_path),
            'baselineSourceRole':args.host,'baselineRestorationLabel':source_host,'baselineRoleCorrection':'Sakura 3b08986=center native; Taiko e37e07e=client proxy; original files unchanged',
            'testHelperHashes':helper_hashes,'adaptedHarnessSha256':sha(harness),'businessAssertionAstUnchanged':True,
            'pathAdaptation':'Only blanket /home guard permits exact run scratch/evidence, role sitepackages and synthetic assets; application IO and network guards unchanged.',
            'assetsDatasetRevision':manifest['assetsDatasetRevision'],'assetsManifestSha256':manifest['assetsManifestSha256'],'historicalPngRestorationClaim':False,
            'productionAccess':False,'scope':'Representative installed lifecycle parity, original 46 events per role; synthetic SQLite only.'}
    helpers={'sqlite_fixture':application/'tests/lifecycle/sqlite_fixture.py','freeze':application/'tests/recommendation/freeze.py'}
    try:
        report['originsBefore']=origins()
        for name,path in helpers.items():
            assert name not in sys.modules, 'test helper already imported'
            spec=importlib.util.spec_from_file_location(name,path)
            assert spec and spec.loader
            module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module)
        sys.argv=[str(harness),'--representative','--host',args.host,'--baseline',str(baseline),
                  '--work',str(work),'--assets',str(assets),'--application',str(application)]
        try:runpy.run_path(str(harness),run_name='__main__')
        except SystemExit as error:
            if error.code not in (0,None):raise
        report['originsAfter']=origins()
        parity=work/'parity.json';events=json.loads(parity.read_text())
        assert len(events)==46, 'representative event count changed'
        target=evidence_root/('lifecycle-'+args.host+'-parity.json');shutil.copyfile(parity,target)
        report['parity']={'file':str(target),'sha256':sha(target),'events':len(events)}
        report['status']='PASS_INSTALLED_ROLE_REPRESENTATIVE_LIFECYCLE'
    finally:
        # Audit allowlist includes only this run's evidence directory.
        evidence.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'launcherStatus':report['status'],'evidence':str(evidence)}))

if __name__=='__main__':main()
