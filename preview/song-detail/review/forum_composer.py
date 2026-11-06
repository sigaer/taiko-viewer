"""Actual Nuxt/Vue DOM with synthetic reads and controlled mutation transport."""
import base64,copy,json,os,signal,socket,subprocess,time,urllib.request,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright

signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';source=root/'taiko_viewer'
out=Path(os.environ['QA_EVIDENCE_DIR']);out.mkdir(parents=True,exist_ok=True);(out/'screenshots').mkdir(exist_ok=True)
history=out/'core-attempts'/os.environ['QA_RUN_ID'];history.mkdir(parents=True,exist_ok=True)
for name in ['composer-browser.json','composer-preview.log']:
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
 with (out/'composer-preview.log').open('w') as log:
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
      hydrate('/forum/new?section=general')
      body=page.locator('.block-editor--body textarea');body.wait_for()
      assert page.locator('.composer-panel h1').count()==1
      assert page.locator('.mobile-page-navigation').count()==0
      assert not page.locator('.more-options').evaluate('(e)=>e.open')
      if width<961:
       assert not page.locator('.composer-title').is_visible()
       assert body.bounding_box()['y'] < 240
      else:assert page.locator('.composer-title').is_visible()
      assert page.locator('.block-editor--attachments').bounding_box()['y'] > body.bounding_box()['y']
      assert page.locator('.more-options').bounding_box()['y'] > page.locator('.block-editor--attachments').bounding_box()['y']
      body.fill('初めての全良！' if lang=='ja' else '终于全良了！')
      screenshot('composer')
      page.locator('.more-options summary').click()
      page.locator('.type-chips button').nth(1).click()
      assert page.locator('.type-chips button').nth(1).get_attribute('aria-pressed')=='true'
      page.locator('.composer-grid--compact .el-select').click()
      page.locator('.el-select-dropdown__item').first.click()
      screenshot('composer-options')
      if width<961:
       page.set_viewport_size({'width':width,'height':420});body.focus()
       button=page.locator('.composer-panel__head > button')
       button.scroll_into_view_if_needed()
       box=button.bounding_box();assert box['y']>=0 and box['y']+box['height']<=420
       assert box['height']>=44
       page.set_viewport_size({'width':width,'height':896})
      page.locator('.composer-panel__head > button').click();wait_for(lambda:len(pending)==1,page)
      created=pending.pop();payload=created.request.post_data_json
      assert payload['title']=='' and payload['locale']==lang and payload['threadType']=='guide'
      answer(created,{'id':7200});page.wait_for_function('location.pathname.endsWith("/forum/thread/7200")')
      ok('content-first composer, collapsed settings, responsive title, reduced viewport, title-free publication and detail navigation')
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
 (out/'composer-browser.json').write_text(json.dumps({'pass':complete,'checks':checks,'screenshots':screens,'errors':errors,'assetErrors':asset_errors,'controlledWrites':writes,'realBusinessWrites':0,'serverStopped':not server or server.poll() is not None,'listenerClosed':closed,'seconds':round(time.monotonic()-start,2)},ensure_ascii=False,indent=2)+'\n')
 assert closed
print(json.dumps({'pass':True,'checks':len(checks),'screenshots':len(screens),'realBusinessWrites':0}))
