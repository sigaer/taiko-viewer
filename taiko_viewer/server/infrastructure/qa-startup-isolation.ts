import {readFileSync,realpathSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,relative} from 'node:path';
import {getRuntimePaths} from './runtime-paths';
let admitted=false;
/** Nitro 2 invokes startup plugins synchronously. Complete admission before any
 * plugin can launch work or any listener can serve a request. Normal startup is
 * unchanged; owned-qa is a guarded test context, not an Annual EOL switch.
 */
export function useOwnedQaStartupIsolation():boolean{
 const config=useRuntimeConfig();if(config.annualStartupMode==='normal')return false;
 if(admitted)return true;
 let stage="context";
 try{
  const check=(ok:unknown)=>{if(!ok)throw new Error('Invalid owned QA context');};
  check(config.annualStartupMode==='owned-qa');
  const env=process.env,id=env.QA_RUN_ID;
  check(/^qa-[0-9a-f]{12}$/.test(id||'')&&env.TAIKO_ALLOW_TEST_DB_MUTATION==='1'&&env.NITRO_HOST==='127.0.0.1');
  const run=resolve('/home/sigaer/taiko/qa-vault/runs',id!);
  check(env.QA_RUN_DIR===run&&env.QA_RUN_TMPDIR===resolve(run,'scratch'));
  const scratch=realpathSync(env.QA_RUN_TMPDIR!);check(scratch===env.QA_RUN_TMPDIR);
  check(readFileSync('/proc/self/cgroup','utf8').includes('/development.slice/development-qa.slice/'));
  stage="paths";const paths=getRuntimePaths();
  for(const value of [paths.repoRoot,paths.userdataDir,paths.configPath,paths.cacheDir,String(config.annualCacheDir||''),String(config.viewerCacheDir||'')]){
   check(value&&resolve(value).startsWith(scratch+'/'));check(realpathSync(value).startsWith(scratch+'/'));
  }
  check(!(statSync(run).mode&0o077));
  check(String(config.dbHost)==='127.0.0.1'&&Number(config.dbPort)>1024&&Number(config.dbPort)!==3306&&/^\w+_test$/.test(String(config.dbName)));
  stage="database-identity";const expected=realpathSync(env.TAIKO_TEST_MYSQL_DATADIR||'');
  if(env.TAIKO_OIDC_PERSISTENT_STAGING==='1'){
   // The real remote binding outlives a QA run. Only this pinned, private test
   // datadir may survive scratch cleanup; all runtime paths remain run-owned.
   const root='/var/tmp/taiko-viewer-ourtaiko-staging',manifest=resolve(root,'admission.json');
   check(realpathSync(root)===root&&expected===resolve(root,'mysql'));
   for(const path of [root,expected]){const info=statSync(path);check(info.uid===process.getuid?.()&&!(info.mode&0o077));}
   const info=statSync(manifest),data=statSync(expected);
   check(realpathSync(manifest)===manifest&&info.isFile()&&info.uid===process.getuid?.()&&(info.mode&0o777)===0o600&&info.size<4096);
   const pinned=JSON.parse(readFileSync(manifest,'utf8'));
   check(pinned.schema===1&&pinned.application==='Sakura-staging'&&pinned.database==='viewer_ourtaiko_staging_test');
   check(String(config.dbName)===pinned.database&&pinned.datadir===expected&&pinned.device===data.dev&&pinned.inode===data.ino);
  }else check(/^sql-[a-zA-Z0-9]+\/mysql$/.test(relative(scratch,expected)));
  // Private credentials travel on stdin; only DATABASE()/datadir are returned.
  // One bounded native SQL probe avoids Nitro's non-awaited async plugin race.
  // Nitro rewrites import.meta.url before entry evaluation; use the actual
  // absolute Node entry for package resolution, never Nitro's fallback URL.
  stage="sql-probe";const mysql=pathToFileURL(createRequire(resolve(process.argv[1]||'')).resolve('mysql2/promise')).href;
  const code=`import fs from 'node:fs';import mysql from ${JSON.stringify(mysql)};let db;try{db=await mysql.createConnection(JSON.parse(fs.readFileSync(0,'utf8')));const [[row]]=await db.query('SELECT DATABASE() name,@@datadir datadir');process.stdout.write(JSON.stringify(row));}catch{process.exitCode=1;}finally{await db?.end();}`;
  const probe=spawnSync(process.execPath,['--max-old-space-size=64','--input-type=module','-e',code],{cwd:paths.repoRoot,input:JSON.stringify({host:String(config.dbHost),port:Number(config.dbPort),user:String(config.dbUser),password:String(config.dbPassword),database:String(config.dbName),connectTimeout:2000}),encoding:'utf8',timeout:5000,maxBuffer:8192,killSignal:'SIGKILL',env:{PATH:env.PATH,NODE_ENV:'production'},stdio:['pipe','pipe','pipe']});
  check(probe.status===0&&!probe.error);const proof=JSON.parse(probe.stdout);
  check(proof.name===String(config.dbName)&&proof.name.endsWith('_test')&&realpathSync(proof.datadir)===expected);
  admitted=true;console.info('[viewer-startup] owned QA isolation admitted');return true;
 }catch{
  console.error('[viewer-startup] owned QA isolation rejected',stage);
  process.exit(78);
 }
}
