// Real guarded SQL, actual authenticated HTTP and two owned loopback servers.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,unlink,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {accountSourceFixture as fixture,sourceSnapshot,deferred,bounded,queuedAccountSource,replaceIdentity} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';
const digest=token=>createHash('sha256').update(token).digest('hex');
const execFileAsync=promisify(execFile);
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

for(const action of ['issue','revoke'])test(`${action} failure before SQL COMMIT preserves the previous token`,{timeout:20000},()=>fixture(async c=>{
 const previous=await operations.issue(c),before=await sourceSnapshot(c);
 c.state.beforeSqlCommit=()=>{throw Object.assign(new Error('Synthetic private COMMIT /driver/password'),{code:'ER_SYNTHETIC'});};
 await assert.rejects(operations[action](c),e=>e.statusCode===503&&!e.message.includes('password'));
 const [[row]]=await c.pool.query('SELECT token_hash,token_mask FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);
 assert.equal(row.token_hash,digest(previous.token));assert.equal(row.token_mask,previous.status.tokenMask);
 assert.deepEqual(await sourceSnapshot(c),before);
}));

test('revoke COMMIT acknowledgement loss preserves the actual affected-row outcome',{timeout:20000},()=>fixture(async c=>{
 await operations.issue(c);let deletes=0;c.state.afterSqlStatement=sql=>{if(sql.includes('DELETE FROM public_score_tokens'))deletes++;};
 c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost mutating acknowledgement');};
 assert.equal((await operations.revoke(c)).revoked,true);assert.equal(deletes,1);
 assert.equal((await operations.revoke(c)).revoked,false);assert.equal(deletes,2);
 const [[row]]=await c.pool.query('SELECT COUNT(*) AS n FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.n,0);
}));

test('uncertain COMMIT with a subsequently replaced SQL token cannot acknowledge the previous plaintext',{timeout:20000},()=>fixture(async c=>{
 c.state.afterSqlCommit=async()=>{
  await c.pool.execute('UPDATE public_score_tokens SET token_hash=? WHERE taiko_id=?',['0'.repeat(64),c.taikoId]);
  throw new Error('Synthetic lost mutating acknowledgement');
 };
 await assert.rejects(operations.issue(c),e=>e.statusCode===503);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.token_hash,'0'.repeat(64));
 c.state.afterSqlCommit=null;const fresh=await operations.issue(c);assert.notEqual(digest(fresh.token),row.token_hash);
}));

test('uncertain COMMIT cannot return a token after the current identity changes',{timeout:20000},()=>fixture(async c=>{
 c.state.afterSqlCommit=async()=>{await replaceIdentity(c,'source');throw new Error('Synthetic lost mutating acknowledgement');};
 await assert.rejects(operations.issue(c),e=>e.statusCode===409);
}));

for(const point of ['before-commit','after-commit'])test(`token lease death ${point} cannot return a private result`,{timeout:20000},()=>fixture(async c=>{
 const previous=await operations.issue(c);
 if(point==='before-commit')c.state.afterSqlStatement=async sql=>{if(sql.includes('SELECT token_hash'))await c.scopeModule.currentScoreScope(c.taikoId).lease.close();};
 else c.state.afterSqlCommit=async()=>{await c.scopeModule.currentScoreScope(c.taikoId).lease.close();throw new Error('Synthetic late lease death');};
 await assert.rejects(operations.issue(c),e=>e.statusCode===503);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);
 if(point==='before-commit')assert.equal(row.token_hash,digest(previous.token));else assert.notEqual(row.token_hash,digest(previous.token));
}));

test('direct SQL token dates/mask match the existing Python gateway and rotation keeps row identity',{timeout:20000},()=>fixture(async c=>{
 const first=await operations.issue(c);
 await c.pool.execute("UPDATE public_score_tokens SET last_used_at='2026-08-05 10:20:30',created_at='2026-08-01 09:00:00',updated_at='2026-08-05 10:20:30' WHERE taiko_id=?",[c.taikoId]);
 const {requestScoreTokenManagement}=await import('../server/internal/account/score-token.ts');
 assert.deepEqual((await c.read('/sync')).scoreToken,(await requestScoreTokenManagement(c.taikoId,'status')).status);
 const [[old]]=await c.pool.query('SELECT id,created_at FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);
 const next=await operations.issue(c),[[row]]=await c.pool.query('SELECT id,created_at,last_used_at,token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);
 assert.notEqual(first.token,next.token);assert.equal(row.id,old.id);assert.equal(row.created_at.getTime(),old.created_at.getTime());
 assert.equal(row.last_used_at,null);assert.equal(row.token_hash,digest(next.token));
}));

test('two concurrent fresh issues serialize and preserve the original rotation semantics',{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),[first,next]=await Promise.all([operations.issue(c),operations.issue(c)]);
 assert.notEqual(first.token,next.token);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);
 assert.ok([digest(first.token),digest(next.token)].includes(row.token_hash));assert.deepEqual(await sourceSnapshot(c),before);
 assert.equal(c.gate.requests.length,0);
}));

