import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc';
import {createSSRApp,createRenderer,Suspense,h,ref,computed,watch,onBeforeUnmount,nextTick} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {component,mount} from './fixtures/batch2ComponentHarness.mjs';
const vue=new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href;
async function rowComponent(path = 'components/RecommendationSongItem.vue'){
 const raw=await readFile(new URL('../'+path,import.meta.url),'utf8');
 const descriptor=parse(raw).descriptor;const script=compileScript(descriptor,{id:'shared-song',inlineTemplate:false});
 let code=script.content.replace('export default','const __Component =')+'\n'+compileTemplate({id:'shared-song',source:descriptor.template.content,compilerOptions:{bindingMetadata:script.bindings,expressionPlugins:['typescript']}}).code.replace('export function render','function render')+'\n__Component.render=render;export default __Component;';
 code=code.replace(/from ['"]vue['"]/g,'from '+JSON.stringify(vue)).replace(/['"]~\/utils\/difficulty['"]/g,JSON.stringify(new URL('../utils/difficulty.ts',import.meta.url).href));
 try{return (await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))).default;}catch{throw new Error('Shared song SFC import failed');}
}
for(const language of ['zh','ja'])test('actual shared row keeps actions outside navigation and optional fields honest ('+language+')',async()=>{
 const old=globalThis.useI18n;const messages=JSON.parse(await readFile(new URL('../locales/'+language+'.json',import.meta.url),'utf8'));
 globalThis.useI18n=()=>({t:key=>key.split('.').reduce((v,k)=>v?.[k],messages)||key});
 try{
  const component=await rowComponent();
  const render=async(props,slots)=>{const app=createSSRApp({render:()=>h(component,{songId:1455,title:'長いタイトルと曲名の末尾まで自然に読む',difficultyType:5,to:'/songs/1455?difficulty=5',...props},slots)});app.component('NuxtLink',{props:['to'],render(){return h('a',{href:this.to},this.$slots.default?.());}});app.component('SongCoverImage',{props:['songId','alt'],render(){return h('img',{alt:this.alt,'data-cover':this.songId});}});return renderToString(app);};
  const html=await render({starLevel:10},{actions:()=>h('button',{'data-song-action':''},'Choose'),details:()=>h('span','980,000'),tags:()=>h('span','未プレイ')});
  assert.match(html,/10★/);assert.match(html,/980,000/);assert.match(html,/未プレイ/);assert.match(html,/difficulty=5/);
  const link=html.slice(html.indexOf('<a '),html.indexOf('</a>')+4);assert.ok(!link.includes('<button'));assert.ok(html.indexOf('<button')>html.indexOf('</a>'));
  for(const starLevel of [undefined,null]){const absent=await render({starLevel},{});assert.ok(!absent.includes('★'));assert.ok(!absent.includes('song-row__actions'));assert.ok(!absent.includes('song-row__details'));assert.ok(!absent.includes('980,000'));}
 }finally{if(old===undefined)delete globalThis.useI18n;else globalThis.useI18n=old;}
});
test('ordinary existing goal handler preserves busy, preview failure retry, conflict and source credential through shared action',async()=>{
 const keys=['useState','useI18n','useLocalePath','useViewerApiFetch','ref','computed','watch','onBeforeUnmount','nextTick','document'];const old=new Map(keys.map(k=>[k,globalThis[k]]));let app;const pending=[],states=new Map([['account-user',ref({id:1})],['account-binding-generation',ref(0)]]);
 Object.assign(globalThis,{ref,computed,watch,onBeforeUnmount,nextTick,document:{activeElement:{focus(){}}},useState:k=>states.get(k),useI18n:()=>({t:k=>k,locale:ref('zh')}),useLocalePath:()=>x=>x,useViewerApiFetch:()=>((path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject})))});
 try{
  app=await mount(await component('components/RecommendationGoalAction.vue'),{songId:1455,difficultyType:5,token:'same-source-token'});const m=app.model;let shown=0;m.dialog={close(){},showModal(){shown++;}};
  let op=m.open();assert.equal(m.busy,true);pending.shift().reject({statusCode:503});await op;assert.equal(m.failed,true);assert.equal(m.busy,false);
  op=m.open();pending.shift().resolve({profileId:'1',songId:1455,difficultyType:5,title:'Fixture',goalOptions:['fc'],activeGoal:null,scoreRevision:'r1'});await op;assert.equal(shown,1);m.selected='fc';op=m.confirm();assert.equal(m.busy,true);const request=pending.shift();assert.equal(request.options.body.recommendationToken,'same-source-token');assert.equal(request.options.body.source,'ordinary-recommendation');assert.equal(request.options.body.difficultyType,5);request.reject({statusCode:409});await op;assert.equal(m.invalid,true);assert.equal(m.stale,true);assert.equal(m.busy,false);assert.equal(m.preview,null);
 }finally{app?.close();for(const[k,v]of old){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('actual goal dialog ref is available while parent Suspense still defers post-render effects',async()=>{
 const keys=['useState','useI18n','useLocalePath','useViewerApiFetch','ref','computed','watch','onBeforeUnmount','nextTick','document'];const old=new Map(keys.map(k=>[k,globalThis[k]]));let app,resolveGate;
 Object.assign(globalThis,{ref,computed,watch,onBeforeUnmount,nextTick,document:{activeElement:{focus(){}}},useState:()=>ref(null),useI18n:()=>({t:k=>k,locale:ref('zh')}),useLocalePath:()=>x=>x,useViewerApiFetch:()=>async()=>({})});
 const renderer=createRenderer({createElement:type=>({type,close(){},showModal(){}}),insert(){},remove(){},setElementText(){},patchProp(){},parentNode:()=>null,nextSibling:()=>null,createText:()=>({}),createComment:()=>({}),setText(){},setComment(){}});
 try{
  const Goal=await rowComponent('components/RecommendationGoalAction.vue');const Delayed={async setup(){await new Promise(resolve=>{resolveGate=resolve;});return()=>h('span');}};
  app=renderer.createApp({render:()=>h(Suspense,null,{default:()=>h('div',[h(Goal,{songId:1455,difficultyType:5,token:'fixture'}),h(Delayed)])})});app.component('NuxtLink',{render:()=>h('a')});app.mount({});await nextTick();
  const branch=app._instance.subTree.suspense.pendingBranch;assert.ok(branch,'parent is still pending');const state=branch.children[0].component.setupState;assert.ok(state.dialog,'dialog DOM binding must not wait for deferred mounted hooks');assert.equal(state.dialog.type,'dialog');
 }finally{resolveGate?.();await nextTick();app?.unmount();for(const[k,v]of old){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
