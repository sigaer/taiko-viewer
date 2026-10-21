"""Compact source-to-evidence manifest; raw assets remain outside Git."""
import hashlib,html,json,subprocess,tarfile
from pathlib import Path
from completion_output import review_output
root=Path(__file__).resolve().parents[3];out=review_output()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1048576),b''):h.update(block)
 return h.hexdigest()
before=json.loads((out/'before-browser.json').read_text());after=json.loads((out/'after-browser.json').read_text());unit=json.loads((out/'unit-tests.json').read_text());build=json.loads((out/'normal-build.json').read_text())
partial=out/'after-scores-browser.json'
if partial.exists() and partial.stat().st_mtime > (out/'after-browser.json').stat().st_mtime:
 recheck=json.loads(partial.read_text());assert len(recheck['records'])==8 and not recheck['errors'] and not recheck['writes'] and recheck['serverStopped'] and recheck['fixtureSha256']==after['fixtureSha256']
 after['records']=recheck['records']+[r for r in after['records'] if r['page']!='scores']
assert len(before['records'])==10 and len(after['records'])==24
assert before['fixtureSha256']==after['fixtureSha256']
assert before['errors']==['Must be called at the top of a `setup` function']
assert not after['errors'] and not after['writes'] and unit['pass'] and build['pass']
assert before['serverStopped'] and after['serverStopped']
changed=subprocess.check_output(['git','diff','--name-only','ad260fd','--'],cwd=root,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines()
sources={name:sha(root/name) for name in sorted(set(changed)) if not name.startswith('docs/') and (root/name).is_file()}
summary={'baseline':'ad260fdde09d408da7b692e6aa8c4262f093adeb','version':'0.87.2','sourceSha256':sources,'fixtureSha256':after['fixtureSha256'],'pairedConditions':9,'baselineCases':10,'finalCases':24,'tests':unit['tests'],'interactionChecks':sum(len(r.get('checks',[]))+len(r.get('mobileChecks',[])) for r in after['records']),'browserErrors':0,'businessWrites':0,'checks':[{k:r[k] for k in ['page','width','state','checks','mobileChecks'] if k in r} for r in after['records'] if 'checks' in r or 'mobileChecks' in r]}
(out/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Viewer 第二批 UI 对照</title><style>body{max-width:1300px;margin:32px auto;padding:0 20px;font:15px/1.6 sans-serif;background:#eaf6f5;color:#234247}a{color:#176e75}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{max-width:100%;height:auto}figure{margin:0}summary{cursor:pointer;padding:14px 0}</style><h1>Viewer 第二批 UI · 0.87.2</h1>','<p>真实 Nuxt 页面，隔离合成 GET 与固定图样。9 组同输入前后，24 个最终状态样本；'+str(unit['tests'])+' 项相关测试通过，正常业务生产构建通过。真实业务写入 0。</p>']
for key,title in [('scores','成绩'),('b30','B30'),('progress','进度')]:
 parts.append(f'<section id="{key}"><h2>{title}</h2>')
 for width,theme,lang in [(1440,'light','zh'),(390,'light','zh'),(414,'dark','ja')]:
  parts.append(f'<details><summary>{width} · {theme} · {lang}</summary><div class="pair">')
  for stage in ['before','after']:
   name=f'{stage}-{key}-{width}-{theme}-{lang}-scores.png';assert (out/'screenshots'/name).exists();parts.append(f'<figure><figcaption>{stage}</figcaption><a href="screenshots/{name}"><img loading="lazy" src="screenshots/{name}" alt="{title} {stage}"></a></figure>')
  parts.append('</div></details>')
 parts.append('<ul>')
 for row in after['records']:
  if row['page']==key and row['state']!='scores':parts.append(f'<li><a href="{row["screenshot"]}">{html.escape(row["state"])} · {row["width"]} · {row["locale"]}</a></li>')
 parts.append('</ul></section>')
parts.append('<p>进度历史错误已在冻结 main 复现；失败后 loading 退出、页面内重试恢复，详见 <a href="after-browser.json">浏览器记录</a>、<a href="unit-tests.json">测试</a>及 <a href="validation.json">源码校验</a>。</p></html>');(out/'index.html').write_text('\n'.join(parts))
files=[p for p in out.rglob('*') if p.is_file() and p.name not in ['evidence.tar.gz','evidence-manifest.json'] and not p.name.startswith(('online-','candidate-')) and 'rollback' not in str(p)]
archive=out/'evidence.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for path in sorted(files):tar.add(path,arcname=str(path.relative_to(out)),recursive=False)
manifest={'archive':archive.name,'sha256':sha(archive),'files':{str(p.relative_to(out)):sha(p) for p in sorted(files)},'validation':summary}
(out/'evidence-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'archive':archive.name,'sha256':manifest['sha256'],'files':len(files),'tests':unit['tests'],'pairedConditions':9,'finalCases':24}))
