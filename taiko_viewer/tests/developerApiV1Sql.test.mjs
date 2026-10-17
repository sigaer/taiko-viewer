import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import Ajv from 'ajv';
import ts from 'typescript';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
import {assertQaPython} from './fixtures/qaPaths.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const observations=[];const nativeFetch=globalThis.fetch;
const schema=JSON.parse(await readFile(new URL('../../packages/sakura-taiko-contract/schema/contract-v1.json',import.meta.url),'utf8'));
const ajv=new Ajv({strict:true,allowUnionTypes:true});ajv.addSchema(schema);
const validate=name=>ajv.compile({$ref:schema.$id+'#/$defs/'+name});
async function actualBaseDdl(c,table){const source=await readFile(new URL('../server/utils/account-schema-definition.ts',import.meta.url),'utf8');const ast=ts.createSourceFile('account-db.ts',source,ts.ScriptTarget.Latest,true);let value;function visit(node){if(ts.isNoSubstitutionTemplateLiteral(node)&&node.text.startsWith('CREATE TABLE IF NOT EXISTS '+table+' ('))value=node.text;ts.forEachChild(node,visit);}visit(ast);assert.ok(value);await c.pool.execute(value);}

test('Developer API v1 real isolated MySQL/HTTP consent, negative authorization and Publication generation',{timeout:180000},()=>accountSourceFixture(async c=>{
 c.state.expectedSourceMode='none';assertQaPython();Object.assign(c.config,{developerApiV1:true,developerApiAnonymousDailyLimit:300,developerApiClientDailyLimit:5000,repoRoot:c.root,public:{}});
 await actualBaseDdl(c,'web_developer_applications');
 execFileSync(process.execPath,['--experimental-strip-types',new URL('../scripts/migrate_developer_api_v1.ts',import.meta.url).pathname,'--apply'],{env:process.env,timeout:30000,maxBuffer:32768});
 const [[proof]]=await c.pool.query('SELECT DATABASE() name,@@datadir datadir');assert.equal(proof.name,process.env.TAIKO_DB_NAME);assert.ok(proof.name.endsWith('_test'));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const catalogPath=resolve(c.root,'songs.json');const rows=[{id:100,title:'unused',song_name:'Synthetic',level_4:9,level_5:10,shelf_status:0,region:'CN',chart_type:'single'},{id:101,song_name:'Other region',level_1:1,shelf_status:2,region:'JP',chart_type:'double'}];await writeFile(catalogPath,JSON.stringify(rows));c.config.songDataPath=catalogPath;
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 const paths={root:c.config.userdataDir,repoRoot:c.root,identity:c.taikoId,mode:'write'};
 const base={_meta:{source:'wahlap',ts:'2026-10-15T04:00:00Z'},profile:{mydon_name:'Synthetic player',cookie:'never-return-this-cookie',token:'never-return-this-token'},songs:[{song_no:100,level:4,high_score:900000,good_cnt:100,ok_cnt:1,ng_cnt:0,stage_cnt:2,clear_cnt:1,combo_cnt:null,highscore_datetime:'upstream text',update_datetime:'not a play event',private_extension:'never-return-extension'}]};
 async function publish(score=900000){return withPublicationLease(paths,async lease=>{await lease.put('current',JSON.stringify({...base,songs:base.songs.map(s=>({...s,high_score:score}))}));return lease.publish();});}
 await publish();
 const endpoints=[['get','/api/v1/taiko/meta','v1/taiko/meta.get.ts'],['get','/api/v1/taiko/catalog/songs','v1/taiko/catalog/songs.get.ts'],['get','/api/v1/taiko/catalog/charts','v1/taiko/catalog/charts.get.ts'],['get','/api/v1/taiko/players/:playerId/scores','v1/taiko/players/[playerId]/scores.get.ts'],['get','/api/v1/taiko/players/:playerId/profile','v1/taiko/players/[playerId]/profile.get.ts'],['get','/api/account/developer/grants','account/developer/grants/index.get.ts'],['post','/api/account/developer/grants','account/developer/grants/index.post.ts'],['delete','/api/account/developer/grants/:grantId','account/developer/grants/[grantId].delete.ts'],['get','/api/account/developer/clients','account/developer/clients/index.get.ts'],['post','/api/account/developer/clients','account/developer/clients/index.post.ts'],['delete','/api/account/developer/clients/:clientId','account/developer/clients/[clientId].delete.ts']];
 for(const [method,path,file] of endpoints)c.route(method,path,(await import('../server/api/'+file)).default);
 async function ask(name,path,{method='GET',body,cookie=c.cookie,token,headers={},expected=200,schemaName}={}){
  const res=await c.request(method,path,body,cookie,{origin:c.baseUrl,...(token!==undefined?{authorization:'Bearer '+token}:{}),...headers});const text=await res.text();let value=text?JSON.parse(text):null;
  const record={case:name,status:res.status,expected,code:value?.code||null,cache:res.headers.get('cache-control'),etag:res.headers.get('etag'),bodyKeys:value?Object.keys(value):[]};observations.push(record);console.log(JSON.stringify(record));if(res.status===503)console.log(JSON.stringify({sqlFault:c.state.sqlFaultCode||null}));if(Array.isArray(expected))assert.ok(expected.includes(res.status),name);else assert.equal(res.status,expected,name);
  for(const privateValue of ['never-return-this-cookie','never-return-this-token','never-return-extension',c.root,'password_hash','password_enc','legacy','rawUserdata'])assert.equal(text.includes(privateValue),false,name+' leaks private value');
  if(schemaName)assert.equal(validate(schemaName)(value),true,name+' schema');
  if(res.status>=400){assert.deepEqual(Object.keys(value).sort(),['code','message','requestId']);assert.ok(value.requestId);assert.equal(res.headers.get('cache-control'),'private, no-store');}
  return {res,body:value};
 }
 async function approvedApp(user){const [r]=await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'synthetic@example.test','isolated fixture','approved')",[user]);return r.insertId;}
 const appX=await approvedApp(c.user),keyX=randomBytes(24).toString('hex');await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[c.user,appX,digest(keyX),'synthetic']);
 const [other]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',['api-'+randomBytes(6).toString('hex'),'api-'+randomBytes(6).toString('hex')+'@example.test',await c.shared.getPasswordHash('synthetic-password-not-logged')]);const userB=other.insertId;
 const [[uB]]=await c.pool.query('SELECT username FROM web_user_accounts WHERE id=?',[userB]);const logged=await c.request('POST','/login',{identifier:uB.username,password:'synthetic-password-not-logged'},'');assert.equal(logged.status,200);const cookieB=logged.headers.get('set-cookie').split(';')[0];
 const appY=await approvedApp(userB),keyY=randomBytes(24).toString('hex');await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[userB,appY,digest(keyY),'synthetic']);
 const clientX=(await ask('register-approved-client-X','/api/account/developer/clients',{method:'POST',body:{displayName:'Synthetic app X'}})).body.client.clientId;
 const clientY=(await ask('register-approved-client-Y','/api/account/developer/clients',{method:'POST',cookie:cookieB,body:{displayName:'Synthetic app Y'}})).body.client.clientId;
 const [a2]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'wahlap','Synthetic A2',0)",[c.user,c.taikoId+'1']);
 const [b1]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'wahlap','Synthetic B1',1)",[userB,c.taikoId+'2']);
 const bindingId=String(c.bindingId);const issue={bindingId,clientId:clientX,scopes:['scores:read'],expiresInDays:30,consent:true,consentVersion:'viewer-resource-consent-v1',audience:'viewer:developer-api:v1'};
 const fake='plr_'+'a'.repeat(32);const scores=id=>'/api/v1/taiko/players/'+id+'/scores';const profile=id=>'/api/v1/taiko/players/'+id+'/profile';
 try{
  c.config.developerApiV1=false;await ask('default-off','/api/v1/taiko/meta',{expected:404});c.config.developerApiV1=true;
  const pub=await ask('anonymous-public-songs','/api/v1/taiko/catalog/songs',{cookie:'',schemaName:'CatalogSongsResponse'});assert.equal(pub.body.items[0].availability.region,'CN');
  const charts=await ask('anonymous-public-charts','/api/v1/taiko/catalog/charts',{cookie:'',schemaName:'CatalogChartsResponse'});assert.equal(charts.body.items[0].difficulty,4);assert.equal(charts.body.items[0].tjaCourse,3);assert.equal(charts.body.items.at(-1).type,'double');assert.equal(charts.body.items.at(-1).availability.status,'unknown');
  await ask('public-304','/api/v1/taiko/catalog/songs',{cookie:'',headers:{'if-none-match':pub.res.headers.get('etag')},expected:304});
  await ask('public-meta','/api/v1/taiko/meta',{cookie:''});
  await ask('anonymous-private',scores(fake),{cookie:'',expected:401});
  await ask('developer-owner-without-grant',scores(fake),{token:keyX,expected:403});
  await ask('key-cannot-consent','/api/account/developer/grants',{method:'POST',body:issue,token:keyX,expected:401});
  await ask('cross-owner-cannot-consent','/api/account/developer/grants',{method:'POST',body:issue,cookie:cookieB,expected:403});
  await ask('consent-required','/api/account/developer/grants',{method:'POST',body:{...issue,consent:false},expected:400});
  await ask('history-scope-not-open','/api/account/developer/grants',{method:'POST',body:{...issue,scopes:['history:read']},expected:400});
  await ask('wrong-request-audience','/api/account/developer/grants',{method:'POST',body:{...issue,audience:'other'},expected:400});
  await ask('csrf-denied','/api/account/developer/grants',{method:'POST',body:issue,headers:{origin:'https://untrusted.example.test'},expected:403});
  let grant=(await ask('owner-consents-A1-X-scores','/api/account/developer/grants',{method:'POST',body:issue})).body.grant;
  assert.equal(validate('ResourceGrant')(grant),true);const player=grant.playerId;
  const {createDeveloperApi,DeveloperApiError}=await import('../lib/developer-api-v1.ts');const sdk=createDeveloperApi({baseUrl:c.baseUrl,key:keyX,fetcher:nativeFetch});
  const sdkScores=await sdk.scores(player);assert.equal(sdkScores.data.items[0].score,900000);observations.push({case:'typescript-sdk-read',status:200,expected:200});
  const first=await ask('grant-reads-scores-A1',scores(player),{token:keyX,schemaName:'DeveloperScoresResponse'});const etag=first.res.headers.get('etag');assert.equal(first.body.items[0].combo,null);assert.equal(first.body.items[0].capturedAt,base._meta.ts);assert.equal(first.body.items[0].highscoreAt,'upstream text');assert.equal(first.body.items[0].chart.level,9);
  await ask('authorized-private-304',scores(player),{token:keyX,headers:{'if-none-match':etag},expected:304});
  await ask('wrong-client-Y',scores(player),{token:keyY,expected:403});
  await ask('scope-profile-denied',profile(player),{token:keyX,expected:403});
  const otherGrant=(await ask('owner-consents-A2-Y','/api/account/developer/grants',{method:'POST',body:{...issue,bindingId:String(a2.insertId),clientId:clientY}})).body.grant;
  const bGrant=(await ask('owner-B-consents-B1-Y','/api/account/developer/grants',{method:'POST',cookie:cookieB,body:{...issue,bindingId:String(b1.insertId),clientId:clientY}})).body.grant;
  await ask('A2-not-granted-to-X',scores(otherGrant.playerId),{token:keyX,expected:403});await ask('B1-not-granted-to-X',scores(bGrant.playerId),{token:keyX,expected:403});
  const independent=(await ask('owner-B-explicitly-grants-client-X','/api/account/developer/grants',{method:'POST',cookie:cookieB,body:{...issue,bindingId:String(b1.insertId),clientId:clientX}})).body.grant;
  await withPublicationLease({...paths,identity:c.taikoId+'2'},async lease=>{await lease.put('current',JSON.stringify({...base,profile:{mydon_name:'Synthetic independent owner'}}));return lease.publish();});
  await ask('client-owner-distinct-from-resource-owner',scores(independent.playerId),{token:keyX,schemaName:'DeveloperScoresResponse'});
  await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?',[c.user]);await c.pool.execute('UPDATE web_taiko_bindings SET is_current=1 WHERE id=?',[a2.insertId]);
  await ask('current-binding-switch-does-not-grant-A2',scores(otherGrant.playerId),{token:keyX,expected:403});await ask('explicit-A1-remains-bound',scores(player),{token:keyX});
  await ask('invalid-key-no-cookie-fallback',scores(player),{token:'invalid-but-well-formed-key',expected:401});await ask('invalid-header-no-cookie-fallback',scores(player),{headers:{authorization:'Basic invalid'},expected:401});
  await ask('session-no-authorization-fallback','/api/account/developer/grants',{headers:{authorization:'invalid'},expected:401});
  await ask('unknown-query-owner-override',scores(player)+'?ownerUserId='+userB,{token:keyX,expected:400});
  await ask('path-like-player',scores('..%2Fuserdata'),{token:keyX,expected:403});
  async function change(sql,args,caseName,expected=403){await c.pool.execute(sql,args);await ask(caseName,scores(player),{token:keyX,headers:{'if-none-match':etag},expected});}
  await change('UPDATE web_developer_resource_grants SET audience=\'other\' WHERE grant_id=?',[grant.grantId],'stored-wrong-audience');await c.pool.execute('UPDATE web_developer_resource_grants SET audience=? WHERE grant_id=?',[issue.audience,grant.grantId]);
  await change('UPDATE web_developer_resource_grants SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE grant_id=?',[grant.grantId],'expired-grant-no-304');await c.pool.execute('UPDATE web_developer_resource_grants SET expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 DAY) WHERE grant_id=?',[grant.grantId]);
  await change('UPDATE web_taiko_bindings SET user_id=? WHERE id=?',[userB,c.bindingId],'binding-owner-replaced');await c.pool.execute('UPDATE web_taiko_bindings SET user_id=? WHERE id=?',[c.user,c.bindingId]);
  await change('UPDATE web_taiko_bindings SET source=\'hiroba\' WHERE id=?',[c.bindingId],'binding-source-replaced');await c.pool.execute('UPDATE web_taiko_bindings SET source=\'wahlap\' WHERE id=?',[c.bindingId]);
  await change('UPDATE web_user_accounts SET email_verified=0 WHERE id=?',[c.user],'owner-account-unverified',401);await c.pool.execute('UPDATE web_user_accounts SET email_verified=1 WHERE id=?',[c.user]);
  await change('UPDATE web_developer_api_clients SET status=\'disabled\' WHERE client_id=?',[clientX],'disabled-client',401);await c.pool.execute('UPDATE web_developer_api_clients SET status=\'active\' WHERE client_id=?',[clientX]);
  await change('UPDATE web_developer_applications SET status=\'rejected\' WHERE id=?',[appX],'revoked-application',401);await c.pool.execute('UPDATE web_developer_applications SET status=\'approved\' WHERE id=?',[appX]);
  const rotated=randomBytes(24).toString('hex');await c.pool.execute('UPDATE web_developer_tokens SET status=\'revoked\',revoked_at=UTC_TIMESTAMP() WHERE token_hash=?',[digest(keyX)]);await ask('old-rotated-token-denied',scores(player),{token:keyX,expected:401});
  await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[c.user,appX,digest(rotated),'synthetic']);
  await ask('new-token-same-client-same-grant',scores(player),{token:rotated});await ask('rotated-token-no-extra-scope',profile(player),{token:rotated,expected:403});
  // Restore original key for remaining scenarios without changing stable client or grant.
  await c.pool.execute('UPDATE web_developer_tokens SET status=\'active\',revoked_at=NULL WHERE token_hash=?',[digest(keyX)]);
  const after=await publish(910000);const next=await ask('publication-change-same-generation',scores(player),{token:keyX,headers:{'if-none-match':etag},schemaName:'DeveloperScoresResponse'});assert.equal(next.body.items[0].score,910000);assert.equal(next.body.versions.scoreRevision,`publication-v1:${after.sequence}:${after.commitId}`);assert.notEqual(next.res.headers.get('etag'),etag);
  grant=(await ask('owner-adds-profile-scope','/api/account/developer/grants',{method:'POST',body:{...issue,scopes:['scores:read','profile:read']}})).body.grant;
  const prof=await ask('authorized-minimal-profile',profile(player),{token:keyX,schemaName:'DeveloperProfileResponse'});assert.deepEqual(Object.keys(prof.body.profile).sort(),['bindingId','displayName','playerId','source']);
  // A queued native Writer cannot mix a buffered old body with a new revision.
  const dbForWriter=globalThis.__goalSqlRuntime.db,writerExecute=dbForWriter.execute;let writerCount=0,writerTask;
  dbForWriter.execute=async function(sql,args){if(sql.includes('FROM web_developer_resource_grants g JOIN web_taiko_bindings')&&++writerCount===2)writerTask=publish(920000);return writerExecute.call(this,sql,args);};
  try{const stable=await ask('concurrent-writer-pinned-old-generation',scores(player),{token:keyX});assert.equal(stable.body.items[0].score,910000);assert.equal(stable.body.versions.scoreRevision,`publication-v1:${after.sequence}:${after.commitId}`);}finally{dbForWriter.execute=writerExecute;await writerTask;}
  const current=await ask('concurrent-writer-new-generation',scores(player),{token:keyX});assert.equal(current.body.items[0].score,920000);
  // Revoke through real HTTP while a Writer is queued, before final authority SQL.

  const db=globalThis.__goalSqlRuntime.db,native=db.execute;let count=0,revokedWriter;
  db.execute=async function(sql,args){if(sql.includes('FROM web_developer_resource_grants g JOIN web_taiko_bindings')){count++;if(count===2)revokedWriter=publish(930000);if(count===3)await ask('concurrent-owner-revocation','/api/account/developer/grants/'+grant.grantId,{method:'DELETE'});}return native.call(this,sql,args);};
  try{await ask('in-flight-revoke-refuses-response',scores(player),{token:keyX,expected:403});}finally{db.execute=native;await revokedWriter;}
  await assert.rejects(sdk.scores(player,etag),error=>error instanceof DeveloperApiError&&error.status===403&&!('data' in error));observations.push({case:'typescript-sdk-revoked-no-cache',status:403,expected:403});
  await ask('revoked-grant-old-etag-no-304',scores(player),{token:keyX,headers:{'if-none-match':next.res.headers.get('etag')},expected:403});
  grant=(await ask('reconsent-after-revoke','/api/account/developer/grants',{method:'POST',body:issue})).body.grant;
  let tokenProofs=0;const tokenDb=globalThis.__goalSqlRuntime.db,tokenExecute=tokenDb.execute;
  tokenDb.execute=async function(sql,args){if(sql.includes('FROM web_developer_resource_grants g JOIN web_taiko_bindings')&&++tokenProofs===3)await c.pool.execute("UPDATE web_developer_tokens SET status='revoked',revoked_at=UTC_TIMESTAMP() WHERE token_hash=?",[digest(keyX)]);return tokenExecute.call(this,sql,args);};
  try{await ask('in-flight-token-revocation',scores(player),{token:keyX,expected:403});}finally{tokenDb.execute=tokenExecute;await c.pool.execute("UPDATE web_developer_tokens SET status='active',revoked_at=NULL WHERE token_hash=?",[digest(keyX)]);}
  const [saved]=await c.pool.query('SELECT * FROM web_taiko_bindings WHERE id=?',[c.bindingId]);await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);await ask('unbound-no-304',scores(player),{token:keyX,headers:{'if-none-match':etag},expected:403});await c.pool.query('INSERT INTO web_taiko_bindings SET ?',saved[0]);
  const [[manualBinding]]=await c.pool.query('SELECT id FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?',[c.user,c.manualId]);
  const manualGrant=(await ask('manual-owner-consent','/api/account/developer/grants',{method:'POST',body:{...issue,bindingId:String(manualBinding.id),scopes:['profile:read','scores:read']}})).body.grant;
  await ask('manual-profile-read',profile(manualGrant.playerId),{token:keyX,schemaName:'DeveloperProfileResponse'});await ask('manual-scores-read',scores(manualGrant.playerId),{token:keyX,schemaName:'DeveloperScoresResponse'});
  const hirobaId=c.taikoId+'3';const [hirobaBinding]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'hiroba','Synthetic Hiroba',0)",[c.user,hirobaId]);
  await withPublicationLease({...paths,identity:hirobaId},async lease=>{await lease.put('current',JSON.stringify({...base,_meta:{...base._meta,source:'hiroba'}}));return lease.publish();});
  const hirobaGrant=(await ask('hiroba-owner-consent','/api/account/developer/grants',{method:'POST',body:{...issue,bindingId:String(hirobaBinding.insertId),scopes:['profile:read','scores:read']}})).body.grant;
  const hirobaScores=await ask('hiroba-scores-read',scores(hirobaGrant.playerId),{token:keyX,schemaName:'DeveloperScoresResponse'});assert.equal(hirobaScores.body.items[0].source,'hiroba');await ask('hiroba-profile-read',profile(hirobaGrant.playerId),{token:keyX,schemaName:'DeveloperProfileResponse'});
  c.config.developerApiClientDailyLimit=2;await c.pool.execute("DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=? AND api_name='developer-api-v1'",['v1:client:'+clientX]);
  const burst=await Promise.all(Array.from({length:5},(_,i)=>ask('atomic-quota-'+i,scores(player),{token:keyX,expected:[200,429]}).catch(e=>e)));
  // Requests are concurrent: assert aggregate accepted/capped counts, not launch order.
  const burstRows=observations.filter(x=>x.case.startsWith('atomic-quota-'));assert.equal(burstRows.filter(x=>x.status===200).length,2);assert.equal(burstRows.filter(x=>x.status===429).length,3);assert.equal(burst.filter(x=>!(x instanceof Error)).length,5);
  c.config.developerApiClientDailyLimit=5000;
  const {consentBrowser}=await import('./fixtures/developerApiV1Ui.mjs');await consentBrowser(c,{clientId:clientX,bindingId,key:keyX,ask});
  await ask('cross-owner-client-disable-denied','/api/account/developer/clients/'+clientY,{method:'DELETE',expected:403});
  await ask('owner-disables-client','/api/account/developer/clients/'+clientY,{method:'DELETE',cookie:cookieB});
  await ask('disabled-client-key-read-denied',scores(otherGrant.playerId),{token:keyY,expected:401});
  await ask('legacy-session-profile','/profile');
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'developer-api-v1-observations.json'),JSON.stringify({status:'PASS_SCOPED',database:proof.name,datadir:proof.datadir,cases:observations,productionAccess:false,installedPython:process.env.TAIKO_PYTHON_EXECUTABLE},null,2)+'\n');
 }finally{
  c.state.afterExecute=null;await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[userB]);await c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[userB]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[userB]);
 }
},{withDeveloper:true,requestTimeoutMs:30000}));
