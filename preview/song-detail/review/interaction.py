"""Checks shared presentation and existing controls; fixtures never commit writes."""
import json,re
from urllib.parse import urlparse,parse_qs

def run(browser,root,out):
 checks=[];errors=[];warnings=[];requests=[];console=[]
 def open_context(state):
  context=browser.new_context(viewport={'width':414,'height':846},device_scale_factor=1,is_mobile=True,has_touch=True,reduced_motion='reduce',service_workers='block')
  context.add_cookies([{'name':'song_preview_state','value':state,'url':'http://127.0.0.1:3208'},{'name':'taiko_theme','value':'dark','url':'http://127.0.0.1:3208'}])
  page=context.new_page();page.set_default_timeout(15000)
  page.on('console',lambda m:console.append({'type':m.type,'text':m.text[:1000]}) if m.type in ['error','warning'] else None)
  page.on('pageerror',lambda e:errors.append(str(e)[:250]));page.on('console',lambda m:warnings.append(m.text[:250]) if 'Failed to resolve component' in m.text else None)
  page.on('request',lambda r:requests.append({'path':urlparse(r.url).path,'method':r.method,'url':r.url}) if urlparse(r.url).path.startswith('/api/') else None)
  return context,page
 context,page=open_context('scores')
 try:
  def visit(path):
   page.goto('http://127.0.0.1:3208'+path,wait_until='domcontentloaded',timeout=90000)
   page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false',timeout=90000)
  def shot(name):page.screenshot(path=str(out/'screenshots'/name))
  visit('/tools/recommend?previewState=scores')
  response=context.request.get('http://127.0.0.1:3208/tools/recommend')
  assert 'data-theme="dark"' in response.text() and re.search(r'<body[^>]+class="[^"]*theme-dark',response.text())
  checks.append('Dark cookie is present in SSR html and body before hydration; no client-only theme requirement')
  assert page.locator('.mode-tab').count()==2
  with page.expect_response(lambda r:urlparse(r.url).path=='/api/account/recommendation/tool') as pending:
   page.get_by_role('button',name='查看推荐',exact=True).click()
  batch=pending.value.json();page.get_by_test_id('ordinary-list').wait_for()
  pairs=page.get_by_test_id('ordinary-list').locator('article').evaluate_all('(es)=>es.map(e=>[Number(e.dataset.songId),Number(e.dataset.difficulty)])')
  assert pairs==[[item['songId'],item['level']] for item in batch['items']] and len(pairs)==20
  before=sum(r['path']=='/api/account/recommendation/tool' for r in requests)
  page.locator('.recommend-advanced summary').click();page.locator('.recommend-advanced summary').click()
  assert before==sum(r['path']=='/api/account/recommendation/tool' for r in requests)
  checks.append('20 complete recommendation rows preserve fixture order and source conditions; disclosure causes no request')
  page.locator('.recommend-advanced summary').click();page.locator('.advanced-fields .el-select').click()
  option=page.locator('.el-select-dropdown__item').filter(has_text=re.compile('^体力$'));option.wait_for()
  assert option.evaluate('(e)=>getComputedStyle(e.closest(".el-popper")).backgroundColor')!='rgb(255, 255, 255)'
  shot('interaction-dropdown-dark-414.png');option.click()
  assert '体力' in page.locator('.recommend-advanced summary').inner_text()
  page.get_by_text('同时生成图片',exact=True).click()
  assert page.get_by_role('checkbox',name='同时生成图片').is_checked()
  with page.expect_response(lambda r:urlparse(r.url).path=='/api/account/recommendation/tool') as pending:
   page.get_by_role('button',name='查看推荐',exact=True).click()
  query=parse_qs(urlparse(pending.value.url).query);data=pending.value.json()
  assert query['n']==['20'] and query['dim']==['体力'] and query['image']==['true']
  assert len(data['items'])==20 and data['image'].endswith('recommendations-20.svg')
  page.locator('.chart-image').wait_for();page.wait_for_function('document.querySelector(".chart-image").naturalWidth>0')
  assert sum(r['path']=='/api/account/recommendation/tool' for r in requests)==before+1
  checks.append('Count/dimension/image are one batch request; teleported dark select and configuration summary agree')
  row=page.locator('article[data-song-id="1455"][data-difficulty="5"]');row.locator('a').click();page.wait_for_url('**/songs/1455?**')
  assert parse_qs(urlparse(page.url).query)['difficulty']==['5']
  assert page.locator('[data-track=EDIT]').get_attribute('aria-selected')=='true'
  action=page.locator('.recommendation-goal-action');action.locator('button').first.click();dialog=page.locator('dialog[open]');dialog.wait_for()
  assert dialog.locator('input[value="played"]').count()==0
  assert dialog.evaluate('(e)=>getComputedStyle(e).backgroundColor')!='rgb(255, 255, 255)'
  shot('interaction-goal-dark-414.png')
  dialog.locator('.goal-actions button').first.click()
  assert action.locator('button').first.evaluate('(e)=>e===document.activeElement')
  action.locator('button').first.click();dialog.wait_for();dialog.locator('input[value="score-pb"]').check()
  with page.expect_response(lambda r:urlparse(r.url).path=='/api/account/growth/goal') as denied:dialog.locator('.goal-actions button').last.click()
  assert denied.value.status==405
  assert page.get_by_role('status').filter(has_text='目标已设定').count()==0
  checks.append('Recommendation → matching EDIT chart → original confirmation dialog; source retained, unplayed goal not enabled, write rejected')
  for key,folder in [('EASY','Kantan'),('NORMAL','Futsuu'),('HARD','Muzukashii'),('ONI','Oni'),('EDIT','InnerOni')]:
   page.locator(f'[data-track={key}]').click();assert f'/fumen/{folder}/1455.png' in page.locator('.chart-sheet img').get_attribute('src')
  page.locator('[data-track=ONI]').click();page.locator('.chart-excerpt-toggle').click();assert page.locator('.chart-sheet a').evaluate('(e)=>getComputedStyle(e).top')=='auto'
  page.locator('.chart-excerpt-toggle').click();assert page.locator('.chart-sheet a').evaluate('(e)=>getComputedStyle(e).top')=='-56px'
  page.locator('.score-details summary').click();assert page.locator('.score-meta').is_visible()
  widths=page.locator('.ugc-difficulty-choices .ugc-choice').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().width)')
  assert max(widths)-min(widths)<1
  checks.append('Real chart URLs, fixed notation excerpt/full expansion and score details retained; all five vote options equal width')
  page.locator('.mobile-nav-toggle').click();assert page.locator('.app-shell').evaluate('(e)=>e.classList.contains("mobile-nav-open")')
  assert page.locator('.locale-switcher a').count()==2
  page.locator('.mobile-nav-mask').click(position={'x':405,'y':160})
  assert page.locator('.mobile-tabbar__item').count()==5
  # Cross the same SPA shell: no previous detail class or stale overlay follows.
  page.locator('.mobile-tabbar__item').last.click();page.wait_for_url('**/more')
  assert page.locator('.song-detail-page').count()==0 and page.locator('.mobile-nav-mask').count()==0
  assert not page.evaluate('document.body.style.overflow')
  checks.append('Original menu, language switch, five bottom destinations and SPA exit retain no song-only class or scroll lock')
  visit('/account/profile?previewState=pending');page.locator('.pending-box').wait_for();script=(root/'taiko_viewer/pages/account/profile.vue').read_text()
  assert 'AbortController' in script
  field=page.locator('#binding-taiko-id');field.focus()
  page.evaluate('''()=>{window.__reviewHeight=visualViewport.height;Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight-300});visualViewport.dispatchEvent(new Event('resize'))}''')
  page.wait_for_function('document.querySelector(".mobile-tabbar")===null')
  field.evaluate('(e)=>e.blur()');page.evaluate('''()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))}''')
  page.locator('.mobile-tabbar').wait_for()
  with page.expect_response(lambda r:urlparse(r.url).path=='/api/account/bindings/confirm') as rejected:page.locator('.pending-box button').click()
  assert rejected.value.status==405
  page.locator('.el-message--error').wait_for();page.wait_for_function('!document.querySelector(".binding-card .is-loading")')
  assert page.locator('.el-message').evaluate('(e)=>getComputedStyle(e).backgroundColor')!='rgb(255, 255, 255)'
  shot('interaction-binding-error-dark-414.png')
  page.locator('.profile-more summary').click();assert page.locator('.meta-item--created').is_visible()
  page.locator('.manual-account-panel summary').click();assert page.locator('.manual-account-controls input').first.is_visible()
  checks.append('Pending verification and deliberate failure remain actionable; dark message, details and simulated soft-keyboard clearance checked')
  context.close();context,page=open_context('guest')
  visit('/tools/recommend?previewState=guest');page.locator('.tool-gate-alert').wait_for()
  assert page.locator('.ordinary-form').count()==0
  redirect=context.request.get('http://127.0.0.1:3208/account/profile',max_redirects=0)
  assert redirect.status in [301,302,303,307,308] and '/account/login' in redirect.headers['location']
  visit(redirect.headers['location']);assert page.locator('.auth-page input').count()>=2
  context.close();context,page=open_context('empty')
  visit('/tools/recommend?previewState=empty');page.get_by_role('button',name='查看推荐',exact=True).click();page.locator('.empty-state').wait_for();shot('interaction-recommend-empty-414.png')
  context.close();context,page=open_context('scores')
  visit('/songs/1?previewState=scores');assert page.locator('.difficulty-tab').count()==4
  visit('/songs/627?previewState=scores');page.locator('.song-audio summary').click();assert page.locator('.song-audio audio').count()==5
  checks.append('Guest gate, actual SSR login redirect response and login page mount, empty recommendation, no EDIT and branch audio render with real components; fixture identities use separate browser contexts')
  visit('/settings?previewState=scores');switch=page.locator('.setting-row .el-switch')
  switch.click();page.wait_for_function('document.documentElement.dataset.theme==="light"')
  assert next(c for c in context.cookies() if c['name']=='taiko_theme')['value']=='light'
  switch.click();page.wait_for_function('document.documentElement.dataset.theme==="dark"')
  assert next(c for c in context.cookies() if c['name']=='taiko_theme')['value']=='dark'
  page.reload(wait_until='domcontentloaded');page.wait_for_function('document.documentElement.dataset.theme==="dark"')
  checks.append('Existing theme switch updates cookie/localStorage and survives reload with dark SSR')
  legacy=browser.new_context(viewport={'width':414,'height':846},service_workers='block')
  try:
   legacy.add_init_script('localStorage.setItem("taiko_theme","dark")')
   legacy_page=legacy.new_page();legacy_page.goto('http://127.0.0.1:3208/settings?previewState=scores',wait_until='domcontentloaded',timeout=90000)
   legacy_page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false',timeout=90000)
   assert legacy_page.evaluate('document.documentElement.dataset.theme')=='dark'
   assert next(c for c in legacy.cookies() if c['name']=='taiko_theme')['value']=='dark'
  finally:legacy.close()
  checks.append('Legacy localStorage-only dark preference migrates to SSR cookie without being overwritten by a default cookie')
  visit('/__review');assert page.locator('.review-page nav a').count()>=12
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
  checks.append('Unified Nuxt review route links the real user pages')
  assert not errors,errors
  assert not warnings,warnings
  (out/'interaction-check.json').write_text(json.dumps({'checks':checks,'browserErrors':errors,'unresolvedComponents':warnings,'apiRequests':requests,'scope':'UI and local read-only fixture checks; synthetic goal preview allowed, all writes denied; keyboard test is simulated viewport, not a physical device.'},ensure_ascii=False,indent=2))
 except Exception:
  (out/'interaction-failure.json').write_text(json.dumps({'url':page.url,'errors':errors,'warnings':warnings,'requests':requests,'text':page.locator('body').inner_text()[:2200],'hydrating':page.evaluate('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating'),'console':console,'app':page.evaluate('()=>{let r=document.querySelector("#__nuxt"),a=r?.__vue_app__,c=document.querySelector(".auth-page")?.__vueParentComponent;return {rootAttrs:r?.getAttributeNames(),appKeys:a?Object.keys(a):null,mounted:a?._instance?.isMounted,component:c?{mounted:c.isMounted,name:c.type.__name}:null,scripts:[...document.scripts].map(s=>s.src).filter(Boolean)}}')},ensure_ascii=False,indent=2))
  page.screenshot(path=str(out/'interaction-failure.png'))
  raise
 finally:context.close()
