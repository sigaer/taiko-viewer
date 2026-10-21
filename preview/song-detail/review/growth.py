"""Serial real-component captures. Inputs are isolated deterministic fixtures."""
import argparse,hashlib,json,os,signal,subprocess,time,urllib.request,threading,resource
from pathlib import Path
from playwright.sync_api import sync_playwright
from completion_output import review_output
ap=argparse.ArgumentParser();ap.add_argument('stage',choices=['before','after']);ap.add_argument('--source');ap.add_argument('--checks',action='store_true');ap.add_argument('--page',choices=['growth','weekly','scores']);ap.add_argument('--state');args=ap.parse_args()
signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';out=review_output();shots=out/'screenshots';shots.mkdir(exist_ok=True)
source=Path(args.source) if args.source else root/'taiko_viewer'
for link,target in [(preview/'node_modules',root/'taiko_viewer/node_modules'),(source/'node_modules',root/'taiko_viewer/node_modules'),(source/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch()
env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1',VIEWER_BATCH2_EVIDENCE=str(out))
base='http://127.0.0.1:3208';server=None;records=[];errors=[];writes=[];checks=[]
resourceGroup=Path('/sys/fs/cgroup')/Path('/proc/self/cgroup').read_text().strip().split('::')[-1].lstrip('/')
resources={'sampledPeakBytes':0,'sampleIntervalSeconds':0.5};stopSampling=threading.Event()
def sample():
 while not stopSampling.is_set():
  try:
   resources['sampledPeakBytes']=max(resources['sampledPeakBytes'],int((resourceGroup/'memory.current').read_text()));resources['events']=(resourceGroup/'memory.events').read_text()
  except OSError:pass
  stopSampling.wait(.5)
sampler=threading.Thread(target=sample,daemon=True);sampler.start()
try:
 with (out/(args.stage+'-preview.log')).open('w') as log:
  server=subprocess.Popen(['/www/server/nvm/versions/node/v24.13.0/bin/node',str(root/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('preview exited')
   try:urllib.request.urlopen(base+'/api/account/growth/passport',timeout=2);break
   except Exception:time.sleep(1)
  else:raise RuntimeError('readiness deadline')
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for key in ['growth','weekly','scores']:
     if args.page and key!=args.page:continue
     cases=[(1440,'light','zh','scores'),(390,'light','zh','scores'),(414,'dark','ja','scores')] if key!='scores' else [(414,'light','zh','scores'),(414,'dark','ja','scores')]
     if args.stage=='after' and key!='scores':cases += [(390,'light','zh',s) for s in (['growth-empty','growth-single','growth-missing','growth-unknown','guest','unbound','growth-failure'] if key=='growth' else ['growth-limited','growth-incompatible','growth-no-next','growth-quiet','growth-no-play','growth-empty','guest','unbound','growth-failure'])]
     if args.state:cases=[(390,'light','zh',args.state)]
     for width,theme,lang,state in cases:
      context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 846},is_mobile=width<720,has_touch=width<720,reduced_motion='reduce',service_workers='block')
      try:
       context.add_cookies([{'name':'song_preview_state','value':state,'url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
       page=context.new_page();page.set_default_timeout(12000);case_errors=[];page.on('pageerror',lambda e:case_errors.append(str(e)[:300]));page.on('request',lambda r:writes.append({'method':r.method,'url':r.url}) if '/api/' in r.url and r.method not in ['GET','HEAD'] else None)
       route='/account/songs' if key=='scores' else '/my/'+key
       page.goto(base+('/ja' if lang=='ja' else '')+route,wait_until='networkidle',timeout=60000);page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false');page.wait_for_timeout(250)
       page.evaluate('window.scrollTo(0,document.body.scrollHeight)');page.wait_for_timeout(400);page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(150)
       record={'page':key,'width':width,'theme':theme,'locale':lang,'state':state,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth+2'),'errors':case_errors}
       assert not case_errors,record
       if args.stage=='after':assert not record['overflow'],record
       if state=='scores':
        endpoint='/api/account/songs' if key=='scores' else '/api/account/growth/'+('passport' if key=='growth' else 'weekly')
        dto=context.request.get(base+endpoint).json();record['inputSha256']=hashlib.sha256(json.dumps(dto,sort_keys=True,separators=(',',':')).encode()).hexdigest()
       name=f'{args.stage}-{key}-{width}-{theme}-{lang}-{state}.png';page.screenshot(path=str(shots/name),full_page=True);record['screenshot']='screenshots/'+name;records.append(record)
       if args.stage=='before' and key=='weekly' and width==1440:
        calls=[];page.on('request',lambda r:calls.append(r.url) if '/api/account/growth/weekly' in r.url else None)
        page.evaluate('document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["$saccount-binding-generation"]++');page.wait_for_timeout(300)
        checks.append({'check':'baseline-weekly-binding-switch','newRequests':len(calls),'oldReportRemains':page.locator('.weekly-hero').count()==1})
       if args.stage=='after' and key=='scores':
        controls=page.locator('.pagination-row > .el-pagination');assert controls.count()==2
        group=controls.last;ys=group.locator('.btn-prev,.el-pager,.btn-next').evaluate_all('(xs)=>xs.map(x=>Math.round(x.getBoundingClientRect().top))');assert max(ys)-min(ys)<3
        checks.append({'check':'scores-pagination-complete-group','locale':lang,'width':width,'pass':True})
       if args.stage=='after' and key=='growth':
        if state=='growth-expanded':
         count=page.locator('.passport-milestone').count();more=page.locator('.passport-more');assert more.count()==1;more.click();assert page.locator('.passport-milestone').count()>count;assert more.get_attribute('aria-expanded')=='true';more.click();assert page.locator('.passport-milestone').count()==count;checks.append({'check':'actual-milestone-expand-collapse','pass':True})
         normal=context.request.get(base+'/api/account/growth/passport',headers={'Cookie':'song_preview_state=scores'}).json();checks.append({'check':'normal-input-unchanged-with-extra-fixture','sha256':hashlib.sha256(json.dumps(normal,sort_keys=True,separators=(',',':')).encode()).hexdigest()})
        if state=='growth-empty':assert page.locator('.passport-chart__hit').count()==0
        if state=='growth-single':assert page.locator('[data-metric=rating] .passport-chart__hit').count()==1
        if state=='growth-missing':
         page.locator('.passport-dimensions button').nth(2).click();assert page.locator('[data-metric=speed] .passport-chart__hit').count()==0
        if state=='unbound':assert '请先绑定鼓众 ID' in page.locator('.passport-state').inner_text()
       if args.stage=='after' and key=='weekly':
        if state=='growth-incompatible':assert page.locator('.weekly-measurement__rating').count()==0;assert page.locator('.weekly-measurement__change').count()==0
        if state=='growth-no-next':assert page.locator('.weekly-next .weekly-muted').count()==1
        if state=='growth-empty':assert '看不全' in page.locator('.weekly-theme').inner_text()
        if state=='unbound':assert '请先绑定鼓众 ID' in page.locator('.weekly-state').inner_text()
       if args.stage=='after' and args.checks and key!='scores' and state=='scores':
        from growth_interactions import run
        checks.extend(run(page,context,key,width,lang,base,out))
       if args.stage=='after' and key!='scores' and state=='growth-failure':
        context.add_cookies([{'name':'song_preview_state','value':'scores','url':base}]);page.locator('main.'+('passport' if key=='growth' else 'weekly')+'-page button').first.click();page.locator('.'+('passport' if key=='growth' else 'weekly')+'-hero').wait_for();checks.append({'check':key+'-failure-retry','pass':True})
       errors.extend(case_errors)
      finally:context.close()
    if args.stage=='after' and not args.page:
     context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
     try:
      page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)[:300]));page.goto(base+'/__growth-review',wait_until='networkidle');assert page.locator('.review section').count()==2
      page.locator('.review details').first.locator('summary').click();page.wait_for_function('Array.from(document.querySelectorAll("details[open] img")).every(x=>x.complete&&x.naturalWidth>0)');page.screenshot(path=str(shots/'review-entry.png'));checks.append({'check':'review-entry-real-pages-and-paired-images','pass':True})
     finally:context.close()
    assert not errors,errors
    assert not writes,writes
   finally:browser.close()
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 stopSampling.set();sampler.join(timeout=2);resources['maxChildRssKiB']=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
 (out/(args.stage+('-'+args.page if args.page else '')+('-'+args.state if args.state else '')+'-browser.json')).write_text(json.dumps({'stage':args.stage,'source':str(source),'fixtureSha256':hashlib.sha256((preview/'server/utils/growth-fixtures.ts').read_bytes()).hexdigest(),'records':records,'checks':checks,'errors':errors,'writes':writes,'serverStopped':server is None or server.poll() is not None,'resources':resources},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':args.stage,'cases':len(records),'checks':len(checks),'errors':len(errors),'writes':len(writes)}))
