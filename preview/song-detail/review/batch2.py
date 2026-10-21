"""Real Nuxt pages, bounded serial browser, synthetic GET-only fixtures."""
import argparse,json,os,signal,subprocess,time,urllib.request,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
from completion_output import review_output
ap=argparse.ArgumentParser();ap.add_argument('stage',choices=['before','after']);ap.add_argument('--source');ap.add_argument('--checks',action='store_true');ap.add_argument('--entry-only',action='store_true');args=ap.parse_args()
signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';out=review_output();shots=out/'screenshots';shots.mkdir(exist_ok=True,parents=True)
for link,target in [(preview/'node_modules',root/'taiko_viewer/node_modules'),(root/'taiko_viewer/.nuxt',preview/'.nuxt'),(Path(args.source or root/'taiko_viewer')/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch()
env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=args.source or str(root/'taiko_viewer'),NUXT_TELEMETRY_DISABLED='1',VIEWER_BATCH2_EVIDENCE=str(out))
base='http://127.0.0.1:3208';server=None;records=[];errors=[];writes=[]
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
    for route,key in ([] if args.entry_only else [('/account/songs','scores'),('/tools/b30','b30'),('/tools/progress','progress')]):
     cases=[(1440,'light','zh','scores'),(390,'light','zh','scores'),(414,'dark','ja','scores')]
     if args.stage=='before' and key=='progress':cases.append((390,'light','zh','options-failure'))
     if args.stage=='after':cases += [(414,'light','zh','empty'),(390,'dark','ja','scores-failure' if key=='scores' else 'options-failure' if key=='progress' else 'image-failure'),(1440,'dark','ja','manual' if key=='scores' else 'scores'),(390,'light','zh','guest'),(414,'light','zh','unbound')]
     for width,theme,lang,state in cases:
      context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 846},is_mobile=width<720,has_touch=width<720,reduced_motion='reduce',service_workers='block')
      try:
       context.add_cookies([{'name':'song_preview_state','value':state,'url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
       page=context.new_page();page.set_default_timeout(15000);case_errors=[];page.on('pageerror',lambda e:case_errors.append(str(e)[:500]));page.on('request',lambda r:writes.append({'method':r.method,'url':r.url}) if '/api/' in r.url and r.method not in ['GET','HEAD'] else None)
       page.goto(base+('/ja' if lang=='ja' else '')+route,wait_until='networkidle',timeout=60000)
       page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false');page.wait_for_timeout(300)
       if key=='b30' and state!='guest':
        page.locator('button[type=submit]').click();page.wait_for_timeout(650)
       if key=='progress' and args.stage=='after' and state not in ['empty','options-failure','guest','unbound']:
        page.locator('button[type=submit]').click();page.wait_for_timeout(650)
       overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
       img=page.locator('.chart-image, .progress-image');image_count=img.count()
       record={'page':key,'width':width,'theme':theme,'locale':lang,'state':state,'overflow':overflow,'images':image_count,'errors':case_errors}
       if args.stage=='after':
        assert not overflow,record
        assert not case_errors,record
        if key!='scores' and state not in ['empty','options-failure','image-failure','guest','unbound']:assert image_count==1,record
       if image_count:
        assert img.evaluate('(e)=>e.complete && e.naturalWidth>0 && Math.abs(e.clientWidth/e.clientHeight-e.naturalWidth/e.naturalHeight)<0.02'),record
       name=f'{args.stage}-{key}-{width}-{theme}-{lang}-{state}.png';page.screenshot(path=str(shots/name),full_page=True);record['screenshot']='screenshots/'+name;records.append(record);errors.extend(case_errors)
       if args.checks and args.stage=='after' and ((width==1440 and theme=='light' and state=='scores') or state=='options-failure'):
        from batch2_interactions import run
        record['checks']=run(page,context,key,state,base,out)
        assert not case_errors,case_errors
       if args.checks and args.stage=='after' and width==390 and theme=='light' and state=='scores':
        from batch2_interactions import run_mobile
        record['mobileChecks']=run_mobile(page,key,out)
        assert not case_errors,case_errors
      finally:context.close()
    if args.stage=='after':
     context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
     try:
      page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)[:500]));page.goto(base+'/__batch2',wait_until='networkidle',timeout=60000)
      assert page.locator('.batch-review h2').count()==3
      page.locator('.batch-review details').first.locator('summary').click();page.wait_for_function('Array.from(document.querySelectorAll(".batch-review details[open] img")).every(x=>x.complete&&x.naturalWidth>0)')
      page.screenshot(path=str(shots/'review-entry.png'))
     finally:context.close()
     assert not errors,errors
    assert not writes,writes
   finally:browser.close()
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 (out/('review-entry-browser.json' if args.entry_only else args.stage+'-browser.json')).write_text(json.dumps({'stage':args.stage,'source':args.source or str(root/'taiko_viewer'),'fixtureSha256':hashlib.sha256((preview/'server/utils/batch2-fixtures.ts').read_bytes()).hexdigest(),'records':records,'errors':errors,'writes':writes,'serverStopped':server is None or server.poll() is not None},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':args.stage,'cases':len(records),'errors':len(errors),'writes':len(writes)}))
