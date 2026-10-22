"""Actual Nuxt/Vue DOM with synthetic reads and controlled mutation transport."""
import base64,copy,json,os,signal,socket,subprocess,time,urllib.request,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright

signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';source=root/'taiko_viewer'
out=Path(os.environ['VIEWER_REVIEW_OUT']);out.mkdir(parents=True,exist_ok=True);(out/'screenshots').mkdir(exist_ok=True)
history=out/'browser-attempts'/os.environ['QA_RUN_ID'];history.mkdir(parents=True,exist_ok=True)
for name in ['browser.json','preview.log']:
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
 with (out/'preview.log').open('w') as log:
  server=subprocess.Popen([node,str(source/'node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('Nuxt preview exited; see preview.log')
   try:
    with urllib.request.urlopen(base+'/api/forum/notifications',timeout=2) as response:seed=json.load(response)
    break
   except Exception:time.sleep(1)
  else:raise RuntimeError('Nuxt startup deadline')
  with urllib.request.urlopen(base+'/api/forum/home',timeout=10) as response:home_seed=json.load(response)
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for width,theme,lang in [(1440,'light','zh'),(390,'light','zh'),(414,'dark','ja')]:
     context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 896},is_mobile=width<720,has_touch=width<720,reduced_motion='reduce',service_workers='block')
     try:
      context.add_cookies([{'name':'song_preview_state','value':'scores','url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
      page=context.new_page();page.set_default_timeout(18000);case_errors=[];page.on('pageerror',lambda error:case_errors.append(str(error)[:300]));prefix='/ja' if lang=='ja' else ''
      page.on('response',lambda response:asset_errors.append({'path':urllib.parse.urlparse(response.url).path,'status':response.status}) if response.status>=400 and (response.request.resource_type=='image' or '/_nuxt/' in response.url) else None)
      rows=copy.deepcopy(seed['items'])
      with urllib.request.urlopen(base+'/api/forum/notifications?page=2',timeout=5) as response:rows+=json.load(response)['items']
      mode={'read':'normal','write':'hold'};pending=[];read_pending=[];post_pending=[];upload_pending=[]
      def payload(request):
       q=urllib.parse.parse_qs(urllib.parse.urlparse(request.url).query);n=int(q.get('page',['1'])[0]);ordered=sorted(rows,key=lambda item:(item['isRead'],-item['id']));items=[] if mode['read']=='empty' else ordered
       return {'page':n,'pageSize':20,'total':len(items),'unreadCount':sum(not r['isRead'] for r in items),'items':items[(n-1)*20:n*20]}
      def answer(route,data,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
      def transport(route):
       path=urllib.parse.urlparse(route.request.url).path;method=route.request.method
       if method not in ['GET','HEAD','OPTIONS']:
        writes.append({'level':'isolated browser controlled transport','path':path,'method':method})
        if path=='/api/forum/notifications/read':pending.append(route)
        elif path=='/api/forum/threads':post_pending.append(route)
        elif path=='/api/forum/media/images':upload_pending.append(route)
        elif path=='/api/annual-beta/events':answer(route,{})
        else:route.abort();raise AssertionError('uncontrolled preview mutation '+path)
       elif path=='/api/forum/notifications':
        if mode['read']=='hold':read_pending.append(route)
        elif mode['read']=='failure':answer(route,{'statusCode':503,'statusMessage':'Synthetic notification read failure'},503)
        else:answer(route,payload(route.request))
       elif path=='/api/forum/home':answer(route,{**home_seed,'unreadNotificationCount':sum(not row['isRead'] for row in rows)})
       elif urllib.parse.urlparse(route.request.url).netloc not in ['127.0.0.1:3208','localhost:3208']:route.abort()
       else:route.continue_()
      context.route('**/*',transport)
      def ok(name):checks.append({'width':width,'theme':theme,'locale':lang,'check':name,'pass':True})
      def hydrate(path):
       page.goto(base+prefix+path,wait_until='networkidle',timeout=60000);page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false')
      def nav(path):
       page.evaluate('(p)=>document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.push(p)',prefix+path);page.wait_for_timeout(150)
      def freeze_navigation():page.evaluate('()=>{window.__communityAllow?.();window.__communityAllow=document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.beforeEach(to=>to.path.includes("/forum/thread/")?false:undefined)}')
      def allow_navigation():page.evaluate('()=>{window.__communityAllow?.();window.__communityAllow=null}')
      def identity(id):page.evaluate('async(id)=>{document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["$saccount-user"]={id,username:"Synthetic identity "+id};await new Promise(requestAnimationFrame)}',id)
      def screenshot(name):
       assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2'),name
       file=f'{name}-{width}-{theme}-{lang}.png';page.screenshot(path=str(out/'screenshots'/file),full_page=True);screens.append(file)
      hydrate('/forum/notifications');page.locator('.notification-card').nth(19).wait_for();assert page.locator('.notification-card').count()==20;assert '1 / 2' in page.locator('.notification-pager').inner_text() or '1 / 2' in page.locator('.notification-pager').inner_text().replace('第 ','')
      screenshot('notifications-normal');page.locator('.notification-pager button').last.click();page.wait_for_function('document.querySelectorAll(".notification-card").length===3');page.locator('.notification-pager button').first.click();page.locator('.notification-card').nth(19).wait_for();ok('23 notifications paginate 20 plus 3 and return')
      mode['read']='failure';nav('/my');nav('/forum/notifications');page.locator('.notification-error').wait_for();assert page.locator('.el-empty').count()==0;mode['read']='empty';page.locator('.notification-error button').click();page.locator('.el-empty').wait_for();assert page.locator('.notification-error').count()==0;ok('actual failed read and retry distinguish confirmed empty')
      mode['read']='normal';nav('/my');nav('/forum/notifications');page.locator('.notification-card').nth(19).wait_for();freeze_navigation()
      page.locator('.notification-card').first.click();wait_for(lambda:len(pending)==1,page);page.locator('.notification-card').first.dispatch_event('click');assert page.locator('.notification-head button').is_disabled();assert len(pending)==1
      answer(pending.pop(),{'statusCode':503,'statusMessage':'Synthetic mark read failure'},503);page.wait_for_function('document.querySelector(".notification-card")?.getAttribute("aria-disabled")!=="true"');assert page.locator('.notification-card.unread').count()==20;ok('single read and mark-all share actual DOM lock; failed mark stays unread')
      page.locator('.notification-card').first.click();wait_for(lambda:len(pending)==1,page);route=pending.pop();ids=route.request.post_data_json['ids'];rows[:]=[{**row,'isRead':True} if row['id'] in ids else row for row in rows];answer(route,{'unreadCount':sum(not row['isRead'] for row in rows)});page.wait_for_function('document.querySelector(".notification-card")?.getAttribute("aria-disabled")!=="true"');assert '/forum/notifications' in page.url;assert page.locator('.notification-head button').is_enabled();ok('successful mark is retained after real router navigation cancellation')
      page.locator('.notification-head button').click();wait_for(lambda:len(pending)==1,page);page.locator('.notification-head button').dispatch_event('click');assert len(pending)==1;rows[:]=[{**row,'isRead':True} for row in rows];answer(pending.pop(),{'unreadCount':0});page.wait_for_function('document.querySelectorAll(".notification-card.unread").length===0');ok('mark-all accepts once and re-reads unread-first server ordering')
      allow_navigation();before=len(writes);page.locator('.notification-card').first.click();page.wait_for_url('**/forum/thread/7001#*');assert not any(w['path']=='/api/forum/notifications/read' for w in writes[before:]);ok('already-read notification opens reply without another mutation')
      if width==1440:
       mode['read']='hold';nav('/forum/notifications');wait_for(lambda:len(read_pending)>=1,page);old=read_pending.pop(0);identity(990094);wait_for(lambda:len(read_pending)==1,page);fresh=read_pending.pop();fresh_data=payload(fresh.request);fresh_data['items']=[{**fresh_data['items'][0],'title':'Synthetic current B'}];fresh_data['total']=1;answer(fresh,fresh_data);page.get_by_text('Synthetic current B',exact=True).wait_for();answer(old,seed);page.wait_for_timeout(150);assert page.locator('.notification-card').count()==1;ok('late old identity GET cannot replace current identity DOM')
       nav('/my');identity(990093);nav('/forum/notifications');wait_for(lambda:len(read_pending)==1,page);old=read_pending.pop();nav('/my');answer(old,seed);mode['read']='normal';nav('/forum/notifications');page.locator('.notification-card').nth(19).wait_for();ok('KeepAlive deactivation discards late GET and reloads on return')
       rows[:]=[{**row,'isRead':False} for row in rows];nav('/forum');page.locator('.notification-dot').wait_for();nav('/forum/me');page.wait_for_function('document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.data["forum-me-home"]?.unreadNotificationCount===23');nav('/forum/notifications');page.locator('.notification-head button').wait_for();page.locator('.notification-head button').click();wait_for(lambda:len(pending)==1,page);accepted=pending.pop();nav('/my');rows[:]=[{**row,'isRead':True} for row in rows];answer(accepted,{'unreadCount':0});page.wait_for_timeout(120)
       counts=page.evaluate('()=>{const d=document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.data;return [d["forum-home"].unreadNotificationCount,d["forum-me-home"].unreadNotificationCount]}');assert counts==[23,23]
       nav('/forum/notifications');page.wait_for_function('()=>{const d=document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.data;return d["forum-home"]?.unreadNotificationCount===0&&d["forum-me-home"]?.unreadNotificationCount===0}');nav('/forum');assert page.locator('.notification-dot').count()==0;ok('accepted read while inactive refreshes both real cached unread badges after return')
      hydrate('/forum/new?songId=1455&difficulty=5');page.locator('.composer-panel input[maxlength="120"]').first.fill('Synthetic long community title · テスト投稿');draft=page.locator('.block-editor--body textarea').first;draft.fill('First editable paragraph');page.locator('.type-chips button').nth(1).click();page.locator('.block-editor__actions button').click();page.locator('.block-list textarea').first.fill('Edited first paragraph');page.locator('.type-chips button').first.click();assert page.locator('.block-list textarea').first.is_visible();draft.fill('Draft second paragraph')
      page.locator('.composer-submit button').click();wait_for(lambda:len(post_pending)==1,page);route=post_pending.pop();assert [b['text'] for b in route.request.post_data_json['contentBlocks'] if b['type']=='paragraph']==['Edited first paragraph','Draft second paragraph'];answer(route,{'statusCode':503,'statusMessage':'Synthetic post failure'},503);page.wait_for_function('!document.querySelector(".composer-submit button").classList.contains("is-loading")');assert draft.input_value()=='Draft second paragraph' and draft.is_editable();assert page.locator('.block-list textarea').first.input_value()=='Edited first paragraph';ok('post failure preserves visible editable paragraphs across type switch')
      screenshot('composer-failed-editable');draft.fill('Edited second paragraph');freeze_navigation();page.locator('.composer-submit button').click();wait_for(lambda:len(post_pending)==1,page);route=post_pending.pop();body=route.request.post_data_json;assert [b['text'] for b in body['contentBlocks'] if b['type']=='paragraph']==['Edited first paragraph','Edited second paragraph'];assert str(body['songId'])=='1455' and str(body['difficultyType'])=='5';answer(route,{'id':7001});page.locator('.composer-published').wait_for();assert '/forum/new' in page.url;assert page.locator('.composer-submit button').is_disabled();ok('accepted creation and cancelled navigation retain receipt and lock duplicate POST')
      before=len(writes);page.locator('.composer-published button').first.click();page.wait_for_timeout(150);assert not any(w['path']=='/api/forum/threads' for w in writes[before:]);allow_navigation();page.locator('.composer-published button').first.click();page.wait_for_url('**/forum/thread/7001');assert not any(w['path']=='/api/forum/threads' for w in writes[before:]);ok('retry open navigates only, no repeated post or paragraph concatenation')
      nav('/forum/new');page.locator('.composer-published button').last.click();assert draft.input_value()=='';page.locator('.composer-panel input[maxlength="120"]').first.fill('Synthetic upload title');draft.fill('Body with upload');tiny={'name':'synthetic.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSu8AAAAASUVORK5CYII=')};page.locator('input[type=file]').set_input_files(tiny);wait_for(lambda:len(upload_pending)==1,page);assert page.locator('.composer-submit button').is_disabled();answer(upload_pending.pop(),{'imageUrl':'/miku.png'});page.locator('.image-card').wait_for();assert page.locator('.composer-submit button').is_enabled();ok('upload pending prevents submit; completion displays attachment and unlocks')
      if width==1440:
       page.locator('input[type=file]').set_input_files(tiny);wait_for(lambda:len(upload_pending)==1,page);old=upload_pending.pop();identity(990095);assert draft.input_value()=='';page.locator('input[type=file]').set_input_files(tiny);wait_for(lambda:len(upload_pending)==1,page);fresh=upload_pending.pop();answer(old,{'imageUrl':'/stale-identity-image.png'});page.wait_for_timeout(100);assert page.locator('.image-card').count()==0 and page.locator('.composer-submit button').is_disabled();answer(fresh,{'imageUrl':'/miku.png'});page.locator('.image-card').wait_for();ok('old upload cannot add image or clear current identity busy state')
       page.locator('.composer-panel input[maxlength="120"]').first.fill('Synthetic receipt while away');draft.fill('Created while inactive');page.locator('.composer-submit button').click();wait_for(lambda:len(post_pending)==1,page);old=post_pending.pop();nav('/my');answer(old,{'id':7001});page.wait_for_timeout(150);assert page.url.endswith('/my');nav('/forum/new');page.locator('.composer-published').wait_for();ok('accepted receipt survives KeepAlive without navigating away from another page')
      assert not case_errors,case_errors;assert not asset_errors,asset_errors;errors+=case_errors
     finally:context.close()
   finally:browser.close()
  complete=True
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 with socket.socket() as probe:closed=probe.connect_ex(('127.0.0.1',3208))!=0
 (out/'browser.json').write_text(json.dumps({'pass':complete,'checks':checks,'screenshots':screens,'errors':errors,'assetErrors':asset_errors,'controlledWrites':writes,'realBusinessWrites':0,'serverStopped':not server or server.poll() is not None,'listenerClosed':closed,'seconds':round(time.monotonic()-start,2)},ensure_ascii=False,indent=2)+'\n')
 assert closed,'owned preview listener remains'
print(json.dumps({'pass':True,'checks':len(checks),'screenshots':len(screens),'realBusinessWrites':0}))
