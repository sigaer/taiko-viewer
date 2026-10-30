import {useAccountDataRefresh} from '../composables/useAccountDataRefresh.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ref,computed,reactive,watch,nextTick,onUnmounted,onBeforeUnmount} from 'vue';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {component,mount} from './fixtures/batch2ComponentHarness.mjs';
import {buildSkillPassport} from '../server/services/growth-passport/composer.ts';
import {finalBrowserInput} from './fixtures/passportFinalUx.ts';
const settle=async()=>{for(let i=0;i<20;i++)await nextTick();};
const source=process.env.VIEWER_GROWTH_BASELINE ? pathToFileURL(process.env.VIEWER_GROWTH_BASELINE+'/') : undefined;
async function fixture(page,fn){
 const globals=['ref','computed','watch','onUnmounted','onBeforeUnmount','useState','useI18n','useLocalePath','useRoute','useRouter','navigateTo','useAccountState','useViewerApiFetch','useViewerSeo','definePageMeta','useAsyncData','useAccountRequestGuard','useAccountDataRefresh','$fetch'];const saved=new Map(globals.map(k=>[k,globalThis[k]]));
 const states=new Map([['account-user',ref({id:1})],['account-binding-generation',ref(0)]]),route=reactive({path:'/my/'+page,query:{}}),requests=[];let app,initial=true;
 const payload=page==='growth'?buildSkillPassport(finalBrowserInput('normal')):{profileId:'binding-A',week:{from:'2026-10-19',to:'2026-10-25'},coverage:{scoreHistoryState:'complete'},theme:{type:'score-breakthrough',confidence:'high'},measurementChange:{compatible:false,reason:'insufficient'},totals:{distinctCharts:7,pb:4,fc:2,df:1,rankUpgrade:2,completedGoals:1},highlights:[],currentNextAction:null};
 Object.assign(globalThis,{useAccountDataRefresh,ref,computed,watch,onUnmounted,onBeforeUnmount,useState:(k,init)=>{if(!states.has(k))states.set(k,ref(init?.()));return states.get(k);},useI18n:()=>({t:k=>k,locale:ref('zh')}),useLocalePath:()=>x=>x,useRoute:()=>route,useRouter:()=>({currentRoute:ref(route)}),navigateTo:async x=>{route.query=x.query;},useAccountState:()=>({accountUser:states.get('account-user'),fetchCurrentUser:async()=>{}}),useViewerSeo:()=>{},definePageMeta:()=>{}});
 const module=async name=>{const raw=await readFile(new URL('../composables/'+name+'.ts',import.meta.url),'utf8');const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "vue"/, 'from '+JSON.stringify(new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href));return import('data:text/javascript,'+encodeURIComponent(code));};
 // Actual API wrapper, transport only is synthetic. Binding mutation notification
 // is tested without touching a server, account, binding or score store.
 globalThis.useViewerApiFetch=(await module('useViewerApiFetch')).useViewerApiFetch;
 globalThis.useAccountRequestGuard=(await module('useAccountRequestGuard')).useAccountRequestGuard;
 globalThis.$fetch=async(path,options)=>{if(options?.method)return {};if(initial){initial=false;return payload;}return new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));};
 globalThis.useAsyncData=async(key,load,opts)=>{
  const data=ref(opts.default()),pending=ref(false);let generation=0;
  const clear=()=>{generation++;data.value=opts.default();pending.value=false;};
  const refresh=async()=>{const token=++generation;pending.value=true;try{const result=await load();if(token===generation)data.value=result;}finally{if(token===generation)pending.value=false;}};
  if(opts.watch)watch(opts.watch,()=>void refresh());await refresh();return {data,pending,refresh,clear};
 };
 try{app=await mount(await component('pages/my/'+page+'.vue',source));await fn({m:app.model,states,route,requests,payload,close:()=>{app.close();app=null;},deactivate:()=>app.deactivate(),activate:()=>app.activate(),api:globalThis.useViewerApiFetch()});}
 finally{app?.close();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
test('weekly actual page refetches after actual API binding invalidation; late success/failure cannot replace current identity',async()=>fixture('weekly',async({m,states,requests,api,payload})=>{
 assert.equal(m.weekly.profileId,'binding-A');
 await api('/api/account/bindings/current',{method:'POST',body:{bindingId:2}});await settle();
 if(source){assert.equal(requests.length,0);assert.equal(m.weekly.profileId,'binding-A');console.log('BASELINE REPRODUCED: actual binding broadcast leaves old weekly report with no refresh');return;}
 assert.equal(m.weekly,null);assert.equal(requests.length,1);const old=requests.shift();
 states.get('account-user').value={id:2};await settle();assert.equal(m.weekly,null);assert.equal(requests.length,1);requests.shift().resolve({...payload,profileId:'account-B'});await settle();assert.equal(m.weekly.profileId,'account-B');
 old.resolve({...payload,profileId:'late-A'});await settle();assert.equal(m.weekly.profileId,'account-B');
 const refreshing=m.retry();await settle();const staleFailure=requests.shift();states.get('account-binding-generation').value++;await settle();requests.shift().resolve({...payload,profileId:'binding-C'});await settle();staleFailure.reject({statusCode:503,data:{message:'late-A-error'}});await refreshing;assert.equal(m.weekly.profileId,'binding-C');assert.equal(m.pageError,'');
}));
if(!source){
 test('weekly week query/back-forward clears old report, error exits loading, retry recovers, logout/unmount drops requests',async()=>fixture('weekly',async({m,states,route,requests,payload,close})=>{
  for(const week of ['2026-10-12',undefined,'2026-10-12']){route.query=week?{week}:{};await settle();assert.equal(m.weekly,null);assert.equal(requests.length,1);assert.equal(requests[0].options.query?.week,week);requests.shift().resolve({...payload,profileId:week||'current'});await settle();assert.equal(m.weekly.profileId,week||'current');}
  const op=m.retry();await settle();requests.shift().reject({statusCode:503,data:{message:'synthetic-read-failure'}});await op;assert.equal(m.pending,false);assert.equal(m.weekly,null);assert.equal(m.pageError,'synthetic-read-failure');
  const retry=m.retry();await settle();requests.shift().resolve(payload);await retry;assert.equal(m.weekly.profileId,'binding-A');assert.equal(m.pageError,'');
  const late=m.retry();await settle();const response=requests.shift();states.get('account-user').value=null;await settle();assert.equal(m.weekly,null);response.resolve(payload);await late;assert.equal(m.weekly,null);assert.equal(m.pageError,'');
  states.get('account-user').value={id:3};await settle();const unmounted=requests.shift();close();unmounted.reject(new Error('unmounted'));await settle();
 }));
 test('growth actual page switches four periods and six dimensions from shared.views with no reads; missing values stay null',async()=>fixture('growth',async({m,route,requests})=>{
  const originals=m.passportState.payload.shared.segments.map(s=>s.points.map(p=>p.rating));
  for(const days of [30,90,180,365]){await m.changeRange(days);await settle();assert.equal(m.passport.range.requestedDays,days);for(const dim of ['big_song','stamina','speed','accuracy_power','rhythm','complex']){await m.chooseDimension(dim);await settle();assert.equal(m.selectedDimension,dim);}}
  assert.equal(requests.length,0);assert.equal(route.query.range,'365');assert.deepEqual(m.passportState.payload.shared.segments.map(s=>s.points.map(p=>p.rating)),originals);
  m.passportState.payload.current.dimensions.speed=null;await settle();assert.equal(m.currentSkills.find(s=>s.key==='speed').value,null);
  m.passportState.payload=buildSkillPassport(finalBrowserInput('ceiling'));await settle();const initial=m.visibleMilestones.map(n=>n.id);assert.equal(initial.length,8);m.expandedMilestones=true;await settle();assert.ok(m.visibleMilestones.length>8);assert.deepEqual(m.visibleMilestones.map(n=>n.id),m.passport.milestones.map(n=>n.id));m.expandedMilestones=false;await settle();assert.deepEqual(m.visibleMilestones.map(n=>n.id),initial);
 }));
 test('growth identity change, late failure, retry and observed date semantics remain independent of selected period',async()=>fixture('growth',async({m,states,requests,payload})=>{
  assert.equal(m.milestoneDate({day:null,observedAt:null}),'passport.unknownDate');assert.ok(m.milestoneDate({day:null,observedAt:'2026-08-11T04:00:00Z'}));
  const op=m.retry();await settle();const old=requests.shift();states.get('account-binding-generation').value++;await settle();assert.equal(m.passport,null);requests.shift().resolve({...payload,profileId:'new-binding'});await settle();old.reject({data:{message:'old failure'}});await op;assert.equal(m.passport.profileId,'new-binding');assert.equal(m.pageError,'');
  const fail=m.retry();await settle();requests.shift().reject({data:{message:'new failure'}});await fail;assert.equal(m.pending,false);assert.equal(m.passport,null);assert.equal(m.pageError,'new failure');
  const recover=m.retry();await settle();requests.shift().resolve(payload);await recover;assert.ok(m.passport);assert.equal(m.pageError,'');
 }));
}
if(!source)test('actual SVG chart retains frozen runs across metadata revisions, null gaps, point stepping and dimension reset',async()=>{
 const keys=['useI18n','ref','computed','watch','onBeforeUnmount'];const saved=new Map(keys.map(k=>[k,globalThis[k]]));let app;
 Object.assign(globalThis,{useAccountDataRefresh,ref,computed,watch,onBeforeUnmount,useI18n:()=>({t:k=>k,locale:ref('zh')})});
 try{
  const payload=buildSkillPassport(finalBrowserInput('singletons'));const props=reactive({segments:payload.segments,dimension:'rating',label:'Rating long label',from:'2026-07-11',to:'2026-10-08'});
  app=await mount(await component('components/PassportMetricChart.vue'),props);const m=app.model;
  assert.equal(m.points.length,4);assert.equal(m.runs.length,1,'model revisions do not break frozen lines');const values=m.points.map(p=>p.value);
  assert.equal(m.selectedIndex,3);m.stepPoint(-1);await settle();assert.equal(m.selectedIndex,2);m.stepPoint(1);await settle();assert.equal(m.selectedIndex,3);assert.deepEqual(m.points.map(p=>p.value),values);
  props.segments[1].points[0].dimensions.speed=null;props.dimension='speed';await settle();assert.equal(m.runs.length,2);assert.equal(m.points.length,3);assert.equal(m.selectedId,'');
  props.segments=[];await settle();assert.equal(m.points.length,0);assert.equal(m.selected,undefined);
 }finally{app?.close();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('growth uses sync generation while cached, rejects old reads, coalesces changes and shows a newly created goal on return',async()=>fixture('growth',async({m,states,requests,payload,deactivate,activate,api})=>{
 const oldRun=m.retry();await settle();const old=requests.shift();deactivate();
 await api('/api/account/sync',{method:'POST'});await api('/api/account/sync',{method:'POST'});await settle();
 assert.equal(m.passport,null);assert.equal(requests.length,0,'inactive page must not fetch');
 old.resolve({...payload,profileId:'stale-before-sync'});await oldRun;assert.equal(m.passport,null);
 activate();await settle();assert.equal(requests.length,1);
 const goal={id:'new-goal',title:'New goal',songId:1455,difficultyType:5,goalType:'fc'};
 requests.shift().resolve({...payload,profileId:'after-sync',activeGoal:goal});await settle();assert.equal(m.passport.profileId,'after-sync');assert.equal(m.passport.activeGoal.id,'new-goal');
 activate();await settle();assert.equal(requests.length,0);
}));
