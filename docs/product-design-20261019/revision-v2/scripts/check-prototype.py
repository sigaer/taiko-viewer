import json,signal,threading,http.server,functools
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(180)
root=Path(__file__).resolve().parents[1];out=root/'screenshots';rows=[]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,locale='zh-CN',reduced_motion='reduce');page=c.new_page();page.set_default_timeout(6000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def visit(name,state='ready',lang='zh',extra=''):
    page.goto(f'http://127.0.0.1:{server.server_port}/v2/index.html?view={name}&state={state}&lang={lang}&capture=1'+extra,wait_until='networkidle');page.evaluate('document.fonts.ready')
   for name in ['song','training','home','progress']:
    for state in ['guest','unbound','empty','no-goal','loading','error','completed','partial']:
     errors.clear();visit(name,state);assert not errors,(name,state,errors)
     rows.append({'page':name,'state':state,'render':'ok'})
   for name in ['song','training','home','progress']:
    visit(name,lang='ja');page.screenshot(path=str(out/f'{name}-390-v2-ja.png'));assert not errors
   visit('training');page.locator('.v2-goal-management summary').click();assert page.locator('[data-action="cancel-goal"]').is_visible();assert page.locator('[data-action="goal"]').is_visible()
   page.screenshot(path=str(out/'training-390-v2-management.png'))
   page.locator('.v2-goal-management summary').click();page.locator('.v2-filter-more summary').click();assert page.locator('input[type=number]').is_visible();assert page.locator('input[type=checkbox]').is_visible()
   page.screenshot(path=str(out/'training-390-v2-options.png'))
   page.locator('[data-mode=target]').click();assert page.locator('#target-choice').is_visible();page.locator('.recommendation-item a').first.click();assert page.locator('[data-action=goal]').count()==0
   visit('song');page.locator('[data-difficulty="5"]').click();assert '766' in page.locator('.chart-summary').inner_text();page.locator('[data-difficulty="4"]').click()
   page.locator('[data-action=goal]').click();assert page.locator('#goal-dialog').is_visible();page.locator('input[value=ng]').check();page.locator('#goal-form button[type=submit]').click();assert page.locator('.v2-training').count()==1
   page.locator('[data-action=evaluate]').click();assert page.locator('.v2-goal-copy h2').inner_text()=='减少不可：少于 1 个'
   page.locator('[data-action=sync]').click();page.locator('[data-action=evaluate]').click();assert page.locator('.v2-goal-copy h2').inner_text()=='不可 1 → 0';page.screenshot(path=str(out/'training-390-v2-completed.png'))
   page.locator('.v2-goal-management summary').click();page.locator('[data-action=cancel-goal]').click();assert page.locator('.v2-goal-summary').count()==0;assert page.locator('.recommendation-item').count()==3
   visit('home','no-goal');page.screenshot(path=str(out/'home-390-v2-no-goal.png'));assert page.locator('.v2-home-recent').is_visible()
   visit('progress','partial')
   page.locator('[data-range="30"]').click()
   assert page.locator('[data-range="30"]').get_attribute('aria-pressed')=='true'
   page.locator('#chart-dimension').select_option(label='精度力')
   page.locator('.disclosure summary').click()
   assert page.locator('.chart-table').is_visible()
   assert page.locator('#table-dimension').inner_text()=='精度力',repr(page.locator('#table-dimension').inner_text())
   page.screenshot(path=str(out/'progress-390-v2-partial.png'))
   visit('home');page.evaluate("document.body.classList.remove('capture')");page.locator('#review-theme').click();page.evaluate("document.body.classList.add('capture')");page.screenshot(path=str(out/'home-390-v2-dark.png'))
   # Test actual file:// delivery independently of the temporary HTTP server.
   page.goto((root/'v2/index.html').as_uri()+'?view=song&capture=1',wait_until='load');assert page.locator('.v2-song').count()==1;assert not errors,errors
   (root/'prototype-check.json').write_text(json.dumps({'scope':'Independent prototype only; not a production or backend regression suite, and not an aesthetic verdict.','viewport':{'width':390,'height':844},'stateRenders':rows,'retainedInteractions':['goal management/replacement/cancel','recommendation options/count 1–50/image checkbox','ordinary vs target recommendation eligibility','difficulty + note count','goal selection/confirmation','no completion before explicit sync','sync then completion','progress range/metric/table','file:// direct opening'],'errors':errors},ensure_ascii=False,indent=2));print('Prototype states, retained interactions, and file:// opening checked.',flush=True)
   c.close()
  finally:b.close()
finally:server.shutdown();server.server_close();thread.join(2)
