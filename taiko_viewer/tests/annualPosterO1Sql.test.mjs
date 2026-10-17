// Partial only: real renderer/admission and authenticated cache API, synthetic HTML.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {registerHooks} from 'node:module';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {accountSourceFixture} from './fixtures/accountSourceHttp.mjs';
import {qaTempPrefix,assertQaEvidencePath,assertQaPython} from './fixtures/qaPaths.mjs';
const NativeDate=Date;
test('Annual synthetic HTML isolated renderer and actual owner cache GET',{timeout:150000},async()=>{
 const python=assertQaPython(),prior={...process.env},cwd=process.cwd(),root=await mkdtemp(qaTempPrefix('annual-test-poster-'));
 const manifestBytes=await readFile(process.env.QA_ARTIFACT_MANIFEST);
 const output=assertQaEvidencePath(resolve(process.env.QA_EVIDENCE_DIR,'annual-poster-partial.json'));
 const evidence={status:'RUNNING',scope:'SYNTHETIC_HTML_RENDERER_AND_REAL_CACHE_API_ONLY',vueEndToEnd:'NOT_TESTED_NO_LOCAL_PAGE_BUILD',productionAccess:false,python,manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),candidate:JSON.parse(manifestBytes).candidate,testSha256:createHash('sha256').update(await readFile(new URL('./annualPosterO1Sql.test.mjs',import.meta.url))).digest('hex'),rendererLimit:1,workerTimeoutMs:60000,samples:[]};
 let hooks,server,monitor,monitoring=false;
 evidence.rendererResources=[];
 try{
  for(const leaf of ['userdata','cache','admission','tmp'])await mkdir(resolve(root,leaf));
  await writeFile(resolve(root,'policy.json'),JSON.stringify({mode:'public',pauseGeneration:false,pauseRendering:false}));
  Object.assign(process.env,{ANNUAL_E2E_ISOLATED_ROOT:root,ANNUAL_E2E_SYNTHETIC_DATA:'1',TAIKO_USERDATA_DIR:resolve(root,'userdata'),TAIKO_ANNUAL_CACHE_DIR:resolve(root,'cache'),TAIKO_ANNUAL_ADMISSION_DIR:resolve(root,'admission'),TAIKO_ANNUAL_POLICY_FILE:resolve(root,'policy.json'),TAIKO_CONFIG_PATH:resolve(root,'absent.json'),TAIKO_RUNTIME_ENV_FILE:resolve(root,'absent.env')});
  await accountSourceFixture(async c=>{
   globalThis.Date=NativeDate;c.state.expectedSourceMode='none';Object.assign(c.config,{repoRoot:root,userdataDir:resolve(root,'userdata'),accountCacheDir:resolve(root,'cache'),annualRenderSecret:randomBytes(32).toString('hex'),annualChromiumPath:'/usr/bin/chromium'});
   process.chdir(new URL('../',import.meta.url).pathname);
   hooks=registerHooks({resolve(specifier,context,next){if(specifier.endsWith('/services/annual-beta/events.ts')||specifier==='~/server/services/annual-beta/events')return {url:'data:text/javascript,export const trackBetaServer=async()=>{};export const trackBetaUser=async()=>{};',shortCircuit:true};if(specifier==='~/server/services/content'||specifier.endsWith('/server/services/content.ts'))return {url:'data:text/javascript,export const getSongCatalog=async()=>[];export const getRatingEntries=async()=>[];export const getSongCoverUrl=id=>%22/synthetic-cover/%22%2Bid;',shortCircuit:true};return next(specifier,context);}});
   const [[guard]]=await c.pool.query('SELECT DATABASE() AS name');assert.match(guard.name,/_test$/);assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');evidence.databaseProof=guard.name;
   const source=await readFile(new URL('../server/utils/account-schema-definition.ts',import.meta.url),'utf8'),conn=await c.pool.getConnection();
   try{await conn.query('SET FOREIGN_KEY_CHECKS=0');for(const match of source.matchAll(/`(CREATE TABLE IF NOT EXISTS web_annual_[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)`/g))await conn.query(match[1]);await conn.query('SET FOREIGN_KEY_CHECKS=1');for(const sql of ["ALTER TABLE web_annual_summary_access ADD COLUMN enabled TINYINT NOT NULL DEFAULT 1","ALTER TABLE web_annual_summary_access ADD COLUMN feature VARCHAR(64) NOT NULL DEFAULT 'annual_first_run_beta'"])try{await conn.query(sql);}catch(e){if(e.errno!==1060)throw e;}}finally{conn.release();}
   const summaryId=randomUUID(),posterId=randomUUID(),shareId=randomUUID(),outputPath=resolve(root,'cache','synthetic-poster.png');
   const {verifyAnnualRenderToken}=await import('../server/services/account/annual-summary/security.ts');
   const background=await readFile(new URL('../public/annual/poster/background_22.png',import.meta.url));
   let validPageRequests=0;
   server=createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/synthetic-background.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(background);return;}if(url.pathname!=='/account/annual-poster/'+summaryId||!verifyAnnualRenderToken(url.searchParams.get('renderToken'),summaryId)){res.writeHead(403);res.end();return;}validPageRequests++;res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body style="margin:0;width:1080px;height:1440px;background:#edf4ff"><img src="/synthetic-background.png" style="position:absolute;width:1080px;height:1440px"><div style="position:relative;padding:80px;font:48px sans-serif">Synthetic Annual<br>200 snapshots / 500 charts</div><script>window.__ANNUAL_POSTER_READY__=true</script></body></html>');});server.listen(0,'127.0.0.1');await once(server,'listening');c.config.annualInternalBaseUrl='http://127.0.0.1:'+server.address().port;
   const {renderAnnualPoster}=await import('../server/services/account/annual-summary/poster.ts');
   monitor=setInterval(async()=>{if(monitoring)return;monitoring=true;try{const rows=JSON.parse(await readFile(resolve(root,'admission/renderer.json'),'utf8'));for(const row of rows){if(!/^[0-9a-f-]{36}$/.test(row.id))continue;const cg='/sys/fs/cgroup/development.slice/development-qa.slice/taiko-annual-renderer-'+row.id+'.service';const events=await readFile(cg+'/memory.events','utf8').catch(()=>null);if(events)evidence.rendererResources.push({at:NativeDate.now(),id:row.id,events,peak:await readFile(cg+'/memory.peak','utf8').catch(()=>null)});}}catch{}finally{monitoring=false;}},200);
   const start=performance.now();await renderAnnualPoster({summaryId,posterId,shareId,locale:'zh',outputPath});evidence.firstRenderServiceWallMs=performance.now()-start;clearInterval(monitor);while(monitoring)await new Promise(r=>setTimeout(r,10));assert.ok(evidence.rendererResources.length>0,'Actual renderer cgroup samples required');assert.ok(evidence.rendererResources.every(x=>!/^oom(?:_kill)? [1-9]/m.test(x.events)),'Renderer OOM must be zero');assert.ok(evidence.firstRenderServiceWallMs<60000);assert.equal(validPageRequests,1);
   const png=await readFile(outputPath);assert.equal(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),true);assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1440);const digest=createHash('sha256').update(png).digest('hex');evidence.image={bytes:png.length,sha256:digest,width:1080,height:1440};
   const before=await stat(outputPath);await renderAnnualPoster({summaryId,posterId,shareId,locale:'zh',outputPath});assert.equal(validPageRequests,1);assert.equal((await stat(outputPath)).mtimeMs,before.mtimeMs);
   await c.pool.execute("INSERT INTO web_annual_summaries(id,user_id,binding_id,version_key,data_mode,input_fingerprint,summary_path,events_path,generated_at) VALUES (?,?,?,'annual_2026','synthetic',?,?,?,NOW())",[summaryId,c.user,c.bindingId,digest,resolve(root,'cache/unused-summary.json'),resolve(root,'cache/unused-events.json')]);
   await c.pool.execute("INSERT INTO web_annual_shares(id,summary_id,user_id,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))",[shareId,summaryId,c.user,createHash('sha256').update(randomBytes(32)).digest('hex')]);
   await c.pool.execute('INSERT INTO web_annual_posters(id,summary_id,share_id,user_id,fingerprint,file_path) VALUES (?,?,?,?,?,?)',[posterId,summaryId,shareId,c.user,digest,outputPath]);
   c.route('get','/poster/:posterId',(await import('../server/api/account/annual-posters/[posterId].get.ts')).default);
   let r=await c.request('GET','/poster/'+posterId,null,'');await r.arrayBuffer();assert.equal(r.status,401);evidence.anonymousStatus=r.status;
   r=await c.request('GET','/poster/'+randomUUID());await r.arrayBuffer();assert.equal(r.status,404);evidence.unknownStatus=r.status;
   const otherTag='annual_other_'+randomUUID().replaceAll('-','');const [other]=await c.pool.execute('INSERT INTO web_user_accounts(username,email,password_hash) VALUES (?,?,?)',[otherTag,otherTag+'@example.test','synthetic-no-login']);
   try{await c.pool.execute('UPDATE web_annual_posters SET user_id=? WHERE id=?',[other.insertId,posterId]);r=await c.request('GET','/poster/'+posterId);await r.arrayBuffer();assert.equal(r.status,404);evidence.crossOwnerStatus=r.status;}finally{await c.pool.execute('UPDATE web_annual_posters SET user_id=? WHERE id=?',[c.user,posterId]);await c.pool.execute('DELETE FROM web_user_accounts WHERE id=?',[other.insertId]);}
   for(let i=0;i<200;i++){const at=performance.now();try{const response=await c.request('GET','/poster/'+posterId),body=Buffer.from(await response.arrayBuffer()),wallMs=performance.now()-at;const matching=createHash('sha256').update(body).digest('hex')===digest;evidence.samples.push({index:i,status:response.status,wallMs,matching});}catch(e){evidence.samples.push({index:i,status:e.name==='TimeoutError'?'timeout':'failed',wallMs:performance.now()-at});}}
   const ok=evidence.samples.filter(x=>x.status===200&&x.matching),values=ok.map(x=>x.wallMs).sort((a,b)=>a-b);evidence.cached={success:ok.length,failed:200-ok.length,p95Ms:values[Math.ceil(values.length*.95)-1],p99Ms:values[Math.ceil(values.length*.99)-1]};assert.ok(ok.length/200>=.995);assert.ok(evidence.cached.p95Ms<=1200&&evidence.cached.p99Ms<=3000);
   evidence.rendererLedger=JSON.parse(await readFile(resolve(root,'admission/renderer.json'),'utf8')).map(x=>({id:x.id,state:x.state}));assert.ok(evidence.rendererLedger.every(x=>x.state==='completed'));evidence.status='PASS_PARTIAL_NOT_VUE_RENDER_SLO';
  },{withDeveloper:true,requestTimeoutMs:10000});
 }catch(e){evidence.status='FAIL';evidence.failure={name:e.name,message:String(e.message).slice(0,400)};throw e;}
 finally{clearInterval(monitor);while(monitoring)await new Promise(r=>setTimeout(r,10));if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}hooks?.deregister();globalThis.Date=NativeDate;process.chdir(cwd);for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];Object.assign(process.env,prior);await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log('ANNUAL_POSTER_PARTIAL_EVIDENCE '+output);}
});
