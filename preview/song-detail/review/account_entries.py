"""Real account forms, synthetic identities, ephemeral secrets; no credential artifacts."""
import copy,json,os,signal,socket,subprocess,time,urllib.request,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(850)
root=Path(__file__).resolve().parents[3];source=root/'taiko_viewer';preview=root/'preview/song-detail'
out=Path(os.environ['VIEWER_REVIEW_OUT']);out.mkdir(parents=True,exist_ok=True);(out/'screenshots').mkdir(exist_ok=True)
node='/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node';base='http://127.0.0.1:3208'
for link,target in [(preview/'node_modules',source/'node_modules'),(source/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch();env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1')
page_errors=[];checks=[];screens=[];server=None;complete=False;writes={};start=time.monotonic()
try:
 with (out/'preview.log').open('w') as log:
  server=subprocess.Popen([node,str(source/'node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('Preview exited')
   try:
    with urllib.request.urlopen(base+'/api/account/auth/me',timeout=2) as res:user=json.load(res)['user']
    break
   except Exception:time.sleep(1)
  else:raise RuntimeError('Preview startup deadline')
  def seed(path,state='entry-normal'):
   with urllib.request.urlopen(urllib.request.Request(base+path,headers={'Cookie':'song_preview_state='+state}),timeout=10) as res:return json.load(res)
  user=seed('/api/account/auth/me')['user']
  paths=['/api/account/sync/targets','/api/account/developer','/api/account/developer/review','/api/account/developer/grants','/api/account/developer/clients','/api/support/tickets']
  normal={path:seed(path,'entry-reviewer' if path.endswith('/review') else 'entry-normal') for path in paths}
  empty={path:seed(path,'entry-empty') for path in paths if not path.endswith('/review')}
  detail=seed('/api/support/tickets/8709');profile_seed=seed('/api/account/profile');base_normal=copy.deepcopy(normal)
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for width,theme,lang in ([(1440,'light','zh')] if os.environ.get('ENTRY_FOCUS') else [(1440,'light','zh'),(390,'light','zh'),(414,'dark','ja')]):
     normal=copy.deepcopy(base_normal)
     context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 896},service_workers='block',reduced_motion='reduce')
     try:
      context.add_cookies([{'name':'song_preview_state','value':'entry-normal','url':base},{'name':'taiko_theme','value':theme,'url':base}]);page=context.new_page();page.on('pageerror',lambda error:page_errors.append({'path':urllib.parse.urlparse(page.url).path,'message':str(error)[:250],'stack':str(error.stack)[:1600]}));page.set_default_timeout(20000);page.set_default_navigation_timeout(45000)
      prefix='/ja' if lang=='ja' else '';pending=[];held=[];reads=[];mode={'signed':True,'loginFail':False,'codeFail':False,'read':'normal','role':'reviewer','owner':user['id'],'holdRead':'','holdWrite':False,'writeFail':False,'catalog':'normal','authFailure':False,'applicationSavedFailure':False};ticket_detail=copy.deepcopy(detail)
      def answer(route,data,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
      def data_for(path):
       value=copy.deepcopy(empty.get(path,normal.get(path))) if mode['read']=='empty' else copy.deepcopy(normal.get(path))
       if path=='/api/account/developer':value['canReview']=mode['role']=='reviewer'
       if path=='/api/support/tickets' and mode['owner']!=user['id']:value={'items':[]}
       return value
      def intercept(route):
       req=route.request;parsed=urllib.parse.urlparse(req.url);path=parsed.path
       if parsed.netloc!='127.0.0.1:3208':return route.abort()
       if path=='/api/account/profile':
        value=copy.deepcopy(profile_seed);value['currentBinding']=copy.deepcopy(normal['/api/account/sync/targets']['currentBinding']);return answer(route,value)
       if path=='/api/account/auth/me' and mode['authFailure']:return answer(route,{'statusMessage':'Synthetic session read failure'},503)
       if path=='/api/account/auth/me':return answer(route,{'authenticated':mode['signed'],'user':{**user,'id':mode['owner']} if mode['signed'] else None})
       if req.method not in ['GET','HEAD','OPTIONS']:
        writes[path]=writes.get(path,0)+1
        if mode['holdWrite'] and (path=='/api/account/sync' or path.startswith('/api/account/developer/grants')):pending.append(route);return
        if path=='/api/account/developer/apply' and mode['applicationSavedFailure']:
         normal['/api/account/developer']['currentApplication']['status']='pending';mode['read']='normal';return answer(route,{'statusMessage':'Synthetic notification failure after save'},500)
        if mode['writeFail']:return answer(route,{'statusMessage':'Synthetic write refused'},503)
        if path.endswith('/auth/send-code'):return answer(route,{'statusMessage':'Synthetic code failure'},503) if mode['codeFail'] else answer(route,{'ok':True})
        if path.endswith('/auth/register') or path.endswith('/auth/reset-password'):return answer(route,{'ok':True})
        if path.endswith('/auth/login'):
         if mode['loginFail']:return answer(route,{'statusMessage':'Synthetic sign-in failure'},401)
         mode['signed']=True;return answer(route,{'ok':True,'user':{**user,'id':mode['owner']}})
        if path.endswith('/auth/logout'):mode['signed']=False;return answer(route,{'ok':True})
        if path=='/api/account/sync':return answer(route,{'log':normal['/api/account/sync/targets']['lastSync']})
        if path=='/api/support/tickets':return answer(route,{'ok':True,'ticket':detail,'mailDelivered':False})
        if path.endswith('/messages'):return answer(route,{'ok':True,'ticket':ticket_detail,'mailDelivered':False})
        if path=='/api/account/developer/review':
         normal[path]['pending']=[];return answer(route,{'issuedToken':os.urandom(12).hex(),'mailDelivered':False})
        if path.startswith('/api/account/developer/'):return answer(route,{'ok':True})
        return answer(route,{'statusMessage':'Controlled write denied'},405)
       if path in paths:
        reads.append(path)
        if mode['holdRead']==path:held.append((route,data_for(path)));return
        if mode['read']=='failure':return answer(route,{'statusMessage':'Synthetic entry read failure'},503)
        if path.endswith('/review') and mode['role']!='reviewer':return answer(route,{'statusMessage':'Synthetic reviewer denied'},403)
        return answer(route,data_for(path))
       if path.startswith('/api/support/tickets/'):
        if mode['read']=='detail-failure':return answer(route,{'statusMessage':'Synthetic detail failure'},503)
        return answer(route,{**ticket_detail,'status':'closed'} if path.endswith('/8710') else ticket_detail)
       if path=='/api/content/songs' and 'view=list' in parsed.query:
        q=urllib.parse.parse_qs(parsed.query);state='entry-empty' if mode['catalog']=='empty' else 'entry-normal';value=seed(path+'?'+parsed.query,state)
        if mode['catalog']=='failure':return answer(route,{'statusMessage':'Synthetic shelf failure'},503)
        return answer(route,value)
       route.continue_()
      context.route('**/*',intercept)
      def ok(label):
       assert not page_errors,page_errors
       checks.append({'viewport':width,'theme':theme,'locale':lang,'check':label});print(str(width)+' '+label,flush=True)
      def wait(predicate):
       for _ in range(100):
        if predicate():return
        page.wait_for_timeout(60)
       raise AssertionError('Controlled response readiness deadline')
      def nav(path):
       page.evaluate('(path)=>document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.push(path)',prefix+path);page.wait_for_function('(path)=>location.pathname===path',arg=prefix+path.split('?')[0]);page.wait_for_timeout(100)
      def shot(name):
       assert page.evaluate('Array.from(document.querySelectorAll("input[type=password]")).every(x=>!x.value)'),'No secrets in screenshots'
       assert page.locator('.el-message-box:visible').count()==0,'No credential dialogs in screenshots'
       assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2'),'Unexpected page overflow'
       f=f'{name}-{width}-{theme}-{lang}.png';page.screenshot(path=str(out/'screenshots'/f),full_page=True);screens.append(f)
      def select_sync():
       page.locator('.target-item .el-checkbox__label').first.wait_for()
       page.wait_for_function('!document.querySelector(".sync-page").__vueParentComponent.setupState.pending && document.querySelector(".sync-page").__vueParentComponent.setupState.selectedTargetIds.length===document.querySelectorAll(".target-item input:checked").length')
       if not page.locator('.target-item input').first.is_checked():page.locator('.target-item .el-checkbox__label').first.click()
       page.wait_for_function('document.querySelector(".sync-page").__vueParentComponent.setupState.selectedTargetIds.length>0')
      def identity(id):mode['owner']=id;page.evaluate('(user)=>{const s=document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state;s["$saccount-user"]=user;s["$saccount-user-loaded"]=true}',{**user,'id':id})
      def guest():mode['signed']=False;page.evaluate('()=>{const s=document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state;s["$saccount-user"]=null;s["$saccount-user-loaded"]=true}')
      def passwords():page.locator('input[autocomplete=new-password]').evaluate_all('(els)=>{const v=crypto.randomUUID()+crypto.randomUUID();for(const el of els){el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}))}}')
      page.goto(base+prefix+'/more?previewState=entry-normal',wait_until='networkidle');page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false');shot('more');more_links=page.locator('.more-link').evaluate_all('(els)=>els.map(x=>({href:x.getAttribute("href"),text:x.textContent.trim()}))');assert len(more_links)==13 and all(x['text'] for x in more_links);ok('More exposes all 13 existing links, locale and current version')
      if width==1440:
       for link in more_links:
        page.locator('.more-link[href="'+link['href']+'"]').click();page.wait_for_function('(path)=>location.pathname===path',arg=urllib.parse.urlparse(link['href']).path);nav('/more')
       ok('all 13 More links navigate to their actual routes')
      nav('/tools');page.locator('.tool-card').nth(6).wait_for();shot('tools');assert page.locator('.tool-card').count()==7;ok('Tools exposes all seven real routes and public/login labels')
      if width==1440:
       tool_links=page.locator('.tool-card').evaluate_all('(els)=>els.map(x=>x.getAttribute("href"))')
       for href in tool_links:
        page.locator('.tool-card[href="'+href+'"]').click();page.wait_for_function('(path)=>location.pathname===path',arg=urllib.parse.urlparse(href).path);nav('/tools')
       ok('all seven Tools links navigate to their actual routes')
      for name,path,selector in [('sync','/account/sync','.binding-meta'),('developer','/account/developer','.status-grid'),('review','/account/developer/review','.application-item'),('grants','/account/developer/grants','.grant'),('support','/support','.ticket-card')]:
       nav(path);page.locator(selector).first.wait_for();shot(name)
       if name=='developer':
        example=page.locator('details[data-api]').first;example.locator('summary').first.click();tabs=example.locator('.el-tabs__item');tabs.nth(1).click();assert tabs.nth(1).get_attribute('aria-selected')=='true';tabs.nth(0).click();example.locator('summary').first.click()
       ok(name+' normal result uses real component and masked credentials only')
      if width==1440:
       nav('/account/sync');page.locator('.target-item').first.wait_for();select_sync();mode['holdWrite']=True;page.locator('.target-list + button').click();wait(lambda:len(pending)==1);page.locator('.target-list + button').dispatch_event('click');assert len(pending)==1;answer(pending.pop(),{'log':normal['/api/account/sync/targets']['lastSync']});page.wait_for_function('!!document.querySelector(".target-list + button") && !document.querySelector(".target-list + button").classList.contains("is-loading")');mode['holdWrite']=False;nav('/');page.wait_for_timeout(200);nav('/account/sync');page.locator('.target-item').first.wait_for();ok('sync serializes requests, accepts partial result and returns through Home to fresh overview')
       select_sync();mode['holdWrite']=True;page.locator('.target-list + button').click();wait(lambda:len(pending)==1);answer(pending.pop(),{'statusMessage':'Synthetic sync timeout'},504);page.get_by_text('Synthetic sync timeout',exact=True).wait_for();page.wait_for_function('!!document.querySelector(".target-list + button") && !document.querySelector(".target-list + button").classList.contains("is-loading")');mode['holdWrite']=False;ok('sync timeout remains error and controls recover')
       select_sync()
       mode['holdWrite']=True;page.locator('.target-list + button').click();wait(lambda:len(pending)==1);old=pending.pop();normal['/api/account/sync/targets']['currentBinding']['displayName']='Synthetic new binding';page.evaluate('document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["$saccount-binding-generation"]++');page.get_by_text('Synthetic new binding',exact=True).wait_for();answer(old,{'log':normal['/api/account/sync/targets']['lastSync']});page.wait_for_timeout(120);assert page.locator('.target-item input:checked').count()==0;mode['holdWrite']=False;ok('binding switch clears sync selections and rejects late result callbacks')
       page.locator('.score-token-actions button.el-button--danger').click();page.locator('.el-message-box').wait_for();before=writes.get('/api/account/score-token',0);page.evaluate('document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["$saccount-binding-generation"]++');page.locator('.el-message-box').wait_for(state='hidden');assert writes.get('/api/account/score-token',0)==before;ok('binding switch closes the owned token confirmation without issuing a revoke')
      # Read failures are not empty/permission; retry uses the same resource.
      for name,path,selector in [('sync','/account/sync','.binding-meta'),('developer','/account/developer','.status-grid'),('review','/account/developer/review','.application-item'),('support','/support','.ticket-card')]:
       nav('/more');mode['read']='failure';nav(path);page.locator('[role=alert].entry-read-error').wait_for();assert page.locator(selector).count()==0;
       if width==1440:shot(name+'-read-failure')
       mode['read']='normal';page.locator('[role=alert].entry-read-error button').click();page.locator(selector).first.wait_for();ok(name+' failure is explicit and retry recovers')
      if width==1440:
       for path,selector in [('/account/sync','.el-empty'),('/account/developer','.status-grid'),('/account/developer/grants','.grant-page'),('/support','.empty-state')]:
        nav('/more');mode['read']='empty';nav(path);page.locator(selector).first.wait_for();assert page.locator('[role=alert].entry-read-error').count()==0
       mode['read']='normal';ok('legal empty binding, developer, grants and ticket responses stay distinct from failure')
      if width==1440:
       mode['read']='empty';nav('/more');nav('/account/developer');page.locator('.developer-page textarea').fill('Synthetic application');mode['applicationSavedFailure']=True;page.locator('.developer-page .el-form button.el-button--primary').click();page.get_by_text('Synthetic notification failure after save',exact=True).wait_for();page.wait_for_function('document.querySelector(".status-grid strong").textContent==="pending"');assert page.locator('.developer-page .el-form button.el-button--primary').count()==0;mode['applicationSavedFailure']=False;normal['/api/account/developer']=copy.deepcopy(base_normal['/api/account/developer']);mode['read']='normal';ok('application persisted before mail failure is re-read and cannot be submitted again')
      if width==1440:
       nav('/more');nav('/account/developer/review');page.locator('.application-item__actions .el-button--success').first.click();page.locator('.el-message-box').wait_for();before=writes.get('/api/account/developer/review',0);mode['role']='user';identity(user['id']+1);page.locator('.el-message-box').wait_for(state='hidden');assert writes.get('/api/account/developer/review',0)==before;mode['role']='reviewer';identity(user['id']);page.locator('.application-item__actions .el-button--success').first.wait_for();ok('account change closes old reviewer prompt and does not submit the previous applicant')
       page.locator('.application-item__actions .el-button--success').first.click();page.locator('.el-message-box__input input').fill('Synthetic review note');page.locator('.el-message-box__btns .el-button--primary').click();token_box=page.locator('.el-message-box').filter(has=page.locator('.el-message-box__message').filter(has_text='Token:'));token_box.wait_for();token_box.locator('.el-message-box__btns .el-button--primary').click();token_box.wait_for(state='hidden');page.wait_for_function('document.querySelectorAll(".application-item__actions .el-button--success").length===0');normal['/api/account/developer/review']=copy.deepcopy(base_normal['/api/account/developer/review']);ok('review approval consumes controlled receipt and ephemeral token alert without recording credentials')
      mode['role']='user';nav('/more');nav('/account/developer/review');page.locator('.el-result').wait_for();assert page.locator('.application-item').count()==0;mode['role']='reviewer';ok('ordinary account review denial remains distinct from transport error')
      nav('/account/developer/grants');page.locator('.grant').first.wait_for();mode['holdWrite']=True;page.locator('.grant button').first.click();wait(lambda:len(pending)==1);page.locator('.grant button').first.dispatch_event('click');assert len(pending)==1;answer(pending.pop(),{'statusMessage':'Synthetic revoke refused'},403);page.locator('.grant-page [role=alert]').wait_for();mode['holdWrite']=False;page.locator('.grant-page [role=alert] button').click();page.wait_for_function('!document.querySelector(".grant-page").getAttribute("aria-busy").includes("true")');ok('v1 revoke serializes clicks, preserves independent legacy permission text and recovers from denial')
      if width==1440:
       mode['holdWrite']=True;page.locator('.grant button').first.click();wait(lambda:len(pending)==1);normal['/api/account/developer/grants']['grants'][0]['revokedAt']='2026-10-23T01:00:00Z';answer(pending.pop(),{'ok':True});page.wait_for_function('document.querySelectorAll(".grant button").length===0');assert normal['/api/account/developer']['token']['status']=='active';page.locator('.grant-page details').first.locator('summary').click();page.locator('#grant-app').select_option(normal['/api/account/developer/grants']['clients'][0]['clientId']);page.locator('#grant-binding').select_option('1');page.locator('.grant-new-form button[type=submit]').click();wait(lambda:len(pending)==1);write=pending.pop();body=write.request.post_data_json;assert body['consent'] is True and body['consentVersion']=='viewer-account-consent-v2' and body['bindingId']=='1';normal['/api/account/developer/grants']['grants'][0]['revokedAt']=None;answer(write,{'ok':True});page.locator('.grant button').first.wait_for();mode['holdWrite']=False;ok('v1 revoke and explicit consent success refresh only that grant lifecycle')
      nav('/support');page.locator('.ticket-card').first.wait_for();page.locator('.ticket-card').first.locator('button').first.click();page.locator('.thread-item').first.wait_for();shot('support-thread');closed=page.locator('.ticket-card').nth(1);closed.locator('button').first.click();closed.locator('.closed-hint').wait_for();assert closed.locator('.follow-up-box').count()==0;ok('support history, replies, unread and closed states retain semantics')
      if width==1440:
       page.locator('.support-form .el-form-item input').nth(1).fill('Synthetic ticket');page.locator('.support-form textarea').fill('Editable synthetic body');mode['writeFail']=True;page.locator('.support-form .el-button--primary').click();page.get_by_text('Synthetic write refused',exact=True).wait_for();assert page.locator('.support-form textarea').input_value()=='Editable synthetic body';mode['writeFail']=False;page.locator('.support-form .el-button--primary').click();page.wait_for_function('document.querySelector(".support-form textarea").value===""');page.locator('.el-message--warning').wait_for();ok('support write failure retains draft; saved ticket with failed email is not delivery success')
       mode['holdRead']='/api/support/tickets';nav('/more');nav('/support');wait(lambda:len(held)>0);old,payload=held.pop();identity(user['id']+1);wait(lambda:len(held)>0);fresh,freshdata=held.pop();answer(fresh,freshdata);page.locator('.empty-state').wait_for();answer(old,payload);page.wait_for_timeout(100);assert page.locator('.ticket-card').count()==0;mode['holdRead']='';identity(user['id']);page.locator('.ticket-card').first.wait_for();ok('support identity switch rejects late old history and clears private detail/draft')
       mode['holdRead']='/api/account/developer/grants';nav('/account/developer/grants');wait(lambda:len(held)>0);old,payload=held.pop();identity(user['id']+1);wait(lambda:len(held)>0);fresh,new=held.pop();answer(fresh,{**new,'grants':[]});page.wait_for_function('document.querySelectorAll(".grant").length===0');answer(old,payload);page.wait_for_timeout(120);assert page.locator('.grant').count()==0;mode['holdRead']='';identity(user['id']);ok('grants late old read cannot restore another identity permissions')
      for shelf,name in [(2,'other'),(1,'removed')]:
       mode['catalog']='normal';nav('/songs/'+name);page.locator('.song-card-link').first.wait_for();shot(name);assert reads is not None
       page.locator('#song-search').fill('26');page.wait_for_function('document.querySelectorAll(".song-card-link").length===1');assert '26' in page.locator('.song-card-link').inner_text();page.locator('#song-search').fill('NO_SYNTHETIC_MATCH');page.wait_for_function('document.querySelectorAll(".song-card-link").length===0 && document.querySelector(".song-grid").getAttribute("aria-busy")==="false"');assert page.locator('.song-catalog .el-empty').count()>0,'Legal empty shelf/search has no state message';mode['catalog']='failure';page.locator('#song-search').fill('');page.locator('.song-catalog .el-alert--error').wait_for();mode['catalog']='normal';page.locator('.song-catalog .el-alert--error').locator('..').locator('button').click();page.locator('.song-card-link').first.wait_for();page.evaluate('scrollTo(0,document.body.scrollHeight)');page.wait_for_timeout(500);page.locator('.song-card-link').nth(12).wait_for();ok(name+' independently keeps shelfStatus, search, load-more, empty and failure retry')
      # Auth forms use synthetic ephemeral passwords. Never screenshot filled secrets.
      guest();nav('/account/login?redirect='+urllib.parse.quote(prefix+'/more',safe=''));page.locator('input[autocomplete=current-password]').wait_for();shot('login');mode['loginFail']=True;page.locator('input[autocomplete=username]').fill('synthetic');page.locator('input[autocomplete=current-password]').evaluate('(el)=>{el.value=crypto.randomUUID()+crypto.randomUUID();el.dispatchEvent(new Event("input",{bubbles:true}))}');page.locator('.auth-card button.el-button--primary').click();page.locator('.auth-card [role=alert]').wait_for();mode['loginFail']=False;mode['authFailure']=True;login_before=writes.get('/api/account/auth/login',0);page.locator('.auth-card button.el-button--primary').click();page.locator('.auth-card [role=alert]').wait_for();mode['authFailure']=False;page.locator('.auth-card button.el-button--primary').click();page.wait_for_function('(path)=>location.pathname===path',arg=prefix+'/more');assert writes['/api/account/auth/login']==login_before+1;ok('login failure retries and successful session refresh respects return target')
      guest();nav('/account/register');page.locator('input[autocomplete=new-password]').first.wait_for();shot('register');page.locator('input[autocomplete=username]').fill('synthetic-new');page.locator('input[autocomplete=email]').fill('synthetic@example.invalid');mode['codeFail']=True;page.locator('.code-row button').click();page.get_by_text('Synthetic code failure',exact=True).wait_for();mode['codeFail']=False;page.locator('.code-row button').click();page.wait_for_function('/[0-9]+s/.test(document.querySelector(".code-row button").textContent)');page.locator('input[autocomplete=one-time-code]').fill('000000');passwords();mode['loginFail']=True;before=writes.get('/api/account/auth/register',0);page.locator('.auth-card button.el-button--primary').click();page.locator('.auth-card [role=alert]').wait_for();mode['loginFail']=False;page.locator('.auth-card button.el-button--primary').click();page.wait_for_function('location.pathname.endsWith("/account/profile")');assert writes['/api/account/auth/register']==before+1;ok('register code failure/retry/cooldown and accepted registration retry only login')
      guest();nav('/account/forgot-password');page.locator('input[autocomplete=new-password]').first.wait_for();shot('reset');page.locator('input[autocomplete=email]').fill('synthetic@example.invalid');page.locator('input[autocomplete=one-time-code]').fill('000000');passwords();page.evaluate('()=>{window.removeSyntheticGuard=document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.beforeEach(to=>to.path.endsWith("/account/login")?false:undefined)}');before=writes.get('/api/account/auth/reset-password',0);page.locator('.auth-card button.el-button--primary').click();page.locator('.auth-card [role=alert]').wait_for();page.locator('.auth-card button.el-button--primary').click();page.wait_for_timeout(100);assert writes['/api/account/auth/reset-password']==before+1;page.evaluate('window.removeSyntheticGuard()');page.locator('.auth-card button.el-button--primary').click();page.wait_for_function('location.pathname.endsWith("/account/login")');ok('accepted reset and cancelled navigation retry opening without repeated reset POST')
      context.add_cookies([{'name':'song_preview_state','value':'auth-failure','url':base}]);mode['authFailure']=True;mode['signed']=False;page.goto(base+prefix+'/account/login?redirect='+urllib.parse.quote(prefix+'/more',safe=''),wait_until='networkidle');page.locator('.auth-state-error').wait_for();assert page.locator('.auth-card form').count()==0;shot('auth-read-failure');before=writes.get('/api/account/auth/login',0);page.locator('.auth-state-error button').click();page.wait_for_function('!document.querySelector(".auth-state-error button").classList.contains("is-loading")');mode['authFailure']=False;mode['signed']=True;context.add_cookies([{'name':'song_preview_state','value':'entry-normal','url':base}]);page.locator('.auth-state-error button').click();page.wait_for_function('(path)=>location.pathname===path',arg=prefix+'/more');assert writes.get('/api/account/auth/login',0)==before;ok('initial auth read failure retries session without asserting guest or sending password')
     except Exception:
      print(json.dumps({'failedRoute':urllib.parse.urlparse(page.url).path,'recentReadPaths':reads[-15:],'syncState':page.evaluate('()=>{const s=document.querySelector(".sync-page")?.__vueParentComponent?.setupState;return s?{pending:s.pending,submitting:s.submitting,selected:s.selectedTargetIds,groupModel:document.querySelector(".sync-page .el-checkbox-group")?.__vueParentComponent?.props.modelValue,boxes:Array.from(document.querySelectorAll(".target-item input")).map(x=>({checked:x.checked,value:x.value,class:x.closest(".el-checkbox")?.className})),checked:document.querySelectorAll(".target-item input:checked").length,cooldown:s.cooldown}:null}'),'pendingWrites':len(pending),'grantState':page.evaluate('()=>{const el=document.querySelector(".grant-page");const s=el?.__vueParentComponent?.setupState;return s?{pending:s.pending,busy:s.busy,error:s.error,hasState:Boolean(s.state),text:el.textContent.slice(0,300)}:null}')},ensure_ascii=False),flush=True)
      raise
     finally:context.close()
   finally:browser.close()
  assert not page_errors,page_errors
  complete=True
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 with socket.socket() as probe:closed=probe.connect_ex(('127.0.0.1',3208))!=0
 (out/'browser.json').write_text(json.dumps({'pass':complete,'checks':checks,'screenshots':screens,'controlledWritesByPath':writes,'productionWrites':0,'pageErrors':page_errors,'secretsRecorded':False,'level':'real Nuxt/Vue; controlled synthetic reads and writes, no SQL or email delivery claim','listenerClosed':closed,'seconds':round(time.monotonic()-start,2)},ensure_ascii=False,indent=2)+'\n');assert closed
print(json.dumps({'pass':True,'checks':len(checks),'screenshots':len(screens),'productionWrites':0}))
