"""Resume dependency installation after the completed, reproducible wheel stage.

The first RC8 run failed at an incorrect dependency-directory path after all six
wheel builds passed. Existing wheels are verified and never rebuilt/overwritten.
"""
import hashlib,json,os,platform,re,shutil,subprocess,sys
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');OUT=BASE/'release-candidate-rc8';PRIOR=Path('/var/tmp/taiko-batch2-20261124/release-candidate');PY=BASE/'installed-rc8/bin/python'
def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def call(args,**kwargs):return subprocess.run([str(a) for a in args],check=True,timeout=600,**kwargs)
log=(BASE/'evidence/build-rc8.log').read_text();build_qa=re.search(r'qa-[0-9a-f]{12}',log).group(0)
recorded={}
for name,size,digest in re.findall(r'filename=(\S+) size=(\d+) sha256=([0-9a-f]{64})',log):recorded.setdefault(name,[]).append((int(size),digest))
manifest={'qaRun':os.environ['QA_RUN_ID'],'completedWheelBuildQa':build_qa,'resumeReason':'Dependency source-directory typo after completed wheel stage; no artifact/source failure','sources':{},'artifacts':{},'buildEnvironment':{'python':sys.version,'platform':platform.platform()},'verification':{}}
for name,repo,relative in [('core',BASE/'core','.'),('application',BASE/'bot','packages/taiko-application'),('bot',BASE/'bot','.')]:
    assert not subprocess.check_output(['git','status','--porcelain'],cwd=repo,text=True).strip()
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();epoch=subprocess.check_output(['git','show','-s','--format=%ct','HEAD'],cwd=repo,text=True).strip()
    tracked=subprocess.check_output(['git','ls-files','-z'],cwd=repo).decode().split('\0')
    files={p:sha(repo/p) for p in tracked if p and (repo/p).is_file()}
    manifest['sources'][name]={'commit':commit,'package':relative,'sourceDateEpoch':epoch,'files':files,'reconstructedManifestFromUnchangedCleanCommit':True}
for path in OUT.glob('*.whl'):
    entries=recorded[path.name];assert len(entries)==2 and all(item==(path.stat().st_size,sha(path)) for item in entries)
    kind='core' if path.name.startswith('sakura_taiko_core') else 'application' if path.name.startswith('taiko_application') else 'bot'
    manifest['artifacts'][path.name]={'sha256':sha(path),'bytes':path.stat().st_size,'rebuildByteIdentical':True,'sourceCommit':manifest['sources'][kind]['commit'],'completedBuildQa':build_qa}
assert len(manifest['artifacts'])==3
for pattern in ['sakura_taiko_contract-0.1.0-*.whl','python_memory_runtime-1.1.0-*.whl']:
    source=next(PRIOR.glob(pattern));target=OUT/source.name;assert not target.exists();shutil.copyfile(source,target)
    manifest['artifacts'][target.name]={'sha256':sha(target),'bytes':target.stat().st_size,'reusedUnchangedArtifact':True,'sourceManifest':'Batch2 retained release manifest'}
assert not PY.parent.parent.exists();call(['/usr/bin/python3','-m','venv','--copies',PY.parent.parent])
excluded={'taiko-bot','taiko-application','sakura-taiko-core','sakura-taiko-contract','python-memory-runtime'}
requirements=[line for line in (PRIOR/'installed-freeze.txt').read_text().splitlines() if line.split('==')[0].split(' @ ')[0].lower().replace('_','-') not in excluded]
(OUT/'external-requirements.txt').write_text('\n'.join(requirements)+'\n')
call([PY,'-m','pip','--isolated','install','--proxy','http://127.0.0.1:18888','--index-url','https://pypi.org/simple','-r',OUT/'external-requirements.txt'])
call([PY,'-m','pip','install','--no-index','--no-deps',*sorted(OUT.glob('*.whl'))])
with (OUT/'pip-check.txt').open('w') as stream:call([PY,'-m','pip','check'],stdout=stream)
for role in ['center','client','center,client']:
    with (OUT/(role.replace(',','-')+'-resolver.txt')).open('w') as stream:
        result=subprocess.run([str(PY),'-m','pip','install','--dry-run','--no-index','--find-links',str(OUT),f'taiko-bot[{role}]==0.27.0rc8'],stdout=stream,stderr=subprocess.STDOUT,timeout=60)
    assert result.returncode==0;manifest['verification'][role+'ResolverExit']=result.returncode
with (OUT/'installed-freeze.txt').open('w') as stream:call([PY,'-m','pip','freeze','--all'],stdout=stream)
manifest['verification']['pipCheck']='PASS';(OUT/'release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {p.name}\n' for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='SHA256SUMS'))
print(json.dumps({'qaRun':manifest['qaRun'],'completedBuildQa':build_qa,'verification':manifest['verification'],'artifacts':manifest['artifacts']}))
