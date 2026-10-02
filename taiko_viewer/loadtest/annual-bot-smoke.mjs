import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import {assertTestDatabaseMutationAllowed} from '../scripts/annual_test_db_guard.mjs';
export async function checkBotFlow(c,accounts){
 const root=c.isolationEvidence.replace('/evidence/isolation.txt','');assert.ok(root.startsWith('/var/tmp/annual-test-'));
 const env=Object.fromEntries((await readFile(root+'/server.env','utf8')).trim().split('\n').map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
 assert.equal(env.TAIKO_DB_NAME,'taiko_annual_readiness_test');
 const db=await mysql.createConnection({host:'127.0.0.1',port:33179,user:env.TAIKO_DB_USER,password:env.TAIKO_DB_PASSWORD,database:env.TAIKO_DB_NAME});
 const policy=async(g=false,r=false)=>writeFile(root+'/annual-policy.json',JSON.stringify({mode:'public',pauseGeneration:g,pauseRendering:r,refreshImports:true,archiveFallback:true}));
 const trace=[];
 const bot=async(identity,status=200,token=env.TAIKO_BOT_SERVICE_TOKEN)=>{const start=Date.now();const r=await fetch(c.base+'/api/taiko/internal/annual-card',{method:'POST',headers:{'content-type':'application/json','x-taiko-bot-token':token},body:JSON.stringify({identityKey:identity}),signal:AbortSignal.timeout(240000)});trace.push({identity,status:r.status,ms:Date.now()-start});if(r.status!==status)throw Error(`bot expected ${status} got ${r.status}: ${(await r.text()).slice(0,600)}`);if(status!==200)return null;const b=Buffer.from(await r.arrayBuffer());const meta=await sharp(b).metadata();await sharp(b).stats();assert.equal(meta.width,1080);assert.equal(meta.height,1872);return b;};
 const web=async(a,path,body)=>{const r=await fetch(c.base+path,{method:body?'POST':'GET',headers:{cookie:`stv_session=${a.cookie}`,origin:c.base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});assert.ok(r.ok,await r.clone().text());return r.json();};
 try{
 await assertTestDatabaseMutationAllowed(db);await policy();
 const [before]=await db.query('SELECT COUNT(*) AS n FROM web_user_accounts');
 const normal=accounts.find(a=>a.kind==='normal'),fresh=normal.taikoId+'1';
 await mkdir(root+'/userdata/'+fresh,{recursive:true});
 for(const file of await readdir(root+'/userdata/'+normal.taikoId)){
 const p=JSON.parse(await readFile(root+'/userdata/'+normal.taikoId+'/'+file,'utf8'));p._meta.source_account=fresh;
 await writeFile(root+'/userdata/'+fresh+'/'+file,JSON.stringify(p));
 }
 const current=JSON.parse(await readFile(root+'/userdata/'+normal.taikoId+'data.json','utf8'));current._meta.source_account=fresh;
 await writeFile(root+'/userdata/'+fresh+'data.json',JSON.stringify(current));
 for(const [identity,id] of [['qq_official:botonly',fresh],['qq_official:botonly2',fresh],['qq_official:web',normal.taikoId]])await db.execute('INSERT INTO bind (qq,id,is_current,slot_index) VALUES (?,?,1,1) ON DUPLICATE KEY UPDATE is_current=1',[identity,id]);
 await bot('qq_official:botonly',401,'wrong-token');await bot('onebot_v11:123',403);await bot('qq_official:unbound',400);
 await policy(true,false);await bot('qq_official:botonly',503);await policy(false,true);await bot('qq_official:botonly',503);
 await policy();const [a,b]=await Promise.all([bot('qq_official:botonly2'),bot('qq_official:botonly')]);assert.ok(a.equals(b),'deduplicated PNG must match');await writeFile(c.output+'/bot-only.png',a);
 await policy(true,true);const cached=await bot('qq_official:botonly2');assert.ok(a.equals(cached));await policy();
 let {job}=await web(normal,'/api/account/annual-summaries/annual_2026/build',{locale:'zh'});
 for(let i=0;i<180&&['queued','running'].includes(job.status);i++){await new Promise(r=>setTimeout(r,1000));({job}=await web(normal,'/api/account/annual-summary-jobs/'+job.id));}assert.equal(job.status,'completed');
 const {summary}=await web(normal,'/api/account/annual-summaries/annual_2026');const {shareCard}=await web(normal,`/api/account/annual-summaries/${summary.summaryId}/share-card`,{locale:'zh',syncCommunity:false});
 const card=Buffer.from(await fetch(c.base+shareCard.imageUrl,{headers:{cookie:`stv_session=${normal.cookie}`}}).then(r=>r.arrayBuffer()));const reused=await bot('qq_official:web');assert.ok(card.equals(reused),'existing exported web PNG reused');await writeFile(c.output+'/bot-web-reused.png',reused);
 const [after]=await db.query('SELECT COUNT(*) AS n FROM web_user_accounts');assert.equal(after[0].n,before[0].n);
 await writeFile(c.output+'/bot-smoke.json',JSON.stringify({noFakeWebAccounts:true,botOnly:true,webImageReused:true,pauseRestore:true,sameUserDedup:true,trace},null,2));
 }finally{await policy();await db.end();}
}
