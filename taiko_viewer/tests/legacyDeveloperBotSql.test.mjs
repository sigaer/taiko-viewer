import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';

test('approved legacy Developer token serves foreign Bot users without grants; revocation and v1 remain separate', {timeout: 60000}, () => accountSourceFixture(async c => {
  const tag = randomBytes(8).toString('hex');
  const [developer] = await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)', ['bot-'+tag, tag+'@example.test', 'synthetic']);
  const [application] = await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'bot@example.test','isolated bot deployment','approved')", [developer.insertId]);
  const clientId='clt_'+randomBytes(16).toString('hex'),playerId='plr_'+randomBytes(16).toString('hex');
  const {DEVELOPER_API_V1_TABLES}=await import('../server/infrastructure/developer-api-v1/schema.ts');
  for(const ddl of DEVELOPER_API_V1_TABLES)await c.pool.execute(ddl);
  await c.pool.execute('INSERT INTO web_developer_api_clients(client_id,application_id,owner_user_id,display_name) VALUES (?,?,?,?)',[clientId,application.insertId,developer.insertId,'Synthetic Bot']);
  await c.pool.execute('INSERT INTO web_developer_api_resources(player_id,binding_id) VALUES (?,?)',[playerId,c.bindingId]);
  const token = randomBytes(12).toString('hex');
  const [credential] = await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)', [developer.insertId, application.insertId, createHash('sha256').update(token).digest('hex'), 'synthetic']);
  const principal = 'onebot_v11:9'+BigInt('0x'+tag.slice(0,8)).toString().padStart(10,'0');
  const {legacyDeveloperGrant} = await import('../server/services/account/legacy-developer-access.ts');
  const children=[];
  globalThis.__goalSqlRuntime.sourceMutationLaunch=(executable,args,options)=>{
    assert.deepEqual(args,['-I','-m','taiko_bot.cli.source_mutation_cli']);
    const file=resolve(c.root,'legacy-proxy-options.json');
    writeFileSync(file,JSON.stringify({root:c.root,userId:c.user,taikoId:c.taikoId,payload:{profile:{userid:c.taikoId,mydon_name:'Synthetic Bot user'},songs:[{song_no:1,level:4,high_score:812345}],achievement:{},dojo:{}}}),{mode:0o600});
    const child=spawn(executable,['-I',fileURLToPath(new URL('./fixtures/installed-workers/source_mutation_sql_child.py',import.meta.url)),file],{...options,env:{...options.env,QA_RUN_DIR:process.env.QA_RUN_DIR,QA_RUN_TMPDIR:process.env.QA_RUN_TMPDIR,TAIKO_RUNTIME_ROOT:c.root,TAIKO_CENTER_ROOT:c.root,TAIKO_OFFLINE_ROOT:c.root,TAIKO_ALLOW_TEST_DB_MUTATION:'1'}});
    children.push(child);return child;
  };
  c.route('post','/legacy/update/:taikoId',(await import('../server/api/taiko/proxy/userdata/[taikoId]/update.post.ts')).default);
  const {captureAuthorizedSourceMutation} = await import('../server/services/account/source-access.ts');
  c.route('get','/api/v1/taiko/players/:playerId/scores',(await import('../server/api/v1/taiko/players/[playerId]/scores.get.ts')).default);
  c.route('get','/legacy/current/:userid',(await import('../server/api/developer/userdata/[userid].get.ts')).default);
  c.route('get','/legacy/history/:taikoId',(await import('../server/api/taiko/proxy/userdata/[taikoId]/history.get.ts')).default);
  c.route('get','/legacy/bind',(await import('../server/api/taiko/proxy/bind.get.ts')).default);
  c.route('post','/legacy/bind',(await import('../server/api/taiko/proxy/bind.post.ts')).default);
  c.route('post','/legacy/current',(await import('../server/api/taiko/proxy/bind/current.post.ts')).default);
  // Exercise capture on an actual HTTP request; acquisition stays synthetic.
  c.route('post','/legacy/sync/:id',async event => {
    const ticket = await captureAuthorizedSourceMutation(event,event.context.params.id,'wahlap_update');
    return {kind:ticket.grant.kind, source:ticket.source};
  });
  async function request(method,path,body,status=200,credentialToken=token) {
    const response=await c.request(method,path,body,'',{authorization:'Bearer '+credentialToken});
    const payload=await response.json();
    assert.equal(response.status,status,method+' '+path+' '+JSON.stringify(payload).slice(0,300));
    return payload;
  }
  try {
    const actor={kind:'developer',userId:developer.insertId,tokenId:String(credential.insertId),credential:createHash('sha256').update(token).digest('hex')};
    assert.equal((await legacyDeveloperGrant(c.pool,actor)).kind,'developer');
    assert.equal(await legacyDeveloperGrant(c.pool,{...actor,kind:'session'}),null);
    const [[grants]]=await c.pool.query('SELECT COUNT(*) AS n FROM taiko_source_service_grants WHERE developer_token_id=?',[credential.insertId]);
    assert.equal(grants.n,0);
    c.config.developerApiV1=true;c.config.public={};
    const denied=await request('GET','/api/v1/taiko/players/'+playerId+'/scores',undefined,403);
    assert.equal(denied.code,'GRANT_REQUIRED');
    assert.equal((await request('GET','/legacy/current/'+c.taikoId)).profile.userid,c.taikoId);
    assert.ok(Array.isArray((await request('GET','/legacy/history/'+c.taikoId+'?format=raw-v1')).snapshots));
    const sync=await request('POST','/legacy/sync/'+c.taikoId,{});assert.equal(sync.kind,'developer');
    const updated=await request('POST','/legacy/update/'+c.taikoId,{includeImage:false});
    assert.equal(updated.ok,true);assert.equal(updated.userdata.songs[0].high_score,812345);
    assert.equal(children.length,1);
    c.state.expectedSourceMode='none';
    const added=await request('POST','/legacy/bind',{identityKey:principal,taikoId:c.taikoId,source:'wahlap',visible:0,requestId:randomBytes(16).toString('hex')});
    assert.equal(added.found,true);
    const binding=await request('GET','/legacy/bind?identityKey='+encodeURIComponent(principal));
    assert.equal(binding.bindings[0].taikoId,c.taikoId);assert.equal(binding.bindings[0].visible,0);
    await request('POST','/legacy/current',{identityKey:principal,slot:1,requestId:randomBytes(16).toString('hex')});
    // Disabling v1 and the former grant rollout flag cannot change legacy access.
    c.config.developerApiV1=false;c.config.developerGlobalScoresRead=false;
    await request('GET','/legacy/current/'+c.taikoId);
    c.config.taikoOpenDeveloperDailyLimit=1;
    await request('GET','/legacy/current/'+c.taikoId,undefined,429);
    delete c.config.taikoOpenDeveloperDailyLimit;
    await c.pool.execute("UPDATE web_developer_applications SET status='rejected' WHERE id=?",[application.insertId]);
    await request('GET','/legacy/current/'+c.taikoId,undefined,403);
    await request('GET','/legacy/bind?identityKey='+encodeURIComponent(principal),undefined,403);
    await c.pool.execute("UPDATE web_developer_applications SET status='approved' WHERE id=?",[application.insertId]);
    await c.pool.execute("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE id=?",[credential.insertId]);
    await request('GET','/legacy/current/'+c.taikoId,undefined,401);
    await request('GET','/legacy/bind?identityKey='+encodeURIComponent(principal),undefined,401);
  } finally {
    for(const child of children){
      if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('close',resolve));}
      assert.ok(child.exitCode!==null||child.signalCode!==null);
    }
    await c.pool.execute('DELETE FROM taiko_bot_binding_operations WHERE principal=?',[principal]);
    await c.pool.execute('DELETE FROM bind WHERE qq=?',[principal]);
    await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[principal]);
    await c.pool.execute('DELETE FROM web_developer_api_resources WHERE player_id=?',[playerId]);
    await c.pool.execute('DELETE FROM web_developer_api_clients WHERE client_id=?',[clientId]);
    await c.pool.execute('DELETE FROM web_developer_tokens WHERE id=?',[credential.insertId]);
    await c.pool.execute('DELETE FROM web_developer_applications WHERE id=?',[application.insertId]);
    await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[developer.insertId]);
  }
},{withDeveloper:true}));
