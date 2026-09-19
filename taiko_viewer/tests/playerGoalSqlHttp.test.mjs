import {authoritativeFixture} from './fixtures/goalAuthoritative.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createApp,createRouter,toNodeListener,defineEventHandler} from 'h3';
import {installGoalSqlRuntime} from './fixtures/goalSqlRuntime.mjs';
import {inspectGoalSchema,auditGoalOrphans} from '../server/services/goals/audit.ts';
import {deleteUserWithGoals} from '../server/services/goals/lifecycle.ts';
for(const key of ['TAIKO_DB_HOST','TAIKO_DB_USER','TAIKO_DB_NAME'])assert.ok(process.env[key]);
const db=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:1});
try{const [[identity]]=await db.query('SELECT DATABASE() AS name');assert.ok(identity.name.endsWith('_test'));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');const schema=await inspectGoalSchema(db);assert.ok(schema.exists);assert.deepEqual(schema.errors,[])}catch(e){await db.end();throw e}
test('real session login/logout + SQL Goal HTTP lifecycle and all production binding cleanup paths',async()=>{
 const root=await mkdtemp('/var/tmp/goal-sql-http-');
 const uninstall=installGoalSqlRuntime(db,{repoRoot:root,userdataDir:`${root}/userdata`,accountCacheDir:`${root}/cache`});
 globalThis.defineEventHandler=defineEventHandler;
 let server,user=0;const tag=randomBytes(5).toString('hex');const password=randomBytes(16).toString('hex');const username=`goal-http-${tag}`;const manualIds=[];
 try{
 const {getPasswordHash}=await import('../server/internal/account/shared.ts');
 const {detachManualAccount,permanentlyDeleteManualAccount}=await import('../server/utils/account/manual.ts');
 const [inserted]=await db.execute('INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)',[username,`${username}@example.test`,await getPasswordHash(password)]);user=inserted.insertId;
 await mkdir(`${root}/userdata`,{recursive:true});
 const bindings=[];
 for(const letter of ['a','b']){
  const taikoId=`gh-${letter}-${tag}`;const [r]=await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',?)",[user,taikoId,letter==='a'?1:0]);bindings.push(r.insertId);
  const songs=[100,101,102].map(song_no=>({song_no,level:4,high_score:900000,good_cnt:400,ok_cnt:20,ng_cnt:8,combo_cnt:100,clear_cnt:0,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:4,update_datetime:'2026-09-19 10:00:00',highscore_datetime:'2026-09-19 10:00:00'}));
  await writeFile(`${root}/userdata/${taikoId}data.json`,JSON.stringify({songs}));
 }
 const router=createRouter();
 for(const [method,path,file] of [
  ['post','/evaluate','growth/goal/evaluate.post'],['post','/login','auth/login.post'],['post','/logout','auth/logout.post'],['get','/overview','growth/overview.get'],['post','/goal','growth/goal.post'],['delete','/goal','growth/goal.delete'],['post','/switch','bindings/current.post'],['post','/unbind','bindings/remove.post']
 ])router[method](path,(await import(`../server/api/account/${file}.ts`)).default);
 server=createServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 let cookie='';const call=async(method,path,body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const login=async()=>{const r=await call('POST','/login',{identifier:username,password});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];assert.match(cookie,/^stv_session=/);await r.json()};
 let r=await call('GET','/overview');assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/private, no-store/);
 assert.equal((await call('POST','/evaluate',{profileId:'1',expectedActiveGoalId:'1'})).status,401);
 await login();
 const get=async()=>{const r=await call('GET','/overview');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private, no-store/);return r.json()};
 const create=async(overview,songId,expected=null)=>{const r=await call('POST','/goal',{profileId:overview.profileId,scoreRevision:overview.scoreRevision,expectedActiveGoalId:expected,songId,difficultyType:4,goalType:'score-pb'});assert.equal(r.status,200);return (await r.json()).activeGoal};
 let overview=await get();assert.equal(overview.activeGoal,null);const a=await create(overview,100);assert.equal((await get()).activeGoal.id,a.id);
 r=await call('POST','/logout');assert.equal(r.status,200);assert.equal((await call('GET','/overview')).status,401);
 await login();assert.equal((await get()).activeGoal.id,a.id,'New login session preserves Goal');
 await call('POST','/switch',{bindingId:bindings[1]});overview=await get();assert.equal(overview.activeGoal,null);const b=await create(overview,101);
 await call('POST','/switch',{bindingId:bindings[0]});overview=await get();assert.equal(overview.activeGoal.id,a.id);
 const replacement=await create(overview,102,a.id);
 r=await call('DELETE','/goal',{profileId:overview.profileId,expectedActiveGoalId:a.id});assert.equal(r.status,409);
 r=await call('POST','/goal',{profileId:overview.profileId,scoreRevision:overview.scoreRevision,expectedActiveGoalId:a.id,songId:102,difficultyType:4,goalType:'score-pb'});assert.equal(r.status,409);
 r=await call('DELETE','/goal',{profileId:overview.profileId,expectedActiveGoalId:replacement.id});assert.equal(r.status,200);assert.equal((await get()).activeGoal,null);
 const [[history]]=await db.query("SELECT COUNT(*) AS n FROM web_player_goals WHERE binding_id=? AND status='cancelled'",[bindings[0]]);assert.equal(history.n,2);
 const scorePath=`${root}/userdata/gh-a-${tag}data.json`;
 let payload=JSON.parse(await readFile(scorePath,'utf8'));
 await writeFile(scorePath,JSON.stringify(authoritativeFixture(payload,`gh-a-${tag}`,new Date(Date.now()-10000))));
 overview=await get();const evaluationGoal=await create(overview,100);
 const evaluationBody={profileId:overview.profileId,expectedActiveGoalId:evaluationGoal.id};
 assert.equal((await call('POST','/evaluate',{...evaluationBody,observation:{highScore:999999}})).status,400);
 r=await call('POST','/evaluate',evaluationBody);assert.equal(r.status,200);assert.equal((await r.json()).outcome,'inconclusive');
 payload.songs[0].high_score++;
 await writeFile(scorePath,JSON.stringify(authoritativeFixture(payload,`gh-a-${tag}`)));
 await db.execute('INSERT INTO web_song_locks (user_id,taiko_id,song_no,level,is_locked) VALUES (?,?,100,4,1)',[user,`gh-a-${tag}`]);
 r=await call('POST','/evaluate',evaluationBody);assert.equal((await r.json()).outcome,'inconclusive');
 await db.execute('DELETE FROM web_song_locks WHERE user_id=? AND taiko_id=?',[user,`gh-a-${tag}`]);
 // GET must not write completed even with a valid later observation present.
 assert.equal((await get()).activeGoal.id,evaluationGoal.id);
 r=await call('POST','/evaluate',evaluationBody);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private, no-store/);assert.match(r.headers.get('vary'),/cookie/i);const completed=await r.json();assert.equal(completed.outcome,'completed');assert.equal(completed.activeGoal,null);assert.equal(completed.recentCompletedGoal.completionEvidence.result.delta,1);
 const repeated=await Promise.all(Array.from({length:4},()=>call('POST','/evaluate',evaluationBody)));for(const r of repeated){assert.equal(r.status,200);assert.equal((await r.json()).recentCompletedGoal.completedAt,completed.recentCompletedGoal.completedAt);}
 await call('POST','/logout');await login();assert.equal((await get()).recentCompletedGoal.id,evaluationGoal.id);
 const next=await create(await get(),101);assert.equal((await get()).recentCompletedGoal,null);assert.equal((await call('POST','/evaluate',evaluationBody)).status,409);
 await call('DELETE','/goal',{profileId:overview.profileId,expectedActiveGoalId:next.id});
 r=await call('POST','/unbind',{bindingId:bindings[0],force:true});assert.equal(r.status,200);
 const [[clean]]=await db.query('SELECT COUNT(*) AS n FROM web_player_goals WHERE binding_id=?',[bindings[0]]);assert.equal(clean.n,0);
 overview=await get();assert.equal(overview.activeGoal.id,b.id);
 // Exercise actual manual detach/permanent-delete functions with synthetic owned data.
 for(const permanent of [false,true]){
  const manualId='98'+String(Date.now()).padStart(16,'0').slice(-16);manualIds.push(manualId);
  await db.execute('INSERT INTO taiko_manual_accounts (taiko_id,nickname,bot_identity_key,created_by) VALUES (?,?,?,?)',[manualId,'Goal fixture',permanent?null:`goal-${tag}`,'viewer']);
  const [binding]=await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,manual_account_id,is_current) VALUES (?,?,'manual',?,0)",[user,manualId,manualId]);
  // Legacy/corrupt retained Goal fixture, to verify privacy cleanup despite manual Goal creation being disabled.
  await db.execute("INSERT INTO web_player_goals (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_mode,source_rank,source_revision,source_generated_at,status,goal_data,created_at,updated_at) VALUES (?,?,100,4,'score-pb','today-plan','dimension',1,'fixture','2026-09-19','cancelled','{}','2026-09-19','2026-09-19')",[user,binding.insertId]);
  if(permanent)await permanentlyDeleteManualAccount({kind:'viewer',userId:user},manualId,true);else await detachManualAccount({kind:'viewer',userId:user},manualId);
  const [[left]]=await db.query('SELECT COUNT(*) AS n FROM web_player_goals WHERE binding_id=?',[binding.insertId]);assert.equal(left.n,0);
 }
 await deleteUserWithGoals(db,user);assert.deepEqual(await auditGoalOrphans(db),{userOrphans:0,bindingOrphans:0,ownerMismatches:0});
 console.log('Authenticated SQL lifecycle PASS: real login/logout, profile switch, create/read/replace/cancel, ordinary/manual cleanup, zero orphans');
 }finally{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}
  try{if(user)await deleteUserWithGoals(db,user);for(const id of manualIds)await db.execute('DELETE FROM taiko_manual_accounts WHERE taiko_id=?',[id]);}
  finally{uninstall();delete globalThis.defineEventHandler;await db.end();await rm(root,{recursive:true,force:true})}
 }
});
