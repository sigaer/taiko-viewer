"""Validate a scratch-only patch overlay on actual center Core 0.1.1."""
import os,sys,shutil,runpy,importlib.util,subprocess
from pathlib import Path
root=Path(sys.argv[1]);scratch=Path(os.environ['QA_RUN_TMPDIR'])
installed=Path(importlib.util.find_spec('sakura_taiko_core').origin).parent
copy=scratch/'sakura_taiko_core';shutil.copytree(installed,copy,ignore=shutil.ignore_patterns('__pycache__'))
patch=(root/'docs/correctness-repair-20261124/core-center-backport.patch').read_bytes()
subprocess.run(['git','apply','--unsafe-paths','-p4','-'],input=patch,cwd=copy,check=True)
sys.path.insert(0,str(scratch));sys.argv=[str(root/'tests/correctness/run.py'),'--installed-core']
try:
 runpy.run_path(sys.argv[0],run_name='__main__')
except SystemExit as result:
 if result.code: raise
sys.argv=['run-python-regressions.py',str(root)]
runpy.run_path('/var/tmp/taiko-correctness-20261124/run-python-regressions.py',run_name='__main__')
