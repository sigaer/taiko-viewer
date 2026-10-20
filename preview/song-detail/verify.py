"""Exercise retained song-page controls; no business writes or backend suite."""
import json,os,signal,subprocess,time,urllib.request,threading,resource
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(300)
preview=Path(__file__).resolve().parent;repo=preview.parents[1];out=repo/'docs/song-detail-preview-20261020';shots=out/'screenshots';checks=[];errors=[];mutations=[]
group=Path('/proc/self/cgroup').read_text().strip().split('0::')[-1];cg=Path('/sys/fs/cgroup')/group.lstrip('/');stop_memory=threading.Event();sampled_peak=0
def sample_memory():
 global sampled_peak
 while not stop_memory.wait(.2):
  try:sampled_peak=max(sampled_peak,int((cg/'memory.current').read_text()))
  except OSError:pass
memory_thread=threading.Thread(target=sample_memory,daemon=True);memory_thread.start()
node='/www/server/nvm/versions/node/v24.13.0/bin/node';env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(NUXT_TELEMETRY_DISABLED='1',NUXT_PUBLIC_GOOGLE_ANALYTICS_ID='',NUXT_PUBLIC_WEB_VITALS_SAMPLE_RATE='0')
log=open(out/'controls-server.log','w');server=subprocess.Popen([node,str(repo/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=preview,env=env,stdout=log,stderr=log,start_new_session=True)
try:
 for _ in range(120):
  if server.poll() is not None:raise RuntimeError('Nuxt exited')
  try:urllib.request.urlopen('http://127.0.0.1:3208/api/content/songs/1455',timeout=2);break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Nuxt readiness deadline')
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
  try:
   c=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,service_workers='block',reduced_motion='reduce');page=c.new_page();page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)[:300]));page.on('request',lambda r:mutations.append({'url':r.url,'method':r.method}) if r.method not in ['GET','HEAD'] and '/api/' in r.url else None)
   def visit(path='/songs/1455?previewState=scores'):
    page.goto('http://127.0.0.1:3208'+path,wait_until='domcontentloaded',timeout=60000);page.locator('.difficulty-tabs').wait_for();page.wait_for_function('document.querySelector(".chart-sheet img")?.naturalWidth>0');page.locator('.chart-state').wait_for(state='hidden');page.wait_for_timeout(400)
   def ok(label):checks.append(label);print(label,flush=True)
   def snapshot(name):
    page.wait_for_function("document.querySelectorAll('.click-heart').length===0",timeout=6000)
    page.screenshot(path=str(shots/name))
   visit();assert page.locator('.difficulty-tab').count()==5;assert page.locator('h1').inner_text()=='无敌的HAPPINESS!(SOS团5人Ver.)';page.locator('.account-score-section .score-primary strong').filter(has_text='980,000').wait_for();ok('Long title, SSR/cached real image, initial personal record')
   for key,folder,code in [('EASY','Kantan',1),('NORMAL','Futsuu',2),('HARD','Muzukashii',3),('ONI','Oni',4),('EDIT','InnerOni',5)]:
    page.locator(f'[data-track={key}]').click();page.wait_for_function('(key)=>document.querySelector(`[data-track="${key}"]`)?.getAttribute("aria-selected")==="true"',arg=key)
    assert f'/fumen/{folder}/1455.png' in page.locator('.chart-sheet img').get_attribute('src')
    practice=page.locator('.chart-actions a').first;assert practice.get_attribute('href')==f'/ourtaikoview/1455/{code}';assert practice.get_attribute('target')=='_blank'
    sources=page.locator('.song-audio audio').evaluate_all('(es)=>es.map(e=>e.src)');assert any(f'/drum/1455_{key}.mp3' in u for u in sources);assert any(f'/mix/1455_{key}.mp3' in u for u in sources);assert any('/pure/1455.mp3' in u for u in sources)
   ok('All five difficulty selections retain matching chart/player/audio addresses')
   assert '766' in page.locator('.chart-identity').inner_text();page.locator('.score-primary strong').filter(has_text='1,000,450').wait_for();page.wait_for_function('document.querySelector(".chart-sheet img").naturalWidth>0');snapshot('after-edit-zh-1440.png');ok('EDIT uses its own combo and personal record')
   page.locator('[data-track=EDIT]').focus();page.keyboard.press('ArrowLeft');assert page.locator('[data-track=ONI]').get_attribute('aria-selected')=='true';assert page.locator('[data-track=ONI]').evaluate('(e)=>e===document.activeElement');ok('Difficulty keyboard focus follows selection')
   page.locator('.song-analysis summary').click();assert page.locator('.radar-chart').is_visible();assert page.locator('.radar-values li').count()==6;page.locator('.song-information summary').click();assert 'The Haruhi Suzumiya Series' in page.locator('.song-facts').inner_text();snapshot('after-analysis-zh-1440.png');ok('Analysis and complete song metadata remain reachable')
   page.locator('.song-audio summary').click()
   play=page.locator('.song-audio audio').nth(1);assert play.evaluate('(e)=>Promise.race([e.play().then(()=>true),new Promise(r=>setTimeout(()=>r(false),12000))])'), 'Public mix audio did not start within the bounded wait';page.wait_for_function('document.querySelectorAll(".song-audio audio")[1].currentTime>0.2',timeout=20000);media=play.evaluate('(e)=>({duration:e.duration,readyState:e.readyState,currentTime:e.currentTime,src:e.currentSrc})');play.evaluate('(e)=>e.pause()');ok('Existing public mix audio loads and advances in the native player')
   assert page.locator('.chart-footer a').get_attribute('href')=='/api/content/songs/1455/tja-package'
   compose=page.locator('.related-discussions__compose').get_attribute('href');assert 'songId=1455' in compose and 'difficulty=4' in compose
   assert page.locator('.ugc-difficulty-choices button').count()==5;assert page.locator('.ugc-tag-editor-toggle').is_visible();assert page.locator('.ugc-tip-primary').first.is_visible();ok('Download, discussion, difficulty vote, tags and tips entries retained')
   visit('/songs/1?difficulty=5&previewState=scores');assert page.locator('.difficulty-tab').count()==4;assert page.locator('[data-track=ONI]').get_attribute('aria-selected')=='true';assert '/Oni/1.png' in page.locator('.chart-sheet img').get_attribute('src');ok('No EDIT: four choices and invalid EDIT deep link falls back to ONI')
   visit('/songs/1455?difficulty=4&recommendation=preview-only-invalid&previewState=scores');assert page.locator('.recommendation-goal-action').is_visible();snapshot('after-goal-entry-zh-1440.png');page.locator('[data-track=EDIT]').click();assert page.locator('.recommendation-goal-action').count()==0;page.locator('[data-track=ONI]').click();assert page.locator('.recommendation-goal-action').is_visible()
   with page.expect_response(lambda r:'/growth/goal/preview' in r.url) as response:page.locator('.recommendation-goal-action>button').click()
   assert response.value.status==405;assert not page.locator('.goal-dialog').is_visible();ok('Goal source/difficulty conditions retained; preview POST is rejected with 405')
   visit('/songs/1455?previewState=guest');assert page.locator('.account-score-section').count()==0;page.locator('.song-login').click();page.wait_for_function("location.pathname==='/account/login' && new URL(location.href).searchParams.has('redirect')");assert 'redirect=' in page.url;ok('Guest score action uses the existing localized login redirect')
   page.set_viewport_size({'width':390,'height':844});visit('/songs/627?previewState=scores');page.locator('.song-audio summary').click();assert page.locator('.song-audio audio').count()==5
   srcs=page.locator('.song-audio audio').evaluate_all('(es)=>es.map(e=>decodeURI(e.src))');assert any('_ONI_普通.mp3' in u for u in srcs);assert any('_ONI_达人.mp3' in u for u in srcs)
   page.locator('.volume-btn').click();assert page.locator('.audio-block').first.locator('audio').evaluate_all('(es)=>es.every(e=>e.muted)')
   page.locator('.volume-slider').focus();page.keyboard.press('Home');assert page.locator('.audio-block').first.locator('audio').evaluate_all('(es)=>es.every(e=>e.volume===0)')
   page.locator('.song-audio').scroll_into_view_if_needed();snapshot('after-branches-zh-390.png');ok('Real branch variants, drum mute and shared drum volume retained on mobile')
   page.locator('.chart-sheet').scroll_into_view_if_needed();box=page.locator('.chart-sheet').bounding_box();before_y=page.evaluate('scrollY');page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.wheel(0,320);page.wait_for_timeout(350);assert page.evaluate('scrollY')>before_y;assert page.locator('.chart-sheet').evaluate('(e)=>e.scrollTop')==0;page.locator('.chart-sheet').scroll_into_view_if_needed();box=page.locator('.chart-sheet').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.wheel(220,0);page.wait_for_function('document.querySelector(".chart-sheet").scrollLeft>0',timeout=4000);ok('Narrow chart keeps horizontal browsing while vertical wheel scroll reaches the page')
   page.goto('http://127.0.0.1:3208/about',wait_until='domcontentloaded');page.wait_for_timeout(400);scope=page.evaluate('({body:getComputedStyle(document.body).getPropertyValue("--song-ink"),chrome:getComputedStyle(document.querySelector(".app-content")).getPropertyValue("--song-ink")})');assert not scope['body'].strip() and not scope['chrome'].strip();ok('Song tokens do not reach body or another route’s shell')
   assert not errors,errors
   assert len(mutations)==1 and mutations[0]['url'].startswith('http://127.0.0.1:3208/api/account/growth/goal/preview'),mutations
   # Export original-size side-by-side screenshot boards, without editing either source screenshot.
   page.goto((out/'index.html').as_uri(),wait_until='load')
   for w in [1440,390]:
    page.set_viewport_size({'width':3000 if w==1440 else 1100,'height':1200});page.locator(f'[data-width="{w}"]').click()
    for lang in ['zh','ja']:
     page.locator('#lang').select_option(lang);page.locator('#pair img').evaluate_all('(es)=>Promise.all(es.map(e=>e.decode()))');page.locator('#pair').evaluate('(e,w)=>{e.style.width=(w*2+24)+"px";e.style.gridTemplateColumns=`${w}px ${w}px`;e.style.justifyContent="start"}',w);page.locator('#pair').screenshot(path=str(shots/f'compare-{lang}-{w}.png'))
   (out/'interaction-check.json').write_text(json.dumps({'scope':'Real song component preview only; no backend business suite or production writes','checks':checks,'publicAudio':media,'apiMutations':mutations,'mutationResponse':405,'globalTokenScope':scope,'browserErrors':errors},ensure_ascii=False,indent=2));c.close()
  finally:b.close()
finally:
 os.killpg(server.pid,signal.SIGTERM)
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait(timeout=5)
 log.close()
 stop_memory.set();memory_thread.join(1)
 peak_file=cg/'memory.peak'
 metrics={'cgroup':group,'serverExitCode':server.returncode,'peakBytes':int(peak_file.read_text()) if peak_file.exists() else None,'sampledPeakBytes':sampled_peak,'sampleIntervalMs':200,'samplingLimitation':'Sampling may miss sub-200ms peaks; child MaxRSS is a maximum, not an aggregate.', 'maxChildRssKiB':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,'events':{line.split()[0]:int(line.split()[1]) for line in (cg/'memory.events').read_text().splitlines()}}
 (out/'resources-controls.json').write_text(json.dumps(metrics,indent=2))
 print('Preview server stopped',server.returncode,flush=True)
