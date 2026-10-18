import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import ts from 'typescript';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
import {assertQaPython} from './fixtures/qaPaths.mjs';

test('analysis HTTP uses installed algorithms, captured scores and existing Developer Token authority',{timeout:90000},()=>accountSourceFixture(async c=>{
 assertQaPython();c.config.repoRoot=c.root;c.config.developerGlobalScoresRead=true;
 const fixture=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
 const charts={},catalog=[],rolls=[],records=[];
 for(let i=0;i<80;i++){
  const id=10000+i,title=`Synthetic ${i}`,combo=Number(fixture.chart.combo),good=Math.floor(combo*.96);
  charts[id]={...fixture.chart,id,level:4,title,song_name:title};
  catalog.push({id,song_name:title,song_name_jp:title,level_4:9,shelf_status:0,max_combo:[0,0,0,combo,0]});
  rolls.push({...fixture.roll,id,level:4,title,song_name:title});
  if(i<30)records.push({song_no:id,level:4,good_cnt:good,ok_cnt:combo-good-1,ng_cnt:1,high_score:900000,stage_cnt:1,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0});
 }
 await mkdir(resolve(c.root,'songs'));
 for(const [name,value] of Object.entries({rating_structured_with_ids:{songs:charts,const_table:fixture.const_table},song_data:catalog,song_data_raw:catalog,song_alias:[],song_score:[],taiko_goku_onis:rolls,taiko_goku_all_levels_stream:[]}))await writeFile(resolve(c.root,'songs',name+'.json'),JSON.stringify(value));
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 await withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity:c.taikoId,mode:'write'},async lease=>{
  await lease.put('current',JSON.stringify({profile:{mydon_name:'Synthetic'},songs:records,_meta:{source:'wahlap',ts:'2026-10-18T00:00:00Z'}}));await lease.publish();
 });
 for(const kind of ['rating','recommendations'])c.route('get','/api/developer/userdata/:userid/'+kind,(await import('../server/api/developer/userdata/[userid]/'+kind+'.get.ts')).default);
 const path=kind=>'/api/developer/userdata/'+c.taikoId+'/'+kind,observations=[];
 async function ask(kind,{token,cookie=c.cookie,status=200,etag}={}){
  const r=await c.request('GET',path(kind),undefined,cookie,{...(token?{authorization:'Bearer '+token}:{}),...(etag?{'if-none-match':etag}:{})});
  assert.equal(r.status,status,kind);const body=r.status===304?null:await r.json();
  observations.push({kind,status:r.status});return {body,etag:r.headers.get('etag')};
 }
 await ask('rating',{cookie:'',status:401});
 const rating=await ask('rating');assert.equal(rating.body.sampleCount,30);assert.equal(rating.body.dimensions.length,6);assert.equal(rating.body.topSongsCount,30);assert.ok(rating.body.overallRating>0);assert.ok(rating.body.topSongs.every(s=>s.songId>=10000&&s.level===4));
 const recommendations=await ask('recommendations');assert.equal(recommendations.body.basis,'rating');assert.ok(recommendations.body.items.length>0&&recommendations.body.items.length<=20);
 await ask('rating',{etag:rating.etag,status:304});
 // A different developer reads this owner's source through the already
 // approved global current-score service grant, without registering a client.
 const ddl=await readFile(new URL('../server/utils/account-schema-definition.ts',import.meta.url),'utf8');let appDdl;
 function visit(n){if(ts.isNoSubstitutionTemplateLiteral(n)&&n.text.startsWith('CREATE TABLE IF NOT EXISTS web_developer_applications ('))appDdl=n.text;ts.forEachChild(n,visit);}visit(ts.createSourceFile('schema.ts',ddl,ts.ScriptTarget.Latest,true));assert.ok(appDdl);await c.pool.execute(appDdl);
 const tag=randomBytes(8).toString('hex');const [developer]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',['dev-'+tag,tag+'@example.test','synthetic']);
 const [application]=await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'synthetic@example.test','isolated analysis','approved')",[developer.insertId]);
 const token=randomBytes(24).toString('hex'),digest=createHash('sha256').update(token).digest('hex');
 const [credential]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[developer.insertId,application.insertId,digest,'synthetic']);
 await c.pool.execute("INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id) VALUES (?,?,'approved-developer-scores',?,?,?,'active',?)",[credential.insertId,developer.insertId,JSON.stringify(['scores_read_any']),JSON.stringify('*'),'a'.repeat(32),c.user]);
 try{
  const crossOwner=await ask('rating',{token,cookie:''});assert.equal(crossOwner.body.overallRating,rating.body.overallRating);
  await ask('recommendations',{token,cookie:''});
  c.config.developerGlobalScoresRead=false;await ask('rating',{token,cookie:'',status:403});c.config.developerGlobalScoresRead=true;
  await c.pool.execute("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE id=?",[credential.insertId]);await ask('rating',{token,cookie:'',status:401,etag:rating.etag});
 }finally{
  await c.pool.execute('DELETE FROM taiko_source_service_grants WHERE developer_token_id=?',[credential.insertId]);await c.pool.execute('DELETE FROM web_developer_tokens WHERE id=?',[credential.insertId]);await c.pool.execute('DELETE FROM web_developer_applications WHERE id=?',[application.insertId]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[developer.insertId]);
 }
 await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'developer-analysis-http.json'),JSON.stringify({status:'PASS',productionAccess:false,observations},null,2));
},{withDeveloper:true,requestTimeoutMs:30000}));
