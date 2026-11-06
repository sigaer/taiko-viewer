import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,open,readFile,writeFile,appendFile,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import mysql from 'mysql2/promise';
import {build} from 'esbuild';

test('isolated SQL: atomic replay, concurrent ingestion, exact 24h dedup, late batches and freshness', {timeout:180000},async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1','Explicit opt-in required');
 const scratch=await realpath(process.env.QA_RUN_TMPDIR||'');assert.ok(scratch.startsWith('/home/sigaer/taiko/qa-vault/runs/'));
 const root=await mkdtemp(resolve(scratch,'traffic-')),datadir=resolve(root,'mysql'),socket=resolve(root,'m.sock');await mkdir(datadir);
 const bin='/www/server/mysql/bin/mysqld';
 const args=['--no-defaults','--user=root','--basedir=/www/server/mysql',`--datadir=${datadir}`,'--innodb-buffer-pool-size=64M','--innodb-log-file-size=32M','--performance-schema=OFF'];
 const log=await open(resolve(process.env.QA_EVIDENCE_DIR,'traffic-mysql.log'),'w',0o600);
 let daemon,exited,admin,pool;
 try{
  const init=spawn(bin,[...args,'--initialize-insecure'],{stdio:['ignore',log.fd,log.fd]});
  assert.equal(await new Promise((res,rej)=>{init.once('error',rej);init.once('exit',res)}),0);
  daemon=spawn(bin,[...args,'--skip-networking','--mysqlx=OFF',`--socket=${socket}`,`--pid-file=${root}/mysql.pid`,'--max-connections=10'],{stdio:['ignore',log.fd,log.fd]});exited=new Promise(r=>daemon.once('exit',r));
  for(let i=0;i<120;i++){try{admin=await mysql.createConnection({socketPath:socket,user:'root'});break}catch{await new Promise(r=>setTimeout(r,250))}}
  assert.ok(admin);const [[dir]]=await admin.query('SELECT @@datadir dir');assert.equal(await realpath(dir.dir),datadir);
  await admin.query('CREATE DATABASE viewer_traffic_test');await admin.query('USE viewer_traffic_test');
  const [[identity]]=await admin.query('SELECT DATABASE() name');assert.ok(identity.name.endsWith('_test'));
  const ddl=await readFile('server/utils/account-schema-definition.ts','utf8');
  for(const table of ['web_admin_access_rollups','web_admin_ingest_state']){const match=ddl.match(new RegExp('`(CREATE TABLE IF NOT EXISTS '+table+' \\([\\s\\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)`'));assert.ok(match);await admin.query(match[1])}
  pool=mysql.createPool({socketPath:socket,user:'root',database:identity.name,connectionLimit:4});
  await build({entryPoints:['server/utils/admin/traffic-store.ts'],outfile:root+'/store.mjs',bundle:true,platform:'node',format:'esm'});
  const {createTrafficStore}=await import(root+'/store.mjs');
  const path=root+'/access.log',store=createTrafficStore(pool,path,['^/$']);
  const now=Date.parse('2026-11-06T03:08:30Z');
  const line=(t,ip='192.0.2.1')=>`${ip} - - [${t} +0800] "GET / HTTP/1.1" 200 5 "-" "Mozilla/5.0"\n`;
  // Just outside/inside the exact minute boundary, same visitor in two hours.
  await writeFile(path,line('05/Nov/2026:11:07:59')+line('05/Nov/2026:11:08:00')+line('06/Nov/2026:10:01:00')+line('06/Nov/2026:11:07:00','192.0.2.2')+line('06/Nov/2026:11:08:00','192.0.2.3'));
  await Promise.all([store.ingest(now),store.ingest(now)]);
  let s=await store.snapshot(now);assert.equal(s.pagePv24h,3);assert.equal(s.pageUv24h,2);assert.equal(s.quality.complete24h,true);assert.equal(s.quality.status,'ready');
  await store.ingest(now);assert.equal((await store.snapshot(now)).pagePv24h,3,'retry is idempotent');
  assert.equal((await store.snapshot(now+180000)).quality.status,'stale');
  for(let i=0;i<19;i++)await appendFile(path,line('06/Nov/2026:11:07:05','192.0.2.2'));
  await store.ingest(now);s=await store.snapshot(now);assert.equal(s.pagePv24h,2);assert.equal(s.quality.suspected24h,20);
  assert.equal(s.quality.rawRequests24h,s.pagePv24h+s.quality.suspected24h+s.quality.excluded24h);
  // A DB failure after rows are written but before checkpoint commit must roll
  // both back. This deliberately fails only the test database's state UPDATE.
  await admin.query("CREATE TRIGGER reject_traffic_state BEFORE UPDATE ON web_admin_ingest_state FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'");
  await appendFile(path,line('06/Nov/2026:11:06:00','192.0.2.4'));
  await assert.rejects(store.ingest(now));assert.equal((await store.snapshot(now)).pagePv24h,2);
  await admin.query('DROP TRIGGER reject_traffic_state');await store.ingest(now);s=await store.snapshot(now);assert.equal(s.pagePv24h,3);assert.equal(s.pageUv24h,2);
  const [[saved]]=await admin.query("SELECT extra_json FROM web_admin_access_rollups LIMIT 1");assert.ok(!saved.extra_json.includes('192.0.2.'));
  console.log('PASS: isolated DB identity, transaction rollback, concurrent lock, replay, window, dedup, reclassification, freshness');
 }finally{
  await pool?.end();await admin?.end();
  if(daemon){daemon.kill('SIGTERM');const timer=setTimeout(()=>daemon.kill('SIGKILL'),10000);await exited;clearTimeout(timer);assert.equal(daemon.exitCode,0,'owned SQL daemon exited cleanly')}
  await log.close();
 }
});
