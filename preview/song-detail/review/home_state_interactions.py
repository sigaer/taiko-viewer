"""Real page state transitions. Mutations only receive isolated route responses."""
import copy,json

def run(page,context,key,width,lang,base,out,writes):
 checks=[];prefix='/ja' if lang=='ja' else ''
 def ok(name):checks.append({'page':key,'width':width,'locale':lang,'check':name,'pass':True})
 def cookie(state):context.add_cookies([{'name':'song_preview_state','value':state,'url':base}])
 def visit(state,path=None,idle=True):
  page.goto(base+prefix+(path or ('/' if key=='home' else '/my'))+'?previewState='+state,wait_until='networkidle' if idle else 'domcontentloaded',timeout=45000)
  page.wait_for_function('document.querySelector("#__nuxt")?.__vue_app__?.$nuxt?.isHydrating===false')
 def nav(path):
  page.evaluate('(path)=>document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.push(path)',prefix+path);page.wait_for_load_state('networkidle');page.wait_for_timeout(180)
 def state(script):return page.evaluate('()=>{const state=document.querySelector("#__nuxt").__vue_app__.$nuxt.payload.state;'+script+'}')
 def respond(route,data,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
 def write(route,data,status=200):
  writes.append({'level':'isolated browser route','path':route.request.url.replace(base,''),'method':route.request.method,'fields':sorted((route.request.post_data_json or {}).keys()),'status':status});respond(route,data,status)
 if key=='my':
  links=page.locator('.my-link');assert links.count()==9
  expected=['/my/growth','/my/weekly','/tools/recommend','/account/songs','/tools/b30','/tools/progress','/tools/word-cloud','/account/profile','/account/version-summary']
  assert [link.get_attribute('href') for link in links.all()]==[prefix+p for p in expected]
  if width<720:
   page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');last=links.last;last.focus();box=last.bounding_box();bar=page.locator('.mobile-tabbar').bounding_box();assert box['y']>=0 and box['y']+box['height']<=bar['y']+1
   page.screenshot(path=str(out/f'screenshots/my-last-link-focus-{width}-{lang}.png'));ok('last-entry-focus-and-full-hit-area-clear-mobile-navigation')
  links.first.focus();assert links.first.evaluate('(e)=>document.activeElement===e');links.first.press('Enter');page.wait_for_url('**/my/growth');page.go_back(wait_until='networkidle');page.locator('.my-page').wait_for();ok('nine-original-routes-group-order-and-keyboard-navigation')
  visit('auth-failure');assert page.locator('.my-page').get_attribute('data-auth-status')=='error';assert page.locator('.my-link').count()==9;assert page.locator('.my-cta').count()==0
  page.screenshot(path=str(out/f'screenshots/my-auth-error-{width}-{lang}.png'));pending=[];page.route('**/api/account/auth/me',lambda route:pending.append(route))
  page.locator('.my-status button').click();page.wait_for_timeout(120);assert len(pending)==1;assert page.locator('.my-page').get_attribute('data-auth-status')=='loading';assert page.locator('.my-link').count()==9
  respond(pending.pop(),{'statusCode':503,'message':'Synthetic retry failure'},503);page.wait_for_timeout(120);assert page.locator('.my-page').get_attribute('data-auth-status')=='error';ok('auth-failure-and-retry-failure-keep-all-public-entries')
  cookie('home-deep');page.locator('.my-status button').click();page.wait_for_timeout(120);assert len(pending)==1;respond(pending.pop(),{'authenticated':True,'user':{'id':990093,'username':'Synthetic recovered'}});page.wait_for_timeout(160);assert page.locator('.my-page').get_attribute('data-auth-status')=='authenticated';assert 'Synthetic recovered' in page.locator('.my-intro').inner_text();ok('forced-auth-retry-loading-and-recovery')
  page.unroute('**/api/account/auth/me')
  if width==1440:
   # Real page's retry, with auth transport delayed while the shared identity changes.
   visit('auth-failure');page.route('**/api/account/auth/me',lambda route:pending.append(route));page.locator('.my-status button').click();page.wait_for_timeout(120)
   state('state["$saccount-user"]={id:990094,username:"Synthetic current B"};');respond(pending.pop(),{'statusCode':503,'message':'Late account A'},503);page.wait_for_timeout(160)
   assert page.locator('.my-page').get_attribute('data-auth-status')=='authenticated';assert 'Synthetic current B' in page.locator('.my-intro').inner_text();page.unroute('**/api/account/auth/me');ok('late-auth-failure-cannot-log-out-current-account')
  visit('guest');assert page.locator('.my-page').get_attribute('data-auth-status')=='guest';assert page.locator('.my-cta').count()==1;assert page.locator('.my-link').count()==9;ok('confirmed-guest-keeps-nine-entries')
 else:
  # Reuse the prior actual row/handler checks for navigation, busy, failed save
  # and selected state, without creating a second goal UI or transport.
  from song_row_interactions import run as row_checks
  checks.extend(row_checks(page,context,'home',width,lang,base,out))
  visit('home-deep');normal=context.request.get(base+'/api/account/growth/overview').json();recent=context.request.get(base+'/api/account/growth/recent').json()
  for failure,stage in [('auth-failure','auth'),('binding-failure','binding'),('scores-failure','scores')]:
   visit(failure);assert page.locator('.home-page').get_attribute('data-home-state-status')=='error';assert page.locator('.guest-hero').count()==0;assert page.locator('.guest-song-card').count()==5;assert page.locator('.guest-tool').count()==4
   assert page.locator('.home-account-status button').is_visible();page.screenshot(path=str(out/f'screenshots/home-{stage}-error-{width}-{lang}.png'))
   cookie('home-deep');page.locator('.home-account-status button').click();page.locator('.growth-plan').wait_for();assert page.locator('.home-page').get_attribute('data-home-state')=='authenticated_ready'
  ok('auth-binding-score-errors-stay-distinct-public-content-and-retry')
  for fixture,expected in [('guest','guest'),('unbound','authenticated_unbound'),('empty','authenticated_bound_empty')]:
   visit(fixture);assert page.locator('.home-page').get_attribute('data-home-state')==expected;assert page.locator('.growth-plan').count()==0
  ok('confirmed-guest-unbound-and-effective-score-empty')
  # Keep the successful recent DTO visible while the independent overview fails.
  cookie('home-deep');failed=[True]
  def overview(route):respond(route,{'statusCode':503,'message':'Synthetic overview failure'},503) if failed[0] else respond(route,normal)
  page.route('**/api/account/growth/overview',overview);visit('home-deep');page.locator('.recent-growth__fact').first.wait_for();assert page.locator('.growth-plan').count()==0
  failed[0]=False;page.locator('.growth-surface > [role=alert] button').click();page.locator('.growth-plan').wait_for();page.unroute('**/api/account/growth/overview');ok('overview-failure-preserves-recent-and-retry-restores-plan')
  failed[0]=True
  def recent_read(route):respond(route,{'statusCode':503,'message':'Synthetic recent failure'},503) if failed[0] else respond(route,recent)
  page.route('**/api/account/growth/recent',recent_read);visit('home-deep');page.locator('.recent-growth__state[role=alert]').wait_for();assert page.locator('.growth-plan .song-row').count()==3
  failed[0]=False;page.locator('.recent-growth__state button').click();page.locator('.recent-growth__fact').first.wait_for();page.unroute('**/api/account/growth/recent');ok('recent-failure-preserves-overview-and-retry-restores-facts')
  if width==1440:
   # Delayed binding read then account switch: old success/failure must not land.
   pending=[];page.route('**/api/account/bindings',lambda route:pending.append(route));state('state["$saccount-binding-generation"]++;');page.wait_for_timeout(140);assert len(pending)==1;assert page.locator('.growth-plan').count()==0
   state('state["$saccount-user"]={id:990094,username:"Synthetic account B"};');page.wait_for_timeout(140);assert len(pending)==2
   binding=context.request.get(base+'/api/account/bindings').json();respond(pending[1],binding);page.locator('.growth-plan').wait_for();assert 'Synthetic account B' in page.locator('#growth-title').inner_text();respond(pending[0],{'statusCode':503,'message':'Late identity failure'},503);page.wait_for_timeout(150);assert page.locator('.home-page').get_attribute('data-home-state-status')=='ready';page.unroute('**/api/account/bindings');ok('identity-clears-old-home-and-late-binding-failure-cannot-overwrite')
   # Login handler + auth refresh + client navigation back to an already cached Home.
   visit('guest');nav('/account/login?redirect=/');page.locator('input').nth(0).fill('synthetic-home@example.invalid');page.locator('input[type=password]').fill('synthetic-only-password')
   def login(route):cookie('home-deep');write(route,{'ok':True})
   page.route('**/api/account/auth/login',login);page.locator('.submit-btn').click();page.wait_for_url(base+'/');page.locator('.growth-plan').wait_for();page.unroute('**/api/account/auth/login');ok('actual-login-handler-return-restores-ready-home')
   # Actual profile switch handler uses its original API wrapper broadcast.
   nav('/account/profile');page.locator('.binding-item').nth(1).wait_for();profile=context.request.get(base+'/api/account/profile').json();switched=[False]
   def bind(route):switched[0]=True;write(route,{'ok':True})
   def binding_read(route):
    data=copy.deepcopy(binding);data['currentBinding']={**data['currentBinding'],'id':2,'taikoId':'synthetic-binding-B'};respond(route,data)
   def profile_read(route):
    data=copy.deepcopy(profile);data['currentBinding']=data['bindings'][1];data['bindings'][0]['isCurrent']=False;data['bindings'][1]['isCurrent']=True;respond(route,data)
   page.route('**/api/account/bindings/current',bind);page.route('**/api/account/profile',profile_read);page.route('**/api/account/bindings',binding_read)
   b_overview=copy.deepcopy(normal);b_overview['profileId']='2';b_overview['todayPlan']['items']=[];b_recent={**recent,'profileId':'2','facts':[],'totalFacts':0,'boundary':{'acknowledgedToken':None,'currentToken':None,'acknowledgeRequired':False,'recovered':False}}
   page.route('**/api/account/growth/overview',lambda route:respond(route,b_overview));page.route('**/api/account/growth/recent',lambda route:respond(route,b_recent));page.locator('.binding-item').nth(1).get_by_role('button').first.click();page.wait_for_timeout(250);assert switched[0];nav('/');page.locator('.growth-plan').wait_for();assert page.locator('.growth-plan .song-row').count()==0 and page.locator('.growth-goal').count()==0 and page.locator('.recent-growth__fact').count()==0;ok('actual-binding-switch-return-does-not-restore-old-plan-goal-or-facts')
   for pattern in ['**/api/account/bindings/current','**/api/account/profile','**/api/account/bindings','**/api/account/growth/overview','**/api/account/growth/recent']:page.unroute(pattern)
   # Actual sync handler: success return invalidates cached empty score state.
   visit('empty');cookie('home-deep');nav('/account/sync');page.locator('.target-item').first.wait_for()
   if not page.locator('.target-item input').first.is_checked():page.locator('.target-item .el-checkbox__inner').first.click()
   assert page.locator('.target-item input').first.is_checked()
   def sync_success(route):write(route,{'log':{'status':'success','results':[]}})
   page.route('**/api/account/sync',sync_success);page.get_by_role('button',name='开始同步',exact=True).click();page.wait_for_timeout(250);nav('/');page.locator('.growth-plan').wait_for();page.unroute('**/api/account/sync');ok('actual-sync-success-return-rechecks-empty-to-ready')
   page.locator('.el-message--success').first.wait_for(state='hidden');nav('/account/sync')
   if not page.locator('.target-item input').first.is_checked():page.locator('.target-item .el-checkbox__inner').first.click()
   assert page.locator('.target-item input').first.is_checked()
   page.route('**/api/account/sync',lambda route:write(route,{'statusCode':503,'message':'Synthetic sync failed'},503));page.get_by_role('button',name='开始同步',exact=True).click();page.locator('.el-message--error').first.wait_for();assert page.locator('.el-message--success').count()==0;nav('/');page.locator('.growth-plan').wait_for();page.unroute('**/api/account/sync');ok('actual-sync-failure-is-not-success-on-return')
   # Controlled ack conflict refetches once, late conflict after unmount does not.
   ack_pending=[];page.route('**/api/account/growth/recent/ack',lambda route:ack_pending.append(route));visit('home-deep',idle=False);page.locator('.growth-plan').wait_for();page.wait_for_timeout(150);assert len(ack_pending)==1
   reads=[];page.on('request',lambda request:reads.append(request.url) if request.url==base+'/api/account/growth/recent' else None);write(ack_pending.pop(),{'statusCode':409,'message':'Synthetic boundary conflict'},409);page.wait_for_timeout(180);assert len(reads)==1 and len(ack_pending)==0;ok('automatic-ack-current-conflict-refetches-without-loop')
   visit('home-deep',idle=False);page.locator('.growth-plan').wait_for();page.wait_for_timeout(150);assert len(ack_pending)==1
   page.evaluate('(path)=>document.querySelector("#__nuxt").__vue_app__.$nuxt.$router.push(path)',prefix+'/my');page.locator('.my-page').wait_for();before=len(reads);write(ack_pending.pop(),{'statusCode':409,'message':'Late synthetic boundary conflict'},409);page.wait_for_timeout(160);assert len(reads)==before;page.unroute('**/api/account/growth/recent/ack');ok('automatic-ack-after-keepalive-deactivation-cannot-refetch')
  else:
   nav('/my');page.locator('.my-link').first.click();page.wait_for_url('**/my/growth');page.go_back(wait_until='networkidle');assert page.locator('.mobile-tabbar__item.is-active').get_attribute('href')==prefix+'/my';ok('mobile-navigation-remains-usable')
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
 return checks
