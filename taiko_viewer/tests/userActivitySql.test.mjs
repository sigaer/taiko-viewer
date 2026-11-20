// Run via scripts/memory/run_qa.sh with TAIKO_ALLOW_TEST_DB_MUTATION=1. Owns an
// empty private MySQL (Unix socket + loopback proxy for the migration CLI), as in
// adminTrafficSql.test.mjs and scripts/readiness/run-isolated-sql.mjs. Synthetic
// data only; no environment DB settings are read or inherited.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {createServer,createConnection as connectSocket} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,mkdir,open,realpath,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import mysql from 'mysql2/promise';
import {createApp,createRouter,defineEventHandler,toNodeListener} from 'h3';
import {installGoalSqlRuntime} from './fixtures/goalSqlRuntime.mjs';

const viewerRoot=fileURLToPath(new URL('../',import.meta.url));
const migrationPath=fileURLToPath(new URL('../scripts/migrate_user_activity_schema.ts',import.meta.url));
const hex=value=>createHash('sha256').update(value).digest('hex');
const waitFor=async(check,label,ms=5000)=>{const end=Date.now()+ms;for(;;){const value=await check();if(value)return value;if(Date.now()>end)throw new Error('Timed out: '+label);await new Promise(r=>setTimeout(r,50));}};

