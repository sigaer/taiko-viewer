"""Bounded real Nuxt page capture; call through scripts/memory/run_qa.sh."""
import argparse,json,os,signal,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(600)
parser=argparse.ArgumentParser();parser.add_argument('version',choices=['before','after']);parser.add_argument('--smoke',action='store_true');parser.add_argument('--lang',choices=['zh','ja']);args=parser.parse_args()
preview=Path(__file__).resolve().parent;repo=preview.parents[1];out=repo/'docs/song-detail-preview-20261020';shots=out/'screenshots';shots.mkdir(parents=True,exist_ok=True)
source=Path('/home/sigaer/taiko/releases/p0-0.85.0-rc.3/taiko-forum/taiko_viewer') if args.version=='before' else repo/'taiko_viewer'
node='/www/server/nvm/versions/node/v24.13.0/bin/node';env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env.update(SONG_PREVIEW_SOURCE=str(source),NUXT_TELEMETRY_DISABLED='1',NUXT_PUBLIC_GOOGLE_ANALYTICS_ID='',NUXT_PUBLIC_WEB_VITALS_SAMPLE_RATE='0')
empty=preview/'.env.preview-empty';empty.write_text('')
log=open(out/f'{args.version}-server.log','w');rows=[];errors=[]
if args.lang and (out/f'{args.version}-capture.json').exists():
 rows=[row for row in json.loads((out/f'{args.version}-capture.json').read_text()) if row['locale']!=args.lang]
server=subprocess.Popen([node,str(repo/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(empty)],cwd=preview,env=env,stdout=log,stderr=log,start_new_session=True)
try:
 for _ in range(180):
  if server.poll() is not None:raise RuntimeError('Nuxt exited; inspect '+str(out/f'{args.version}-server.log'))
  try:
   with urllib.request.urlopen('http://127.0.0.1:3208/api/content/songs/1455',timeout=2) as r:
    if r.status==200:break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Nuxt did not become ready')
 print('Nuxt ready',args.version,flush=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   for width,height in [(1440,1000),(390,844)]:
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,locale='zh-CN',service_workers='block',reduced_motion='reduce',is_mobile=width==390,has_touch=width==390)
    try:
     page=context.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)[:300]))
     for lang in ([args.lang] if args.lang else ['zh'] if args.smoke else ['zh','ja']):
      for song_id in ([1455] if args.smoke else [1455,1]):
       for state in (['scores'] if args.smoke else ['scores','guest','empty']):
        context.add_cookies([{'name':'song_preview_state','value':state,'url':'http://127.0.0.1:3208'},{'name':'viewer_locale','value':lang,'url':'http://127.0.0.1:3208'}])
        errors.clear();path=('' if lang=='zh' else '/ja')+f'/songs/{song_id}?previewState={state}'
        page.goto('http://127.0.0.1:3208'+path,wait_until='domcontentloaded',timeout=90000)
        page.locator('.song-detail-page').wait_for(state='visible',timeout=60000);page.locator('.song-cover-picture img').wait_for(state='visible',timeout=20000)
        page.evaluate('document.fonts.ready');page.wait_for_timeout(1400)
        if args.version=='after':
         page.locator('.chart-sheet img').wait_for(state='visible',timeout=12000)
         page.wait_for_function('document.querySelector(".chart-sheet img")?.naturalWidth>0',timeout=20000)
         page.locator('.chart-state').wait_for(state='hidden',timeout=10000)
        stem=f'{args.version}-{song_id}-{state}-{lang}-{width}'
        page.screenshot(path=str(shots/(stem+'.png')),timeout=15000)
        # Full-page views include the entire real component tree; the fixed mobile navigation remains at its browser position.
        if state=='scores':page.screenshot(path=str(shots/(stem+'-full.png')),full_page=True,timeout=15000)
        row={'image':stem+'.png','version':args.version,'songId':song_id,'state':state,'locale':lang,'viewport':{'width':width,'height':height},'route':path,'errors':list(errors),'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth'),'chart':page.locator('.chart-sheet img').evaluate('(e)=>({src:e.currentSrc,width:e.naturalWidth,height:e.naturalHeight})') if args.version=='after' else None,'text':page.locator('.song-detail-page').inner_text()[:6500]}
        rows.append(row);(out/f'{args.version}-capture.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(stem,'errors',len(errors),'overflow',row['overflow'],flush=True)
    finally:context.close()
  finally:browser.close()
finally:
 os.killpg(server.pid,signal.SIGTERM)
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait(timeout=5)
 log.close();print('Nuxt preview stopped',server.returncode,flush=True)
