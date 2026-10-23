"""Real account forms, synthetic identities, ephemeral secrets; no credential artifacts."""
import json,os,signal,socket,subprocess,time,urllib.request,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(650)
root=Path(__file__).resolve().parents[3];source=root/'taiko_viewer';preview=root/'preview/song-detail'
out=Path(os.environ['VIEWER_REVIEW_OUT']);out.mkdir(parents=True,exist_ok=True);(out/'screenshots').mkdir(exist_ok=True)
node='/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node';base='http://127.0.0.1:3208'
for link,target in [(preview/'node_modules',source/'node_modules'),(source/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch();env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1')
checks=[];screens=[];server=None;complete=False;writes={};start=time.monotonic()
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
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for width,theme,lang in [(1440,'light','zh'),(390,'light','zh'),(414,'dark','ja')]:
     context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 896},service_workers='block',reduced_motion='reduce')
     try:
      context.add_cookies([{'name':'song_preview_state','value':'guest','url':base},{'name':'taiko_theme','value':theme,'url':base}])
      context.add_init_script('''if(!sessionStorage.getItem('synthetic-upgrade-seeded')){const bytes=crypto.getRandomValues(new Uint8Array(24));localStorage.setItem('taiko-account-password',Array.from(bytes).join(''));localStorage.setItem('taiko-account-remember','1');localStorage.setItem('taiko-account-identifier','synthetic-account');localStorage.setItem('unrelated-setting','preserved');sessionStorage.setItem('synthetic-upgrade-seeded','1');}''')
      page=context.new_page();page.set_default_timeout(22000);mode={'signed':False,'fail':True};prefix='/ja' if lang=='ja' else ''
      def answer(route,data,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
      def intercept(route):
       req=route.request;path=urllib.parse.urlparse(req.url).path
       if urllib.parse.urlparse(req.url).netloc!='127.0.0.1:3208':return route.abort()
       if path=='/api/account/auth/me':return answer(route,{'authenticated':mode['signed'],'user':user if mode['signed'] else None})
       if req.method not in ['GET','HEAD','OPTIONS']:
        writes[path]=writes.get(path,0)+1
        if path.endswith('/auth/login'):
         if mode['fail']:return answer(route,{'statusMessage':'Synthetic sign-in failure'},401)
         mode['signed']=True;context.add_cookies([{'name':'song_preview_state','value':'scores','url':base}]);return answer(route,{'ok':True})
        if path.endswith('/auth/logout'):mode['signed']=False;context.add_cookies([{'name':'song_preview_state','value':'guest','url':base}]);return answer(route,{'ok':True})
        if path.endswith('/auth/register'):return answer(route,{'ok':True})
        return answer(route,{'statusMessage':'Controlled preview write denied'},405)
       return route.continue_()
      context.route('**/*',intercept)
      def ok(label):
       checks.append({'viewport':width,'theme':theme,'language':lang,'check':label});print(str(width)+' '+label,flush=True)
      def nav(path):
       page.evaluate('(path)=>document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.push(path)',prefix+path);page.wait_for_function('(path)=>location.pathname===path',arg=prefix+path)
      def no_secret():
       assert page.evaluate('localStorage.getItem("taiko-account-password")===null && localStorage.getItem("unrelated-setting")==="preserved"')
      def shot(name):
       assert page.evaluate('Array.from(document.querySelectorAll("input[type=password]")).every(x=>!x.value)')
       file=f'{name}-{width}-{theme}-{lang}.png';page.screenshot(path=str(out/'screenshots'/file),full_page=True);screens.append(file)
      page.goto(base+prefix+'/account/login',wait_until='networkidle');page.locator('input[autocomplete=username]').wait_for();no_secret()
      assert page.locator('input[autocomplete=username]').input_value()=='synthetic-account';assert page.locator('input[autocomplete=current-password]').input_value()=='';ok('upgrade deletes old key without password autofill and preserves account/settings')
      shot('login');page.locator('input[autocomplete=current-password]').evaluate('(el)=>{el.value=crypto.randomUUID()+crypto.randomUUID();el.dispatchEvent(new Event("input",{bubbles:true}))}')
      page.locator('.auth-card button.el-button--primary').click();page.locator('.el-message--error').wait_for();no_secret();assert page.locator('input[autocomplete=current-password]').input_value();ok('failed login stays editable and does not persist password')
      mode['fail']=False;page.locator('.auth-card button.el-button--primary').click();page.wait_for_function('location.pathname.endsWith("/account/profile")');no_secret();assert page.evaluate('localStorage.getItem("taiko-account-identifier")==="synthetic-account"');ok('successful remembered login persists identifier only')
      page.reload(wait_until='networkidle');no_secret();ok('refresh of signed session still runs cleanup')
      # Owned synthetic storage is deliberately reseeded to verify logged-in public first visit.
      page.evaluate('localStorage.setItem("taiko-account-password",crypto.randomUUID())');page.goto(base+prefix+'/more',wait_until='networkidle');no_secret();ok('existing logged-in session visiting a public route removes legacy key')
      if width<960:page.locator('.mobile-nav-toggle').click()
      page.locator('.account-brief__logout').click();page.wait_for_function('document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["$saccount-user"]===null');nav('/account/login');page.locator('input[autocomplete=current-password]').wait_for();assert page.locator('input[autocomplete=current-password]').input_value()=='';no_secret();ok('logout preserves opted-in identifier and never restores a password')
      page.locator('.remember-row .el-checkbox').click();assert page.evaluate('!localStorage.getItem("taiko-account-identifier")&&!localStorage.getItem("taiko-account-remember")');page.reload(wait_until='networkidle');assert page.locator('input[autocomplete=username]').input_value()=='';ok('opt out immediately removes identifier; refresh remains empty')
      nav('/account/register');page.locator('input[autocomplete=username]').fill('synthetic-new');page.locator('input[autocomplete=email]').fill('synthetic@example.invalid');page.locator('input[autocomplete=one-time-code]').fill('000000');page.locator('input[autocomplete=new-password]').evaluate_all('(els)=>{const value=crypto.randomUUID()+crypto.randomUUID();for(const el of els){el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}))}}');page.locator('.auth-card button.el-button--primary').click();page.wait_for_function('location.pathname.endsWith("/account/profile")');no_secret();assert page.evaluate('!localStorage.getItem("taiko-account-remember")&&!localStorage.getItem("taiko-account-identifier")');ok('registration success has no custom credential persistence')
      mode['signed']=False;page.evaluate('()=>{const s=document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state;s["$saccount-user"]=null;s["$saccount-user-loaded"]=true}');nav('/account/register');page.locator('input[autocomplete=new-password]').first.wait_for();shot('register');nav('/account/forgot-password');assert page.locator('input[autocomplete=new-password]').count()==2;shot('reset');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');ok('browser autocomplete and representative layouts are valid')
     finally:context.close()
   finally:browser.close()
  complete=True
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 with socket.socket() as probe:closed=probe.connect_ex(('127.0.0.1',3208))!=0
 (out/'browser.json').write_text(json.dumps({'pass':complete,'checks':checks,'screenshots':screens,'controlledWritesByPath':writes,'productionWrites':0,'secretsRecorded':False,'listenerClosed':closed,'seconds':round(time.monotonic()-start,2)},ensure_ascii=False,indent=2)+'\n');assert closed
print(json.dumps({'pass':True,'checks':len(checks),'screenshots':len(screens),'productionWrites':0}))
