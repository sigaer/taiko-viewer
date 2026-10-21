from completion_output import review_output
"""Bounded, opt-in Nuxt component QA. Never a production business-write test."""
import argparse,hashlib,json,os,re,signal,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['before','after']);parser.add_argument('--source',type=Path);parser.add_argument('--probe',action='store_true');parser.add_argument('--goal-relocated-only',action='store_true');args=parser.parse_args()
signal.alarm(720)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';source=args.source or root/'taiko_viewer'
out=review_output();out.mkdir(parents=True,exist_ok=True);shots=out/'screenshots';shots.mkdir(exist_ok=True)
for link,target in [(preview/'node_modules',root/'taiko_viewer/node_modules'),(root/'taiko_viewer/.nuxt',preview/'.nuxt')]:
 if not link.exists() and not link.is_symlink():link.symlink_to(target,target_is_directory=True)
(preview/'.env.preview-empty').touch()
env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1')
node='/www/server/nvm/versions/node/v24.13.0/bin/node';base='http://127.0.0.1:3208';server=None;records=[];errors=[];writes=[];started=time.monotonic()
conditions=[(1440,'light','zh','changes'),(390,'dark','ja','changes'),(414,'light','ja','changes'),(390,'light','zh','played-only'),(414,'dark','zh','no-play'),(1440,'dark','ja','unknown'),(414,'light','zh','daily-loading'),(390,'light','ja','daily-failed'),(1440,'light','zh','recent-failed'),(414,'dark','ja','recent-loading'),(390,'light','zh','recent-unknown'),(390,'light','zh','no-recommendations'),(1000,'light','zh','changes'),(1180,'light','zh','changes'),(1000,'light','zh','latest-loading'),(390,'light','zh','latest-loading')]
if args.probe:conditions=conditions[:2]
if args.goal_relocated_only:conditions=[(390,'light','zh','goal-and-played'),(1440,'dark','ja','goal-and-played')]
try:
 with (out/f'{args.stage}-preview.log').open('w') as log:
  server=subprocess.Popen([node,str(root/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('preview exited')
   try:urllib.request.urlopen(base+'/api/content/songs/1455',timeout=2);break
   except Exception:time.sleep(1)
  else:raise RuntimeError('preview readiness deadline')
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for width,theme,lang,state in conditions:
     context=browser.new_context(viewport={'width':width,'height':1000 if width>720 else 846},is_mobile=width<720,has_touch=width<720,service_workers='block',reduced_motion='reduce')
     try:
      context.add_cookies([{'name':'song_preview_state','value':'scores','url':base},{'name':'taiko_theme','value':theme,'url':base}]);context.add_init_script('localStorage.setItem("taiko_theme",'+json.dumps(theme)+')')
      page=context.new_page();page.set_default_timeout(18000);page.on('pageerror',lambda e:errors.append(str(e)[:500]))
      page.on('request',lambda r:writes.append({'method':r.method,'url':r.url}) if '/api/' in r.url and r.method not in ['GET','HEAD'] else None)
      prefix='/ja' if lang=='ja' else ''
      response=page.goto(base+prefix+'/__completion?state='+state,wait_until='networkidle',timeout=60000)
      assert response and response.status==200,(lang,state,response.status if response else None)
      page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false')
      page.locator('.growth-surface').wait_for();page.wait_for_timeout(200)
      daily=page.locator('.growth-progress');recent=page.locator('.recent-growth__fact');latest=page.locator('.guest-latest');cards=latest.locator('.guest-song-card')
      row={'width':width,'theme':theme,'locale':lang,'state':state,'dailyEvents':daily.locator('.growth-event').count(),'recentFacts':recent.count(),'cards':cards.count()}
      boxes=cards.evaluate_all('(xs)=>xs.map(x=>({x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))')
      row['cardGeometry']=boxes
      assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2'),row
      if args.stage=='after':
       assert cards.count()==5,row
       if state=='latest-loading':assert cards.locator('.guest-song-card__cover').count()==5
       if width>720:assert len(set(round(b['y']) for b in boxes))==1,row
       else:
        rail=page.locator('.guest-latest__rail');assert rail.evaluate('(e)=>e.scrollWidth>e.clientWidth'),row
        rail.evaluate('(e)=>e.scrollLeft=e.scrollWidth');assert rail.evaluate('(e)=>e.scrollLeft>0')
        assert cards.last.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left<innerWidth&&r.right>0}'),row
        rail.evaluate('(e)=>e.scrollLeft=0')
       if state not in ['daily-loading','daily-failed']:
        assert daily.count()==1,row
        assert daily.locator('h2').inner_text()==('今日の進捗' if lang=='ja' else '今日进展')
        assert daily.locator('.growth-progress__count').count()==(0 if state=='unknown' else 1 if state!='no-play' else 0)
       else:assert daily.count()==0 and recent.count()==3,row
       if state not in ['daily-loading','daily-failed','unknown','no-play','played-only','goal-and-played']:
        assert row['dailyEvents']==2,row
        assert '980,000' in daily.inner_text() and '970,000' in daily.inner_text()
        if state=='recent-failed':assert page.locator('.recent-growth__state button').is_visible()
        if state in ['recent-loading','recent-failed','recent-unknown']:assert recent.count()==0,row
        else:assert recent.count()==2,row
       if state=='goal-and-played':
        assert row['dailyEvents']==1 and page.locator('.growth-goal--completed').count()==1,row
        assert ('今天的变化已经记在上面了' if lang=='zh' else '今日の変化は上にまとめています') in daily.inner_text()
        assert ('暂无可确认的成绩变化' if lang=='zh' else '成績の変化はまだ確認できません') not in daily.inner_text()
       if state=='played-only':assert row['dailyEvents']==2 and '→' not in daily.inner_text()
       if state in ['no-play','unknown']:assert row['dailyEvents']==0
       if state not in ['daily-loading','daily-failed']:
        if state=='no-recommendations':assert page.locator('.growth-plan__choice').count()==0
        else:
         choices=page.locator('.growth-plan__choice');assert choices.count()==3
         assert choices.nth(0).locator('button').count()==1
         assert choices.nth(1).locator('button').count()==choices.nth(2).locator('button').count()==0
         assert choices.nth(1).locator('p').inner_text()!=choices.nth(2).locator('p').inner_text()
         assert all(x.get_attribute('href') for x in page.locator('.growth-plan__choice a[href]').all())
         if state=='changes' and width==1440:
          choices.nth(0).locator('button').click();assert page.locator('dialog[open]').count()==1
          page.keyboard.press('Escape');assert page.locator('dialog[open]').count()==0
       if state!='latest-loading':
        ids=cards.evaluate_all('(xs)=>xs.map(x=>new URL(x.href).pathname.split("/").at(-1))')
        expected=[str(x['id']) for x in json.loads((preview/'review/completion-inputs.json').read_text())['latestSongs'][:5]]
        assert ids==expected,(ids,expected)
        assert page.locator('.guest-latest a').last.get_attribute('href')
      row['palette']=page.evaluate('''()=>Object.fromEntries(['bg','surface','surface-subtle','text','text-muted','link','primary','border'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--viewer-'+k).trim()]))''')
      name=f'{args.stage}-{state}-{width}-{theme}-{lang}.png';page.locator('.growth-surface').screenshot(path=str(shots/name));row['screenshot']='screenshots/'+name
      latest.screenshot(path=str(shots/(name.replace('.png','-latest.png'))));records.append(row)
     finally:context.close()
   finally:browser.close()
 assert not errors,errors
 assert not writes,writes
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 result={'run':os.environ.get('QA_RUN_DIR'),'stage':args.stage,'source':str(source),'fixtureSha256':hashlib.sha256((preview/'review/completion-inputs.json').read_bytes()).hexdigest(),'cases':records,'pageErrors':errors,'apiWrites':writes,'seconds':round(time.monotonic()-started,2),'ownedServerStopped':server is None or server.poll() is not None}
 (out/('goal-relocated-browser.json' if args.goal_relocated_only else f'{args.stage}-browser.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':args.stage,'cases':len(records),'pass':True,'pageErrors':len(errors),'apiWrites':len(writes)}))
