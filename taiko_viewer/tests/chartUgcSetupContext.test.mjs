import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {ref,computed,reactive,toValue,watch,effectScope,getCurrentScope,nextTick} from 'vue';

const source = await readFile(process.env.CHART_UGC_BASELINE || new URL('../composables/useChartUgc.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replace(/^import .*;\s*$/gm,'').replace('export const useChartUgc','const useChartUgc');
const load=new Function('dependencies',`with(dependencies){${code};return useChartUgc;}`);

function harness({failure=null,signedIn=false}={}){
 const summary={chart:{chartId:12,songId:1454,difficultyCode:5},difficulty:{count:0,verifiedCount:0,mean:null},tags:[],availableTags:[],tips:[]};
 const viewer={chart:summary.chart,difficultyVote:null,tagSlugs:[],tagSelections:[],tip:null,helpfulTipIds:[]};
 const calls=[],registrations=[],navigations=[];const scope=effectScope();let setup=true,release;
 const gate=new Promise(resolve=>release=resolve);const accountUser=ref(signedIn?{id:10}:null);
 const apiFetch=async(path,options={})=>{calls.push({path,options});if(options.method==='PUT')return {...viewer,difficultyVote:options.body.value};if(failure)throw failure;return summary;};
 const requireSetup=()=>{if(!setup)throw new Error('[nuxt] instance unavailable');};
 const useAsyncData=(key,handler,options)=>{
  requireSetup();const data=ref(options.default()),error=ref(null),pending=ref(true);
  const promise=gate.then(async()=>{try{data.value=await handler();}catch(e){error.value=e;}finally{pending.value=false;}return state;});
  const state={data,error,pending,refresh:async()=>{data.value=await handler();}};return Object.assign(promise,state);
 };
 const useLazyAsyncData=(key,handler,options)=>{requireSetup();registrations.push({key:key(),server:options.server});return {data:ref(signedIn?viewer:null),error:ref(null),pending:ref(false)};};
 const use=load({ref,computed,reactive,toValue,useAsyncData,useLazyAsyncData,
  useViewerApiFetch:()=>{requireSetup();return apiFetch;},useLocalePath:()=>{requireSetup();return path=>'/ja'+path;},
  useAccountAuthStatus:()=>{requireSetup();return {accountUser,resolveAccountUser:async()=>accountUser.value};},
  watch:(...args)=>{requireSetup();assert.ok(getCurrentScope(),'watch belongs to caller scope');return watch(...args);},
  navigateTo:async target=>navigations.push(target),trackViewerEvent:()=>{}});
 const pending=scope.run(()=>use(ref(1454),ref(5)));setup=false;release();
 return {pending,scope,calls,registrations,navigations,summary,viewer,setFailure:value=>{failure=value;}};
}

test('UGC waits for SSR data while private composables and watchers stay inside setup',async()=>{
 const h=harness();try{const state=await h.pending;assert.equal(h.registrations.length,1);assert.deepEqual(h.registrations[0],{key:'chart-ugc-private-1454-5',server:false});assert.deepEqual(state.publicSummary.value,h.summary);assert.equal(state.viewerState.value,null);assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/content/songs/1454/ugc?difficulty=5');}finally{h.scope.stop();}
});

for(const status of [404,503])test(`public UGC ${status} preserves the failure state without throwing a context error`,async()=>{
 const failure=Object.assign(new Error('controlled public read failure'),{statusCode:status});const h=harness({failure});try{const state=await h.pending;assert.equal(state.publicSummary.value,null);assert.equal(state.publicState.error.value.statusCode,status);assert.equal(h.calls.length,1);}finally{h.scope.stop();}
});

test('a failed public read can refresh into the original summary',async()=>{
 const h=harness({failure:Object.assign(new Error('controlled public read failure'),{statusCode:503})});
 try{const state=await h.pending;assert.equal(state.publicSummary.value,null);assert.equal(typeof state.publicState.then,'undefined');h.setFailure(null);await state.publicState.refresh();assert.deepEqual(state.publicSummary.value,h.summary);}finally{h.scope.stop();}
});

test('existing vote payload, confirmed state and public refresh retain their meaning',async()=>{
 const h=harness({signedIn:true});try{const state=await h.pending;await state.setDifficultyVote(1);for(let i=0;i<10;i++)await nextTick();assert.equal(state.viewerState.value.difficultyVote,1);const writes=h.calls.filter(x=>x.options.method);assert.deepEqual(writes,[{path:'/api/account/charts/1454/5/ugc/difficulty',options:{method:'PUT',body:{value:1}}}]);assert.equal(h.calls.filter(x=>!x.options.method).length,2);}finally{h.scope.stop();}
});

test('guest action keeps song, difficulty and Japanese return route without writing',async()=>{
 const h=harness();try{const state=await h.pending;await state.setDifficultyVote(1);assert.deepEqual(h.navigations,[{path:'/ja/account/login',query:{redirect:'/ja/songs/1454?difficulty=5'}}]);assert.equal(h.calls.filter(x=>x.options.method).length,0);}finally{h.scope.stop();}
});
