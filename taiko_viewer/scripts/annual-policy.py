#!/usr/bin/env python3
"""Atomic local operator control. Does not touch users, caches or worker budgets."""
import argparse,json,os,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--file',default='/var/lib/taiko/annual-policy.json');p.add_argument('--mode',choices=['invite','public']);p.add_argument('--pause-generation',choices=['yes','no']);p.add_argument('--pause-rendering',choices=['yes','no']);a=p.parse_args()
path=Path(a.file);value=json.loads(path.read_text()) if path.exists() else dict(mode='invite',pauseGeneration=False,pauseRendering=False)
assert value.get('mode') in ['invite','public'] and all(type(value.get(k)) is bool for k in ['pauseGeneration','pauseRendering']),'Invalid existing policy; inspect instead of overwriting'
if any([a.mode,a.pause_generation,a.pause_rendering]):
 if a.mode:value['mode']=a.mode
 for arg,key in [(a.pause_generation,'pauseGeneration'),(a.pause_rendering,'pauseRendering')]:
  if arg is not None:value[key]=arg=='yes'
 path.parent.mkdir(parents=True,exist_ok=True,mode=0o750)
 fd,name=tempfile.mkstemp(prefix='.annual-policy-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)
print(json.dumps(value))
