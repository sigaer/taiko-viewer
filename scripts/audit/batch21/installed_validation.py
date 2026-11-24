"""Acceptance against installed wheels. Source checkouts supply tests only."""
import hashlib,importlib,importlib.metadata as md,json,os,runpy,subprocess,sys,unittest
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');BOT=BASE/'bot';OUT=BASE/'release-candidate-rc9'
os.environ.update(TAIKO_COMPUTE_ONLY='1',TAIKO_CATALOG_ROOT=str(BASE/'catalog'))
import sakura_taiko_core,sakura_taiko_contract,taiko_application,taiko_bot,taiko_store
modules=[sakura_taiko_core,sakura_taiko_contract,taiko_application,taiko_bot,taiko_store]
imports={module.__name__:module.__file__ for module in modules}
for path in imports.values():assert Path(path).is_relative_to(Path(sys.prefix)/'lib'),path
assert md.version('sakura-taiko-core')=='0.1.4rc2'
assert md.version('taiko-application')=='0.10.0rc2'
assert md.version('taiko-bot')=='0.27.0rc9'
for source,module in [(BASE/'core/core',sakura_taiko_core),(BOT/'taiko_bot',taiko_bot),(BOT/'taiko_store',taiko_store),(BOT/'packages/taiko-application/src/taiko_application',taiko_application)]:
 for path in source.rglob('*.py'):
  target=Path(module.__file__).parent/path.relative_to(source)
  assert hashlib.sha256(path.read_bytes()).digest()==hashlib.sha256(target.read_bytes()).digest(),str(path)
report={'qaRun':os.environ['QA_RUN_ID'],'prefix':sys.prefix,'imports':imports,'sourceFilesMatchArtifacts':True,
 'versions':{name:md.version(name) for name in ['sakura-taiko-core','sakura-taiko-contract','taiko-application','taiko-bot']}}
