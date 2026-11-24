"""Development checks only; final acceptance uses freshly installed artifacts."""
import importlib.util,os,runpy,sys,unittest
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124')
sys.path.insert(0,str(BASE/'bot'))
sys.path.insert(0,str(BASE/'bot/packages/taiko-application/src'))
spec=importlib.util.spec_from_file_location('sakura_taiko_core',BASE/'core/core/__init__.py',submodule_search_locations=[str(BASE/'core/core')])
module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
os.environ['TAIKO_CATALOG_ROOT']=str(BASE/'catalog');os.environ['TAIKO_COMPUTE_ONLY']='1'
if sys.argv[1]=='core':
 suite=unittest.defaultTestLoader.discover(str(BASE/'core/tests'),pattern='test_*.py')
 result=unittest.TextTestRunner(verbosity=1).run(suite);raise SystemExit(not result.wasSuccessful())
sys.argv=[str(BASE/'bot/tests/correctness/run.py'),'--installed-core'];runpy.run_path(sys.argv[0],run_name='__main__')
