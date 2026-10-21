"""Intercepted synthetic mutations exercise existing handlers without any backend write."""
import json

def run(page,context,key,width,lang,base,out):
 checks=[];prefix='/ja' if lang=='ja' else '';pending=[]
 def ok(name):checks.append({'page':key,'width':width,'locale':lang,'check':name,'pass':True})
 def prepare():
  if key=='recommend' and page.get_by_test_id('ordinary-list').count()==0:page.get_by_role('button',name='推薦を表示' if lang=='ja' else '查看推荐',exact=True).click();page.get_by_test_id('ordinary-list').wait_for()
  return page.locator('.growth-plan .growth-plan__choice' if key=='home' else '[data-testid=ordinary-list] article').first
 row=prepare();row.locator('a.song-row__song, a.target-item__song').click();page.wait_for_url('**/songs/1455?*');assert 'difficulty=5' in page.url
 assert ('recommendation=synthetic-shared-song-1455-5' in page.url)==(key=='recommend');ok('song-navigation-difficulty-and-source-credential')
 page.go_back(wait_until='networkidle');row=prepare();original=page.url
 preview={'profileId':'1','scoreRevision':'synthetic-review-r1','songId':1455,'difficultyType':5,'title':'ハッピーシンセサイザ ～長い曲名でも最後まで読める、今日の練習と次の目標～','starLevel':10,'goalOptions':['score-pb','fc'],'activeGoal':None}
 if key=='recommend':
  page.route('**/api/account/growth/goal/preview',lambda route:pending.append(route));row.locator('[data-song-action], .recommendation-goal-action > button').click();page.wait_for_timeout(120);assert len(pending)==1;assert row.locator('[data-song-action], .recommendation-goal-action > button').is_disabled();assert row.locator('[data-song-action], .recommendation-goal-action > button').get_attribute('aria-busy')=='true';assert page.url==original
  pending.pop().fulfill(status=503,content_type='application/json',body=json.dumps({'statusCode':503,'message':'Synthetic preview failure'}));page.wait_for_timeout(150);row.locator('[role=alert]').wait_for();assert row.locator('[data-song-action], .recommendation-goal-action > button').is_enabled();ok('preview-busy-failure-retry-keeps-song-browsable')
  row.locator('[data-song-action], .recommendation-goal-action > button').click();page.wait_for_timeout(120);pending.pop().fulfill(status=200,content_type='application/json',body=json.dumps(preview))
 else:row.locator('[data-song-action], .recommendation-goal-action > button').click()
 dialog=page.locator('dialog[open]');dialog.wait_for();assert page.url==original;assert '10★' in dialog.inner_text() or key=='home';dialog.locator('input[value=fc]').check();ok('goal-dialog-opens-without-song-navigation')
 page.route('**/api/account/growth/goal',lambda route:pending.append(route));dialog.locator('.goal-actions button').last.click();page.wait_for_timeout(150);assert len(pending)==1;assert row.locator('[data-song-action], .recommendation-goal-action > button').is_disabled();assert row.locator('a.song-row__song, a.target-item__song').get_attribute('href')
 request=pending.pop();body=request.request.post_data_json;assert body['songId']==1455 and body['difficultyType']==5 and body['goalType']=='fc'
 if key=='recommend':assert body['source']=='ordinary-recommendation' and body['recommendationToken']=='synthetic-shared-song-1455-5'
 page.screenshot(path=str(out/f'screenshots/{key}-busy-{width}-{lang}.png'));request.fulfill(status=409 if key=='recommend' else 503,content_type='application/json',body=json.dumps({'statusCode':409 if key=='recommend' else 503,'message':'Synthetic controlled save failure'}));page.wait_for_timeout(180)
 if key=='home':
  assert dialog.count()==1;assert row.locator('[data-song-action], .recommendation-goal-action > button').is_enabled();assert page.locator('.goal-error').count()>0
  page.screenshot(path=str(out/f'screenshots/{key}-failure-{width}-{lang}.png'))
  dialog.locator('.goal-actions button').last.click();page.wait_for_timeout(120);request=pending.pop();goal={**preview,'id':'synthetic-selected','status':'active','goalType':'fc','unavailable':False,'baseline':{'highScore':980000,'ngCnt':1,'bestScoreRank':5}}
  request.fulfill(status=200,content_type='application/json',body=json.dumps({'profileId':'1','activeGoal':goal}));page.wait_for_timeout(160);assert page.locator('dialog[open]').count()==0;assert row.locator('[data-song-action], .recommendation-goal-action > button').inner_text()==('選択済み' if lang=='ja' else '已选择') or ('已选' in row.locator('[data-song-action], .recommendation-goal-action > button').inner_text() if lang=='zh' else '選' in row.locator('[data-song-action], .recommendation-goal-action > button').inner_text());ok('home-save-busy-failure-recovery-and-selected-state')
 else:
  assert page.locator('dialog[open]').count()==0;assert row.locator('[role=alert]').count()==1;assert row.locator('[data-song-action], .recommendation-goal-action > button').is_disabled();ok('ordinary-conflict-invalidates-goal-intent-keeps-navigation')
  # The real API identity broadcast removes the old recommendation result.
  page.evaluate('document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["$saccount-binding-generation"]++');page.wait_for_timeout(150);assert page.get_by_test_id('ordinary-list').count()==0;row=prepare();row.locator('[data-song-action], .recommendation-goal-action > button').click();page.wait_for_timeout(100);pending.pop().fulfill(status=200,content_type='application/json',body=json.dumps(preview));
  try:page.locator('dialog[open]').wait_for()
  except Exception:
   debug=row.locator('.recommendation-goal-action').evaluate('(e)=>{const s=e.__vueParentComponent.setupState;return {busy:s.busy,invalid:s.invalid,failed:s.failed,stale:s.stale,preview:s.preview,unmounted:e.__vueParentComponent.isUnmounted,scope:e.__vueParentComponent.scope.active,dialogConnected:s.dialog?.isConnected,dialogOpen:s.dialog?.open,html:e.innerHTML.slice(0,1600),text:e.innerText}}');(out/'identity-debug.json').write_text(json.dumps(debug,ensure_ascii=False,indent=2));page.screenshot(path=str(out/'identity-debug.png'));raise
  page.locator('dialog[open] input[value=fc]').check();page.locator('dialog[open] .goal-actions button').last.click();page.wait_for_timeout(100);pending.pop().fulfill(status=200,content_type='application/json',body=json.dumps({'profileId':'1'}));page.wait_for_timeout(160);assert row.locator('[role=status]').count()==1;assert row.locator('[data-song-action], .recommendation-goal-action > button').count()==0;ok('ordinary-identity-refresh-and-controlled-save-success')
 page.screenshot(path=str(out/f'screenshots/{key}-selected-{width}-{lang}.png'));assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
 page.unroute('**/api/account/growth/goal');page.unroute('**/api/account/growth/goal/preview');ok('controlled-responses-only-no-backend-write')
 return checks
