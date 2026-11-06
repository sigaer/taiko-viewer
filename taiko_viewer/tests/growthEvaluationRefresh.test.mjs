import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import * as growthVoice from '../utils/growthVoice.ts';
const data=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
test('actual Surface setup: all outcomes refresh once; failure retains completion and blocks next; fresh Overview wins; POST profile race discarded',async()=>{
 const source=await readFile(new URL('../components/home/PlayerGrowthSurface.vue',import.meta.url),'utf8');
 const {descriptor}=parse(source);let code=ts.transpileModule(compileScript(descriptor,{id:'growth-test'}).content,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const stubs={...growthVoice,formatScoreRank:n=>String(n),composeGrowthFeedback:(g,d)=>({goalType:g?.goalType,dailyProgress:d}),GROWTH_DIMENSION_LABELS:{},GROWTH_DIMENSION_SHORT_LABELS:{},growthGreetingPeriod:()=>'',difficultyLabelKey:()=>'',trackViewerEvent:()=>{}};
 globalThis.__growthTestStubs=stubs;
 code=code.replace(/import \{([^}]+)\} from ["']([^"']+)["'];/g,(_,names,path)=>path==='vue'?`import {${names}} from ${JSON.stringify(import.meta.resolve('vue'))};`:`const {${names}}=globalThis.__growthTestStubs;`);
 const component=(await import(data(code))).default;
 let request;const calls=[];let restored=0;
 const globals={...vue,document:{activeElement:{focus:()=>restored++}},useI18n:()=>({t:x=>x,locale:vue.ref('zh')}),useLocalePath:()=>x=>x,useViewerApiFetch:()=>(path,options)=>{calls.push({path,options});return request.promise},onBeforeUnmount:()=>{}};
 for(const [k,v]of Object.entries(globals))globalThis[k]=v;
 const scope=vue.effectScope();
 try{
 const active={id:'1',profileId:'1',songId:100,difficultyType:4,goalType:'score-pb'};
 const overview={profileId:'1',scoreRevision:'R1',activeGoal:active,recentCompletedGoal:null,playerState:{skills:[],tiedDimensions:[]},dailyProgress:{events:[]},todayPlan:{items:[]}};
 let refreshCalls=0,refreshResult=true;let fresh;
 const props=vue.reactive({identity:'9:1:true',overview,displayName:'Test',refreshGrowth:async identity=>{assert.equal(identity,props.identity);refreshCalls++;if(fresh){props.overview=fresh;await vue.nextTick()}return refreshResult}});
 const ui=scope.run(()=>component.setup(props,{expose(){}}));
 // Replacing a goal must visibly open a picker even when no recommendation is eligible.
 let opened=0,radioFocused=0;
 const dialog={open:false,showModal(){this.open=true;opened++},close(){this.open=false},querySelector(){return {focus(){radioFocused++}}}};
 ui.selector.value=dialog;
 ui.chooseAnother();await vue.nextTick();
 assert.equal(opened,1);assert.equal(ui.selected.value,null);assert.equal(ui.replacementItems.value.length,0);
 assert.equal(ui.activeGoal.value.id,'1');assert.equal(calls.length,0);
 ui.closeGoal();assert.ok(restored>0);
 const other={songId:200,difficultyType:5,title:'Other chart',goalOptions:['score-pb']};
 props.overview={...overview,todayPlan:{items:[{...active,goalOptions:['score-pb']},{songId:300,difficultyType:4,goalOptions:[]},other]}};
 await vue.nextTick();
 assert.deepEqual(ui.replacementItems.value.map(x=>x.songId),[200]);
 ui.chooseAnother();await vue.nextTick();ui.openGoal(ui.replacementItems.value[0]);await vue.nextTick();
 assert.equal(ui.selected.value.songId,200);assert.equal(radioFocused,1);assert.equal(calls.length,0);
 ui.selectedType.value='score-pb';request=deferred();const replacing=ui.mutate();
 assert.equal(calls.at(-1).options.body.expectedActiveGoalId,'1');assert.equal(calls.at(-1).options.body.songId,200);
 request.resolve({profileId:'1',activeGoal:{...active,id:'replacement',songId:200}});await replacing;
 assert.equal(ui.activeGoal.value.id,'replacement');assert.equal(ui.selected.value,null);
 ui.needsRefresh.value=true;const beforeDisabled=opened;ui.chooseAnother();await vue.nextTick();assert.equal(opened,beforeDisabled);ui.needsRefresh.value=false;
 for(const outcome of ['active','inconclusive','completed']){
  props.overview={...overview};await vue.nextTick();request=deferred();const action=ui.evaluate();
  const completed={...active,status:'completed'};
  request.resolve({profileId:'1',outcome,activeGoal:outcome==='completed'?null:active,recentCompletedGoal:outcome==='completed'?completed:null});await action;
  assert.equal(ui.needsRefresh.value,false);
 }
 assert.equal(refreshCalls,3);
 props.overview={...overview};await vue.nextTick();refreshResult=false;request=deferred();const failing=ui.evaluate();request.resolve({profileId:'1',outcome:'completed',activeGoal:null,recentCompletedGoal:{...active,status:'completed'}});await failing;
 assert.equal(ui.activeGoal.value,null);assert.equal(ui.recentCompletedGoal.value.status,'completed');assert.equal(ui.choicesDisabled.value,true);assert.equal(ui.refreshFailed.value,true);
 refreshResult=true;fresh={...overview,scoreRevision:'R2',activeGoal:{...active,id:'fresh-goal'}};await ui.refreshAfterEvaluation(props.identity);
 assert.equal(ui.activeGoal.value.id,'fresh-goal');assert.equal(ui.recentCompletedGoal.value,null);assert.equal(ui.choicesDisabled.value,false);
 const before=refreshCalls;request=deferred();const stale=ui.evaluate();props.identity='9:2:true';props.overview={...overview,profileId:'2',activeGoal:null};await vue.nextTick();props.identity='9:1:true';props.overview={...overview};await vue.nextTick();request.resolve({profileId:'1',outcome:'completed',activeGoal:null,recentCompletedGoal:{id:'stale'}});await stale;
 assert.equal(refreshCalls,before);assert.notEqual(ui.recentCompletedGoal.value?.id,'stale');
 }finally{scope.stop();delete globalThis.__growthTestStubs;for(const k of Object.keys(globals))delete globalThis[k]}
});
