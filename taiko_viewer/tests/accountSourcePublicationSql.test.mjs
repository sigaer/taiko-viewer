// Real guarded SQL, actual authenticated HTTP and two owned loopback servers.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,unlink,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {accountSourceFixture as fixture,sourceSnapshot,deferred,bounded,queuedAccountSource,replaceIdentity} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const digest=token=>createHash('sha256').update(token).digest('hex');
async function http(c,method,path,body){const response=await c.request(method,path,body);const result=await response.json();if(!response.ok)throw Object.assign(new Error('Owned account request failed'),{statusCode:response.status});return result;}
const operations={profile:c=>c.profile.getAccountProfile(c.user),sync:c=>http(c,'GET','/sync'),issue:c=>c.tokens.manageViewerScoreToken(c.user,'issue'),revoke:c=>c.tokens.manageViewerScoreToken(c.user,'revoke')};
async function frozen(c,name){
 const original=new URL('../server/utils/account/'+name+'.ts',import.meta.url);
 const text=execFileSync('git',['show','7bf9a56:taiko_viewer/server/utils/account/'+name+'.ts'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024});
 const resolved=text.replace(/from "([^"]+)"/g,(full,name)=>name.startsWith('.')?`from "${new URL(name.endsWith('.ts')?name:name+'.ts',original).href}"`:!name.startsWith('~/')&&!name.startsWith('node:')?`from "${import.meta.resolve(name)}"`:full);
 const file=resolve(c.root,'frozen-'+name+'.mjs');await writeFile(file,ts.transpileModule(resolved,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);return import(pathToFileURL(file).href);
}

test('real cookie issue/status/revoke/reload/re-login preserve existing healthy profile and sync DTOs',{timeout:30000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);
 assert.equal((await c.request('GET','/profile',null,'')).status,401);
 const legacyProfile=await frozen(c,'profile'),legacySync=await frozen(c,'sync');
 c.route('get','/frozen-sync',event=>legacySync.getAccountSyncOverview(event));
 assert.deepEqual(await c.read('/profile'),await legacyProfile.getAccountProfile(c.user));
 assert.deepEqual(await c.read('/sync'),await c.read('/frozen-sync'));
 const first=await http(c,'POST','/token',{action:'issue',taikoId:'123',userid:'123'});
 assert.match(first.token,/^[a-f0-9]{48}$/);assert.equal(first.status.taikoId,c.taikoId);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.token_hash,digest(first.token));
 const overview=await c.read('/sync');assert.equal(overview.scoreToken.exists,true);assert.equal(overview.scoreToken.tokenMask,first.status.tokenMask);assert.equal('token' in overview.scoreToken,false);
 assert.deepEqual(overview,await c.read('/frozen-sync'));
 const next=await http(c,'POST','/token',{action:'issue'});assert.notEqual(next.token,first.token);
 assert.equal((await http(c,'POST','/token',{action:'revoke'})).revoked,true);assert.equal((await c.read('/sync')).scoreToken.exists,false);
 assert.equal((await http(c,'POST','/token',{action:'revoke'})).revoked,false);
 await http(c,'POST','/logout',{});assert.equal((await c.request('GET','/profile')).status,401);c.cookie=await c.login();
 assert.equal((await c.read('/profile')).currentBinding.currentTitle,'Synthetic current title');
 assert.deepEqual(await sourceSnapshot(c),before);
 assert.ok(c.gate.requests.every(request=>request.action==='targets'||request.userid===c.taikoId));
}));

for(const [name,operation] of Object.entries(operations))for(const field of ['id','taiko_id','source','manual_account_id'])test(`${name} refuses queued ${field} replacement before private reads or gateway`,{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.gate.requests.length=0;
 await assert.rejects(queuedAccountSource(c,()=>operation(c),()=>replaceIdentity(c,field)),e=>e.statusCode===409);
 assert.equal(c.gate.requests.length,0);assert.deepEqual(await sourceSnapshot(c),before);
}));

test('profile proves the full identity again after its private title and pending/QQ reads',{timeout:20000},()=>fixture(async c=>{
 let changed=false;c.state.afterExecute=async sql=>{if(!changed&&sql.includes('FROM web_taiko_binding_verifications')){changed=true;await replaceIdentity(c,'source');}};
 await assert.rejects(operations.profile(c),e=>e.statusCode===409);assert.equal(changed,true);
}));
test('sync overview proves the identity after receiving token status',{timeout:20000},()=>fixture(async c=>{
 c.gate.afterMutation=async action=>{if(action==='status')await replaceIdentity(c,'source');};
 await assert.rejects(operations.sync(c),e=>e.statusCode===409);
}));

