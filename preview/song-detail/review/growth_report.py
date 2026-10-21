"""Bind source, inputs, captures and checks into a private exportable evidence set."""
import hashlib,html,json,subprocess,tarfile
from pathlib import Path
from completion_output import review_output
root=Path(__file__).resolve().parents[3];out=review_output();base='b6183b7c46b789e1eb2728760e7c1c91268747b6'
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as stream:
  for block in iter(lambda:stream.read(1048576),b''):h.update(block)
 return h.hexdigest()
before=json.loads((out/'before-browser.json').read_text());after=json.loads((out/'after-browser.json').read_text());unit=json.loads((out/'unit-tests.json').read_text());build=json.loads((out/'normal-build.json').read_text())
assert before['fixtureSha256']==after['fixtureSha256'];assert len(before['records'])==8 and len(after['records'])==24 and len(after['checks'])==42
extra=json.loads((out/'after-growth-growth-expanded-browser.json').read_text());assert len(extra['records'])==1 and len(extra['checks'])==2 and not extra['errors'] and not extra['writes'] and extra['serverStopped'];assert extra['checks'][1]['sha256']==after['records'][0]['inputSha256']
assert unit['pass'] and unit['tests']==unit['passed'] and build['pass'] and not build['fixtureLoaded']
for data in [before,after]:assert not data['errors'] and not data['writes'] and data['serverStopped'];assert all(not row['overflow'] for row in data['records'])
keys=lambda row:(row['page'],row['width'],row['theme'],row['locale'])
lookup={keys(row):row for row in after['records'] if row['state']=='scores'}
for row in before['records']:assert row['inputSha256']==lookup[keys(row)]['inputSha256']
unchanged=['taiko_viewer/server','packages','taiko_viewer/assets/css','taiko_viewer/layouts','taiko_viewer/utils/passportNarrative.ts','taiko_viewer/utils/passportPresentation.ts','taiko_viewer/utils/growthVoice.ts','taiko_viewer/types/player-growth.ts','taiko_viewer/composables/useViewerApiFetch.ts','taiko_viewer/composables/useAccountRequestGuard.ts','scripts/deploy_forum_web.sh','scripts/memory','taiko_viewer/assets/data/title_song_relations.json']
assert subprocess.run(['git','diff','--quiet',base,'--',*unchanged],cwd=root).returncode==0
for name in ['package.json','package-lock.json']:
 old=json.loads(subprocess.check_output(['git','show',base+':taiko_viewer/'+name],cwd=root));new=json.loads((root/'taiko_viewer'/name).read_text());old['version']=new['version']='VERSION'
 if name=='package-lock.json':old['packages']['']['version']=new['packages']['']['version']='VERSION'
 assert old==new,'dependency or package scope changed: '+name
files=set(git('diff','--name-only',base).splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
source={name:sha(root/name) for name in sorted(files) if name.startswith(('taiko_viewer/','preview/','.github/')) and (root/name).is_file()}
validation={'baseline':base,'sourceSha256':source,'fixtureSha256':before['fixtureSha256'],'extraFixtureSha256':extra['fixtureSha256'],'sameInputPairs':len(before['records']),'browserStates':len(after['records'])+len(extra['records']),'interactionChecks':len(after['checks'])+len(extra['checks']),'tests':unit['tests'],'productionBuild':build,'frozenHistoryAndBackendUnchanged':True,'sharedDesignAndContainersUnchanged':True,'dependencyGraphUnchanged':True,'businessWrites':0}
(out/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
pairs=[]
for row in before['records']:
 other=lookup[keys(row)];pairs.append('<section><h2>'+html.escape(' / '.join(map(str,keys(row))))+'</h2><div class="pair">'+''.join('<figure><figcaption>'+stage+'</figcaption><img loading="lazy" src="'+r['screenshot']+'"></figure>' for stage,r in [('before',row),('after',other)])+'</div></section>')
(out/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Viewer 0.87.3</title><style>body{font-family:system-ui;max-width:1200px;margin:auto;padding:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0}img{max-width:100%;height:auto}</style><h1>成长档案、周报与分页 · 同输入对照</h1><p>真实 Nuxt / Vue / SVG；25 个状态、44 项检查、'+str(unit['tests'])+' 项测试。真实业务写入 0。</p>'+''.join(pairs))
selected=['after-growth-growth-expanded-browser.json','before-browser.json','after-browser.json','unit-tests.json','related-tests.log','baseline-identity.log','normal-build.json','normal-build.log','contract-generate_bindings.log','contract-test_api_v1.log','validation.json','index.html','before-preview.log','after-preview.log']
selected += sorted(set(row['screenshot'] for data in [before,after,extra] for row in data['records']))
selected += sorted(str(p.relative_to(out)) for p in (out/'screenshots').glob('*identity-loading*.png'))
selected += ['screenshots/review-entry.png']
archive=out/'evidence.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for name in selected:
  path=out/name;assert path.is_file(),name;tar.add(path,arcname=name,recursive=False)
manifest={'archive':archive.name,'sha256':sha(archive),'files':{name:sha(out/name) for name in selected},'validation':validation}
(out/'evidence-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'archive':str(archive),'sha256':manifest['sha256'],'sourceFiles':len(source),'sameInputPairs':len(before['records']),'browserStates':len(after['records'])+len(extra['records']),'interactionChecks':len(after['checks'])+len(extra['checks']),'tests':unit['tests']}))
