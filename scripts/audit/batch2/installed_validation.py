"""Run only installed domain/application/bot packages; source trees supply tests."""
import hashlib, importlib.metadata as metadata, json, os, runpy, subprocess, sys, unittest
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch2-20261124');BOT=BASE/'bot';OUT=BASE/'artifacts-center-rc'
mode=sys.argv[1]
os.environ['TAIKO_COMPUTE_ONLY']='1'
import sakura_taiko_core, sakura_taiko_contract, taiko_application, taiko_bot
modules=[sakura_taiko_core,sakura_taiko_contract,taiko_application,taiko_bot]
imports={x.__name__:x.__file__ for x in modules}
for path in imports.values():assert Path(path).is_relative_to(Path(sys.prefix)/'lib'),path
assert metadata.version('sakura-taiko-core')=='0.1.3rc1'
for p in (BASE/'core/core').rglob('*.py'):
    target=Path(sakura_taiko_core.__file__).parent/p.relative_to(BASE/'core/core')
    assert hashlib.sha256(p.read_bytes()).digest()==hashlib.sha256(target.read_bytes()).digest(),str(p)
print('INSTALLED_IMPORTS',json.dumps(imports),flush=True)
(OUT/'installed-imports.json').write_text(json.dumps({'qaRun':os.environ['QA_RUN_ID'],'imports':imports,'prefix':sys.prefix,'coreVersion':metadata.version('sakura-taiko-core'),'allCorePythonFilesMatchCommittedSource':True},indent=2)+'\n')
if mode=='contract':
    sys.argv=[str(BOT/'tests/correctness/run.py'),'--installed-core']
    runpy.run_path(sys.argv[0],run_name='__main__')
elif mode=='python':
    import pytest
    os.chdir(BOT)
    raise SystemExit(pytest.main(['-q','--import-mode=importlib','-p','no:cacheprovider',*[str(BOT/'tests/offline'/x) for x in ['test_recommendation_intelligence.py','test_tja_roll_parser.py','test_target_recommend.py','test_chart_timeline_golden.py']]]))
elif mode=='core-original':
    suite=unittest.defaultTestLoader.discover(str(BASE/'core/tests'),pattern='test_*.py')
    result=unittest.TextTestRunner(verbosity=1).run(suite)
    raise SystemExit(not result.wasSuccessful())
elif mode=='bridge':
    # The original bridge imports a source Core by default; explicitly select installed.
    sys.argv=[str(BOT/'tests/correctness/run.py'),'--installed-core']
    ns=runpy.run_path(sys.argv[0],run_name='bridge_helpers')
    node='/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node'
    resolver=(BASE/'integration/taiko_viewer/server/services/account/recommendation-dimensions.ts').as_uri()
    tokens=[*ns['ORDINARY_BASES'],'daigouryoku','大歌力']
    script=f"import {{resolveRecommendDim}} from {json.dumps(resolver)}; console.log(JSON.stringify({json.dumps(tokens)}.map(resolveRecommendDim)));"
    resolved=json.loads(subprocess.check_output([node,'--experimental-strip-types','--input-type=module','-e',script],text=True))
    from sakura_taiko_core.chart.availability import cn_available_chart_keys
    from taiko_application.query.recommendation import project_ordinary_recommendations
    from taiko_application.query.context import RecommendationContext
    merged=[dict(id=i,shelf_status=0,level_4=9,level_5=10) for i in range(1,24)]
    raw=[dict(id=i,shelf_status=0,level_4=9,level_5=0) for i in range(1,24)]
    merged[-1]['shelf_status']=1;available=cn_available_chart_keys(merged,raw)
    cfg={str(i):ns['chart'](i) for i in range(1,24)};cfg['ura']=ns['chart'](21,5)
    cases=[]
    for resolved_row in resolved:
        basis=resolved_row['dimKey']
        for profile in ['taiko_bot/offline/score_calculator.py','taiko_bot/runtime/player/center/recommendation_support/score_calculator.py','taiko_bot/runtime/player/client/recommendation_support/score_calculator.py']:
            case={'basis':basis,'profile':profile}
            try:
                rows=ns['adapter'](profile,{'load_cn_available_chart_keys':lambda *args:available})([ns['stats'](i) for i in range(1,21)],cfg,[(10,10)],basis,20)
                payload=project_ordinary_recommendations(RecommendationContext(rows=rows,basis=basis))
                assert payload['basis']==basis
                assert {(r['songId'],r['level']) for r in payload['items']}=={(21,4),(22,4)}
                case['result']='PASS'
            except Exception as e:case.update(result='FAIL',error=f'{type(e).__name__}: {e}')
            cases.append(case)
    (OUT/'bridge-cases.json').write_text(json.dumps({'qaRun':os.environ['QA_RUN_ID'],'imports':imports,'cases':cases},indent=2)+'\n')
    print(json.dumps({'cases':len(cases),'passed':sum(x['result']=='PASS' for x in cases),'failed':sum(x['result']=='FAIL' for x in cases)}))
    raise SystemExit(any(x['result']=='FAIL' for x in cases))