test('lease loss during the last SQL proof cannot return a private profile',{timeout:20000},()=>fixture(async c=>{
 let proofs=0;c.state.afterExecute=async sql=>{
  const scope=c.scopeModule.currentScoreScope(c.taikoId);
  if(scope&&sql.includes('FROM web_taiko_bindings')&&sql.includes('LIMIT 1')&&++proofs===2)await scope.lease.close();
 };
 await assert.rejects(operations.profile(c),e=>e.statusCode===503);assert.equal(proofs,2);
}));

test('a long sync SH view holds off token EX and a score publisher',{timeout:20000},()=>fixture(async c=>{
 const entered=deferred(),finish=deferred();let published=false,issued=false;
 c.gate.beforeRequest=async action=>{if(action==='status'){entered.resolve();await bounded(finish.promise);}};
 const reading=operations.sync(c);reading.catch(()=>{});let writing,issuing;
 try{
  await bounded(entered.promise);
  issuing=operations.issue(c).then(result=>{issued=true;return result;});issuing.catch(()=>{});
  writing=c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[]},'wahlap').then(()=>{published=true;});writing.catch(()=>{});
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(issued,false);assert.equal(published,false);finish.resolve();
  assert.equal((await reading).scoreToken.exists,false);assert.equal((await issuing).status.exists,true);await writing;
 }finally{finish.resolve();await reading.catch(()=>{});await issuing?.catch(()=>{});await writing?.catch(()=>{});}
}));

test('token EX keeps SQL owner/current locks while the gateway commits its independent token',{timeout:20000},()=>fixture(async c=>{
 const entered=deferred(),finish=deferred();let changed=false,published=false;
 c.gate.beforeRequest=async action=>{if(action==='issue'){entered.resolve();await bounded(finish.promise);}};
 const issuing=operations.issue(c);issuing.catch(()=>{});let changing,writing;
 try{
  await bounded(entered.promise);
  changing=c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]).then(()=>{changed=true;});changing.catch(()=>{});
  writing=c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[]},'wahlap').then(()=>{published=true;});writing.catch(()=>{});
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(changed,false);assert.equal(published,false);finish.resolve();
  // The later SQL change may win the response's final proof after locks release.
  await issuing.then(result=>assert.equal(result.status.exists,true),error=>assert.equal(error.statusCode,409));await changing;await writing;
  assert.equal(changed,true);assert.equal(published,true);
 }finally{finish.resolve();await issuing.catch(()=>{});await changing?.catch(()=>{});await writing?.catch(()=>{});}
}));

test('manual and empty-profile states never call the private token gateway',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await c.read('/profile')).currentBinding.source,'manual');assert.equal((await c.read('/sync')).scoreTokenAvailable,false);
 await assert.rejects(operations.issue(c),e=>e.statusCode===400);
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[c.user]);
 assert.equal((await c.read('/profile')).currentBinding,null);assert.equal((await c.read('/sync')).hasUserdata,false);
 await assert.rejects(operations.revoke(c),e=>e.statusCode===400);assert.ok(c.gate.requests.every(request=>request.action==='targets'));
},{manual:true}));

test('profile uses canonical title after projection loss/tamper and rejects canonical corruption',{timeout:20000},()=>fixture(async c=>{
 const projection=resolve(c.config.userdataDir,c.taikoId+'data.json');await unlink(projection);
 assert.equal((await c.read('/profile')).currentBinding.currentTitle,'Synthetic current title');
 await writeFile(projection,'{"profile":{"gameCostume":{"title":"Tampered title"}}}');
 assert.equal((await c.read('/profile')).currentBinding.currentTitle,'Synthetic current title');
 const directory=resolve(c.config.userdataDir,'.taiko-publications',c.taikoId),manifest=JSON.parse(await readFile(resolve(directory,'committed.json'),'utf8'));
 await writeFile(resolve(directory,'objects',manifest.files.current.sha256),'corrupt');
 await assert.rejects(operations.profile(c),e=>e.statusCode===503&&!e.message.includes(c.root));
 assert.equal((await c.request('GET','/profile')).status,503);
}));

test('legacy missing/invalid/non-object profiles retain the verified public title',{timeout:20000},()=>fixture(async c=>{
 await rm(resolve(c.config.userdataDir,'.taiko-publications',c.taikoId),{recursive:true,force:true});
 const projection=resolve(c.config.userdataDir,c.taikoId+'data.json');
 for(const value of ['{','null','[]']){
  await writeFile(projection,value);assert.equal((await c.read('/profile')).currentBinding.currentTitle,'Verified public title');
 }
 await unlink(projection);assert.equal((await c.read('/profile')).currentBinding.currentTitle,'Verified public title');
}));

test('managed valid JSON with a non-object profile remains unavailable',{timeout:20000},()=>fixture(async c=>{
 const lease=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
 try{await lease.put('current','null');await lease.publish();}finally{await lease.close();}
 await assert.rejects(operations.profile(c),e=>e.statusCode===503);
}));

