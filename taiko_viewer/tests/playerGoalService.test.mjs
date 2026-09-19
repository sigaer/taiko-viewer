import test from 'node:test';
import assert from 'node:assert/strict';
import {goalServiceHarness} from './fixtures/goalServiceHarness.mjs';
test('server authority: source, options, stale state, identity, and immutable baseline',async()=>{
 const {state,write,cleanup}=await goalServiceHarness();
 const input={profileId:'1',expectedActiveGoalId:null,songId:100,difficultyType:4,goalType:'fc',scoreRevision:'revision'};
 try{
 for(const extra of [{userId:2},{taikoId:'forged'},{source:'today-plan'}])await assert.rejects(write(1,{...input,...extra}),e=>e.statusCode===400);
 await assert.rejects(write(1,{...input,profileId:'2'}),e=>e.statusCode===409);
 await assert.rejects(write(1,{...input,songId:999}),e=>e.statusCode===409);
 await assert.rejects(write(1,{...input,goalType:'accuracy'}),e=>e.statusCode===400);
 await assert.rejects(write(1,{...input,scoreRevision:'old'}),e=>e.statusCode===409);
 for(const type of ['score-pb','ng-reduced','clear','fc','df','rank-upgrade']){
 const r=await write(1,{...input,goalType:type});assert.equal(r.activeGoal.goalType,type);assert.equal(r.activeGoal.source,'today-plan');assert.equal(r.activeGoal.sourceBasis,'accuracy_power');assert.equal(r.activeGoal.sourceRank,1);assert.equal(r.activeGoal.baseline.highScore,900000);assert.equal(r.activeGoal.baselineVersion,1);
 await write(1,{profileId:'1',expectedActiveGoalId:r.activeGoal.id},true);
 }
 state.fallback=true;state.basis=null;const r=await write(1,{...input,songId:101,goalType:'score-pb'}).catch(e=>e);assert.equal(r.statusCode,400); // Candidate without a score cannot pretend complete coverage.
 state.fallback=false;state.basis='accuracy_power';const created=(await write(1,input)).activeGoal;
 state.plan=[];state.row.high_score=999999;state.revision='new';const retry=(await write(1,input)).activeGoal;assert.equal(retry.id,created.id);assert.equal(retry.baseline.highScore,900000);
 await write(1,{profileId:'1',expectedActiveGoalId:retry.id},true);
 state.plan=[100,101];state.revision='revision';state.fallback=true;state.basis=null;
 const fallback=(await write(1,input)).activeGoal;assert.equal(fallback.sourceMode,'general-fallback');assert.equal(fallback.sourceBasis,null);
 await write(1,{profileId:'1',expectedActiveGoalId:fallback.id},true);
 state.row.full_combo_cnt=1;await assert.rejects(write(1,input),e=>e.statusCode===400);
 state.row.full_combo_cnt=0;state.catalog[0].shelf_status=1;await assert.rejects(write(1,input),e=>e.statusCode===400);
 state.catalog[0].shelf_status=0;state.binding.source='manual';await assert.rejects(write(1,input),e=>e.statusCode===400);
 }finally{cleanup()}
});
