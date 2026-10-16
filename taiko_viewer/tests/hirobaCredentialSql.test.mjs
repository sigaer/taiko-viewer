import {fileURLToPath} from 'node:url';
const installedFixture=fileURLToPath(new URL('./fixtures/installed-workers/hiroba_credential_child.py',import.meta.url));
// Actual Cookie/token routes and SQL transactions, real private Python crypto
// and original discovery function. Only upstream cards are synthetic.
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,sourceSnapshot,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
const nonce=()=>randomUUID().replaceAll('-',''),digest=text=>createHash('sha256').update(text).digest('hex');
const execFileAsync=promisify(execFile),center='/home/sigaer/git/Sakura_bot/taiko';
async function waitFile(path){const end=performance.now()+6000;for(;;){try{await access(path);return;}catch{assert.ok(performance.now()<end,'Owned worker checkpoint missing');await new Promise(r=>setTimeout(r,20));}}}
async function fixture(task){return accountSourceFixture(async c=>{
 c.ids=[c.taikoId,c.taikoId+'1'];c.ownedIds=new Set(c.ids);c.qq='1'+BigInt('0x'+nonce().slice(0,10)).toString().padStart(12,'0');c.principal='onebot_v11:'+c.qq;c.keys=[c.principal];
 c.ip='fd00:'+nonce().slice(0,4)+':'+nonce().slice(0,4)+'::1';c.email='synthetic@example.test';c.password=randomBytes(16).toString('hex');c.state.expectedSourceMode='none';
 await c.pool.execute("INSERT INTO web_user_qq_bindings(user_id,qq_number,status,verified_at) VALUES (?,?,'active',NOW())",[c.user,c.qq]);
 await c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]);
 await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'hiroba',0)",[c.user,c.ids[1]]);
 c.token=randomBytes(16).toString('hex');const [t]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,digest(c.token),'synthetic']);c.tokenId=String(t.insertId);
 c.register=async({scopes=['hiroba_bind','hiroba_credential_status','bind_current'],sources='*',principals=[c.principal]}={})=>c.pool.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,principals_json,revision_nonce,status,issued_by_user_id)
  VALUES (?,?,'synthetic-hiroba',?,?,?,?,'active',?) ON DUPLICATE KEY UPDATE scopes_json=VALUES(scopes_json),sources_json=VALUES(sources_json),principals_json=VALUES(principals_json),revision_nonce=VALUES(revision_nonce),status='active',expires_at=NULL`,[c.tokenId,c.user,JSON.stringify(scopes),JSON.stringify(sources),principals===null?null:JSON.stringify(principals),nonce(),c.user]);
 c.options=resolve(c.root,'credential-native-options.json');c.setWorker=async({ids=c.ids,point=''}={})=>writeFile(c.options,JSON.stringify({root:c.root,ids,point}),{mode:0o600});await c.setWorker();
 c.launches=0;c.launch=(executable,args,options)=>{
  c.launches++;assert.deepEqual(args,['-I','-m','taiko_bot.cli.hiroba_credential_cli']);assert.equal(options.cwd,c.config.repoRoot);assert.ok(!args.some(arg=>arg.includes(c.password)||arg.includes(c.token)));assert.equal(options.env.TAIKO_RUNTIME_ENV_FILE,'/proc/self/taiko-account-sync-no-env');
  return spawn(executable,['-I',installedFixture,c.options],{...options,env:{...options.env,QA_RUN_DIR:process.env.QA_RUN_DIR,QA_RUN_TMPDIR:process.env.QA_RUN_TMPDIR,TAIKO_RUNTIME_ROOT:c.root,TAIKO_CENTER_ROOT:c.root,TAIKO_OFFLINE_ROOT:c.root}});
 };globalThis.__goalSqlRuntime.hirobaCredentialLaunch=c.launch;
 for(const [method,path,file] of [['post','/hiroba-bind','hiroba/bind.post.ts'],['get','/hiroba-status/:taikoId','hiroba/credentials/[taikoId].get.ts'],['post','/bot-current','bind/current.post.ts']])c.route(method,path,(await import('../server/api/taiko/proxy/'+file)).default);
 c.ask=async({status=false,id=c.taikoId,body={},cookie=c.cookie,token,header}={})=>{
  const response=await c.request(status?'GET':'POST',status?'/hiroba-status/'+encodeURIComponent(id):'/hiroba-bind',status?null:{email:c.email,password:c.password,configuredByQq:c.principal,...body},cookie,{'x-forwarded-for':c.ip,...(token?{authorization:'Bearer '+token}:{}),...(header===undefined?{}:{authorization:header})});
  const result=await response.json();assert.ok(!JSON.stringify(result).includes(c.password)&&!JSON.stringify(result).includes(c.token)&&!JSON.stringify(result).includes('/password/hash'));return {status:response.status,body:result};
 };
 c.snapshot=async()=>{const ids=[...c.ownedIds];const [credentials]=await c.pool.query(`SELECT id,taiko_no,email,password_enc,configured_by_qq FROM web_hiroba_credentials WHERE taiko_no IN (${ids.map(()=>'?').join(',')}) ORDER BY taiko_no`,ids);
  const [bindings]=await c.pool.query('SELECT row_id,qq,id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[c.principal]);const [state]=await c.pool.query('SELECT identity_key,current_virtual FROM taiko_bind_identity_state WHERE identity_key=?',[c.principal]);
  const [receipts]=await c.pool.query('SELECT operation_id,actor_hash,grant_hash,intent_hash,source_ids_json,credential_hash,outcome_hash FROM taiko_hiroba_binding_operations WHERE actor_user_id=? ORDER BY operation_id',[c.user]);return {credentials,bindings,state,receipts};};
 try{await task(c);}finally{
  c.state.afterExecute=null;c.state.beforeSqlStatement=null;c.state.afterSqlStatement=null;c.state.beforeSqlCommit=null;c.state.afterSqlCommit=null;
  for(const key of c.keys){await c.pool.execute('DELETE FROM bind WHERE qq=?',[key]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[key]);}
  for(const id of c.ownedIds)await c.pool.execute('DELETE FROM web_hiroba_credentials WHERE taiko_no=?',[id]);await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);
  await c.pool.execute('DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=?',['ip:'+c.ip]);
 }
},{withDeveloper:true});}
test('empty and actual Fernet-backed status preserve DTO and perform no metadata writes',{timeout:30000},()=>fixture(async c=>{
 const before=await c.snapshot();assert.deepEqual(await c.ask({status:true}),{status:200,body:{ok:true,taikoId:c.taikoId,hasCredentials:false}});assert.deepEqual(await c.snapshot(),before);assert.equal(c.launches,0);
 assert.equal((await c.ask()).status,200);const saved=await c.snapshot();assert.deepEqual(await c.ask({status:true}),{status:200,body:{ok:true,taikoId:c.taikoId,hasCredentials:true}});assert.deepEqual(await c.ask({status:true,id:c.ids[1]}),{status:200,body:{ok:true,taikoId:c.ids[1],hasCredentials:true}});assert.deepEqual(await c.snapshot(),saved);
}));
test('actual discovery and one COMMIT save all cards, hidden slots and frozen manual/current DTO',{timeout:30000},()=>fixture(async c=>{
 await c.pool.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,1,1,1,'manual')",[c.principal,c.manualId]);
 const before=await sourceSnapshot(c),commits=c.state.commits,result=await c.ask();assert.equal(result.status,200);assert.equal(c.state.commits,commits+1);assert.deepEqual(result.body.taikoIds,c.ids);
 const saved=await c.snapshot();assert.equal(saved.credentials.length,2);assert.equal(saved.receipts.length,1);assert.equal(saved.bindings.length,3);assert.equal(result.body.bind.currentTaikoId,c.ids[0]);assert.equal(result.body.bind.currentSlot,2);assert.equal(result.body.bind.bindings[1].visible,0);assert.equal(result.body.bind.bindings[0].displayName,'Synthetic manual');
 const legacy=await import('../server/utils/taiko-center.ts');assert.deepEqual(result.body.bind,await legacy.proxyTaikoCenterBindLookup(c.principal));assert.deepEqual(await sourceSnapshot(c),before);
}));
test('target filtering, empty discovery and no-QQ credential-only DTO preserve original behavior',{timeout:30000},()=>fixture(async c=>{
 const result=await c.ask({body:{targetTaikoNo:c.ids[1],configuredByQq:''}});assert.deepEqual(result.body,{ok:true,taikoIds:[c.ids[1]],bind:null});assert.equal(result.status,200);assert.equal((await c.snapshot()).credentials.length,1);
 await c.setWorker({ids:[]});const before=await c.snapshot(),empty=await c.ask();assert.deepEqual(empty.body,{ok:true,taikoIds:[],bind:null});const saved=await c.snapshot();assert.deepEqual(saved.credentials,before.credentials);assert.deepEqual(saved.bindings,before.bindings);assert.deepEqual(saved.state,before.state);assert.equal(saved.receipts.length,before.receipts.length+1);
}));
test('anonymous and asserted QQ/body user cannot grant private status or binding',{timeout:30000},()=>fixture(async c=>{
 const before=await c.snapshot();assert.equal((await c.ask({cookie:'',body:{userId:c.user}})).status,401);assert.equal((await c.ask({status:true,cookie:''})).status,401);assert.equal((await c.ask({body:{configuredByQq:'onebot_v11:12345'}})).status,403);assert.equal((await c.ask({status:true,id:c.taikoId+'9'})).status,403);assert.equal(c.launches,0);assert.deepEqual(await c.snapshot(),before);
}));
test('owner cannot write foreign or mismatched-platform cards and manual status stays denied',{timeout:30000},()=>fixture(async c=>{
 const before=await c.snapshot();await c.setWorker({ids:[c.taikoId+'9']});assert.equal((await c.ask()).status,403);assert.deepEqual(await c.snapshot(),before);
 await c.pool.execute("UPDATE web_taiko_bindings SET source='wahlap' WHERE id=?",[c.bindingId]);assert.equal((await c.ask({body:{targetTaikoNo:c.taikoId}})).status,403);assert.equal((await c.ask({status:true,id:c.manualId})).status,400);assert.deepEqual(await c.snapshot(),before);
}));
test('explicit service scope/Source/principals works without owner or verified QQ; omissions deny',{timeout:30000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.pool.execute("UPDATE web_taiko_bindings SET source='wahlap' WHERE user_id=? AND source='hiroba'",[c.user]);
 const before=await c.snapshot();for(const policy of [{principals:null},{principals:['onebot_v11:12345']},{sources:[c.ids[0]]},{scopes:['source_read']}]){
  await c.register(policy);assert.equal((await c.ask({token:c.token,cookie:''})).status,403);assert.deepEqual(await c.snapshot(),before);
 }
 await c.register();assert.equal((await c.ask({token:c.token,cookie:''})).status,200);assert.equal((await c.ask({status:true,token:c.token,cookie:''})).status,200);
 assert.equal((await c.ask({status:true,cookie:''})).status,401);
}));
test('invalid Authorization never falls back to a valid Cookie',{timeout:20000},()=>fixture(async c=>{
 assert.equal((await c.ask({header:'Bearer invalid'})).status,401);assert.equal((await c.ask({status:true,header:'bad'})).status,401);assert.equal(c.launches,0);
}));
for(const stage of ['credential','bind','state','receipt','commit'])test('late '+stage+' failure rolls back both credential cards, QQ state and receipt',{timeout:30000},()=>fixture(async c=>{
 assert.equal((await c.ask()).status,200);const before=await c.snapshot();c.password=randomBytes(16).toString('hex');
 c.state.afterSqlStatement=sql=>{if((stage==='credential'&&sql.startsWith('INSERT INTO web_hiroba_credentials'))||(stage==='bind'&&sql.startsWith('UPDATE bind SET visible=0'))||(stage==='state'&&sql.startsWith('INSERT INTO taiko_bind_identity_state'))||(stage==='receipt'&&sql.startsWith('INSERT INTO taiko_hiroba_binding_operations')))throw new Error('Private SQL /password/hash');};
 if(stage==='commit')c.state.beforeSqlCommit=()=>{throw new Error('Private COMMIT /password/hash');};
 assert.equal((await c.ask()).status,503);assert.deepEqual(await c.snapshot(),before);
}));
test('failed rollback destroys both original and uncertain-ACK proof connections and releases gates',{timeout:30000},()=>fixture(async c=>{
 const before=await c.snapshot();c.state.failRollback=true;c.state.beforeSqlCommit=()=>{throw new Error('Private SQL');};assert.equal((await c.ask()).status,503);assert.equal(c.state.discardedConnections,2);assert.deepEqual(await c.snapshot(),before);
 c.state.failRollback=false;c.state.beforeSqlCommit=null;assert.equal((await c.ask()).status,200);
}));
test('lost actual COMMIT ACK proves exact credentials and DTO on fresh captured connection',{timeout:30000},()=>fixture(async c=>{
 let once=true;c.state.afterSqlCommit=()=>{if(once){once=false;throw new Error('Private lost ACK');}};const result=await c.ask();assert.equal(result.status,200);assert.equal((await c.snapshot()).receipts.length,1);
}));
test('exact concurrent nonce retry bypasses discovery, password rotation and later selection overwrite',{timeout:30000},()=>fixture(async c=>{
 const requestId=nonce(),results=await Promise.all([c.ask({body:{requestId}}),c.ask({body:{requestId}})]);assert.deepEqual(results.map(x=>x.status),[200,200]);assert.equal(c.launches,3);assert.equal((await c.snapshot()).receipts.length,1);
 const switched=await c.request('POST','/bot-current',{identityKey:c.principal,slot:2},c.cookie,{'x-forwarded-for':c.ip});assert.equal(switched.status,200);await switched.json();const before=await c.snapshot();
 await c.setWorker({point:'fail'});const retry=await c.ask({body:{requestId}});assert.equal(retry.status,200);assert.equal(retry.body.bind.currentSlot,2);assert.deepEqual(await c.snapshot(),before);assert.equal(c.launches,4);
 assert.equal((await c.ask({body:{requestId,password:'different'}})).status,409);assert.deepEqual(await c.snapshot(),before);
}));
for(const [name,change,status] of [['session',c=>c.pool.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]),401],['QQ',c=>c.pool.execute("UPDATE web_user_qq_bindings SET status='removed' WHERE user_id=?",[c.user]),403],['full owner binding',c=>c.pool.execute("UPDATE web_taiko_bindings SET source='wahlap' WHERE id=?",[c.bindingId]),403]])test('native discovery wait rechecks '+name+' before any authoritative write',{timeout:30000},()=>fixture(async c=>{
 await c.setWorker({point:'pause'});const before=await c.snapshot(),pending=c.ask();try{await waitFile(resolve(c.root,'credential-discovered.json'));await change(c);await writeFile(resolve(c.root,'credential-release.json'),'{}');assert.equal((await pending).status,status);assert.deepEqual(await c.snapshot(),before);}
 finally{await writeFile(resolve(c.root,'credential-release.json'),'{}');await pending;}
}));
test('service principal policy changing during native discovery cannot fall back to owner',{timeout:30000},()=>fixture(async c=>{
 await c.register();await c.setWorker({point:'pause'});const before=await c.snapshot(),pending=c.ask({token:c.token,cookie:''});
 try{await waitFile(resolve(c.root,'credential-discovered.json'));await c.pool.execute('UPDATE taiko_source_service_grants SET principals_json=? WHERE developer_token_id=?',[JSON.stringify(['onebot_v11:12345']),c.tokenId]);await writeFile(resolve(c.root,'credential-release.json'),'{}');assert.equal((await pending).status,403);assert.deepEqual(await c.snapshot(),before);}
 finally{await writeFile(resolve(c.root,'credential-release.json'),'{}');await pending;}
}));
for(const kind of ['session','service'])test('return-time '+kind+' expiry after receipt INSERT rolls back the whole operation',{timeout:30000},()=>fixture(async c=>{
 if(kind==='service')await c.register();const before=await c.snapshot();c.state.afterSqlStatement=async(sql,args,result,db)=>{if(sql.startsWith('INSERT INTO taiko_hiroba_binding_operations'))await db.execute(kind==='session'?'UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?':'UPDATE taiko_source_service_grants SET expires_at=NOW()-INTERVAL 1 SECOND WHERE developer_token_id=?',[kind==='session'?c.user:c.tokenId]);};
 assert.equal((await c.ask(kind==='service'?{token:c.token,cookie:''}:{})).status,kind==='session'?401:403);assert.deepEqual(await c.snapshot(),before);
}));
for(const point of ['fail','death','alarm'])test('native '+point+' cannot save credentials or leak private upstream diagnostics',{timeout:30000},()=>fixture(async c=>{
 await c.setWorker({point});const before=await c.snapshot();assert.equal((await c.ask()).status,point==='fail'?502:503);assert.deepEqual(await c.snapshot(),before);
}));
test('corrupt existing ciphertext has a fixed private 503; status never exposes email or password',{timeout:30000},()=>fixture(async c=>{
 await c.pool.execute('INSERT INTO web_hiroba_credentials(taiko_no,email,password_enc) VALUES (?,?,?)',[c.taikoId,c.email,'broken']);const before=await c.snapshot();assert.equal((await c.ask({status:true})).status,503);assert.deepEqual(await c.snapshot(),before);
}));
test('long official principal fits upgraded credential store and uses exact case-specific binding',{timeout:30000},()=>fixture(async c=>{
 c.principal='qq_official:'+'Ab'.repeat(64);c.keys.push(c.principal);await c.register({principals:[c.principal]});assert.equal((await c.ask({token:c.token,cookie:''})).status,200);assert.equal((await c.snapshot()).credentials[0].configured_by_qq,c.principal);
}));
test('captured pool, roots and key survive global replacement and lost COMMIT ACK',{timeout:30000},()=>fixture(async c=>{
 const captured=globalThis.__goalSqlRuntime.db,config=globalThis.useRuntimeConfig,key=process.env.HIROBA_CRED_KEY;process.env.HIROBA_CRED_KEY='owned-initial-key';
 const launch=c.launch;globalThis.__goalSqlRuntime.hirobaCredentialLaunch=(executable,args,options)=>{assert.equal(options.env.HIROBA_CRED_KEY,'owned-initial-key');assert.equal(options.env.TAIKO_USERDATA_DIR,resolve(c.root,'userdata'));return launch(executable,args,options);};
 let replaced=false,once=true;c.state.afterExecute=sql=>{if(sql.includes('FROM web_taiko_bindings')){replaced=true;process.env.HIROBA_CRED_KEY='late-replacement-key';globalThis.useRuntimeConfig=()=>({repoRoot:'/var/tmp/foreign-credential-root',userdataDir:'/var/tmp/foreign-credential-data'});globalThis.__goalSqlRuntime.db={execute:()=>{throw new Error('Fresh global pool forbidden');},getConnection:()=>{throw new Error('Fresh global pool forbidden');}};}};
 c.state.afterSqlCommit=()=>{if(once){once=false;throw new Error('Private ACK loss');}};
 try{assert.equal((await c.ask()).status,200);assert.equal(replaced,true);assert.equal((await c.snapshot()).receipts.length,1);}finally{globalThis.__goalSqlRuntime.db=captured;globalThis.useRuntimeConfig=config;if(key===undefined)delete process.env.HIROBA_CRED_KEY;else process.env.HIROBA_CRED_KEY=key;}
}));
for(const point of ['before-commit','after-commit'])test('actual Hiroba Node process death '+point+' leaves one atomic outcome and exact replay',{timeout:30000},()=>fixture(async c=>{
 const requestId=nonce(),path=resolve(c.root,'hiroba-node-death.json'),beforeSource=await sourceSnapshot(c);
 await writeFile(path,JSON.stringify({point,config:c.config,cookie:c.cookie,ip:c.ip,email:c.email,password:c.password,principal:c.principal,options:c.options,requestId}),{mode:0o600});
 await assert.rejects(execFileAsync(process.execPath,['--experimental-strip-types',new URL('./fixtures/hirobaCredentialSqlDeathChild.mjs',import.meta.url).pathname,path],{cwd:new URL('../',import.meta.url),timeout:15000,maxBuffer:8192}),error=>error.code===73);
 const saved=await c.snapshot();assert.equal(saved.credentials.length,point==='after-commit'?2:0);assert.equal(saved.bindings.length,point==='after-commit'?2:0);assert.equal(saved.receipts.length,point==='after-commit'?1:0);
 const result=await c.ask({body:{requestId}});assert.equal(result.status,200);assert.equal((await c.snapshot()).receipts.length,1);if(point==='after-commit')assert.equal(c.launches,1);
 assert.deepEqual(await sourceSnapshot(c),beforeSource);
}));
test('identity named gate has a real five-second wait and cannot partially save cards',{timeout:30000},()=>fixture(async c=>{
 const blocker=await c.pool.getConnection(),gate='taiko-bind-'+createHash('sha256').update(JSON.stringify(c.principal)).digest('hex').slice(0,52);await blocker.execute('SELECT GET_LOCK(?,5)',[gate]);
 const before=await c.snapshot();try{const started=performance.now();assert.equal((await c.ask()).status,503);assert.ok(performance.now()-started<8500);assert.deepEqual(await c.snapshot(),before);}finally{await blocker.execute('SELECT RELEASE_LOCK(?)',[gate]);blocker.release();}
 assert.equal((await c.ask()).status,200);
}));
test('completed owner replay permits unrelated new binding but revoked selected Source denies',{timeout:30000},()=>fixture(async c=>{
 const requestId=nonce();assert.equal((await c.ask({body:{requestId}})).status,200);
 await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'hiroba',0)",[c.user,c.taikoId+'8']);
 const before=await c.snapshot();assert.equal((await c.ask({body:{requestId}})).status,200);assert.deepEqual(await c.snapshot(),before);
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?',[c.user,c.ids[1]]);assert.equal((await c.ask({body:{requestId}})).status,403);assert.deepEqual(await c.snapshot(),before);
}));
test('status rechecks expiry after native decode and read-only COMMIT ACK failure is unavailable',{timeout:30000},()=>fixture(async c=>{
 assert.equal((await c.ask()).status,200);const before=await c.snapshot();c.state.afterSqlStatement=async(sql,args,result,db)=>{if(sql.includes('FROM web_hiroba_credentials'))await db.execute('UPDATE web_user_sessions SET expires_at=NOW()-INTERVAL 1 SECOND WHERE user_id=?',[c.user]);};
 assert.equal((await c.ask({status:true})).status,401);assert.deepEqual(await c.snapshot(),before);c.state.afterSqlStatement=null;
 c.state.afterSqlCommit=()=>{throw new Error('Private read-only COMMIT ACK');};assert.equal((await c.ask({status:true})).status,503);assert.deepEqual(await c.snapshot(),before);
}));
test('retired ownerless Hiroba adapters return 410 without Python, SQL or metadata writes',{timeout:20000},()=>fixture(async c=>{
 const legacy=await import('../server/utils/taiko-center.ts'),before=await c.snapshot();
 await assert.rejects(legacy.proxyTaikoCenterHirobaBind({email:c.email,password:c.password,configuredByQq:c.principal}),error=>error.statusCode===410);
 await assert.rejects(legacy.proxyTaikoCenterHirobaCredentialStatus(c.taikoId),error=>error.statusCode===410);assert.equal(c.launches,0);assert.deepEqual(await c.snapshot(),before);
}));
