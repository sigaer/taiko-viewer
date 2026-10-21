import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {ref,computed,nextTick,createRenderer,h} from 'vue';
const vue=new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href;
async function load(name){
 const source=(await readFile(new URL('../composables/'+name+'.ts',import.meta.url),'utf8'))
  .replace('"vue"',JSON.stringify(vue)).replace('"~/utils/viewerError"',JSON.stringify(new URL('../utils/viewerError.ts',import.meta.url).href));
 return (await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)))[name];
}
const renderer=createRenderer({createElement:()=>({}),insert:()=>{},remove:()=>{},setElementText:()=>{},patchProp:()=>{},parentNode:()=>null,nextSibling:()=>null,createText:()=>({}),createComment:()=>({}),setText:()=>{},setComment:()=>{}});
const empty={dani:[],constants:{pass:[],comprehensive:[]},stars:[],named:[],pages:{pass:{},comprehensive:{},star:{},named:{}}};
async function fixture(fn){
 const keys=['useI18n','useViewerApiFetch','useState','useToolChartImage','$fetch'];const before=new Map(keys.map(k=>[k,globalThis[k]]));
 const pending=[],state=new Map([['account-user',ref({id:1})],['account-binding-generation',ref(0)]]);let inSetup=true,i18nCalls=0;
 globalThis.useI18n=()=>{assert.ok(inSetup,'i18n must only be captured during setup');i18nCalls++;return {t:key=>'translated:'+key,locale:ref('ja')};};
 globalThis.useState=(key,init)=>{if(!state.has(key))state.set(key,ref(init?.()));return state.get(key);};
 globalThis.useViewerApiFetch=()=>((path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject})));
 globalThis.$fetch=(path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject}));
 let app,model;
 const mount=(factory)=>{app=renderer.createApp({setup(){model=factory();return()=>h('div');}});app.mount({});inSetup=false;return model;};
 try{await fn({mount,pending,state,unmount:()=>{app?.unmount();app=null;},i18nCalls:()=>i18nCalls});}
 finally{app?.unmount();for(const [key,value] of before){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}
test('progress options request failure exits loading, displays translated error and retry recovers; empty is distinct',async()=>fixture(async({mount,pending,i18nCalls})=>{
 const use=await load('useProgressOptions');const m=mount(use);
 const failed=m.loadOptions();assert.equal(m.optionsLoading.value,true);pending.shift().reject({statusCode:503,message:'[GET] /api/options: 503'});await failed;
 assert.equal(m.optionsLoading.value,false);assert.equal(m.options.value,null);assert.equal(m.optionsError.value,'translated:page.common.serviceUnavailable');assert.equal(i18nCalls(),1);
 const retry=m.loadOptions();assert.equal(m.optionsError.value,'');const normal={...empty,stars:[9,10]};pending.shift().resolve(normal);await retry;
 assert.deepEqual(m.options.value.stars,[9,10]);assert.equal(m.optionsLoading.value,false);assert.equal(m.optionsError.value,'');
 const legalEmpty=m.loadOptions();pending.shift().resolve(empty);await legalEmpty;assert.deepEqual(m.options.value.stars,[]);assert.equal(m.optionsError.value,'');
}));
test('progress options cancel superseded reads, binding/account switches and unmount; late errors cannot replace new options',async()=>fixture(async({mount,pending,state,unmount})=>{
 const use=await load('useProgressOptions');const m=mount(use);
 const old=m.loadOptions(),a=pending.shift();const newer=m.loadOptions(),b=pending.shift();assert.equal(a.options.signal.aborted,true);
 b.resolve({...empty,named:['上位']});await newer;a.reject({statusCode:503});await old;assert.equal(m.options.value.named[0],'上位');assert.equal(m.optionsError.value,'');
 const switching=m.loadOptions(),c=pending.shift();state.get('account-binding-generation').value++;const d=pending.shift();assert.equal(c.options.signal.aborted,true);assert.equal(m.options.value,null);
 c.resolve({...empty,named:['old']});await switching;assert.equal(m.options.value,null);d.resolve(empty);await nextTick();await nextTick();assert.equal(m.optionsError.value,'');
 state.get('account-user').value={id:2};const e=pending.shift();unmount();assert.equal(e.options.signal.aborted,true);e.reject({statusCode:503});await nextTick();await nextTick();assert.equal(m.optionsError.value,'');assert.equal(m.optionsLoading.value,false);
}));
test('chart result follows exact submitted query, cancels edits/page switches and handles blob errors without async composables',async()=>fixture(async({mount,pending,state,unmount})=>{
 const image=await load('useToolChartImage');globalThis.useToolChartImage=image;const use=await load('useToolChartResult');
 const query=ref({kind:'star',star:10,page:1});const m=mount(()=>use(computed(()=>({...query.value}))));
 let run=m.generate('/api/account/progress/image');assert.match(pending[0].path,/kind=star&star=10&page=1/);pending.shift().resolve(new Blob(['sample']));await run;
 assert.equal(m.resultQuery.value.page,1);assert.ok(m.imageUrl.value);const first=m.imageUrl.value;
 query.value={kind:'star',star:10,page:2};assert.equal(m.imageUrl.value,'');assert.equal(m.resultQuery.value,null);assert.equal(m.changed.value,true);
 run=m.generate('/api/account/progress/image');const stale=pending.shift();query.value={kind:'named',name:'上位',page:1};assert.equal(stale.options.signal.aborted,true);stale.resolve(new Blob(['old page']));await run;assert.equal(m.imageUrl.value,'');
 run=m.generate('/api/account/progress/image');pending.shift().reject({statusCode:503,data:new Blob(['{"message":"Synthetic image failure"}'])});await run;assert.equal(m.loading.value,false);assert.equal(m.errorMessage.value,'Synthetic image failure');assert.equal(m.resultQuery.value,null);
 run=m.generate('/api/account/progress/image');pending.shift().resolve(new Blob(['new image']));await run;assert.equal(m.resultQuery.value.kind,'named');assert.notEqual(m.imageUrl.value,first);
 state.get('account-binding-generation').value++;assert.equal(m.imageUrl.value,'');assert.equal(m.resultQuery.value,null);assert.equal(m.changed.value,false);
 run=m.generate('/api/account/charts/b30');const end=pending.shift();unmount();end.resolve(new Blob(['unmounted']));await run;assert.equal(m.imageUrl.value,'');
}));
test('account operation guard invalidates same-user binding changes, sign out/back and closed view',async()=>fixture(async({mount,state,unmount})=>{
 const use=await load('useAccountRequestGuard');const m=mount(use);const a=m.capture();assert.equal(m.current(a),true);
 state.get('account-binding-generation').value++;assert.equal(m.current(a),false);const b=m.capture();state.get('account-user').value=null;state.get('account-user').value={id:1};assert.equal(m.current(b),false);
 const c=m.capture();m.invalidate();assert.equal(m.current(c),false);const d=m.capture();unmount();assert.equal(m.current(d),false);
}));
