import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
const nativeFetch=globalThis.fetch;
async function ddl(c,table){const source=await readFile(new URL('../server/utils/account-db.ts',import.meta.url),'utf8');let value;function visit(n){if(ts.isNoSubstitutionTemplateLiteral(n)&&n.text.startsWith('CREATE TABLE IF NOT EXISTS '+table+' ('))value=n.text;ts.forEachChild(n,visit);}visit(ts.createSourceFile('db.ts',source,ts.ScriptTarget.Latest,true));assert.ok(value);await c.pool.execute(value);}
test('Freeze review bounded HTTP, lifecycle, SDK and owner list completeness',{timeout:180000},()=>accountSourceFixture(async c=>{
 c.state.expectedSourceMode='none';Object.assign(c.config,{developerApiV1:true,developerApiAnonymousDailyLimit:300,developerApiClientDailyLimit:5000,repoRoot:c.root,public:{}});
 await ddl(c,'web_developer_applications');execFileSync(process.execPath,['--experimental-strip-types',new URL('../scripts/migrate_developer_api_v1.ts',import.meta.url).pathname,'--apply'],{env:process.env,timeout:30000,maxBuffer:32768});
 const [[proof]]=await c.pool.query('SELECT DATABASE() name,@@datadir datadir');assert.ok(proof.name.endsWith('_test'));assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const rows=[{id:1,song_name:'Synthetic',level_4:9}],path=resolve(c.root,'catalog.json');c.config.songDataPath=path;await writeFile(path,JSON.stringify(rows));
 for(const [m,p,f] of [['get','/api/v1/taiko/meta','v1/taiko/meta.get.ts'],['get','/api/v1/taiko/catalog/songs','v1/taiko/catalog/songs.get.ts'],['get','/api/v1/taiko/players/:playerId/scores','v1/taiko/players/[playerId]/scores.get.ts'],['get','/api/account/developer/grants','account/developer/grants/index.get.ts'],['post','/api/account/developer/grants','account/developer/grants/index.post.ts'],['delete','/api/account/developer/grants/:grantId','account/developer/grants/[grantId].delete.ts'],['get','/api/account/developer/clients','account/developer/clients/index.get.ts'],['post','/api/account/developer/clients','account/developer/clients/index.post.ts']])c.route(m,p,(await import('../server/api/'+f)).default);
 const observations=[];
 async function ask(name,url,{method='GET',body,token,expected=200,code,etag}={}){const r=await c.request(method,url,body,c.cookie,{origin:c.baseUrl,...(token?{authorization:'Bearer '+token}:{}),...(etag?{'if-none-match':etag}:{})});const data=await r.json();assert.equal(r.status,expected,name);if(code){assert.equal(data.code,code,name);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('etag'),null);assert.equal('items' in data,false);}observations.push({name,status:r.status,code:data.code||null});return {data,etag:r.headers.get('etag')};}
 c.config.developerApiV1=false;await ask('disabled-not-frozen','/api/v1/taiko/meta',{expected:404,code:'NOT_FOUND'});c.config.developerApiV1=true;
 const meta=await ask('frozen-lifecycle','/api/v1/taiko/meta');assert.equal(meta.data.status,'CONTRACT_FROZEN');assert.equal(meta.data.contractFrozen,true);assert.equal(meta.data.runtimeEnabled,true);
 const pub=await ask('catalog-small','/api/v1/taiko/catalog/songs');
 await writeFile(path,JSON.stringify(Array.from({length:10000},(_,i)=>({id:i+1}))));const max=await ask('catalog-10000-complete','/api/v1/taiko/catalog/songs');assert.equal(max.data.items.length,10000);
 await writeFile(path,JSON.stringify(Array.from({length:10001},(_,i)=>({id:i+1}))));await ask('catalog-10001-refused','/api/v1/taiko/catalog/songs',{expected:503,code:'CATALOG_LIMIT_EXCEEDED',etag:pub.etag});
 await writeFile(path,' '.repeat(8*1024*1024+1));await ask('catalog-bytes-refused','/api/v1/taiko/catalog/songs',{expected:503,code:'CATALOG_LIMIT_EXCEEDED'});await writeFile(path,JSON.stringify(rows));
 const [app]=await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'synthetic@example.test','isolated review','approved')",[c.user]);const key=randomBytes(24).toString('hex');await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[c.user,app.insertId,createHash('sha256').update(key).digest('hex'),'synthetic']);
 const client=(await ask('register','/api/account/developer/clients',{method:'POST',body:{displayName:'Review synthetic'}})).data.client;
 const grant=(await ask('consent','/api/account/developer/grants',{method:'POST',body:{bindingId:String(c.bindingId),clientId:client.clientId,scopes:['scores:read'],expiresInDays:7,consent:true,consentVersion:'viewer-resource-consent-v1',audience:'viewer:developer-api:v1'}})).data.grant;
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 async function publish(count,text=''){await withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity:c.taikoId,mode:'write'},async lease=>{await lease.put('current',JSON.stringify({_meta:{source:'wahlap',ts:'2026-10-16T00:00:00Z'},profile:{mydon_name:'Review'},songs:Array.from({length:count},()=>({song_no:1,level:4,high_score:1,highscore_datetime:text}))}));await lease.publish();});}
 const url='/api/v1/taiko/players/'+grant.playerId+'/scores';await publish(1);const good=await ask('small-scores',url,{token:key});
 await publish(20001);await ask('scores-20001-refused',url,{token:key,expected:503,code:'SCORES_LIMIT_EXCEEDED',etag:good.etag});
 await publish(20000);await ask('scores-20000-response-bytes-refused',url,{token:key,expected:503,code:'RESPONSE_LIMIT_EXCEEDED',etag:good.etag});
 await publish(4000,'x'.repeat(2048));await ask('scores-under-count-over-bytes',url,{token:key,expected:503,code:'RESPONSE_LIMIT_EXCEEDED',etag:good.etag});
 const {createDeveloperApi,DeveloperApiError}=await import('../lib/developer-api-v1.ts');const sdk=createDeveloperApi({baseUrl:c.baseUrl,key,fetcher:nativeFetch});await assert.rejects(sdk.scores(grant.playerId,good.etag),e=>e instanceof DeveloperApiError&&e.code==='RESPONSE_LIMIT_EXCEEDED'&&e.status===503&&!('data' in e));observations.push({name:'sdk-explicit-limit-no-cache',status:503,code:'RESPONSE_LIMIT_EXCEEDED'});
 await ask('revoke','/api/account/developer/grants/'+grant.grantId,{method:'DELETE'});await ask('revoked-before-oversize-and-304',url,{token:key,expected:403,code:'GRANT_REQUIRED',etag:good.etag});
 // Each capped list is independently marked; no fabricated pagination or total count.
 let list=(await ask('owner-list-small','/api/account/developer/grants')).data;assert.deepEqual(list.hasMore,{clients:false,bindings:false,grants:false});
 const values=Array.from({length:100},(_,i)=>[c.user,c.taikoId+String(i+100),'wahlap','Synthetic extra',0]);await c.pool.query('INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,is_current) VALUES ?',[values]);
 list=(await ask('owner-list-101-bindings','/api/account/developer/grants')).data;assert.equal(list.bindings.length,100);assert.equal(list.hasMore.bindings,true);
 // SQL creates synthetic applications/clients only; exercise 101-row lookahead for clients.
 for(let i=0;i<100;i++){const [a]=await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'synthetic@example.test','review','approved')",[c.user]);await c.pool.execute('INSERT INTO web_developer_api_clients(client_id,application_id,owner_user_id,display_name) VALUES (?,?,?,?)',['clt_'+randomBytes(16).toString('hex'),a.insertId,c.user,'Synthetic']);}
 const [clientRows]=await c.pool.query('SELECT client_id FROM web_developer_api_clients WHERE client_id<>?',[client.clientId]);
 for(const row of clientRows)await c.pool.execute(`INSERT INTO web_developer_resource_grants(grant_id,revision,owner_user_id,binding_id,player_id,client_id,audience,taiko_id,source,manual_account_id,scopes_json,consent_version,consented_at,issued_at,expires_at)
 SELECT ?,?,owner_user_id,binding_id,player_id,?,audience,taiko_id,source,manual_account_id,scopes_json,consent_version,consented_at,issued_at,expires_at FROM web_developer_resource_grants WHERE grant_id=?`,[randomBytes(16).toString('hex'),randomBytes(16).toString('hex'),row.client_id,grant.grantId]);
 const capped=(await ask('owner-grants-101','/api/account/developer/grants')).data;assert.equal(capped.grants.length,100);assert.equal(capped.hasMore.grants,true);
 const own=(await ask('own-clients-101','/api/account/developer/clients')).data;assert.equal(own.clients.length,100);assert.equal(own.hasMore,true);list=(await ask('available-clients-101','/api/account/developer/grants')).data;assert.equal(list.hasMore.clients,true);assert.equal(list.clients.length,100);
 // Actual component regression reuses the existing bounded browser host, no full Nuxt/Annual startup.
 // Boundary checks above suffice for the list change; UI compile is checked by the build.
 await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'freeze-review-observations.json'),JSON.stringify({status:'PASS_SCOPED',databaseProof:proof,observations,productionAccess:false},null,2)+'\n');
},{withDeveloper:true,requestTimeoutMs:30000}));
