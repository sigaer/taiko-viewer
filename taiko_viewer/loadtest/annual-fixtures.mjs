import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { assertTestDatabaseMutationAllowed } from '../scripts/annual_test_db_guard.mjs';

// Only run-owned inserts. No global cleanup, production archive reads or summary edits.
export async function seedAnnualFixtures(db, root, runId) {
 await assertTestDatabaseMutationAllowed(db);
 const [other] = await db.query('SELECT COUNT(*) AS n FROM web_user_accounts');
 if (Number(other[0].n)) throw Error('Fixture bootstrap requires a new dedicated empty database');
 const specifications=[['normal',12,4],['sparse',2,1],['high',120,40],['insufficient',0,0],['same2',12,4],['same5',12,4],...Array.from({length:6},(_,i)=>[`parallel${i}`,12,4]),...Array.from({length:30},(_,i)=>[`cold${i}`,12,4])];
 const accounts=[];
 await db.beginTransaction();
 try {
 for (const [index,[kind,count,charts]] of specifications.entries()) {
  const taikoId=String(880000000000000000n+BigInt(Date.now())*100n+BigInt(index));
  const nickname=`QA-${kind}`;const username=`probe_${runId}_${kind}`;
  const [r]=await db.execute('INSERT INTO web_user_accounts (username,email,password_hash,email_verified) VALUES (?,?,?,1)',[username,`${username}@invalid.local`,'disabled-synthetic-login']);
  const userId=Number(r.insertId),cookie=randomBytes(32).toString('hex');
  await db.execute('INSERT INTO web_user_sessions (session_token,user_id,expires_at) VALUES (?,?,?)',[cookie,userId,new Date(Date.now()+4*3600000)]);
  await db.execute('INSERT INTO web_taiko_bindings (user_id,taiko_id,is_current,verified_title) VALUES (?,?,1,?)',[userId,taikoId,'Synthetic QA']);
  await db.execute("INSERT INTO web_annual_summary_access (user_id,note,enabled,feature) VALUES (?,?,1,'annual_first_run_beta')",[userId,`run:${runId}`]);
  const dir=`${root}/userdata/${taikoId}`;await mkdir(dir,{recursive:true});
  for(let i=0;i<count;i++) {
   const date=new Date(Date.UTC(2025,9,8+i*Math.max(1,Math.floor(340/Math.max(count-1,1))),12));
   const stamp=date.toISOString().slice(0,19);
   const payload={_meta:{full:true,source:'wahlap',source_account:taikoId,observed_at:stamp},profile:{mydon_name:nickname,title:'Synthetic QA'},achievement:{},dojo:{},songs:Array.from({length:charts},(_,j)=>({song_no:1318+j,level:4,stage_cnt:10+i,high_score:800000+i*100,good_cnt:500,ok_cnt:5,bad_cnt:0,clear_cnt:i,full_combo_cnt:0,dondaful_combo_cnt:0,update_datetime:stamp.replace('T',' '),highscore_datetime:stamp.replace('T',' '),speed:1.5}))};
   await writeFile(`${dir}/data_${stamp.slice(0,10)}_${stamp.slice(11).replaceAll(':','_')}.json`,JSON.stringify(payload));
   if(i===count-1)await writeFile(`${root}/userdata/${taikoId}data.json`,JSON.stringify(payload));
  }
  if(count===0)await writeFile(`${root}/userdata/${taikoId}data.json`,JSON.stringify({_meta:{full:false,source:'wahlap',observed_at:'2026-09-01T12:00:00'},profile:{mydon_name:nickname},achievement:{},songs:[]}));
  accounts.push({synthetic:true,kind,userId,taikoId,cookie,nickname,playCount:(count-1)*charts,snapshots:count,chartRecords:count*charts,expectedPlayEvents:Math.max(0,count-1)*charts,expectedHighScore:count?800000+(count-1)*100:null});
 }
 await db.commit();
 } catch(e) {await db.rollback();throw e;}
 await writeFile(`${root}/accounts.json`,JSON.stringify(accounts,null,2),{mode:0o600,flag:'wx'});
 await writeFile(`${root}/evidence/fixture-manifest.json`,JSON.stringify(accounts.map(({cookie,...a})=>a),null,2));
 return accounts;
}
