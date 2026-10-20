"""Real Nuxt multi-page review. Bounded wrapper required; no production writes."""
import argparse, hashlib, json, os, resource, signal, subprocess, threading, time, urllib.request, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['before','after']);parser.add_argument('--compat',action='store_true');parser.add_argument('--checks',action='store_true');parser.add_argument('--only');parser.add_argument('--space',action='store_true');parser.add_argument('--probe',action='store_true');parser.add_argument('--home-width',choices=['before','after']);args=parser.parse_args()
signal.alarm(840)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';out=root/'docs/viewer-lightness-20261020';shots=out/'screenshots';shots.mkdir(parents=True,exist_ok=True)
source=Path('/var/tmp/viewer-light-before-20261020/taiko_viewer') if args.stage=='before' else root/'taiko_viewer'
env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1')
node='/www/server/nvm/versions/node/v24.13.0/bin/node';log=open(out/f'{args.stage}-server.log','w');server=None;records=[];errors=[];font_records=[]
cg=Path('/sys/fs/cgroup')/Path('/proc/self/cgroup').read_text().strip().split('0::')[-1].lstrip('/');peak=0;stop=threading.Event()
def monitor():
 global peak
 while not stop.wait(.2):
  try:peak=max(peak,int((cg/'memory.current').read_text()))
  except OSError:pass
