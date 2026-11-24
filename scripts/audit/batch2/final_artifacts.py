"""Deterministic final wheel builds + real resolver checks; no publication."""
import hashlib, importlib.metadata as md, json, os, shutil, subprocess, sys, zipfile
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch2-20261124');OUT=BASE/'release-candidate';OUT.mkdir(exist_ok=True)
PY=BASE/'installed-center-rc/bin/python';SCRATCH=Path(os.environ['QA_RUN_TMPDIR'])
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def call(args,**kwargs):return subprocess.run([str(x) for x in args],check=True,timeout=180,**kwargs)
manifest={'qaRun':os.environ['QA_RUN_ID'],'sourceCommits':{},'artifacts':{},'SOURCE_DATE_EPOCH':{},'consumerMetadata':{},'verification':{}}
packages=[('core',BASE/'core','.'),('contract',BASE/'bot','packages/sakura-taiko-contract'),('application',BASE/'bot','packages/taiko-application'),('bot',BASE/'bot','.'),('memory',BASE/'bot','packages/python-memory-runtime')]
for name,repo,rel in packages:
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();epoch=subprocess.check_output(['git','show','-s','--format=%ct',commit],cwd=repo,text=True).strip()
    dest=SCRATCH/name
    for filename in filter(None,subprocess.check_output(['git','ls-files','-z'],cwd=repo).decode().split('\0')):
        p=repo/filename
        if p.is_file():q=dest/filename;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
    manifest['sourceCommits'][name]={'repository':str(repo),'commit':commit,'relativePackage':rel};manifest['SOURCE_DATE_EPOCH'][name]=epoch
    env=dict(os.environ,SOURCE_DATE_EPOCH=epoch,PYTHONHASHSEED='0')
    first=SCRATCH/(name+'-one');second=SCRATCH/(name+'-two')
    for directory in (first,second):call([PY,'-m','pip','wheel','--no-index','--no-deps','--no-build-isolation','--wheel-dir',directory,dest/rel],env=env)
    a=next(first.glob('*.whl'));b=next(second.glob('*.whl'));assert sha(a)==sha(b),'Nonreproducible '+name
    shutil.copyfile(a,OUT/a.name);manifest['artifacts'][a.name]={'sha256':sha(a),'bytes':a.stat().st_size,'rebuildByteIdentical':True}
    with zipfile.ZipFile(a) as z:
        metadata=z.read(next(x for x in z.namelist() if x.endswith('.dist-info/METADATA'))).decode()
        manifest['consumerMetadata'][name]=[line for line in metadata.splitlines() if line.startswith(('Name:','Version:','Requires-Python:','Requires-Dist:'))]
private_dependencies=['nonebot_plugin_groupmate_taiko-0.1.0-py3-none-any.whl','sakura_command_routing-0.1.4-py3-none-any.whl','pil_utils-0.2.2-py3-none-any.whl','pillow-11.3.0-cp311-cp311-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl','bbcode-1.1.0-py2.py3-none-any.whl','opencv_python_headless-4.14.0.94-cp37-abi3-manylinux_2_28_x86_64.whl','skia_python-144.0.post2-cp311-cp311-manylinux_2_28_x86_64.whl']
for name in private_dependencies:
    p=Path('/opt/taiko-bot/artifacts')/name;shutil.copyfile(p,OUT/name);manifest['artifacts'][name]={'sha256':sha(p),'bytes':p.stat().st_size,'source':'existing installed release artifact; not rebuilt in Batch2'}
for p in Path('/opt/taiko-bot/artifacts').glob('pybind11-*.whl'):
    shutil.copyfile(p,OUT/p.name);manifest['artifacts'][p.name]={'sha256':sha(p),'bytes':p.stat().st_size,'source':'existing release dependency artifact'}
# Install every actual local RC wheel. No source directory is on the import path.
call([PY,'-m','pip','install','--no-index','--no-deps','--force-reinstall',*sorted(OUT.glob('*.whl'))])
call([PY,'-m','pip','check'])
checks=[('center',f'taiko-bot[center]==0.26.4rc1'),('client',f'taiko-bot[client]==0.26.4rc1')]
for role,requirement in checks:
    p=OUT/(role+'-resolver.txt')
    with p.open('w') as out:
        result=subprocess.run([str(PY),'-m','pip','install','--dry-run','--no-index','--find-links',str(OUT),requirement],stdout=out,stderr=subprocess.STDOUT,timeout=60)
    manifest['verification'][role+'ResolverExit']=result.returncode
with (OUT/'installed-freeze.txt').open('w') as out:call([PY,'-m','pip','freeze','--all'],stdout=out)
manifest['buildEnvironment']={'python':sys.version,'setuptools':subprocess.check_output([str(PY),'-c','import setuptools;print(setuptools.__version__)'],text=True).strip(),'wheel':subprocess.check_output([str(PY),'-c','import wheel;print(wheel.__version__)'],text=True).strip()}
source_manifest=BASE/'artifacts-center-rc/source-manifest.json';shutil.copyfile(source_manifest,OUT/'source-file-manifest.json');manifest['sourceFileManifestSha256']=sha(OUT/'source-file-manifest.json')
(OUT/'release-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(OUT/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {p.name}\n' for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='SHA256SUMS'))
print(json.dumps({'qaRun':manifest['qaRun'],'artifacts':manifest['artifacts'],'verification':manifest['verification']}))
