import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {accountPage,deferred,settle} from './fixtures/accountEntryHarness.mjs';
const fields=['form','submit','submitting','completionError'];
const fill=h=>{Object.assign(h.form,{identifier:'synthetic',username:'synthetic',email:'synthetic@example.invalid',code:'000000',password:randomBytes(24).toString('hex')});h.form.confirmPassword=h.form.password;};
const page=(name,api,options={},extra=[])=>accountPage('pages/account/'+name+'.vue',[...fields,...extra],api,options);
test('accepted login retries navigation without repeating POST or storing password',async()=>{let posts=0,nav=0;const h=await page('login',async()=>{posts++;return {user:{id:1}};},{navigate:()=>{if(++nav===1)throw Error('navigation');}},['rememberIdentifier']);fill(h);h.rememberIdentifier.value=true;await h.submit();assert.ok(h.form.password==='','password cleared');assert.ok(h.completionError.value);await h.submit();assert.equal(posts,1);assert.equal(nav,2);assert.deepEqual(Object.keys(h.remembered[0]),['id','on']);});
test('failed login stays editable and retries the failed request',async()=>{let posts=0;const h=await page('login',async()=>{if(++posts===1)throw Error('denied');return {user:{id:1}};});fill(h);await h.submit();assert.ok(h.form.password.length>0);assert.equal(h.remembered.length,0);await h.submit();assert.equal(posts,2);assert.equal(h.navigations.length,1);});
test('registration accepted then login fails: retry only login',async()=>{let reg=0,login=0;const h=await page('register',async path=>{if(path.endsWith('/register')){reg++;return {ok:true};}if(++login===1)throw Error('login failed');return {user:{id:1}};},{},['registered']);fill(h);await h.submit();assert.equal(h.registered.value,true);assert.equal(h.submitting.value,false);assert.ok(h.form.password.length>0);await h.submit();assert.equal(reg,1);assert.equal(login,2);assert.ok(h.form.password==='');assert.equal(h.navigations.length,1);});
test('accepted reset retries navigation without repeating reset',async()=>{let posts=0,nav=0;const h=await page('forgot-password',async()=>{posts++;return {ok:true};},{navigate:()=>{if(++nav===1)throw Error('navigation');}},['completed']);fill(h);await h.submit();assert.equal(h.completed.value,true);assert.ok(h.form.password==='');await h.submit();assert.equal(posts,1);assert.equal(nav,2);});
test('resolved navigation cancellation retains reset receipt',async()=>{let posts=0;const h=await page('forgot-password',async()=>{posts++;return {ok:true};},{navigate:()=>({failure:true})});fill(h);await h.submit();await h.submit();assert.equal(posts,1);assert.ok(h.completionError.value);});
test('session failure after accepted login retries session rather than POST',async()=>{let posts=0,reads=0;const h=await page('login',async()=>{posts++;return {user:{id:1}};},{session:async()=>++reads===1?null:{id:1},sessionError:true});fill(h);await h.submit();assert.equal(h.navigations.length,0);await h.submit();assert.equal(posts,1);assert.equal(reads,2);assert.equal(h.navigations.length,1);});
test('late login after leaving cannot navigate or retain phase',async()=>{const p=deferred(),h=await page('login',()=>p.promise,{},['authenticatedUserId']);fill(h);const run=h.submit();h.deactivate();p.resolve({user:{id:1}});await run;assert.equal(h.navigations.length,0);assert.equal(h.authenticatedUserId.value,null);assert.ok(h.form.password==='');});
test('late login cannot replace another account context',async()=>{const p=deferred(),h=await page('login',()=>p.promise,{},['authenticatedUserId']);fill(h);const run=h.submit();h.user.value={id:2};p.resolve({user:{id:1}});await run;assert.equal(h.authenticatedUserId.value,null);assert.equal(h.navigations.length,0);});
test('duplicate reset click while pending is serialized',async()=>{const p=deferred();let posts=0;const h=await page('forgot-password',()=>{posts++;return p.promise;});fill(h);const run=h.submit();await h.submit();assert.equal(posts,1);p.reject(Error('denied'));await run;assert.equal(h.submitting.value,false);assert.ok(h.form.password.length>0);});
test('support late accepted create cannot clear next account draft',async()=>{const p=deferred(),h=await accountPage('pages/support.vue',['form','submit','submitting'],()=>p.promise,{user:{id:1,email:'a@example.invalid'},data:{items:[]}});h.form.title='Synthetic';h.form.content='Body';const run=h.submit();h.user.value={id:2,email:'b@example.invalid'};h.form.title='Next draft';p.resolve({ticket:{id:1},mailDelivered:false});await run;assert.equal(h.form.title,'Next draft');assert.equal(h.messages.length,0);assert.equal(h.submitting.value,false);});
test('support failure preserves draft, stored ticket and failed mail are distinct',async()=>{let fail=true;const h=await accountPage('pages/support.vue',['form','submit'],async()=>{if(fail)throw Error('denied');return {ticket:{id:1},mailDelivered:false};},{user:{id:1,email:'a@example.invalid'},data:{items:[]}});h.form.title='Synthetic';h.form.content='Body';await h.submit();assert.equal(h.form.content,'Body');fail=false;await h.submit();assert.equal(h.form.content,'');assert.equal(h.messages.at(-1).kind,'warning');assert.match(h.messages.at(-1).text,/已记录.*邮件/);});
test('grants old read cannot replace new identity',async()=>{const p=deferred();let n=0;const seed={clients:[],bindings:[],grants:[{grantId:'old'}],hasMore:{clients:false,bindings:false,grants:false}};const h=await accountPage('pages/account/developer/grants.vue',['state','refresh'],async path=>path.endsWith('/grants')?(++n===1?p.promise:{...seed,grants:[{grantId:'new'}]}):path.endsWith('/clients')?{clients:[],hasMore:false}:{currentApplication:null},{user:{id:1,developerApiV1Access:true},session:()=>({id:1,developerApiV1Access:true})});const run=h.refresh();h.user.value={id:2,developerApiV1Access:true};assert.equal(h.state.value,null);await settle();p.resolve(seed);await run;await settle();assert.equal(h.state.value.grants[0].grantId,'new');});
test('review transport failure is not permission denial',async()=>{const h=await accountPage('pages/account/developer/review.vue',[],async()=>{throw {statusCode:503};},{user:{id:1}});await assert.rejects(h.resource.load(),e=>e.statusCode===503);const denied=await accountPage('pages/account/developer/review.vue',[],async()=>{throw {statusCode:403};},{user:{id:1}});assert.equal((await denied.resource.load()).forbidden,true);});