test('private SQL status failures retain the unavailable overview state',{timeout:20000},()=>fixture(async c=>{
 await operations.issue(c);
 c.state.afterExecute=sql=>{if(sql.includes('DATE_FORMAT(last_used_at'))throw Object.assign(new Error('Private SELECT /password/hash'),{code:'ER_SYNTHETIC',sql});};
 const overview=await c.read('/sync');assert.equal(overview.scoreTokenAvailable,false);assert.equal(overview.scoreToken,null);
}));

for(const action of ['issue','revoke'])for(const point of ['before-commit','after-commit'])test(`actual token ${action} process death ${point} has an atomic token outcome`,{timeout:25000},()=>fixture(async c=>{
 const previous=await operations.issue(c),beforeSource=await sourceSnapshot(c);
 const options=resolve(c.root,'token-crash-options.json'),childFile=resolve(c.root,'token-crash-child.mjs');
 await writeFile(options,JSON.stringify({point,action,user:c.user,taikoId:c.taikoId,config:c.config}),{mode:0o600});
 await writeFile(childFile,`
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import mysql from ${JSON.stringify(import.meta.resolve('mysql2/promise'))};
import {installGoalSqlRuntime} from ${JSON.stringify(new URL('./fixtures/goalSqlRuntime.mjs',import.meta.url).href)};
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.match(String(process.env.TAIKO_DB_NAME||''),/_test$/);
const o=JSON.parse(await readFile(process.argv[2],'utf8'));
const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2});
const [[identity]]=await pool.query('SELECT DATABASE() AS name');assert.match(identity.name,/_test$/);assert.equal(identity.name,process.env.TAIKO_DB_NAME);
let scope;const db={query:(...a)=>pool.query(...a),execute:(...a)=>pool.execute(...a),async getConnection(){
assert.equal(scope.currentScoreScope(o.taikoId)?.mode,'write');const connection=await pool.getConnection();
return {beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),destroy:()=>connection.destroy(),release:()=>connection.release(),execute:(...a)=>connection.execute(...a),
async commit(){if(o.point==='before-commit')process.exit(73);await connection.commit();if(o.point==='after-commit')process.exit(73);}};}};
installGoalSqlRuntime(db,o.config);globalThis.fetch=async()=>{throw new Error('Owned test network forbidden');};
scope=await import(${JSON.stringify(new URL('../server/services/taiko-domain/publication.ts',import.meta.url).href)});
const service=await import(${JSON.stringify(new URL('../server/services/account/score-token-authority.ts',import.meta.url).href)});
await service.manageViewerScoreToken(o.user,o.action);process.exit(74);
`,{mode:0o600});
 await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',childFile,options],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),e=>e.code===73);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);
 if(point==='before-commit')assert.equal(row.token_hash,digest(previous.token));else if(action==='issue')assert.notEqual(row.token_hash,digest(previous.token));else assert.equal(row,undefined);
 if(action==='issue'){const next=await operations.issue(c);assert.equal(next.status.exists,true);if(row)assert.notEqual(digest(next.token),row.token_hash);}
 else assert.equal((await operations.revoke(c)).revoked,point==='before-commit');
 assert.deepEqual(await sourceSnapshot(c),beforeSource);
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
test('sync overview proves the identity after reading token SQL status',{timeout:20000},()=>fixture(async c=>{
 c.state.afterExecute=async sql=>{if(sql.includes('DATE_FORMAT(last_used_at'))await replaceIdentity(c,'source');};
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
 c.state.afterExecute=async sql=>{if(sql.includes('DATE_FORMAT(last_used_at')){entered.resolve();await bounded(finish.promise);}};
 const reading=operations.sync(c);reading.catch(()=>{});let writing,issuing;
 try{
  await bounded(entered.promise);
  issuing=operations.issue(c).then(result=>{issued=true;return result;});issuing.catch(()=>{});
  writing=c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId},songs:[]},'wahlap').then(()=>{published=true;});writing.catch(()=>{});
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(issued,false);assert.equal(published,false);finish.resolve();
  assert.equal((await reading).scoreToken.exists,false);assert.equal((await issuing).status.exists,true);await writing;
 }finally{finish.resolve();await reading.catch(()=>{});await issuing?.catch(()=>{});await writing?.catch(()=>{});}
}));

