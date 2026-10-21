"""Bind this increment's source, identical inputs and bounded QA evidence."""
import hashlib,html,json,re,subprocess,tarfile
from pathlib import Path
from completion_output import review_output
root=Path(__file__).resolve().parents[3];out=review_output();base='86de23f311fc29328b7b7aae93a63bc764b9c125'
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1048576),b''):h.update(block)
 return h.hexdigest()
before=json.loads((out/'before-browser.json').read_text());after=json.loads((out/'after-browser.json').read_text());entry=json.loads((out/'review-entry-browser.json').read_text());unit=json.loads((out/'unit-tests.json').read_text());build=json.loads((out/'normal-build.json').read_text())
assert len(before['records'])==len(after['records'])==6 and len(after['checks'])==36 and len(entry['checks'])==1
assert unit['pass'] and unit['tests']==unit['passed']==170 and build['pass'] and not build['fixtureLoaded']
for data in [before,after,entry]:assert not data['errors'] and data['businessWrites']==0 and data['serverStopped']
key=lambda r:(r['page'],r['width'],r['theme'],r['locale']);lookup={key(r):r for r in after['records']}
for row in before['records']:assert row['inputSha256']==lookup[key(row)]['inputSha256'] and row['ids']==lookup[key(row)]['ids']
script=lambda s:re.search(r'<script setup[^>]*>(.*?)</script>',s,re.S).group(1)
for name in ['taiko_viewer/components/home/PlayerGrowthSurface.vue','taiko_viewer/pages/tools/recommend.vue','taiko_viewer/components/RecommendationGoalAction.vue']:
 assert script(git('show',base+':'+name))==script((root/name).read_text()),'business handler changed: '+name
name='taiko_viewer/pages/tools/recommend.vue';old=git('show',base+':'+name);new=(root/name).read_text();marker='        <div v-else>';assert old[old.index(marker):].rstrip()==new[new.index(marker):].rstrip(),'target tab changed'
unchanged=['taiko_viewer/server','packages','taiko_viewer/assets/css','taiko_viewer/layouts','taiko_viewer/composables','taiko_viewer/utils','taiko_viewer/types','scripts/deploy_forum_web.sh','scripts/memory','taiko_viewer/assets/data/title_song_relations.json','taiko_viewer/pages/my']
assert subprocess.run(['git','diff','--quiet',base,'--',*unchanged],cwd=root).returncode==0
for name in ['package.json','package-lock.json']:
 old=json.loads(git('show',base+':taiko_viewer/'+name));new=json.loads((root/'taiko_viewer'/name).read_text());old['version']=new['version']='VERSION'
 if name=='package-lock.json':old['packages']['']['version']=new['packages']['']['version']='VERSION'
 assert old==new,'dependencies changed'
files=set(git('diff','--name-only',base).splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
source={name:sha(root/name) for name in sorted(files) if name.startswith(('taiko_viewer/','preview/','.github/')) and (root/name).is_file()}
validation={'base':base,'sourceSha256':source,'sameInputPairs':6,'browserCases':6,'interactionChecks':36,'previewEntryChecks':1,'tests':170,'businessHandlersUnchanged':True,'targetTabUnchanged':True,'APIAndSourcesUnchanged':True,'sharedDesignUnchanged':True,'dependencyGraphUnchanged':True,'businessWrites':0,'productionBuild':build}
(out/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
sections=[]
for row in before['records']:
 sections.append('<section><h2>'+html.escape(' / '.join(map(str,key(row))))+'</h2><div class="pair">'+''.join('<figure><figcaption>'+stage+'</figcaption><img loading="lazy" src="'+r['screenshot']+'"></figure>' for stage,r in [('before',row),('after',lookup[key(row)])])+'</div></section>')
(out/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Viewer 0.87.4</title><style>body{font-family:system-ui;max-width:1200px;margin:auto;padding:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{width:100%;height:auto}</style><h1>首页批次 · 共享歌曲条目</h1><p>实际 Vue 与 Nuxt，六组同输入对照。170 项测试、36 项交互检查；写成功仅为隔离受控响应。</p>'+''.join(sections))
selected=['before-browser.json','after-browser.json','review-entry-browser.json','unit-tests.json','related-tests.log','normal-build.json','normal-build.log','contract-generate_bindings.log','contract-test_api_v1.log','validation.json','index.html','baseline-ref-failure.log','identity-debug.json']
selected+=sorted(str(p.relative_to(out)) for p in (out/'screenshots').glob('*.png'))
archive=out/'evidence.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for name in selected:assert (out/name).is_file(),name;tar.add(out/name,arcname=name,recursive=False)
manifest={'archive':archive.name,'sha256':sha(archive),'files':{name:sha(out/name) for name in selected},'validation':validation};(out/'evidence-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'archive':str(archive),'sha256':manifest['sha256'],'sourceFiles':len(source),'tests':170,'sameInputPairs':6,'interactionChecks':36}))