thread=threading.Thread(target=monitor,daemon=True);thread.start();started=time.monotonic()
def save(name,data):(out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2))
try:
 server=subprocess.Popen([node,str(root/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],env=env,cwd=preview,stdout=log,stderr=log,start_new_session=True)
 for _ in range(120):
  if server.poll() is not None:raise RuntimeError('Nuxt exited')
  try:urllib.request.urlopen('http://127.0.0.1:3208/api/content/songs/1455',timeout=2);break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Nuxt readiness deadline')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   cases=[(w,h,theme,'zh') for w,h in [(414,846),(390,844),(820,1000),(1440,1000)] for theme in ['light','dark']]
   cases += [(414,846,'light','ja'),(1440,1000,'dark','ja')]
   if args.space:cases=[(w,846 if w<768 else 1000,theme,'zh') for w in [414,390,820,1280,1440,1920] for theme in ['light','dark']]+[(414,846,'light','ja'),(1440,1000,'dark','ja')]
   if args.compat:cases=[(414,846,'light','zh'),(1440,1000,'dark','ja')]
   if args.checks or args.home_width or args.probe:cases=[]
   for width,height,theme,lang in cases:
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=width<768,has_touch=width<768,reduced_motion='reduce',locale='ja-JP' if lang=='ja' else 'zh-CN',service_workers='block')
    try:
     context.add_cookies([{'name':'song_preview_state','value':'scores','url':'http://127.0.0.1:3208'},{'name':'taiko_theme','value':theme,'url':'http://127.0.0.1:3208'}]);context.add_init_script(f'localStorage.setItem("taiko_theme",{json.dumps(theme)})')
     page=context.new_page();page.set_default_timeout(20000);page.on('pageerror',lambda e:errors.append(e.stack[:2500]))
     pages=[('catalog','/songs/available'),('song','/songs/1455'),('recommend','/tools/recommend'),('profile','/account/profile')]
     if args.space:pages=[('home','/'),*pages]
     if args.compat:pages=[('admin-login','/admin/taiko/login'),('home','/'),('scores','/account/songs'),('growth','/my/growth'),('weekly','/my/weekly'),('community','/forum'),('developer','/docs/score-token'),('settings','/settings'),('annual','/annual'),('b30','/tools/b30'),('progress','/tools/progress')]
     if args.only:pages=[(key,path) for key,path in pages if key==args.only]
     for key,path in pages:
      if args.compat:
       context.close();context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=width<768,has_touch=width<768,reduced_motion='reduce',locale='ja-JP' if lang=='ja' else 'zh-CN',service_workers='block')
       context.add_cookies([{'name':'song_preview_state','value':'scores','url':'http://127.0.0.1:3208'},{'name':'taiko_theme','value':theme,'url':'http://127.0.0.1:3208'}])
       page=context.new_page();page.set_default_timeout(20000);page.on('pageerror',lambda e:errors.append(e.stack[:2500]))
      requests=[];listener=lambda r:requests.append(r.url) if urllib.parse.urlparse(r.url).path.startswith('/api/') else None;page.on('request',listener)
      prefix='' if lang=='zh' or key=='admin-login' else '/ja';url='http://127.0.0.1:3208'+prefix+path+'?previewState=scores'
      page.goto(url,wait_until='domcontentloaded',timeout=90000)
      try:page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false',timeout=90000)
      except Exception:
       page.screenshot(path=str(out/'capture-failure.png'));save('capture-failure.json',{'url':page.url,'errors':errors,'body':page.locator('body').inner_text()[:2500],'app':page.evaluate('()=>{let a=document.querySelector("#__nuxt")?.__vue_app__;return {mounted:a?._instance?.isMounted,hydrating:a?.$nuxt?.isHydrating,ready:document.readyState}}')});raise
      page.evaluate('document.fonts.ready')
      if key=='catalog':
       page.wait_for_function('document.querySelectorAll(".song-card-link").length>0')
       for _ in range(8):
        if page.locator('.song-card-link').count()>=60:break
        page.locator('.load-more-row').scroll_into_view_if_needed();page.wait_for_timeout(600)
       assert page.locator('.song-card-link').count()==60
      elif key=='recommend':
       page.get_by_role('button',name='推薦を表示' if lang=='ja' else '查看推荐',exact=True).click();page.get_by_test_id('ordinary-list').wait_for();assert page.get_by_test_id('ordinary-list').locator('article').count()==20
      elif key=='profile':page.locator('.binding-card input').first.wait_for()
      elif key=='progress':page.locator('.progress-form').wait_for()
      elif key=='song':page.wait_for_function('document.querySelector(".chart-sheet img")?.naturalWidth>0')
      page.wait_for_timeout(400);page.evaluate('window.scrollTo(0,0)')
      # Wait for visible real covers, retaining failures and placeholders as-is.
      page.evaluate('''()=>Promise.all([...document.querySelectorAll('.song-cover-picture img')].filter(e=>{let r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}).map(e=>new Promise(resolve=>{if(e.complete&&e.naturalWidth)return resolve();let done=()=>resolve();e.addEventListener('load',done,{once:true});setTimeout(done,4000)})))''')
      name=f'{args.stage}-{key}-{width}-{theme}-{lang}'
      page.screenshot(path=str(shots/(name+'.png')))
      if key=='recommend' and width in [414,1440] and lang=='zh' and theme=='light':page.screenshot(path=str(shots/(name+'-full.png')),full_page=True)
      row={'route':url,'page':key,'width':width,'height':height,'theme':theme,'locale':lang,'browser':browser.version,'image':name+'.png','overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),'clientApiRequests':requests,'layout':page.locator('.viewer-content').get_attribute('data-content-layout') if page.locator('.viewer-content').count() else 'dedicated','geometry':page.evaluate('()=>Object.fromEntries([".app-content",".viewer-content",".page-body",".page-header",".breadcrumb-bar"].map(s=>{let e=document.querySelector(s),r=e?.getBoundingClientRect();return [s,r?{x:r.x,width:r.width,right:r.right}:null]}))'),'recordCount':page.get_by_test_id('ordinary-list').locator('article').count() if key=='recommend' else page.locator('.song-card-link').count() if key=='catalog' else None}
      records.append(row);save(f'{args.stage}{"-compat" if args.compat else "-probe" if args.probe else "-interactions" if args.checks else "-home-width-"+args.home_width if args.home_width else ""}-capture.json',records);print(name,'overflow',row['overflow'],flush=True)
      if key in ['song','recommend'] and width==414:
       cdp=context.new_cdp_session(page);cdp.send('DOM.enable');cdp.send('CSS.enable');doc=cdp.send('DOM.getDocument')
       for selector in ['h1','.secondary-title','.song-category','.score-primary strong','.song-action--primary','.target-item__title','.target-item__meta','.mode-tab']:
        element=page.locator(selector).first
        if not element.count():continue
        node_id=cdp.send('DOM.querySelector',{'nodeId':doc['root']['nodeId'],'selector':selector})['nodeId']
        font_records.append({'page':key,'theme':theme,'locale':lang,'selector':selector,'actual':cdp.send('CSS.getPlatformFontsForNode',{'nodeId':node_id})['fonts'],'computed':element.evaluate('(e)=>{let s=getComputedStyle(e);return {family:s.fontFamily,weight:s.fontWeight,size:s.fontSize,color:s.color}}')})
       cdp.detach();save(f'{args.stage}-fonts.json',font_records)
      page.remove_listener('request',listener)
    finally:context.close()
   if args.probe:
    from probe import run
    run(browser,out)
   if args.home_width:
    from home_width import run
    run(browser,out,args.home_width)
   if args.checks:
    from interaction import run
    run(browser,root,out)
  finally:browser.close()
 save(f'{args.stage}{"-compat" if args.compat else "-probe" if args.probe else "-interactions" if args.checks else "-home-width-"+args.home_width if args.home_width else ""}-errors.json',errors)
 assert not errors,errors[:3]
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait(timeout=5)
 log.close();stop.set();thread.join(1)
 save(f'{args.stage}{"-compat" if args.compat else "-probe" if args.probe else "-interactions" if args.checks else "-home-width-"+args.home_width if args.home_width else ""}-resources.json',{'durationSeconds':round(time.monotonic()-started,2),'sampledPeakBytes':peak,'samplingMs':200,'kernelPeakBytes':int((cg/'memory.peak').read_text()) if (cg/'memory.peak').exists() else None,'maxChildRssKiB':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,'events':(cg/'memory.events').read_text(),'serverExit':server.returncode if server else None,'limitation':'Sampling may miss short peaks; child RSS maximum is not an aggregate.'})
 print('Owned preview stopped',flush=True)