test('token EX holds SQL owner/current locks and the uncommitted token until one COMMIT',{timeout:20000},()=>fixture(async c=>{
 const entered=deferred(),finish=deferred();let changed=false,published=false;
 c.state.afterSqlStatement=async sql=>{if(sql.includes('INSERT INTO public_score_tokens')){entered.resolve();await bounded(finish.promise);}};
 const issuing=operations.issue(c);issuing.catch(()=>{});let changing,writing;
 try{
  await bounded(entered.promise);
  const [[token]]=await c.pool.query('SELECT COUNT(*) AS n FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(token.n,0);
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

for(const [name,alter] of Object.entries({foreignId:p=>({...p,status:{...p.status,taiko_id:'123'}}),numericId:p=>({...p,status:{...p.status,taiko_id:123}}),badExists:p=>({...p,status:{...p.status,exists:'true'}}),badToken:p=>({...p,token:'private-path-token'}),oversize:p=>({...p,message:'x'.repeat(20*1024)})}))test(`retained legacy adapter rejects ${name} gateway replies with bounded public error`,{timeout:20000},()=>fixture(async c=>{
 const {requestScoreTokenManagement}=await import('../server/internal/account/score-token.ts');
 c.gate.reply=alter;await assert.rejects(requestScoreTokenManagement(c.taikoId,'issue'),e=>e.statusCode===502&&e.statusMessage==='网页成绩 token 操作失败');
}));

test('Viewer token issue/status/revoke are independent of an unavailable legacy token gateway',{timeout:20000},()=>fixture(async c=>{
 c.gate.failure={status:500,message:'SELECT secret_hash FROM /private/source/path'};
 const issued=await operations.issue(c);assert.equal(issued.status.exists,true);
 const overview=await c.read('/sync');assert.equal(overview.scoreTokenAvailable,true);assert.equal(overview.scoreToken.tokenMask,issued.status.tokenMask);
 assert.equal((await operations.revoke(c)).revoked,true);
 assert.ok(c.gate.requests.every(request=>request.action==='targets'));
}));

test('a mismatched SQL outcome proof rolls back the pending token mutation',{timeout:20000},()=>fixture(async c=>{
 c.state.afterSqlStatement=(sql,args,result)=>{if(sql.includes('SELECT token_hash'))result[0][0].token_hash='0'.repeat(64);};
 await assert.rejects(operations.issue(c),e=>e.statusCode===503);
 const [[row]]=await c.pool.query('SELECT COUNT(*) AS n FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.n,0);
}));

test('mutating COMMIT acknowledgement loss proves the exact token without a second issue',{timeout:20000},()=>fixture(async c=>{
 let writes=0;c.state.afterSqlStatement=sql=>{if(sql.includes('INSERT INTO public_score_tokens'))writes++;};
 c.state.afterSqlCommit=()=>{throw new Error('Synthetic lost COMMIT acknowledgement');};
 const result=await operations.issue(c);assert.equal(result.status.exists,true);assert.equal(writes,1);assert.equal(c.gate.requests.length,0);
 const [[row]]=await c.pool.query('SELECT token_hash FROM public_score_tokens WHERE taiko_id=?',[c.taikoId]);assert.equal(row.token_hash,digest(result.token));
}));

test('late SQL failure discards failed rollback and preserves the previous committed token',{timeout:20000},()=>fixture(async c=>{
 const previous=await operations.issue(c),previousHash=digest(previous.token);
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
  c.state.afterSqlCommit=()=>{runtime.db=unavailable;throw new Error('Lost mutating ACK after pool replacement');};
  assert.equal((await operations.issue(c)).status.exists,true);
 }finally{runtime.db=original;c.state.afterExecute=null;c.state.afterSqlCommit=null;}
}));
