// Actual guarded SQL and Python publication leases; compute values are synthetic.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {manualSqlFixture as base,manualSourceSnapshot} from './fixtures/manualSqlRuntime.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';

const fixture=task=>base(async c=>{
 const taikoId='7'+BigInt('0x'+randomUUID().replaceAll('-','').slice(0,12)).toString().padStart(15,'0');
 await c.shared.writeUserdataWithHistory(taikoId,{profile:{userid:taikoId},songs:[]},'wahlap');
 await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?',[c.user]);
 const [row]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[c.user,taikoId]);
 const personal=await import('../server/services/account/personal.ts');
 await task({...c,taikoId,bindingId:row.insertId,personal});
},{withPersonal:true});
const operations={
 rating:c=>c.personal.getPersonalRatingSummary(c.user),
 ordinary:c=>c.personal.getPersonalRecommendations(c.user),
 dimension:c=>c.personal.getPersonalDimensionRecommendations(c.user,'stamina'),
 target:c=>c.personal.getTargetRecommendations(c.user,'full_combo','10')
};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned personal race deadline')),5000);})]);}finally{clearTimeout(timer);}}
async function snapshot(c){return c.scopeModule.withDomainScoreRead(c.taikoId,async()=>({raw:await manualSourceSnapshot(c),publication:c.scopeModule.scorePublication(c.taikoId)}));}
async function mutate(c,field){
 if(field==='id'){
  await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);
  await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[c.user,c.taikoId]);
 } else await c.pool.execute(`UPDATE web_taiko_bindings SET ${field}=? WHERE id=?`,[field==='source'?'hiroba':field==='taiko_id'?c.taikoId+'1':c.ownerManualId,c.bindingId]);
}
async function queued(c,operation,change){
 const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
 const observed=deferred();c.state.afterExecute=sql=>{if(!c.scopeModule.currentScoreScope()&&sql.includes('FROM web_taiko_bindings'))observed.resolve();};
 const reading=Promise.resolve().then(operation);reading.catch(()=>{});
 try{await bounded(observed.promise);await change();await held.close();return await reading;}
 finally{await held.close();await reading.catch(()=>{});c.state.afterExecute=null;}
}

for(const [name,operation] of Object.entries(operations))test(`${name} keeps its existing DTO/aliases/arguments within one private SH view`,{timeout:20000},()=>fixture(async c=>{
 const before=await snapshot(c),runtime=globalThis.__goalSqlRuntime,calls=runtime.pythonCalls;
 runtime.onPython=()=>assert.equal(c.scopeModule.currentScoreScope(c.taikoId)?.mode,'read');
 const actual=await operation(c);
 assert.equal(runtime.pythonCalls,calls+1);
 if(name==='rating')assert.deepEqual(actual,{overallRating:10,sampleCount:30,current:10,scoreCount:30});
 if(name==='ordinary'||name==='dimension')assert.deepEqual(actual,{basis:name==='ordinary'?'rating':'stamina',items:[{songId:100,isUnplayed:false,song_id:100,is_unplayed:false}]});
 if(name==='target')assert.deepEqual(runtime.pythonArgs,['target',c.taikoId,'--target','full_combo','--limit','20','--star','10']);
 assert.deepEqual(await snapshot(c),before);
}));

for(const [name,operation] of Object.entries(operations))for(const field of ['id','taiko_id','source','manual_account_id'])test(`${name} rejects queued ${field} replacement before compute`,{timeout:20000},()=>fixture(async context=>{
 const c={...context};
 // The fixture's original manual source remains owned by this same user.
 const [[manual]]=await c.pool.query("SELECT taiko_id FROM web_taiko_bindings WHERE user_id=? AND source='manual'",[c.user]);c.ownerManualId=manual.taiko_id;
 const before=await snapshot(c),calls=globalThis.__goalSqlRuntime.pythonCalls;
 await assert.rejects(queued(c,()=>operation(c),()=>mutate(c,field)),e=>e.statusCode===409);
 assert.equal(globalThis.__goalSqlRuntime.pythonCalls,calls);assert.deepEqual(await snapshot(c),before);
}));