test('grants first KeepAlive return refreshes even without an initial activated callback',async()=>{
 let reads=0;const seed={clients:[],bindings:[],grants:[{grantId:'first'}],hasMore:{clients:false,bindings:false,grants:false}};
 const h=await accountPage('pages/account/developer/grants.vue',['state','refresh'],async path=>{if(path.endsWith('/grants')){reads++;return seed;}return path.endsWith('/clients')?{clients:[],hasMore:false}:{currentApplication:null};},{user:{id:1,developerApiV1Access:true},session:()=>({id:1,developerApiV1Access:true})});
 await h.refresh();h.deactivate();assert.equal(h.state.value,null);h.activate();await settle();assert.equal(reads,2);assert.ok(h.state.value);
});

test('inactive cached grants do not issue background reads on identity switch',async()=>{
 let reads=0;const h=await accountPage('pages/account/developer/grants.vue',['refresh'],async path=>{reads++;return path.endsWith('/clients')?{clients:[],hasMore:false}:path.endsWith('/grants')?{clients:[],bindings:[],grants:[],hasMore:{clients:false,bindings:false,grants:false}}:{currentApplication:null};},{user:{id:1,developerApiV1Access:true},session:()=>({id:1,developerApiV1Access:true})});
 h.deactivate();h.user.value={id:2,developerApiV1Access:true};await settle();assert.equal(reads,0);
});
test('late verification code cannot start cooldown or feedback after leaving',async()=>{
 const pending=deferred();const h=await page('register',()=>pending.promise,{},['sendCode','sendingCode','cooldown']);fill(h);const task=h.sendCode();h.deactivate();pending.resolve({ok:true});await task;assert.equal(h.cooldown.value,0);assert.equal(h.sendingCode.value,false);assert.equal(h.messages.length,0);
});
test('accepted reset does not send another verification code',async()=>{
 let requests=0;const h=await page('forgot-password',async()=>{requests++;return {ok:true};},{navigate:()=>({failure:true})},['sendCode']);fill(h);await h.submit();await h.sendCode();assert.equal(requests,1);
});
test('login return target rejects external and backslash forms',async()=>{
 for(const redirect of ['https://example.invalid','//example.invalid','/\\example.invalid','/bad\r\npath']){
  const h=await page('login',async()=>({user:{id:1}}),{query:{redirect}},['redirectAfterLogin']);assert.equal(h.redirectAfterLogin.value,'/account/profile');
 }
});

