// Real OurTaiko staging only. Retains the private test DB after every exit.
// Run via memory/run_qa.sh; never invoke the disposable SQL QA runner here.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer as netServer,createConnection as connectSocket} from 'node:net';
import {createServer as httpsServer,request as httpsRequest} from 'node:https';
import {request as httpRequest,get as httpGet} from 'node:http';
import {mkdir,open,readFile,realpath,stat,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {X509Certificate} from 'node:crypto';
import mysql from '../../taiko_viewer/node_modules/mysql2/promise.js';
process.umask(0o077);
const persistent='/var/tmp/taiko-viewer-ourtaiko-staging',priv='/var/tmp/taiko-viewer-oidc-loopback/private';
const issuer='https://sso.ourtaiko.org',origin='https://localhost:8443',callback=origin+'/api/account/oidc/ourtaiko/callback';
const report={application:'Sakura-staging',callback,sourceMain:'eb37e1f044cb68e5987f1dba6422633bba77aa68',version:'1.2.3',pass:false,authorization:'user_explicit_real_link_test_2026-11-03',retention:'retain_both_sides',productionAccess:false,startedAt:new Date().toISOString()};
let daemon,daemonDone,connection,sqlProxy,httpsProxy,host,hostDone,browser,browserDone,lock;
let stage='context';const sockets=new Set();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function privateJson(path){const info=await stat(path);assert.equal(await realpath(path),path);assert.equal(info.uid,process.getuid());assert.equal(info.mode&0o777,0o600);assert.ok(info.size<8192);return JSON.parse(await readFile(path,'utf8'));}
async function until(fn,ms=20000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await pause(100);}throw Error('Staging readiness deadline');}
async function stop(child,done){if(!child)return;child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),10000);try{await done.catch(()=>{});}finally{clearTimeout(timer);}}
async function snapshot(){
 const [[proof]]=await connection.query('SELECT DATABASE() name,@@datadir datadir');assert.equal(proof.name,'viewer_ourtaiko_staging_test');assert.equal(await realpath(proof.datadir),persistent+'/mysql');
 const counts={};for(const table of ['web_user_accounts','web_external_identities','web_user_sessions','web_oidc_remote_link_attempts']){const [[row]]=await connection.query('SELECT COUNT(*) n FROM '+table);counts[table]=row.n;}
 const [rows]=await connection.query(`SELECT CAST(user_id AS CHAR) viewerId,subject,remote_link_operation_id operationId,remote_link_status remoteStatus FROM web_external_identities WHERE provider_id='ourtaiko'`);
 const [attempts]=await connection.query('SELECT operation_id operationId,outcome,error_code errorCode,remote_linked_at linkedAt FROM web_oidc_remote_link_attempts ORDER BY created_at');
 return {database:proof.name,datadir:proof.datadir,counts,identities:rows.map(r=>({...r,subject:r.subject.toString('utf8')})),attempts};
}
try{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');assert.equal(process.env.TAIKO_OURTAIKO_REAL_LINK,'1');
 assert.ok((await readFile('/proc/self/cgroup','utf8')).includes('/development.slice/development-qa.slice/'));
 const scratch=await realpath(process.env.QA_RUN_TMPDIR),run=await realpath(process.env.QA_RUN_DIR);
 assert.equal(scratch,resolve(run,'scratch'));assert.match(run,/\/qa-[0-9a-f]{12}$/);
 lock=await open(persistent+'/private/real-link.lock','wx',0o600);
 const db=await privateJson(persistent+'/private/database.json'),pin=await privateJson(persistent+'/admission.json'),client=await privateJson(priv+'/client.json');
 await privateJson(priv+'/test-account.json');
 assert.equal(client.clientId,'Sakura-staging');assert.ok(client.clientSecret);assert.equal(db.database,'viewer_ourtaiko_staging_test');assert.equal(db.reservedViewerId,pin.reservedViewerId);assert.match(db.reservedViewerId,/^[1-9][0-9]{12}$/);
 const dataInfo=await stat(persistent+'/mysql');assert.equal(dataInfo.dev,pin.device);assert.equal(dataInfo.ino,pin.inode);
 const cert=new X509Certificate(await readFile(priv+'/localhost.crt'));assert.ok(cert.checkHost('localhost'));assert.ok(Date.parse(cert.validTo)>Date.now()+600000);
 stage='persistent-mysql';
 const log=await open(persistent+'/private/real-mysql.log','a',0o600);
 daemon=spawn('/www/server/mysql/bin/mysqld',['--no-defaults','--user=root','--basedir=/www/server/mysql','--datadir='+persistent+'/mysql','--socket='+persistent+'/mysql.sock','--pid-file='+persistent+'/mysql.pid','--skip-networking','--mysqlx=OFF','--innodb-buffer-pool-size=128M','--innodb-log-file-size=16M','--performance-schema=OFF','--skip-log-bin','--max-connections=20','--table-open-cache=128'],{stdio:['ignore',log.fd,log.fd]});daemonDone=once(daemon,'close');await log.close();
 await until(async()=>{assert.equal(daemon.exitCode,null);try{connection=await mysql.createConnection({socketPath:persistent+'/mysql.sock',user:db.dbUser,password:db.dbPassword,database:db.database,connectTimeout:500});return true;}catch{return false;}});
 report.before=await snapshot();
 const verifyOnly=process.env.TAIKO_OURTAIKO_VERIFY_LINKED_LOGIN==='1';
 const recovery=process.env.TAIKO_OURTAIKO_RECOVER_SAME_PAIR==='1'||verifyOnly;report.recovery=recovery;report.verifyOnly=verifyOnly;
 if(recovery){
  const pair=await privateJson(persistent+'/evidence/pair.json'),remote=await privateJson(persistent+'/evidence/first-remote-confirmation.json');
  assert.equal(report.before.counts.web_user_accounts,1);assert.equal(report.before.identities.length,1);
  assert.equal(pair.viewerId,db.reservedViewerId);assert.equal(pair.ownedTestAccountVerified,true);assert.equal(remote.httpStatus,200);
  assert.equal(report.before.identities[0].viewerId,pair.viewerId);assert.equal(report.before.identities[0].subject,pair.ourtaikoSub);
  assert.equal(remote.viewerId,pair.viewerId);assert.equal(remote.ourtaikoSub,pair.ourtaikoSub);assert.equal(report.before.identities[0].remoteStatus,verifyOnly?'linked':'pending');
 }else{
  assert.equal(report.before.counts.web_user_accounts,0,'Fixture already used; resume the same pair explicitly');
  const [[next]]=await connection.execute("SELECT CAST(AUTO_INCREMENT AS CHAR) nextId FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='web_user_accounts'",[db.database]);assert.equal(next.nextId,db.reservedViewerId);
 }
 sqlProxy=netServer(client=>{const up=connectSocket(persistent+'/mysql.sock');for(const s of [client,up]){sockets.add(s);s.on('close',()=>sockets.delete(s));}client.on('error',()=>up.destroy());up.on('error',()=>client.destroy());client.pipe(up);up.pipe(client);});
 await new Promise((yes,no)=>{sqlProxy.once('error',no);sqlProxy.listen(0,'127.0.0.1',yes);});
 const root=resolve(scratch,'ourtaiko-staging');for(const name of ['','userdata','cache','annual','viewer-cache'])await mkdir(resolve(root,name),{recursive:true});
 await writeFile(root+'/config.json','{}');await writeFile(root+'/catalog.json','[]');
 const probe=netServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const env={PATH:process.env.PATH,NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=768',TMPDIR:scratch,
  QA_RUN_ID:process.env.QA_RUN_ID,QA_RUN_DIR:run,QA_RUN_TMPDIR:scratch,QA_EVIDENCE_DIR:process.env.QA_EVIDENCE_DIR,
  TAIKO_OURTAIKO_VERIFY_LINKED_LOGIN:verifyOnly?'1':'0',TAIKO_OURTAIKO_RECOVER_SAME_PAIR:recovery?'1':'0',TAIKO_OIDC_PERSISTENT_STAGING:'1',TAIKO_ALLOW_TEST_DB_MUTATION:'1',TAIKO_TEST_MYSQL_DATADIR:persistent+'/mysql',
  NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_ANNUAL_STARTUP_MODE:'owned-qa',
  NUXT_REPO_ROOT:root,NUXT_USERDATA_DIR:root+'/userdata',NUXT_TAIKO_CONFIG_PATH:root+'/config.json',NUXT_ACCOUNT_CACHE_DIR:root+'/cache',NUXT_ANNUAL_CACHE_DIR:root+'/annual',NUXT_VIEWER_CACHE_DIR:root+'/viewer-cache',NUXT_SONG_DATA_PATH:root+'/catalog.json',
  TAIKO_RUNTIME_ENV_FILE:root+'/absent.env',TAIKO_PYTHON_EXECUTABLE:'/home/sigaer/taiko/.venv/bin/python',
  NUXT_TAIKO_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_ADMIN_API_BASE:'http://127.0.0.1:1',NUXT_TAIKO_TITLE_API_BASE:'http://127.0.0.1:1',NUXT_LOCAL_SYNC_RECEIVER_BASE_URL:'http://127.0.0.1:1',NUXT_BILIBILI_HTTP_PROXY:'http://127.0.0.1:1',NUXT_BILIBILI_SESS_DATA_FILE:root+'/absent-session',
  NUXT_PUBLIC_API_BASE:origin,NUXT_PUBLIC_GUIDE_API_BASE:origin,NUXT_PUBLIC_GOOGLE_ANALYTICS_ID:'',NUXT_MY_TAIKO_READ_MODEL_MODE:'legacy',NUXT_PUBLIC_MY_TAIKO_READ_MODEL_MODE:'legacy',NUXT_DEVELOPER_API_V1:'false',NUXT_PUBLIC_DEVELOPER_API_V1:'false',
  NUXT_OIDC_ENABLED:'1',NUXT_OIDC_PROVIDERS_JSON:JSON.stringify([{id:'ourtaiko',label:'OurTaiko',enabled:true,issuer,clientId:client.clientId,clientSecret:client.clientSecret,tokenEndpointAuthMethod:'client_secret_basic',idTokenSigningAlg:'RS256',scopes:['openid','profile'],redirectUri:callback,remoteLinkEnabled:true}])};
 for(const prefix of ['TAIKO_DB_','NUXT_DB_','NUXT_BOT_DB_'])Object.assign(env,{[prefix+'HOST']:'127.0.0.1',[prefix+'PORT']:String(sqlProxy.address().port),[prefix+'USER']:db.dbUser,[prefix+'PASSWORD']:db.dbPassword,[prefix+'NAME']:db.database});
 const compiled=await readFile(resolve('taiko_viewer/.output/server/chunks/nitro/nitro.mjs'),'utf8');assert.ok(compiled.includes('"appVersion": "1.2.3"'));
 stage='nuxt';const hostLog=await open(persistent+'/private/nuxt.log','w',0o600);
 host=spawn(process.execPath,['--import',resolve('scripts/readiness/ourtaiko-persistent-fetch.mjs'),resolve('taiko_viewer/.output/server/index.mjs')],{cwd:root,env,stdio:['ignore',hostLog.fd,hostLog.fd]});hostDone=once(host,'close');await hostLog.close();
 await until(()=>new Promise(yes=>{assert.equal(host.exitCode,null);const req=httpGet('http://127.0.0.1:'+port+'/api/account/auth/me',res=>{res.resume();yes(res.statusCode===200);});req.on('error',()=>yes(false));req.setTimeout(500,()=>req.destroy());}));
 stage='localhost-tls';
 const paths=new Set(['/','/account/login','/account/profile','/api/account/auth/me','/api/account/auth/logout','/api/account/profile','/api/account/oidc/providers','/api/account/oidc/bindings','/api/account/oidc/ourtaiko/start','/api/account/oidc/ourtaiko/callback']);
 httpsProxy=httpsServer({key:await readFile(priv+'/localhost.key'),cert:await readFile(priv+'/localhost.crt')},(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('referrer-policy','no-referrer');
  let url;try{url=new URL(req.url,origin);}catch{res.writeHead(400);return res.end();}
  if(req.headers.host!=='localhost:8443'||url.origin!==origin||(!paths.has(url.pathname)&&!url.pathname.startsWith('/_nuxt/')&&!/^\/(favicon\.ico|manifest\.webmanifest|sw\.js|workbox-[\w.-]+\.js|pwa-[\w.-]+\.png)$/.test(url.pathname))){res.writeHead(403);return res.end();}
  if(!['GET','HEAD'].includes(req.method)&&!(req.method==='POST'&&['/api/account/oidc/ourtaiko/start','/api/account/auth/logout'].includes(url.pathname))){res.writeHead(403);return res.end();}
  if(req.method==='POST'&&req.headers.origin!==origin){res.writeHead(403);return res.end();}
  const headers={...req.headers,host:'localhost:8443','x-forwarded-proto':'https','x-forwarded-for':'127.0.0.1'};delete headers['x-forwarded-host'];delete headers.forwarded;
  const up=httpRequest({host:'127.0.0.1',port,path:req.url,method:req.method,headers,timeout:40000},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  up.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});up.on('timeout',()=>up.destroy());res.on('close',()=>up.destroy());req.pipe(up);
 });
 httpsProxy.on('tlsClientError',()=>{});httpsProxy.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 await new Promise((yes,no)=>{httpsProxy.once('error',no);httpsProxy.listen(8443,'127.0.0.1',yes);});
 // A trusted local probe establishes availability without starting an authorization.
 const ca=await readFile('/var/tmp/taiko-viewer-oidc-loopback/localhost-ca.crt');
 await new Promise((yes,no)=>{const req=httpsRequest(origin+'/api/account/oidc/providers',{hostname:'127.0.0.1',servername:'localhost',ca,headers:{host:'localhost:8443'},timeout:8000},res=>{res.resume();res.on('end',()=>res.statusCode===200?yes():no(Error('Local HTTPS unavailable')));});req.on('error',no);req.on('timeout',()=>req.destroy(Error('Local HTTPS deadline')));req.end();});
 stage='browser';
 const driver=persistent+'/private/browser.mjs',driverInfo=await stat(driver);
 assert.equal(await realpath(driver),driver);assert.equal(driverInfo.uid,process.getuid());assert.equal(driverInfo.mode&0o777,0o600);
 const browserLog=await open(persistent+'/private/browser.log','w',0o600);
 browser=spawn(process.execPath,[driver],{env:{PATH:process.env.PATH,QA_RUN_ID:process.env.QA_RUN_ID,QA_RUN_TMPDIR:scratch,NODE_EXTRA_CA_CERTS:'/var/tmp/taiko-viewer-oidc-loopback/localhost-ca.crt',STAGING_VERIFY_ONLY:verifyOnly?'1':'0'},stdio:['ignore',browserLog.fd,browserLog.fd]});browserDone=once(browser,'close');await browserLog.close();
 const timer=setTimeout(()=>browser.kill('SIGTERM'),240000);const [code]=await browserDone;clearTimeout(timer);
 report.browserExit=code;report.browser=await privateJson(persistent+'/evidence/browser-result.json');report.after=await snapshot();report.network=await privateJson(persistent+'/evidence/network.json');
 assert.equal(code,0);assert.equal(report.network.link.length,verifyOnly?0:1);if(!verifyOnly)assert.equal(report.network.link[0],200);assert.equal(report.network.lookup.length,recovery?0:1);if(!recovery)assert.equal(report.network.lookup[0],200);
 assert.equal(report.after.counts.web_user_accounts,1);assert.equal(report.after.counts.web_external_identities,1);assert.equal(report.after.counts.web_oidc_remote_link_attempts,report.before.counts.web_oidc_remote_link_attempts+(verifyOnly?0:1));
 assert.equal(report.after.identities[0].viewerId,db.reservedViewerId);assert.equal(report.after.identities[0].remoteStatus,'linked');assert.equal(report.after.attempts.at(-1).outcome,'linked');
 if(recovery)assert.equal(report.after.identities[0].operationId,report.before.identities[0].operationId);
 report.remote=await privateJson(persistent+'/evidence/remote-confirmation.json');assert.equal(report.remote.ourtaikoSub,report.after.identities[0].subject);report.pass=true;
}catch(error){report.error={stage,code:/^[A-Z_0-9]+$/.test(error?.code||'')?error.code:'REAL_STAGING_INCOMPLETE'};process.exitCode=1;}
finally{
 await stop(browser,browserDone);for(const s of sockets)s.destroy();if(httpsProxy)await new Promise(r=>httpsProxy.close(r));
 await stop(host,hostDone);report.nuxtStopped=Boolean(host);
 if(connection){report.final=await snapshot().catch(()=>null);await connection.end().catch(()=>{});}
 if(sqlProxy)await new Promise(r=>sqlProxy.close(r));await stop(daemon,daemonDone);report.mysqlStopped=Boolean(daemon);
 await lock?.close();if(lock)await unlink(persistent+'/private/real-link.lock').catch(()=>{});
 report.databaseRetained=true;report.remoteBindingCleanupAttempted=false;report.stoppedAt=new Date().toISOString();
 await writeFile(persistent+'/evidence/result.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({pass:report.pass,error:report.error||null,evidence:persistent+'/evidence/result.json',databaseRetained:true,nuxtStopped:report.nuxtStopped,mysqlStopped:report.mysqlStopped}));
}