for(const [name,operation] of Object.entries(operations))test(`${name} checks the complete identity again before returning computed private values`,{timeout:20000},()=>fixture(async c=>{
 const [[manual]]=await c.pool.query("SELECT taiko_id FROM web_taiko_bindings WHERE user_id=? AND source='manual'",[c.user]);c.ownerManualId=manual.taiko_id;
 globalThis.__goalSqlRuntime.onPython=()=>mutate(c,name==='rating'?'source':name==='ordinary'?'taiko_id':name==='dimension'?'manual_account_id':'id');
 await assert.rejects(operation(c),e=>e.statusCode===409);
}));

test('a later current selection during compute prevents a private DTO from being returned',{timeout:20000},()=>fixture(async c=>{
 globalThis.__goalSqlRuntime.onPython=async()=>{
  const {switchCurrentBinding}=await import('../server/utils/account/bindings.ts');
  const [[manual]]=await c.pool.query("SELECT id FROM web_taiko_bindings WHERE user_id=? AND source='manual'",[c.user]);
  c.state.expectedSourceMode='read';await switchCurrentBinding(c.user,manual.id);
 };
 await assert.rejects(operations.rating(c),e=>e.statusCode===409);
}));

test('binding revocation waits for a real personal SH request to finish',{timeout:20000},()=>fixture(async c=>{
 const entered=deferred(),finish=deferred(),lookup=deferred();
 globalThis.__goalSqlRuntime.onPython=async()=>{entered.resolve();await bounded(finish.promise);};
 const reading=operations.ordinary(c);reading.catch(()=>{});let removal;
 try{
  await bounded(entered.promise);const commits=c.state.commits;
  c.state.afterExecute=sql=>{if(!c.scopeModule.currentScoreScope()&&sql.includes('FROM web_taiko_bindings'))lookup.resolve();};
  const {removeBinding}=await import('../server/utils/account/bindings.ts');
  removal=removeBinding(c.user,c.bindingId);removal.catch(()=>{});await bounded(lookup.promise);
  assert.equal(c.state.commits,commits);finish.resolve();
  assert.equal((await reading).items[0].song_id,100);assert.equal((await removal).ok,true);
 }finally{finish.resolve();await reading.catch(()=>{});await removal?.catch(()=>{});c.state.afterExecute=null;}
}));

test('an independent score publication waits until the personal compute view closes',{timeout:20000},()=>fixture(async c=>{
 const entered=deferred(),finish=deferred();let published=false;
 globalThis.__goalSqlRuntime.onPython=async()=>{entered.resolve();await bounded(finish.promise);};
 const reading=operations.rating(c);reading.catch(()=>{});let writing;
 try{
  await bounded(entered.promise);
  writing=c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[{song_no:100,level:4,high_score:900000}]},'wahlap').then(()=>{published=true;});writing.catch(()=>{});
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(published,false);finish.resolve();
  assert.equal((await reading).current,10);await writing;assert.equal(published,true);
 }finally{finish.resolve();await reading.catch(()=>{});await writing?.catch(()=>{});}
}));

test('managed missing current and absent bindings fail before compute with existing state errors',{timeout:20000},()=>fixture(async c=>{
 const calls=globalThis.__goalSqlRuntime.pythonCalls;
 await c.scopeModule.withDomainScoreWrite(c.taikoId,()=>c.scopeModule.removeScoreProjection(c.taikoId,'current'));
 await assert.rejects(operations.rating(c),e=>e.statusCode===404);
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[c.user]);
 await assert.rejects(operations.rating(c),e=>e.statusCode===400);assert.equal(globalThis.__goalSqlRuntime.pythonCalls,calls);
}));
