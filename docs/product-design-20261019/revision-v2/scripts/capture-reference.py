import json,signal,time
from pathlib import Path
from playwright.sync_api import sync_playwright
signal.alarm(180)
out=Path(__file__).resolve().parents[1]/'references';rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  for w,h in [(1440,1000),(390,844)]:
   c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=1,locale='zh-CN',service_workers='block',reduced_motion='reduce')
   try:
    page=c.new_page();page.set_default_timeout(6000)
    for name,url in [('home','https://pjsk.moe/zh-cn/'),('music','https://pjsk.moe/zh-cn/music/')]:
     row={'id':f'moe-{name}-{w}','url':url,'width':w,'height':h,'dateShanghai':'2026-10-20'}
     try:
      response=page.goto(url,wait_until='domcontentloaded',timeout=22000);page.wait_for_timeout(4500)
      skip=page.get_by_role('button',name='跳过 / Skip')
      if skip.count() and skip.is_visible():skip.click();page.wait_for_timeout(6000)
      if name=='music':
       try:page.locator('img').nth(8).wait_for(state='visible',timeout=10000)
       except Exception:pass
       page.wait_for_timeout(2500)
      page.screenshot(path=str(out/(row['id']+'.png')),timeout=12000)
      row.update(result='captured',status=response.status,url=page.url,text=page.locator('body').inner_text()[:8000],headings=page.locator('h1,h2,h3').evaluate_all('(es)=>es.slice(0,20).map(e=>({text:e.textContent.trim(),x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))'))
      print(row['id'],'captured',flush=True)
     except Exception as e:row.update(result='failed',error=str(e)[:250]);print(row['id'],'FAILED',str(e)[:100],flush=True)
     rows.append(row);(out/'capture.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
   finally:c.close()
 finally:b.close()
