#!/usr/bin/env python3
"""Make run-specific configs, never cookies in the repo or on the command line."""
import json,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();assert str(root).startswith('/var/tmp/annual-test-')
base=json.loads((root/'probe.json').read_text());accounts=json.loads((root/'accounts.json').read_text());by={a['kind']:a for a in accounts}
stages=[('high-smoke','smoke',['high','normal'],1,1,1),('same2','same2',['same2','normal'],2,1,1),('same5','same5',['same5','normal'],5,1,1),('parallel2','parallel2',['parallel0','parallel1'],2,1,1),('parallel3','parallel3',['parallel2','parallel3','parallel4'],3,1,1),('share','share',['normal','high'],1,1,1),('share2','share2',['normal','high'],2,1,1),('warm','warm',['normal','sparse'],5,120,1),('warm3','warm',['normal','sparse'],10,180,3),('warm5','warm',['normal','sparse'],10,300,5),('burst','burst',['normal','sparse'],10,60,10),('mixed','mixed',['normal','high','parallel5','sparse'],3,30,1),('recovery','recovery',['normal','sparse'],5,180,1),('cold','cold',[f'cold{i}' for i in range(30)],1,1,1)]
for name,scenario,kinds,vu,seconds,rate in stages:
 ap=root/f'{name}-accounts.json';ap.write_text(json.dumps([by[k] for k in kinds]));ap.chmod(0o600)
 config={**base,'scenario':scenario,'accountsFile':str(ap),'maxVus':vu,'seconds':seconds,'rate':rate,'locale':'ja' if name=='share2' else 'zh'}
 path=root/f'{name}.json';path.write_text(json.dumps(config,indent=2));path.chmod(0o600)
for name,extra in [('public-auth',{'publicAuth':True}),('protocol',{'protocolOnly':True}),('browser',{}),('high-browser',{'browserCases':[['high','zh']]}),('render-diagnostic',{'renderDiagnostics':True})]:
 path=root/f'{name}.json';path.write_text(json.dumps({**base,**extra},indent=2));path.chmod(0o600)
print('Configs ready; escalation still requires an explicitly reviewed previousResult.')
