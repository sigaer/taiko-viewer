import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createError} from 'h3';
import {accountSourceFixture,queuedAccountSource} from './fixtures/accountSourceHttp.mjs';
import {assertQaPython} from './fixtures/qaPaths.mjs';

test('Rating ordinary entry consistency: real session and Developer HTTP, installed workers', {timeout:240000},()=>accountSourceFixture(async c=>{
 const python=assertQaPython(),originalPython=process.env.TAIKO_PYTHON_EXECUTABLE,previousCreateError=globalThis.createError;
 globalThis.createError=createError;
 const vector=JSON.parse(await readFile(new URL('./fixtures/installedRuntimeCatalog.json',import.meta.url),'utf8'));
 c.config.repoRoot=c.root;c.config.developerGlobalScoresRead=true;
 const charts={},catalog=[],records=[];
 for(let i=0;i<48;i++){
  const id=10000+i,title=`Entry ${i}`,combo=Number(vector.chart.combo);
  charts[id]={...vector.chart,id,level:4,song_name_cn:title};
  catalog.push({id,song_name:title,song_name_jp:title,level_4:9,level_5:'-',shelf_status:0,max_combo:[0,0,0,combo,0]});
  if(i<25)records.push({song_no:id,level:4,good_cnt:i<20?520:450,ok_cnt:10,ng_cnt:1,high_score:900000,stage_cnt:1});
 }
 await mkdir(resolve(c.root,'songs'));
 const saveCatalog=async rows=>{for(const name of ['song_data','song_data_raw'])await writeFile(resolve(c.root,'songs',name+'.json'),JSON.stringify(rows));};
 await saveCatalog(catalog);
 await writeFile(resolve(c.root,'songs/rating_structured_with_ids.json'),JSON.stringify({songs:charts,const_table:vector.const_table}));
 for(const name of ['song_alias','song_score','taiko_goku_onis','taiko_goku_all_levels_stream'])await writeFile(resolve(c.root,'songs',name+'.json'),'[]');
 const {withPublicationLease}=await import('../server/infrastructure/taiko-publication/client.ts');
 const publish=async(songs,identity=c.taikoId)=>withPublicationLease({root:c.config.userdataDir,repoRoot:c.root,identity,mode:'write'},async lease=>{await lease.put('current',JSON.stringify({profile:{userid:identity},songs}));await lease.publish();});
 await publish(records);
 for(const [path,file] of [['/web/rating','charts/summary.get.ts'],['/web/ordinary','recommendation.get.ts'],['/web/image','charts/recommend.get.ts']])c.route('get',path,(await import('../server/api/account/'+file)).default);
 for(const kind of ['rating','recommendations'])c.route('get','/dev/:userid/'+kind,(await import('../server/api/developer/userdata/[userid]/'+kind+'.get.ts')).default);
 const token=randomBytes(24).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
 const [credential]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,hash,'synthetic']);
 await c.pool.execute("INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id) VALUES (?,?,'approved-developer-scores',?,?,?,'active',?)",[credential.insertId,c.user,JSON.stringify(['scores_read_any']),JSON.stringify('*'),'b'.repeat(32),c.user]);
 const devHeaders={authorization:'Bearer '+token};
 const ask=async(path,status=200,developer=false,headers={})=>{const r=await c.request('GET',path,undefined,developer?'':c.cookie,{...(developer?devHeaders:{}),...headers});assert.equal(r.status,status,path);return r;};
 const dev=kind=>'/dev/'+c.taikoId+'/'+kind;
 const capture=resolve(c.root,'render-business.json'),trampoline=resolve(c.root,'observe-python');
 await writeFile(trampoline,'#!/bin/sh\nexec '+"'"+python+"' -I '"+new URL('./fixtures/observeRecommendation.py',import.meta.url).pathname+"' \"$@\"\n");await chmod(trampoline,0o700);
 process.env.RATING_ENTRY_CAPTURE=capture;
 try{
  assert.equal((await c.request('GET','/web/rating',undefined,'')).status,401);
  const rating=await (await ask(dev('rating'),200,true)).json();
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'rating-entry-baseline.json'),JSON.stringify(rating,null,2));
  const webRating=await (await ask('/web/rating')).json();
  assert.equal(webRating.current,rating.overallRating);assert.deepEqual(webRating.dimensions,rating.dimensions);
  assert.equal(rating.topN,20);assert.equal(rating.sampleCount,25);assert.equal(rating.topSongsCount,25);
  assert.equal(rating.overallRating,7.772054);
  assert.deepEqual(rating.dimensions.map(x=>x.value),[7.198173,6.304349,6.425044,8.390748,3.548068,6.085352]);
  // All twenty leading charts have identical fixture metrics below compensation thresholds:
  // their aggregate must equal that fixed per-chart value, independently of Application.
  assert.equal(rating.overallRating,rating.topSongs[0].rating);
  for(const dim of rating.dimensions)assert.equal(dim.value,rating.topSongs[0].dimensions[dim.key]);
  const expected=await (await ask(dev('recommendations'),200,true)).json();
  assert.deepEqual(expected.items.map(x=>[x.songId,x.level,x.isUnplayed]),[[10025,4,true],[10026,4,true],[10027,4,true],[10028,4,true],[10029,4,true],[10030,4,true],[10031,4,true],[10032,4,true],[10033,4,true],[10034,4,true],[10020,4,false],[10021,4,false],[10022,4,false],[10023,4,false],[10024,4,false],[10035,4,true],[10036,4,true],[10037,4,true],[10038,4,true],[10039,4,true]]);
  const home=await (await ask('/web/ordinary')).json();
  // Different limits intentionally select different group allocations. Compare equal queries below.
  assert.equal(home.items.length,3);
  const botScript=resolve(process.env.TAIKO_ENTRY_BOT_SOURCE,'tests/recommendation/entry_consistency.py');
  const runBot=async(profile='center',executable=python)=>{
   await new Promise((accept,reject)=>{
   const child=spawn(executable,['-I',botScript,'--root',c.root,'--user',c.taikoId,'--profile',profile,'--output',resolve(c.root,'bot-business.json')],{env:{...process.env,TAIKO_COMPUTE_ONLY:'0',PYTHONWARNINGS:'ignore'},stdio:['ignore','ignore','pipe']});
   let err='';child.stderr.on('data',part=>{err=(err+part).slice(-1800);});
   const timer=setTimeout(()=>child.kill('SIGKILL'),30000);
   child.once('error',reject);child.once('close',code=>{clearTimeout(timer);code===0?accept():reject(Error('Bot command failed: '+err));});
   });
   return JSON.parse(await readFile(resolve(c.root,'bot-business.json'),'utf8'));
  };
  const bot=await runBot();
  assert.deepEqual(bot.recommendations.items,expected.items);
  assert.ok(Math.abs(bot.rating-rating.overallRating)<=0.0000005,'Bot overall rounds to the HTTP rating');
  const dimColumns={big_song:'大歌力',stamina:'体力',speed:'高速处理',accuracy_power:'精度力',rhythm:'节奏处理',complex:'复合处理'};
  for(const dimension of rating.dimensions)assert.ok(Math.abs(bot.dimensions[dimColumns[dimension.key]]-dimension.value)<=0.0000005,dimension.key);
  assert.deepEqual(bot.charts,records.map(x=>[x.song_no,x.level]));
  const artifacts=JSON.parse(await readFile(process.env.QA_ARTIFACT_MANIFEST,'utf8'));
  const client=await runBot('client',artifacts.roles.client.python);
  assert.deepEqual(client.recommendations.items,expected.items);
  assert.ok(Math.abs(client.rating-rating.overallRating)<=0.0000005);
  for(const dimension of rating.dimensions)assert.ok(Math.abs(client.dimensions[dimColumns[dimension.key]]-dimension.value)<=0.0000005,dimension.key);
  const observations=[];
  const compareCurrent=async label=>{
   const currentRating=await (await ask(dev('rating'),200,true)).json(),web=await (await ask('/web/rating')).json();
   assert.equal(web.overallRating,currentRating.overallRating);assert.deepEqual(web.dimensions,currentRating.dimensions);
   const recommendations=await (await ask(dev('recommendations'),200,true)).json();
   process.env.TAIKO_PYTHON_EXECUTABLE=trampoline;
   try{await ask('/web/image?n=20');assert.deepEqual(JSON.parse(await readFile(capture,'utf8')).items,recommendations.items);}finally{process.env.TAIKO_PYTHON_EXECUTABLE=python;}
   const result=await runBot();assert.deepEqual(result.recommendations.items,recommendations.items);
   if(currentRating.overallRating===null)assert.equal(result.hasRating,false);
   else assert.ok(Math.abs(result.rating-currentRating.overallRating)<=0.0000005,label);
   observations.push({label,sampleCount:currentRating.sampleCount,items:recommendations.items.map(x=>[x.songId,x.level,x.isUnplayed])});
  };
  process.env.TAIKO_PYTHON_EXECUTABLE=trampoline;
  await ask('/web/image?n=20');
  assert.deepEqual(JSON.parse(await readFile(capture,'utf8')),{model:expected.model,basis:expected.basis,items:expected.items});
  await ask('/web/image?dim=unsupported',400);
  const race=await queuedAccountSource(c,()=>c.request('GET','/web/image?n=20'),async()=>{
   await c.pool.execute('UPDATE web_taiko_bindings SET source=\'hiroba\' WHERE id=?',[c.bindingId]);
  });
  assert.equal(race.status,409,'binding change while waiting must reject image');
  await c.pool.execute('UPDATE web_taiko_bindings SET source=\'wahlap\' WHERE id=?',[c.bindingId]);
  process.env.TAIKO_PYTHON_EXECUTABLE=python;
  await publish([]);
  const empty=await (await ask(dev('rating'),200,true)).json();assert.equal(empty.overallRating,null);assert.equal(empty.sampleCount,0);assert.ok(empty.dimensions.every(x=>x.value===0));
  assert.deepEqual((await (await ask(dev('recommendations'),200,true)).json()).items,[]);
  await compareCurrent('empty');
  await publish(records.slice(0,1));const short=await (await ask('/web/rating')).json();assert.equal(short.sampleCount,1);
  assert.equal(short.overallRating,rating.topSongs[0].rating);
  await compareCurrent('one-score');
  await publish(records);
  await saveCatalog(catalog.map(row=>({...row,shelf_status:1})));
  assert.deepEqual((await (await ask(dev('recommendations'),200,true)).json()).items,[],'empty availability must not disable filtering');
  await compareCurrent('all-off-shelf');
  const clientOffShelf=await runBot('client',artifacts.roles.client.python);
  assert.deepEqual(clientOffShelf.recommendations.items,[]);assert.equal(clientOffShelf.hasRating,false,'client retains its existing visibility profile');
  await saveCatalog(catalog);
  assert.deepEqual((await (await ask(dev('recommendations'),200,true)).json()).items,expected.items);
  const below={...records[0],good_cnt:405,ok_cnt:0};await publish([below]);
  const belowRating=await (await ask(dev('rating'),200,true)).json();assert.equal(belowRating.overallRating,null);
  await compareCurrent('below-75-percent');
  await publish([{...below,good_cnt:406}]);
  assert.equal((await (await ask(dev('rating'),200,true)).json()).sampleCount,1,'75% boundary uses the chart combo');
  await compareCurrent('above-75-percent');
  const lowPlayed=records.map((x,i)=>i===24?{...x,good_cnt:0,ok_cnt:0}:x);await publish(lowPlayed);
  assert.equal((await (await ask(dev('recommendations'),200,true)).json()).items.find(x=>x.songId===10024)?.isUnplayed,false,'below Rating threshold is still played');
  await publish(records);
  const ratingFile=resolve(c.root,'songs/rating_structured_with_ids.json');
  const missingDifficulty={...charts,10025:{...charts[10025],level:undefined}};
  await writeFile(ratingFile,JSON.stringify({songs:missingDifficulty,const_table:vector.const_table}));
  assert.ok((await (await ask(dev('recommendations'),200,true)).json()).items.every(x=>x.songId!==10025),'missing difficulty cannot borrow a chart');
  await compareCurrent('missing-catalog-difficulty');
  await writeFile(ratingFile,JSON.stringify({songs:charts,const_table:vector.const_table}));
  const duplicateCatalog=[...catalog,{...catalog[0],id:10048}],duplicateCharts={...charts,10048:{...charts[10000],id:10048}};
  await saveCatalog(duplicateCatalog);await writeFile(ratingFile,JSON.stringify({songs:duplicateCharts,const_table:vector.const_table}));
  await publish([...records,{...records[0],song_no:10048}]);
  const duplicateRating=await (await ask(dev('rating'),200,true)).json();assert.equal(duplicateRating.sampleCount,26,'API Rating preserves played versions');
  assert.equal((await (await ask('/web/rating')).json()).sampleCount,26);
  const duplicateBot=await runBot();assert.equal(duplicateBot.charts.length,25,'existing Bot B30 profile collapses played versions');
  const duplicateClient=await runBot('client',artifacts.roles.client.python);assert.equal(duplicateClient.charts.length,25);assert.deepEqual(duplicateClient.recommendations.items,expected.items);
  assert.deepEqual(duplicateBot.recommendations.items,expected.items);
  assert.deepEqual((await (await ask(dev('recommendations'),200,true)).json()).items,expected.items,'ordinary recommendation merges duplicate versions');
  await saveCatalog(catalog);await writeFile(ratingFile,JSON.stringify({songs:charts,const_table:vector.const_table}));await publish(records);
  // Chart difficulty is an identity component, not the star value. Missing ura
  // and missing catalog difficulty cannot borrow the oni chart's constants.
  const missing=records.concat([{...records[0],song_no:10000,level:5},{...records[0],song_no:99999,level:4}]);
  await publish(missing);
  assert.equal((await (await ask(dev('rating'),200,true)).json()).sampleCount,25);
  assert.deepEqual((await (await ask(dev('recommendations'),200,true)).json()).items,expected.items);
  await compareCurrent('missing-ura-and-unknown-song');
  await publish(records);
  const unknown=catalog.map(x=>({...x,shelf_status:null}));await saveCatalog(unknown);
  assert.deepEqual((await (await ask(dev('recommendations'),200,true)).json()).items,expected.items,'unknown shelf status retains existing profile policy');
  await compareCurrent('unknown-source-status');
  await saveCatalog(catalog);
  // A second real account/session and a real current-binding switch. No fixture
  // changes production accounts, bindings, scores or Developer authorizations.
  const tag=randomBytes(6).toString('hex'),sourceB=c.taikoId+'1',password='Synthetic-'+tag;
  const [other]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash,email_verified) VALUES (?,?,?,1)',['entry-'+tag,tag+'@example.test',await c.shared.getPasswordHash(password)]);
  try{
   await publish(records.slice(0,1),sourceB);
   await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[other.insertId,sourceB]);
   const login=await c.request('POST','/login',{identifier:'entry-'+tag,password},'');assert.equal(login.status,200);
   const cookieB=login.headers.get('set-cookie').split(';')[0];
   assert.equal((await (await c.request('GET','/web/rating',undefined,cookieB)).json()).sampleCount,1);
   assert.equal((await (await ask('/web/rating')).json()).sampleCount,25);
   const sourceC=c.taikoId+'2';await publish(records.slice(0,1),sourceC);
   const [extra]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',0)",[c.user,sourceC]);
   c.state.expectedSourceMode='none';
   assert.equal((await c.request('POST','/current',{bindingId:extra.insertId})).status,200);
   assert.equal((await (await ask('/web/rating')).json()).sampleCount,1);
   assert.equal((await c.request('POST','/current',{bindingId:c.bindingId})).status,200);
   c.state.expectedSourceMode='write';
   assert.equal((await (await ask('/web/rating')).json()).sampleCount,25);
   await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[extra.insertId]);
  }finally{
   await c.pool.execute('DELETE FROM web_user_sessions WHERE user_id=?',[other.insertId]);await c.pool.execute('DELETE FROM web_taiko_bindings WHERE user_id=?',[other.insertId]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[other.insertId]);
  }
  await c.pool.execute("UPDATE web_developer_tokens SET status='revoked',revoked_at=NOW() WHERE id=?",[credential.insertId]);
  await ask(dev('rating'),401,true);
  const {activeDeveloperAnalyses}=await import('../server/services/account/developer-analysis-limits.ts');assert.equal(activeDeveloperAnalyses(),0);
  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'rating-entry-matrix.json'),JSON.stringify({tolerance:0.0000005,observations,productionAccess:false},null,2));
 }finally{
  process.env.TAIKO_PYTHON_EXECUTABLE=originalPython;delete process.env.RATING_ENTRY_CAPTURE;
  if(previousCreateError===undefined)delete globalThis.createError;else globalThis.createError=previousCreateError;
  await c.pool.execute('DELETE FROM taiko_source_service_grants WHERE developer_token_id=?',[credential.insertId]);
  await c.pool.execute('DELETE FROM web_developer_tokens WHERE id=?',[credential.insertId]);
 }
},{withDeveloper:true,withRealPython:true,requestTimeoutMs:30000}));
