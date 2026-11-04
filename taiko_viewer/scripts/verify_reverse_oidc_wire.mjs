/** Bounded isolated cross-site browser integration, not production smoke.
 * Run through scripts/memory/run_qa.sh with an explicit mutation opt-in.
 * Creates its own MySQL datadir and *_test DB; never reads production data.
 * Requires the matching OurTaiko RP checkout with sakura_wire_server.py and
 * locked dependencies installed. A local HTTPS CONNECT proxy routes only the
 * two fixed hostnames to local code. The temporary TLS key is a test fixture;
 * real token signing, PKCE and Authlib verification remain enabled.
 */
import {mkdtemp,writeFile,readFile,open,chmod,rm,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer,request as httpRequest} from 'node:http';
import {createServer as createHttpsServer} from 'node:https';
import {connect} from 'node:net';
import {createServer as createNetServer} from 'node:net';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const rp=process.env.TAIKO_OURTAIKO_RP_CHECKOUT;
if(!rp?.startsWith('/'))throw Error('Absolute TAIKO_OURTAIKO_RP_CHECKOUT required');
const mysqldBinary=process.env.TAIKO_TEST_MYSQLD || '/www/server/mysql/bin/mysqld';
const require=createRequire(root+'/package.json');
const mysql=require('mysql2/promise');
const {chromium}=require('playwright-core');
const {generateKeyPair,exportJWK}=await import(root+'/node_modules/jose/dist/webapi/index.js');
const {installSchemaModuleLoader}=await import(root+'/scripts/schema_module_loader.mjs');
const loader=installSchemaModuleLoader();
const {PROVIDER_TABLES,databaseAdapter,authorizationBinding}=await import(root+'/server/services/reverse-oidc/adapter.ts');
const dir=await mkdtemp('/var/tmp/oidc-b-wire-');await chmod(dir,0o700);
const children=[];let db,op,browser,context,front,proxy,datadir;
const exchanges=[];
const wireRequests=[];
let revokeBeforeCallback=false;
const secret=randomBytes(32).toString('base64url');const session=randomBytes(32).toString('hex');
const timeout=setTimeout(()=>{process.stderr.write('integration deadline\n');process.exitCode=1;for(const child of children)child.kill('SIGTERM');browser?.close();op?.close();},180000);
function child(cmd,args,opts={}) {const p=spawn(cmd,args,{stdio:['ignore','pipe','pipe'],...opts});children.push(p);return p;}
async function waitUntil(fn){for(let i=0;i<150;i++){try{return await fn();}catch{await new Promise(r=>setTimeout(r,100));}}throw Error('startup timeout');}
async function stop(p){if(p.exitCode===null&&p.signalCode===null){p.kill('SIGTERM');await Promise.race([once(p,'exit'),new Promise(r=>setTimeout(r,8000))]);if(p.exitCode===null&&p.signalCode===null){p.kill('SIGKILL');await once(p,'exit');}}}
function raw(url,method='GET',headers={},body){return new Promise((resolve,reject)=>{const r=httpRequest(url,{method,headers,timeout:15000},res=>{const chunks=[];let n=0;res.on('data',c=>{n+=c.length;if(n>2*1024*1024){r.destroy(Error('response size'));return;}chunks.push(c);});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});r.on('error',reject);r.on('timeout',()=>r.destroy(Error('timeout')));if(body)r.write(body);r.end();});}
try{
 if(process.env.TAIKO_ALLOW_TEST_DB_MUTATION!=='1')throw Error('mutation opt-in required');
 if(process.env.TAIKO_TEST_NITRO_OUTPUT){
  const scratch=process.env.QA_RUN_TMPDIR;if(!scratch||!process.env.QA_RUN_ID)throw Error('Owned QA context required for packaged Nuxt');
  datadir=(await mkdtemp(scratch+'/sql-'))+'/mysql';
 }else datadir=dir+'/mysql';
 const initLog=await open(dir+'/mysql-init.log','w');
 const init=child(mysqldBinary,['--no-defaults','--initialize-insecure','--user=root',`--datadir=${datadir}`],{stdio:['ignore',initLog.fd,initLog.fd]});
 assert.equal((await once(init,'exit'))[0],0,'isolated mysql initialization');await initLog.close();
 const ports=createNetServer();ports.listen(0,'127.0.0.1');await once(ports,'listening');const port=ports.address().port;await new Promise(r=>ports.close(r));
 const log=await open(dir+'/mysql.log','w');
 const mysqld=child(mysqldBinary,['--no-defaults','--user=root',`--datadir=${datadir}`,`--socket=${dir}/mysql.sock`,`--pid-file=${dir}/mysql.pid`,`--port=${port}`,'--bind-address=127.0.0.1','--mysqlx=OFF','--innodb-buffer-pool-size=67108864','--max-connections=20','--performance-schema=OFF'],{stdio:['ignore',log.fd,log.fd]});
 const admin=await waitUntil(()=>mysql.createConnection({socketPath:dir+'/mysql.sock',user:'root'}));
 await admin.query('CREATE DATABASE viewer_reverse_oidc_test');
 await admin.query("CREATE USER 'wire_test'@'127.0.0.1' IDENTIFIED BY ?",[secret]);
 await admin.query("GRANT ALL ON viewer_reverse_oidc_test.* TO 'wire_test'@'127.0.0.1'");await admin.end();
 db=mysql.createPool({host:'127.0.0.1',port,user:'wire_test',password:secret,database:'viewer_reverse_oidc_test',connectionLimit:5});
 const [[identity]]=await db.query('SELECT DATABASE() name');assert.ok(identity.name.endsWith('_test'));
 await db.query('CREATE TABLE web_user_accounts (id BIGINT UNSIGNED PRIMARY KEY,username VARCHAR(64),email VARCHAR(255),email_verified INT)');
 await db.query('CREATE TABLE web_user_sessions (session_token CHAR(64) PRIMARY KEY,user_id BIGINT UNSIGNED,expires_at DATETIME)');
 for(const sql of PROVIDER_TABLES)await db.query(sql);
 await db.execute('INSERT INTO web_user_accounts VALUES (?,?,?,1)',['9007199254740993','wire-viewer','viewer@example.test']);
 await db.execute('INSERT INTO web_user_sessions VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))',[session,'9007199254740993']);
 const {privateKey}=await generateKeyPair('RS256',{extractable:true});
 const key={...await exportJWK(privateKey),kid:'wire-isolated',alg:'RS256',use:'sig'};
 const configPath=dir+'/provider.json';await writeFile(configPath,JSON.stringify({clientId:'OurTaiko',clientSecret:secret,cookieKeys:[randomBytes(32).toString('hex')],jwks:{keys:[key]}}),{mode:0o600});
 process.env.TAIKO_OIDC_PROVIDER_ENABLED='1';process.env.TAIKO_OIDC_PROVIDER_CONFIG_FILE=configPath;
 globalThis.useRuntimeConfig=()=>({dbHost:'127.0.0.1',dbPort:port,dbUser:'wire_test',dbPassword:secret,dbName:'viewer_reverse_oidc_test'});
 let opBase;
 if(process.env.TAIKO_TEST_NITRO_OUTPUT){
  const output=process.env.TAIKO_TEST_NITRO_OUTPUT;if(!output.startsWith('/'))throw Error('Absolute Nitro server entry required');
  const probe=createNetServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const runtimePort=probe.address().port;await new Promise(r=>probe.close(r));
  const runtimeDir=await mkdtemp(process.env.QA_RUN_TMPDIR+'/oidc-runtime-');
  for(const path of ['repo','userdata','account-cache','annual-cache','viewer-cache'])await mkdir(runtimeDir+'/'+path);
  await writeFile(runtimeDir+'/config.json','{}');
  const runtimeLog=await open(dir+'/op.log','w');
  child(process.execPath,[output],{cwd:root,stdio:['ignore',runtimeLog.fd,runtimeLog.fd],env:{...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(runtimePort),
   NUXT_DB_HOST:'127.0.0.1',NUXT_DB_PORT:String(port),NUXT_DB_USER:'wire_test',NUXT_DB_PASSWORD:secret,NUXT_DB_NAME:'viewer_reverse_oidc_test',
   TAIKO_DB_HOST:'127.0.0.1',TAIKO_DB_PORT:String(port),TAIKO_DB_USER:'wire_test',TAIKO_DB_PASSWORD:secret,TAIKO_DB_NAME:'viewer_reverse_oidc_test',NUXT_OIDC_ENABLED:'0',
   NUXT_ANNUAL_STARTUP_MODE:'owned-qa',TAIKO_TEST_MYSQL_DATADIR:datadir,
   NUXT_REPO_ROOT:runtimeDir+'/repo',NUXT_USERDATA_DIR:runtimeDir+'/userdata',NUXT_TAIKO_CONFIG_PATH:runtimeDir+'/config.json',
   NUXT_ACCOUNT_CACHE_DIR:runtimeDir+'/account-cache',NUXT_ANNUAL_CACHE_DIR:runtimeDir+'/annual-cache',NUXT_VIEWER_CACHE_DIR:runtimeDir+'/viewer-cache'}});
  await runtimeLog.close();const runtimeBase='http://127.0.0.1:'+runtimePort;
  await waitUntil(()=>raw(runtimeBase+'/oidc/.well-known/openid-configuration','GET',{host:'viewer.sakura-bot.cn','x-forwarded-proto':'https'}));
  op=createServer(async(req,res)=>{
   try{
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('request too large');chunks.push(chunk);}
    const body=Buffer.concat(chunks);const result=await raw(runtimeBase+req.url,req.method,req.headers,body);
    if(req.url==='/oidc/token')exchanges.push({headers:{...req.headers},body:body.toString(),token:JSON.parse(result.body)});
    const headers={...result.headers};delete headers['transfer-encoding'];delete headers.connection;
    res.writeHead(result.status,headers);res.end(result.body);
   }catch{res.writeHead(502);res.end('isolated runtime proxy failure');}
  });
  op.listen(0,'127.0.0.1');await once(op,'listening');opBase='http://127.0.0.1:'+op.address().port;
 }else{
 const {createApp,toNodeListener}=require('h3');
 const route=(await import(root+'/server/routes/oidc/[...path].ts')).default;
 const app=createApp();app.use(route);const listener=toNodeListener(app);
 op=createServer((req,res)=>{
  if(req.url==='/oidc/token'){
   const exchange={headers:{...req.headers},body:'',token:null};
   req.on('data',c=>{if(exchange.body.length<8192)exchange.body+=c.toString();});
   const end=res.end;res.end=function(chunk,...args){try{exchange.token=JSON.parse(String(chunk));}catch{}exchanges.push(exchange);return end.call(this,chunk,...args);};
  }
  listener(req,res);
 });op.listen(0,'127.0.0.1');await once(op,'listening');
 opBase=`http://127.0.0.1:${op.address().port}`;
 }
 const disc=await raw(opBase+'/oidc/.well-known/openid-configuration','GET',{'host':'viewer.sakura-bot.cn','x-forwarded-proto':'https'});
 if(disc.status!==200)console.error(disc.body.toString().slice(0,600));
 assert.equal(disc.status,200,'discovery HTTP');const metadata=JSON.parse(disc.body);assert.equal(metadata.issuer,'https://viewer.sakura-bot.cn/oidc');
 assert.deepEqual(metadata.code_challenge_methods_supported,['S256']);
 const jwks=JSON.parse((await raw(opBase+'/oidc/jwks','GET',{'host':'viewer.sakura-bot.cn','x-forwarded-proto':'https'})).body);assert.ok(jwks.keys.length>0&&!jwks.keys.some(k=>k.d));
 const py=child(rp+'/.venv/bin/python',['-m','accounts.tests.sakura_wire_server'],{cwd:rp,env:{...process.env,DJANGO_DEBUG:'true',DJANGO_SECRET_KEY:randomBytes(32).toString('hex'),DJANGO_ALLOWED_HOSTS:'sso.ourtaiko.org,127.0.0.1,localhost',SSO_BASE_URL:'https://sso.ourtaiko.org',SAKURA_REVERSE_OIDC_ENABLED:'true',SAKURA_REVERSE_OIDC_CLIENT_ID:'OurTaiko',SAKURA_REVERSE_OIDC_CLIENT_SECRET:secret,SAKURA_WIRE_DIR:dir,SAKURA_WIRE_OP:opBase}});
 const pyLog=await open(dir+'/rp.log','w');py.stderr.on('data',c=>pyLog.write(c));
 let pyOut='';py.stdout.on('data',c=>{pyOut+=c.toString();});
 const ready=await waitUntil(()=>{const line=pyOut.trim().split('\n').at(-1);return JSON.parse(line);});
 const rpBase=`http://127.0.0.1:${ready.port}`;
 const openssl=child('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',dir+'/tls.key','-out',dir+'/tls.crt','-days','1','-subj','/CN=isolated-oidc-wire']);
 assert.equal((await once(openssl,'exit'))[0],0);
 front=createHttpsServer({key:await readFile(dir+'/tls.key'),cert:await readFile(dir+'/tls.crt')},async(req,res)=>{
  const host=req.headers.host;
  if(!['viewer.sakura-bot.cn','sso.ourtaiko.org'].includes(host)){res.writeHead(403);res.end();return;}
  const path=req.url.split('?')[0];
  if(host==='sso.ourtaiko.org'&&path==='/login/sakura/callback/'){
   lastCallback='https://'+host+req.url;
   if(revokeBeforeCallback&&req.url.includes('code=')){revokeBeforeCallback=false;await db.execute('DELETE FROM web_user_sessions WHERE session_token=?',[session]);}
  }
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('request too large');chunks.push(chunk);}
   const headers={...req.headers,'x-forwarded-proto':'https'};delete headers['content-length'];
   const result=await raw((host==='viewer.sakura-bot.cn'?opBase:rpBase)+req.url,req.method,headers,Buffer.concat(chunks));
   wireRequests.push({host,path,method:req.method,origin:req.headers.origin,contentType:req.headers['content-type'],status:result.status,redirect:result.headers.location?new URL(result.headers.location,'https://'+host).pathname:undefined});
   const out={...result.headers};delete out['transfer-encoding'];delete out['connection'];
   res.writeHead(result.status,out);res.end(result.body);
  }catch{res.writeHead(502);res.end('isolated proxy failure');}
 });
 front.listen(0,'127.0.0.1');await once(front,'listening');
 proxy=createServer((req,res)=>{res.writeHead(403);res.end();});
 proxy.on('connect',(req,socket,head)=>{
  if(!['viewer.sakura-bot.cn:443','sso.ourtaiko.org:443'].includes(req.url)){socket.destroy();return;}
  const remote=connect(front.address().port,'127.0.0.1',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)remote.write(head);socket.pipe(remote);remote.pipe(socket);});
  socket.on('error',()=>remote.destroy());remote.on('error',()=>socket.destroy());socket.on('close',()=>remote.destroy());
 });
 proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,proxy:{server:'http://127.0.0.1:'+proxy.address().port},args:['--no-sandbox','--disable-dev-shm-usage']});
 context=await browser.newContext({ignoreHTTPSErrors:true});context.setDefaultTimeout(15000);
 await context.addCookies([{name:'stv_session',value:session,domain:'viewer.sakura-bot.cn',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
 let lastCallback;
 const page=await context.newPage();
 await page.goto('https://sso.ourtaiko.org/login/');await page.getByText('使用 Sakura Viewer 登录',{exact:true}).click();
 await page.getByRole('heading',{name:'授权 OurTaiko',exact:true}).waitFor();
 await page.screenshot({path:dir+'/consent.png'});
 const cookieHeader=(await context.cookies(page.url())).map(c=>c.name+'='+c.value).join('; ');
 const badCsrf=await raw(opBase+new URL(page.url()).pathname,'POST',{host:'viewer.sakura-bot.cn','x-forwarded-proto':'https',origin:'https://viewer.sakura-bot.cn','content-type':'application/x-www-form-urlencoded',cookie:cookieHeader},'csrf=invalid&decision=allow');assert.equal(badCsrf.status,409);
 await page.getByRole('button',{name:'同意并继续'}).click();
 await page.waitForURL('https://sso.ourtaiko.org/');
 let evidence=await page.evaluate(async()=>await(await fetch('/_wire/evidence')).json());
 assert.equal(evidence.authenticated,true,'RP own authenticated session');assert.equal(evidence.user_id,ready.user_id);assert.equal(evidence.users,1);assert.equal(evidence.links,1);assert.equal(evidence.credentials_and_privileges_unchanged,true);assert.equal(evidence.mapping_unchanged,true);
 const firstCallback=lastCallback;
 assert.ok(exchanges[0]?.token?.id_token,'real code exchange returned signed ID Token');
 const token=exchanges[0].token;
 const userInfo=await raw(opBase+'/oidc/me','GET',{host:'viewer.sakura-bot.cn','x-forwarded-proto':'https',authorization:'Bearer '+token.access_token});
 assert.equal(userInfo.status,200);const claims=JSON.parse(userInfo.body);assert.equal(claims.sub,'9007199254740993');assert.equal(claims.preferred_username,'wire-viewer');assert.equal(claims.email,'viewer@example.test');
 const replay=await raw(opBase+'/oidc/token','POST',exchanges[0].headers,exchanges[0].body);
 assert.equal(replay.status,400);assert.equal(JSON.parse(replay.body).error,'invalid_grant');
 const revoked=await raw(opBase+'/oidc/me','GET',{host:'viewer.sakura-bot.cn','x-forwarded-proto':'https',authorization:'Bearer '+token.access_token});assert.equal(revoked.status,401);

 // A fresh RP browser session repeats authorization, reuses the same precise binding.
 for(const cookie of await context.cookies())if(cookie.domain==='sso.ourtaiko.org')await context.clearCookies({name:cookie.name,domain:cookie.domain});
 await page.goto('https://sso.ourtaiko.org/login/sakura/');await page.getByRole('button',{name:'同意并继续'}).click();await page.waitForURL('https://sso.ourtaiko.org/');
 evidence=await page.evaluate(async()=>await(await fetch('/_wire/evidence')).json());assert.equal(evidence.user_id,ready.user_id);assert.equal(evidence.users,1);assert.equal(evidence.links,1);assert.equal(evidence.credentials_and_privileges_unchanged,true);assert.equal(evidence.mapping_unchanged,true);
 for(const cookie of await context.cookies())if(cookie.domain==='sso.ourtaiko.org')await context.clearCookies({name:cookie.name,domain:cookie.domain});
 await page.goto(firstCallback);assert.match(await page.locator('body').innerText(),/验证未完成/);
 await page.goto('https://sso.ourtaiko.org/login/sakura/');await page.getByRole('button',{name:'取消',exact:true}).click();await page.waitForURL('https://sso.ourtaiko.org/login/sakura/callback/**');assert.match(await page.locator('body').innerText(),/取消 Viewer 授权/);
 // A different Viewer subject with the same RP email cannot create/merge an account.
 const otherSession=randomBytes(32).toString('hex');
 await db.execute('INSERT INTO web_user_accounts VALUES (?,?,?,1)',['9007199254740994','wire-unlinked','wire-linked@example.test']);
 await db.execute('INSERT INTO web_user_sessions VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))',[otherSession,'9007199254740994']);
 await context.addCookies([{name:'stv_session',value:otherSession,domain:'viewer.sakura-bot.cn',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
 await page.goto('https://sso.ourtaiko.org/login/sakura/');await page.getByRole('button',{name:'同意并继续'}).click();
 await page.waitForURL('https://sso.ourtaiko.org/login/sakura/callback/**');assert.match(await page.locator('body').innerText(),/尚未与 OurTaiko 正式关联/);
 evidence=await page.evaluate(async()=>await(await fetch('/_wire/evidence')).json());assert.equal(evidence.authenticated,false);assert.equal(evidence.users,1);assert.equal(evidence.links,1);assert.equal(evidence.credentials_and_privileges_unchanged,true);assert.equal(evidence.mapping_unchanged,true);
 await context.addCookies([{name:'stv_session',value:session,domain:'viewer.sakura-bot.cn',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
 // Switching the Viewer cookie after rendering consent cannot authorize a different account.
 await page.goto('https://sso.ourtaiko.org/login/sakura/');await page.getByRole('heading',{name:'授权 OurTaiko',exact:true}).waitFor();
 await context.addCookies([{name:'stv_session',value:otherSession,domain:'viewer.sakura-bot.cn',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
 const switched=page.waitForResponse(r=>r.request().method()==='POST');await page.getByRole('button',{name:'同意并继续'}).click();assert.equal((await switched).status(),409);
 await context.addCookies([{name:'stv_session',value:session,domain:'viewer.sakura-bot.cn',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
 // Viewer logout/revocation during consent fails before code issuance.
 await page.goto('https://sso.ourtaiko.org/login/sakura/');await page.getByRole('heading',{name:'授权 OurTaiko',exact:true}).waitFor();
 await db.execute('DELETE FROM web_user_sessions WHERE session_token=?',[session]);
 const post=page.waitForResponse(r=>r.request().method()==='POST');await page.getByRole('button',{name:'同意并继续'}).click();assert.equal((await post).status(),401);
 // Revocation after code issuance is also enforced by the token endpoint.
 await db.execute('INSERT INTO web_user_sessions VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))',[session,'9007199254740993']);
 await page.goto('https://sso.ourtaiko.org/login/sakura/');await page.getByRole('heading',{name:'授权 OurTaiko',exact:true}).waitFor();
 revokeBeforeCallback=true;await page.getByRole('button',{name:'同意并继续'}).click();await page.waitForURL('https://sso.ourtaiko.org/login/sakura/callback/**');
 assert.match(await page.locator('body').innerText(),/验证未完成/);assert.equal(exchanges.at(-1).token.error,'invalid_grant');
 const [[counts]]=await db.query('SELECT COUNT(*) n FROM web_user_accounts');assert.equal(Number(counts.n),2);
 const result={kind:'isolated-real-browser-and-library-wire',database:identity.name,discovery:true,publicJwks:true,pkceS256:true,consent:true,authlibSignatureClaimsStateNonce:true,existingAccountLogin:true,repeatLoginSameAccount:true,users:1,links:1,callbackReplayRejected:true,codeSingleUse:true,grantRevocation:true,userInfo:true,unlinkedSameEmailRejected:true,denial:true,csrfRejected:true,sessionSwitchRejected:true,viewerRevocationRejected:true,revokedCodeExchangeRejected:true,bundledNuxt:Boolean(process.env.TAIKO_TEST_NITRO_OUTPUT),artifacts:dir};
 await writeFile(dir+'/result.json',JSON.stringify(result));console.log(JSON.stringify(result));
 await page.close();
}catch(error){
 const p=context?.pages()[0];
 if(p)await writeFile(dir+'/failure.json',JSON.stringify({path:new URL(p.url()).pathname,text:(await p.locator('body').innerText()).slice(0,3000),requests:wireRequests.slice(0,40)}));
 console.error('Private failure evidence',dir);throw error;
}finally{
 clearTimeout(timeout);await context?.close();await browser?.close();if(proxy)await new Promise(r=>proxy.close(r));if(front)await new Promise(r=>front.close(r));if(op)await new Promise(r=>op.close(r));
 const {closeAccountDb}=await import(root+'/server/utils/account-db.ts');await closeAccountDb();await db?.end();
 for(const p of children.reverse())await stop(p);if(datadir)await rm(datadir,{recursive:true,force:true});loader.deregister();
}
