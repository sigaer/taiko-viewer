import json,signal
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(120)
root=Path(__file__).resolve().parents[1];records=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  c=b.new_context(viewport={'width':3000,'height':1200},device_scale_factor=1,reduced_motion='reduce');page=c.new_page();page.set_default_timeout(8000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto((root/'compare.html').as_uri(),wait_until='load');page.evaluate('document.fonts.ready')
  for w in [1440,390]:
   page.locator(f'[data-width="{w}"]').click()
   for name in ['song','training','home','progress']:
    page.locator(f'[data-page="{name}"]').click();page.locator('#pair img').evaluate_all('(es)=>Promise.all(es.map(e=>e.decode()))')
    page.locator('#pair').evaluate('(e,w)=>{e.style.width=(w*2+24)+"px";e.style.gridTemplateColumns=`${w}px ${w}px`;e.style.justifyContent="start"}',w)
    path=f'screenshots/{name}-{w}-compare.png';page.locator('#pair').screenshot(path=str(root/path));records.append({'file':path,'left':'V1','right':'V2','sourceViewportWidth':w,'sourceViewportHeight':1000 if w==1440 else 844,'scale':1})
  page.set_viewport_size({'width':1600,'height':1200});page.goto((root/'references.html').as_uri(),wait_until='load');page.evaluate('document.fonts.ready')
  page.add_style_tag(content='.sources,.sources.phone{display:block}.sources>div:nth-child(2){display:none}.annotated{max-width:none!important}')
  for w,h in [(1440,1000),(390,844)]:
   for name in ['home','music']:
    stem=f'moe-{name}-{w}';figure=page.locator(f'#{stem} .annotated');figure.evaluate('(e,w)=>e.style.width=w+"px"',w);figure.screenshot(path=str(root/'references'/f'{stem}-annotated.png'));records.append({'file':f'references/{stem}-annotated.png','width':w,'height':h,'annotation':'HTML overlay, source PNG unchanged'})
  assert not errors,errors
  (root/'review-export.json').write_text(json.dumps({'files':records,'browserErrors':errors},ensure_ascii=False,indent=2));print('Exported eight native-size V1/V2 comparison boards and four annotated reference images.',flush=True);c.close()
 finally:b.close()
