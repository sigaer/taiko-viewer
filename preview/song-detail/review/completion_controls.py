from completion_output import review_output
"""Replay the existing palette-control fixture against this completion's CSS."""
import hashlib,json,os,signal,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(300)
root=Path(__file__).resolve().parents[3];preview=root/'preview/song-detail';out=review_output();shots=out/'screenshots';shots.mkdir(parents=True,exist_ok=True)
env={k:os.environ[k] for k in ['PATH','TMPDIR','NODE_OPTIONS'] if k in os.environ};env['NUXT_TELEMETRY_DISABLED']='1'
base='http://127.0.0.1:3208';rows=[];errors=[];server=None
def colors(page,selector):
 return page.locator(selector).first.evaluate('(e)=>{const s=getComputedStyle(e);return {color:s.color,bg:s.backgroundColor,shadow:s.boxShadow}}')
try:
 with (out/'controls-preview.log').open('w') as log:
  server=subprocess.Popen(['/www/server/nvm/versions/node/v24.13.0/bin/node',str(root/'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),'dev',str(preview),'--host','127.0.0.1','--port','3208','--no-fork','--dotenv',str(preview/'.env.preview-empty')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('preview exited')
   try:urllib.request.urlopen(base+'/api/content/songs/1455',timeout=2);break
   except Exception:time.sleep(1)
  else:raise RuntimeError('readiness deadline')
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   try:
    for width,theme in [(1440,'light'),(390,'dark')]:
     context=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce',service_workers='block')
     try:
      context.add_cookies([{'name':'taiko_theme','value':theme,'url':base}]);page=context.new_page();page.set_default_timeout(18000);page.on('pageerror',lambda e:errors.append(str(e)[:500]))
      page.goto(base+'/__palette-controls',wait_until='networkidle',timeout=60000)
      page.locator('.el-input:not(.is-disabled) input').first.focus();page.wait_for_timeout(350)
      row={'width':width,'theme':theme,'input':colors(page,'.el-input__wrapper'),'disabled':colors(page,'.el-input.is-disabled input')}
      link='rgb(0, 108, 118)' if theme=='light' else 'rgb(134, 217, 220)'
      surface='rgb(249, 253, 252)' if theme=='light' else 'rgb(25, 51, 56)'
      assert link in row['input']['shadow']
      page.locator('.el-select').click();page.locator('.el-popper.is-light').wait_for();row['selected']=colors(page,'.el-select-dropdown__item.is-selected');assert row['selected']['color']==link
      page.keyboard.press('Escape');page.locator('.open-dialog').click();page.locator('.el-dialog').wait_for();row['dialog']=colors(page,'.el-dialog');assert row['dialog']['bg']==surface
      page.keyboard.press('Escape');page.locator('.show-messages').click();page.locator('.el-message').first.wait_for()
      row['messages']={kind:colors(page,'.el-message--'+kind+' .el-message__content') for kind in ['success','warning','error','info']}
      assert len({v['color'] for v in row['messages'].values()})==4
      row['notification']=colors(page,'.el-notification');assert row['notification']['bg']==surface
      page.screenshot(path=str(shots/f'controls-{width}-{theme}.png'));rows.append(row)
     finally:context.close()
   finally:browser.close()
 assert not errors,errors
finally:
 if server and server.poll() is None:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=12)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
 (out/'controls.json').write_text(json.dumps({'pass':len(rows)==2 and not errors,'cases':rows,'pageErrors':errors,'paletteSha256':hashlib.sha256((root/'taiko_viewer/assets/css/tokens.css').read_bytes()).hexdigest()},indent=2)+'\n')
print('PASS: 2 current-source Element Plus control conditions')
