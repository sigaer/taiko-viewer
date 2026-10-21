"""Focused interactions on the mounted Nuxt pages, never a second HTML UI."""
import json

def run(page,context,key,width,lang,base,out):
 results=[]
 def passed(name):results.append({'page':key,'width':width,'locale':lang,'check':name,'pass':True})
 def state():return 'document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state'
 if key=='growth':
  reads=[];page.on('request',lambda r:reads.append(r.url) if '/api/account/growth/passport' in r.url else None)
  for days in [30,90,180,365]:
   page.locator(f'[data-range="{days}"]').click();page.wait_for_timeout(100)
   assert page.locator(f'[data-range="{days}"]').get_attribute('aria-pressed')=='true'
   for i in range(6):
    control=page.locator('.passport-dimensions button').nth(i);control.click();page.wait_for_timeout(60);assert control.get_attribute('aria-pressed')=='true'
  assert not reads,reads;passed('four-periods-six-dimensions-no-extra-history-read')
  page.go_back();page.wait_for_timeout(150);assert 'dimension=' in page.url;page.go_forward();page.wait_for_timeout(150);passed('query-back-forward')
  chart=page.locator('.passport-metric[data-metric=rating]');hits=chart.locator('circle.passport-chart__hit');assert hits.count()==8
  hits.first.click(force=True);first=chart.locator('.passport-chart-detail').inner_text();hits.last.focus();hits.last.press('ArrowLeft');page.wait_for_timeout(80);assert chart.locator('.passport-chart-detail').inner_text()!=first
  selection=chart.locator('.passport-chart-selection button');before=chart.locator('.passport-chart-detail').inner_text();selection.first.click();assert chart.locator('.passport-chart-detail').inner_text()!=before;selection.last.click();passed('svg-point-touch-keyboard-and-previous-next')
  # Multiple version segments still form one continuous frozen Rating path.
  assert chart.locator('path').count()==1;passed('frozen-rating-connects-version-revisions')
  more=page.locator('.passport-more')
  if more.count():
   before=page.locator('.passport-milestone').count();more.click();assert page.locator('.passport-milestone').count()>before;assert more.get_attribute('aria-expanded')=='true';more.click();assert page.locator('.passport-milestone').count()==before;passed('milestone-expand-collapse')
  assert ('确认日' if lang=='zh' else '確認日') in page.locator('.passport-milestones').inner_text();passed('observation-date-explicit')
  assert 'difficulty=' in page.locator('.passport-next__songs a').first.get_attribute('href');passed('recommendation-difficulty-link')
  if width==1440:
   payload=context.request.get(base+'/api/account/growth/passport?range=365').json();pending=[];page.route('**/api/account/growth/passport*',lambda route:pending.append(route))
   page.evaluate(state()+'["$saccount-binding-generation"]++');page.wait_for_timeout(200);assert len(pending)==1;assert page.locator('.passport-hero').count()==0;assert page.locator('.passport-loading').count()==1
   page.screenshot(path=str(out/'screenshots/growth-identity-loading.png'));pending[0].fulfill(status=200,content_type='application/json',body=json.dumps(payload));page.locator('.passport-hero').wait_for();page.unroute('**/api/account/growth/passport*');passed('identity-clears-old-growth-and-shows-loading')
 else:
  assert page.locator('.weekly-summary dd').all_text_contents()==['5','4','1','1','1','0'];assert page.locator('.weekly-highlight').count()==4;passed('server-totals-independent-of-visible-highlights')
  prefix='/ja' if lang=='ja' else ''
  page.goto(base+prefix+'/my/weekly?week=2026-10-12',wait_until='networkidle');assert '10' in page.locator('.weekly-hero time').inner_text();assert ('当前建议' if lang=='zh' else '現在のおすすめ') in page.locator('.weekly-next h2').inner_text();passed('historical-complete-week-current-advice')
  page.go_back(wait_until='networkidle');page.wait_for_url(base+prefix+'/my/weekly',timeout=8000);page.go_forward(wait_until='networkidle');page.wait_for_url('**/my/weekly?week=2026-10-12',timeout=8000);passed('week-query-back-forward')
  calls=[];page.on('request',lambda r:calls.append(r.url) if '/api/account/growth/weekly' in r.url else None)
  page.evaluate(state()+'["$saccount-binding-generation"]++');page.wait_for_timeout(350);assert len(calls)==1;passed('binding-switch-actual-page-refetch')
  # Delay two real component requests, return the new identity before old success.
  payload=context.request.get(base+'/api/account/growth/weekly').json();pending=[]
  page.route('**/api/account/growth/weekly*',lambda route:pending.append(route))
  page.locator('.weekly-refresh').click();page.wait_for_timeout(150);assert len(pending)==1;assert page.locator('.weekly-hero').count()==0;assert page.locator('.weekly-loading').count()==1
  page.screenshot(path=str(out/f'screenshots/weekly-identity-loading-{width}-{lang}.png'))
  page.evaluate(state()+'["$saccount-user"]={id:990094,username:"Synthetic B"}');page.wait_for_timeout(200);assert len(pending)==2
  newer={**payload,'theme':{'type':'balanced','confidence':'high','evidenceFactKeys':[],'evidenceMeasurementIds':[]}}
  pending[1].fulfill(status=200,content_type='application/json',body=json.dumps(newer));page.wait_for_timeout(200);expected=page.locator('.weekly-theme').inner_text();pending[0].fulfill(status=200,content_type='application/json',body=json.dumps(payload));page.wait_for_timeout(200);assert page.locator('.weekly-theme').inner_text()==expected;passed('identity-switch-late-success-cannot-overwrite')
  page.unroute('**/api/account/growth/weekly*');passed('real-writes-zero')
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
 return results