test('confirmed expired session permits explicit reauthentication instead of an endless session-only retry',async()=>{
 let posts=0,reads=0;const h=await page('login',async()=>{posts++;return {user:{id:1}};},{session:async()=>++reads===1?null:{id:1}},['authenticatedUserId']);fill(h);await h.submit();assert.equal(h.authenticatedUserId.value,null);assert.match(h.completionError.value,/会话已变化/);fill(h);await h.submit();assert.equal(posts,2);assert.equal(h.navigations.length,1);
});
test('confirmed different session never navigates using a former login receipt',async()=>{
 const h=await page('login',async()=>({user:{id:1}}),{session:async()=>({id:2})},['authenticatedUserId']);fill(h);await h.submit();assert.equal(h.authenticatedUserId.value,null);assert.equal(h.navigations.length,0);
});

test('review prompt closes on identity change and never submits the previous applicant',async()=>{
 const pending=deferred();let closed=0,posts=0,prompts=0;const dialog={prompt:()=>{prompts++;return pending.promise;},close:()=>{closed++;pending.reject(Error('closed'));}};
 const h=await accountPage('pages/account/developer/review.vue',['handleApprove'],async()=>{posts++;return {};},{user:{id:1},dialog});const task=h.handleApprove({id:1});await h.handleApprove({id:1});assert.equal(prompts,1);h.user.value={id:2};await task;assert.equal(closed,1);assert.equal(posts,0);
});
test('score token confirmation closes on binding switch and does not revoke the new binding',async()=>{
 const pending=deferred();let closed=0,posts=0;const h=await accountPage('pages/account/sync.vue',['manageScoreToken','issuedScoreToken'],async()=>{posts++;return {};},{user:{id:1},data:{targets:[],cooldownRemainingSeconds:0},dialog:{confirm:()=>pending.promise,close:()=>{closed++;pending.reject(Error('closed'));}}});const task=h.manageScoreToken('revoke');h.states.get('account-binding-generation').value++;await task;assert.equal(closed,1);assert.equal(posts,0);assert.ok(h.issuedScoreToken.value==='');
});

test('sync feedback separates success, partial, failed and missing result',async()=>{
 const h=await accountPage('pages/account/sync.vue',['buildSyncFeedback'],async()=>({}),{user:{id:1},data:{targets:[],cooldownRemainingSeconds:0}});
 assert.equal(h.buildSyncFeedback({status:'success',results:[{ok:true,label:'one'}]}).level,'success');assert.equal(h.buildSyncFeedback({status:'partial',results:[{ok:true,label:'one'},{ok:false,label:'two',message:'denied'}]}).level,'warning');assert.equal(h.buildSyncFeedback({status:'failed',results:[{ok:false,label:'one',message:'denied'}]}).level,'error');assert.equal(h.buildSyncFeedback(null).level,'warning');
});

test('initial authentication read failure retries the existing session without password POST',async()=>{
 let reads=0,posts=0;const h=await page('login',async()=>{posts++;return {};},{session:async()=>++reads===1?null:{id:1},sessionError:true},['retryAuth','authRetrying','accountAuthError']);h.accountAuthError.value='Synthetic read failure';await h.retryAuth();assert.equal(h.authRetrying.value,false);assert.ok(h.accountAuthError.value);await h.retryAuth();assert.equal(h.accountAuthError.value,null);assert.equal(h.navigations.length,1);assert.equal(posts,0);
});
test('inactive auth form cannot start a queued submission',async()=>{
 let posts=0;const h=await page('login',async()=>{posts++;return {user:{id:1}};});h.deactivate();fill(h);await h.submit();assert.equal(posts,0);
});

test('verified existing session with navigation failure continues without password POST',async()=>{
 let posts=0,nav=0;const h=await page('login',async()=>{posts++;return {user:{id:1}};},{session:async()=>({id:1,username:'synthetic'}),navigate:()=>{if(++nav===1)throw Error('navigation');}},['retryAuth']);await h.retryAuth();assert.ok(h.completionError.value);await h.submit();assert.equal(posts,0);assert.equal(nav,2);
});
