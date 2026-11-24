"""Build immutable local RC artifacts and install a genuinely fresh venv, via run_qa."""
import hashlib, json, os, platform, shutil, subprocess, sys, sysconfig
from pathlib import Path

BASE = Path('/var/tmp/taiko-batch2-20261124')
OUT = BASE / 'artifacts-center-rc'
OUT.mkdir(exist_ok=True)
SCRATCH = Path(os.environ['QA_RUN_TMPDIR'])
PYTHON = BASE / 'installed-center-rc/bin/python'

def call(args, **kwargs):
    return subprocess.run([str(x) for x in args], check=True, timeout=420, **kwargs)

def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

call(['/usr/bin/python3', '-m', 'venv', BASE / 'installed-center-rc'])
call([PYTHON, '-m', 'pip', '--isolated', 'install', '--proxy', 'http://127.0.0.1:18888', '--index-url', 'https://pypi.org/simple', 'setuptools==80.9.0', 'wheel==0.45.1'])
manifest = {'qaRun': os.environ['QA_RUN_ID'], 'python': platform.python_version(), 'platform': platform.platform(), 'buildTools': {'setuptools':'80.9.0','wheel':'0.45.1'}, 'sources': [], 'artifacts': {}}
for name, repo, relative in [('core', BASE/'core', '.'), ('contract', BASE/'bot', 'packages/sakura-taiko-contract'), ('application', BASE/'bot', 'packages/taiko-application'), ('bot', BASE/'bot', '.'), ('memory', BASE/'bot', 'packages/python-memory-runtime')]:
    commit = subprocess.check_output(['git','rev-parse','HEAD'], cwd=repo, text=True).strip()
    dest = SCRATCH / ('source-' + name)
    paths = subprocess.check_output(['git','ls-files','-z'], cwd=repo).decode().split('\0')
    files = {}
    for filename in filter(None, paths):
        source = repo/filename
        if source.is_file():
            target=dest/filename; target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(source, target)
            files[filename] = sha(source)
    manifest['sources'].append({'name':name,'repository':str(repo),'commit':commit,'package':relative,'files':files})
    call([PYTHON,'-m','pip','wheel','--no-deps','--no-build-isolation','--no-index','--wheel-dir',OUT,dest/relative])
for p in OUT.glob('*.whl'):
    manifest['artifacts'][p.name] = {'sha256':sha(p),'bytes':p.stat().st_size}
(OUT/'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
core = next(OUT.glob('sakura_taiko_core-*.whl'))
contract = next(OUT.glob('sakura_taiko_contract-*.whl'))
call([PYTHON,'-m','pip','--isolated','install','--no-index',core,contract])
# Install staged first-party wheels before resolving the full dependency set.
# Any forced-install stage is provisional until final pip check and profile resolution.
for glob in ['taiko_application-*.whl','taiko_bot-*.whl','python_memory_runtime-*.whl']:
    call([PYTHON,'-m','pip','--isolated','install','--no-index','--no-deps',next(OUT.glob(glob))])
deps = ['pytest==8.4.2','Pillow','pypinyin==0.55.0','numpy','pandas','matplotlib','PyMySQL','httpx','requests','ujson','python-dotenv','cryptography','beautifulsoup4','pydantic','fuzzywuzzy','psutil','openpyxl','fastapi','uvicorn','nb-cli','nonebot-adapter-onebot','nonebot-adapter-qq','nonebot-plugin-apscheduler','nonebot2','pydub==0.25.1','redis','tqdm==4.67.1','websockets','wordcloud']
call([PYTHON,'-m','pip','--isolated','install','--proxy','http://127.0.0.1:18888','--index-url','https://pypi.org/simple',*deps])
with (OUT/'installed-freeze.txt').open('w') as out:
    call([PYTHON,'-m','pip','freeze','--all'], stdout=out)
with (OUT/'pip-check.txt').open('w') as out:
    result=subprocess.run([str(PYTHON),'-m','pip','check'],stdout=out,stderr=subprocess.STDOUT,timeout=30)
manifest['pipCheckExitCode']=result.returncode
(OUT/'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'artifacts':manifest['artifacts'],'qaRun':manifest['qaRun'],'pipCheckExit':result.returncode}))
