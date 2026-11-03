import json,signal,threading,http.server,functools
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(240)
root=Path(__file__).resolve().parents[1];out=root/'screenshots';rows=[]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   for w,h in [(1440,1000),(390,844)]:
    c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=1,locale='zh-CN',reduced_motion='reduce')
    try:
     page=c.new_page();page.set_default_timeout(8000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     for name in ['song','training','home','progress']:
      for version in ['v1','v2']:
       errors.clear();url=f'http://127.0.0.1:{server.server_port}/{version}/index.html?view={name}&state=ready&lang=zh&capture=1'
       page.goto(url,wait_until='networkidle');page.evaluate('document.fonts.ready');page.wait_for_timeout(150)
       stem=f'{name}-{w}-{version}'
       page.screenshot(path=str(out/(stem+'.png')))
       page.screenshot(path=str(out/(stem+'-full.png')),full_page=True)
       measured=page.evaluate('''()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {y:r.y,height:r.height,width:r.width,text:e.textContent.trim().slice(0,130)}};return {title:rect('main h1'),firstRecommendation:rect('.recommendation-item'),chart:rect('.chart-panel'),chartActions:rect('.chart-actions'),trend:rect('#trend-slot'),pageHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth}}''')
       rows.append({'image':stem+'.png','fullImage':stem+'-full.png','page':name,'version':version,'viewport':{'width':w,'height':h},'state':'ready','lang':'zh','dpr':1,'errors':list(errors),'measured':measured});print(stem,measured,flush=True)
       (out/'capture.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
    finally:c.close()
  finally:b.close()
finally:
 server.shutdown();server.server_close();thread.join(2)
