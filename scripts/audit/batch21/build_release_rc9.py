"""Reproducible RC wheels and a new non-system-site-packages Python install."""
import hashlib,json,os,platform,shutil,subprocess,sys,tarfile
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');OUT=BASE/'release-candidate-rc9';OUT.mkdir(exist_ok=True)
BUILD_PY=Path('/var/tmp/taiko-batch2-20261124/installed-center-rc/bin/python')
SCRATCH=Path(os.environ['QA_RUN_TMPDIR']);PY=BASE/'installed-rc9/bin/python'
def call(args,**kwargs):return subprocess.run([str(a) for a in args],check=True,timeout=600,**kwargs)
def sha(path):
 with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
manifest={'qaRun':os.environ['QA_RUN_ID'],'sources':{},'artifacts':{},'buildEnvironment':{'python':sys.version,'platform':platform.platform()},'verification':{}}
for name,repo,relative in [('bot',BASE/'bot','.')]:
 assert not subprocess.check_output(['git','status','--porcelain'],cwd=repo,text=True).strip(),'Dirty source '+name
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
 epoch=subprocess.check_output(['git','show','-s','--format=%ct','HEAD'],cwd=repo,text=True).strip()
 destination=SCRATCH/('source-'+name);destination.mkdir()
 archive=SCRATCH/(name+'.tar')
 with archive.open('wb') as stream:call(['git','archive','--format=tar','HEAD'],cwd=repo,stdout=stream)
 with tarfile.open(archive) as bundle:bundle.extractall(destination,filter='data')
 files={str(p.relative_to(destination)):sha(p) for p in destination.rglob('*') if p.is_file()}
 manifest['sources'][name]={'commit':commit,'package':relative,'sourceDateEpoch':epoch,'files':files}
 wheels=[]
 for number in (1,2):
  wheel_dir=SCRATCH/f'{name}-build-{number}'
  call([BUILD_PY,'-m','pip','wheel','--no-index','--no-deps','--no-build-isolation','--wheel-dir',wheel_dir,destination/relative],env={**os.environ,'SOURCE_DATE_EPOCH':epoch,'PYTHONHASHSEED':'0'})
  wheels.append(next(wheel_dir.glob('*.whl')))
 assert sha(wheels[0])==sha(wheels[1]),'Non-reproducible wheel '+name
 target=OUT/wheels[0].name
 assert not target.exists(),'Unique candidate artifact already exists'
 shutil.copyfile(wheels[0],target)
 manifest['artifacts'][target.name]={'sha256':sha(target),'bytes':target.stat().st_size,'rebuildByteIdentical':True,'sourceCommit':commit}
prior=BASE/'release-candidate-rc8'
manifest['reusedArtifactManifest']='../release-candidate-rc8/release-manifest.json'
for pattern in ['sakura_taiko_core-0.1.4rc2-*.whl','taiko_application-0.10.0rc2-*.whl','sakura_taiko_contract-0.1.0-*.whl','python_memory_runtime-1.1.0-*.whl']:
 source=next(prior.glob(pattern));target=OUT/source.name;shutil.copyfile(source,target)
 manifest['artifacts'][source.name]={'sha256':sha(source),'bytes':source.stat().st_size,'reusedUnchangedArtifact':True,'sourceManifest':'../release-candidate-rc8/release-manifest.json'}
assert not (BASE/'installed-rc9').exists(),'Fresh environment path must not already exist'
call(['/usr/bin/python3','-m','venv','--copies',BASE/'installed-rc9'])
requirements=[]
excluded={'taiko-bot','taiko-application','sakura-taiko-core','sakura-taiko-contract','python-memory-runtime'}
for line in (prior/'installed-freeze.txt').read_text().splitlines():
 name=line.split('==')[0].split(' @ ')[0].lower().replace('_','-')
 if name not in excluded:requirements.append(line)
(OUT/'external-requirements.txt').write_text('\n'.join(requirements)+'\n')
call([PY,'-m','pip','--isolated','install','--proxy','http://127.0.0.1:18888','--index-url','https://pypi.org/simple','-r',OUT/'external-requirements.txt'])
call([PY,'-m','pip','install','--no-index','--no-deps',*sorted(OUT.glob('*.whl'))])
with (OUT/'pip-check.txt').open('w') as stream:call([PY,'-m','pip','check'],stdout=stream)
for role in ['center','client','center,client']:
 with (OUT/(role.replace(',','-')+'-resolver.txt')).open('w') as stream:
  result=subprocess.run([str(PY),'-m','pip','install','--dry-run','--no-index','--find-links',str(OUT),f'taiko-bot[{role}]==0.27.0rc9'],stdout=stream,stderr=subprocess.STDOUT,timeout=60)
 manifest['verification'][role+'ResolverExit']=result.returncode
 assert result.returncode==0,'Dependency resolution failed '+role
with (OUT/'installed-freeze.txt').open('w') as stream:call([PY,'-m','pip','freeze','--all'],stdout=stream)
manifest['verification']['pipCheck']='PASS'
(OUT/'release-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {p.name}\n' for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='SHA256SUMS'))
print(json.dumps({'artifacts':manifest['artifacts'],'verification':manifest['verification'],'qaRun':manifest['qaRun']}))
