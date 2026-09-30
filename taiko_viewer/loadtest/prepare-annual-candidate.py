import subprocess,tarfile,io,shutil,json,hashlib,sys,re
from pathlib import Path
repo=Path(__file__).resolve().parents[2];r=Path(sys.argv[1]).resolve();assert str(r).startswith('/var/tmp/annual-test-');r.mkdir(parents=True,exist_ok=True,mode=0o700);(r/'evidence').mkdir(exist_ok=True);target=r/'source';target.mkdir(exist_ok=False)
commit=subprocess.check_output(['git','rev-parse',sys.argv[2]],cwd=repo,text=True).strip()
p=subprocess.Popen(['git','archive',commit],cwd=repo,stdout=subprocess.PIPE)
with tarfile.open(fileobj=p.stdout,mode='r|') as t:t.extractall(target/'taiko-forum',filter='data')
assert p.wait()==0
shutil.copytree('/home/sigaer/taiko/schemas',target/'schemas',dirs_exist_ok=True)
(target/'taiko-forum/taiko_viewer/node_modules').symlink_to(repo/'taiko_viewer/node_modules')
# Public Python/catalog dependencies are external to the Viewer repository.
for name in ['plugins/utils/annual_summary','plugins/utils/snapshot_history.py','plugins/utils/score_calculator.py','plugins/utils/chart_availability.py','plugins/utils/duplicate_versions.py','plugins/utils/chart_roll_metadata.py','songs/song_data.json','songs/song_data_raw.json','songs/song_alias.json','songs/rating_structured_with_ids.json']:
 src=(Path(sys.argv[3]) if len(sys.argv)>3 and name=='plugins/utils/annual_summary' else Path('/home/sigaer/taiko'))/name;dst=target/name
 dst.parent.mkdir(parents=True,exist_ok=True)
 if src.is_dir():shutil.copytree(src,dst,ignore=shutil.ignore_patterns('__pycache__'),dirs_exist_ok=True)
 elif src.exists():shutil.copy2(src,dst)
files={str(p.relative_to(target)):hashlib.file_digest(p.open('rb'),'sha256').hexdigest() for p in target.rglob('*') if p.is_file() and 'node_modules' not in p.parts}
(r/'evidence/input-manifest.json').write_text(json.dumps({'commit':commit,'version':json.loads((target/'taiko-forum/taiko_viewer/package.json').read_text())['version'],'algorithm':re.search(r'ANNUAL_ALGORITHM_VERSION = "([^"]+)"',(target/'taiko-forum/taiko_viewer/server/services/account/annual-summary/constants.ts').read_text()).group(1),'source':'git archive; no dirty overlays','externalInputs':['schemas','plugins/utils','songs','node_modules symlink (existing locked install)'],'files':files},indent=2))
