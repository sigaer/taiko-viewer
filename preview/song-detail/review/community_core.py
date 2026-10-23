"""Actual Nuxt/Vue DOM with synthetic reads and controlled mutation transport."""
import base64,copy,json,os,signal,socket,subprocess,time,urllib.request,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright

signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';source=root/'taiko_viewer'
out=Path(os.environ['VIEWER_REVIEW_OUT']);out.mkdir(parents=True,exist_ok=True);(out/'screenshots').mkdir(exist_ok=True)
history=out/'core-attempts'/os.environ['QA_RUN_ID'];history.mkdir(parents=True,exist_ok=True)
for name in ['core-browser.json','core-preview.log']:
 previous=out/name
 if previous.exists():previous.rename(history/name)
node='/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node';base='http://127.0.0.1:3208'
for link,target in [(preview/'node_modules',source/'node_modules'),(source/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch()
env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1')
checks=[];screens=[];writes=[];errors=[];asset_errors=[];server=None;complete=False;start=time.monotonic()
def wait_for(predicate,page):
 for _ in range(80):
  if predicate():return
  page.wait_for_timeout(50)
 raise AssertionError('controlled transport readiness deadline')
try:
 with (out/'core-preview.log').open('w') as log:
  server=subprocess.Popen([node,str(source/'node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('Nuxt preview exited; see preview.log')
   try:
    with urllib.request.urlopen(base+'/api/forum/notifications',timeout=2) as response:seed=json.load(response)
    break
   except Exception:time.sleep(1)
  else:raise RuntimeError('Nuxt startup deadline')
  with urllib.request.urlopen(urllib.request.Request(base+'/api/forum/home',headers={'Cookie':'song_preview_state=community-core'}),timeout=10) as response:home_seed=json.load(response)
  with urllib.request.urlopen(urllib.request.Request(base+'/api/forum/threads?pageSize=30',headers={'Cookie':'song_preview_state=community-core'}),timeout=10) as response:all_rows=json.load(response)['items']
  with urllib.request.urlopen(urllib.request.Request(base+'/api/forum/threads/7200',headers={'Cookie':'song_preview_state=community-core'}),timeout=10) as response:detail_seed=json.load(response)
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for width,theme,lang in ([(1440,'light','zh')] if os.environ.get('CORE_VIEWPORT')=='desktop' else [(1440,'light','zh'),(390,'light','zh'),(414,'dark','ja')]):
     context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 896},is_mobile=width<720,has_touch=width<720,reduced_motion='reduce',service_workers='block')
     try:
      context.add_cookies([{'name':'song_preview_state','value':'community-core','url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
      page=context.new_page();page.set_default_timeout(18000);case_errors=[];page.on('pageerror',lambda error:case_errors.append(str(error)[:300]));prefix='/ja' if lang=='ja' else ''
      page.on('response',lambda response:asset_errors.append({'path':urllib.parse.urlparse(response.url).path,'status':response.status}) if response.status>=400 and (response.request.resource_type=='image' or '/_nuxt/' in response.url) else None)
      calls=[];pending=[];held=[];identity_id=1
      mode={'mine':'normal','list':'normal','home':'normal','detail':'normal','role':'user','locked':False,'auth':True}
      detail=copy.deepcopy(detail_seed)
      def answer(route,data,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
      def list_payload(q):
       rows=copy.deepcopy(all_rows)
       for key,predicate in [('sectionSlug',lambda x,v:x['section']['slug']==v),('keyword',lambda x,v:v in x['title']),('threadType',lambda x,v:x['threadType']==v),('songId',lambda x,v:str(x['song']['id'])==v),('difficultyType',lambda x,v:str(x['song']['difficultyType'])==v)]:
        if q.get(key):rows=[x for x in rows if predicate(x,q[key][0])]
       if q.get('scope')==['mine']:rows=[x for x in rows if x['author']['id']==identity_id]
       if mode['mine']=='empty' and q.get('scope')==['mine']:rows=[]
       sort=q.get('sort',['latest'])[0];rows.sort(key=lambda x:(x['likeCount'],x['id']) if sort=='hot' else (int(x['isFeatured']),x['id']) if sort=='featured' else (x['id'],),reverse=True)
       page_n=int(q.get('page',['1'])[0]);size=int(q.get('pageSize',['12'])[0]);return {'items':rows[(page_n-1)*size:page_n*size],'total':len(rows),'page':page_n,'pageSize':size,'sort':sort}
      def transport(route):
       path=urllib.parse.urlparse(route.request.url).path;q=urllib.parse.parse_qs(urllib.parse.urlparse(route.request.url).query);method=route.request.method
       if method not in ['GET','HEAD','OPTIONS']:
        writes.append({'level':'controlled browser transport','path':path,'method':method})
        if path=='/api/annual-beta/events':answer(route,{})
        elif path=='/api/account/auth/login':mode['auth']=True;answer(route,{'ok':True})
        else:pending.append(route)
       elif path=='/api/forum/home':
        if mode['home']=='failure':answer(route,{'statusCode':503,'statusMessage':'Synthetic home read failure'},503)
        else:answer(route,{**home_seed,'currentUser':{**home_seed['currentUser'],'id':identity_id,'role':mode['role']},'unreadNotificationCount':3 if identity_id==1 else 0})
       elif path=='/api/forum/threads':
        calls.append(q);read_mode=mode['mine'] if q.get('scope')==['mine'] else mode['list']
        if read_mode=='failure':answer(route,{'statusCode':503,'statusMessage':'Synthetic list read failure'},503)
        elif read_mode=='hold':held.append((route,list_payload(q)))
        else:answer(route,list_payload(q))
       elif path.startswith('/api/forum/threads/') and path.count('/')==4:
        if mode['detail']=='failure':answer(route,{'statusCode':503,'statusMessage':'Synthetic detail failure'},503)
        elif mode['detail']=='hold':held.append((route,copy.deepcopy(detail)))
        else:answer(route,{**detail,'isLocked':mode['locked']})
       elif path=='/api/account/auth/me':answer(route,{'authenticated':mode['auth'],'user':{'id':identity_id,'username':'Synthetic identity '+str(identity_id),'avatarUrl':'','emailVerified':True} if mode['auth'] else None})
       elif urllib.parse.urlparse(route.request.url).netloc!='127.0.0.1:3208':route.abort()
       else:route.continue_()
      context.route('**/*',transport)
      def ok(name):checks.append({'width':width,'theme':theme,'locale':lang,'check':name,'pass':True});print('PASS',width,name,flush=True)
      def hydrate(path):
       page.goto(base+prefix+path,wait_until='networkidle',timeout=60000);page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false')
      def nav(path):
       page.evaluate('(p)=>document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.push(p)',prefix+path);page.wait_for_timeout(180)
      def identity(id):
       page.evaluate('async(id)=>{document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["$saccount-user"]={id,username:"Synthetic identity "+id};await new Promise(requestAnimationFrame)}',id)
      def screenshot(name):
       original=page.evaluate('scrollY');height=page.evaluate('document.documentElement.scrollHeight')
       for position in range(0,min(height,12000),600):
        page.evaluate('(y)=>scrollTo(0,y)',position);page.wait_for_timeout(60)
       page.evaluate('(y)=>scrollTo(0,y)',original);page.wait_for_timeout(120)
       assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2'),name
       file=f'core-{name}-{width}-{theme}-{lang}.png';page.screenshot(path=str(out/'screenshots'/file),full_page=True);screens.append(file)
      # Real SSR normal inputs, then client-side filter / history transitions.
      hydrate('/forum');page.locator('.forum-thread-card').nth(11).wait_for();assert page.locator('.forum-thread-card__title').first.inner_text().startswith('Core 29');assert page.locator('.text-action').get_attribute('href').endswith('/forum/discussions');screenshot('home');ok('latest uses server list order and view-all enters complete route')
      for index,key in [(1,'hot'),(2,'guide'),(3,'featured')]:
       page.locator('.community-filter').nth(index).click();page.wait_for_function('(k)=>new URLSearchParams(location.search).get("filter")===k',arg=key)
       href=page.locator('.text-action').get_attribute('href');assert ('threadType=guide' if key=='guide' else 'sort='+key) in href
      page.go_back(wait_until='networkidle');page.wait_for_function('document.querySelectorAll(".community-filter")[2]?.getAttribute("aria-pressed")=="true"');page.go_forward(wait_until='networkidle');page.wait_for_function('document.querySelectorAll(".community-filter")[3]?.getAttribute("aria-pressed")=="true"');ok('home filter and full-list query survive browser back/forward')
      page.locator('.text-action').click();page.wait_for_url('**/forum/discussions?sort=featured');page.locator('.forum-thread-card').nth(11).wait_for();assert len(all_rows)==29;ok('view-all loads paginated full collection')
      nav('/forum/discussions?songId=1455&difficultyType=5');page.locator('.forum-thread-card').nth(11).wait_for();screenshot('discussions');n=len(calls);page.locator('.filter-trigger').click();page.locator('.filter-dialog__body input').first.fill('検索');page.wait_for_timeout(250);assert len(calls)==n and 'keyword=' not in page.url
      page.locator('.el-dialog__headerbtn').click();page.locator('.pager-panel__actions button').last.click();page.wait_for_function('new URLSearchParams(location.search).get("page")=="2"');assert 'keyword=' not in page.url;page.wait_for_function('document.querySelectorAll(".forum-thread-card").length===3');assert calls[-1]['difficultyType']==['5'];ok('unapplied search stays draft; paging keeps committed song/difficulty only')
      page.go_back(wait_until='networkidle');page.locator('.forum-thread-card').nth(11).wait_for();page.locator('.filter-trigger').click();page.locator('.filter-dialog__body input').first.fill('検索');page.locator('.filter-dialog__body button').last.click();page.wait_for_function('new URLSearchParams(location.search).has("keyword")');page.wait_for_function('document.querySelectorAll(".forum-thread-card").length===5');assert calls[-1]['keyword']==['検索'];page.go_back(wait_until='networkidle');page.locator('.forum-thread-card').nth(11).wait_for();ok('apply search commits URL once and history restores results')
      nav('/forum/section/score-guides');page.locator('.forum-thread-card').first.wait_for();assert all('score-guides' in a.get_attribute('href') for a in page.locator('.section-pill').all());screenshot('section');ok('section route scopes list and new-thread section')
      mode['list']='failure';nav('/forum/discussions?keyword=failure');page.locator('.thread-list-panel [role=alert]').wait_for();assert page.locator('.thread-list-panel .el-empty').count()==0;mode['list']='normal';page.locator('.thread-list-panel [role=alert] button').click();page.locator('.thread-list-panel .el-empty').wait_for();ok('list read failure is distinct from confirmed empty and retry exits loading')
      mode['mine']='failure';nav('/forum/me');page.locator('.forum-me-page [role=alert]').wait_for();assert page.locator('.forum-me-page .el-empty').count()==0;mode['mine']='empty';page.locator('.forum-me-page [role=alert] button').click();page.locator('.forum-me-page .el-empty').wait_for();ok('mine failure retries into confirmed empty without false zero summary')
      mode['mine']='normal';nav('/forum');nav('/forum/me');page.locator('.thread-stack .forum-thread-card').nth(9).wait_for();screenshot('me');page.locator('.me-pager button').last.click();page.wait_for_function('new URLSearchParams(location.search).get("page")=="2"');page.wait_for_function('document.querySelectorAll(".thread-stack .forum-thread-card").length===5');page.go_back(wait_until='networkidle');page.locator('.thread-stack .forum-thread-card').nth(9).wait_for();ok('mine actual total and paging retain URL/history')
      if width==1440:
       nav('/forum/me?page=9');page.wait_for_function('new URLSearchParams(location.search).get("page")==="2"');page.wait_for_function('document.querySelectorAll(".thread-stack .forum-thread-card").length===5');assert page.locator('.forum-me-page .el-empty').count()==0 and '2 / 2' in page.locator('.me-pager').inner_text();screenshot('pager-recovered');ok('out-of-range mine page replaces URL with real last page without false never-posted state')
       nav('/forum/discussions?songId=1455&difficultyType=5&page=9');page.wait_for_function('new URLSearchParams(location.search).get("page")==="2"');page.wait_for_function('document.querySelectorAll(".forum-thread-card").length===3');assert 'songId=1455' in page.url and 'difficultyType=5' in page.url;ok('out-of-range shared list corrects page and preserves song/difficulty query')
       nav('/forum/me');page.locator('.thread-stack .forum-thread-card').nth(9).wait_for()
      if width==1440:
       mode['mine']='hold' ;identity_id=2;identity(2);wait_for(lambda:len(held)==1,page);assert page.locator('.thread-stack .forum-thread-card').count()==0;assert page.locator('.forum-me-page [role=status]').count()>0;old,old_payload=held.pop();identity_id=1;identity(1);wait_for(lambda:len(held)==1,page);fresh,fresh_payload=held.pop();answer(fresh,fresh_payload);page.locator('.thread-stack .forum-thread-card').nth(9).wait_for();answer(old,old_payload);page.wait_for_timeout(180);assert page.locator('.thread-stack .forum-thread-card__title').first.inner_text()==fresh_payload['items'][0]['title'];mode['mine']='normal';ok('identity switch clears mine immediately and rejects late older success')
       mode['home']='failure';nav('/forum');nav('/forum/me');page.locator('.forum-me-page [role=alert]').wait_for();assert page.locator('.thread-stack .forum-thread-card').count()==10;mode['home']='normal';page.locator('.forum-me-page [role=alert] button').click();page.wait_for_function('document.querySelectorAll(".forum-me-page [role=alert]").length===0');ok('home failure does not clear valid mine results and recovers independently')
       assert page.locator('.moderation-panel').count()==0 and not any(q.get('includeHidden') for q in calls[-4:]);mode['role']='admin';nav('/forum');nav('/forum/me');page.locator('.moderation-item').first.wait_for();page.locator('.moderation-item__actions button').first.click();wait_for(lambda:len(pending)==1,page);page.locator('.moderation-item__actions button').first.dispatch_event('click');assert len(pending)==1;answer(pending.pop(),{'statusCode':403,'statusMessage':'Synthetic moderation denied'},403);page.wait_for_function('!document.querySelector(".moderation-item__actions button").disabled');page.locator('.moderation-item__actions button').nth(2).click();wait_for(lambda:len(pending)==1,page);answer(pending.pop(),{'ok':True});page.locator('.moderation-item__actions button').first.wait_for(state='visible');mode['role']='user';ok('staff-only controls serialize operations, display denial and recover')
      nav('/forum/thread/7200#reply-7302');page.locator('#reply-7302').wait_for();page.wait_for_function('document.activeElement?.id==="reply-7302"');assert page.locator('#reply-7302 .blocked-content-card').count()==1;assert 'Blocked reply secret' not in page.locator('#reply-7302').inner_text();page.locator('#reply-7302 .blocked-content-card button').click();page.get_by_text('Blocked reply secret',exact=True).wait_for();screenshot('thread');ok('reply hash focuses target and blocked content stays collapsed until revealed')
      page.locator('.thread-content .thread-image__trigger').first.click();page.locator('.forum-media-viewer').wait_for();page.wait_for_function('document.querySelector(".forum-media-viewer img")?.naturalWidth>0');page.keyboard.press('ArrowRight');page.keyboard.press('Tab');assert page.locator('.forum-media-viewer').is_visible();page.keyboard.press('Escape');page.locator('.forum-media-viewer').wait_for(state='hidden');assert page.evaluate('document.body.style.overflow')!='hidden';ok('image viewer keyboard navigation, focus and scroll unlock')
      page.locator('.thread-actions button').first.click();wait_for(lambda:len(pending)==1,page);page.locator('.thread-actions button').first.dispatch_event('click');assert len(pending)==1;answer(pending.pop(),{'statusCode':401,'statusMessage':'Synthetic sign-in required'},401);page.wait_for_function('!document.querySelector(".thread-actions button").classList.contains("is-loading")');page.locator('.thread-actions button').first.click();wait_for(lambda:len(pending)==1,page);answer(pending.pop(),{'liked':True,'likeCount':9});page.wait_for_function('document.querySelector(".thread-actions button")?.getAttribute("aria-pressed")==="true"');ok('thread like double click is serialized; authorization denial recovers')
      page.locator('.floor-card__actions button').first.click();wait_for(lambda:len(pending)==1,page);answer(pending.pop(),{'liked':True,'likeCount':2});page.wait_for_function('document.querySelector(".floor-card__actions button")?.getAttribute("aria-pressed")==="true"');ok('post like updates the selected floor only')
      page.locator('.floor-card__actions button').nth(1).click();draft=page.locator('.reply-box textarea');draft.fill('Editable failed reply');page.locator('.reply-box button.el-button--primary').click();wait_for(lambda:len(pending)==1,page);answer(pending.pop(),{'statusCode':503,'statusMessage':'Synthetic reply failure'},503);page.wait_for_function('!document.querySelector(".reply-box textarea").disabled');assert draft.input_value()=='Editable failed reply';draft.fill('Retry exact reply');page.locator('.reply-box button.el-button--primary').click();wait_for(lambda:len(pending)==1,page);reply=pending.pop();assert reply.request.post_data_json['bodyText']=='Retry exact reply' and reply.request.post_data_json['parentPostId']==7301;answer(reply,{**detail,'replyCount':2});page.wait_for_function('document.querySelector(".reply-box textarea")?.value===""');ok('failed reply remains editable and retry keeps exact text and parent')
      page.locator('.reply-box textarea').focus();tiny={'name':'synthetic.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSu8AAAAASUVORK5CYII=')};page.locator('.reply-box input[type=file]').set_input_files(tiny);wait_for(lambda:len(pending)==1,page);assert page.locator('.reply-box button.el-button--primary').is_disabled();answer(pending.pop(),{'imageUrl':'/miku.png'});page.locator('.reply-image-card').wait_for();ok('reply upload busy/completion keeps image and submit lifecycle')
      if width==1440:
       page.locator('.reply-box input[type=file]').set_input_files(tiny);wait_for(lambda:len(pending)==1,page);old=pending.pop();identity_id=2;identity(2);page.wait_for_timeout(200);answer(old,{'imageUrl':'/stale-upload.png'});page.wait_for_timeout(150);assert page.locator('.reply-image-card').count()==0;page.locator('.thread-actions button').first.click();wait_for(lambda:len(pending)==1,page);old=pending.pop();identity_id=1;identity(1);page.wait_for_timeout(200);answer(old,{'liked':True,'likeCount':12345});page.wait_for_timeout(150);assert '12345' not in page.locator('.thread-actions').inner_text();ok('late upload and like cannot cross identities or clear current state')
       mode['locked']=True;nav('/forum');nav('/forum/thread/7200');page.locator('.reply-box textarea').wait_for();assert page.locator('.reply-box textarea').is_disabled();mode['locked']=False;mode['detail']='failure';nav('/forum');nav('/forum/thread/7200');page.locator('.forum-thread-page [role=alert]').wait_for();mode['detail']='normal';page.locator('.forum-thread-page [role=alert] button').click();page.locator('.thread-content').wait_for();ok('locked thread prevents reply; detail failure is visible and retry recovers')
       page.locator('.thread-actions button').first.click();wait_for(lambda:len(pending)==1,page);old=pending.pop();nav('/forum');answer(old,{'liked':True,'likeCount':12345});nav('/forum/thread/7200');page.locator('.thread-content').wait_for();assert '12345' not in page.locator('.thread-actions').inner_text();ok('KeepAlive late mutation cannot overwrite refreshed thread')
      # Song linkage and guest compose/login return use existing real route handlers.
      hydrate('/songs/1455?difficulty=5');page.locator('.related-discussions').wait_for();href=page.locator('.related-discussions__head a').first.get_attribute('href');assert 'songId=1455' in href and 'difficultyType=5' in href;page.locator('.related-discussions__head a').first.click();page.wait_for_url('**/forum/discussions?*');assert 'difficultyType=5' in page.url;compose=page.locator('.section-hero__stats a');assert 'songId=1455' in compose.get_attribute('href') and 'difficulty=5' in compose.get_attribute('href');ok('song discussion entry keeps song and difficulty through full list and composer')
      if width==1440:
       mode['auth']=False;page.evaluate('()=>{const state=document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state;state["$saccount-user"]=null;state["$saccount-user-loaded"]=true}')
       compose.click();page.wait_for_function('location.pathname.endsWith("/account/login")');redirect=urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query)['redirect'][0];assert 'songId=1455' in redirect and 'difficulty=5' in redirect
       page.locator('.auth-card .el-form-item input').nth(0).fill('synthetic-author');page.locator('.auth-card .el-form-item input').nth(1).fill('synthetic-isolated-password');page.locator('.auth-card .el-button--primary').click();page.wait_for_function('location.pathname.endsWith("/forum/new")');page.locator('.composer-panel input[maxlength="120"]').fill('Synthetic core linked post');page.locator('.block-editor--body textarea').fill('Synthetic exact linked body');page.locator('.composer-submit button').click();wait_for(lambda:len(pending)==1,page);created=pending.pop();assert str(created.request.post_data_json['songId'])=='1455' and str(created.request.post_data_json['difficultyType'])=='5';answer(created,{'id':7200});page.wait_for_function('location.pathname.endsWith("/forum/thread/7200")');page.locator('.thread-content').wait_for();ok('guest login return preserves chart context through real composer and accepted post navigation')
       mode['mine']='hold';nav('/forum/me');wait_for(lambda:len(held)==1,page);old,_=held.pop();identity_id=2;identity(2);wait_for(lambda:len(held)==1,page);fresh,payload=held.pop();answer(fresh,payload);page.locator('.thread-stack .forum-thread-card').first.wait_for();answer(old,{'statusCode':503,'statusMessage':'Synthetic late old read failure'},503);page.wait_for_timeout(180);assert page.locator('.forum-me-page [role=alert]').count()==0;mode['mine']='normal';ok('late identity read failure does not replace current mine success')
      if width==1440:
       context.add_cookies([{'name':'song_preview_state','value':'community-core-mine-failure','url':base}]);mode['mine']='failure';hydrate('/forum/me');page.locator('.forum-me-page [role=alert]').wait_for();assert page.locator('.forum-me-page .el-empty').count()==0
       context.add_cookies([{'name':'song_preview_state','value':'community-core','url':base}]);mode['mine']='normal';page.locator('.forum-me-page [role=alert] button').click();page.locator('.thread-stack .forum-thread-card').first.wait_for();ok('SSR failed mine read survives hydration as failure and retries into normal')
      assert not case_errors,case_errors;errors+=case_errors
     finally:context.close()
   finally:browser.close()
  complete=True
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 with socket.socket() as probe:closed=probe.connect_ex(('127.0.0.1',3208))!=0
 (out/'core-browser.json').write_text(json.dumps({'pass':complete,'checks':checks,'screenshots':screens,'errors':errors,'assetErrors':asset_errors,'controlledWrites':writes,'realBusinessWrites':0,'serverStopped':not server or server.poll() is not None,'listenerClosed':closed,'seconds':round(time.monotonic()-start,2)},ensure_ascii=False,indent=2)+'\n')
 assert closed
print(json.dumps({'pass':True,'checks':len(checks),'screenshots':len(screens),'realBusinessWrites':0}))
