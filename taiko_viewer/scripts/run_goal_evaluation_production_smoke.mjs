import {authoritativeFixture} from '../tests/fixtures/goalAuthoritative.mjs';
// Post-release only. Provision disposable accounts with synthetic scores generated
// from the public chart catalog; never copy another player's data.
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {randomBytes,randomInt,scryptSync} from 'node:crypto';
import {access,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {deleteUserWithGoals} from '../server/services/goals/lifecycle.ts';
import {auditGoalOrphans,inspectGoalSchema} from '../server/services/goals/audit.ts';
assert.equal(process.env.TAIKO_ALLOW_GOAL_PRODUCTION_SMOKE,'1');
assert.equal(process.env.TAIKO_DB_NAME,'taiko');
const out='/var/tmp/goal-evaluation';await mkdir(out,{recursive:true});
const db=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:3});
let user=0,child;const ownedFiles=[];const authPath=`${out}/smoke-auth.json`;const report={result:'FAIL'};
try{
 const [[identity]]=await db.query('SELECT DATABASE() AS name');assert.equal(identity.name,'taiko');
 const schema=await inspectGoalSchema(db);assert.ok(schema.exists);assert.deepEqual(schema.errors,[]);assert.deepEqual(await auditGoalOrphans(db),{userOrphans:0,bindingOrphans:0,ownerMismatches:0});
 const html=await (await fetch('https://viewer.sakura-bot.cn',{signal:AbortSignal.timeout(20000)})).text();assert.match(html,/0\.69\.1/,'Release must be online before smoke provisioning');
 const tag=randomBytes(6).toString('hex');const username=`goal_smoke_${tag}`;const password=randomBytes(24).toString('hex');const salt=randomBytes(16).toString('hex');
 const hash=`${salt}:${scryptSync(password,salt,64).toString('hex')}`;
 const [account]=await db.execute('INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)',[username,`${username}@example.test`,hash]);user=account.insertId;
 const catalog=JSON.parse(await readFile('/home/sigaer/taiko/songs/song_data.json','utf8'));
 const songs=[];
 for(const song of catalog){if(Number(song.shelf_status||0)!==0)continue;for(const level of [4,5])if(Number(song[`level_${level}`])>0){const notes=Number(song.max_combo?.[level-1])||600;songs.push({song_no:Number(song.id),level,song_name:song.song_name,high_score:900000,best_score_rank:4,good_cnt:Math.max(0,notes-28),ok_cnt:20,ng_cnt:8,combo_cnt:100,stage_cnt:1,clear_cnt:1,full_combo_cnt:0,dondaful_combo_cnt:0,highscore_datetime:'2026-09-18 10:00:00',update_datetime:'2026-09-18 10:00:00',highscore_mode:0,option_flg:[1,0,0,'00']})}}
 assert.ok(songs.length>0&&songs.length<10000);
 const profiles=[];
 for(const current of [1,0]){
  let taikoId,path,available=false;
  for(let attempt=0;attempt<20;attempt++){
   taikoId=String(randomInt(90000000,99999999));path=`/home/sigaer/taiko/userdata/${taikoId}data.json`;
   const [[exists]]=await db.execute('SELECT COUNT(*) AS n FROM web_taiko_bindings WHERE taiko_id=?',[taikoId]);if(exists.n)continue;
   try{await access(path);continue}catch{}
   available=true;break;
  }
  assert.ok(available,'No unused smoke profile identity');
  const [binding]=await db.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current,verified_title) VALUES (?,?,'wahlap',?,'Goal smoke fixture')",[user,taikoId,current]);profiles.push(binding.insertId);
  await writeFile(path,JSON.stringify(authoritativeFixture({_goalSmoke:true,profile:{mydon_name:'Goal Smoke',userid:taikoId},achievement:{ary_crown_count:[songs.length,0,0],ary_score_rank_count:[0,0,songs.length,0,0,0,0]},songs},taikoId,new Date(Date.now()-10000))),{flag:'wx',mode:0o600});ownedFiles.push(path);
 }
 const response=await fetch('https://viewer.sakura-bot.cn/api/account/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:username,password}),signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);const login=await response.json();assert.ok(login.sessionToken);
 await writeFile(authPath,JSON.stringify({owner:login.sessionToken,profileA:profiles[0],profileB:profiles[1],userId:user,username,password,scorePath:ownedFiles[0]}),{mode:0o600});
 child=spawn(process.execPath,['--experimental-strip-types',new URL('./verify_goal_evaluation_production.mjs',import.meta.url).pathname],{env:{...process.env,GOAL_AUTH_FILE:authPath},stdio:'inherit'});
 const deadline=setTimeout(()=>child.kill('SIGTERM'),300000);const [code]=await once(child,'exit');clearTimeout(deadline);assert.equal(code,0,'Production browser smoke failed');
 const [[history]]=await db.query("SELECT COUNT(*) AS n FROM web_player_goals WHERE user_id=? AND status='completed'",[user]);assert.equal(history.n,1,'Exactly one completed Goal retained');report.completedRowsBeforeCleanup=history.n;
 report.result='PASS';
}finally{
 try{
  if(child&&child.exitCode===null&&!child.signalCode){child.kill('SIGTERM');await once(child,'exit')}
  if(user)await deleteUserWithGoals(db,user);
  for(const file of ownedFiles)await rm(file,{force:true});
  if(user){const [[residual]]=await db.query('SELECT (SELECT COUNT(*) FROM web_user_accounts WHERE id=?) AS users,(SELECT COUNT(*) FROM web_taiko_bindings WHERE user_id=?) AS bindings,(SELECT COUNT(*) FROM web_user_sessions WHERE user_id=?) AS sessions,(SELECT COUNT(*) FROM web_player_goals WHERE user_id=?) AS goals',[user,user,user,user]);assert.ok(Object.values(residual).every(n=>Number(n)===0));report.residualRows=residual}
  for(const file of ownedFiles){let exists=true;try{await access(file)}catch{exists=false}assert.equal(exists,false)}report.residualFiles=0;
  await rm(authPath,{force:true});
  report.orphans=await auditGoalOrphans(db);assert.deepEqual(report.orphans,{userOrphans:0,bindingOrphans:0,ownerMismatches:0});
  await writeFile(`${out}/production-lifecycle.json`,JSON.stringify(report,null,2));
 }finally{await db.end()}
}
console.log(JSON.stringify(report));
