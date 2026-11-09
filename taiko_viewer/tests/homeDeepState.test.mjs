import test from 'node:test';
import assert from 'node:assert/strict';
import {ref,reactive,h,onMounted,onBeforeUnmount} from 'vue';
import {fixture,settle} from './fixtures/homeStateHarness.mjs';
const authPath='/api/account/auth/me',recentPath='/api/account/growth/recent',ackPath=recentPath+'/ack',overviewPath='/api/account/growth/overview';
test('actual My page rechecks prerendered guest cache and recovers the active session',async()=>fixture(async({auth,states,controlled,requests,load,attach})=>{
 states.get('account-user').value=null;states.get('account-user-loaded').value=true;controlled.add(authPath);
 assert.equal(auth.accountAuthStatus.value,'guest');
 const View=await load('pages/my/index.vue',true);const mounted=attach(()=>View.setup({}, {expose(){}}));
 assert.equal(requests.length,1);assert.equal(auth.accountAuthStatus.value,'loading');
 requests.shift().resolve({authenticated:true,user:{id:7,username:'Restored session'}});
 const page=await mounted.model;await settle();assert.equal(auth.accountAuthStatus.value,'authenticated');assert.equal(page.accountUser.value.id,7);
 assert.equal(page.linkGroups.value.flatMap(g=>g.items).length,8);assert.equal(requests.length,0);
}));
test('actual My navigation reacts to login, annual access grants/revocation and logout',async()=>fixture(async({auth,states,load,attach})=>{
 const View=await load('pages/my/index.vue',true);const page=await attach(()=>View.setup({}, {expose(){}})).model;
 const paths=()=>page.linkGroups.value.flatMap(group=>group.items.map(item=>item.path));
 const original=['/account/songs','/my/growth','/tools/recommend','/my/weekly','/tools/b30','/tools/progress','/tools/word-cloud'];
 assert.deepEqual(paths(),['/account/sync',...original]);assert.equal(page.annualLink.value,null);
 states.get('account-user').value.annualSummaryAccess=true;
 assert.deepEqual(paths(),['/account/sync',...original]);assert.equal(page.annualLink.value.path,'/account/version-summary');
 states.get('account-user').value.annualSummaryAccess=false;
 assert.deepEqual(paths(),['/account/sync',...original]);assert.equal(page.annualLink.value,null);
 auth.clearResolvedAccountUser();assert.deepEqual(paths(),original);assert.equal(page.annualLink.value,null);
 states.get('account-user').value={id:2,annualSummaryAccess:true};
 assert.deepEqual(paths(),['/account/sync',...original]);assert.equal(page.annualLink.value.path,'/account/version-summary');
}));
test('actual My template never mounts Overview or starts its read on login, access grants or account switches',async()=>fixture(async({auth,states,load,mount,controlled,requests})=>{
 let reads=0,unmounts=0;
 const Overview={setup(){onMounted(()=>reads++);onBeforeUnmount(()=>unmounts++);return()=>h('section');}};
 const Link={props:['to'],setup(_,ctx){return()=>h('a',{},ctx.slots.default?.());}};
 const View=await load('pages/my/index.vue',true,true);
 const Titles={render:()=>h('span')};
 controlled.add('/api/account/my-taiko/overview');
 mount(View,{MyTaikoOverview:Overview,NuxtLink:Link,AccountTitleBadges:Titles});await settle();
 assert.equal(reads,0);
 for(const access of [false,undefined,'true']){
  states.get('account-user').value.myTaikoReadModelAccess=access;await settle();assert.equal(reads,0);
 }
 states.get('account-user').value.myTaikoReadModelAccess=true;await settle();assert.equal(reads,0);
 states.get('account-user').value={id:2,myTaikoReadModelAccess:true};await settle();
 assert.equal(reads,0);assert.equal(unmounts,0);
 states.get('account-user').value.myTaikoReadModelAccess=false;await settle();
 auth.clearResolvedAccountUser();await settle();assert.equal(reads,0);
 assert.equal(requests.length,0,'Navigation must not start a private Overview read');
}));
test('actual My page joins pending auth and keeps a known authenticated cache',async()=>fixture(async({auth,controlled,requests,load,attach})=>{
 controlled.add(authPath);const View=await load('pages/my/index.vue',true);
 const known=attach(()=>View.setup({}, {expose(){}}));await known.model;assert.equal(requests.length,0);
 const refresh=auth.resolveAccountUser(true),current=requests.shift();const pending=attach(()=>View.setup({}, {expose(){}}));assert.equal(requests.length,0,'page must join the in-flight request');
 current.resolve({authenticated:true,user:{id:8}});await refresh;await pending.model;assert.equal(auth.accountUser.value.id,8);
}));
test('auth initial reads coalesce; force retry and logout ignore late success/failure',async()=>fixture(async({auth,requests,controlled,states})=>{
 controlled.add(authPath);states.get('account-user-loaded').value=false;
 const first=auth.resolveAccountUser(),joined=auth.resolveAccountUser();assert.equal(requests.length,1);
 const old=requests.shift(),retry=auth.resolveAccountUser(true);assert.equal(requests.length,1);requests.shift().resolve({authenticated:true,user:{id:2}});await retry;
 old.reject(Error('late auth failure'));await Promise.all([first,joined]);assert.equal(auth.accountUser.value.id,2);assert.equal(auth.accountAuthError.value,null);assert.equal(auth.accountAuthPending.value,false);
 const late=auth.resolveAccountUser(true),response=requests.shift();auth.clearResolvedAccountUser();response.resolve({authenticated:true,user:{id:2}});await late;assert.equal(auth.accountUser.value,null);assert.equal(auth.accountAuthStatus.value,'guest');
}));
test('auth failure stays error through cached reads, repeated forced retry can recover; invalid payload is not guest',async()=>fixture(async({auth,requests,controlled})=>{
 controlled.add(authPath);
 for(let i=0;i<2;i++){const retry=auth.resolveAccountUser(true);assert.equal(auth.accountAuthStatus.value,'loading');requests.shift().reject(Error('auth unavailable'));await retry;assert.equal(auth.accountAuthStatus.value,'error');await auth.resolveAccountUser();assert.equal(auth.accountAuthStatus.value,'error');assert.equal(requests.length,0);}
 const retry=auth.resolveAccountUser(true);requests.shift().resolve({authenticated:true,user:{id:3}});await retry;assert.equal(auth.accountAuthStatus.value,'authenticated');
 const invalid=auth.resolveAccountUser(true);requests.shift().resolve({authenticated:true,user:null});await invalid;assert.equal(auth.accountAuthStatus.value,'error');
}));
test('home clears binding immediately on actual mutation, deduplicates resolution, and sync return rechecks score presence',async()=>fixture(async({home,api,requests,binding})=>{
 await home.resolve();assert.equal(home.homeState.value,'authenticated_ready');assert.equal(home.currentBinding.value.id,1);
 const change=api('/api/account/bindings/current',{method:'POST'});requests.shift().resolve({});await change;assert.equal(home.currentBinding.value,null);assert.equal(home.status.value,'loading');
 await Promise.all([home.resolve(),home.resolve()]);assert.equal(home.currentBinding.value.id,binding.id);
 const sync=api('/api/account/sync',{method:'POST'});requests.shift().resolve({log:{status:'failed'}});await sync;assert.equal(home.homeState.value,'authenticated_ready');await home.resolve();assert.equal(home.homeState.value,'authenticated_ready');
 const failure=api('/api/account/sync',{method:'POST'});requests.shift().reject(Error('sync failed'));await assert.rejects(failure);assert.equal(home.homeState.value,'authenticated_ready','transport failure cannot claim or invent a sync result');
}));
test('home binding and score failures have exact stages; each retry restores actual empty/unbound/ready state',async()=>fixture(async({home,requests,controlled,binding})=>{
 for(const [path,stage]of [['/api/account/bindings','binding'],['/api/account/songs','scores']]){
  controlled.add(path);const op=home.resolve(true);await settle();requests.shift().reject(Error('read failed'));await op;assert.equal(home.status.value,'error');assert.equal(home.error.value.stage,stage);assert.equal(home.homeState.value,null);controlled.delete(path);await home.resolve(true);assert.equal(home.homeState.value,'authenticated_ready');
 }
 controlled.add('/api/account/bindings');let op=home.resolve(true);await settle();requests.shift().resolve({bindings:[],currentBinding:null});await op;assert.equal(home.homeState.value,'authenticated_unbound');controlled.delete('/api/account/bindings');
 controlled.add('/api/account/songs');op=home.resolve(true);await settle();requests.shift().resolve({total:0,items:[]});await op;assert.equal(home.homeState.value,'authenticated_bound_empty');
}));
test('home identity ABA and unmount cannot apply late binding/scores or start the next stale stage',async()=>fixture(async({home,auth,requests,controlled,states,close,binding})=>{
 controlled.add('/api/account/bindings');let old=home.resolve();await settle();let response=requests.shift();states.get('account-user').value={id:2};states.get('account-user').value={id:1};
 const current=home.resolve();await settle();requests.shift().resolve({bindings:[binding],currentBinding:binding});await current;response.reject(Error('late old identity'));await old;assert.equal(home.homeState.value,'authenticated_ready');assert.equal(home.error.value,null);
 old=home.resolve(true);await settle();response=requests.shift();close();response.resolve({bindings:[binding],currentBinding:binding});await old;assert.equal(home.homeState.value,null);assert.equal(requests.length,0);
}));
test('superseded forced home auth cannot restart reads after the newer retry completes',async()=>fixture(async({home,requests,controlled})=>{
 controlled.add(authPath);controlled.add('/api/account/bindings');
 const old=home.refresh(),stale=requests.shift(),current=home.refresh();requests.shift().resolve({authenticated:true,user:{id:2}});await settle();
 requests.shift().resolve({bindings:[],currentBinding:null});await current;assert.equal(home.homeState.value,'authenticated_unbound');
 stale.resolve({authenticated:true,user:{id:1}});await old;assert.equal(requests.length,0);assert.equal(home.homeState.value,'authenticated_unbound');
}));
test('growth modules do not read an unknown binding during Home invalidation',async()=>fixture(async({home,api,attach,requests,controlled})=>{
 await home.resolve();controlled.add(overviewPath);controlled.add(recentPath);
 const {model}=attach(()=>({growth:usePlayerGrowth(ref(true),ref(1)),recent:useRecentGrowth(ref(true),ref(1))}));
 const previous=requests.splice(0);const mutation=api('/api/account/bindings/current',{method:'POST'});requests.shift().resolve({});await mutation;assert.equal(home.currentBinding.value,null);assert.equal(requests.length,0);
 for(const request of previous)request.reject(Error('late previous binding'));await settle();assert.equal(model.growth.error.value,null);assert.equal(model.recent.error.value,null);
}));
test('actual KeepAlive deactivation drops late ack and resumes only invalidated growth reads',async()=>fixture(async({home,cached,requests,controlled,recent,overview})=>{
 await home.resolve();const page=cached(()=>({growth:usePlayerGrowth(ref(true),ref(1)),history:useRecentGrowth(ref(true),ref(1))}));await settle();
 controlled.add(recentPath);
 const ack=page.model.history.acknowledge('synthetic-token'),late=requests.shift();await page.deactivate();late.reject({statusCode:409});await ack;assert.equal(requests.length,0);
 controlled.add(overviewPath);controlled.add(recentPath);await page.activate();assert.equal(requests.length,0,'unchanged cached entry must not refetch');
 const pending=page.model.growth.refresh();const old=requests.shift();await page.deactivate();old.reject(Error('late overview'));await pending;assert.equal(page.model.growth.refreshError.value,null);
 await page.activate();assert.equal(requests.length,1);requests.shift().resolve(overview);await settle();assert.equal(page.model.growth.growth.value.profileId,'1');
}));
test('suspended Home cannot finish auth or binding resolution until returned to the page',async()=>fixture(async({home,controlled,requests})=>{
 controlled.add(authPath);const read=home.refresh(),auth=requests.shift();home.suspend();auth.resolve({authenticated:true,user:{id:1}});await read;assert.equal(home.homeState.value,null);assert.equal(requests.length,0);
 controlled.delete(authPath);await home.resolve();assert.equal(home.homeState.value,'authenticated_ready');
}));
test('late score success cannot replace the new identity empty-state result',async()=>fixture(async({home,controlled,requests,states})=>{
 controlled.add('/api/account/songs');const first=home.resolve();await settle();const old=requests.shift();states.get('account-user').value={id:2};
 const current=home.resolve();await settle();requests.shift().resolve({total:0,items:[]});await current;assert.equal(home.homeState.value,'authenticated_bound_empty');
 old.resolve({total:1,items:[{highScore:1000000}]});await first;assert.equal(home.homeState.value,'authenticated_bound_empty');assert.equal(home.error.value,null);
}));
test('overview and recent fail/retry independently; refreshed overview failure preserves its valid result',async()=>fixture(async({home,attach,controlled,requests,overview,recent})=>{
 await home.resolve();controlled.add(overviewPath);controlled.add(recentPath);
 const {model:{growth,history}}=attach(()=>({growth:usePlayerGrowth(ref(true),ref(1)),history:useRecentGrowth(ref(true),ref(1))}));
 requests.find(r=>r.path===overviewPath).reject(Error('overview failed'));requests.find(r=>r.path===recentPath).resolve(recent);requests.length=0;await settle();assert.ok(growth.error.value);assert.equal(history.recent.value.profileId,'1');
 let retry=growth.refresh();requests.shift().resolve(overview);await retry;assert.equal(growth.error.value,null);
 retry=history.refresh();requests.shift().reject(Error('recent failed'));await retry;assert.ok(history.error.value);assert.equal(growth.growth.value.playerState.overallRating,10);
 retry=growth.refresh();requests.shift().reject(Error('overview refresh failed'));await retry;assert.ok(growth.refreshError.value);assert.equal(growth.growth.value.playerState.overallRating,10);
 retry=history.refresh();requests.shift().resolve(recent);await retry;assert.equal(history.error.value,null);assert.ok(growth.refreshError.value);
}));
test('recent ack deduplicates tokens; only current 409 reloads and late ack after unmount cannot load',async()=>fixture(async({home,attach,requests,controlled,recent})=>{
 await home.resolve();const {model:history,close}=attach(()=>useRecentGrowth(ref(true),ref(1)));await settle();
 let ack=history.acknowledge('synthetic-token');await history.acknowledge('synthetic-token');assert.equal(requests.length,1);let response=requests.shift();assert.deepEqual(response.options.body,{profileId:'1',expectedBoundary:null,acknowledgeToken:'synthetic-token'});response.resolve({profileId:'1',acknowledgedToken:'synthetic-token'});await ack;await history.acknowledge('synthetic-token');assert.equal(requests.length,0);
 history.recent.value={...recent,boundary:{...recent.boundary,currentToken:'second'}};controlled.add(recentPath);
 ack=history.acknowledge('second');requests.shift().reject({statusCode:409});await ack;assert.equal(requests.length,1);requests.shift().resolve({...recent,boundary:{...recent.boundary,currentToken:'third'}});await settle();assert.equal(history.recent.value.boundary.currentToken,'third');
 ack=history.acknowledge('third');response=requests.shift();close();response.reject({statusCode:409});await ack;assert.equal(requests.length,0);
}));
test('recent ack identity ABA rejects stale success/conflict and keeps newer same-token request busy',async()=>fixture(async({home,attach,states,requests,recent})=>{
 await home.resolve();const user=ref(1);const {model:history}=attach(()=>useRecentGrowth(ref(true),user));await settle();
 const first=history.acknowledge('synthetic-token'),old=requests.shift();user.value=2;user.value=1;await settle();
 const current=history.acknowledge('synthetic-token'),fresh=requests.shift();old.resolve({profileId:'1',acknowledgedToken:'synthetic-token'});await first;await history.acknowledge('synthetic-token');assert.equal(requests.length,0,'old completion must not release newer inflight token');fresh.reject(Error('controlled ack failure'));await current;
 const retry=history.acknowledge('synthetic-token');assert.equal(requests.length,1);requests.shift().resolve({profileId:'1',acknowledgedToken:'synthetic-token'});await retry;
}));
test('actual RecentGrowth emits only after a current successful presentation and cancels on unmount',async()=>fixture(async({attach,load,recent})=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame,frames=new Map(),emits=[];let sequence=0;
 globalThis.requestAnimationFrame=cb=>{frames.set(++sequence,cb);return sequence;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 try{
  const View=await load('components/home/RecentGrowth.vue',true),props=reactive({recent,pending:true,failed:false});
  const mounted=attach(()=>View.setup(props,{expose(){},emit:(...args)=>emits.push(args)}));await settle();assert.equal(frames.size,0);
  props.pending=false;props.failed=true;await settle();assert.equal(frames.size,0);
  props.failed=false;await settle();assert.equal(frames.size,1);const frame=[...frames.values()][0];frames.clear();frame();assert.deepEqual(emits,[['presented','synthetic-token']]);
  props.pending=true;await settle();props.pending=false;await settle();assert.equal(frames.size,0,'same token after conflict refresh must not auto-confirm again');
  props.recent={...recent,boundary:{...recent.boundary,currentToken:'next'}};await settle();assert.equal(frames.size,1);mounted.close();assert.equal(frames.size,0);
 }finally{globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel;}
}));
test('actual home goal component preserves evaluation states and requires refresh recovery before new creation',async()=>fixture(async({attach,load,requests,overview,recent})=>{
 const oldDocument=globalThis.document;globalThis.document={activeElement:{focus(){}}};
 try{
  const goal={id:'goal-1',profileId:'1',songId:1455,difficultyType:5,title:'Synthetic goal',goalType:'fc',baseline:{fullComboCnt:0}};
  const props=reactive({overview:{...overview,activeGoal:goal},displayName:'Synthetic',identity:'1:1:true',recent,refreshGrowth:async()=>false,refreshRecent:async()=>true,acknowledgeRecent:async()=>{}});
  const View=await load('components/home/PlayerGrowthSurface.vue',true),mounted=attach(()=>View.setup(props,{expose(){},emit(){}})),m=mounted.model;
  for(const outcome of ['unchanged','inconclusive']){
   const op=m.evaluate();requests.shift().resolve({profileId:'1',activeGoal:goal,recentCompletedGoal:null,outcome});await op;assert.equal(m.busy.value,false);assert.equal(m.needsRefresh.value,true);assert.equal(m.refreshFailed.value,true);assert.ok(m.evaluationNotice.value);
   props.refreshGrowth=async()=>true;await m.refreshAfterEvaluation(props.identity);assert.equal(m.choicesDisabled.value,false);assert.equal(m.refreshFailed.value,false);props.refreshGrowth=async()=>false;
  }
  let op=m.evaluate();requests.shift().reject({statusCode:503});await op;assert.equal(m.goalError.value,'home.goal.error');assert.equal(m.busy.value,false);
  op=m.evaluate();requests.shift().resolve({profileId:'1',activeGoal:null,recentCompletedGoal:{...goal,status:'completed'},outcome:'completed'});await op;assert.equal(m.activeGoal.value,null);assert.equal(m.recentCompletedGoal.value.id,goal.id);assert.equal(m.evaluationNotice.value,'');
  props.identity='2:2:true';assert.equal(m.recentCompletedGoal.value,null);assert.equal(m.busy.value,false);assert.equal(m.needsRefresh.value,false);
 }finally{globalThis.document=oldDocument;}
}));
test('actual My overview defers cached sync/focus reads and reloads exactly once on binding selection',async()=>fixture(async({cached,load,requests,controlled,states})=>{
 const beforeWindow=globalThis.window,beforeDocument=globalThis.document,listeners=new Map();
 const port={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 globalThis.window=port;globalThis.document={...port,visibilityState:'visible'};
 try{
  const path='/api/account/my-taiko/overview';controlled.add(path);
  const View=await load('components/my-taiko/Overview.vue',true);const page=cached(()=>View.setup({}, {expose(){}}));
  assert.equal(requests.length,1);requests.shift().resolve({profile:{bindingId:'1'}});await settle();assert.equal(page.model.overview.value.profile.bindingId,'1');
  await page.deactivate();states.get('account-home-generation').value++;listeners.get('focus')();await settle();assert.equal(requests.length,0);assert.equal(page.model.overview.value,null);
  await page.activate();assert.equal(requests.length,1);requests.shift().resolve({profile:{bindingId:'1'}});await settle();
  page.model.selection.value='2';const switching=page.model.switchBinding();assert.equal(requests.length,1);requests.shift().resolve({});await switching;await settle();assert.equal(requests.length,1,'selection and generation share one overview read');
  requests.shift().resolve({profile:{bindingId:'2'}});await settle();assert.equal(page.model.overview.value.profile.bindingId,'2');
  page.close();assert.equal(listeners.size,0);
 }finally{if(beforeWindow===undefined)delete globalThis.window;else globalThis.window=beforeWindow;if(beforeDocument===undefined)delete globalThis.document;else globalThis.document=beforeDocument;}
}));
test('My overview distinguishes real binding conflicts from catalog and other 409 failures',async()=>fixture(async({attach,load})=>{
 const doc=globalThis.document,win=globalThis.window;let mounted;const port={addEventListener(){},removeEventListener(){}};globalThis.document={...port,visibilityState:'visible'};globalThis.window=port;
 try{
  const View=await load('components/my-taiko/Overview.vue',true);mounted=attach(()=>View.setup({}, {expose(){}}));const {model}=mounted;await settle();
  for(const reason of ['catalog-source-mismatch','source-mismatch','fact-owner-mismatch','unknown']){
   model.failure.value=model.readFailure({statusCode:409,data:{statusMessage:reason}});assert.equal(model.errorText.value,model.copy.value.unavailable);
  }
  model.failure.value=model.readFailure({statusCode:409,data:{statusMessage:'catalog-changed'}});assert.equal(model.errorText.value,model.copy.value.catalogChanged);
  for(const reason of ['profile-changed','binding-changed']){model.failure.value=model.readFailure({statusCode:409,data:{statusMessage:reason}});assert.equal(model.errorText.value,model.copy.value.changed);}
  model.failure.value=model.readFailure({},true);assert.equal(model.errorText.value,model.copy.value.timeout);
 }finally{mounted?.close();globalThis.document=doc;globalThis.window=win;}
}));

test('training loop: inactive generations coalesce, retain DTOs and activate with one read each',async()=>fixture(async({home,cached,states,requests,controlled,overview,recent})=>{
 await home.resolve();
 const page=cached(()=>({growth:usePlayerGrowth(ref(true),ref(1)),recent:useRecentGrowth(ref(true),ref(1))}));await settle();
 await page.deactivate();controlled.add(overviewPath);controlled.add(recentPath);
 const generation=states.get('account-home-generation');generation.value++;generation.value++;await settle();
 assert.equal(requests.length,0);assert.equal(page.model.growth.growth.value.scoreRevision,'r1');
 await page.activate();assert.equal(requests.filter(r=>r.path===overviewPath).length,1);assert.equal(requests.filter(r=>r.path===recentPath).length,1);
 assert.equal(page.model.growth.pending.value,false);assert.equal(page.model.recent.recent.value.profileId,'1');
 const reads=requests.splice(0);reads.find(r=>r.path===overviewPath).resolve({...overview,scoreRevision:'r2'});reads.find(r=>r.path===recentPath).resolve({...recent,observedAt:'2026-11-06T01:00:00Z'});await settle();
 assert.equal(page.model.growth.growth.value.scoreRevision,'r2');assert.equal(requests.length,0);
 generation.value++;generation.value++;await settle();assert.equal(requests.length,2);
 const stale=requests.splice(0);generation.value++;await settle();const current=requests.splice(0);
 for(const r of stale)r.resolve(r.path===overviewPath?{...overview,scoreRevision:'STALE'}:recent);await settle();assert.equal(page.model.growth.growth.value.scoreRevision,'r2');
 for(const r of current)r.resolve(r.path===overviewPath?{...overview,scoreRevision:'r3'}:recent);await settle();assert.equal(page.model.growth.growth.value.scoreRevision,'r3');
}));

test('Goal evaluation cannot overwrite a newer same-identity sync generation; independent Recent failure keeps completed evidence',async()=>fixture(async({attach,load,requests,overview,recent,states})=>{
 const goal={id:'1',profileId:'1',songId:100,difficultyType:4,title:'Synthetic',goalType:'score-pb',baseline:{highScore:1}};
 let reads=0,recentReads=0;
 const props=reactive({overview:{...overview,activeGoal:goal},displayName:'Synthetic',identity:'1:1:true',recent,
  refreshGrowth:async()=>{reads++;return true;},refreshRecent:async()=>{recentReads++;throw Error('Recent unavailable');},acknowledgeRecent:async()=>{}});
 const View=await load('components/home/PlayerGrowthSurface.vue',true),m=attach(()=>View.setup(props,{expose(){},emit(){}})).model;
 const late=m.evaluate();const old=requests.shift();states.get('account-home-generation').value++;
 old.resolve({profileId:'1',outcome:'completed',activeGoal:null,recentCompletedGoal:{...goal,status:'completed'}});await late;
 assert.equal(reads,0);assert.equal(m.recentCompletedGoal.value,null);assert.equal(m.busy.value,false);
 const current=m.evaluate();requests.shift().resolve({profileId:'1',outcome:'completed',activeGoal:null,recentCompletedGoal:{...goal,status:'completed',completionEvidence:{result:{goalType:'score-pb',before:1,after:2,delta:1}}}});await current;
 assert.equal(reads,1);assert.equal(recentReads,1);assert.equal(m.recentCompletedGoal.value.completionEvidence.result.after,2);assert.equal(m.choicesDisabled.value,false);
 props.overviewRefreshFailed=true;assert.equal(m.choicesDisabled.value,true,'A failed background Overview must block a stale plan');
}));
