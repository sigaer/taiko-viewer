// Bounded real-SSO operator session, invoked only by run-isolated-sql.mjs.
// Reuses its empty private MySQL, explicit bootstrap and guarded owned-QA startup.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer as httpsServer, request as httpsRequest} from 'node:https';
import {request as httpRequest, get as httpGet} from 'node:http';
import {createServer as netServer} from 'node:net';
import {mkdir, open, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash, randomBytes, X509Certificate} from 'node:crypto';
import mysql from '../../taiko_viewer/node_modules/mysql2/promise.js';

process.umask(0o077);
const origin='https://localhost:8443',issuer='https://sso.ourtaiko.org';
const callback=origin+'/api/account/oidc/ourtaiko/callback';
const privateRoot='/var/tmp/taiko-viewer-oidc-loopback';
const privateDir=resolve(privateRoot,'private'),clientPath=resolve(privateDir,'client.json');
const caPath=resolve(privateRoot,'localhost-ca.crt');
const report={callback,issuer,viewerVersion:'1.2.1',buildSource:'8b0d425475485fdb3d5d673d73ddb709b7e6b206',pass:false,providerReady:false,remoteLink:'not_requested',productionDataUsed:false};
let db,host,hostDone,proxy,hostLog,stage='context';
const sockets=new Set();
const sessionFingerprints=new Set();
let successfulLoginCallbacks=0;
let cgroupRoot,sampleTimer;
const memory={sampledCgroupMaxBytes:0};
async function sampleMemory(){try{const value=Number(await readFile(resolve(cgroupRoot,'memory.current'),'utf8'));memory.sampledCgroupMaxBytes=Math.max(memory.sampledCgroupMaxBytes,value);}catch{}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(command,args,env=process.env){
 const child=spawn(command,args,{env,stdio:'ignore'});
 const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
 try{const [code]=await once(child,'close');assert.equal(code,0,'Private setup command failed');}
 finally{clearTimeout(timer);}
}
async function localRequest(path,{method='GET',headers={},body}={}){
 const ca=await readFile(caPath);
 return new Promise((accept,reject)=>{
  const req=httpsRequest(origin+path,{ca,servername:'localhost',hostname:'127.0.0.1',method,headers:{host:'localhost:8443',...headers},timeout:12000},res=>{
   let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>262144)res.destroy(Error('Bounded probe'));});
   res.on('end',()=>accept({status:res.statusCode,headers:res.headers,body:text}));res.on('error',reject);
  });
  req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Probe deadline')));req.end(body);
 });
}
try{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const cgroup=(await readFile('/proc/self/cgroup','utf8')).split('\n').find(line=>line.startsWith('0::')).slice(3);
 assert.ok(cgroup.includes('/development.slice/development-qa.slice/'));
 cgroupRoot='/sys/fs/cgroup'+cgroup;await sampleMemory();sampleTimer=setInterval(()=>{void sampleMemory();},500);
 const scratch=await realpath(process.env.QA_RUN_TMPDIR),evidence=await realpath(process.env.QA_EVIDENCE_DIR);
 assert.match(process.env.QA_RUN_ID||'',/^qa-[0-9a-f]{12}$/);
 assert.equal(scratch,resolve('/home/sigaer/taiko/qa-vault/runs',process.env.QA_RUN_ID,'scratch'));
 assert.equal(process.env.TAIKO_DB_HOST,'127.0.0.1');assert.notEqual(Number(process.env.TAIKO_DB_PORT),3306);
 db=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.TAIKO_DB_PORT),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME});
 const [[proof]]=await db.query('SELECT DATABASE() name,@@datadir datadir');
 assert.equal(proof.name,'viewer1_security_test');assert.equal(await realpath(proof.datadir),await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR));
 report.database=proof.name;report.privateDatadirVerified=true;
 assert.equal((await db.query('SELECT COUNT(*) n FROM web_user_accounts'))[0][0].n,0);
 stage='private-files';
 await mkdir(privateDir,{recursive:true,mode:0o700});
 for(const dir of [privateRoot,privateDir]){const info=await stat(dir);assert.equal(info.mode&0o077,0);assert.equal(info.uid,process.getuid());assert.equal(await realpath(dir),dir);}
 try{await writeFile(clientPath,JSON.stringify({clientId:'',clientSecret:''},null,2)+'\n',{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
 const clientInfo=await stat(clientPath);assert.equal(clientInfo.mode&0o077,0);assert.equal(clientInfo.uid,process.getuid());assert.equal(await realpath(clientPath),clientPath);assert.ok(clientInfo.size<8192);
 const credentials=JSON.parse(await readFile(clientPath,'utf8'));
 assert.ok(credentials&&typeof credentials==='object'&&!Array.isArray(credentials));
 assert.deepEqual(Object.keys(credentials).sort(),['clientId','clientSecret']);
 assert.equal(typeof credentials.clientId,'string');assert.equal(typeof credentials.clientSecret,'string');
 assert.ok(credentials.clientId.length<=255&&credentials.clientSecret.length<=4096);
 assert.equal(Boolean(credentials.clientId),Boolean(credentials.clientSecret),'Provide both credentials privately or neither');
 report.providerReady=Boolean(credentials.clientId&&credentials.clientSecret);
 const caKey=resolve(privateDir,'ca.key'),leafKey=resolve(privateDir,'localhost.key'),leafCrt=resolve(privateDir,'localhost.crt');
 try{await stat(caPath);}catch(error){
  if(error.code!=='ENOENT')throw error;
  await run('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',caKey,'-out',caPath,'-days','30','-subj','/CN=Viewer OIDC loopback test CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
 }
 try{await stat(leafCrt);}catch(error){
  if(error.code!=='ENOENT')throw error;
  const csr=resolve(privateDir,'localhost.csr'),ext=resolve(privateDir,'localhost.ext');
  await writeFile(ext,'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  await run('/usr/bin/openssl',['req','-new','-newkey','rsa:2048','-nodes','-keyout',leafKey,'-out',csr,'-subj','/CN=localhost']);
  await run('/usr/bin/openssl',['x509','-req','-in',csr,'-CA',caPath,'-CAkey',caKey,'-set_serial','0x'+randomBytes(16).toString('hex'),'-out',leafCrt,'-days','7','-sha256','-extfile',ext]);
 }
 await run('/usr/bin/openssl',['verify','-CAfile',caPath,leafCrt]);
 const cert=new X509Certificate(await readFile(leafCrt));assert.ok(cert.checkHost('localhost'));assert.ok(Date.parse(cert.validTo)>Date.now()+600000);
 report.caSha256=new X509Certificate(await readFile(caPath)).fingerprint256;
 report.caFileSha256=createHash('sha256').update(await readFile(caPath)).digest('hex');
 stage='explicit-oidc-migration';
 await run(process.execPath,['--experimental-strip-types','taiko_viewer/scripts/migrate_oidc_schema.ts','--apply']);
 report.explicitOidcMigration=true;
 const root=resolve(scratch,'oidc-loopback');
 for(const folder of ['', 'userdata','cache','annual','viewer-cache'])await mkdir(resolve(root,folder),{recursive:true});
 await writeFile(resolve(root,'config.json'),'{}');await writeFile(resolve(root,'catalog.json'),'[]');
 const portProbe=netServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');
 const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));
 const env={PATH:process.env.PATH,NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=512',TMPDIR:scratch,
  QA_RUN_ID:process.env.QA_RUN_ID,QA_RUN_DIR:process.env.QA_RUN_DIR,QA_RUN_TMPDIR:scratch,TAIKO_TEST_MYSQL_DATADIR:process.env.TAIKO_TEST_MYSQL_DATADIR,TAIKO_ALLOW_TEST_DB_MUTATION:'1',
  QA_EVIDENCE_DIR:evidence,
  NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_ANNUAL_STARTUP_MODE:'owned-qa',
  NUXT_REPO_ROOT:root,NUXT_USERDATA_DIR:resolve(root,'userdata'),NUXT_TAIKO_CONFIG_PATH:resolve(root,'config.json'),NUXT_ACCOUNT_CACHE_DIR:resolve(root,'cache'),NUXT_ANNUAL_CACHE_DIR:resolve(root,'annual'),NUXT_VIEWER_CACHE_DIR:resolve(root,'viewer-cache'),NUXT_SONG_DATA_PATH:resolve(root,'catalog.json'),
  TAIKO_RUNTIME_ENV_FILE:resolve(root,'absent.env'),TAIKO_PYTHON_EXECUTABLE:process.env.TAIKO_PYTHON_EXECUTABLE,
  NUXT_TAIKO_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_ADMIN_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_TITLE_API_BASE:'http://127.0.0.1:1',NUXT_LOCAL_SYNC_RECEIVER_BASE_URL:'http://127.0.0.1:1',NUXT_BILIBILI_HTTP_PROXY:'http://127.0.0.1:1',NUXT_BILIBILI_SESS_DATA_FILE:resolve(root,'absent-bilibili-session'),
  NUXT_PUBLIC_API_BASE:origin,NUXT_PUBLIC_GUIDE_API_BASE:origin,NUXT_PUBLIC_GOOGLE_ANALYTICS_ID:'',NUXT_MY_TAIKO_READ_MODEL_MODE:'legacy',NUXT_PUBLIC_MY_TAIKO_READ_MODEL_MODE:'legacy',NUXT_DEVELOPER_API_V1:'false',NUXT_PUBLIC_DEVELOPER_API_V1:'false',
  NUXT_OIDC_ENABLED:report.providerReady?'1':'false',NUXT_OIDC_PROVIDERS_JSON:JSON.stringify([{id:'ourtaiko',label:'OurTaiko',enabled:report.providerReady,issuer,clientId:credentials.clientId,clientSecret:credentials.clientSecret,tokenEndpointAuthMethod:'client_secret_basic',idTokenSigningAlg:'RS256',scopes:['openid','profile'],redirectUri:callback}])};
 for(const prefix of ['TAIKO_DB_','NUXT_DB_','NUXT_BOT_DB_'])for(const suffix of ['HOST','PORT','USER','PASSWORD','NAME'])env[prefix+suffix]=process.env['TAIKO_DB_'+suffix];
 stage='nuxt-start';
 hostLog=await open(resolve(evidence,'oidc-loopback-nuxt.log'),'w',0o600);
 const entry=resolve('taiko_viewer/.output/server/index.mjs');
 const compiled=await readFile(resolve('taiko_viewer/.output/server/chunks/nitro/nitro.mjs'),'utf8');
 assert.ok(compiled.includes('"appVersion": "1.2.1"'),'Existing 1.2.1 build required');
 report.buildEntrySha256=createHash('sha256').update(await readFile(entry)).digest('hex');
 host=spawn(process.execPath,['--import',resolve('scripts/readiness/oidc-loopback-fetch.mjs'),entry],{cwd:root,env,stdio:['ignore',hostLog.fd,hostLog.fd]});hostDone=once(host,'close');
 let ready=false;
 for(let i=0;i<150;i++){
  assert.equal(host.exitCode,null,'Owned Nuxt exited');
  ready=await new Promise(accept=>{const req=httpGet(`http://127.0.0.1:${port}/api/account/auth/me`,res=>{res.resume();accept(res.statusCode===200);});req.on('error',()=>accept(false));req.setTimeout(300,()=>req.destroy());});
  if(ready)break;await sleep(100);
 }
 assert.ok(ready,'Owned Nuxt startup deadline');
 stage='https-proxy';
 const paths=new Set(['/','/account/login','/account/profile','/ja/account/login','/ja/account/profile','/api/account/auth/me','/api/account/auth/login','/api/account/auth/logout','/api/account/profile','/api/account/oidc/providers','/api/account/oidc/bindings','/api/account/oidc/ourtaiko/start','/api/account/oidc/ourtaiko/callback']);
 proxy=httpsServer({key:await readFile(leafKey),cert:await readFile(leafCrt)},(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('referrer-policy','no-referrer');res.setHeader('x-content-type-options','nosniff');
  res.setHeader('content-security-policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; form-action 'self'; base-uri 'self'");
  let url;try{url=new URL(req.url,origin);}catch{res.writeHead(400);return res.end();}
  if(req.headers.host!=='localhost:8443'||url.origin!==origin){res.writeHead(403);return res.end();}
  if(!paths.has(url.pathname)&&!url.pathname.startsWith('/_nuxt/')&&!/^\/(?:favicon\.ico|manifest\.webmanifest|sw\.js|workbox-[\w.-]+\.js|pwa-[\w.-]+\.png)$/.test(url.pathname)){res.writeHead(403);return res.end();}
  if(req.method!=='GET'&&req.method!=='HEAD'&&!(req.method==='POST'&&['/api/account/oidc/ourtaiko/start','/api/account/auth/login','/api/account/auth/logout'].includes(url.pathname))){res.writeHead(403);return res.end();}
  if(req.method==='POST'&&req.headers.origin!==origin){res.writeHead(403);return res.end();}
  const forward=body=>{
   const headers={...req.headers,host:'localhost:8443','x-forwarded-proto':'https','x-forwarded-for':'127.0.0.1'};delete headers['x-forwarded-host'];delete headers.forwarded;
   const up=httpRequest({host:'127.0.0.1',port,path:req.url,method:req.method,headers,timeout:60000},reply=>{
    if(url.pathname==='/api/account/oidc/ourtaiko/callback'&&reply.statusCode===303&&reply.headers.location==='/account/profile'){
     const cookie=reply.headers['set-cookie']?.find(value=>value.startsWith('stv_session='));
     if(cookie){successfulLoginCallbacks++;if(sessionFingerprints.size<128)sessionFingerprints.add(createHash('sha256').update(cookie.split(';')[0]).digest('hex'));}
    }
    res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);
   });
   up.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});up.on('timeout',()=>up.destroy());
   res.on('close',()=>up.destroy());if(body!==undefined)up.end(body);else req.pipe(up);
  };
  // Permit local OIDC login only; no local linking or business sync mutations.
  if(url.pathname==='/api/account/oidc/ourtaiko/start'){
   let body='';req.setEncoding('utf8');req.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy();});
   req.on('end',()=>{try{if(JSON.parse(body).purpose!=='login')throw Error();forward(body);}catch{res.writeHead(403);res.end();}});req.on('error',()=>res.destroy());
  }else forward();
 });
 proxy.requestTimeout=20000;proxy.headersTimeout=15000;proxy.on('tlsClientError',()=>{});
 proxy.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 await new Promise((accept,reject)=>{proxy.once('error',reject);proxy.listen(8443,'127.0.0.1',accept);});
 stage='local-verification';
 const providers=await localRequest('/api/account/oidc/providers');assert.equal(providers.status,200);
 assert.equal(JSON.parse(providers.body).providers.length,report.providerReady?1:0);
 const loginPage=await localRequest('/account/login');assert.equal(loginPage.status,200);assert.match(loginPage.body,/type="password"/);report.loginPageVerified=true;
 const crossOrigin=await localRequest('/api/account/oidc/ourtaiko/start',{method:'POST',headers:{origin:'https://viewer.sakura-bot.cn','content-type':'application/json'},body:'{"purpose":"login"}'});assert.equal(crossOrigin.status,403);
 const sameOrigin=await localRequest('/api/account/oidc/ourtaiko/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"purpose":"login","redirect":"/account/profile"}'});
 assert.equal(sameOrigin.status,report.providerReady?200:404);
 assert.equal((await localRequest('/api/account/oidc/ourtaiko/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"purpose":"link"}'})).status,403);
 assert.equal((await localRequest('/api/account/bindings/prepare',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).status,403);
 const sentinel='LOG_REDACTION_'+randomBytes(12).toString('hex');
 await localRequest('/api/account/oidc/ourtaiko/callback?code='+sentinel+'&state=invalid');
 assert.ok(!(await readFile(resolve(evidence,'oidc-loopback-nuxt.log'),'utf8')).includes(sentinel));
 report.callbackQueryAbsentFromOwnedLogs=true;
 if(report.providerReady){
  const authorization=new URL(JSON.parse(sameOrigin.body).authorizationUrl);assert.equal(authorization.origin,issuer);assert.equal(authorization.searchParams.get('redirect_uri'),callback);assert.equal(authorization.searchParams.get('scope'),'openid profile');assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  const cookie=sameOrigin.headers['set-cookie'].find(c=>c.startsWith('stv_oidc_ourtaiko='));assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Path=\/api\/account\/oidc\/ourtaiko/);
  report.realStartVerified=true;report.cookieFlagsVerified=true;
 }
 report.localTlsVerified=true;report.crossOriginStartDenied=true;report.allowedOrigin=origin;report.accessLogging=false;report.businessMutationsBlocked=true;report.readyAt=new Date().toISOString();
 const duration=Number(process.env.OIDC_LOOPBACK_DURATION_SECONDS);assert.ok(Number.isInteger(duration)&&duration>=15&&duration<=480);
 report.expiresAt=new Date(Date.now()+duration*1000).toISOString();
 await writeFile(resolve(privateRoot,'status.json'),JSON.stringify({...report,status:'READY'},null,2)+'\n',{mode:0o600});
 await writeFile(resolve(evidence,'oidc-loopback-ready.json'),JSON.stringify(report,null,2)+'\n');
 // Public URL/fingerprint/status only. No request, authorization URL, cookie or token logging.
 console.log(JSON.stringify({status:'READY',callback,providerReady:report.providerReady,expiresAt:report.expiresAt,caPath,caSha256:report.caSha256}));
 await sleep(duration*1000);
 stage='account-result';
 const [[accounts]]=await db.query('SELECT COUNT(*) n FROM web_user_accounts');
 const [[identities]]=await db.query('SELECT COUNT(*) n FROM web_external_identities');
 const [[sessions]]=await db.query('SELECT COUNT(*) n FROM web_user_sessions');
 const [[remote]]=await db.query("SELECT COUNT(*) n FROM web_external_identities WHERE remote_link_status<>'not_requested'");assert.equal(remote.n,0);
 report.counts={accounts:accounts.n,identities:identities.n,sessions:sessions.n};report.pass=true;
 report.successfulLoginCallbacks=successfulLoginCallbacks;report.distinctLoginSessions=sessionFingerprints.size;
 report.network=JSON.parse(await readFile(resolve(evidence,'oidc-loopback-network.json'),'utf8'));
 assert.equal(report.network.metadataVerified,true);
 report.realLoginValidated=report.providerReady&&successfulLoginCallbacks>=2&&sessionFingerprints.size>=2&&accounts.n===1&&identities.n===1&&report.network.lookup.ok===1&&report.network.token.ok>=2;
}catch(error){report.error={stage,code:typeof error.code==='string'&&/^[A-Z_0-9]+$/.test(error.code)?error.code:'ISOLATED_LOOPBACK_FAILURE'};process.exitCode=1;}
finally{
 if(proxy){for(const socket of sockets)socket.destroy();await new Promise(r=>proxy.close(r));}
 if(host){host.kill('SIGTERM');const timer=setTimeout(()=>host.kill('SIGKILL'),5000);await hostDone.catch(()=>{});clearTimeout(timer);report.nuxtExited=true;}
 await hostLog?.close();await db?.end();
 clearInterval(sampleTimer);await sampleMemory();
 if(cgroupRoot){memory.events=await readFile(resolve(cgroupRoot,'memory.events'),'utf8').catch(()=>null);memory.kernelPeakBytes=await readFile(resolve(cgroupRoot,'memory.peak'),'utf8').then(Number).catch(()=>null);}
 report.memory=memory;
 report.stoppedAt=new Date().toISOString();report.listenerClosed=true;
 if(process.env.QA_EVIDENCE_DIR)await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'oidc-loopback-result.json'),JSON.stringify(report,null,2)+'\n').catch(()=>{});
 await writeFile(resolve(privateRoot,'status.json'),JSON.stringify({...report,status:'STOPPED'},null,2)+'\n').catch(()=>{});
 console.log(JSON.stringify({status:report.pass?'PASS':'FAIL',callback,providerReady:report.providerReady,error:report.error,nuxtExited:report.nuxtExited,listenerClosed:true}));
}
