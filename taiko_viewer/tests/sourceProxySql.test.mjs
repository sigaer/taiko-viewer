// Formal proxy routes -> actual bounded Node runner -> private Python CLI/SQL/kernel.
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {access,unlink,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {accountSourceFixture,sourceSnapshot,bounded} from './fixtures/accountSourceHttp.mjs';
const center='/home/sigaer/git/Sakura_bot/taiko';
async function marker(path){const deadline=performance.now()+8000;for(;;){try{await access(path);return;}catch{}if(performance.now()>deadline)throw new Error('Owned proxy checkpoint deadline');await new Promise(r=>setTimeout(r,20));}}
async function fixture(task,{hiroba=false,manual=false}={}){
 return accountSourceFixture(async c=>{
  c.children=[];c.proxyOptions={};const ip='fd00:'+randomUUID().slice(0,4)+':'+randomUUID().slice(0,4)+'::1';
  if(hiroba)await c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]);
  c.rawToken=randomBytes(12).toString('hex');const [token]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(c.rawToken).digest('hex'),'synthetic']);c.tokenId=String(token.insertId);
  c.register=async(scopes=['wahlap_update','hiroba_sync','history_read'],sources='*')=>c.pool.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id)
    VALUES (?,?,'synthetic-center',?,?,?,'active',?) ON DUPLICATE KEY UPDATE scopes_json=VALUES(scopes_json),sources_json=VALUES(sources_json),revision_nonce=VALUES(revision_nonce)`,[c.tokenId,c.user,JSON.stringify(scopes),JSON.stringify(sources),randomUUID().replaceAll('-',''),c.user]);
  const payload={profile:{userid:c.taikoId,mydon_name:'合成用户',gameCostume:{title:'Synthetic refreshed title',titleplate_id:2}},songs:[{song_no:1,level:4,high_score:812345,stage_cnt:2}],achievement:{gold:3},dojo:{}};
  globalThis.__goalSqlRuntime.sourceMutationLaunch=(executable,args,options)=>{
   assert.equal(executable,'python3');assert.deepEqual(args,['-m','scripts.source_mutation_cli']);assert.equal(options.env.TAIKO_ALLOW_TEST_DB_MUTATION,undefined);
   assert.equal(options.env.PYTHONPATH,undefined);assert.equal(options.env.TAIKO_ACCOUNT_CACHE_DIR,c.config.accountCacheDir);
   const file=resolve(c.root,'proxy-options.json');writeFileSync(file,JSON.stringify({root:c.root,userId:c.user,taikoId:c.taikoId,payload,...c.proxyOptions}),{mode:0o600});
   const child=spawn('/usr/bin/python3',[center+'/tests/source_mutation_sql_child.py',file],{...options,env:{...options.env,PYTHONPATH:center+':'+center+'/tests',TAIKO_ALLOW_TEST_DB_MUTATION:'1'}});c.children.push(child);return child;
  };
  for(const [method,path,file] of [['post','/update/:taikoId','update.post.ts'],['post','/hiroba/:taikoId','sync-hiroba.post.ts'],['get','/history/:taikoId','history.get.ts']])c.route(method,path,(await import('../server/api/taiko/proxy/userdata/[taikoId]/'+file)).default);
  c.ask=async({kind=hiroba?'hiroba':'update',body={includeImage:false},token,cookie=c.cookie}={})=>{
   const response=await c.request(kind==='history'?'GET':'POST',`/${kind}/${c.taikoId}`,kind==='history'?undefined:body,cookie,{'x-forwarded-for':ip,...(token?{authorization:'Bearer '+token}:{})});
   const result=await response.json();if(!response.ok)assert.ok(!JSON.stringify(result).includes('/password/hash')&&!JSON.stringify(result).includes('synthetic-password'));
   return {status:response.status,body:result};
  };
  try{await task(c);}finally{
   for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(r=>child.once('close',r)));}assert.ok(child.exitCode!==null||child.signalCode!==null,'Owned proxy worker remains');}
   await c.pool.execute('DELETE FROM web_hiroba_credentials WHERE taiko_no=?',[c.taikoId]);await c.pool.execute('DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=?',[ip]);
  }
 },{manual,withDeveloper:true});
}
test('formal cookie Wahlap update retains two observations/full DTO without HTTP dispatcher',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),result=await c.ask();assert.equal(result.status,200);assert.deepEqual(Object.keys(result.body),['ok','taikoId','source','message','userdata','imageBase64','imageMimeType','imageFilename']);
 const after=await sourceSnapshot(c);assert.deepEqual(result.body.userdata,JSON.parse(after.raw.current));assert.equal(result.body.source,'wahlap');assert.equal(result.body.imageBase64,null);assert.equal(after.publication.sequence,before.publication.sequence+2);
 assert.equal(after.raw.history.length,before.raw.history.length+2);assert.equal(c.gate.requests.length,0);assert.equal(c.children.length,1);
}));
test('formal update image uses the exact published current/history view and private file cleanup',{timeout:25000},()=>fixture(async c=>{
 const result=await c.ask({body:{includeImage:true,showAll:true}});assert.equal(result.status,200);assert.equal(result.body.imageMimeType,'image/png');assert.equal(result.body.imageFilename,`taiko-update-${c.taikoId}.png`);
 const image=Buffer.from(result.body.imageBase64,'base64');assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(image.length<10000);
 assert.deepEqual(await readdir(resolve(c.config.accountCacheDir,'source-render')),[]);
}));
test('real developer owner may update its own binding; quota alone cannot update a foreign source',{timeout:25000},()=>fixture(async c=>{
 assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,200);await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);const before=await sourceSnapshot(c);
 assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);assert.deepEqual(await sourceSnapshot(c),before);assert.equal(c.children.length,1);
}));
test('explicit service Source/scope works across owner bindings; missing scope is denied',{timeout:25000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);await c.register(['history_read']);assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);
 await c.register(['wahlap_update'],[c.taikoId+'x']);assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,403);
 await c.register(['wahlap_update']);assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,200);
}));
test('anonymous update/history deny before Source worker admission',{timeout:20000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);assert.equal((await c.ask({cookie:''})).status,401);assert.equal((await c.ask({kind:'history',cookie:''})).status,401);assert.equal(c.children.length,0);assert.deepEqual(await sourceSnapshot(c),before);
}));
for(const [name,change,expected] of [
 ['binding replacement',c=>c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]),403],
 ['session deletion',c=>c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[c.user]),401],
 ['service scope',c=>c.pool.execute("UPDATE taiko_source_service_grants SET scopes_json='[\"history_read\"]' WHERE developer_token_id=?",[c.tokenId]),403]
])test('native optimistic-to-EX recheck detects '+name,{timeout:25000},()=>fixture(async c=>{
 const service=name.startsWith('service');if(service)await c.register();c.proxyOptions.pause='optimistic';const before=await sourceSnapshot(c),pending=c.ask(service?{token:c.rawToken,cookie:''}:{});
 try{await marker(resolve(c.root,'proxy-optimistic.json'));await change(c);await writeFile(resolve(c.root,'proxy-release.json'),'{}');assert.equal((await pending).status,expected);assert.deepEqual(await sourceSnapshot(c),before);}
 finally{await writeFile(resolve(c.root,'proxy-release.json'),'{}');await pending;}
}));
test('credential expiry after remote fetch is checked before first Source publication',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.proxyOptions.expireBeforePublish=true;assert.equal((await c.ask()).status,401);assert.deepEqual(await sourceSnapshot(c),before);
}));
for(const [point,delta,image] of [['grant-pinned',0,false],['acquired',1,false],['before-commit',2,false],['after-commit',2,false],['rendered',2,true]])test('real private worker death '+point+' preserves its authorized file boundary',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.proxyOptions.point=point;assert.equal((await c.ask({body:{includeImage:image}})).status,503);assert.equal((await sourceSnapshot(c)).publication.sequence,before.publication.sequence+delta);
 c.proxyOptions={};assert.equal((await c.ask()).status,200);
}));
test('read-only SQL COMMIT ACK failure reports unavailable while keeping published C/H',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);c.proxyOptions={point:'lost-no-commit',failRollback:true};assert.equal((await c.ask()).status,503);assert.equal((await sourceSnapshot(c)).publication.sequence,before.publication.sequence+2);
}));
for(const [code,status] of [[404,404],[-1,502]])test('actual Wahlap error '+code+' retains public status',{timeout:25000},()=>fixture(async c=>{
 c.proxyOptions.refreshResult=code;const before=await sourceSnapshot(c);assert.equal((await c.ask()).status,status);assert.deepEqual(await sourceSnapshot(c),before);
}));
test('real Hiroba sync receives credentials only over stdin and publishes one current/history observation',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c),result=await c.ask({body:{email:'synthetic@example.test',password:'synthetic-password',includeImage:false}});assert.equal(result.status,200);assert.equal(result.body.source,'hiroba');
 const after=await sourceSnapshot(c);assert.equal(after.publication.sequence,before.publication.sequence+1);assert.equal(after.raw.history.length,before.raw.history.length+1);assert.deepEqual(result.body.userdata,JSON.parse(after.raw.current));
},{hiroba:true}));
test('Hiroba missing stored credentials and wrong resolved upstream account cannot publish',{timeout:25000},()=>fixture(async c=>{
 const before=await sourceSnapshot(c);assert.equal((await c.ask()).status,409);c.proxyOptions.resolvedId=c.taikoId+'x';
 assert.equal((await c.ask({body:{email:'synthetic@example.test',password:'synthetic-password',includeImage:false}})).status,503);assert.deepEqual(await sourceSnapshot(c),before);
},{hiroba:true}));
test('Hiroba reads its stored encrypted credentials from the captured SQL connection',{timeout:25000},()=>fixture(async c=>{
 c.proxyOptions.storedCredentials=true;const result=await c.ask();assert.equal(result.status,200);assert.equal(result.body.source,'hiroba');
},{hiroba:true}));
test('large image cannot escape artifact/output bounds; authorized score remains published',{timeout:25000},()=>fixture(async c=>{
 c.proxyOptions.largeImage=true;const before=await sourceSnapshot(c);assert.equal((await c.ask({body:{includeImage:true}})).status,503);assert.equal((await sourceSnapshot(c)).publication.sequence,before.publication.sequence+2);
}));
test('bounded private image directory removes stale artifacts and refuses over-capacity admission',{timeout:25000},()=>fixture(async c=>{
 const {mkdir,utimes}=await import('node:fs/promises'),directory=resolve(c.config.accountCacheDir,'source-render');await mkdir(directory,{recursive:true,mode:0o700});
 const old=resolve(directory,'a'.repeat(32)+'.png');await writeFile(old,'old');await utimes(old,new Date(0),new Date(0));assert.equal((await c.ask({body:{includeImage:true}})).status,200);assert.deepEqual(await readdir(directory),[]);
 for(let i=0;i<16;i++)await writeFile(resolve(directory,i.toString(16).padStart(32,'0')+'.png'),'live');
 assert.equal((await c.ask({body:{includeImage:true}})).status,503);assert.equal((await readdir(directory)).length,16);
}));
test('quota SQL failure is private-safe for the formal source proxy route',{timeout:20000},()=>fixture(async c=>{
 c.state.afterExecute=sql=>{if(sql.includes('web_taiko_open_api_daily_usage'))throw new Error('Private SQL /password/hash');};assert.equal((await c.ask()).status,503);assert.equal(c.children.length,0);
}));
test('return-time binding replacement prevents a private proxy DTO and cleans its image',{timeout:25000},()=>fixture(async c=>{
 let changed=false;c.state.afterExecute=async sql=>{if(!changed&&c.scopeModule.currentScoreScope()?.mode==='read'&&sql.includes('FROM web_taiko_bindings')){changed=true;await c.pool.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE id=?",[c.bindingId]);}};
 assert.equal((await c.ask({body:{includeImage:true}})).status,403);assert.equal(changed,true);assert.deepEqual(await readdir(resolve(c.config.accountCacheDir,'source-render')),[]);
}));
test('Hiroba image shares its current/history publication and healthy image filename',{timeout:25000},()=>fixture(async c=>{
 const result=await c.ask({body:{email:'synthetic@example.test',password:'synthetic-password',includeImage:true}});assert.equal(result.status,200);assert.equal(result.body.imageFilename,`taiko-hiroba-update-${c.taikoId}.png`);assert.equal(result.body.imageMimeType,'image/png');
},{hiroba:true}));
test('history cumulative response budget fails closed without silently truncating',{timeout:25000},()=>fixture(async c=>{
 const held=await (await import('../server/infrastructure/taiko-publication/client.ts')).openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
 const body=JSON.stringify({songs:[],padding:'x'.repeat(17*1024*1024)});
 try{await held.put('history/data_0000.json',body);await held.put('history/data_0001.json',body);await held.publish();}finally{await held.close();}
 assert.equal((await c.ask({kind:'history'})).status,503);
}));
test('history keeps exact filename order/meta timestamp/unknown payload and skips invalid JSON',{timeout:25000},()=>fixture(async c=>{
 const lease=(await import('../server/infrastructure/taiko-publication/client.ts')).openPublicationLease;
 const held=await lease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
 try{await held.put('history/data_0000.json','{"_meta":{"ts":" custom-time "},"unknown":1}');await held.put('history/data_0001.json','{');await held.publish();}finally{await held.close();}
 const result=await c.ask({kind:'history'});assert.equal(result.status,200);assert.equal(result.body.snapshots[0].capturedAt,'custom-time');assert.equal(result.body.snapshots[0].payload.unknown,1);
 const names=await c.scopeModule.withDomainScoreRead(c.taikoId,async()=>c.scopeModule.currentScoreScope(c.taikoId).reader.listHistory(c.taikoId));assert.equal(result.body.snapshots.length,names.length-1);
 const projection=resolve(c.config.userdataDir,c.taikoId,'data_0000.json');await unlink(projection);assert.deepEqual((await c.ask({kind:'history'})).body,result.body);
}));
test('history service scope is separate from raw source scope',{timeout:20000},()=>fixture(async c=>{
 await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);await c.register(['source_read']);assert.equal((await c.ask({kind:'history',token:c.rawToken,cookie:''})).status,403);
 await c.register(['history_read']);assert.equal((await c.ask({kind:'history',token:c.rawToken,cookie:''})).status,200);
}));
test('manual source cannot be externally acquired even by registered service',{timeout:20000},()=>fixture(async c=>{
 await c.register();const before=await sourceSnapshot(c);assert.equal((await c.ask({token:c.rawToken,cookie:''})).status,400);assert.deepEqual(await sourceSnapshot(c),before);
},{manual:true}));
