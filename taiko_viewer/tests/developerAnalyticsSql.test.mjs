import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import ts from 'typescript';
import {spawn,execFileSync} from 'node:child_process';
import {developerApis,developerApiExamples} from '../utils/developer-api-guide.ts';
import {validateGuideResponse} from './fixtures/developerGuideContract.mjs';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
import {assertQaPython} from './fixtures/qaPaths.mjs';

test('analysis HTTP uses installed algorithms, captured scores and existing Developer Token authority',{timeout:90000},()=>accountSourceFixture(async c=>{
 assertQaPython();c.config.repoRoot=c.root;c.config.developerGlobalScoresRead=true;c.config.developerApiV1=true;
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
 c.config.songDataPath=resolve(c.root,'songs/song_data.json');
 c.route('get','/api/v1/taiko/catalog/songs',(await import('../server/api/v1/taiko/catalog/songs.get.ts')).default);
 c.route('get','/api/developer/userdata/:userid',(await import('../server/api/developer/userdata/[userid].get.ts')).default);
 for(const kind of ['rating','recommendations'])c.route('get','/api/developer/userdata/:userid/'+kind,(await import('../server/api/developer/userdata/[userid]/'+kind+'.get.ts')).default);
 const path=kind=>kind==='catalog'?'/api/v1/taiko/catalog/songs?include=charts':'/api/developer/userdata/'+c.taikoId+(kind==='userdata'?'':'/'+kind),observations=[];
 async function ask(kind,{token,cookie=c.cookie,status=200,etag}={}){
  const r=await c.request('GET',path(kind),undefined,cookie,{...(token?{authorization:'Bearer '+token}:{}),...(etag?{'if-none-match':etag}:{})});
  assert.equal(r.status,status,kind);const body=r.status===304?null:await r.json();
  if(r.status===200)validateGuideResponse(kind,body);observations.push({kind,status:r.status});return {body,etag:r.headers.get('etag')};
 }
 const ddl=await readFile(new URL('../server/utils/account-schema-definition.ts',import.meta.url),'utf8');let appDdl;
 function visit(n){if(ts.isNoSubstitutionTemplateLiteral(n)&&n.text.startsWith('CREATE TABLE IF NOT EXISTS web_developer_applications ('))appDdl=n.text;ts.forEachChild(n,visit);}visit(ts.createSourceFile('schema.ts',ddl,ts.ScriptTarget.Latest,true));assert.ok(appDdl);await c.pool.execute(appDdl);
 execFileSync(process.execPath,['--experimental-strip-types',new URL('../scripts/migrate_developer_api_v1.ts',import.meta.url).pathname,'--apply'],{env:process.env,timeout:30000,maxBuffer:32768});
 await ask('catalog',{cookie:''});await ask('catalog',{cookie:'',token:'invalid-synthetic-token',status:401});
 for(const kind of ['userdata','rating','recommendations'])await ask(kind,{cookie:'',status:401});
 await ask('userdata');
 const rating=await ask('rating');assert.equal(rating.body.sampleCount,30);assert.equal(rating.body.dimensions.length,6);assert.equal(rating.body.topSongsCount,30);assert.ok(rating.body.overallRating>0);assert.ok(rating.body.topSongs.every(s=>s.songId>=10000&&s.level===4));
 const recommendations=await ask('recommendations');assert.equal(recommendations.body.basis,'rating');assert.ok(recommendations.body.items.length>0&&recommendations.body.items.length<=20);
 await ask('rating',{etag:rating.etag,status:304});
 // A different developer reads this owner's source through the already
 // approved global current-score service grant, without registering a client.
 const tag=randomBytes(8).toString('hex');const [developer]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',['dev-'+tag,tag+'@example.test','synthetic']);
 const [application]=await c.pool.execute("INSERT INTO web_developer_applications(user_id,reply_email,reason,status) VALUES (?,'synthetic@example.test','isolated analysis','approved')",[developer.insertId]);
 const token=randomBytes(24).toString('hex'),digest=createHash('sha256').update(token).digest('hex');
 const [credential]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,application_id,token_hash,token_mask) VALUES (?,?,?,?)',[developer.insertId,application.insertId,digest,'synthetic']);
 await c.pool.execute("INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id) VALUES (?,?,'approved-developer-scores',?,?,?,'active',?)",[credential.insertId,developer.insertId,JSON.stringify(['scores_read_any']),JSON.stringify('*'),'a'.repeat(32),c.user]);
 try{
  const crossOwner=await ask('rating',{token,cookie:''});assert.equal(crossOwner.body.overallRating,rating.body.overallRating);
  await ask('recommendations',{token,cookie:''});
  // Execute all eight displayed examples against this actual loopback API.
  // Only the origin and synthetic placeholder are substituted, not the request logic.
  for(const api of developerApis){
   const samples=developerApiExamples(api);
   for(const language of ['curl','python']){
    const code=samples[language].replaceAll('https://viewer.sakura-bot.cn',c.baseUrl).replace("export TAIKO_SOURCE_ID='YOUR_SOURCE_ID'","export TAIKO_SOURCE_ID='"+c.taikoId+"'");
    const executable=language==='curl'?'/bin/bash':process.env.TAIKO_PYTHON_EXECUTABLE;
    const args=language==='curl'?['-euc',code]:['-c',code];
    const body=await new Promise((accept,reject)=>{
     const child=spawn(executable,args,{env:{PATH:process.env.PATH,TAIKO_SOURCE_ID:c.taikoId,TAIKO_VIEWER_DEVELOPER_TOKEN:token},stdio:['ignore','pipe','pipe']});let out='',err='';
     const timer=setTimeout(()=>child.kill('SIGKILL'),15000);
     child.stdout.on('data',part=>{out+=part.toString();if(out.length>256000)child.kill('SIGKILL');});child.stderr.on('data',part=>{err=(err+part.toString()).slice(0,500);});
     child.on('error',reject);child.on('close',status=>{clearTimeout(timer);if(status!==0)reject(Error(api.id+' '+language+' failed ('+status+')'));else{try{accept(JSON.parse(out));}catch{reject(Error('Example did not return valid JSON'));}}});
    });
    validateGuideResponse(api.id,body);observations.push({kind:api.id,example:language,status:200});
   }
  }
  c.config.developerGlobalScoresRead=false;for(const kind of ['userdata','rating','recommendations'])await ask(kind,{token,cookie:'',status:403});c.config.developerGlobalScoresRead=true;
  c.config.taikoOpenDeveloperDailyLimit=1;await ask('userdata',{token,cookie:'',status:429});delete c.config.taikoOpenDeveloperDailyLimit;
  await c.pool.execute("UPDATE web_developer_tokens SET status='inactive' WHERE id=?",[credential.insertId]);for(const kind of ['userdata','rating','recommendations'])await ask(kind,{token,cookie:'',status:401});
  await c.pool.execute("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE id=?",[credential.insertId]);for(const kind of ['userdata','rating','recommendations'])await ask(kind,{token,cookie:'',status:401,etag:rating.etag});
 }finally{
  await c.pool.execute('DELETE FROM taiko_source_service_grants WHERE developer_token_id=?',[credential.insertId]);await c.pool.execute('DELETE FROM web_developer_tokens WHERE id=?',[credential.insertId]);await c.pool.execute('DELETE FROM web_developer_applications WHERE id=?',[application.insertId]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[developer.insertId]);
 }
 await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'developer-analysis-http.json'),JSON.stringify({status:'PASS',productionAccess:false,observations},null,2));
},{withDeveloper:true,requestTimeoutMs:30000}));
