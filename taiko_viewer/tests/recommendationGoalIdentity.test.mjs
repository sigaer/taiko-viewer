import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {parse,compileScript} from '@vue/compiler-sfc';
import {ref,reactive,computed,watch,onBeforeUnmount,nextTick,createRenderer,h} from 'vue';

test('actual confirmation component drops late preview/save across identities and requires a fresh intent',async()=>{
 const keys=['useState','useI18n','useLocalePath','useViewerApiFetch','ref','computed','watch','onBeforeUnmount','nextTick','document'],before=new Map(keys.map(k=>[k,globalThis[k]]));
 const state=new Map([['account-user',ref({id:1})],['account-binding-generation',ref(0)]]),pending=[];
 Object.assign(globalThis,{ref,computed,watch,onBeforeUnmount,nextTick,useState:(key)=>state.get(key),useI18n:()=>({t:x=>x,locale:ref('zh')}),useLocalePath:()=>x=>x,useViewerApiFetch:()=>((path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject}))),document:{activeElement:{focus(){}}}});
 const renderer=createRenderer({createElement:()=>({}),insert:()=>{},remove:()=>{},setElementText:()=>{},patchProp:()=>{},parentNode:()=>null,nextSibling:()=>null,createText:()=>({}),createComment:()=>({}),setText:()=>{},setComment:()=>{}});
 let app;
 try{
  const source=await readFile(new URL('../components/RecommendationGoalAction.vue',import.meta.url),'utf8');
  const compiled=compileScript(parse(source).descriptor,{id:'goal-identity'}).content.replaceAll("from 'vue'",'from '+JSON.stringify(new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href)).replace("'~/utils/difficulty'",JSON.stringify(new URL('../utils/difficulty.ts',import.meta.url).href));
  const component=(await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(compiled,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))).default;component.render=()=>h('div');
  const props=reactive({token:'intent-A',songId:100,difficultyType:5});
  app=renderer.createApp({setup:()=>()=>h(component,props)});app.mount({});
  const model=app._instance.subTree.component.setupState;
  let shown=0;model.dialog={showModal(){shown++;},close(){}};
  const preview={profileId:'1',scoreRevision:'current',songId:100,difficultyType:5,title:'Fixture',starLevel:10,goalOptions:['score-pb'],activeGoal:null};
  let request=model.open(),old=pending.shift();state.get('account-user').value={id:2};assert.equal(old.options.signal.aborted,true);old.resolve(preview);await request;assert.equal(model.preview,null);assert.equal(shown,0);assert.equal(model.invalid,true);
  state.get('account-user').value={id:1};await model.open();assert.equal(pending.length,0,'switch back cannot reuse old confirmation');
  props.token='fresh-intent-A';await nextTick();request=model.open();pending.shift().resolve(preview);await request;assert.equal(shown,1);model.selected='score-pb';
  request=model.confirm();old=pending.shift();await model.confirm();assert.equal(pending.length,0,'double click issues one save');assert.equal(old.options.body.source,'ordinary-recommendation');assert.equal(old.options.body.difficultyType,5);
  state.get('account-binding-generation').value++;assert.equal(old.options.signal.aborted,true);old.resolve({profileId:'1'});await request;assert.equal(model.saved,false);assert.equal(model.preview,null);assert.equal(model.busy,false);
  props.token='fresh-again';await nextTick();request=model.open();old=pending.shift();app.unmount();app=null;old.reject(Error('late after unmount'));await request;assert.equal(model.failed,false);
 }finally{app?.unmount();for(const [key,value] of before){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
