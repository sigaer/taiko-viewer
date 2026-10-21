"""Serial real-component captures. Inputs are isolated deterministic fixtures."""
import argparse,hashlib,json,os,signal,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from completion_output import review_output
ap=argparse.ArgumentParser();ap.add_argument('stage',choices=['before','after']);ap.add_argument('--source');ap.add_argument('--checks',action='store_true');args=ap.parse_args()
signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';out=review_output();shots=out/'screenshots';shots.mkdir(exist_ok=True)
source=Path(args.source) if args.source else root/'taiko_viewer'
for link,target in [(preview/'node_modules',root/'taiko_viewer/node_modules'),(source/'node_modules',root/'taiko_viewer/node_modules'),(source/'.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch()
env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1',VIEWER_BATCH2_EVIDENCE=str(out))
base='http://127.0.0.1:3208';server=None;records=[];errors=[];writes=[];checks=[]
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
     cases=[(1440,'light','zh','scores'),(390,'light','zh','scores'),(414,'dark','ja','scores')] if key!='scores' else [(414,'light','zh','scores'),(414,'dark','ja','scores')]
     if args.stage=='after' and key!='scores':cases += [(390,'light','zh',s) for s in (['growth-empty','growth-single','growth-missing','growth-unknown','guest','unbound','growth-failure'] if key=='growth' else ['growth-limited','growth-incompatible','growth-no-next','growth-quiet','growth-no-play','growth-empty','guest','unbound','growth-failure'])]
     for width,theme,lang,state in cases:
      context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 846},is_mobile=width<720,has_touch=width<720,reduced_motion='reduce',service_workers='block')
      try:
       context.add_cookies([{'name':'song_preview_state','value':state,'url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
       page=context.new_page();page.set_default_timeout(12000);case_errors=[];page.on('pageerror',lambda e:case_errors.append(str(e)[:300]));page.on('request',lambda r:writes.append({'method':r.method,'url':r.url}) if '/api/' in r.url and r.method not in ['GET','HEAD'] else None)
       route='/account/songs' if key=='scores' else '/my/'+key
       page.goto(base+('/ja' if lang=='ja' else '')+route,wait_until='networkidle',timeout=60000);page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false');page.wait_for_timeout(250)
       record={'page':key,'width':width,'theme':theme,'locale':lang,'state':state,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth+2'),'errors':case_errors}
       assert not case_errors,record
       if args.stage=='after':assert not record['overflow'],record
       name=f'{args.stage}-{key}-{width}-{theme}-{lang}-{state}.png';page.screenshot(path=str(shots/name),full_page=True);record['screenshot']='screenshots/'+name;records.append(record)
       if args.stage=='before' and key=='weekly' and width==1440:
        calls=[];page.on('request',lambda r:calls.append(r.url) if '/api/account/growth/weekly' in r.url else None)
        page.evaluate('document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state["account-binding-generation"]++');page.wait_for_timeout(300)
        checks.append({'check':'baseline-weekly-binding-switch','newRequests':len(calls),'oldReportRemains':page.locator('.weekly-hero').count()==1})
       if args.stage=='after' and args.checks and key!='scores' and state=='scores':
        from growth_interactions import run
        checks.extend(run(page,context,key,width,lang,base,out))
       if args.stage=='after' and key!='scores' and state=='growth-failure':
        context.add_cookies([{'name':'song_preview_state','value':'scores','url':base}]);page.locator('main.'+('passport' if key=='growth' else 'weekly')+'-page button').first.click();page.locator('.'+('passport' if key=='growth' else 'weekly')+'-hero').wait_for();checks.append({'check':key+'-failure-retry','pass':True})
       errors.extend(case_errors)
      finally:context.close()
    assert not errors,errors
    assert not writes,writes
   finally:browser.close()
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 (out/(args.stage+'-browser.json')).write_text(json.dumps({'stage':args.stage,'source':str(source),'fixtureSha256':hashlib.sha256((preview/'server/utils/growth-fixtures.ts').read_bytes()).hexdigest(),'records':records,'checks':checks,'errors':errors,'writes':writes,'serverStopped':server is None or server.poll() is not None},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':args.stage,'cases':len(records),'checks':len(checks),'errors':len(errors),'writes':len(writes)}))
