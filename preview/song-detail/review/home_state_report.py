"""Bind final code, same-input screenshots and bounded validation evidence."""
import hashlib,json,subprocess,tarfile
from pathlib import Path
from completion_output import review_output
root=Path(__file__).resolve().parents[3];out=review_output();base='81635515ac055a18ff02ec402662d201137069e0'
def read(name):return json.loads((out/name).read_text())
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1048576),b''):h.update(block)
 return h.hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
before,after=read('before-browser.json'),read('after-browser.json')
auth_before,auth_after=read('before-auth-browser.json'),read('after-auth-browser.json');mobile=read('after-my-browser.json')
assert len(before['records'])==len(after['records'])==6 and len(auth_before['records'])==len(auth_after['records'])==2
before['records']+=auth_before['records'];after['records']+=auth_after['records']
key=lambda row:(row['page'],row.get('scenario','normal'),row['width'],row['theme'],row['locale'])
pairs={key(row):row for row in before['records']};assert len(pairs)==len(after['records'])==8
for row in after['records']:assert row['inputSha256']==pairs[key(row)]['inputSha256'],key(row)
assert after['checks'] and not after['errors'] and after['listenerClosed'] and after['serverStopped'] and after['businessWrites']==0
for result in [auth_before,auth_after,mobile]:assert not result['errors'] and result['listenerClosed'] and result['businessWrites']==0
checks={}
for row in after['checks']+auth_after['checks']+mobile['checks']:checks[(row.get('page'),row.get('width'),row.get('locale'),row['check'])]=row
unit,build=read('unit-tests.json'),read('normal-build.json');assert unit['pass']
if not build['pass']:
 assert build['exitCode']==1 and 'Insufficient headroom for bounded build' in (out/'normal-build.log').read_text()
 build={**build,'status':'admission-deferred','compilationStarted':False,'fixtureLoaded':None}
entry=read('review-entry-browser.json');assert entry['checks'] and not entry['errors']
unchanged=['taiko_viewer/components/RecommendationSongItem.vue','taiko_viewer/components/RecommendationGoalAction.vue','taiko_viewer/pages/tools/recommend.vue','taiko_viewer/components/my-taiko/Overview.vue','taiko_viewer/server','taiko_viewer/types','taiko_viewer/utils/homeGrowthFeedback.ts','taiko_viewer/utils/homeState.ts','taiko_viewer/utils/goalEvaluation.ts','taiko_viewer/pages/account/login.vue','taiko_viewer/pages/account/profile.vue','taiko_viewer/pages/account/sync.vue','taiko_viewer/layouts','taiko_viewer/components/MobileTabBar.vue','taiko_viewer/components/SidebarNav.vue','taiko_viewer/assets','packages/sakura-taiko-contract']
assert not git('diff','--name-only',base,'--',*unchanged),'business or shared foundation changed'
path='taiko_viewer/components/home/PlayerGrowthSurface.vue';old=git('show',base+':'+path);new=(root/path).read_text();script=lambda text:text.split('<script setup lang="ts">',1)[1].split('</script>',1)[0]
assert script(new).replace('  overviewRefreshing?: boolean;\n  overviewRefreshFailed?: boolean;\n','')==script(old),'goal handlers changed'
package=json.loads((root/'taiko_viewer/package.json').read_text());lock=json.loads((root/'taiko_viewer/package-lock.json').read_text());assert package['version']==lock['version']==lock['packages']['']['version']=='0.87.5'
old_package=json.loads(git('show',base+':taiko_viewer/package.json'));package.pop('version');old_package.pop('version');assert package==old_package
old_lock=json.loads(git('show',base+':taiko_viewer/package-lock.json'));lock.pop('version');old_lock.pop('version');lock['packages'][''].pop('version');old_lock['packages'][''].pop('version');assert lock==old_lock
files=set(git('diff','--name-only',base).splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
source={name:sha(root/name) for name in sorted(files) if name.startswith(('taiko_viewer/','preview/','.github/'))}
validation={'base':base,'sourceSha256':source,'sameInputPairs':8,'normalInputPairs':6,'authFailurePairs':2,'browserCases':len(after['records']),'interactionChecks':len(checks),'previewEntryChecks':len(entry['checks']),'tests':unit['tests'],'goalHandlersUnchanged':True,'sharedSongRowsUnchanged':True,'myTaikoAdmissionUnchanged':True,'APIContractAndFactsUnchanged':True,'sharedThemeContainersAndNavigationUnchanged':True,'dependencyGraphUnchanged':True,'businessWrites':0,'controlledWriteLevels':['isolated real Vue/component transport','isolated Playwright route transport','local fixture ack without persistence'],'controlledWriteRecords':len(after['controlledWrites']),'productionBuild':build,'automaticDeploymentAudit':{'repositoryWorkflows':'CI and existing tag-only GitHub release publication; no host deployment job','localGitHooks':'sample hooks only','hostServicesTimersCron':'no matching automatic deployment trigger found','externalRepositoryHooks':'administration endpoint unavailable to current GitHub connection; GET rejected as unsupported'}}
(out/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
html='<!doctype html><meta charset="utf-8"><title>Viewer 0.87.5</title><style>body{font-family:system-ui;max-width:1200px;margin:auto;padding:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{width:100%;height:auto}</style><h1>首页状态与 My Taiko</h1><p>六组正常与两组认证失败的同输入真实 Nuxt 对照；'+str(unit['tests'])+' 项测试，'+str(len(checks))+' 项浏览器检查。真实业务写入 0。</p>'
for row in after['records']:
 previous=pairs[key(row)];html+='<section><h2>'+str(row['page'])+' / '+row.get('scenario','normal')+' / '+str(row['width'])+' / '+row['theme']+' / '+row['locale']+'</h2><div class="pair">'
 for stage,item in [('before',previous),('after',row)]:html+='<figure><figcaption>'+stage+'</figcaption><img loading="lazy" src="'+item['screenshot']+'"></figure>'
 html+='</div></section>'
(out/'index.html').write_text(html)
names=['before-auth-browser.json','after-auth-browser.json','after-my-browser.json','baseline-reproduction.json','before-browser.json','after-browser.json','review-entry-browser.json','unit-tests.json','related-tests.log','contract-generate_bindings.log','contract-test_api_v1.log','normal-build.json','normal-build.log','baseline-regressions.log','validation.json','index.html']
artifacts=[out/name for name in names]+sorted((out/'screenshots').glob('*.png'))
with tarfile.open(out/'evidence.tar.gz','w:gz') as archive:
 for path in artifacts:assert path.is_file() and not path.is_symlink();archive.add(path,arcname=str(path.relative_to(out)),recursive=False)
manifest={'archive':'evidence.tar.gz','sha256':sha(out/'evidence.tar.gz'),'validation':validation,'files':{str(path.relative_to(out)):sha(path) for path in artifacts}}
(out/'evidence-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'sameInputPairs':8,'normalInputPairs':6,'authFailurePairs':2,'tests':unit['tests'],'interactionChecks':len(checks),'sourceFiles':len(source),'evidenceSha256':manifest['sha256']}))
