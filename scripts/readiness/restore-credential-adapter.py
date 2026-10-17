#!/usr/bin/env python3
"""Restore credential test adapter v2, with narrow persistent QA path exceptions."""
import argparse,ast,hashlib,json,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--taiko',type=Path,required=True);p.add_argument('--destination',type=Path,required=True);a=p.parse_args()
vault=Path('/home/sigaer/taiko/qa-vault').resolve(strict=True)
assert 'development-qa.slice/taiko-qa-' in Path('/proc/self/cgroup').read_text()
assert a.destination.resolve().is_relative_to(vault/'sources') and not a.destination.exists()
evidence=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True);assert evidence.is_relative_to(vault/'runs')
raw=subprocess.check_output(['git','-C',str(a.taiko),'show','b71986f:tests/credential_control/installed_acceptance.py']);text=raw.decode()
needle="workspace=Path(tempfile.mkdtemp(prefix='taiko-installed-control-',dir='/var/tmp'))";assert text.count(needle)==1
text=text.replace(needle,"scratch=Path(os.environ['QA_RUN_TMPDIR']).resolve(strict=True)\nevidence_root=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True)\nqa_run=Path(os.environ['QA_RUN_DIR']).resolve(strict=True)\nassert qa_run.parent==Path('/home/sigaer/taiko/qa-vault/runs')\nassert scratch==qa_run/'scratch' and evidence_root==qa_run/'evidence'\nassert args.output.resolve().is_relative_to(evidence_root)\nallowed_role=Path(sys.prefix).resolve(strict=True)\nassert allowed_role.is_relative_to('/home/sigaer/taiko/qa-vault') and allowed_role!=Path('/home/sigaer/taiko/qa-vault')\nworkspace=Path(tempfile.mkdtemp(prefix='taiko-installed-control-',dir=scratch))")
needle="dir='/var/tmp'";assert text.count(needle)==1;text=text.replace(needle,'dir=scratch')
needle="        path=os.fsdecode(values[0])";assert text.count(needle)==1
text=text.replace(needle,"        resolved=Path(os.fsdecode(values[0])).resolve()\n        if resolved.is_relative_to(allowed_role) or resolved.is_relative_to(qa_run):\n            return\n        path=str(resolved)")
assert text.count("logpath=workspace/'tests.log'")==1;text=text.replace("logpath=workspace/'tests.log'","logpath=evidence_root/'credential-tests.log'")
# All actual test assertions and test method names must remain byte-equivalent ASTs.
def assertions(source):
 tree=ast.parse(source);cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='ControlCase')
 return [ast.dump(n,include_attributes=False) for n in ast.walk(cls) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr.startswith('assert')]
assert assertions(raw.decode())==assertions(text)
a.destination.mkdir(mode=0o700,parents=True);(a.destination/'installed_acceptance.original.py').write_bytes(raw);(a.destination/'installed_acceptance.py').write_text(text)
report={'status':'ADAPTER_V2_RESTORED_NOT_EXECUTED','originalRevision':'b71986f','originalSha256':hashlib.sha256(raw).hexdigest(),'adaptedSha256':hashlib.sha256(text.encode()).hexdigest(),'testAssertionsUnchanged':True,'changes':['all temporary roots in QA_RUN_TMPDIR','open guard permits only resolved current sys.prefix and QA_RUN_DIR before original production-tree deny','log retained in evidence'],'directory':str(a.destination),'priorEvidenceAdapterHash':'NOT_RECORDED'}
(evidence/'credential-adapter-v2-restoration.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
