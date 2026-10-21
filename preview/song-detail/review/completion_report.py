from completion_output import review_output
"""Create a repository review report from this run's saved evidence."""
import hashlib,html,json,re
from pathlib import Path
root=Path(__file__).resolve().parents[3];out=review_output()
def read(name):return json.loads((out/name).read_text())
before,after,unit,scope,controls=map(read,['before-browser.json','after-browser.json','unit-tests.json','scope.json','controls.json'])
assert len(before['cases'])==len(after['cases'])==16
assert before['fixtureSha256']==after['fixtureSha256']
assert not before['pageErrors'] and not after['pageErrors'] and not after['apiWrites']
assert before['ownedServerStopped'] and after['ownedServerStopped']
extra=read('goal-relocated-browser.json')
assert len(extra['cases'])==2 and not extra['pageErrors'] and not extra['apiWrites']
assert unit['pass'] and scope['pass'] and controls['pass']
for name,sha in scope['sourceSha256'].items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==sha,name
css=(root/'taiko_viewer/assets/css/tokens.css').read_text();light=css.split('html[data-theme="dark"]')[0];dark=css.split('html[data-theme="dark"]')[1]
roles=['bg','surface','surface-subtle','surface-hover','border','control-border','text','text-muted','text-disabled','link','selected','primary','primary-hover','on-primary','primary-surface','success','success-surface','warning','warning-surface','error','error-surface','info','info-surface']
values={theme:{key:re.search(r'--viewer-'+key+r':\s*([^;]+)',body).group(1).strip() for key in roles} for theme,body in [('light',light),('dark',dark)]}
def lum(s):
 s=s.lstrip('#');s=''.join(c*2 for c in s) if len(s)==3 else s
 c=[int(s[n:n+2],16)/255 for n in [0,2,4]];c=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c]
 return sum(a*b for a,b in zip(c,[.2126,.7152,.0722]))
def ratio(a,b):
 x,y=sorted([lum(a),lum(b)]);return (y+.05)/(x+.05)
contrasts=[]
for theme,v in values.items():
 for fg in ['text','text-muted','link','primary']:
  for bg in ['bg','surface','surface-subtle','selected']:contrasts.append({'theme':theme,'fg':fg,'bg':bg,'ratio':round(ratio(v[fg],v[bg]),3)})
 for fg,bg in [('on-primary','primary'),*[(k,k+'-surface') for k in ['success','warning','error','info']]]:contrasts.append({'theme':theme,'fg':fg,'bg':bg,'ratio':round(ratio(v[fg],v[bg]),3)})
