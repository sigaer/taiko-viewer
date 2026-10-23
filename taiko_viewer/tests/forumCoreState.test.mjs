// Pure URL contracts plus the production resource composable under real Vue
// reactivity and bounded async-data/lifecycle ports. Browser/SQL are separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {ref,computed,watch,nextTick,effectScope} from 'vue';
import {parseForumListQuery,forumListLocationQuery,forumPageInRange} from '../utils/forumListQuery.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();await nextTick();};
async function resource(load,{context=ref('one'),enabled=ref(true),hydratedFailure=''}={}){
 const scope=effectScope(),user=ref({id:1}),states=new Map(),hooks={deactivated:[],activated:[],beforeUnmount:[]};let raw,loads=0;
 if(hydratedFailure)states.set('fixture:failure',ref({context:'1:one',message:hydratedFailure}));
 const source=await readFile(new URL('../composables/useForumResource.ts',import.meta.url),'utf8');
 const code=stripTypeScriptTypes(source.replace(/^import[^\n]*;\r?\n/gm,'').replace('export const useForumResource','const useForumResource'),{mode:'strip'});
 const ports={ref,computed,watch,useState:(key,factory)=>{if(!states.has(key))states.set(key,ref(factory()));return states.get(key);},useAccountState:()=>({accountUser:user}),useI18n:()=>({t:key=>key,locale:ref('zh')}),
  resolveViewerError:async(error,_fallback,t)=>{assert.equal(typeof t,'function');return error.message;},
  useAccountRequestGuard:()=>{let generation=0;watch(()=>user.value?.id,()=>generation++,{flush:'sync'});return {capture:()=>generation,current:n=>n===generation,invalidate:()=>generation++};},
  onDeactivated:fn=>hooks.deactivated.push(fn),onActivated:fn=>hooks.activated.push(fn),onBeforeUnmount:fn=>hooks.beforeUnmount.push(fn),
  useAsyncData:(_key,loader)=>{const data=ref(null),pending=ref(false);let sequence=0;const refresh=async()=>{const n=++sequence;pending.value=true;try{const value=await loader();if(n===sequence)data.value=value;}finally{if(n===sequence)pending.value=false;}};raw={data,pending,refresh,clear:()=>{sequence++;data.value=null;pending.value=false;}};if(!hydratedFailure)void refresh();return raw;}
 };
 const create=new Function(...Object.keys(ports),code+';return useForumResource;')(...Object.values(ports));
 const view=scope.run(()=>create('fixture',()=>{loads++;return load();},{context:()=>context.value,enabled:()=>enabled.value}));
 await settle();return {view,user,context,enabled,raw,loads:()=>loads,fire:name=>hooks[name].forEach(fn=>fn()),close:()=>{hooks.beforeUnmount.forEach(fn=>fn());scope.stop();}};
}

