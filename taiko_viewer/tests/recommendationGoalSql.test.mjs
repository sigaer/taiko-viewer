import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createError} from 'h3';
import {accountSourceFixture,queuedAccountSource} from './fixtures/accountSourceHttp.mjs';
import {authoritativeFixture} from './fixtures/goalAuthoritative.mjs';
import {assertQaPython} from './fixtures/qaPaths.mjs';

test('ordinary recommendation HTTP batch to confirmed Goal, original evaluation and Growth facts',{timeout:240000},()=>accountSourceFixture(async c=>{
 const previous=globalThis.createError;globalThis.createError=createError;
 const python=assertQaPython(), originalPython=process.env.TAIKO_PYTHON_EXECUTABLE;
 c.config.repoRoot=c.root;c.config.public={};c.state.expectedSourceMode='read';
 const vector=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
 const charts={},catalog=[],records=[];
 for(let i=0;i<48;i++){
  const id=10000+i,title='Action '+i;
  charts[id]={...vector.chart,id,level:4,song_name_cn:title};
  catalog.push({id,song_name:title,song_name_jp:title,level_4:9,level_5:'-',shelf_status:0,max_combo:[0,0,0,Number(vector.chart.combo),0]});
  if(i<25)records.push({song_no:id,level:4,high_score:900000,good_cnt:i<20?520:450,ok_cnt:10,ng_cnt:1,combo_cnt:100,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:4,stage_cnt:1,update_datetime:'2026-10-19 10:00:00',highscore_datetime:'2026-10-19 10:00:00'});
 }
 await mkdir(resolve(c.root,'songs'));
 const save=async()=>{for(const name of ['song_data','song_data_raw'])await writeFile(resolve(c.root,'songs',name+'.json'),JSON.stringify(catalog));await writeFile(resolve(c.root,'songs/rating_structured_with_ids.json'),JSON.stringify({songs:charts,const_table:vector.const_table}));};await save();
 for(const name of ['song_alias','song_score','taiko_goku_onis','taiko_goku_all_levels_stream'])await writeFile(resolve(c.root,'songs',name+'.json'),'[]');
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 const publish=async(songs,at=new Date(Date.now()-2000),authoritative=true)=>withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity:c.taikoId,mode:'write'},async lease=>{const body={profile:{userid:c.taikoId},songs};await lease.put('current',JSON.stringify(authoritative?authoritativeFixture(body,c.taikoId,at):body));await lease.publish();});
 await publish(records);
 for(const [method,path,file] of [['get','/tool','recommendation/tool.get.ts'],['post','/preview','growth/goal/preview.post.ts'],['post','/goal','growth/goal.post.ts'],['delete','/goal','growth/goal.delete.ts'],['post','/evaluate','growth/goal/evaluate.post.ts']])c.route(method,path,(await import('../server/api/account/'+file)).default);
 const ask=async(method,path,body,status=200,cookie=c.cookie)=>{const r=await c.request(method,path,body,cookie);const data=await r.json();assert.equal(r.status,status,path+' '+(data.statusMessage||''));assert.match(r.headers.get('cache-control'),/private, no-store/);return data;};
 const batch=()=>ask('GET','/tool?n=20');
 const preview=item=>ask('POST','/preview',{recommendationToken:item.recommendationToken});
 const input=(item,p,type='score-pb',expected=p.activeGoal?.id||null)=>({profileId:p.profileId,expectedActiveGoalId:expected,scoreRevision:p.scoreRevision,songId:item.songId,difficultyType:item.level,goalType:type,source:'ordinary-recommendation',recommendationToken:item.recommendationToken});
 try{
  await ask('GET','/tool',undefined,401,'');await ask('POST','/preview',{recommendationToken:'forged'},401,'');
  const normal=await batch();assert.equal(normal.image,null);assert.equal(normal.basis,'rating');
  assert.deepEqual(normal.items.map(x=>[x.songId,x.level,x.isUnplayed]),[...[25,26,27,28,29,30,31,32,33,34].map(x=>[10000+x,4,true]),...[20,21,22,23,24].map(x=>[10000+x,4,false]),...[35,36,37,38,39].map(x=>[10000+x,4,true])]);
  assert.ok(normal.items.every(x=>x.starLevel===9));assert.ok(normal.items.filter(x=>x.isUnplayed).every(x=>!x.canCreateGoal));assert.ok(normal.items.filter(x=>!x.isUnplayed).every(x=>x.canCreateGoal));
  const password=randomBytes(16).toString('hex'),name='recommend-b-'+randomBytes(6).toString('hex');
  const [secondUser]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',[name,name+'@example.test',await c.shared.getPasswordHash(password)]);
  const secondId=c.taikoId+'2';c.ownedTokenIds.add(secondId);
  try {
   await withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity:secondId,mode:'write'},async lease=>{await lease.put('current',JSON.stringify(authoritativeFixture({profile:{userid:secondId},songs:records.slice(0,1)},secondId)));await lease.publish();});
   const [otherBinding]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[secondUser.insertId,secondId]);
   const login=await c.request('POST','/login',{identifier:name,password},'');assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];await login.json();
   await ask('POST','/preview',{recommendationToken:normal.items[0].recommendationToken},409,cookie);
   const other=await ask('GET','/tool?n=20',undefined,200,cookie);assert.equal(other.profileId,String(otherBinding.insertId));assert.notEqual(other.scoreRevision,normal.scoreRevision);
   assert.equal((await batch()).profileId,normal.profileId);
  } finally { await c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[secondUser.insertId]);await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[secondUser.insertId]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[secondUser.insertId]);c.state.expectedSourceMode='read'; }
  const capture=resolve(c.root,'render-business.json'),trampoline=resolve(c.root,'observe-python');
  await writeFile(trampoline,"#!/bin/sh\nexec '"+python+"' -I '"+new URL('./fixtures/observeRecommendation.py',import.meta.url).pathname+"' \"$@\"\n");await chmod(trampoline,0o700);process.env.RATING_ENTRY_CAPTURE=capture;
  process.env.TAIKO_PYTHON_EXECUTABLE=trampoline;
  const pictured=await ask('GET','/tool?n=20&image=true');process.env.TAIKO_PYTHON_EXECUTABLE=python;
  const observed=JSON.parse(await readFile(capture,'utf8'));assert.deepEqual(observed.items,pictured.items.map(({starLevel,recommendationToken,canCreateGoal,...item})=>item));assert.match(pictured.image,/^data:image\/jpeg;base64,/);
  await ask('GET','/tool?dim=unsupported',undefined,400);
  const dimension=await ask('GET','/tool?n=7&dim=体力');assert.equal(dimension.basis,'stamina');assert.equal(dimension.items.length,7);
  const item=normal.items.find(x=>!x.isUnplayed),p=await preview(item);assert.ok(p.goalOptions.includes('score-pb'));assert.ok(!p.goalOptions.includes('goku'));
  const [[before]]=await c.pool.query('SELECT COUNT(*) n FROM web_player_goals WHERE user_id=?',[c.user]);assert.equal(before.n,0,'GET and preview do not create');
  await ask('POST','/goal',{...input(item,p),goalType:'goku'},400);await ask('POST','/goal',{...input(item,p),songId:10000},409);await ask('POST','/goal',{...input(item,p),difficultyType:9},409);
  await ask('POST','/preview',{recommendationToken:item.recommendationToken+'x'},409);
  const [a,b]=await Promise.all([ask('POST','/goal',input(item,p)),ask('POST','/goal',input(item,p))]);assert.equal(a.activeGoal.id,b.activeGoal.id);assert.equal(a.activeGoal.source,'ordinary-recommendation');assert.equal(a.activeGoal.sourceMode,'ordinary');assert.equal(a.activeGoal.sourceRank,11);assert.equal(a.activeGoal.baseline.highScore,900000);
  const active=a.activeGoal;assert.equal((await preview(item)).activeGoal.id,active.id);
  let result=await ask('POST','/evaluate',{profileId:p.profileId,expectedActiveGoalId:active.id});assert.equal(result.outcome,'inconclusive');
  const changed=records.map(r=>r.song_no===item.songId?{...r,high_score:900001}:r);
  c.tick();await publish(changed,new Date(Date.now()-10));
  await ask('POST','/goal',input(item,p),409);
  result=await ask('POST','/evaluate',{profileId:p.profileId,expectedActiveGoalId:active.id});assert.equal(result.outcome,'completed');assert.equal(result.recentCompletedGoal.completionEvidence.result.delta,1);
  const repeated=await ask('POST','/evaluate',{profileId:p.profileId,expectedActiveGoalId:active.id});assert.equal(repeated.recentCompletedGoal.completedAt,result.recentCompletedGoal.completedAt);
  const {loadGoalFacts}=await import('../server/services/growth-history/goals.ts');
  const facts=await loadGoalFacts(c.pool,c.user,c.bindingId,'2020-01-01T00:00:00Z','2030-01-01T00:00:00Z');assert.equal(facts.length,1);assert.equal(facts[0].type,'goal-completed');
  // Two different replacement intents share the same expected active id: one wins.
  let fresh=await batch(),played=fresh.items.filter(x=>!x.isUnplayed),first=await preview(played[0]);
  const replacement=(await ask('POST','/goal',input(played[0],first,'fc'))).activeGoal;
  const intents=played.slice(1,3);const responses=await Promise.all(intents.map(x=>c.request('POST','/goal',input(x,{...first,activeGoal:replacement},'score-pb'))));assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);for(const r of responses)await r.arrayBuffer();
  // Current binding changes are rejected before any target write, then recover.
  const race=await queuedAccountSource(c,()=>c.request('POST','/goal',input(played[0],first)),()=>c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]));assert.equal(race.status,409);await race.arrayBuffer();await c.pool.execute("UPDATE web_taiko_bindings SET source='wahlap' WHERE id=?",[c.bindingId]);
  await c.pool.execute('INSERT INTO web_song_locks(user_id,taiko_id,song_no,level,is_locked) VALUES (?,?,?,?,1)',[c.user,c.taikoId,played[0].songId,4]);assert.deepEqual((await preview(played[0])).goalOptions,[]);assert.equal((await batch()).items.find(x=>x.songId===played[0].songId).canCreateGoal,false);await c.pool.execute('DELETE FROM web_song_locks WHERE user_id=?',[c.user]);
  catalog.find(x=>x.id===played[0].songId).shelf_status=1;await save();await ask('POST','/preview',{recommendationToken:played[0].recommendationToken},409);assert.ok((await batch()).items.every(x=>x.songId!==played[0].songId));
  for(const row of catalog)row.shelf_status=1;await save();assert.deepEqual((await batch()).items,[]);assert.equal((await ask('GET','/tool?n=20&image=true')).image,null);
  for(const row of catalog)row.shelf_status=0;await save();await publish([]);assert.deepEqual((await batch()).items,[]);
  await publish(records,undefined,false);assert.ok((await batch()).items.every(x=>!x.canCreateGoal),'unknown source cannot create');
  await publish(records);const beforeSwitch=await batch();
  const [[manualBinding]]=await c.pool.query("SELECT id FROM web_taiko_bindings WHERE user_id=? AND source='manual'",[c.user]);
  c.state.expectedSourceMode='none';{const r=await c.request('POST','/current',{bindingId:manualBinding.id});assert.equal(r.status,200);await r.json();}c.state.expectedSourceMode='read';
  await ask('POST','/preview',{recommendationToken:beforeSwitch.items[0].recommendationToken},409);
  c.state.expectedSourceMode='none';{const r=await c.request('POST','/current',{bindingId:c.bindingId});assert.equal(r.status,200);await r.json();}c.state.expectedSourceMode='read';assert.equal((await batch()).profileId,normal.profileId);
  const failedWorker=resolve(c.root,'failed-python');await writeFile(failedWorker,"#!/bin/sh\nif [ \"$2\" = \"-c\" ]; then exit 2; fi\nexec '"+python+"' \"$@\"\n");await chmod(failedWorker,0o700);
  process.env.TAIKO_PYTHON_EXECUTABLE=failedWorker;await ask('GET','/tool?n=20',undefined,502);process.env.TAIKO_PYTHON_EXECUTABLE=python;assert.equal((await batch()).items.length,20,'worker error releases source lease');
  const expiring=(await batch()).items[0];for(let i=0;i<601;i++)c.tick();await ask('POST','/preview',{recommendationToken:expiring.recommendationToken},409);
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'recommendation-goal-http.json'),JSON.stringify({status:'PASS',identityOrder:normal.items.map(x=>[x.songId,x.level,x.isUnplayed]),goalSource:active.source,completedDelta:result.recentCompletedGoal.completionEvidence.result.delta,facts:facts.length},null,2));
 }finally{globalThis.createError=previous;process.env.TAIKO_PYTHON_EXECUTABLE=originalPython;delete process.env.RATING_ENTRY_CAPTURE;await c.pool.execute('DELETE FROM web_player_goals WHERE user_id=?',[c.user]);}
},{withRealPython:true,withRealCatalog:true,requestTimeoutMs:60000}));
