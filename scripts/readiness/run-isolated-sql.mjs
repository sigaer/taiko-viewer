// Run through memory/run_qa.sh. Owns an empty MySQL instance and loopback proxy.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer,createConnection as connectSocket} from 'node:net';
import {mkdtemp,mkdir,open,writeFile,readFile,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import mysql from '../../taiko_viewer/node_modules/mysql2/promise.js';

assert.ok(process.argv.includes('--allow-test-db-mutation'), 'Explicit test mutation opt-in required');
const repo=fileURLToPath(new URL('../../',import.meta.url));
const vault='/home/sigaer/taiko/qa-vault';
const ownedPath=async value=>{assert.ok(value?.startsWith(vault+'/'),'Persistent QA path required');const actual=await realpath(value);assert.ok(actual.startsWith(vault+'/'),'QA path must remain within persistent vault');return actual;};
const evidenceRoot=await ownedPath(process.env.QA_EVIDENCE_DIR);
const runTmp=await ownedPath(process.env.QA_RUN_TMPDIR);
const runDir=await ownedPath(process.env.QA_RUN_DIR);const runId=process.env.QA_RUN_ID;assert.match(runId||'',/^qa-[0-9a-f]{12}$/);assert.equal(runDir,resolve(vault,'runs',runId));assert.equal(evidenceRoot,resolve(runDir,'evidence'));assert.equal(runTmp,resolve(runDir,'scratch'));
const manifestPath=await ownedPath(process.env.QA_ARTIFACT_MANIFEST);
const artifacts=JSON.parse(await readFile(manifestPath,'utf8'));assert.equal(artifacts.schemaVersion,1);
const workspace=await mkdtemp(resolve(evidenceRoot,'viewer1-sql-'));
const scratch=await mkdtemp(resolve(runTmp,'sql-'));
const datadir=resolve(scratch,'mysql');await mkdir(datadir,{mode:0o700});
const socket=resolve(scratch,'m.sock');assert.ok(Buffer.byteLength(socket)<104,'QA scratch path too long for MySQL Unix socket');
const executable='/www/server/mysql/bin/mysqld';
const database='viewer1_security_test';
const python=process.env.TAIKO_PYTHON_EXECUTABLE;
assert.ok(python?.startsWith('/'), 'An absolute installed Taiko Python is required');
const env={PATH:process.env.PATH,TMPDIR:runTmp,QA_RUN_DIR:runDir,QA_RUN_ID:runId,QA_RUN_TMPDIR:runTmp,QA_EVIDENCE_DIR:evidenceRoot,QA_ARTIFACT_MANIFEST:manifestPath,TAIKO_QA_RUN_ID:runId,TAIKO_QA_SCRATCH_DIR:runTmp,TAIKO_QA_EVIDENCE_DIR:evidenceRoot,NODE_OPTIONS:'--max-old-space-size=1536'};
const base=['--no-defaults','--user=root','--basedir=/www/server/mysql',`--datadir=${datadir}`,
 '--innodb-buffer-pool-size=128M','--innodb-log-file-size=32M','--performance-schema=OFF'];
let daemon,daemonExit,proxy,rootConnection;
let stage='initialize';
const sockets=new Set();
const evidence={workspace,scratch,datadir,qaRunTmpdir:runTmp,database,status:'RUNNING',startedAt:new Date().toISOString(),tests:[],productionAccess:false};
async function run(command,args,name,childEnv=env,timeout=120000){
 const log=await open(resolve(workspace,name+'.log'),'w',0o600);
 const child=spawn(command,args,{cwd:repo,env:childEnv,detached:true,stdio:['ignore',log.fd,log.fd]});
 let timer;
 try{return await new Promise((accept,reject)=>{
  timer=setTimeout(()=>{if(child.pid)try{process.kill(-child.pid,'SIGKILL');}catch{}},timeout);
  child.once('error',reject);child.once('close',(code,signal)=>accept({code,signal}));
 });}finally{clearTimeout(timer);await log.close();}
}
try{
 assert.deepEqual(await run(executable,[...base,'--initialize-insecure'],'initialize'),{code:0,signal:null});
 const log=await open(resolve(workspace,'mysql.log'),'w',0o600);
 daemon=spawn(executable,[...base,'--skip-networking','--mysqlx=OFF',`--socket=${socket}`,`--pid-file=${scratch}/mysql.pid`,
  '--max-connections=40','--table-open-cache=128','--log-error-verbosity=2'],{cwd:workspace,env,stdio:['ignore',log.fd,log.fd]});
 daemonExit=new Promise(accept=>{daemon.once('close',(code,signal)=>accept({code,signal}));daemon.once('error',()=>accept({code:null,signal:'SPAWN_ERROR'}));});await log.close();
 daemon.once('error',()=>{});
 for(let i=0;i<120;i++){
  if(daemon.exitCode!==null)throw new Error('Owned MySQL exited before ready');
  try{rootConnection=await mysql.createConnection({socketPath:socket,user:'root',connectTimeout:500});break;}catch{await new Promise(r=>setTimeout(r,250));}
 }
 assert.ok(rootConnection,'Owned MySQL did not become ready');
 const [[server]]=await rootConnection.query('SELECT @@datadir AS datadir');
 assert.equal(await realpath(server.datadir),await realpath(datadir));
 // Empty database provisioning is the sole DDL before a database can be selected.
 await rootConnection.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
 await rootConnection.changeUser({database});
 const [[identity]]=await rootConnection.query('SELECT DATABASE() AS name');
 assert.equal(identity.name,database);assert.match(identity.name,/_test$/);
 console.log('SELECT DATABASE(): '+identity.name);evidence.databaseProof=identity.name;
 const password=randomBytes(32).toString('hex');
 await rootConnection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[randomBytes(32).toString('hex')]);
 await rootConnection.query("CREATE USER 'viewer1_test'@'localhost' IDENTIFIED WITH mysql_native_password BY ?",[password]);
 await rootConnection.query(`GRANT ALL PRIVILEGES ON ${database}.* TO 'viewer1_test'@'localhost'`);
 await rootConnection.end();rootConnection=null;
 proxy=createServer(client=>{
  const upstream=connectSocket(socket);sockets.add(client);sockets.add(upstream);
  client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy());
  client.on('close',()=>{sockets.delete(client);upstream.destroy();});
  upstream.on('close',()=>{sockets.delete(upstream);client.destroy();});
  client.pipe(upstream);upstream.pipe(client);
 });
 await new Promise((accept,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',accept);});
 const port=proxy.address().port;evidence.port=port;
 const testEnv={...env,TAIKO_DB_HOST:'127.0.0.1',TAIKO_DB_PORT:String(port),TAIKO_DB_NAME:database,
  TAIKO_DB_USER:'viewer1_test',TAIKO_DB_PASSWORD:password,TAIKO_ALLOW_TEST_DB_MUTATION:'1',
  TAIKO_TEST_MYSQL_DATADIR:datadir,TAIKO_PYTHON_EXECUTABLE:python,
  TAIKO_PUBLICATION_TEST_REPO_ROOT:runTmp};
 const o1 = process.argv.find(arg=>arg.startsWith('--o1='));
 if (o1) {
  const match=/^--o1=(private-current|private-history|private-merged-current|private-merged-history|growth-history|growth-overview|growth-passport|b30):(1|3|5):(1|3|50|200)$/.exec(o1);
  assert.ok(match,'Explicit bounded O1 operation:concurrency:samples required');
  Object.assign(testEnv,{PYTHONDONTWRITEBYTECODE:'1',TAIKO_O1_OPERATION:match[1],TAIKO_O1_CONCURRENCY:match[2],TAIKO_O1_SAMPLES:match[3],TAIKO_O1_OUTPUT:resolve(workspace,'o1-performance.json')});
  evidence.o1={operation:match[1],concurrency:Number(match[2]),samples:Number(match[3])};
  const scale=process.argv.find(arg=>arg.startsWith('--o1-scale='))?.slice(11)||'all';assert.ok(['all','small','medium','large','extreme'].includes(scale));assert.ok(scale!=='extreme'||match[1]==='growth-passport');testEnv.TAIKO_O1_SCALE=scale;evidence.o1.scale=scale;
  const measurementMode=process.argv.find(arg=>arg.startsWith('--o1-measurement-mode='))?.split('=')[1]||'stream';assert.ok(['stream','buffered-original'].includes(measurementMode));assert.ok(measurementMode!=='buffered-original'||match[1]==='private-history','Buffered diagnostic is restricted to private history');testEnv.TAIKO_O1_MEASUREMENT_MODE=measurementMode;evidence.o1.measurementMode=measurementMode;
  if(process.argv.includes('--o1-stream-check'))testEnv.TAIKO_O1_STREAM_CHECK='1';
  if(process.argv.includes('--o1-baseline')){testEnv.TAIKO_O1_BASELINE='1';evidence.o1.baseline='Taiko 0.14.1; unchanged other 93 locked wheels';}
 }
 await writeFile(resolve(scratch,'test-config.json'),JSON.stringify(testEnv),{mode:0o600});
 stage='bootstrap';
 assert.deepEqual(await run(process.execPath,['taiko_viewer/scripts/bootstrap_source_security_test_db.mjs'],'bootstrap',testEnv),{code:0,signal:null});
 const suites=process.argv.filter(arg=>/^taiko_viewer\/tests\/[A-Za-z0-9]+\.test\.mjs$/.test(arg));
 assert.ok(suites.length>0,'Explicit SQL suites required');
 stage='tests';
 const pattern=process.argv.find(arg=>arg.startsWith('--test-name-pattern='));
 assert.ok(!pattern || pattern.length<=256,'Bounded test name pattern required');
 evidence.testNamePattern=pattern?.slice('--test-name-pattern='.length)??null;
 const result=await run(process.execPath,['--experimental-strip-types','--test','--test-concurrency=1',...(pattern?[pattern]:[]),...suites],'tests',testEnv,600000);
 evidence.tests=suites;evidence.result=result;evidence.status=result.code===0?'PASS':'FAIL';
 if(o1){const measured=JSON.parse(await readFile(testEnv.TAIKO_O1_OUTPUT,'utf8'));evidence.o1.status=measured.status;evidence.o1.summary=measured.summary;console.log(JSON.stringify({o1Status:measured.status,pressureStop:measured.summary?.pressureStop,output:testEnv.TAIKO_O1_OUTPUT}));}
 if(result.code!==0)process.exitCode=1;
}catch(error){evidence.status='FAIL';evidence.error={stage,code:typeof error.code==='string'&&/^[A-Z_0-9]+$/.test(error.code)?error.code:'OWNED_QA_FAILURE'};process.exitCode=1;}
finally{
 await rootConnection?.end().catch(()=>{});
 for(const connection of sockets)connection.destroy();
 if(proxy)await new Promise(accept=>proxy.close(accept));
 if(daemon){
  daemon.kill('SIGTERM');let timer;
  await Promise.race([daemonExit,new Promise(accept=>{timer=setTimeout(()=>{daemon.kill('SIGKILL');accept();},15000);})]);clearTimeout(timer);
  await daemonExit;evidence.daemonExited=true;
 }
 evidence.finishedAt=new Date().toISOString();
 const cg=(await readFile('/proc/self/cgroup','utf8')).trim();evidence.cgroup=cg;
 const path=cg.split('\n').find(line=>line.startsWith('0::'))?.slice(3);
 if(path)evidence.memoryEvents=await readFile('/sys/fs/cgroup'+path+'/memory.events','utf8').catch(()=> 'UNAVAILABLE');
 await writeFile(resolve(workspace,'result.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({status:evidence.status,workspace,daemonExited:evidence.daemonExited,error:evidence.error}));
}