(OUT/'installed-imports.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
mode=sys.argv[1]
if mode=='contract':
 sys.argv=[str(BOT/'tests/correctness/run.py'),'--installed-core'];runpy.run_path(sys.argv[0],run_name='__main__')
elif mode=='python':
 import pytest
 os.chdir(BOT)
 raise SystemExit(pytest.main(['-q','--import-mode=importlib','-p','no:cacheprovider',*[str(BOT/'tests/offline'/name) for name in ['test_recommendation_intelligence.py','test_tja_roll_parser.py','test_target_recommend.py','test_chart_timeline_golden.py']]]))
elif mode in ('core-original','authority'):
 directory=BASE/'core/tests' if mode=='core-original' else BOT/'tests/catalog'
 suite=unittest.defaultTestLoader.discover(str(directory),pattern='test_*.py')
 result=unittest.TextTestRunner(verbosity=1).run(suite);raise SystemExit(not result.wasSuccessful())
elif mode=='bridge':
 from sakura_taiko_core.models.calculation import SongStats
 from taiko_application.recommendation_dimensions import ORDINARY_BASES
 from taiko_application.query.context import RecommendationContext
 from taiko_application.query.recommendation import project_ordinary_recommendations
 from taiko_bot.catalog.builder import build
 from taiko_bot.catalog.storage import install,activate
 from taiko_bot.catalog.reader import capture
 root=Path(os.environ['QA_RUN_TMPDIR'])/'bridge';root.mkdir()
 for name in ['TAIKO_OFFLINE_ROOT','TAIKO_CENTER_ROOT','TAIKO_RUNTIME_ROOT','TAIKO_BOT_ROOT']:os.environ[name]=str(root)
 os.environ['TAIKO_CONFIG_PATH']=str(root/'absent-config.json');os.environ['TAIKO_USERDATA_DIR']=str(root/'userdata')
 os.environ['TAIKO_CATALOG_ROOT']=str(root/'catalog');os.environ.pop('TAIKO_CATALOG_REVISION',None)
 metadata=[dict(id=i,song_name=f'Chart {i}',song_name_jp=f'Chart {i}',type='南梦宫原创音乐',shelf_status=0,
   **{f'level_{d}':9 if d==4 else 0 for d in range(1,6)}) for i in range(1,24)]
 authority={'manifest':{'complete':True,'source':'https://wl-taiko.wahlap.net/api/user/all/songs','fetchedAt':'2026-11-24T00:00:00Z'},
   'sourceRevision':'synthetic-bridge','byId':{row['id']:row for row in metadata[:-1]}}
 snapshot=build(authority,metadata,model_keys={'ordinary':{(i,4) for i in range(1,23)}})
 install(root/'catalog',snapshot);activate(root/'catalog',snapshot['catalogRevision'])
 import nonebot
 nonebot.init(driver='~fastapi',taiko_song_profile='center',taiko_song_public_root=str(root))
 profile_paths=['taiko_bot.offline.score_calculator','taiko_bot.runtime.player.center.recommendation_support.score_calculator','taiko_bot.runtime.player.client.recommendation_support.score_calculator']
 hosts=[importlib.import_module(name) for name in profile_paths]
 smoke=['taiko_bot.runtime.player.client.b30_support.score_calculator','taiko_bot.runtime.player.center.b30_support.score_calculator','taiko_bot.runtime.player.client.b30_support.b30_single','taiko_bot.runtime.player.client.b30_support.song_visibility','taiko_bot.runtime.player.client.display_support.song_visibility','taiko_store.merge_reference']
 for name in smoke:
  module=importlib.import_module(name)
  assert Path(module.__file__).is_relative_to(Path(sys.prefix)/'lib')
  if hasattr(module,'load_song_index'):assert len(module.load_song_index())==23
 from taiko_bot.public_catalog_cache import revision
 assert revision(root/'songs/song_data.json')[1]==snapshot['catalogRevision']
 from taiko_bot.runtime.public.provider import position
 assert len(position(1).categories)==1
 assert not position(23).categories

 from unittest.mock import patch
 from taiko_bot.runtime.public import catalog_provider
 model=[dict(id=i,level=4,score=8,combo=100) for i in (1,23)]
 for profile in ['center','client']:
  with patch.object(catalog_provider,'_load_rating_entries',return_value=model),patch.object(catalog_provider,'profile',return_value=profile):
   assert {row.song_id for row in catalog_provider.query_charts_by_const(8)}=={1}
   assert {row.song_id for row in catalog_provider.query_charts_by_const(8,include_shelf_status=True)}=={1,23}
 records=[dict(song_no=i,level=4,ok_cnt=1,ng_cnt=0,dondaful_combo_cnt=0,full_combo_cnt=0) for i in (1,23)]
 for name in ['taiko_bot.runtime.player.center.display_support.metric','taiko_bot.runtime.player.client.display_support.metric']:
  module=importlib.import_module(name)
  assert {row['song_no'] for row in module._collect_song_metric_matches(records,'ok',1)}=={1}


 for module in hosts:assert Path(module.__file__).is_relative_to(Path(sys.prefix)/'lib')
 tokens=[*ORDINARY_BASES,'daigouryoku','大歌力']
 node='/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node'
 resolver=(BASE/'viewer/taiko_viewer/server/services/account/recommendation-dimensions.ts').as_uri()
 script=f"import {{resolveRecommendDim}} from {json.dumps(resolver)}; console.log(JSON.stringify({json.dumps(tokens)}.map(resolveRecommendDim)));"
 resolved=json.loads(subprocess.check_output([node,'--experimental-strip-types','--input-type=module','-e',script],text=True))
 cfg={str(i):dict(id=i,level=4,song_name=f'Chart {i}',score=10,combo=100,**{'复合处理':10,'平均密度':10,'瞬间密度':10,'叩き分け':10,'BPM变化':0}) for i in range(1,24)}
 stats=[SongStats(title=f'Chart {i}',song_id=i,level=4,rating=10,daigouryoku=10,stamina=10,speed=10,accuracy_power=10,rhythm=10,complex=10,great=50,good=0,bad=50) for i in range(1,21)]
 cases=[]
 for token,resolution in zip(tokens,resolved):
  basis=resolution['dimKey']
  for module in hosts:
   case={'input':token,'basis':basis,'profile':module.__name__,'importPath':module.__file__}
   try:
    rows=module.recommend_songs(stats,cfg,[(10,10)],basis,20)
    view=capture();payload=project_ordinary_recommendations(RecommendationContext(rows=rows,basis=basis,catalog_revision=view.revision,policy_version=view.policy_version))
    assert {(r['songId'],r['level']) for r in payload['items']}=={(21,4),(22,4)}
    assert payload['basis']==basis and payload['catalogRevision']==snapshot['catalogRevision']
    case.update(result='PASS',catalogRevision=view.revision,policyVersion=view.policy_version)
   except Exception as error:case.update(result='FAIL',error=f'{type(error).__name__}: {error}')
   cases.append(case)
 (OUT/'bridge-cases.json').write_text(json.dumps({'qaRun':os.environ['QA_RUN_ID'],'actualInstalledHostFunctions':True,'imports':imports,'cases':cases},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'cases':len(cases),'passed':sum(c['result']=='PASS' for c in cases),'failures':[c for c in cases if c['result']=='FAIL']}),flush=True)
 raise SystemExit(any(c['result']=='FAIL' for c in cases))
