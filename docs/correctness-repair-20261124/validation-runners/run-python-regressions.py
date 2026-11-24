import sys,os,importlib.util
from pathlib import Path
root=Path(sys.argv[1]);os.chdir(root)
sys.path.insert(0,str(root));sys.path.insert(0,str(root/'packages/taiko-application/src'))
# Test-only tooling is outside application and runtime installations.
tooling=Path('/home/sigaer/taiko/qa-vault/tooling/pytest-8.4.2-proxy')
os.environ['QA_TEST_TOOLS_ROOT']=str(tooling)
sys.path.insert(0,str(tooling/'lib/python3.11/site-packages'))
if '--source-core' in sys.argv:
 package=root/'packages/sakura-taiko-core/core'
 spec=importlib.util.spec_from_file_location('sakura_taiko_core',package/'__init__.py',submodule_search_locations=[str(package)])
 module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
import pytest
extra=['tests/offline/test_chart_timeline_golden.py'] if (root/'tests/offline/test_chart_timeline_golden.py').exists() else []
raise SystemExit(pytest.main(['-q','-p','no:cacheprovider','tests/offline/test_recommendation_intelligence.py','tests/offline/test_tja_roll_parser.py','tests/offline/test_target_recommend.py']+extra))
