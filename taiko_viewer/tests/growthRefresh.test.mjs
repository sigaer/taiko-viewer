import { useAccountDataRefresh } from '../composables/useAccountDataRefresh.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as vue from 'vue';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
test('unified Growth refresh preserves UI, replaces full DTO and rejects stale identity/generation including ABA',async()=>{
 const calls=[];const binding=vue.ref({id:1});const user=vue.ref(9);const enabled=vue.ref(true);
 const globals={...vue, useAccountDataRefresh, useState: (_key, init) => vue.ref(init()),useHomeState:()=>({currentBinding:binding}),useViewerApiFetch:()=>(path,options)=>{assert.equal(options.retry,0);const d=deferred();calls.push(d);return d.promise}};
 for(const [k,v] of Object.entries(globals))globalThis[k]=v;
 const scope=vue.effectScope();
 try{
 const source=await readFile(new URL('../composables/usePlayerGrowth.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {usePlayerGrowth}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const state=scope.run(()=>usePlayerGrowth(enabled,user));
 const r1={profileId:'1',scoreRevision:'R1',playerState:{skills:[1],priorityDimension:'rhythm'},todayPlan:{items:[1]},dailyProgress:{events:[1]},activeGoal:{id:'old'}};
 calls[0].resolve(r1);await vue.nextTick();assert.equal(state.growth.value.scoreRevision,'R1');
 const identity=state.identity.value;const refresh=state.refresh(identity);assert.equal(calls.length,2);assert.equal(state.pending.value,false);assert.equal(state.refreshing.value,true);assert.equal(state.growth.value.scoreRevision,'R1');
 const r2={profileId:'1',scoreRevision:'R2',playerState:{skills:[2],priorityDimension:'stamina'},todayPlan:{items:[2]},dailyProgress:{events:[2]},activeGoal:null,recentCompletedGoal:{id:'completed'}};
 calls[1].resolve(r2);assert.equal(await refresh,true);assert.deepEqual(vue.toRaw(state.growth.value),r2);
 const failure=state.refresh(identity);calls[2].reject(Error('offline'));assert.equal(await failure,false);assert.equal(state.error.value,null);assert.ok(state.refreshError.value);assert.equal(state.growth.value.scoreRevision,'R2');
 const old=state.refresh(identity);binding.value={id:2};assert.equal(calls.length,5);assert.equal(await state.refresh(identity),false);assert.equal(calls.length,5);
 binding.value={id:1};calls[3].resolve({...r1,scoreRevision:'STALE'});assert.equal(await old,false);assert.notEqual(state.growth.value.scoreRevision,'STALE');
 calls[4].resolve({profileId:'2',scoreRevision:'B'});calls[5].resolve(r2);await vue.nextTick();assert.equal(state.growth.value.scoreRevision,'R2');
 const disposed=state.refresh();scope.stop();calls[6].resolve(r1);assert.equal(await disposed,false);
 }finally{scope.stop();for(const k of Object.keys(globals))delete globalThis[k]}
});