assert min(r['ratio'] for r in contrasts)>=4.5
summary={'version':'0.87.1','base':scope['base'],'sourceSha256':scope['sourceSha256'],'fixtureSha256':after['fixtureSha256'],'unit':unit,'pairedConditions':16,'extraGoalRelocatedConditions':2,'controlConditions':len(controls['cases']),'pageErrors':0,'fixtureApiWrites':0,'semantics':{'goalOptions':'Missing field and server empty array are distinct; both retain song navigation. POST service validation remains unchanged.','recent':'observedAt is an observation/sync receive time, never a play date.','daily':'Use the existing calendarDay/attendance/events and server-attributed play day only.','count':'Use original uniqueCharts, including undisplayed charts; do not recalculate or coerce null to zero.','deduplication':'Only rendered Daily facts can claim a Recent record: matching profile/binding, chart difficulty, attributed day, canonical source/version, evidence revision and change values; explicit snapshot kind and per-fact occurrence must not conflict. Existing completed-goal presentation priority remains unchanged.','unavailable':'Loading/failed/unknown modules do not claim another module’s valid records. Recent read failures do not imply sync-job failure.'},'palette':values,'contrastPairs':contrasts,'minimumContrast':min(r['ratio'] for r in contrasts),'scope':'Four existing supplements only; 47 other Vue files have color-only style changes; no backend, Contract, dependency or container changes.','productionBuild':'Existing GitHub Actions normal application build and controlled deployment build are required after this source review. Local fixture backend is visual QA only; no fixture 405 response is treated as business validation.','sourceRuns':{'unit':unit['run'],'before':'qa-951677cdc347','after':after.get('run'),'goalRelocated':extra.get('run'),'controls':'qa-1f3187b57d75','scope':'See scope.json; scope verification rerun after final placeholder markup.'}}
(out/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
style='body{max-width:1280px;margin:24px auto;padding:0 20px;font:16px/1.6 system-ui;color:#203f43;background:#eaf6f5}a{color:#006c76}table{width:100%;border-collapse:collapse}td,th{padding:9px;text-align:left;border-bottom:1px solid #ccdfdc;vertical-align:top}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{max-width:100%;height:auto}figure{margin:0}code{overflow-wrap:anywhere}summary{cursor:pointer;padding:10px 0}@media(max-width:700px){.pair{grid-template-columns:1fr}}'
body='<h1>Viewer 0.87.1 首批设计补齐</h1><p>基线 e827d9c / 0.87.0。复用原工作区已评审增量；本报告为最终候选源码验证，PR、合并 SHA 与运行产物由发布记录补充。</p><p>本轮实际运行：'+str(unit['passed'])+' 项单测通过，16 组同数据前后对照，2 组 Element Plus 浅暗控件检查，页面错误与 fixture API 写入均为 0。截图为模拟视口。</p>'
body+='<table><tr><th>补充</th><th>实际文件</th><th>最终行为</th><th>证据</th></tr>'
for label,files,meaning,evidence in [
 ('A 目标选项',['components/home/PlayerGrowthSurface.vue'],'缺失、空数组、可用选项分别呈现；歌曲浏览保留，创建入口遵守服务端选项与原 POST 校验。','after-browser.json'),
 ('B 最新歌曲',['components/home/HomeLatestSongs.vue'],'原排序前 5 首；五张占位复用封面比例及文字区域；桌面单行，手机横滑，查看全部保留。','after-browser.json'),
 ('C 今日进展',['components/home/DailyProgress.vue','utils/homeGrowthFeedback.ts','tests/homeGrowthFeedback.test.ts'],'紧凑标题、日期、原始数量、歌曲/难度与具体变化同组；区分已变化、仅游玩、无记录、未知、加载与失败。','unit-tests.json'),
 ('D 淡青色',['assets/css/tokens.css','assets/css/main.css','nuxt.config.ts'],'迁入既有浅暗主题和控件映射；其余 47 个 Vue 文件仅配色；1000/1180/800 与手机 20px 不变。','scope.json')]:
 body+='<tr><td>'+label+'</td><td>'+''.join('<a href="../../taiko_viewer/'+f+'"><code>'+f+'</code></a><br>' for f in files)+'</td><td>'+meaning+'</td><td><a href="'+evidence+'">本次记录</a></td></tr>'
body+='</table><h2>数据语义</h2><p>原「暂时还不能选择」由 <code>!item.goalOptions?.length</code> 触发，合并了 DTO 字段缺失和服务端空选项。服务端 account/growth.ts 生成 goalOptions；goals/service.ts 创建时再次校验。响应未提供具体原因码，不根据曲名、星级或成绩猜原因。</p><p>近期使用观测窗口；今日沿用服务端实际游玩时间归属，数量取原 uniqueCharts。不同难度、变化值、证据 revision 不按曲名或 songId 合并。加载或失败的今日/目标模块不得隐藏近期唯一有效记录，近期读取失败保留今日记录；读取失败不写成同步任务失败。</p>'
body+='<h2>同数据、同视口前后对照</h2>'
for b,a in zip(before['cases'],after['cases']):
 assert all(b[k]==a[k] for k in ['width','theme','locale','state'])
 label=f"{a['state']} · {a['width']} · {a['theme']} · {a['locale']}"
 body+='<details'+(' open' if a['state']=='changes' and a['width']==1440 else '')+'><summary>'+label+'</summary><div class="pair">'
 for stage,row in [('修改前',b),('修改后',a)]:body+='<figure><figcaption>'+stage+'</figcaption><a href="'+row['screenshot']+'"><img loading="lazy" src="'+row['screenshot']+'"></a></figure>'
 body+='</div><p>最新歌曲：<a href="'+b['screenshot'].replace('.png','-latest.png')+'">前</a> · <a href="'+a['screenshot'].replace('.png','-latest.png')+'">后</a></p></details>'
body+='<h2>目标承接变化与仅游玩共存回归</h2><p>中日文真实 SFC 单测及手机/桌面检查：目标卡承接成绩变化后，今日仍保留另一张仅游玩谱面，并准确提示变化已记在上面。</p>'+''.join('<p><a href="'+r['screenshot']+'">'+r['locale']+' · '+str(r['width'])+'</a></p>' for r in extra['cases'])
body+='<h2>实际语义色</h2><table><tr><th>--viewer-</th><th>浅色</th><th>暗色</th></tr>'+''.join('<tr><td>'+key+'</td><td>'+values['light'][key]+'</td><td>'+values['dark'][key]+'</td></tr>' for key in roles)+'</table><p>本次重新计算 '+str(len(contrasts))+' 个正文、次级文字、链接、操作及状态色对，最低 '+str(summary['minimumContrast'])+':1；禁用控件单列，不作整站 WCAG 认证结论。</p>'
body+='<p>独立后台、年度演出/导出、播放器媒体画布、历史段位表内联业务色及社区自定义版块 accent 保留既有例外，本轮不扩展第二批页面。</p><p><a href="validation.json">源码与验证总记录</a> · <a href="controls.json">控件实际样式</a> · <a href="screenshots/controls-1440-light.png">浅色控件</a> · <a href="screenshots/controls-390-dark.png">暗色控件</a></p>'
(out/'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Viewer 0.87.1 补齐验证</title><style>'+style+'</style>'+body+'</html>')
print(json.dumps({'pass':True,'tests':unit['passed'],'pairedConditions':16,'controls':len(controls['cases']),'contrastPairs':len(contrasts),'minimumContrast':summary['minimumContrast']}))
