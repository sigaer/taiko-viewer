"""Real Nuxt Home/My pages, one browser/page at a time; no business backend."""
import argparse,hashlib,json,os,signal,subprocess,time,urllib.request,threading,resource,socket
from pathlib import Path
from playwright.sync_api import sync_playwright
from completion_output import review_output
ap=argparse.ArgumentParser();ap.add_argument('stage',choices=['before','after']);ap.add_argument('--source');ap.add_argument('--checks',action='store_true');ap.add_argument('--page',choices=['home','my']);ap.add_argument('--entry-only',action='store_true');ap.add_argument('--auth-only',action='store_true');args=ap.parse_args();signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';source=Path(args.source) if args.source else root/'taiko_viewer';out=review_output();shots=out/'screenshots';shots.mkdir(exist_ok=True)
for link,target in [(preview/'node_modules',root/'taiko_viewer/node_modules'),(source/'node_modules',root/'taiko_viewer/node_modules'),(source/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch();env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1',VIEWER_BATCH2_EVIDENCE=str(out));base='http://127.0.0.1:3208';server=None;records=[];errors=[];checks=[];writes=[];telemetry=[]
group=Path('/sys/fs/cgroup')/Path('/proc/self/cgroup').read_text().strip().split('::')[-1].lstrip('/');resources={'sampledPeakBytes':0};stop=threading.Event()
def sample():
 while not stop.is_set():
  try:resources['sampledPeakBytes']=max(resources['sampledPeakBytes'],int((group/'memory.current').read_text()));resources['events']=(group/'memory.events').read_text()
  except OSError:pass
  stop.wait(.5)
thread=threading.Thread(target=sample,daemon=True);thread.start()
try:
 with (out/(args.stage+('-auth' if args.auth_only else '')+'-preview.log')).open('w') as log:
  server=subprocess.Popen(['/www/server/nvm/versions/node/v24.13.0/bin/node',str(root/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('preview exited')
   try:urllib.request.urlopen(base+'/api/content/songs/1455',timeout=2);break
   except Exception:time.sleep(1)
  else:raise RuntimeError('readiness deadline')
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for key,path in ([] if args.entry_only else [('home','/'),('my','/my')]):
     if args.page and args.page!=key:continue
     for width,theme,lang in ([(390,'light','zh')] if args.auth_only else [(1440,'light','zh'),(390,'light','zh'),(414,'dark','ja')]):
      context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 846},is_mobile=width<720,has_touch=width<720,service_workers='block',reduced_motion='reduce')
      try:
       context.add_cookies([{'name':'song_preview_state','value':'auth-failure' if args.auth_only else 'home-deep','url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
       def readonly(route):
        request=route.request
        if request.method in ['GET','HEAD','OPTIONS']:route.continue_();return
        if request.url==base+'/api/account/growth/recent/ack':
         body=request.post_data_json;assert body['profileId']=='1' and body['acknowledgeToken']=='synthetic-home-deep-token';writes.append({'level':'isolated browser transport','kind':'ack','body':body});route.fulfill(status=200,content_type='application/json',body=json.dumps({'profileId':'1','acknowledgedToken':body['acknowledgeToken']}));return
        if '/api/annual-beta/events' in request.url:telemetry.append(request.post_data_json);route.fulfill(status=200,content_type='application/json',body='{}');return
        route.abort();raise AssertionError('unexpected uncontrolled write '+request.url)
       context.route('**/*',readonly)
       page=context.new_page();page.set_default_timeout(15000);case_errors=[];requests=[]
       page.on('pageerror',lambda e:case_errors.append(str(e)[:350]));page.on('request',lambda r:requests.append({'url':r.url,'method':r.method}) if '/api/' in r.url else None)
       page.on('request',lambda r:writes.append({'level':'isolated browser transport','path':r.url.replace(base,''),'method':r.method,'fields':sorted((r.post_data_json or {}).keys())}) if r.method not in ['GET','HEAD','OPTIONS'] and '/api/account/' in r.url and not r.url.endswith('/recent/ack') else None)
       prefix='/ja' if lang=='ja' else '';page.goto(base+prefix+path,wait_until='networkidle',timeout=60000);page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false')
       page.locator('.home-page[data-home-state-status=error]' if args.auth_only and key=='home' else '.growth-plan' if key=='home' else '.my-links').first.wait_for();page.wait_for_timeout(250)
       assert not case_errors,case_errors;assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
       if args.auth_only:
        response=context.request.get(base+'/api/account/auth/me');assert response.status==503;inputs={'auth':{'status':response.status,'statusMessage':response.json()['statusMessage']}}
       else:inputs={endpoint:context.request.get(base+endpoint).json() for endpoint in (['/api/account/auth/me','/api/content/home','/api/account/bindings','/api/account/songs?pageSize=1','/api/account/growth/overview','/api/account/growth/recent'] if key=='home' else ['/api/account/auth/me'])}
       scenario='-auth-failure' if args.auth_only else '';name=f'{args.stage}-{key}{scenario}-{width}-{theme}-{lang}.png';page.screenshot(path=str(shots/name),full_page=True);records.append({'page':key,'scenario':'auth-failure' if args.auth_only else 'normal','width':width,'theme':theme,'locale':lang,'inputSha256':hashlib.sha256(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'screenshot':'screenshots/'+name,'requests':list(requests),'errors':list(case_errors)})
       if args.stage=='after' and args.auth_only:
        assert page.locator('.my-cta' if key=='my' else '.guest-hero').count()==0
        assert page.locator('.my-page' if key=='my' else '.home-page').get_attribute('data-auth-status' if key=='my' else 'data-home-state-status')=='error'
        checks.append({'page':key,'width':width,'check':'auth-read-failure-is-not-confirmed-guest','pass':True})
       if args.stage=='after' and not args.auth_only:
        if key=='my':
         assert page.locator('.my-links').count()==3 and page.locator('.my-link').count()==9
         for link in page.locator('.my-link').all():assert link.bounding_box()['height']>=44
         assert page.locator('.my-page').get_attribute('data-auth-status')=='authenticated'
        else:assert page.locator('.growth-plan .song-row').count()==3 and page.locator('.growth-plan__choose').count()==1
        checks.append({'page':key,'width':width,'locale':lang,'check':'normal-result-density-navigation-and-no-overflow','pass':True})
       if args.checks:
        from home_state_interactions import run
        checks.extend(run(page,context,key,width,lang,base,out,writes))
       assert not case_errors,case_errors;errors.extend(case_errors)
      finally:context.close()
    if args.entry_only:
     context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
     try:
      page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)[:350]));page.goto(base+'/__home-states',wait_until='networkidle',timeout=60000);assert page.locator('.state-review section').count()==2;page.locator('details summary').first.click();page.wait_for_function('Array.from(document.querySelectorAll("details[open] img")).every(x=>x.complete&&x.naturalWidth>0)');page.screenshot(path=str(shots/'review-entry.png'));checks.append({'check':'preview-entry-real-routes-and-screenshots','pass':True})
     finally:context.close()
    assert not errors,errors
   finally:browser.close()
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 stop.set();thread.join(timeout=2);resources['maxChildRssKiB']=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
 with socket.socket() as probe:listener_closed=probe.connect_ex(('127.0.0.1',3208))!=0
 (out/('review-entry-browser.json' if args.entry_only else args.stage+('-auth' if args.auth_only else '')+('-'+args.page if args.page else '')+'-browser.json')).write_text(json.dumps({'stage':args.stage,'source':str(source),'records':records,'checks':checks,'errors':errors,'controlledWrites':writes,'controlledTelemetryCount':len(telemetry),'businessWrites':0,'serverStopped':server is None or server.poll() is not None,'listenerClosed':listener_closed,'resources':resources},ensure_ascii=False,indent=2)+'\n')
 assert listener_closed,'preview listener remains'
print(json.dumps({'stage':args.stage,'cases':len(records),'checks':len(checks),'errors':len(errors),'controlledWrites':len(writes),'realBusinessWrites':0}))
