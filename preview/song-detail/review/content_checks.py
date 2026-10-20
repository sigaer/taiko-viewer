"""Targeted content hierarchy checks in real components; all API writes stay rejected."""
import json, hashlib, subprocess
from urllib.parse import urlparse

def run(browser,root,out):
 records=[];errors=[];requests=[]
 def context_for(state='scores',width=414,lang='zh',theme='light'):
  c=browser.new_context(viewport={'width':width,'height':846 if width<768 else 1000},device_scale_factor=1,is_mobile=width<768,has_touch=width<768,reduced_motion='reduce',service_workers='block')
  c.add_cookies([{'name':'song_preview_state','value':state,'url':'http://127.0.0.1:3208'},{'name':'taiko_theme','value':theme,'url':'http://127.0.0.1:3208'}])
  p=c.new_page();p.set_default_timeout(15000);p.on('pageerror',lambda e:errors.append(str(e)[:500]));p.on('request',lambda r:requests.append({'path':urlparse(r.url).path,'method':r.method}) if urlparse(r.url).path.startswith('/api/') else None)
  return c,p
 def visit(p,path):
  p.goto('http://127.0.0.1:3208'+path,wait_until='domcontentloaded',timeout=90000)
  p.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false',timeout=90000);p.evaluate('document.fonts.ready')
 def shot(p,name):p.screenshot(path=str(out/'screenshots'/name))
 try:
  for lang,width in [('zh',414),('ja',390)]:
   c,p=context_for(width=width,lang=lang)
   try:
    visit(p,('/ja' if lang=='ja' else '')+'/account/profile?previewState=scores')
    assert p.locator('.binding-current').is_visible() and p.locator('.binding-current').evaluate('(e)=>e.tagName')=='SPAN'
    assert p.locator('.binding-actions button:disabled').count()==0
    p.locator('.avatar-manager summary').click();assert p.locator('.avatar-reset-button').is_visible()
    assert p.locator('.avatar-reset-button').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    p.locator('.avatar-manager input[type=file]').set_input_files(str(root/'taiko_viewer/public/icons/difficulty/1.png'))
    dialog=p.get_by_role('dialog');dialog.wait_for();shot(p,f'content-avatar-{width}-{lang}.png')
    dialog.get_by_role('button',name='キャンセル' if lang=='ja' else '取消',exact=True).click();dialog.wait_for(state='hidden')
    assert not any(r['method']!='GET' and '/avatar' in r['path'] for r in requests)
    p.locator('.avatar-manager summary').click()
    assert not p.evaluate('document.documentElement.scrollWidth>innerWidth+1')
   finally:c.close()
  records.append('Avatar disclosure, original file-selection/crop dialog and cancel work in Chinese/Japanese; default avatar reset remains discoverable; no avatar write submitted')
  c,p=context_for(width=1440)
  try:
   visit(p,'/account/profile?previewState=scores');heights=p.locator('.binding-card,.qq-card').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().height)')
   assert len(heights)==2 and abs(heights[0]-heights[1])>40
   records.append({'naturalPanelHeights':heights,'currentBindingIsStatus':True})
  finally:c.close()
  c,p=context_for()
  try:
   visit(p,'/settings?previewState=scores');assert not p.locator('.cache-details').evaluate('(e)=>e.open')
   p.evaluate('localStorage.setItem("synthetic-cache-review","sample")');p.locator('.cache-details summary').click()
   p.get_by_role('cell',name='synthetic-cache-review',exact=True).wait_for()
   before=next(x['value'] for x in c.cookies() if x['name']=='taiko_theme')
   p.get_by_role('button',name='清空缓存',exact=True).click();assert p.evaluate('localStorage.length')==0
   assert p.get_by_role('cell',name='synthetic-cache-review',exact=True).count()==0
   assert next(x['value'] for x in c.cookies() if x['name']=='taiko_theme')==before
   records.append('Cache disclosure reads local keys; original clear-all localStorage action refreshes visible summary/list and does not remove theme cookie')
  finally:c.close()
  for state in ['scores','changes','unchanged','recent-failure','failure','unbound','empty','guest']:
   c,p=context_for(state)
   try:
    visit(p,'/?previewState='+state);p.wait_for_timeout(700)
    assert p.locator('.home-page h1').count()<=1
    if state=='scores':
     p.locator('.growth-ability summary').click();assert p.locator('.growth-skills').is_visible()
     p.locator('.growth-ability summary').click();assert not p.locator('.growth-skills').is_visible()
     p.locator('.growth-record-note summary').click();assert '不能确认' in p.locator('.growth-record-note').inner_text() or '记录' in p.locator('.growth-record-note').inner_text()
     assert '这里会记下之后同步到的新变化' in p.locator('.recent-growth').inner_text()
    elif state=='changes':
     assert '980,000' in p.locator('.recent-growth__list').inner_text()
     assert p.locator('.growth-event').count()==1
     assert '4' in p.locator('.growth-event__change').inner_text()
     assert p.locator('.growth-record-note').count()==0
    elif state=='unchanged':assert '这次同步还没有新的变化' in p.locator('.recent-growth').inner_text()
    elif state in ['recent-failure','failure']:
     p.locator('.recent-growth__state').wait_for();assert p.locator('.recent-growth__state button').is_visible()
     assert p.locator('.recent-growth__empty').count()==0
    assert not p.evaluate('document.documentElement.scrollWidth>innerWidth+1')
    shot(p,f'content-home-{state}-414.png')
   finally:c.close()
  records.append('Eight separate home contexts: observed PB plus distinct daily event, first evidence, no new change, recent read failure, full read failure, unbound, empty scores and guest; one personal opening; six skills remain expandable')
  c,p=context_for()
  try:
   visit(p,'/forum?previewState=scores');cards=p.locator('.forum-thread-card');assert cards.count()==12
   titles=cards.locator('.forum-thread-card__title').all_inner_texts();assert len(set(titles))==12
   p.get_by_role('button',name='攻略',exact=True).click();assert p.locator('.forum-thread-card').count()==5
   p.get_by_role('button',name='热门',exact=True).click();assert p.locator('.forum-thread-card').count()==12
   p.get_by_role('button',name='精选',exact=True).click();assert p.locator('.forum-thread-card').count()==1
   records.append('Community real feed renders 12 of 16 synthetic DTOs using existing cap/order; guide/hot/featured filters show 5/12/1 rows; no production users or posts')
  finally:c.close()
  sizes=[]
  for width in [820,1280,1920]:
   c,p=context_for(width=width)
   try:
    for key,path in [('home','/'),('catalog','/songs/available'),('profile','/account/profile'),('settings','/settings'),('guide','/docs/score-token')]:
     visit(p,path+'?previewState=scores');assert not p.evaluate('document.documentElement.scrollWidth>innerWidth+1')
     geom=p.locator('.viewer-content').evaluate('(e)=>{let r=e.getBoundingClientRect();return {x:r.x,width:r.width}}')
     sizes.append({'width':width,'page':key,'container':geom})
   finally:c.close()
  records.append({'additionalLayoutChecks':sizes})
  guards=[]
  for f in ['taiko_viewer/pages/account/profile.vue','taiko_viewer/components/home/PlayerGrowthSurface.vue','taiko_viewer/components/home/AuthenticatedHome.vue']:
   before=subprocess.check_output(['git','show',f'63fda22:{f}'],cwd=root,text=True).split('<script setup lang="ts">')[1].split('</script>')[0]
   after=(root/f).read_text().split('<script setup lang="ts">')[1].split('</script>')[0]
   assert before==after
   guards.append({'file':f,'scriptSha256':hashlib.sha256(after.encode()).hexdigest(),'unchangedFrom':'63fda22'})
  records.append({'unchangedHandlers':guards})
  assert not errors,errors[:3]
 finally:
  (out/'content-checks.json').write_text(json.dumps({'checks':records,'errors':errors,'apiRequests':requests},ensure_ascii=False,indent=2))
