"""Same-fixture homepage width comparison; normal and explicit GET failures."""
import json

def run(browser,out,stage):
 records=[]
 widths=[1440] if stage=='before' else [1440,1280,1920,414,390]
 for width in widths:
  for theme in ['light','dark']:
   for state in ['scores','failure']:
    context=browser.new_context(viewport={'width':width,'height':846 if width<768 else 1000},device_scale_factor=1,is_mobile=width<768,has_touch=width<768,reduced_motion='reduce',service_workers='block')
    try:
     context.add_cookies([{'name':'taiko_theme','value':theme,'url':'http://127.0.0.1:3208'}]);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto(f'http://127.0.0.1:3208/?previewState={state}',wait_until='domcontentloaded',timeout=90000)
     page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false')
     page.locator('.growth-surface').wait_for();page.wait_for_function('!document.querySelector(".growth-loading")');page.wait_for_timeout(1200)
     # Complete the existing lazy image loading without changing the page or data.
     for item in page.locator('.guest-latest,.guest-events').all():item.scroll_into_view_if_needed();page.wait_for_timeout(700)
     page.evaluate('window.scrollTo(0,0)');page.evaluate('document.fonts.ready');page.wait_for_timeout(400)
     name=f'home-width-{stage}-{width}-{theme}-{state}'
     page.screenshot(path=str(out/'screenshots'/(name+'.png')))
     page.screenshot(path=str(out/'screenshots'/(name+'-full.png')),full_page=True)
     geometry=page.evaluate('''()=>Object.fromEntries(['.app-content','.home-page','.annual-hero','.growth-surface','.guest-latest','.guest-events'].map(s=>{let e=document.querySelector(s),r=e?.getBoundingClientRect();return [s,r?{x:r.x,width:r.width,right:r.right}:null]}))''')
     count=page.locator('.guest-song-card:not(.guest-song-card--loading)').count()
     assert count==(0 if state=='failure' else 6),(state,count)
     overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+1');assert not overflow
     assert not errors,errors
     records.append({'image':name+'.png','full':name+'-full.png','width':width,'height':846 if width<768 else 1000,'theme':theme,'state':state,'geometry':geometry,'songCount':count,'overflow':overflow,'browser':browser.version})
     (out/f'home-width-{stage}.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
     print(name,geometry['.home-page'],flush=True)
    finally:context.close()