test('oversized sync target metadata uses the existing bounded default',{timeout:20000},()=>fixture(async c=>{
 const {loadSyncTargets}=await import('../server/internal/account/sync.ts');
 const healthy=await loadSyncTargets();assert.equal(healthy[0].description,'Synthetic target');
 c.gate.targetReply={targets:Array.from({length:65},(_,id)=>({id:String(id),label:'Owned target',description:''}))};
 const fallback=await loadSyncTargets();assert.equal(fallback.length,1);assert.equal(fallback[0].id,'sakura-bot');
 c.gate.targetReply={targets:[{id:'owned',label:'Owned target',description:'x'.repeat(20*1024)}]};
 assert.deepEqual(await loadSyncTargets(),fallback);
}));

for(const [name,alter] of Object.entries({foreignId:p=>({...p,status:{...p.status,taiko_id:'123'}}),numericId:p=>({...p,status:{...p.status,taiko_id:123}}),badExists:p=>({...p,status:{...p.status,exists:'true'}}),badToken:p=>({...p,token:'private-path-token'}),oversize:p=>({...p,message:'x'.repeat(20*1024)})}))test(`token rejects ${name} gateway replies with bounded public error`,{timeout:20000},()=>fixture(async c=>{
 c.gate.reply=alter;await assert.rejects(operations.issue(c),e=>e.statusCode===502&&e.statusMessage==='网页成绩 token 操作失败');
}));

test('gateway private errors are redacted and mismatched status becomes unavailable',{timeout:20000},()=>fixture(async c=>{
 c.gate.failure={status:500,message:'SELECT secret_hash FROM /private/source/path'};
 await assert.rejects(operations.issue(c),e=>e.statusCode===500&&e.statusMessage==='网页成绩 token 操作失败'&&!e.message.includes('secret_hash'));
 c.gate.failure=null;c.gate.reply=p=>({...p,status:{...p.status,exists:true,token_mask:'wrong'}});
 const overview=await c.read('/sync');assert.equal(overview.scoreTokenAvailable,false);assert.equal(overview.scoreToken,null);
}));

test('actual token SQL hash mismatch prevents issue acknowledgement',{timeout:20000},()=>fixture(async c=>{
 c.gate.afterMutation=async action=>{if(action==='issue')await c.pool.execute('UPDATE public_score_tokens SET token_hash=? WHERE taiko_id=?',['0'.repeat(64),c.taikoId]);};
 await assert.rejects(operations.issue(c),e=>e.statusCode===503);
}));

test('readonly COMMIT acknowledgement loss proves the exact token without a second gateway issue',{timeout:20000},()=>fixture(async c=>{
 c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost COMMIT acknowledgement');};
 const result=await operations.issue(c);assert.equal(result.status.exists,true);assert.equal(c.gate.requests.filter(r=>r.action==='issue').length,1);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.token_hash,digest(result.token));
}));

test('late SQL failure discards failed rollback; a fresh issue rotates an already committed gateway token',{timeout:20000},()=>fixture(async c=>{
 let previousHash;c.gate.afterMutation=async(action,token)=>{if(action==='issue')previousHash=digest(token);};
 c.state.failRollback=true;c.state.beforeSqlStatement=sql=>{if(sql.includes('SELECT token_hash'))throw Object.assign(new Error('Synthetic private SQL /driver/password'),{code:'ER_SYNTHETIC',sql});};
 await assert.rejects(operations.issue(c),e=>e.statusCode===503&&!e.message.includes('password'));assert.equal(c.state.discardedConnections,1);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.token_hash,previousHash);
 c.state.failRollback=false;c.state.beforeSqlStatement=null;const result=await operations.issue(c);assert.notEqual(digest(result.token),row.token_hash);
}));

test('profile subqueries and token COMMIT recovery retain the captured pool',{timeout:20000},()=>fixture(async c=>{
 const runtime=globalThis.__goalSqlRuntime,original=runtime.db;
 const unavailable={execute:async()=>{throw new Error('Replacement pool must not be used');},getConnection:async()=>{throw new Error('Replacement pool must not be used');}};
 try{
  c.state.afterExecute=sql=>{if(sql.includes('SELECT * FROM web_user_accounts'))runtime.db=unavailable;};
  assert.equal((await operations.profile(c)).currentBinding.currentTitle,'Synthetic current title');
  runtime.db=original;c.state.afterExecute=null;
  c.state.afterSqlCommit=()=>{runtime.db=unavailable;throw new Error('Lost readonly ACK after pool replacement');};
  assert.equal((await operations.issue(c)).status.exists,true);
 }finally{runtime.db=original;c.state.afterExecute=null;c.state.afterSqlCommit=null;}
}));
