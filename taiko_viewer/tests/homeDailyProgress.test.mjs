import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import ts from 'typescript';
import {computed,ref,createSSRApp,h} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {composeHomeGrowthFeedback} from '../utils/homeGrowthFeedback.ts';

for(const lang of ['zh','ja'])test(`actual Daily SFC distinguishes goal-relocated changes from played-only quiet state (${lang})`,async()=>{
 const keys=['computed','useI18n','useLocalePath'],before=new Map(keys.map(k=>[k,globalThis[k]]));
 const copy=JSON.parse(await readFile(new URL(`../locales/${lang}.json`,import.meta.url),'utf8'));
 const t=key=>key.split('.').reduce((v,k)=>v?.[k],copy)||key;
 Object.assign(globalThis,{computed,useI18n:()=>({t,locale:ref(lang)}),useLocalePath:()=>value=>value});
 try{
  const source=await readFile(new URL('../components/home/DailyProgress.vue',import.meta.url),'utf8');
  let code=compileScript(parse(source).descriptor,{id:'daily-state',inlineTemplate:true}).content;
  for(const [from,to] of [['vue','../node_modules/vue/dist/vue.runtime.esm-bundler.js'],['~/utils/difficulty','../utils/difficulty.ts'],['~/utils/scoreRank','../utils/scoreRank.ts']])code=code.replaceAll(`from '${from}'`,'from '+JSON.stringify(new URL(to,import.meta.url).href)).replaceAll(`from "${from}"`,'from '+JSON.stringify(new URL(to,import.meta.url).href));
  let component;try{component=(await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))).default;}catch(error){throw new Error('Daily SFC import failed: '+error.code);}
  const daily={calendarDay:'2026-10-20',dataMode:'SNAPSHOT_LIMITED',attendance:'played',uniqueCharts:7,events:[
   {songId:1,level:4,title:'Changed chart',occurredAt:'2026-10-20T05:00:00Z',evidence:'history',evidenceRevision:'r1',importance:65,facts:[{type:'score-pb',before:900,after:950,delta:50}]},
   {songId:2,level:3,title:'Played chart',occurredAt:'2026-10-20T06:00:00Z',evidence:'history',evidenceRevision:'r1',importance:0,facts:[{type:'played',before:null,after:null,delta:null}]}
  ]};
  const goal={id:'completed',profileId:'1',status:'completed',songId:1,difficultyType:4,baseline:{highScore:900},completionEvidence:{observationRevision:'r1',result:{goalType:'score-pb',before:900,after:950,facts:{}}}};
  const render=async(progress,original)=>{
   const app=createSSRApp({render:()=>h(component,{progress,original})});
   app.component('NuxtLink',{props:['to'],render(){return h('a',{},this.$slots.default?.());}});
   return renderToString(app);
  };
  const shown=composeHomeGrowthFeedback(goal,daily,undefined,null,'1');
  assert.equal(shown.dailyProgress.events.length,1);assert.equal(shown.dailyProgress.uniqueCharts,7);
  const relocated=await render(shown.dailyProgress,daily);
  assert.ok(relocated.includes(t('home.growth.dailyElsewhere')),'Daily must acknowledge the change displayed in the goal above');
  assert.ok(relocated.includes('Played chart'),'the unrelated played-only chart remains visible');
  assert.ok(!relocated.includes(lang==='zh'?'暂无可确认的成绩变化':'成績の変化はまだ確認できません'));
  const played={...daily,events:[daily.events[1]]};
  const quiet=await render(played,played);
  assert.ok(!quiet.includes(t('home.growth.dailyElsewhere')));
  assert.ok(quiet.includes(lang==='zh'?'暂无可确认的成绩变化':'成績の変化はまだ確認できません'));
 }finally{for(const [key,value] of before){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
