import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {parse,compileScript} from '@vue/compiler-sfc';
import * as Vue from 'vue';
const root=process.env.VIEWER_HOME_BASELINE?pathToFileURL(process.env.VIEWER_HOME_BASELINE+'/'):new URL('../../',import.meta.url);
const vue=new URL('../../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href;
let sequence=0;
export const settle=async()=>{for(let i=0;i<30;i++)await Vue.nextTick();};
export async function load(path,sfc=false){
 let code=await readFile(new URL(path,root),'utf8');
 if(sfc)code=compileScript(parse(code).descriptor,{id:'home-state'}).content;
 code=code.replaceAll('import.meta.server','false').replaceAll('import.meta.client','true')
 .replace(/from ['"]vue['"]/g,'from '+JSON.stringify(vue))
 .replace(/import \{([^}]+)\} from ['"]~\/composables\/[^'"]+['"];?/g,(_,names)=>'const {'+names+'} = globalThis;')
 .replace(/(['"])~\/utils\/([^'"]+)\1/g,(_,q,name)=>JSON.stringify(new URL('utils/'+name+'.ts',root).href));
 const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const module=await import('data:text/javascript,'+encodeURIComponent(js+'\n// state fixture '+(++sequence)));
 if(sfc)module.default.render=()=>Vue.h('div');
 return sfc?module.default:module;
}
const renderer=Vue.createRenderer({createElement:()=>({}),insert:()=>{},remove:()=>{},setElementText:()=>{},patchProp:()=>{},parentNode:()=>null,nextSibling:()=>null,createText:()=>({}),createComment:()=>({}),setText:()=>{},setComment:()=>{}});
export async function fixture(fn){
 const keys=[...Object.keys(Vue),'useState','useNuxtApp','useI18n','useLocalePath','useViewerSeo','definePageMeta','$fetch','useAccountAuthStatus','useAccountState','useHomeState','useViewerApiFetch','usePlayerGrowth','useRecentGrowth'];
 const saved=new Map(keys.map(k=>[k,globalThis[k]]));
 const cleanup=[],states=new Map(),nuxt={vueApp:{onUnmount:fn=>cleanup.push(fn)}},apps=[],requests=[],controlled=new Set();
 const user={id:1,username:'Synthetic account A'},binding={id:1,taikoId:'synthetic-A',source:'manual'};
 const overview={profileId:'1',scoreRevision:'r1',activeGoal:null,playerState:{overallRating:10,skills:[],priorityDimension:null,tiedDimensions:[],dataSufficiency:'ready'},todayPlan:{items:[]},dailyProgress:{calendarDay:'2026-10-21',attendance:'unknown',uniqueCharts:null,events:[]},dataStatus:{mode:'SNAPSHOT_LIMITED',timezone:'Asia/Shanghai'}};
 const recent={profileId:'1',state:'new',observedAt:'2026-10-21T04:00:00Z',facts:[],totalFacts:0,boundary:{acknowledgedToken:null,currentToken:'synthetic-token',acknowledgeRequired:true,recovered:false}};
 const state=(k,init)=>{if(!states.has(k))states.set(k,Vue.ref(init?.()));return states.get(k);};
 state('account-user',()=>user);state('account-user-loaded',()=>true);
 const payload=path=>path.endsWith('/auth/me')?{authenticated:Boolean(states.get('account-user').value),user:states.get('account-user').value}:path==='/api/account/bindings'?{bindings:[binding],currentBinding:binding}:path==='/api/account/songs'?{total:1,items:[{highScore:900000}]}:path.endsWith('/overview')?structuredClone(overview):path.endsWith('/recent')?structuredClone(recent):{};
 Object.assign(globalThis,Vue,{useState:state,useNuxtApp:()=>nuxt,useI18n:()=>({t:k=>k,locale:Vue.ref('zh')}),useLocalePath:()=>x=>x,useViewerSeo:()=>{},definePageMeta:()=>{},$fetch:(path,options={})=>controlled.has(path)||options.method?new Promise((resolve,reject)=>requests.push({path,options,resolve,reject})):Promise.resolve(payload(path))});
 for(const name of ['useAccountAuthStatus','useAccountState','useViewerApiFetch','useHomeState','usePlayerGrowth','useRecentGrowth']){const mod=await load('composables/'+name+'.ts');globalThis[name]=mod[name];}
 const attach=setup=>{let model;const app=renderer.createApp({setup(){model=setup();return()=>Vue.h('div');}});app.mount({});apps.push(app);return {model,close:()=>{app.unmount();apps.splice(apps.indexOf(app),1);}};};
 const cached=setup=>{
  let model;const active=Vue.ref(true),Page={setup(){model=setup();return()=>Vue.h('div');}},Other={render:()=>Vue.h('span')};
  const app=renderer.createApp({render:()=>Vue.h(Vue.KeepAlive,null,{default:()=>Vue.h(active.value?Page:Other)})});app.mount({});apps.push(app);
  return {model,deactivate:async()=>{active.value=false;await settle();},activate:async()=>{active.value=true;await settle();},close:()=>{app.unmount();apps.splice(apps.indexOf(app),1);}};
 };
 let base;
 try{
  base=attach(()=>({auth:useAccountAuthStatus(),home:useHomeState(),api:useViewerApiFetch()}));
  await fn({...base.model,states,requests,controlled,attach,cached,load,overview,recent,binding,user,close:base.close,payload});
 }finally{for(const app of apps)app.unmount();for(const stop of cleanup)stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
