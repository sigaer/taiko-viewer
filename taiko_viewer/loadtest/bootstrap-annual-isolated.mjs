#!/usr/bin/env node
// Invoked by run_qa.sh; owns a fresh mysqld and candidate service, never production.
import assert from 'node:assert/strict';
import { spawn,execFileSync } from 'node:child_process';
import { mkdir,writeFile,readFile,realpath,open } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import {build} from 'esbuild';
import {symlink} from 'node:fs/promises';
import { seedAnnualFixtures } from './annual-fixtures.mjs';
import { assertTestDatabaseMutationAllowed } from '../scripts/annual_test_db_guard.mjs';
const root=await realpath(process.argv[2]);
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
assert.ok(root.startsWith('/var/tmp/annual-test-'));
assert.ok((await realpath(`${root}/mysql`)).startsWith(root+'/'));
const sockets=execFileSync('ss',['-lnt'],{encoding:'utf8'});assert.ok(!/:33179\s|:33180\s/.test(sockets),'Owned test ports are already in use');
const viewer=`${root}/source/taiko-forum/taiko_viewer`;
const port=33179,webPort=33180,unit=`annual-test-candidate-${process.pid}`;
const ownerUnit=(await readFile('/proc/self/cgroup','utf8')).trim().split('/').at(-1);assert.match(ownerUnit,/^taiko-qa-.*\.service$/,'Use run_qa.sh');
const children=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));let stopping=false;
async function stop(){if(stopping)return;stopping=true;try{execFileSync('systemctl',['stop',unit],{stdio:'ignore'});}catch{};for(const p of children)p.kill('SIGTERM');}
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
for(const d of ['userdata','cache','admission','tmp','account-cache','results','evidence'])await mkdir(`${root}/${d}`,{recursive:true,mode:0o700});
await writeFile(`${root}/config.json`,'{}',{mode:0o600});
await writeFile(`${root}/runtime.env`,'',{mode:0o600});
try {
 const mysqlLog=await open(`${root}/evidence/mysql.log`,'a');
 const mysqld=spawn('/www/server/mysql/bin/mysqld',['--no-defaults','--user=root',`--datadir=${root}/mysql`,`--socket=${root}/mysql.sock`,`--pid-file=${root}/mysql.pid`,`--port=${port}`,'--bind-address=127.0.0.1','--mysqlx=OFF','--innodb-buffer-pool-size=128M','--max-connections=30',`--tmpdir=${root}/tmp`,`--log-error=${root}/evidence/mysql-error.log`],{stdio:['ignore',mysqlLog.fd,mysqlLog.fd]});children.push(mysqld);
 let admin;
 for(let i=0;i<40;i++){try{admin=await mysql.createConnection({socketPath:`${root}/mysql.sock`,user:'root'});break;}catch{await sleep(500);}}
 assert.ok(admin&&mysqld.exitCode===null,'owned MySQL did not start');
 const [[identity]]=await admin.query('SELECT @@datadir AS dir,@@port AS port');assert.equal(await realpath(identity.dir),await realpath(`${root}/mysql`));assert.equal(Number(identity.port),port);
 const password=randomBytes(32).toString('hex');
 await admin.query('CREATE DATABASE IF NOT EXISTS taiko_annual_readiness_test CHARACTER SET utf8mb4');
 await admin.query("CREATE USER IF NOT EXISTS 'annual_probe'@'127.0.0.1' IDENTIFIED BY ?",[password]);
 await admin.query("ALTER USER 'annual_probe'@'127.0.0.1' IDENTIFIED BY ?",[password]);
 await admin.query("GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,DROP,REFERENCES ON taiko_annual_readiness_test.* TO 'annual_probe'@'127.0.0.1'");
 await admin.end();
 const env={TAIKO_RUNTIME_ENV_FILE:`${root}/runtime.env`,TAIKO_BOT_SERVICE_TOKEN:randomBytes(32).toString('hex'),NODE_ENV:'production',PORT:String(webPort),NITRO_HOST:'127.0.0.1',TAIKO_DB_HOST:'127.0.0.1',TAIKO_DB_PORT:String(port),TAIKO_DB_USER:'annual_probe',TAIKO_DB_PASSWORD:password,TAIKO_DB_NAME:'taiko_annual_readiness_test',TAIKO_ALLOW_TEST_DB_MUTATION:'1',ANNUAL_E2E_ISOLATED_ROOT:root,ANNUAL_E2E_SYNTHETIC_DATA:'1',ANNUAL_E2E_EGRESS_BLOCKED:'1',TAIKO_REPO_ROOT:`${root}/source`,TAIKO_USERDATA_DIR:`${root}/userdata`,TAIKO_ANNUAL_CACHE_DIR:`${root}/cache`,TAIKO_ACCOUNT_CACHE_DIR:`${root}/account-cache`,TAIKO_ANNUAL_ADMISSION_DIR:`${root}/admission`,TAIKO_CONFIG_PATH:`${root}/config.json`,TAIKO_ANNUAL_SHARE_SECRET:randomBytes(32).toString('hex'),TAIKO_ANNUAL_RENDER_SECRET:randomBytes(32).toString('hex'),NUXT_ANNUAL_INTERNAL_BASE_URL:`http://127.0.0.1:${webPort}`,TAIKO_ANNUAL_INTERNAL_BASE_URL:`http://127.0.0.1:${webPort}`,TMPDIR:`${root}/tmp`,PATH:process.env.PATH,NODE_OPTIONS:'--max-old-space-size=1536'};
 await writeFile(`${root}/server.env`,Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n'),{mode:0o600});
 const db=await mysql.createConnection({host:env.TAIKO_DB_HOST,port,user:env.TAIKO_DB_USER,password,database:env.TAIKO_DB_NAME});
 const proof=await assertTestDatabaseMutationAllowed(db);await writeFile(`${root}/evidence/db-boundary.json`,JSON.stringify(proof,null,2));
 await symlink(`${process.cwd()}/node_modules`,`${root}/node_modules`).catch(e=>{if(e.code!=='EEXIST')throw e;});
 await build({entryPoints:[`${viewer}/server/utils/account-db.ts`],outfile:`${root}/account-schema.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',alias:{'~':viewer}});
 globalThis.useRuntimeConfig=()=>({dbHost:env.TAIKO_DB_HOST,dbPort:port,dbUser:env.TAIKO_DB_USER,dbPassword:password,dbName:env.TAIKO_DB_NAME});
 const schema=await import(`${root}/account-schema.mjs`);try{await schema.ensureAccountSchema();}finally{await schema.closeAccountDb();}
 const growthSchema=(await readFile(`${viewer}/server/services/growth-recent/schema.ts`,'utf8')).split('`')[1];
 await db.query(growthSchema);
 let accounts;
 const prior=await readFile(`${root}/accounts.json`,'utf8').then(JSON.parse).catch(()=>null);
 if(prior){const [rows]=await db.query('SELECT id,username FROM web_user_accounts');assert.equal(rows.length,prior.length);assert.ok(rows.every(x=>prior.some(a=>a.userId===Number(x.id))&&x.username.startsWith('probe_')));accounts=prior;}
 else accounts=await seedAnnualFixtures(db,root,String(Date.now()));
 await db.end();
 const log=await open(`${root}/evidence/server.log`,'a');
 const server=spawn('systemd-run',['--quiet',`--unit=${unit}`,'--slice=development-qa.slice','--wait','--collect','--pipe',`--working-directory=${viewer}`,'-p',`EnvironmentFile=${root}/server.env`,'-p','MemoryHigh=1536M','-p','MemoryMax=2G','-p','MemorySwapMax=128M','-p','TasksMax=256','-p','CPUQuota=200%','-p','RuntimeMaxSec=850','-p',`BindsTo=${ownerUnit}`,'-p',`After=${ownerUnit}`,'-p','KillMode=control-group','-p','IPAddressDeny=any','-p','IPAddressAllow=localhost','-p','ProtectSystem=strict','-p',`ReadWritePaths=${root}`,'-p','InaccessiblePaths=-/home/sigaer/taiko/userdata -/home/sigaer/taiko/config.json -/etc/taiko-viewer.env -/etc/taiko-runtime.env','--',process.execPath,`${viewer}/.output/server/index.mjs`],{stdio:['ignore',log.fd,log.fd]});children.push(server);
 for(let i=0;i<30;i++){try{const response=await fetch(`http://127.0.0.1:${webPort}/api/account/auth/me`,{signal:AbortSignal.timeout(1000)});if(response.ok)break;}catch{}await sleep(500);}
 const serverPid=Number(execFileSync('systemctl',['show',unit,'-p','MainPID','--value'],{encoding:'utf8'}).trim());
 const inputs=JSON.parse(await readFile(`${root}/evidence/input-manifest.json`,'utf8'));
 const buildInfo=JSON.parse(await readFile(`${viewer}/.output/public/_nuxt/builds/latest.json`,'utf8'));
 const config={candidate:{commit:inputs.commit,version:inputs.version,buildId:buildInfo.id},base:`http://127.0.0.1:${webPort}`,serverPid,isolationEvidence:`${root}/evidence/isolation.txt`,accountsFile:`${root}/accounts.json`,output:`${root}/results`,minAvailableMiB:12000,maxMemoryPsiFull:2,maxServerRssMiB:1400,scenario:'smoke',rate:1,seconds:1,maxVus:1,coldDeadlineSeconds:180,shareDeadlineSeconds:90};
 await writeFile(`${root}/probe.json`,JSON.stringify(config,null,2),{mode:0o600});
 await writeFile(`${root}/evidence/isolation.txt`,JSON.stringify({root:await realpath(root),unit,serverPid,mysqlPid:mysqld.pid,database:proof,properties:execFileSync('systemctl',['show',unit,'-p','ControlGroup','-p','IPAddressDeny','-p','IPAddressAllow','-p','ProtectSystem','-p','ReadWritePaths','-p','InaccessiblePaths','-p','MemoryMax'],{encoding:'utf8'}),externalQueue:'NOT_APPLICABLE: persistent local admission',objectStorage:'NOT_APPLICABLE: local share PNG',community:'syncCommunity=false required',fixtures:accounts.length},null,2));
 console.log(`READY ${root}/probe.json pid=${serverPid} synthetic=${accounts.length}`);
 while(!stopping&&server.exitCode===null&&mysqld.exitCode===null) {
   if(await readFile(`${root}/stop`).then(()=>true,()=>false)){break;}
   const task=await readFile(`${root}/task.json`,'utf8').then(JSON.parse).catch(()=>null);
   if(task){
    const {unlink}=await import('node:fs/promises');await unlink(`${root}/task.json`);
    const allowed={'probe':['/usr/bin/python3','loadtest/run-annual-readiness.py'],browser:[process.execPath,'loadtest/annual-business-browser.mjs']};
    assert.ok(allowed[task.kind]&&task.config.startsWith(root+'/'));assert.match(task.id,/^[a-z0-9-]{1,80}$/);assert.ok((await realpath(task.config)).startsWith(root+'/'));
    const [exe,...args]=allowed[task.kind];const out=await open(`${root}/evidence/${task.id}.log`,'w');
    const p=spawn(exe,[...args,task.config],{cwd:process.cwd(),stdio:['ignore',out.fd,out.fd],timeout:850000});
    const code=await new Promise(r=>p.once('exit',code=>r(code??1)));await out.close();
    await writeFile(`${root}/${task.id}.done`,JSON.stringify({code}));console.log(`TASK ${task.id} exit=${code}`);
   } else await sleep(500);
  }
} finally {await stop();await Promise.all(children.map(p=>p.exitCode===null?new Promise(r=>{p.once('exit',r);setTimeout(r,10000)}):null));}
