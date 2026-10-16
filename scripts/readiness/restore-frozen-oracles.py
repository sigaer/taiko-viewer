#!/usr/bin/env python3
"""Restore only tracked old oracle sources; never derive expected data from candidates.
Run through memory/run_qa.sh. A mismatch preserves its report and fails closed.
"""
import argparse,hashlib,json,os,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--sakura',type=Path,required=True);p.add_argument('--taiko',type=Path,required=True);p.add_argument('--annual-evidence',type=Path,required=True);p.add_argument('--destination',type=Path,required=True);a=p.parse_args()
vault=Path('/home/sigaer/taiko/qa-vault').resolve(strict=True)
assert 'development-qa.slice/taiko-qa-' in Path('/proc/self/cgroup').read_text()
evidence_dir=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True)
assert evidence_dir.is_relative_to(vault/'runs')
assert a.destination.resolve().is_relative_to(vault/'sources') and not a.destination.exists()
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args])
revision=git(a.sakura,'rev-parse','790c2c7^{commit}').decode().strip();assert revision=='790c2c79d16005f6a62ea604715cedb56ccd624c'
a.destination.mkdir(mode=0o700,parents=True)
prepare=a.taiko/'tests/offline/prepare_frozen.py'
subprocess.run([sys.executable,'-I',str(prepare),str(a.sakura),str(a.destination)],check=True,timeout=90)
old=json.loads(a.annual_evidence.read_text());checks=[]
for module,origin in old['frozenOrigins'].items():
 relative=Path(origin['path'].split('/repro-frozen/',1)[1]);path=a.destination/relative
 checks.append({'module':module,'path':str(path),'expectedSha256':origin['sha256'],'actualSha256':sha(path)})
actual_digest=sha(a.destination/'source-digests.json')
report={'status':'PASS_RESTORED_BYTE_IDENTICAL' if actual_digest==old['frozenDigestManifestSha256'] and all(x['actualSha256']==x['expectedSha256'] for x in checks) else 'FAIL_ORACLE_SOURCE_MISMATCH','revision':revision,'prepareSha256':sha(prepare),'originalAnnualEvidenceSha256':sha(a.annual_evidence),'sourceDigests':{'path':str(a.destination/'source-digests.json'),'actualSha256':actual_digest,'expectedSha256':old['frozenDigestManifestSha256']},'frozenOrigins':checks,'productionAccess':False,'scope':'source restoration only; no business tests run; original raw test logs remain lost'}
(evidence_dir/'frozen-restoration.json').write_text(json.dumps(report,indent=2)+'\n')
if report['status']!='PASS_RESTORED_BYTE_IDENTICAL':raise SystemExit('Frozen source mismatch; preserved report, no expected data rewritten')
# Exact historical test adapter followed by explicitly limited path adaptations.
credential=a.destination.parent/'credential';assert not credential.exists();credential.mkdir(mode=0o700)
raw=git(a.taiko,'show','b71986f:tests/credential_control/installed_acceptance.py')
(credential/'installed_acceptance.original.py').write_bytes(raw)
text=raw.decode();needle="workspace=Path(tempfile.mkdtemp(prefix='taiko-installed-control-',dir='/var/tmp'))";assert text.count(needle)==1
text=text.replace(needle,"scratch=Path(os.environ['QA_RUN_TMPDIR']).resolve(strict=True)\nevidence_root=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True)\nassert scratch.is_relative_to('/home/sigaer/taiko/qa-vault/runs') and scratch.name=='scratch'\nassert evidence_root==scratch.parent/'evidence'\nassert args.output.resolve().is_relative_to(evidence_root)\nworkspace=Path(tempfile.mkdtemp(prefix='taiko-installed-control-',dir=scratch))")
assert text.count("logpath=workspace/'tests.log'")==1;text=text.replace("logpath=workspace/'tests.log'","logpath=evidence_root/'credential-tests.log'")
(credential/'installed_acceptance.py').write_text(text)
report={'status':'ADAPTER_RESTORED_NOT_EXECUTED','originalGitRevision':git(a.taiko,'rev-parse','b71986f^{commit}').decode().strip(),'originalSha256':hashlib.sha256(raw).hexdigest(),'adaptedSha256':sha(credential/'installed_acceptance.py'),'changes':['owned scratch location and vault guard','retain test log in evidence directory'],'assertionsChanged':False,'priorEvidenceAdapterHash':'NOT_RECORDED; no retrospective hash claim','directory':str(credential)}
(evidence_dir/'credential-adapter-restoration.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'frozenStatus':'PASS_RESTORED_BYTE_IDENTICAL','credentialStatus':report['status'],'evidence':str(evidence_dir)}))
# Representative lifecycle baselines are explicitly fixed by ownership docs.
# events.py reads only plugins/taiko.py from each baseline; no player data needed.
lifecycle=a.destination.parent/'lifecycle-original';assert not lifecycle.exists();lifecycle.mkdir(mode=0o700)
ownership=a.taiko/'docs/lifecycle-ownership.md';validation=a.taiko/'docs/validation/lifecycle-20261015.txt'
assert 'Taiko e37e07e / Sakura 3b08986' in ownership.read_text() and 'Taiko e37e07e / Sakura 3b08986' in validation.read_text()
rows=[]
for host,repo,revision,member in [('client',a.taiko,'e37e07e9f66825fb8860655ee146112e4ca1797d','plugins/taiko.py'),('center',a.sakura,'3b08986f21e54e4f6a84a105987174b55546dd42','taiko/plugins/taiko.py')]:
 raw=git(repo,'show',revision+':'+member);dest=lifecycle/('baseline-'+host)/'plugins/taiko.py';dest.parent.mkdir(parents=True);dest.write_bytes(raw)
 rows.append({'host':host,'revision':revision,'gitMember':member,'path':str(dest),'sha256':hashlib.sha256(raw).hexdigest()})
(evidence_dir/'lifecycle-baseline-restoration.json').write_text(json.dumps({'status':'FIXED_SOURCE_RESTORED_NOT_TESTED','sources':rows,'ownershipDocumentSha256':sha(ownership),'validationDocumentSha256':sha(validation),'oldRawEvidenceRestored':False,'oldBaselineFileHashRecorded':False},indent=2)+'\n')
