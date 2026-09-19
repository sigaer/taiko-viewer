import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixtures/goalEvaluation.ts';
import { mutateGoal, readActiveGoal } from '../server/services/goals/store.ts';
import { evaluateStoredGoal, readRecentCompletedGoal } from '../server/services/goals/evaluation-store.ts';
import { deleteUserWithGoals } from '../server/services/goals/lifecycle.ts';
import { auditGoalOrphans } from '../server/services/goals/audit.ts';
import { goalTarget } from '../utils/playerGoal.ts';
import type { GoalType, PlayerGoal } from '../types/player-goal.ts';
const db=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:4});
let user=0,binding=0;
test('real SQL evaluation, concurrency, evidence, immutable history and cleanup',async()=>{
 try{
 const [[identity]]=await db.query<any[]>('SELECT DATABASE() AS name');assert.ok(identity.name.endsWith('_test'));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const name=`eval-${randomUUID().slice(0,8)}`;const [u]=await db.execute<any>('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)',[name,name+'@example.test','no-login']);user=u.insertId;
 const [b]=await db.execute<any>('INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?, ?,\'wahlap\',1)',[user,name]);binding=b.insertId;
 const make=(type:GoalType='score-pb',songId=3):Omit<PlayerGoal,'id'>=>({...fixture(type).goal,profileId:String(binding),songId,title:'Evaluation fixture',starLevel:9,baselineVersion:1,source:'today-plan',sourceBasis:'stamina',sourceMode:'dimension',sourceRank:1,sourceRevision:'a'.repeat(64),sourceGeneratedAt:'2026-09-19T00:00:01Z',targetData:goalTarget(type),status:'active',createdAt:'',cancelledAt:null,unavailable:false});
 const observe=async(goal:PlayerGoal)=>({...fixture(goal.goalType,{high_score:900001,good_cnt:594,ng_cnt:4,clear_cnt:1,full_combo_cnt:1,dondaful_combo_cnt:1,best_score_rank:7}).observation,ownerId:user,profileId:String(binding),songId:goal.songId});
 for(const type of ['score-pb','ng-reduced','clear','fc','df','rank-upgrade'] as GoalType[]){
  const a=await mutateGoal(db,user,String(binding),null,async()=>make(type));assert.ok(a);
  const pair=await Promise.all([evaluateStoredGoal(db,user,String(binding),a.id,observe),evaluateStoredGoal(db,user,String(binding),a.id,observe)]);
  assert.equal(pair[0].outcome,'completed');assert.equal(pair[0].goal.completedAt,pair[1].goal.completedAt);assert.deepEqual(pair[0].goal.completionEvidence,pair[1].goal.completionEvidence);
  assert.equal(await readActiveGoal(db,user,binding),null);assert.equal((await readRecentCompletedGoal(db,user,binding))?.id,a.id);
  await assert.rejects(mutateGoal(db,user,String(binding),a.id,null));await assert.rejects(mutateGoal(db,user,String(binding),a.id,async()=>make(type,4)));
 }
 for(const operation of ['cancel','replace']){
  const a=(await mutateGoal(db,user,String(binding),null,async()=>make()))!;
  const result=await Promise.allSettled([evaluateStoredGoal(db,user,String(binding),a.id,observe),mutateGoal(db,user,String(binding),a.id,operation==='cancel'?null:async()=>make('score-pb',4))]);assert.ok(result.some(r=>r.status==='fulfilled'));
  const [[row]]=await db.query<any[]>('SELECT status,goal_data FROM web_player_goals WHERE id=?',[a.id]);assert.ok(['completed','cancelled'].includes(row.status));assert.equal(!!JSON.parse(row.goal_data).completionEvidence,row.status==='completed');
  const current=await readActiveGoal(db,user,binding);if(current)await mutateGoal(db,user,String(binding),current.id,null);
 }
 const replacedOld=(await mutateGoal(db,user,String(binding),null,async()=>make()))!;
 const replacement=(await mutateGoal(db,user,String(binding),replacedOld.id,async()=>make('score-pb',4)))!;
 await assert.rejects(evaluateStoredGoal(db,user,String(binding),replacedOld.id,observe));assert.equal((await readActiveGoal(db,user,binding))?.id,replacement.id);await mutateGoal(db,user,String(binding),replacement.id,null);
 const cancelled=(await mutateGoal(db,user,String(binding),null,async()=>make()))!;await mutateGoal(db,user,String(binding),cancelled.id,null);await assert.rejects(evaluateStoredGoal(db,user,String(binding),cancelled.id,observe));
 const active=(await mutateGoal(db,user,String(binding),null,async()=>make()))!;
 await assert.rejects(evaluateStoredGoal(db,user+999999,String(binding),active.id,observe));
 const wrong=await evaluateStoredGoal(db,user,String(binding),active.id,async goal=>({...await observe(goal),profileId:'wrong'}));assert.equal(wrong.outcome,'inconclusive');
 const same=await evaluateStoredGoal(db,user,String(binding),active.id,async goal=>({...await observe(goal),revision:goal.baseline.sourceRevision}));assert.equal(same.outcome,'inconclusive');
 assert.equal((await readActiveGoal(db,user,binding))?.id,active.id);
 }finally{if(user)await deleteUserWithGoals(db,user);assert.deepEqual(await auditGoalOrphans(db),{userOrphans:0,bindingOrphans:0,ownerMismatches:0});await db.end()}
});
