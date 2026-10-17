"""Inspect immutable installed identity/checkpoint domains; no source fallback."""
import hashlib,json,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'docs/platform-architecture-audit/evidence/fast-growth-identity-20261016.json'
assert not out.exists()
roles={'baseline0141':'/var/tmp/taiko-role-rebuild-tvcehdgr/venv/bin/python','candidate0142':'/var/tmp/taiko-role-rebuild-hlmgfkq0/venv/bin/python'}
probe=r'''
import hashlib,json,sys,importlib.metadata
from pathlib import Path
from taiko_bot.offline import fingerprint as f
root=Path(sys.argv[1]); identity=f.artifact_identity()
checkpoint_path=Path(f.__file__).with_name('growth-compatibility.dat'); checkpoint=json.loads(checkpoint_path.read_text())
actual=f.growth_revision(root)
v2=hashlib.sha256(('taiko-growth-revision-v2\0'+identity+'\0').encode())
for label in ('songs/rating_structured_with_ids.json','songs/song_data.json','songs/song_alias.json'):
 v2.update(label.encode());v2.update(b'\0');v2.update((root/label).read_bytes());v2.update(b'\0')
assert sys.flags.isolated==1 and Path(f.__file__).resolve().is_relative_to(Path(sys.prefix).resolve())
exact=identity==checkpoint['artifactIdentity']
if not exact: assert actual==v2.hexdigest()
print(json.dumps({'version':importlib.metadata.version('taiko-bot'),'interpreter':sys.executable,'module':f.__file__,'artifactIdentity':identity,'checkpointArtifact':checkpoint['artifactIdentity'],'checkpointSha256':hashlib.sha256(checkpoint_path.read_bytes()).hexdigest(),'exactCheckpointMatch':exact,'revision':actual,'domain':'legacy-checkpoint' if exact else 'v2-content-identity','v2Expected':v2.hexdigest()}))
'''
with tempfile.TemporaryDirectory(prefix='growth-identity-arbitration-',dir='/var/tmp') as temp:
 directory=Path(temp);(directory/'songs').mkdir()
 for name in ['rating_structured_with_ids.json','song_data.json','song_alias.json']:(directory/'songs'/name).write_text('[]')
 results={}
 for role,python in roles.items():
  value=subprocess.run([python,'-I','-c',probe,temp],cwd=temp,check=True,capture_output=True,text=True,timeout=30)
  assert len(value.stdout)<8192
  results[role]=json.loads(value.stdout)
 assert results['baseline0141']['checkpointSha256']==results['candidate0142']['checkpointSha256']
 assert not results['candidate0142']['exactCheckpointMatch']
 result={'status':'PASS_CONTENT_IDENTITY_GUARD','results':results,'productionAccess':False,'checkpointModified':False,'strictAnnualOracleDisposition':'BLOCKED_PENDING_EXPLICIT_IDENTITY_ORACLE_REVISION','reason':'Annual v4.5.4 and changed installed contents require new identity; old measurements/reports retain their persisted identities. No reset of compatibility checkpoint is legitimate. Existing exact equality test remains FAIL, not waived.','priorEvidence':'evidence/source-reappearance-20261016.json','cgroup':Path('/proc/self/cgroup').read_text().strip()}
 out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':result['status'],'domains':{k:v['domain'] for k,v in results.items()}}))
