"""Same-input real Home/recommendation captures; serial, isolated, no real writes."""
import argparse,hashlib,json,os,signal,subprocess,time,urllib.request,threading,resource
from pathlib import Path
from playwright.sync_api import sync_playwright
from completion_output import review_output
ap=argparse.ArgumentParser();ap.add_argument('stage',choices=['before','after']);ap.add_argument('--source');ap.add_argument('--checks',action='store_true');ap.add_argument('--page',choices=['home','recommend']);ap.add_argument('--entry-only',action='store_true');args=ap.parse_args();signal.alarm(600)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';source=Path(args.source) if args.source else root/'taiko_viewer';out=review_output();shots=out/'screenshots';shots.mkdir(exist_ok=True)
for link,target in [(preview/'node_modules',root/'taiko_viewer/node_modules'),(source/'node_modules',root/'taiko_viewer/node_modules'),(source/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch();env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1',VIEWER_BATCH2_EVIDENCE=str(out));base='http://127.0.0.1:3208';server=None;records=[];errors=[];writes=[];checks=[]
group=Path('/sys/fs/cgroup')/Path('/proc/self/cgroup').read_text().strip().split('::')[-1].lstrip('/');resources={'sampledPeakBytes':0};stop=threading.Event()
def sample():
 while not stop.is_set():
  try:resources['sampledPeakBytes']=max(resources['sampledPeakBytes'],int((group/'memory.current').read_text()));resources['events']=(group/'memory.events').read_text()
  except OSError:pass
  stop.wait(.5)
thread=threading.Thread(target=sample,daemon=True);thread.start()
try:
 with (out/(args.stage+'-preview.log')).open('w') as log:
  server=subprocess.Popen(['/www/server/nvm/versions/node/v24.13.0/bin/node',str(root/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('preview exited')
   try:urllib.request.urlopen(base+'/api/content/songs/1455',timeout=2);break
   except Exception:time.sleep(1)
  else:raise RuntimeError('readiness deadline')
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for key,path in ([] if args.entry_only else [('home','/'),('recommend','/tools/recommend')]):
     if args.page and args.page!=key:continue
     for width,theme,lang in [(1440,'light','zh'),(390,'light','zh'),(414,'dark','ja')]:
      context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 846},is_mobile=width<720,has_touch=width<720,service_workers='block',reduced_motion='reduce')
      try:
       context.add_cookies([{'name':'song_preview_state','value':'song-rows','url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
       page=context.new_page();page.set_default_timeout(15000);case_errors=[];requests=[]
       page.on('pageerror',lambda e:case_errors.append(str(e)[:300]));page.on('request',lambda r:requests.append(r.url) if '/api/' in r.url else None)
       page.goto(base+('/ja' if lang=='ja' else '')+path,wait_until='networkidle',timeout=60000);page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false')
       if key=='recommend':page.get_by_role('button',name='推薦を表示' if lang=='ja' else '查看推荐',exact=True).click();page.get_by_test_id('ordinary-list').wait_for()
       region=page.locator('.growth-plan' if key=='home' else '[data-testid=ordinary-list]');region.scroll_into_view_if_needed();page.wait_for_timeout(300)
       assert not case_errors,case_errors;assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
       endpoint='/api/account/growth/overview' if key=='home' else '/api/account/recommendation/tool';dto=context.request.get(base+endpoint).json();items=dto['todayPlan']['items'] if key=='home' else dto['items']
       record={'page':key,'width':width,'theme':theme,'locale':lang,'inputSha256':hashlib.sha256(json.dumps(dto,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'ids':[[i['songId'],i['difficultyType'] if key=='home' else i['level']] for i in items],'requests':requests,'errors':case_errors}
       name=f'{args.stage}-{key}-{width}-{theme}-{lang}.png';region.screenshot(path=str(shots/name));record['screenshot']='screenshots/'+name;records.append(record)
       if args.stage=='after':
        rows=region.locator('article.song-row');assert rows.count()==(3 if key=='home' else 20)
        row=rows.first;assert row.locator('a button').count()==0;assert row.locator('.song-row__song').get_attribute('href').split('difficulty=')[1].startswith('5')
        assert row.locator('.song-row__actions').count()==1;button=row.locator('[data-song-action]');assert button.bounding_box()['height']>=44
        if width<720:
         assert row.locator('.song-row__title').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1 && e.getBoundingClientRect().height>parseFloat(getComputedStyle(e).lineHeight)')
         assert row.locator('.song-row__actions').evaluate('(e)=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1}')
        if key=='home':assert '980,000' in row.inner_text();assert rows.nth(1).locator('[data-song-action]').count()==0 and rows.nth(2).locator('[data-song-action]').count()==0;assert rows.nth(1).inner_text()!=rows.nth(2).inner_text()
        else:assert rows.nth(1).locator('[data-song-action]').count()==0;assert ('未游玩' if lang=='zh' else '未プレイ') in region.inner_text()
        checks.append({'page':key,'width':width,'locale':lang,'check':'same-row-layout-long-title-capabilities-and-difficulty','pass':True})
       if args.checks:
        from song_row_interactions import run
        checks.extend(run(page,context,key,width,lang,base,out))
       errors.extend(case_errors)
      finally:context.close()
    if args.entry_only:
     context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
     try:
      page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)[:300]));page.goto(base+'/__song-rows',wait_until='networkidle',timeout=60000);assert page.locator('.row-review section').count()==2;page.locator('details summary').first.click();page.wait_for_function('Array.from(document.querySelectorAll("details[open] img")).every(x=>x.complete&&x.naturalWidth>0)');page.screenshot(path=str(shots/'review-entry.png'));checks.append({'check':'preview-gallery-actual-page-links-and-paired-images','pass':True})
     finally:context.close()
    assert not errors,errors
   finally:browser.close()
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 stop.set();thread.join(timeout=2);resources['maxChildRssKiB']=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
 (out/('review-entry-browser.json' if args.entry_only else args.stage+('-'+args.page if args.page else '')+'-browser.json')).write_text(json.dumps({'stage':args.stage,'source':str(source),'records':records,'checks':checks,'errors':errors,'businessWrites':0,'serverStopped':server is None or server.poll() is not None,'resources':resources},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':args.stage,'cases':len(records),'checks':len(checks),'errors':len(errors)}))
