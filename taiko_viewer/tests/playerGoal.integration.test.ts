import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { deleteBindingsWithGoals, deleteUserWithGoals } from '../server/services/goals/lifecycle.ts';
import { auditGoalOrphans, inspectGoalSchema } from '../server/services/goals/audit.ts';
import { randomUUID } from 'node:crypto';
import { GOAL_TABLE_SQL } from '../server/services/goals/schema.ts';
import { mutateGoal, readActiveGoal } from '../server/services/goals/store.ts';
import { goalBaseline, goalTarget } from '../utils/playerGoal.ts';
import type { PlayerGoal } from '../types/player-goal.ts';
for (const key of ['TAIKO_DB_HOST','TAIKO_DB_USER','TAIKO_DB_NAME']) assert.ok(process.env[key], 'Explicit isolated DB configuration required');
const db=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:4});
let user=0, other=0, a=0,b=0,c=0;
try {
 const [identity]=await db.query<any[]>('SELECT DATABASE() AS name');
 assert.ok(identity[0]?.name?.endsWith('_test'),'Actual database must end in _test');
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1','Explicit test mutation opt-in required');
} catch (error) { await db.end(); throw error; }
const suffix=randomUUID().slice(0,8);
const make=(songId=100):Omit<PlayerGoal,'id'>=>({profileId:String(a),songId,difficultyType:4,title:'Fixture',starLevel:9,goalType:'score-pb',baselineVersion:1,baseline:goalBaseline({high_score:900000},'fixture','2026-09-19T00:00:00Z'),source:'today-plan',sourceBasis:'stamina',sourceMode:'dimension',sourceRank:1,sourceRevision:'fixture',sourceGeneratedAt:'2026-09-19T00:00:00Z',targetData:goalTarget('score-pb'),status:'active',createdAt:'',cancelledAt:null,unavailable:false});
test('real SQL persistence, concurrency, isolation and privacy lifecycle',async()=>{
 try {
 await db.execute(GOAL_TABLE_SQL);
 const schema = await inspectGoalSchema(db); assert.equal(schema.exists,true); assert.deepEqual(schema.errors,[]); assert.equal(schema.foreignKeyCount,0);
 assert.deepEqual(await auditGoalOrphans(db),{userOrphans:0,bindingOrphans:0,ownerMismatches:0});
 for(const label of ['a','b']) {
 const [r]=await db.execute<any>('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)',[`goal-${label}-${suffix}`,`goal-${label}-${suffix}@example.test`,'fixture-no-login']);if(label==='a')user=r.insertId;else other=r.insertId;
 }
 for(const [label,owner,current] of [['a',user,1],['b',user,0],['c',other,1]] as const){const [r]=await db.execute<any>('INSERT INTO web_taiko_bindings (user_id,taiko_id,is_current) VALUES (?,?,?)',[owner,`g-${label}-${suffix}`,current]);if(label==='a')a=r.insertId;else if(label==='b')b=r.insertId;else c=r.insertId;}
 const first=await mutateGoal(db,user,String(a),null,async()=>make()); assert.ok(first);assert.equal((await readActiveGoal(db,user,a))?.id,first.id);
 // New pool/connection demonstrates no process/session-local persistence.
 const fresh=await db.getConnection();try{assert.equal((await readActiveGoal(fresh,user,a))?.id,first.id)}finally{fresh.release()}
 assert.equal((await mutateGoal(db,user,String(a),null,async()=>make()))?.id,first.id);
 await db.execute(GOAL_TABLE_SQL); await db.execute(GOAL_TABLE_SQL);
 assert.equal((await readActiveGoal(db,user,a))?.id,first.id,'Idempotent migration preserves rows');
 await assert.rejects(db.execute("INSERT INTO web_player_goals (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_basis,source_mode,source_rank,source_revision,source_generated_at,baseline_version,goal_data,created_at,updated_at) SELECT user_id,binding_id,song_id,difficulty_type,goal_type,source,source_basis,source_mode,source_rank,source_revision,source_generated_at,baseline_version,goal_data,created_at,updated_at FROM web_player_goals WHERE id=?",[first.id]),(e:any)=>e.errno===1062);

 assert.equal(await readActiveGoal(db,other,a),null);
 await assert.rejects(mutateGoal(db,other,String(a),null,async()=>make()));
 await assert.rejects(mutateGoal(db,user,String(a),null,async()=>make(101)));
 const replaced=await mutateGoal(db,user,String(a),first.id,async()=>make(101));assert.ok(replaced);assert.notEqual(replaced.id,first.id);
 const [history]=await db.query<any[]>('SELECT status,cancelled_at FROM web_player_goals WHERE id=?',[first.id]);assert.equal(history[0].status,'cancelled');assert.ok(history[0].cancelled_at);
 await assert.rejects(mutateGoal(db,user,String(a),first.id,null));
 await assert.rejects(mutateGoal(db,user,String(a),first.id,async()=>make(102)));
 await assert.rejects(mutateGoal(db,user,String(a),first.id,async()=>make(101)),'Stale expected ID must conflict even when target matches');
 const [[generated]]=await db.query<any[]>('SELECT active_binding_id FROM web_player_goals WHERE id=?',[first.id]);assert.equal(generated.active_binding_id,null);

 await mutateGoal(db,user,String(a),replaced.id,null);assert.equal(await readActiveGoal(db,user,a),null);
 const same=await Promise.all([mutateGoal(db,user,String(a),null,async()=>make(104)),mutateGoal(db,user,String(a),null,async()=>make(104))]);assert.equal(same[0]?.id,same[1]?.id);
 await mutateGoal(db,user,String(a),same[0]!.id,null);
 const results=await Promise.allSettled([mutateGoal(db,user,String(a),null,async()=>make(102)),mutateGoal(db,user,String(a),null,async()=>make(103))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const [count]=await db.query<any[]>('SELECT COUNT(*) AS total FROM web_player_goals WHERE binding_id=? AND status=\'active\'',[a]);assert.equal(count[0].total,1);
 await db.execute('UPDATE web_taiko_bindings SET is_current=(id=?) WHERE user_id=?',[b,user]);assert.equal(await readActiveGoal(db,user,b),null);await assert.rejects(mutateGoal(db,user,String(a),null,async()=>make()));
 const second=await mutateGoal(db,user,String(b),null,async()=>({...make(200),profileId:String(b)}));assert.ok(second);
 await db.execute('UPDATE web_taiko_bindings SET is_current=(id=?) WHERE user_id=?',[a,user]);assert.ok(await readActiveGoal(db,user,a));assert.equal((await readActiveGoal(db,user,b))?.id,second.id);
 await deleteBindingsWithGoals(db,user,{bindingId:b});const [gone]=await db.query<any[]>('SELECT COUNT(*) AS total FROM web_player_goals WHERE binding_id=?',[b]);assert.equal(gone[0].total,0);
 // A foreign user has a separate persisted Goal.
 const foreign=await mutateGoal(db,other,String(c),null,async()=>({...make(300),profileId:String(c)}));assert.ok(foreign);assert.equal(await readActiveGoal(db,user,c),null);
 // Deliberate corrupted rows prove the read guard and audit catch every R2 failure class.
 const insertCorrupt=async(owner:number,binding:number)=>{const [r]=await db.execute<any>("INSERT INTO web_player_goals (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_mode,source_rank,source_revision,source_generated_at,status,goal_data,created_at,updated_at) VALUES (?,?,1,4,'score-pb','today-plan','dimension',1,'fixture','2026-09-19','cancelled','{}','2026-09-19','2026-09-19')",[owner,binding]);return r.insertId;};
 const corrupt=[await insertCorrupt(other,a),await insertCorrupt(other,999999999),await insertCorrupt(999999999,a)];
 const audit=await auditGoalOrphans(db);assert.equal(audit.userOrphans,1);assert.equal(audit.bindingOrphans,1);assert.equal(audit.ownerMismatches,2);
 await db.execute('DELETE FROM web_player_goals WHERE id IN (?,?,?)',corrupt);
 const [racingBinding]=await db.execute<any>('INSERT INTO web_taiko_bindings (user_id,taiko_id,is_current) VALUES (?,?,0)',[user,`g-r-${suffix}`]);
 await db.execute('UPDATE web_taiko_bindings SET is_current=(id=?) WHERE user_id=?',[racingBinding.insertId,user]);
 await Promise.allSettled([mutateGoal(db,user,String(racingBinding.insertId),null,async()=>({...make(400),profileId:String(racingBinding.insertId)})),deleteBindingsWithGoals(db,user,{bindingId:racingBinding.insertId})]);
 const [[raceLeft]]=await db.query<any[]>('SELECT COUNT(*) AS n FROM web_player_goals WHERE binding_id=?',[racingBinding.insertId]);assert.equal(raceLeft.n,0);
 await deleteUserWithGoals(db,user);const [orphans]=await db.query<any[]>('SELECT COUNT(*) AS total FROM web_player_goals WHERE user_id=?',[user]);assert.equal(orphans[0].total,0);
 const [[bindingsGone]]=await db.query<any[]>('SELECT COUNT(*) AS n FROM web_taiko_bindings WHERE user_id=?',[user]);assert.equal(bindingsGone.n,0);
 assert.deepEqual(await auditGoalOrphans(db),{userOrphans:0,bindingOrphans:0,ownerMismatches:0});
 }finally{try{if(user)await deleteUserWithGoals(db,user);if(other)await deleteUserWithGoals(db,other);}finally{await db.end()}}
});
