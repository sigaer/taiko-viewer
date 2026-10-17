import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
const nativeFetch=globalThis.fetch;
test('RC4 schema dryrun idempotence indexes disabled revoke and synthetic restore',{timeout:120000},()=>accountSourceFixture(async c=>{
 const {createDeveloperApi,DeveloperApiError}=await import('../lib/developer-api-v1.ts');
 c.state.expectedSourceMode='none';Object.assign(c.config,{developerApiV1:true,developerApiAnonymousDailyLimit:300,developerApiClientDailyLimit:5000,repoRoot:c.root,public:{}});
 const source=await readFile(new URL('../server/utils/account-schema-definition.ts',import.meta.url),'utf8');let ddl;function visit(n){if(ts.isNoSubstitutionTemplateLiteral(n)&&n.text.startsWith('CREATE TABLE IF NOT EXISTS web_developer_applications ('))ddl=n.text;ts.forEachChild(n,visit);}visit(ts.createSourceFile('db.ts',source,ts.ScriptTarget.Latest,true));assert.ok(ddl);await c.pool.execute(ddl);
 execFileSync(process.execPath,['--experimental-strip-types',new URL('../scripts/migrate_developer_api_v1.ts',import.meta.url).pathname,'--apply'],{env:process.env,timeout:30000,maxBuffer:32768});
 const migration=new URL('../scripts/migrate_developer_api_v1.ts',import.meta.url).pathname;
 const dryrun=execFileSync(process.execPath,['--experimental-strip-types',migration],{env:process.env,timeout:10000,maxBuffer:32768}).toString();assert.equal((dryrun.match(/CREATE TABLE IF NOT EXISTS/g)||[]).length,4);
 const tables=['web_developer_api_clients','web_developer_api_resources','web_developer_resource_grants','web_developer_resource_grant_events'];
 async function schema(){const result=[];for(const table of tables){const [[row]]=await c.pool.query('SHOW CREATE TABLE '+table);result.push({table,ddl:row['Create Table']});}return result;}
 const before=await schema();execFileSync(process.execPath,['--experimental-strip-types',migration,'--apply'],{env:process.env,timeout:30000,maxBuffer:32768});assert.deepEqual(await schema(),before);
 const indexes=[];for(const table of tables){const [rows]=await c.pool.query('SHOW INDEX FROM '+table);for(const r of rows)indexes.push({table,name:r.Key_name,sequence:r.Seq_in_index,column:r.Column_name,unique:r.Non_unique===0});}
 assert.deepEqual(indexes.filter(x=>x.name==='idx_api_client_owner_page').sort((a,b)=>a.sequence-b.sequence).map(x=>x.column),['owner_user_id','created_at','client_id']);
 assert.deepEqual(indexes.filter(x=>x.name==='idx_api_grant_owner_page').sort((a,b)=>a.sequence-b.sequence).map(x=>x.column),['owner_user_id','issued_at','grant_id']);
 const [[proof]]=await c.pool.query('SELECT DATABASE() name,@@datadir datadir');assert.match(proof.name,/_test$/);assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 c.config.songDataPath=resolve(c.root,'catalog.json');await writeFile(c.config.songDataPath,JSON.stringify([{id:100,song_name:'Synthetic',level_4:9}]));
 for(const [m,p,f] of [['get','/api/v1/taiko/meta','v1/taiko/meta.get.ts'],['get','/api/v1/taiko/players/:playerId/scores','v1/taiko/players/[playerId]/scores.get.ts'],['get','/api/account/developer/grants','account/developer/grants/index.get.ts'],['post','/api/account/developer/grants','account/developer/grants/index.post.ts'],['delete','/api/account/developer/grants/:grantId','account/developer/grants/[grantId].delete.ts'],['post','/api/account/developer/clients','account/developer/clients/index.post.ts'],['delete','/api/account/developer/clients/:clientId','account/developer/clients/[clientId].delete.ts']])c.route(m,p,(await import('../server/api/'+f)).default);
 const observations=[];async function ask(name,path,method='GET',body){const r=await c.request(method,path,body,c.cookie,{origin:c.baseUrl});const data=await r.json();assert.equal(r.status,200,name);observations.push({name,status:r.status});return data;}
 const sdk=createDeveloperApi({baseUrl:c.baseUrl,fetcher:nativeFetch});const meta=(await sdk.meta()).data;assert.equal(meta.status,'CONTRACT_FROZEN');assert.equal(meta.contractFrozen,true);assert.equal(meta.runtimeEnabled,true);observations.push({name:'sdk-frozen-meta',status:200});
 c.config.developerApiV1=false;await assert.rejects(sdk.meta(),e=>e instanceof DeveloperApiError&&e.status===404);observations.push({name:'frozen-does-not-enable-runtime',status:404});c.config.developerApiV1=true;
 const [a]=await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'synthetic@example.test','local lifecycle','approved')",[c.user]);const key=randomBytes(24).toString('hex');await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[c.user,a.insertId,createHash('sha256').update(key).digest('hex'),'synthetic']);
 const client=(await ask('register-client','/api/account/developer/clients','POST',{displayName:'Local freeze'})).client;
 const grant=(await ask('consent','/api/account/developer/grants','POST',{bindingId:String(c.bindingId),clientId:client.clientId,scopes:['scores:read'],expiresInDays:7,consent:true,consentVersion:'viewer-resource-consent-v1',audience:'viewer:developer-api:v1'})).grant;
 const page=await ask('owner-page','/api/account/developer/grants');assert.equal(page.grants.length,1);assert.equal(page.hasMore.grants,false);assert.equal(page.nextCursor,null);
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');await withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity:c.taikoId,mode:'write'},async lease=>{await lease.put('current',JSON.stringify({_meta:{source:'wahlap'},songs:[{song_no:100,level:4,high_score:900000}]}));await lease.publish();});
 const privateSdk=createDeveloperApi({baseUrl:c.baseUrl,key,fetcher:nativeFetch});const live=await privateSdk.scores(grant.playerId);assert.equal(live.data.items.length,1);assert.ok(live.etag);observations.push({name:'sdk-authorized-scores',status:200});
 await ask('owner-revoke','/api/account/developer/grants/'+grant.grantId,'DELETE');await assert.rejects(privateSdk.scores(grant.playerId,live.etag),e=>e instanceof DeveloperApiError&&e.status===403);observations.push({name:'sdk-revoked-old-etag-rejected',status:403});
 const response=await c.request('GET','/api/v1/taiko/players/'+grant.playerId+'/scores',undefined,'',{authorization:'Bearer '+key,'if-none-match':live.etag});assert.equal(response.status,403);assert.equal(response.headers.get('etag'),null);assert.equal(response.headers.get('cache-control'),'private, no-store');
 await ask('owner-disables-client','/api/account/developer/clients/'+client.clientId,'DELETE');
 const [[disabled]]=await c.pool.execute('SELECT status FROM web_developer_api_clients WHERE client_id=?',[client.clientId]);assert.equal(disabled.status,'disabled');
 const [[revoked]]=await c.pool.execute('SELECT revoked_at FROM web_developer_resource_grants WHERE grant_id=?',[grant.grantId]);assert.ok(revoked.revoked_at);
 const saved=[];for(const entry of await schema()){const [rows]=await c.pool.query('SELECT * FROM '+entry.table+' ORDER BY 1');assert.ok(rows.length<=10);saved.push({...entry,rows});}
 // Destruction is confined to these four allowlisted tables in this newly owned _test.
 assert.equal(proof.name,process.env.TAIKO_DB_NAME);assert.equal(resolve(proof.datadir),resolve(process.env.TAIKO_TEST_MYSQL_DATADIR));
 for(const entry of saved)await c.pool.execute('DROP TABLE '+entry.table);
 for(const entry of saved){await c.pool.execute(entry.ddl);for(const row of entry.rows){const cols=Object.keys(row);await c.pool.execute('INSERT INTO '+entry.table+' ('+cols.map(k=>'`'+k+'`').join(',')+') VALUES ('+cols.map(()=>'?').join(',')+')',cols.map(k=>row[k]));}}
 for(const entry of saved){const [rows]=await c.pool.query('SELECT * FROM '+entry.table+' ORDER BY 1');assert.deepEqual(rows,entry.rows,entry.table);}
 await assert.rejects(privateSdk.scores(grant.playerId,live.etag),e=>e instanceof DeveloperApiError&&e.status===401);observations.push({name:'restored-disabled-revoked-remains-denied-with-old-etag',status:401});
 await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'schema-recovery-proof.json'),JSON.stringify({dryrunSha256:createHash('sha256').update(dryrun).digest('hex'),schema:await schema(),indexes,idempotent:true,syntheticRestore:true,restoredRows:saved.map(x=>({table:x.table,count:x.rows.length})),realScaleRpoRtoProven:false},null,2)+'\n');
 await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'frozen-lifecycle-observations.json'),JSON.stringify({status:'RERUN_PASS',databaseProof:proof,observations,contractFrozen:true,runtimeDefaultEnabled:false,publicApiEnabled:false,productionAccess:false},null,2)+'\n');
},{withDeveloper:true}));
