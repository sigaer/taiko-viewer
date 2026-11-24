import os,sys,shutil,subprocess
from pathlib import Path
root=Path(sys.argv[1]); scratch=Path(os.environ['QA_RUN_TMPDIR']); dest=scratch/'wheel-source'
env=dict(os.environ, PIP_CONFIG_FILE='/dev/null')
build_tools=scratch/'build-tools'
subprocess.run([sys.executable,'-m','pip','--isolated','install','--index-url','https://pypi.org/simple','--target',str(build_tools),'setuptools==80.9.0','wheel==0.45.1'],check=True,env=env)
env['PYTHONPATH']=str(build_tools)
# Copy tracked candidate files only, excluding worktree metadata and generated caches.
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
for name in filter(None,files):
 source=root/name
 if source.is_file():
  target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
for rel in ['packages/sakura-taiko-core','packages/taiko-application','.']:
 subprocess.run([sys.executable,'-m','pip','wheel','--no-deps','--no-build-isolation','--no-index','--wheel-dir',str(scratch/'wheels'),str(dest/rel)],check=True,env=env)
print('CANDIDATE WHEELS:')
for p in sorted((scratch/'wheels').glob('*.whl')): print(p.name,p.stat().st_size)
