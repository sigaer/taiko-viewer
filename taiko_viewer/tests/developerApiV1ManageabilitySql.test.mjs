import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
import Ajv from 'ajv';
import YAML from 'yaml';
import {accountSourceFixture,deferred,bounded} from './fixtures/accountSourceHttp.mjs';
async function ddl(c,table){const source=await readFile(new URL('../server/utils/account-schema-definition.ts',import.meta.url),'utf8');let text;function visit(n){if(ts.isNoSubstitutionTemplateLiteral(n)&&n.text.startsWith('CREATE TABLE IF NOT EXISTS '+table+' ('))text=n.text;ts.forEachChild(n,visit);}visit(ts.createSourceFile('db.ts',source,ts.ScriptTarget.Latest,true));assert.ok(text);await c.pool.execute(text);}
const uuid=()=>randomBytes(16).toString('hex'),hash=x=>createHash('sha256').update(x).digest('hex');
test('F3 manageability owner pagination, reachability and consent-disable concurrency',{timeout:180000},()=>accountSourceFixture(async c=>{
 c.state.expectedSourceMode='none';Object.assign(c.config,{developerApiV1:true,developerApiAnonymousDailyLimit:300,developerApiClientDailyLimit:5000,repoRoot:c.root,public:{}});
 await ddl(c,'web_developer_applications');execFileSync(process.execPath,['--experimental-strip-types',new URL('../scripts/migrate_developer_api_v1.ts',import.meta.url).pathname,'--apply'],{env:process.env,timeout:30000,maxBuffer:32768});
 const [[proof]]=await c.pool.query('SELECT DATABASE() name,@@datadir datadir');assert.ok(proof.name.endsWith('_test'));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 c.config.songDataPath=resolve(c.root,'catalog.json');await writeFile(c.config.songDataPath,JSON.stringify([{id:100,song_name:'Synthetic',level_4:9}]));
 for(const [m,p,f] of [['get','/api/v1/taiko/players/:playerId/scores','v1/taiko/players/[playerId]/scores.get.ts'],['get','/api/account/developer/grants','account/developer/grants/index.get.ts'],['post','/api/account/developer/grants','account/developer/grants/index.post.ts'],['delete','/api/account/developer/grants/:grantId','account/developer/grants/[grantId].delete.ts'],['get','/api/account/developer/clients','account/developer/clients/index.get.ts'],['post','/api/account/developer/clients','account/developer/clients/index.post.ts'],['delete','/api/account/developer/clients/:clientId','account/developer/clients/[clientId].delete.ts']])c.route(m,p,(await import('../server/api/'+f)).default);
 const observations=[];
 async function ask(name,path,{method='GET',body,cookie=c.cookie,expected=200,key,etag,headers={}}={}){const r=await c.request(method,path,body,cookie,{origin:c.baseUrl,...(key?{authorization:'Bearer '+key}:{}),...(etag?{'if-none-match':etag}:{}),...headers});const data=await r.json();assert.ok((Array.isArray(expected)?expected:[expected]).includes(r.status),name+' expected HTTP status');assert.equal(r.headers.get('cache-control'),'private, no-store');if(r.status>=400){assert.deepEqual(Object.keys(data).sort(),['code','message','requestId']);assert.equal(r.headers.get('etag'),null);}const observed={case:name,status:r.status,code:data.code||null};observations.push(observed);console.log(JSON.stringify(observed));return {data,status:r.status,etag:r.headers.get('etag')};}
 async function application(owner){const [a]=await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'synthetic@example.test','isolated manageability','approved')",[owner]);return a.insertId;}
 const app=await application(c.user),key=randomBytes(24).toString('hex');await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[c.user,app,hash(key),'synthetic']);
 const client=(await ask('register-original-client','/api/account/developer/clients',{method:'POST',body:{displayName:'Synthetic old client'}})).data.client;
 const issue={bindingId:String(c.bindingId),clientId:client.clientId,scopes:['scores:read'],expiresInDays:7,consent:true,consentVersion:'viewer-resource-consent-v1',audience:'viewer:developer-api:v1'};
 const original=(await ask('original-valid-consent','/api/account/developer/grants',{method:'POST',body:issue})).data.grant;
 await c.pool.execute('UPDATE web_developer_resource_grants SET issued_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 60 DAY),consented_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 60 DAY) WHERE grant_id=?',[original.grantId]);
 await c.pool.execute('UPDATE web_developer_api_clients SET created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 60 DAY) WHERE client_id=?',[client.clientId]);
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');await withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity:c.taikoId,mode:'write'},async lease=>{await lease.put('current',JSON.stringify({_meta:{source:'wahlap',ts:'2026-10-16T00:00:00Z'},profile:{mydon_name:'Synthetic'},songs:[{song_no:100,level:4,high_score:900000}]}));await lease.publish();});
 const scorePath='/api/v1/taiko/players/'+original.playerId+'/scores';const live=await ask('early-valid-grant-before-pagination',scorePath,{key});
 // 100 revoked + 100 expired + 105 live, with all ordering timestamps tied.
 // Distinct IDs exercise stable tie breaking; original active grant/client is older than all of them.
 const grantIds=new Set([original.grantId]),clientIds=new Set([client.clientId]);
 for(let i=0;i<305;i++){
  const appId=await application(c.user),clientId='clt_'+uuid(),grantId=uuid();clientIds.add(clientId);grantIds.add(grantId);
  await c.pool.execute('INSERT INTO web_developer_api_clients(client_id,application_id,owner_user_id,display_name,created_at) VALUES (?,?,?,?,\'2026-10-15 00:00:00.000\')',[clientId,appId,c.user,'Synthetic '+i]);
  const revoked=i<100?'2026-10-15 01:00:00.000':null,expires=i>=100&&i<200?'2026-10-15 02:00:00.000':original.expiresAt.slice(0,23).replace('T',' ');
  await c.pool.execute(`INSERT INTO web_developer_resource_grants(grant_id,revision,owner_user_id,binding_id,player_id,client_id,audience,taiko_id,source,manual_account_id,scopes_json,consent_version,consented_at,issued_at,expires_at,revoked_at)
  SELECT ?,?,owner_user_id,binding_id,player_id,?,audience,taiko_id,source,manual_account_id,scopes_json,consent_version,'2026-10-15 00:00:00.000','2026-10-15 00:00:00.000',?,? FROM web_developer_resource_grants WHERE grant_id=?`,[grantId,uuid(),clientId,expires,revoked,original.grantId]);
 }
 const schema=JSON.parse(await readFile(new URL('../../packages/sakura-taiko-contract/schema/contract-v1.json',import.meta.url),'utf8')),doc=YAML.parse(await readFile(new URL('../../docs/083-developer-api-openapi.yaml',import.meta.url),'utf8'));
 const ajv=new Ajv({strict:false,allowUnionTypes:true});ajv.addSchema(schema);
 function refs(v){if(Array.isArray(v))return v.map(refs);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='$ref'&&x.startsWith('../packages/')?schema.$id+x.slice(x.indexOf('#')):refs(x)]));return v;}
 async function allPages(path,field,idKey,expectedIds){let before=null,pages=0;const seen=new Set();do{
  const result=(await ask(field+'-page-'+pages,path+(before?'?before='+before:''))).data;assert.equal(ajv.compile(refs(doc.paths[path].get.responses['200'].content['application/json'].schema))(result),true,'OpenAPI owner list golden');assert.ok(result[field].length<=100);
  const hasMore=field==='grants'?result.hasMore.grants:result.hasMore;assert.equal(Boolean(result.nextCursor),hasMore);if(hasMore)assert.equal(result.nextCursor,result[field].at(-1)[idKey]);
  if(!pages){assert.equal(result[field].length,100);assert.ok(!result[field].some(x=>x[idKey]===(field==='grants'?original.grantId:client.clientId)));}
  for(const row of result[field]){assert.equal(seen.has(row[idKey]),false,'No duplicate across equal-time pages');seen.add(row[idKey]);}before=result.nextCursor;pages++;assert.ok(pages<=4);
 }while(before);assert.equal(seen.size,expectedIds.size);for(const id of expectedIds)assert.ok(seen.has(id));return pages;}
 const grantPages=await allPages('/api/account/developer/grants','grants','grantId',grantIds),clientPages=await allPages('/api/account/developer/clients','clients','clientId',clientIds);assert.equal(grantPages,4);assert.equal(clientPages,4);
 const [u]=await c.pool.execute("INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES ('manage-b','manage-b@example.test',?,1)",[await c.shared.getPasswordHash('synthetic-password')]);const other=u.insertId;
 try{
  const login=await c.request('POST','/login',{identifier:'manage-b',password:'synthetic-password'},'');assert.equal(login.status,200);const cookieB=login.headers.get('set-cookie').split(';')[0];
  await ask('foreign-cursor-grant','/api/account/developer/grants?before='+original.grantId,{cookie:cookieB,expected:400});await ask('foreign-cursor-client','/api/account/developer/clients?before='+client.clientId,{cookie:cookieB,expected:400});
  await ask('cross-owner-revoke-denied','/api/account/developer/grants/'+original.grantId,{method:'DELETE',cookie:cookieB,expected:403});await ask('cross-owner-disable-denied','/api/account/developer/clients/'+client.clientId,{method:'DELETE',cookie:cookieB,expected:403});
  await ask('bad-cursor','/api/account/developer/grants?before=bad',{expected:400});await ask('unknown-owner-query','/api/account/developer/grants?ownerUserId='+other,{expected:400});await ask('anonymous-pagination','/api/account/developer/grants?before='+original.grantId,{cookie:'',expected:401});await ask('key-cannot-page-as-owner','/api/account/developer/grants?before='+original.grantId,{key,expected:401});
  // Five concurrent new tuples, page bound remains 100. No active-count cap was chosen.
  const bodies=[];for(let i=0;i<5;i++){const [b]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES (?,?,'wahlap','Synthetic concurrent',0)",[c.user,c.taikoId+String(i+1)]);bodies.push({...issue,bindingId:String(b.insertId)});}
  await Promise.all(bodies.map((body,i)=>ask('concurrent-consent-'+i,'/api/account/developer/grants',{method:'POST',body})));const concurrent=(await ask('concurrent-count-page-bound','/api/account/developer/grants')).data;assert.equal(concurrent.grants.length,100);assert.equal(concurrent.hasMore.grants,true);
  const [[count]]=await c.pool.query('SELECT COUNT(*) n FROM web_developer_resource_grants WHERE owner_user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(3)',[c.user]);assert.ok(count.n>100);
  // Real component pages to the old active grant and revokes it, then pages to the old client.
  let raceOverlap=false;
  function raceConsent(){const release=deferred(),ready=deferred();let held=false;
   c.state.beforeSqlCommit=async()=>{if(!held){held=true;ready.resolve();await bounded(release.promise);}};
   c.state.beforeSqlStatement=async sql=>{if(held&&sql.includes('web_user_sessions')&&sql.includes('FOR UPDATE')){raceOverlap=true;release.resolve();}};
   const task=ask('reconsent-races-ui-disable','/api/account/developer/grants',{method:'POST',body:issue,expected:[200,403]});task.catch(()=>{});
   const done=task.finally(()=>{release.resolve();c.state.beforeSqlCommit=null;c.state.beforeSqlStatement=null;});done.catch(()=>{});return {task:done,ready:bounded(ready.promise),release:()=>release.resolve()};
  }
  const {managementBrowser}=await import('./fixtures/developerApiV1ManageabilityUi.mjs');await managementBrowser(c,{grantId:original.grantId,clientId:client.clientId,raceConsent});assert.equal(raceOverlap,true,'Real overlapping owner-lock race');
  // The UI revoke was real before reconsent; its old grant ID is gone or retained revoked.
  await ask('disabled-client-old-etag-not-304',scorePath,{key,etag:live.etag,expected:401});await ask('disabled-client-reconsent-denied','/api/account/developer/grants',{method:'POST',body:issue,expected:403});
  // Make the original app the only approved app: registration must never reactivate its client.
  await c.pool.execute("UPDATE web_developer_applications SET status='rejected' WHERE user_id=? AND id<>?",[c.user,app]);const retained=(await ask('registration-cannot-reactivate','/api/account/developer/clients',{method:'POST',body:{displayName:'ignored replacement'}})).data.client;assert.equal(retained.clientId,client.clientId);assert.equal(retained.status,'disabled');
  // A newly-issued cursor disappears on renewed consent: explicit invalidation, restart allowed.
  // Fixture-only reset for a separate renewed-cursor test; no product reactivation route exists.
  await c.pool.execute("UPDATE web_developer_api_clients SET status='active' WHERE client_id=?",[client.clientId]);const reissued=(await ask('renewed-consent-new-identity','/api/account/developer/grants',{method:'POST',body:issue})).data.grant;assert.notEqual(reissued.grantId,original.grantId);await ask('renewed-away-cursor-explicit-error','/api/account/developer/grants?before='+original.grantId,{expected:400});
  const renewed=await ask('renewed-grant-reads',scorePath,{key});await ask('owner-revokes-renewed-grant','/api/account/developer/grants/'+reissued.grantId,{method:'DELETE'});await ask('revoked-old-etag-no-304',scorePath,{key,etag:renewed.etag,expected:403});
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'f3-manageability-observations.json'),JSON.stringify({status:'PASS_SCOPED',databaseProof:proof,observations,pagination:{grantRows:306,clientRows:306,grantPages,clientPages,pageSize:100,lookahead:101,equalTimestampNoDuplicates:true},concurrency:{activeCountCap:'NOT_APPLICABLE_OWNER_PAGINATION_SELECTED',activeRowsOver100:true,pageBoundEnforced:true,realConsentDisableOverlap:raceOverlap},contractFrozen:false,productionAccess:false},null,2)+'\n');
 }finally{c.state.beforeSqlStatement=null;c.state.beforeSqlCommit=null;await c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[other]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[other]);}
},{withDeveloper:true,requestTimeoutMs:30000}));
