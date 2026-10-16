#!/usr/bin/env python3
"""Build only fixed tracked Taiko source in a private persistent vault; wrapper required."""
import argparse, hashlib, json, os, subprocess, tarfile, tempfile, time, zipfile
from pathlib import Path
from importlib.machinery import SourceFileLoader
helper=SourceFileLoader('recovery_helpers',str(Path(__file__).with_name('recover-runtime-artifacts.py'))).load_module()
sha=helper.sha
REVISION='a632913dfbdbec1d465f8eaccc0bb80c35e25745'
EXPECTED='0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8'
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--vault',type=Path,required=True)
    p.add_argument('--source-repo',type=Path,required=True)
    p.add_argument('--builder-wheel',type=Path,required=True)
    p.add_argument('--epoch',type=int)
    a=p.parse_args(); vault=a.vault.resolve()
    if str(vault).startswith(('/tmp/','/var/tmp/')) or not vault.is_dir() or vault.stat().st_mode&0o077: p.error('private persistent vault required')
    if sha(a.builder_wheel)!=helper.BUILDER_SHA: p.error('exact builder required')
    root=Path(tempfile.mkdtemp(prefix='taiko-rebuild-',dir=vault)); source=root/'source'; source.mkdir()
    report={'status':'FAIL','sourceCommit':REVISION,'historicalWheelSha256':EXPECTED,'productionAccess':False,'workspace':str(root),'logs':{}}
    def run(command,label,cwd=root,env=None):
        log=root/(label+'.log')
        with log.open('wb') as f: result=subprocess.run([str(x) for x in command],cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=180)
        report['logs'][label]={'file':str(log),'sha256':sha(log),'exitCode':result.returncode}
        if result.returncode or log.stat().st_size>2_000_000: raise RuntimeError(label+' failed')
    try:
        archive=root/'source.tar'
        run(['git','-C',a.source_repo,'archive','--format=tar','--output='+str(archive),REVISION],'export')
        with tarfile.open(archive) as tar:
            for member in tar.getmembers():
                path=Path(member.name)
                if path.is_absolute() or '..' in path.parts: raise RuntimeError('unsafe tracked path')
                if member.isfile():
                    target=source/path;target.parent.mkdir(parents=True,exist_ok=True)
                    with tar.extractfile(member) as inp,target.open('wb') as out:
                        import shutil
                        shutil.copyfileobj(inp,out)
                elif not member.isdir(): raise RuntimeError('tracked symlink unsupported')
        epoch=a.epoch
        if epoch is None: epoch=int(subprocess.check_output(['git','-C',str(a.source_repo),'show','-s','--format=%ct',REVISION],timeout=20))
        env={'PATH':'/usr/bin:/bin','TMPDIR':str(root),'PIP_CONFIG_FILE':'/dev/null','PIP_NO_INDEX':'1','PIP_DISABLE_PIP_VERSION_CHECK':'1','SOURCE_DATE_EPOCH':str(epoch)}
        report['sourceDateEpoch']=epoch
        builder=root/'builder';python=builder/'bin/python';wheels=root/'wheels';wheels.mkdir()
        run(['/usr/bin/python3','-m','venv',builder],'venv',env=env)
        run([python,'-I','-m','pip','install','--no-index','--no-deps',a.builder_wheel],'builder-install',env=env)
        run([python,'-I','-m','pip','wheel','--no-index','--no-deps','--no-build-isolation','--wheel-dir',wheels,source],'build',env=env)
        wheel=next(wheels.glob('taiko_bot-0.14.2-*.whl'));members={};mismatches=[]
        with zipfile.ZipFile(wheel) as z:
            for entry in z.infolist():
                data=z.read(entry.filename);digest=hashlib.sha256(data).hexdigest()
                tracked=source/entry.filename
                metadata='.dist-info/' in entry.filename
                matches=tracked.is_file() and sha(tracked)==digest
                members[entry.filename]={'sha256':digest,'bytes':entry.file_size,'zipDateTime':entry.date_time,'sourceMatch':matches,'buildMetadata':metadata}
                if not metadata and not matches: mismatches.append(entry.filename)
        report.update(wheel={'file':str(wheel),'sha256':sha(wheel),'bytes':wheel.stat().st_size},members=members,sourceMismatches=mismatches,
                      historicalMemberManifestAvailable=False,historicalContentParityClaim=False)
        if mismatches: raise RuntimeError('packaged implementation differs from exact source')
        if len(members)!=393: raise RuntimeError('historical wheel member count differs')
        report['status']='PASS_EXACT_WHEEL' if sha(wheel)==EXPECTED else 'SOURCE_PARITY_OLD_ARCHIVE_BYTES_UNAVAILABLE'
    finally:
        path=root/'build-evidence.json';path.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'evidence':str(path),'status':report['status']}))
if __name__=='__main__':main()
