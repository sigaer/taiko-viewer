// Extend the existing compiler-sfc/esbuild + Chromium component host.
// Actual profile SFC, Element Plus, API composable, login/session, SQL and binding routes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {createApp,createRouter,defineEventHandler,toNodeListener,createError,setHeader} from 'h3';
import {parse,compileScript} from '@vue/compiler-sfc';
import {build,stop} from 'esbuild';
import {chromium} from 'playwright-core';
import {monitorAcceptanceResources} from './goalAcceptanceResources.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
export async function bindingVerificationBrowser(c,other,nativeFetch) {
 const out=process.env.QA_EVIDENCE_DIR,source=await readFile(new URL('../../pages/account/profile.vue',import.meta.url),'utf8');
 const finish=await monitorAcceptanceResources(resolve(out,'binding-browser-resources.json'));
 const {descriptor}=parse(source),compiled=compileScript(descriptor,{id:'binding-profile-qa',inlineTemplate:true});
 const shell=`
 import {createApp as vueApp,ref,h,Suspense,onMounted,onBeforeUnmount} from 'vue';
 import {ElButton,ElInput,ElCard,ElAvatar,ElAlert,ElEmpty,ElOption,ElRadioButton,ElRadioGroup,ElSelect,ElSkeleton,ElUpload,ElMessage} from 'element-plus';
 import {ofetch} from 'ofetch';import {useViewerApiFetch} from './composables/useViewerApiFetch';
 const state=new Map(),asyncState=new Map();const user=ref(null);let app;let profileReads=0;
 globalThis.onMounted=onMounted;globalThis.onBeforeUnmount=onBeforeUnmount;
 globalThis.useState=(key,init)=>{if(!state.has(key))state.set(key,ref(init()));return state.get(key)};
 globalThis.$fetch=ofetch;globalThis.useViewerApiFetch=useViewerApiFetch;
 globalThis.useI18n=()=>({locale:ref('zh'),t:key=>key});globalThis.useLocalePath=()=>path=>path;
 globalThis.useViewerDateTime=()=>({formatDateTime:value=>value||''});globalThis.definePageMeta=()=>{};globalThis.useViewerSeo=()=>{};globalThis.useAnnualBeta=()=>({track(){}});
 const fetchCurrentUser=async()=>{user.value=(await ofetch('/api/account/auth/me')).user;return user.value};
 globalThis.useAccountState=()=>({accountUser:user,fetchCurrentUser});
 globalThis.useAsyncData=(key,handler,options)=>{
  let entry=asyncState.get(key);if(!entry){entry={data:ref(options.default()),pending:ref(false),error:ref(null),serial:0};asyncState.set(key,entry)};
  entry.refresh=async()=>{const serial=++entry.serial;entry.pending.value=true;try{if(key==='account-profile')profileReads++;const value=await handler();if(serial===entry.serial)entry.data.value=value}catch(e){if(serial===entry.serial)entry.error.value=e}finally{if(serial===entry.serial)entry.pending.value=false}};
  onMounted(entry.refresh);return entry;
 };
 function mount(){app=vueApp({render:()=>h(Suspense,null,{default:()=>h(Page)})});for(const [name,component] of Object.entries({ElButton,ElInput,ElCard,ElAvatar,ElAlert,ElEmpty,ElOption,ElRadioButton,ElRadioGroup,ElSelect,ElSkeleton,ElUpload}))app.component(name,component);for(const name of ['AnnualBetaContinue','AccountAvatarCropperDialog'])app.component(name,{render:()=>null});app.component('NuxtLink',{props:['to'],setup:props=>()=>h('a',{href:props.to})});app.mount('#app')}
 window.qa={mount,leave(){app.unmount();ElMessage.closeAll()},async refresh(){await asyncState.get('account-profile').refresh()},async identity(){await fetchCurrentUser();await this.refresh()},generation(){return state.get('account-binding-generation')?.value||0},reads(){return profileReads},clearMessages(){ElMessage.closeAll()}};mount();
 `;
 let script;
 try{const result=await build({stdin:{contents:compiled.content.replace('export default','const Page =')+shell,resolveDir:new URL('../../',import.meta.url).pathname,loader:'ts'},bundle:true,format:'iife',write:false,minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.server':'false'},plugins:[{name:'viewer-alias',setup(b){b.onResolve({filter:/^~\//},args=>({path:resolve(new URL('../../',import.meta.url).pathname,args.path.slice(2)+'.ts')}))}}]});script=result.outputFiles[0].text;}finally{stop()}
 assert.ok(script.length<3*1024*1024,'Bounded real component bundle');
 const css=await readFile(new URL('../../node_modules/element-plus/dist/index.css',import.meta.url),'utf8');
 const html=`<!doctype html><html><meta charset="utf-8"><style>${css}\n${descriptor.styles.map(s=>s.content).join('\n')}</style><div id="app"></div><script>${script.replaceAll('</script','<\\/script')}</script></html>`;
 const previousHandler=globalThis.defineEventHandler;globalThis.defineEventHandler=defineEventHandler;
 const router=createRouter(),gates=new Set();let nextGate=null,server,browser;
 const report={sourceSha256:createHash('sha256').update(source).digest('hex'),scope:'Real complete profile SFC and Element Plus; actual API composable and authenticated binding HTTP/SQL; Nuxt shell/async-data adapter supplied, unrelated showcase/beta components stubbed; no production access',cases:[]};
 try{
  const auth=await import('../../server/utils/account/auth.ts');
  router.get('/ui',defineEventHandler(event=>{setHeader(event,'Content-Type','text/html; charset=utf-8');return html}));
  router.get('/api/account/auth/me',defineEventHandler(async event=>({user:await auth.getCurrentAccountSummary(event)})));
  router.get('/api/account/profile',(await import('../../server/api/account/profile.get.ts')).default);
  router.get('/api/account/my-don/showcase',defineEventHandler(()=>({bindingId:null,taikoId:null,hasUserdata:false,isCustom:false,layoutMode:'nickname',selectedTitles:[],availableTitles:[]})));
  router.post('/login',(await import('../../server/api/account/auth/login.post.ts')).default);
  for(const kind of ['prepare','confirm','current']){
   const handler=(await import('../../server/api/account/bindings/'+kind+'.post.ts')).default;
   router.post('/api/account/bindings/'+kind,defineEventHandler(async event=>{
    const gate=nextGate?.kind===kind?nextGate:null;if(gate)nextGate=null;
    c.state.expectedSourceMode=kind==='confirm'?'write':'none';
    let value,error;
    try{if(gate?.status>=400)throw createError({statusCode:gate.status,statusMessage:gate.reason});value=await handler(event)}catch(e){error=e}
    if(gate){gate.actualStatus=error?.statusCode||200;gate.ready.resolve();await gate.release.promise}
    if(error)throw error;return value;
   }));
  }
  server=createServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  const credentials=new Map();for(const id of [c.user,other]){const password=randomBytes(16).toString('hex'),[[account]]=await c.pool.query('SELECT username FROM web_user_accounts WHERE id=?',[id]);await c.pool.execute('UPDATE web_user_accounts SET password_hash=?,email_verified=1 WHERE id=?',[await c.shared.getPasswordHash(password),id]);credentials.set(id,{identifier:account.username,password})}
  const login=async(context,id)=>{const response=await nativeFetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials.get(id)),signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);const [name,...parts]=response.headers.get('set-cookie').split(';')[0].split('=');await context.addCookies([{name,value:parts.join('='),url:base}])};
  const targetB=c.taikoId.slice(0,-1)+(c.taikoId.endsWith('9')?'8':'9');c.remoteProfiles.set(targetB,{userid:targetB,title:'Synthetic B',titleplateId:1,requests:0});
  await c.shared.writeUserdataWithHistory(targetB,{profile:{userid:targetB},songs:[]},'wahlap');
  const gate=(kind,status=200)=>{const g={kind,status,reason:status===409?'绑定验证记录已变化，请重新开始验证':'称号尚未变化，请修改后再确认',ready:deferred(),release:deferred()};gates.add(g);nextGate=g;return g};
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});
  await c.prepare();c.change();await c.confirm();
  const matrix=['confirm-input','confirm-target','confirm-account','confirm-binding','prepare-input','prepare-account','prepare-target','confirm-retry-busy','leave-confirm','leave-prepare'];
  for(const name of matrix)for(const status of [200,400]){
   const row={name,status,result:'FAIL'};report.cases.push(row);let context,page,g,newGate;
   try{
    await c.pool.execute('UPDATE web_taiko_bindings SET is_current=(taiko_id=?) WHERE user_id=?',[c.taikoId,c.user]);
    c.remote.title='Baseline '+report.cases.length;await c.prepare();c.change();
    context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'});await login(context,c.user);page=await context.newPage();page.setDefaultTimeout(6000);
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
    await page.goto(base+'/ui');await page.locator('.pending-box button').waitFor();
    const input=page.locator('.binding-card .bind-input-row input'),prepare=page.locator('.binding-card .bind-input-row button'),confirm=page.locator('.pending-box button');
    const kind=name.includes('prepare')?'prepare':'confirm';g=gate(kind,status);
    if(kind==='prepare')await input.fill(c.taikoId);await (kind==='prepare'?prepare:confirm).click();await Promise.race([g.ready.promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Gate deadline')),8000))]);
    if(name.includes('leave')){await page.evaluate(()=>window.qa.leave());await page.evaluate(()=>window.qa.mount());await page.locator('.binding-card .bind-input-row input').waitFor()}
    else if(name.includes('account')){await login(context,other);await page.evaluate(()=>window.qa.identity())}
    else if(name==='confirm-target'||name==='confirm-retry-busy'){
     await input.fill(targetB);await prepare.click();await page.waitForFunction(target=>document.querySelector('.pending-box')?.textContent.includes(target),targetB);
     if(name==='confirm-retry-busy'){c.remoteProfiles.get(targetB).title='Verified B '+report.cases.length;newGate=gate('confirm');await confirm.click();await newGate.ready.promise}
    }
    else if(name==='prepare-target'){await input.fill(targetB);newGate=gate('prepare');await prepare.click();await newGate.ready.promise}
    else if(name==='confirm-binding'){
     await page.locator('.binding-item--manual').getByRole('button',{name:'切换为当前',exact:true}).click();
     await page.waitForFunction(()=>!document.querySelector('.binding-item .is-loading'));

    }
    await page.locator('.binding-card .bind-input-row input').fill(targetB);await page.evaluate(()=>window.qa.clearMessages());await page.waitForFunction(()=>document.querySelectorAll('.el-message__content').length===0);
    const before=await page.evaluate(()=>window.qa.reads());g.release.resolve();await page.waitForTimeout(180);
    row.inputPreserved=(await page.locator('.binding-card .bind-input-row input').inputValue())===targetB;
    row.messages=await page.locator('.el-message__content').allTextContents();row.unexpectedRefreshes=await page.evaluate(()=>window.qa.reads())-before;
    if(newGate)row.newRequestStillBusy=await (name==='prepare-target'?prepare:confirm).evaluate(el=>el.classList.contains('is-loading'));
    row.pendingTargetB=name==='confirm-target'?await page.locator('.pending-box').innerText():undefined;
    row.errors=errors;row.result=row.inputPreserved&&row.messages.length===0&&row.unexpectedRefreshes===0&&errors.length===0&&row.newRequestStillBusy!==false?'PASS':'FAIL';
    if(newGate){assert.equal(newGate.actualStatus,200,'The replacement request must succeed normally');newGate.release.resolve();await page.waitForFunction(()=>Boolean(document.querySelector('.binding-card'))&&!document.querySelector('.binding-card .is-loading'))}
    if(row.result==='FAIL'&&report.cases.filter(x=>x.result==='FAIL').length<=3)await page.screenshot({path:resolve(out,`binding-${name}-${status}.png`)});
   }catch(error){row.result='FAIL';row.error=String(error.message).slice(0,220)}finally{g?.release.resolve();newGate?.release.resolve();await page?.close();await context?.close()}
  }
  for(const name of ['unchanged-400','expired-400','replaced-409','network-confirm','timeout-confirm','cancel-confirm','network-prepare','timeout-prepare','cancel-prepare']){
   const row={name,result:'FAIL'};report.cases.push(row);let context,page,g;
   try{
    c.remote.title='Retry baseline '+report.cases.length;await c.prepare();c.change();
    context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await login(context,c.user);page=await context.newPage();page.setDefaultTimeout(6000);
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await page.goto(base+'/ui');await page.locator('.pending-box button').waitFor();
    const input=page.locator('.binding-card .bind-input-row input'),prepare=page.locator('.binding-card .bind-input-row button'),confirm=page.locator('.pending-box button');
    const kind=name.endsWith('prepare')?'prepare':'confirm',endpoint='**/api/account/bindings/'+kind;let submissions=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/account/bindings/'+kind&&request.method()==='POST')submissions++});
    if(kind==='prepare')await input.fill(c.taikoId);
    const business=name.includes('-400')||name.includes('-409');
    if(business){g=gate('confirm',name.endsWith('409')?409:400);if(name==='expired-400')g.reason='未找到有效的绑定验证记录，请重新开始验证'}
    else await page.route(endpoint,route=>route.abort(name.startsWith('timeout')?'timedout':name.startsWith('cancel')?'aborted':'failed'));
    await (kind==='prepare'?prepare:confirm).click();
    if(g){await g.ready.promise;if(name!=='unchanged-400')await c.pool.execute('DELETE FROM web_taiko_binding_verifications WHERE user_id=?',[c.user]);g.release.resolve()}
    await page.locator('.el-message--error').waitFor();await page.waitForFunction(()=>Boolean(document.querySelector('.binding-card'))&&!document.querySelector('.binding-card .is-loading'));
    row.errorVisible=true;row.submissionsBeforeRetry=submissions;row.busyReleased=true;row.pendingCount=await page.locator('.pending-box').count();
    if(name==='expired-400'||name==='replaced-409')assert.equal(row.pendingCount,0,'Invalid challenge must leave a working restart path');
    if(name==='unchanged-400')assert.equal(row.pendingCount,1,'Unchanged title keeps a valid challenge');
    assert.equal(submissions,1,'No automatic POST retries');if(!business)await page.unroute(endpoint);
    if(kind==='prepare'||row.pendingCount===0){await input.fill(c.taikoId);await prepare.click();await page.waitForFunction(()=>Boolean(document.querySelector('.binding-card'))&&!document.querySelector('.binding-card .is-loading'));await page.locator('.pending-box button').waitFor();c.remote.title='Retry changed '+report.cases.length}
    await page.evaluate(()=>window.qa.clearMessages());await page.waitForFunction(()=>document.querySelectorAll('.el-message__content').length===0);
    await confirm.click();await page.locator('.el-message--success').waitFor();await page.waitForFunction(()=>Boolean(document.querySelector('.binding-card'))&&!document.querySelector('.binding-card .is-loading'));
    row.deliberateRetry='PASS';row.result='PASS';
    if(name==='expired-400')await page.screenshot({path:resolve(out,'binding-retry-mobile.png')});
   }catch(error){row.result='FAIL';row.error=String(error.message).slice(0,220)}finally{g?.release.resolve();await page?.close();await context?.close()}
  }
 }finally{
  for(const g of gates)g.release.resolve();await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}globalThis.defineEventHandler=previousHandler;await finish();
  report.passed=report.cases.filter(r=>r.result==='PASS').length;report.total=report.cases.length;report.status=report.passed===report.total?'PASS':'FAIL';await writeFile(resolve(out,'binding-browser-matrix.json'),JSON.stringify(report,null,2)+'\n');
 }
 assert.equal(report.passed,report.total,'Binding browser isolation acceptance failures; see scoped matrix');
}
