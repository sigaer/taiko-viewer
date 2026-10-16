import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
test('My Taiko isolated owner BFF consistent read chain and switching isolation',{timeout:180000},()=>accountSourceFixture(async c=>{
 c.state.expectedSourceMode='none';c.config.public={};c.config.repoRoot=c.root;c.config.songDataPath=resolve(c.root,'synthetic-catalog.json');
 await writeFile(c.config.songDataPath,JSON.stringify([{id:100,song_name:'Synthetic chart',level_4:9,shelf_status:0}]));
 const [[proof]]=await c.pool.query('SELECT DATABASE() name,@@datadir datadir');assert.ok(proof.name.endsWith('_test'));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 async function publish(identity,title,score){return withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity,mode:'write'},async lease=>{
  const baseline={_meta:{source:'wahlap',ts:'2026-10-15T01:00:00Z',full:true},profile:{gameCostume:{title}},songs:[{song_no:100,level:4,high_score:800000,stage_cnt:1,clear_cnt:1,highscore_datetime:'2026-10-15 09:00:00',update_datetime:'2026-10-15 09:00:00'}]};
  const next={...baseline,_meta:{source:'wahlap',ts:'2026-10-16T01:00:00Z',full:true},songs:[{song_no:100,level:4,high_score:score,stage_cnt:2,clear_cnt:2,highscore_datetime:'2026-10-16 09:00:00',update_datetime:'2026-10-16 09:00:00'}]};
  await lease.put('history/data_2026-10-15_09_00_00.json',JSON.stringify(baseline));await lease.put('history/data_2026-10-16_09_00_00.json',JSON.stringify(next));await lease.put('current',JSON.stringify(next));return lease.publish({replaceHistory:true});
 });}
 const firstPublication=await publish(c.taikoId,'Synthetic A1',900000),a2id=c.taikoId+'1';const [a2]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'wahlap','Synthetic A2',0)",[c.user,a2id]);await publish(a2id,'Synthetic A2',910000);
 const {myTaikoReadModel}=await import('./prototypes/myTaikoReadModel.ts');const {resolveGrowthHistoryRange}=await import('../server/services/growth-history/range.ts');
 // Only this test registers a loopback route; no production or /api/v1 feature gate.
 c.route('get','/qa/my-taiko',e=>myTaikoReadModel(e,{range:resolveGrowthHistoryRange({from:'2026-10-15',to:'2026-10-16'})}));
 let secondUser=0;try{
 const observations=[];
 async function ask(name,{cookie=c.cookie,query='',status=200}={}){const r=await c.request('GET','/qa/my-taiko'+query,undefined,cookie);const d=await r.json();assert.equal(r.status,status,name);assert.equal(r.headers.get('cache-control'),'private, no-store');observations.push({name,status:r.status,bindingId:d.profile?.bindingId??null,scoreRevision:d.release?.scoreRevision??null});return d;}
 const a1=await ask('profile-scores-growth-recommendation-entry-A1');assert.equal(a1.profile.bindingId,String(c.bindingId));assert.equal(a1.profile.currentTitle,'Synthetic A1');assert.equal(a1.scores[0].score,900000);assert.equal(a1.growth.profileId,String(c.bindingId));assert.ok(a1.growth.facts.length>0);assert.ok(a1.growth.facts.every(f=>f.bindingId===String(c.bindingId)&&f.ownerId===String(c.user)));assert.equal(a1.diagnostics.physicalCurrentReads,1);assert.equal(a1.recommendation.scoreRevision,a1.release.scoreRevision);assert.equal(a1.release.scoreRevision,`publication-v1:${firstPublication.sequence}:${firstPublication.commitId}`);assert.equal(a1.release.calculationProfile,null);assert.equal(a1.diagnostics.measurements,'NOT_REQUESTED');assert.ok(!a1.scores.some(s=>'legacy' in s));
 await ask('anonymous-cannot-read',{cookie:'',status:401});await ask('cannot-inject-owner-binding',{query:'?bindingId='+a2.insertId,status:400});
 const switched=await c.request('POST','/current',{bindingId:a2.insertId});assert.equal(switched.status,200);
 const a2read=await ask('switch-A2-isolated');assert.equal(a2read.profile.bindingId,String(a2.insertId));assert.equal(a2read.scores[0].score,910000);assert.ok(a2read.growth.facts.every(f=>f.bindingId===String(a2.insertId)));assert.notEqual(a2read.release.scoreRevision,a1.release.scoreRevision);assert.equal(a2read.release.catalogRevision,a1.release.catalogRevision);
 // A second account gets only its own binding/facts, with no external Developer Grant.
 const [u]=await c.pool.execute("INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES ('mytaiko-synthetic-b','mytaiko-b@example.test',?,1)",[await c.shared.getPasswordHash('synthetic-password')]);secondUser=u.insertId;
 const bId=c.taikoId+'2';const [b]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'wahlap','Synthetic B',1)",[secondUser,bId]);await publish(bId,'Synthetic B',920000);
 const login=await c.request('POST','/login',{identifier:'mytaiko-synthetic-b',password:'synthetic-password'},'');assert.equal(login.status,200);const cookieB=login.headers.get('set-cookie').split(';')[0];
 const bRead=await ask('second-account-isolated',{cookie:cookieB});assert.equal(bRead.profile.bindingId,String(b.insertId));assert.equal(bRead.scores[0].score,920000);assert.ok(bRead.growth.facts.length>0&&bRead.growth.facts.every(f=>f.ownerId===String(secondUser)&&f.bindingId===String(b.insertId)));assert.equal(bRead.diagnostics.physicalCurrentReads,1);
 const a2Again=await ask('first-account-after-second-account');assert.equal(a2Again.profile.bindingId,String(a2.insertId));assert.equal(a2Again.scores[0].score,910000);
 // Switch during the already pinned read: the existing final owner proof rejects the entire result.
 let once=false;const db=globalThis.__goalSqlRuntime.db,native=db.execute;
 db.execute=async function(sql,args){const result=await native.call(this,sql,args);if(!once&&c.scopeModule.currentScoreScope()&&sql.includes('FROM web_player_goals')){once=true;await c.pool.execute('UPDATE web_taiko_bindings SET is_current=(id=?) WHERE user_id=?',[c.bindingId,c.user]);}return result;};
 try{await ask('in-flight-switch-discards-result',{status:409});assert.equal(once,true);}finally{db.execute=native;}
 const back=await ask('switch-back-A1-no-A2-cache');assert.equal(back.profile.bindingId,String(c.bindingId));assert.equal(back.scores[0].score,900000);assert.equal(back.diagnostics.physicalCurrentReads,1);
 // Delete current binding during read: no retained body may escape.
 let removed=false;db.execute=async function(sql,args){const result=await native.call(this,sql,args);if(!removed&&c.scopeModule.currentScoreScope()&&sql.includes('FROM web_player_goals')){removed=true;await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);}return result;};
 try{await ask('in-flight-unbind-discards-result',{status:409});assert.equal(removed,true);}finally{db.execute=native;}
 await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'my-taiko-integration-observations.json'),JSON.stringify({status:'PASS_SCOPED',databaseProof:proof,observations,readModel:'isolated prototype only; no production route',actualServices:['withViewerCurrentSource','ScoreReadPort/installed Publication ReadView','getAccountProfile','getGrowthHistory/canonicalGrowthProjection','real getSongCatalog file reader'],notExecuted:['recommendation computation','measurement writer','live Bot clients','production'],contractFrozen:false,productionAccess:false},null,2)+'\n');
 }finally{if(secondUser){await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[secondUser]);await c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[secondUser]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[secondUser]);}}
},{withRealCatalog:true,requestTimeoutMs:30000}));
