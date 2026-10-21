import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {ref,nextTick,createRenderer,h} from 'vue';

test('tool image rejects late responses across account/binding switch, switch back and unmount',async()=>{
 const pending=[],revoked=[],state=new Map([['account-user',ref({id:1})],['account-binding-generation',ref(0)]]);
 const before={i18n:globalThis.useI18n,fetch:globalThis.$fetch,state:globalThis.useState,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 globalThis.useI18n=()=>({t:key=>key,locale:ref('zh')});
 globalThis.useState=(key,init)=>{if(!state.has(key))state.set(key,ref(init?.()));return state.get(key);};
 globalThis.$fetch=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));
 let urls=0;URL.createObjectURL=()=>`blob:synthetic-${++urls}`;URL.revokeObjectURL=url=>revoked.push(url);
 const renderer=createRenderer({createElement:()=>({}),insert:()=>{},remove:()=>{},setElementText:()=>{},patchProp:()=>{},parentNode:()=>null,nextSibling:()=>null,createText:()=>({}),createComment:()=>({}),setText:()=>{},setComment:()=>{}});
 let app;
 try{
  const source=(await readFile(new URL('../composables/useToolChartImage.ts',import.meta.url),'utf8'))
   .replace('"vue"',JSON.stringify(new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href))
   .replace('"~/utils/viewerError"',JSON.stringify(new URL('../utils/viewerError.ts',import.meta.url).href));
  const {useToolChartImage}=await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText));
  let model;app=renderer.createApp({setup(){model=useToolChartImage();return()=>h('div');}});app.mount({});
  const first=model.loadChart('/api/account/charts/recommend',{n:20});
  state.get('account-user').value={id:2};await nextTick();
  pending.shift().resolve(new Blob(['A']));await first;
  assert.equal(model.imageUrl.value,'','account A response cannot enter account B');
  const second=model.loadChart('/api/account/charts/recommend');pending.shift().resolve(new Blob(['B']));await second;
  assert.match(model.imageUrl.value,/^blob:/);
  state.get('account-user').value={id:1};await nextTick();assert.equal(model.imageUrl.value,'');assert.equal(revoked.length,1);
  const switching=model.loadChart('/api/account/charts/recommend');state.get('account-binding-generation').value++;await nextTick();
  pending.shift().resolve(new Blob(['old binding']));await switching;assert.equal(model.imageUrl.value,'');
  const unmounted=model.loadChart('/api/account/charts/recommend');app.unmount();app=null;
  pending.shift().resolve(new Blob(['unmounted']));await unmounted;assert.equal(model.imageUrl.value,'');
 }finally{
  app?.unmount();globalThis.useI18n=before.i18n;globalThis.$fetch=before.fetch;globalThis.useState=before.state;URL.createObjectURL=before.create;URL.revokeObjectURL=before.revoke;
 }
});
