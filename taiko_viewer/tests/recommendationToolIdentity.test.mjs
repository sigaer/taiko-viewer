import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {ref,nextTick,createRenderer,h} from 'vue';

test('recommendation batch clears list and image, cancels and ignores late account/binding responses',async()=>{
 const pending=[],state=new Map([['account-user',ref({id:1})],['account-binding-generation',ref(0)]]);
 const previous={fetch:globalThis.$fetch,state:globalThis.useState};
 globalThis.useState=(key,init)=>{if(!state.has(key))state.set(key,ref(init?.()));return state.get(key);};
 globalThis.$fetch=(path,options)=>new Promise((resolve,reject)=>pending.push({resolve,reject,signal:options.signal,query:options.query}));
 const renderer=createRenderer({createElement:()=>({}),insert:()=>{},remove:()=>{},setElementText:()=>{},patchProp:()=>{},parentNode:()=>null,nextSibling:()=>null,createText:()=>({}),createComment:()=>({}),setText:()=>{},setComment:()=>{}});
 let app;
 try{
  const source=(await readFile(new URL('../composables/useRecommendationTool.ts',import.meta.url),'utf8')).replace("'vue'",JSON.stringify(new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href));
  const {useRecommendationTool}=await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText));
  let model;app=renderer.createApp({setup(){model=useRecommendationTool();return()=>h('div');}});app.mount({});
  const query={n:7,dim:'体力',image:true};let request=model.load(query),old=pending.shift();assert.deepEqual(old.query,query);
  state.get('account-user').value={id:2};assert.equal(old.signal.aborted,true);old.resolve({items:['A'],image:'A'});await request;assert.equal(model.data.value,null);
  request=model.load(query);pending.shift().resolve({items:['B'],image:'B'});await request;assert.equal(model.data.value.image,'B');
  state.get('account-user').value={id:1};await nextTick();assert.equal(model.data.value,null,'switching back cannot restore old batch');
  request=model.load(query);old=pending.shift();state.get('account-binding-generation').value++;old.reject(Error('late A'));await request;assert.equal(model.failed.value,false);assert.equal(model.loading.value,false);
  const first=model.load(query),one=pending.shift(),second=model.load({...query,n:3}),two=pending.shift();two.resolve({items:['new'],image:'new'});await second;one.resolve({items:['old'],image:'old'});await first;assert.equal(model.data.value.image,'new');
  request=model.load(query);old=pending.shift();app.unmount();app=null;old.resolve({items:['unmounted']});await request;assert.equal(model.data.value,null);
 }finally{app?.unmount();globalThis.$fetch=previous.fetch;globalThis.useState=previous.state;}
});
