"""Local development entry diagnostics; no business writes."""
import json,re,urllib.request
from pathlib import Path

def run(browser,out):
 entry=str((Path(__file__).resolve().parents[1]/'node_modules/nuxt/dist/app/entry.js').resolve())
 records=[]
 for url in ['/tools/recommend?previewState=guest','/account/profile?previewState=guest','/_nuxt'+entry,'/_nuxt/@fs'+entry]:
  try:
   with urllib.request.urlopen('http://127.0.0.1:3208'+url,timeout=8) as res:
    body=res.read().decode();row={'url':url,'final':res.url,'status':res.status,'type':res.headers.get('Content-Type'),'prefix':body[:140],'scripts':re.findall(r'<script[^>]+src="([^"]+)"',body)}
  except Exception as e:row={'url':url,'error':str(e)}
  records.append(row);print(row,flush=True)
 context=browser.new_context(service_workers='block')
 try:
  page=context.new_page();network=[];console=[]
  page.on('response',lambda r:network.append({'url':r.url,'status':r.status,'type':r.headers.get('content-type')}) if '/_nuxt/' in r.url and ('entry.js' in r.url or r.status>=400) else None)
  page.on('console',lambda m:console.append(m.text[:1000]) if m.type=='error' else None)
  for path in ['/tools/recommend?previewState=guest','/account/profile?previewState=guest']:
   page.goto('http://127.0.0.1:3208'+path,wait_until='domcontentloaded',timeout=90000);page.wait_for_timeout(5000)
   row={'path':path,'url':page.url,'hydrating':page.evaluate('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating'),'network':network[:],'console':console[:]}
   records.append(row);print(row,flush=True)
 finally:context.close()
 (out/'preview-entry-probe.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