test('isolated SQL: user activity migration, visit recording, account activity, DAU/WAU/MAU, audit filter and retention',{timeout:240000},async t=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1','Explicit opt-in required');
 const scratch=await realpath(process.env.QA_RUN_TMPDIR||'');assert.ok(scratch.startsWith('/home/sigaer/taiko/qa-vault/runs/'));
 const root=await mkdtemp(resolve(scratch,'activity-')),datadir=resolve(root,'mysql'),socket=resolve(root,'m.sock');await mkdir(datadir);
 assert.ok(Buffer.byteLength(socket)<104,'QA scratch path too long for MySQL Unix socket');
 const bin='/www/server/mysql/bin/mysqld';
 const args=['--no-defaults','--user=root','--basedir=/www/server/mysql',`--datadir=${datadir}`,'--innodb-buffer-pool-size=64M','--innodb-log-file-size=32M','--performance-schema=OFF'];
 const log=await open(resolve(process.env.QA_EVIDENCE_DIR,'user-activity-mysql.log'),'w',0o600);
 const database='viewer_user_activity_test',nonTestDatabase='viewer_user_activity_staging';
 const sockets=new Set();const checks=[];
 let daemon,exited,admin,pool,proxy,server,uninstall;
 try{
  const init=spawn(bin,[...args,'--initialize-insecure'],{stdio:['ignore',log.fd,log.fd]});
  assert.equal(await new Promise((res,rej)=>{init.once('error',rej);init.once('exit',res)}),0);
  daemon=spawn(bin,[...args,'--skip-networking','--mysqlx=OFF',`--socket=${socket}`,`--pid-file=${root}/mysql.pid`,'--max-connections=20'],{stdio:['ignore',log.fd,log.fd]});exited=new Promise(r=>daemon.once('exit',r));
  for(let i=0;i<120;i++){try{admin=await mysql.createConnection({socketPath:socket,user:'root'});break}catch{await new Promise(r=>setTimeout(r,250))}}
  assert.ok(admin);const [[dir]]=await admin.query('SELECT @@datadir dir');assert.equal(await realpath(dir.dir),datadir);
  await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);await admin.query(`CREATE DATABASE ${nonTestDatabase} CHARACTER SET utf8mb4`);
  pool=mysql.createPool({socketPath:socket,user:'root',database,connectionLimit:4});
  const [[identity]]=await pool.query('SELECT DATABASE() name,@@datadir dir');assert.equal(identity.name,database);assert.ok(identity.name.endsWith('_test'));assert.equal(await realpath(identity.dir),datadir);

  // Loopback TCP proxy to the owned socket: the migration CLI only takes host/port.
  proxy=createServer(client=>{
   const upstream=connectSocket(socket);sockets.add(client);sockets.add(upstream);
   client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy());
   client.on('close',()=>{sockets.delete(client);upstream.destroy();});
   upstream.on('close',()=>{sockets.delete(upstream);client.destroy();});
   client.pipe(upstream);upstream.pipe(client);
  });
  await new Promise((accept,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',accept);});
  const port=proxy.address().port;
  // Explicit env only: never inherit TAIKO_DB_* or credentials from the caller.
  const migrate=(flags,{name=database,optIn=true,extra={}}={})=>new Promise(res=>execFile(process.execPath,['--experimental-strip-types',migrationPath,...flags],{
   cwd:viewerRoot,timeout:60000,maxBuffer:65536,
   env:{PATH:process.env.PATH,TMPDIR:root,TAIKO_DB_HOST:'127.0.0.1',TAIKO_DB_PORT:String(port),TAIKO_DB_USER:'root',TAIKO_DB_NAME:name,...(optIn?{TAIKO_ALLOW_TEST_DB_MUTATION:'1'}:{}),...extra}
  },(error,stdout,stderr)=>res({code:error?(typeof error.code==='number'?error.code:1):0,stdout:String(stdout),stderr:String(stderr)})));
  const tablesIn=async name=>{const [rows]=await pool.query("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN ('web_user_daily_activity','web_daily_visitors') ORDER BY TABLE_NAME",[name]);return rows.map(r=>r.name);};

  const runtime={dbHost:'127.0.0.1',dbPort:'1',dbName:database,repoRoot:resolve(root,'synthetic-repo'),userdataDir:resolve(root,'synthetic-userdata'),accountCacheDir:resolve(root,'synthetic-cache'),public:{},myTaikoReadModelMode:'legacy',annualStartupMode:'normal'};
  const activityFailures=[];let visitGate=null,activeVisitWrites=0,peakVisitWrites=0;
  const db={query:(...a)=>pool.query(...a),async execute(sql,params){try{return await pool.execute(sql,params);}catch(error){if(sql.includes('web_user_daily_activity'))activityFailures.push(error.code||'unknown');throw error;}},async getConnection(){
   const connection=await pool.getConnection();if(!visitGate)return connection;
   return {query:connection.query.bind(connection),release:connection.release.bind(connection),async execute(sql,params){
    if(sql.includes('INSERT INTO web_daily_visitors')){activeVisitWrites++;peakVisitWrites=Math.max(peakVisitWrites,activeVisitWrites);try{await visitGate;}finally{activeVisitWrites--;}}
    return connection.execute(sql,params);
   }};
  }};
  uninstall=installGoalSqlRuntime(db,runtime,{withControlledMail:true});
  const {CREATE_TABLES}=await import('../server/utils/account-schema-definition.ts');
  for(const sql of CREATE_TABLES)if(['web_user_accounts','web_user_sessions','web_admin_action_logs','web_admin_ingest_state'].some(name=>sql.startsWith('CREATE TABLE IF NOT EXISTS '+name+' (')))await pool.execute(sql);
  const {activityDayKey,shiftDayKey,recordDailyActivity,createDailyActivityMemo}=await import('../server/services/user-activity/daily-activity.ts');
  const {recordVisit,visitKey}=await import('../server/services/user-activity/visit-recorder.ts');
  const {readDailyActivityStats,dauSummaryFields}=await import('../server/services/user-activity/activity-stats.ts');
  const {getAccountUserFromEvent}=await import('../server/utils/account/auth.ts');
  const {listAdminActionLogs}=await import('../server/utils/admin/audit.ts');
  const users={};for(const name of ['ua-one','ua-two','ua-three']){const [r]=await pool.execute("INSERT INTO web_user_accounts(username,email,password_hash) VALUES (?,?,'synthetic-no-login')",[name,name+'@example.invalid']);users[name]=r.insertId;}

  await t.test('migration refuses without opt-in, on a non-_test DB and with a test-named production expectation; inspect fails before apply',async()=>{
   let r=await migrate(['--apply'],{optIn:false});assert.notEqual(r.code,0);assert.match(r.stderr,/Explicit test mutation opt-in required/);
   r=await migrate(['--apply'],{name:nonTestDatabase});assert.notEqual(r.code,0);assert.match(r.stderr,/Actual isolated _test database required/);
   assert.deepEqual(await tablesIn(nonTestDatabase),[]);
   r=await migrate(['--production','--apply'],{extra:{TAIKO_ACTIVITY_EXPECTED_DATABASE:database,TAIKO_ALLOW_ACTIVITY_PRODUCTION_MIGRATION:'1'}});assert.notEqual(r.code,0);assert.match(r.stderr,/non-test production DB expectation required/);
   r=await migrate([]);assert.notEqual(r.code,0,'inspect reports missing tables');
   assert.deepEqual(await tablesIn(database),[]);checks.push('migration guards');
  });

  await t.test('migration creates both tables, seeds once from session last_seen_at by Beijing day, and is a no-op when re-run',async()=>{
   const session=(user,lastSeen)=>pool.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at,last_seen_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY),?)',[randomBytes(32).toString('hex'),user,lastSeen]);
   // last_seen_at is Beijing wall-clock text: 23:30 and 00:10 are different days.
   await session(users['ua-one'],'2026-11-18 08:00:00');await session(users['ua-one'],'2026-11-18 23:30:00');await session(users['ua-two'],'2026-11-19 00:10:00');
   let r=await migrate(['--apply']);assert.equal(r.code,0,r.stderr);
   let out=JSON.parse(r.stdout.trim().split('\n').pop());assert.equal(out.database,database);assert.equal(out.action,'apply');assert.equal(out.valid,true);assert.equal(out.seededRows,2);
   assert.deepEqual(await tablesIn(database),['web_daily_visitors','web_user_daily_activity']);
   const seeded=async()=>(await pool.query("SELECT DATE_FORMAT(day,'%Y-%m-%d') day,user_id,DATE_FORMAT(first_seen_at,'%Y-%m-%d %H:%i:%s') first FROM web_user_daily_activity ORDER BY day,user_id"))[0].map(x=>({...x}));
   const expected=[{day:'2026-11-18',user_id:users['ua-one'],first:'2026-11-18 08:00:00'},{day:'2026-11-19',user_id:users['ua-two'],first:'2026-11-19 00:10:00'}];
   assert.deepEqual(await seeded(),expected);
   await session(users['ua-three'],'2026-11-17 12:00:00');
   r=await migrate(['--apply']);assert.equal(r.code,0,r.stderr);out=JSON.parse(r.stdout.trim().split('\n').pop());assert.equal(out.seededRows,0);
   assert.deepEqual(await seeded(),expected,'seed only runs on an empty table');
   r=await migrate([]);assert.equal(r.code,0,r.stderr);assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).action,'inspect');
   assert.deepEqual(await tablesIn(nonTestDatabase),[]);checks.push('migration apply, seed, idempotence');
  });

  const salt=randomBytes(32).toString('hex'),now=new Date('2026-11-19T04:00:00Z'),T=activityDayKey(now);
  assert.equal(T,'2026-11-19');

  await t.test('visit recording: one row per device per day, user attach without null overwrite, HMAC-only keys, 90-day purge',async()=>{
   // Purge runs on the first recordVisit of the process for the day; seed old rows first.
   assert.equal(shiftDayKey(T,-90),'2026-08-21');
   for(const day of ['2026-08-19','2026-08-20','2026-08-21','2026-08-22'])await pool.execute('INSERT INTO web_daily_visitors(day,visitor_key,ip_key) VALUES (?,?,?)',[day,hex('old-'+day),hex('old-ip')]);
   const device='3f2b8c1e-9a4d-4c7e-8b1a-2d3e4f5a6b7c',ip='198.51.100.7';
   assert.equal(await recordVisit(pool,{salt,deviceId:device,ip,userId:null,now}),true);
   const [old]=await pool.query("SELECT DATE_FORMAT(day,'%Y-%m-%d') day FROM web_daily_visitors WHERE ip_key=? ORDER BY day",[hex('old-ip')]);
   assert.deepEqual(old.map(r=>r.day),['2026-08-21','2026-08-22'],'rows older than 90 days removed, newer kept');
   assert.equal(await recordVisit(pool,{salt,deviceId:device,ip,userId:null,now}),true);
   const rowsFor=async()=>(await pool.query('SELECT * FROM web_daily_visitors WHERE day=? AND visitor_key=?',[T,visitKey(salt,'device',device)]))[0];
   let rows=await rowsFor();assert.equal(rows.length,1);assert.equal(rows[0].user_id,null);
   await recordVisit(pool,{salt,deviceId:device,ip,userId:users['ua-one'],now});rows=await rowsFor();assert.equal(rows.length,1);assert.equal(Number(rows[0].user_id),users['ua-one']);
   await recordVisit(pool,{salt,deviceId:device,ip,userId:null,now});rows=await rowsFor();assert.equal(Number(rows[0].user_id),users['ua-one'],'anonymous resend keeps user_id');
   const [all]=await pool.query('SELECT * FROM web_daily_visitors WHERE day=?',[T]);
   for(const row of all){assert.match(row.visitor_key,/^[0-9a-f]{64}$/);assert.match(row.ip_key,/^[0-9a-f]{64}$/);}
   assert.equal(rows[0].ip_key,visitKey(salt,'ip',ip));
   const dump=JSON.stringify(all);assert.ok(!dump.includes(device)&&!dump.includes(device.replaceAll('-',''))&&!dump.includes(ip),'no plain device id or IP stored');
   checks.push('visit upsert, attach, HMAC keys, retention purge');
  });

  await t.test('suspect devices: the 21st new device is suspect (devices 1-20 count)',async()=>{
   const ip='203.0.113.9',ids=Array.from({length:22},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
   const results=await Promise.all(ids.map(deviceId=>recordVisit(pool,{salt,deviceId,ip,userId:null,now})));
   assert.ok(results.every(Boolean),'concurrent visits record successfully');
   const flag=async id=>(await pool.query('SELECT is_suspect FROM web_daily_visitors WHERE day=? AND visitor_key=?',[T,visitKey(salt,'device',id)]))[0][0].is_suspect;
   const [counted]=await pool.query('SELECT visitor_key FROM web_daily_visitors WHERE day=? AND ip_key=? AND is_suspect=0',[T,visitKey(salt,'ip',ip)]);
   assert.equal(counted.length,20,'concurrent admission still counts exactly 20 devices');
   const early=ids.find(id=>visitKey(salt,'device',id)===counted[0].visitor_key);
   await recordVisit(pool,{salt,deviceId:early,ip,userId:null,now});assert.equal(await flag(early),0,'resend of an early device stays counted');
   const [[n]]=await pool.query('SELECT COUNT(*) total FROM web_daily_visitors WHERE day=? AND ip_key=?',[T,visitKey(salt,'ip',ip)]);assert.equal(Number(n.total),22);
   checks.push('per-IP suspect cap');
  });

  await t.test('account activity: one row per user per day via getAccountUserFromEvent; a missing table never breaks auth',async()=>{
   await pool.execute('DELETE FROM web_user_daily_activity');
   const token=async user=>{const value=randomBytes(32).toString('hex');await pool.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))',[value,user]);return value;};
   const router=createRouter();router.get('/whoami',defineEventHandler(async event=>{const user=await getAccountUserFromEvent(event);return {id:user?Number(user.id):null};}));
   server=createHttpServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');
   const base='http://127.0.0.1:'+server.address().port;
   const whoami=async value=>{const res=await fetch(base+'/whoami',{headers:{cookie:'stv_session='+value},signal:AbortSignal.timeout(10000)});assert.equal(res.status,200);return (await res.json()).id;};
   const one=await token(users['ua-one']);
   const dayBefore=activityDayKey(new Date());
   assert.equal(await whoami(one),users['ua-one']);
   const countFor=async user=>Number((await pool.query('SELECT COUNT(*) total FROM web_user_daily_activity WHERE user_id=?',[user]))[0][0].total);
   await waitFor(async()=>await countFor(users['ua-one'])===1,'activity row');
   assert.equal(await whoami(one),users['ua-one']);await new Promise(r=>setTimeout(r,300));
   assert.equal(await countFor(users['ua-one']),1);
   const [[row]]=await pool.query("SELECT DATE_FORMAT(day,'%Y-%m-%d') day FROM web_user_daily_activity WHERE user_id=?",[users['ua-one']]);
   assert.ok([dayBefore,activityDayKey(new Date())].includes(row.day),'Beijing day of the request');
   // The table's primary key also holds when the in-process memo is bypassed.
   const memo=()=>createDailyActivityMemo();
   assert.equal(await recordDailyActivity(pool,users['ua-two'],now,memo()),true);assert.equal(await recordDailyActivity(pool,users['ua-two'],now,memo()),true);
   assert.equal(Number((await pool.query('SELECT COUNT(*) total FROM web_user_daily_activity WHERE user_id=? AND day=?',[users['ua-two'],T]))[0][0].total),1);
   await pool.execute('RENAME TABLE web_user_daily_activity TO web_user_daily_activity_off');
   try{
    const three=await token(users['ua-three']);
    assert.equal(await whoami(three),users['ua-three'],'auth still succeeds');
    await waitFor(()=>activityFailures.includes('ER_NO_SUCH_TABLE'),'activity write attempted and failed');
    assert.equal(await recordDailyActivity(pool,users['ua-three'],now,memo()),false,'helper resolves false, never rejects');
   }finally{await pool.execute('RENAME TABLE web_user_daily_activity_off TO web_user_daily_activity');}
   checks.push('account activity write, uniqueness, failure isolation');
  });

  await t.test('real visit endpoint acknowledges writes, retries after DB recovery and bounds request admission',async()=>{
   const {default:visitHandler}=await import('../server/api/metrics/visit.post.ts');
   await pool.execute('INSERT INTO web_admin_ingest_state(source_key,state_json) VALUES (?,?)',['viewer_access_v2',JSON.stringify({salt})]);
   if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
   const router=createRouter();router.post('/api/metrics/visit',visitHandler);
   server=createHttpServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');
   const base='http://127.0.0.1:'+server.address().port;
   const device='22222222-2222-4222-8222-222222222222';
   const post=(body={d:device},extra={})=>fetch(base+'/api/metrics/visit',{method:'POST',headers:{'sec-fetch-site':'same-origin','user-agent':'Mozilla/5.0 TestBrowser','content-type':'application/json','x-real-ip':'198.51.100.70',...extra},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   assert.equal((await post({}, {'sec-fetch-site':'cross-site'})).status,204);
   assert.equal((await post({}, {'user-agent':'curl/8'})).status,204);
   assert.equal((await post({})).status,204);
   await pool.execute('RENAME TABLE web_daily_visitors TO web_daily_visitors_off');
   try{assert.equal((await post()).status,503,'failed persistence is not acknowledged');}
   finally{await pool.execute('RENAME TABLE web_daily_visitors_off TO web_daily_visitors');}
   const token=randomBytes(32).toString('hex');await pool.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))',[token,users['ua-one']]);
   assert.equal((await post(undefined,{cookie:'stv_session='+token})).status,204);
   assert.equal((await post(undefined,{cookie:'stv_session='+token})).status,204);
   const [rows]=await pool.query('SELECT user_id FROM web_daily_visitors WHERE day=? AND visitor_key=?',[activityDayKey(),visitKey(salt,'device',device)]);
   assert.equal(rows.length,1);assert.equal(Number(rows[0].user_id),users['ua-one']);
   for(let i=0;i<60;i++)assert.equal((await post({}, {'x-real-ip':'198.51.100.71'})).status,204);
   const limited=await post({}, {'x-real-ip':'198.51.100.71'});assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));
   let release;visitGate=new Promise(r=>release=r);
   const calls=Array.from({length:24},(_,i)=>post({d:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`},{'x-real-ip':`198.51.100.${100+i}`}));
   try{
    await waitFor(()=>activeVisitWrites===4,'owned pool saturated by visit writes');
    await new Promise(r=>setTimeout(r,100));
   }finally{release();visitGate=null;}
   const responses=await Promise.all(calls);
   assert.ok(responses.filter(r=>r.status===503).length>=8,'requests beyond the 16-slot limit do not queue database work');
   assert.ok(responses.some(r=>r.status===204));assert.ok(peakVisitWrites<=16);
   checks.push('real visit endpoint, recovery, session attribution, rate limit, bounded admission');
  });

  await t.test('DAU/WAU/MAU on a fixed fixture: union dedup, suspect excluded, device linked in window counts once, null before dauSince',async()=>{
   await pool.execute('DELETE FROM web_user_daily_activity');await pool.execute('DELETE FROM web_daily_visitors');
   const d=n=>shiftDayKey(T,-n),k=name=>hex('fixture-'+name);
   for(const [day,user] of [[d(0),101],[d(1),102],[d(12),104],[d(35),105]])await pool.execute('INSERT INTO web_user_daily_activity(day,user_id) VALUES (?,?)',[day,user]);
   for(const [day,key,ip,user,suspect] of [
    [d(0),'A','x',101,0],            // logged-in user also seen via account activity
    [d(0),'B','x',null,0],[d(1),'B','x',null,0], // anonymous device, two days
    [d(0),'S','y',null,1],           // suspect device: excluded
    [d(0),'C','x',null,0],[d(3),'C','z',103,0],   // linked to 103 on T-3, anonymous today
    [d(10),'D','x',null,0]           // first beacon day = dauSince
   ])await pool.execute('INSERT INTO web_daily_visitors(day,visitor_key,ip_key,user_id,is_suspect) VALUES (?,?,?,?,?)',[day,k(key),k('ip-'+ip),user,suspect]);
   const stats=await readDailyActivityStats(pool,now);
   assert.equal(stats.since,'2026-11-09');
   // Today: u101 (activity + device A), dB, dC -> 3; logged in 1; anonymous 2.
   assert.equal(stats.dauToday,3);assert.equal(stats.dauLoggedIn,1);assert.equal(stats.dauAnonymous,2);
   // Yesterday: u102, dB.
   assert.equal(stats.dauYesterday,2);
   // 7 days (>= 11-13): u101, u102, dB, u103 (device C both days) -> 4.
   assert.equal(stats.wau7d,4);
   // 30 days (>= 10-21): + dD (11-09), u104 (11-07); u105 (10-15) outside -> 6.
   assert.equal(stats.mau30d,6);
   assert.equal(stats.suspectDevicesToday,1);
   assert.equal(stats.activeOn(d(3)),1);assert.equal(stats.activeOn(d(10)),1);
   assert.equal(stats.activeOn(d(12)),null,'before dauSince: not counted, not 0');
   assert.deepEqual(stats.days,['2026-11-09','2026-11-16','2026-11-18','2026-11-19']);
   assert.deepEqual(dauSummaryFields(stats),{dauToday:3,dauYesterday:2,dauLoggedIn:1,dauAnonymous:2,wau7d:4,mau30d:6,suspectDevicesToday:1});
   const allNull={dauToday:null,dauYesterday:null,dauLoggedIn:null,dauAnonymous:null,wau7d:null,mau30d:null,suspectDevicesToday:null};
   for(const table of ['web_daily_visitors','web_user_daily_activity']){
    await pool.execute(`RENAME TABLE ${table} TO ${table}_off`);
    try{const missing=await readDailyActivityStats(pool,now);assert.equal(missing,null);assert.deepEqual(dauSummaryFields(missing),allNull);}
    finally{await pool.execute(`RENAME TABLE ${table}_off TO ${table}`);}
   }
   checks.push('DAU/WAU/MAU fixture, dauSince, missing tables');
  });

  await t.test("audit excludeActions ['read'] hides read rows",async()=>{
   for(const action of ['read','update','read','create'])await pool.execute("INSERT INTO web_admin_action_logs(actor_type,source,target_type,target_key,action) VALUES ('admin','viewer','synthetic','k',?)",[action]);
   const allRows=await listAdminActionLogs({page:1,pageSize:10});assert.equal(allRows.total,4);
   const filtered=await listAdminActionLogs({page:1,pageSize:10,excludeActions:['read']});
   assert.equal(filtered.total,2);assert.deepEqual(filtered.items.map(i=>i.action).sort(),['create','update']);
   checks.push('audit exclude filter');
  });

  await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'user-activity-sql.json'),JSON.stringify({pass:true,database:identity.name,actualSelectDatabase:true,privateDatadirVerified:true,checks,productionConnections:0,productionWrites:0,credentialsRecorded:false},null,2)+'\n');
  console.log('PASS: '+checks.join('; '));
 }finally{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  uninstall?.();
  await pool?.end();await admin?.end();
  for(const connection of sockets)connection.destroy();
  if(proxy)await new Promise(r=>proxy.close(r));
  if(daemon){daemon.kill('SIGTERM');const timer=setTimeout(()=>daemon.kill('SIGKILL'),10000);await exited;clearTimeout(timer);assert.equal(daemon.exitCode,0,'owned SQL daemon exited cleanly')}
  await log.close();
 }
});