test('forum query normalizes invalid page, sort, song and difficulty without NaN',()=>{
 assert.deepEqual(parseForumListQuery({page:'NaN',sort:'unknown',songId:'-1',difficultyType:'6'}),{page:1,sort:'latest',keyword:'',threadType:'',songId:'',difficultyType:''});
 assert.equal(parseForumListQuery({page:'Infinity'}).page,1);assert.equal(parseForumListQuery({page:'1.5'}).page,1);
});
test('committed forum URL preserves exact search, section-independent song/difficulty and paging',()=>{
 const input={keyword:['  検索  ','ignored'],sort:'hot',threadType:'guide',songId:'1455',difficultyType:'5',page:3};
 assert.deepEqual(forumListLocationQuery(input),{keyword:'検索',sort:'hot',threadType:'guide',songId:'1455',difficultyType:'5',page:'3'});
 const plain=forumListLocationQuery({sort:'latest',page:1});assert.equal(plain.sort,undefined);assert.equal(plain.page,undefined);
});
test('resource owns the plain Nuxt payload so notification cache reconciliation remains visible',async()=>{
 const r=await resource(async()=>({unreadNotificationCount:3}));try{assert.equal(r.view.data.value.unreadNotificationCount,3);r.raw.data.value.unreadNotificationCount=0;assert.equal(r.view.data.value.unreadNotificationCount,0);assert.equal(r.loads(),1);r.fire('activated');assert.equal(r.loads(),1);}finally{r.close();}
});
test('identity switch immediately clears private rows and drops a late previous identity success',async()=>{
 const a=deferred(),b=deferred();let n=0;const r=await resource(()=>++n===1?a.promise:b.promise);
 try{r.user.value={id:2};assert.equal(r.view.data.value,null);b.resolve({owner:2});await settle();a.resolve({owner:1});await settle();assert.equal(r.view.data.value.owner,2);assert.equal(r.loads(),2);}finally{r.close();}
});
test('account round trip never revives a previous-generation response',async()=>{
 const requests=[];const r=await resource(()=>{const x=deferred();requests.push(x);return x.promise;});
 try{r.user.value={id:2};r.user.value={id:1};requests[2].resolve({marker:'fresh A'});await settle();requests[0].resolve({marker:'old A'});requests[1].resolve({marker:'B'});await settle();assert.equal(r.view.data.value.marker,'fresh A');}finally{r.close();}
});
test('error is distinct from empty; retry exits loading and retains explicit translator',async()=>{
 let fail=true;const r=await resource(async()=>{if(fail)throw Error('read failed');return {items:[]};});
 try{assert.equal(r.view.error.value,'read failed');assert.equal(r.view.data.value,null);assert.equal(r.view.pending.value,false);fail=false;await r.view.refresh();assert.equal(r.view.error.value,'');assert.deepEqual(r.view.data.value.items,[]);}finally{r.close();}
});
test('late failure cannot replace the next query success or show its error',async()=>{
 const old=deferred();let n=0;const r=await resource(()=>++n===1?old.promise:Promise.resolve({query:'new'}));
 try{r.context.value='two';await settle();old.reject(Error('stale failure'));await settle();assert.equal(r.view.data.value.query,'new');assert.equal(r.view.error.value,'');}finally{r.close();}
});
test('deactivation cancels pending results and activation performs one recovery read',async()=>{
 const old=deferred();let n=0;const r=await resource(()=>++n===1?old.promise:Promise.resolve({marker:'return'}));
 try{r.fire('deactivated');old.resolve({marker:'away'});await settle();assert.equal(r.view.data.value,null);r.fire('activated');await settle();assert.equal(r.view.data.value.marker,'return');assert.equal(r.loads(),2);}finally{r.close();}
});
test('unmounted view cannot consume a delayed success',async()=>{
 const old=deferred();const r=await resource(()=>old.promise);r.close();old.resolve({private:'old'});await settle();assert.equal(r.view.data.value,null);
});
test('staff-only disabled resource does not request, enables once and clears on demotion',async()=>{
 const enabled=ref(false);const r=await resource(async()=>({admin:true}),{enabled});
 try{assert.equal(r.loads(),0);enabled.value=true;await settle();assert.equal(r.loads(),1);assert.equal(r.view.data.value.admin,true);enabled.value=false;await settle();assert.equal(r.view.data.value,null);assert.equal(r.loads(),1);}finally{r.close();}
});

test('SSR failed payload remains failure through cached-null hydration, without a false empty state',async()=>{
 const r=await resource(async()=>({items:[]}),{hydratedFailure:'SSR unavailable'});
 try{assert.equal(r.view.error.value,'SSR unavailable');assert.equal(r.view.data.value,null);assert.equal(r.loads(),0);await r.view.refresh();assert.deepEqual(r.view.data.value.items,[]);assert.equal(r.view.error.value,'');}finally{r.close();}
});

test('stale personal page is clamped from server total and page size, not an empty visible slice',()=>{
 assert.equal(forumPageInRange(9,15,10),2);assert.equal(forumPageInRange(2,15,10),2);assert.equal(forumPageInRange(9,0,10),1);
});
test('shared chart/section list corrects only the page while preserving committed filter query',()=>{
 const original={songId:'1455',difficultyType:'5',keyword:'検索',sort:'hot',page:9};
 const next=forumListLocationQuery({...original,page:forumPageInRange(9,15,12)});
 assert.deepEqual(next,{songId:'1455',difficultyType:'5',keyword:'検索',sort:'hot',threadType:undefined,page:'2'});
});
