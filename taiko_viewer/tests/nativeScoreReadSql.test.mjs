import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {manualSqlFixture} from './fixtures/manualSqlRuntime.mjs';
import {bounded} from './fixtures/accountSourceHttp.mjs';
import {openPublicationLease} from '../server/infrastructure/taiko-publication/client.ts';

async function fixture(task){return manualSqlFixture(async c=>{
 c.principal='qq_official:Read_'+randomUUID().replaceAll('-','');c.other='onebot_v11:9'+String(c.user).padStart(12,'0');
 c.ids=['6'+String(c.user).padStart(12,'0'),'6'+String(c.user).padStart(12,'0')+'1'];c.children=[];
 c.seed=async({id=c.ids[0],slot=1,current=1,source='wahlap',visible=0}={})=>c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES(?,?,?,?,?,?)',[c.principal,id,visible,slot,current,source]);
 c.start=extra=>{
  const env={PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:c.config.repoRoot,TAIKO_ALLOW_TEST_DB_MUTATION:'1'};
  for(const key of ['TAIKO_DB_HOST','TAIKO_DB_PORT','TAIKO_DB_USER','TAIKO_DB_PASSWORD','TAIKO_DB_NAME'])env[key]=process.env[key];
  const child=spawn('/usr/bin/python3',[c.config.repoRoot+'/tests/native_score_read_sql_child.py'],{cwd:c.config.repoRoot,env,stdio:['pipe','pipe','pipe']});c.children.push(child);
  let announce,optimistic;const captured=new Promise(resolve=>announce=resolve),firstSql=new Promise(resolve=>optimistic=resolve);
  const completed=new Promise((resolve,reject)=>{
   let output='',errors=0;const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Owned native read deadline'));},35000);
   child.stdout.on('data',data=>{output+=data;if(output.includes('"event": "captured"'))announce();if(output.includes('"event": "optimistic"'))optimistic();if(output.length>262144)child.kill('SIGTERM');});
   child.stderr.on('data',data=>{errors+=data.length;if(errors>8192)child.kill('SIGTERM');});
   child.once('error',()=>{clearTimeout(timer);reject(new Error('Owned native read unavailable'));});
   child.once('close',code=>{clearTimeout(timer);announce();optimistic();try{const last=output.trim().split('\n').filter(line=>!line.includes('"event"')).at(-1);resolve({code,errors,result:last?JSON.parse(last):null});}catch{reject(new Error('Owned native read response invalid'));}});
   child.stdin.write(JSON.stringify({root:c.config.userdataDir,principal:c.principal,ids:c.ids,...extra})+'\n');
   if(!extra?.pause)child.stdin.end();
  });return {child,captured,firstSql,completed};
 };
 c.ask=async extra=>{const value=await c.start(extra).completed;assert.equal(value.code,0,'Owned native read worker failed');assert.equal(value.errors,0,'Owned native read diagnostic');assert.equal(value.result.ok,true);return value.result.result;};
 c.continue=async active=>{active.child.stdin.end('continue\n');const value=await active.completed;assert.equal(value.code,0);assert.equal(value.errors,0);assert.equal(value.result.ok,true);return value.result.result;};
 c.lease=mode=>openPublicationLease({userdataRoot:c.config.userdataDir,taikoId:c.ids[0],mode,pythonBin:'/usr/bin/python3',repoRoot:c.config.repoRoot,timeoutMs:5000});
 try{await task(c);}finally{
  for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(resolve=>child.once('close',resolve)));}assert.ok(child.exitCode!==null||child.signalCode!==null);}
  for(const principal of [c.principal,c.other]){await c.pool.execute('DELETE FROM bind WHERE qq=?',[principal]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[principal]);}
 }
});}

test('own hidden current and public other query preserve policy and exact handler output',{timeout:30000},()=>fixture(async c=>{
 await c.seed();assert.equal((await c.ask()).kind,'image');
 assert.equal((await c.ask({caller:c.other})).text,'查不到呢，可能不给看哦~');
 await c.pool.execute('UPDATE bind SET visible=1 WHERE qq=?',[c.principal]);
 assert.equal((await c.ask({caller:c.other})).sha256,createHash('sha256').update('owned-synthetic-view:A').digest('hex'));
 const [rows]=await c.pool.execute('SELECT current_virtual FROM taiko_bind_identity_state WHERE identity_key=?',[c.principal]);assert.equal(rows.length,0,'Readonly query created identity state');
}));

for(const [field,sql,args] of [
 ['id','UPDATE bind SET id=? WHERE qq=?',c=>[c.ids[1],c.principal]],
 ['slot','UPDATE bind SET slot_index=2 WHERE qq=?',c=>[c.principal]],
 ['current','UPDATE bind SET is_current=0 WHERE qq=?',c=>[c.principal]],
 ['source','UPDATE bind SET source=\'hiroba\' WHERE qq=?',c=>[c.principal]],
 ['visibility','UPDATE bind SET visible=1 WHERE qq=?',c=>[c.principal]],
 ['delete','DELETE FROM bind WHERE qq=?',c=>[c.principal]],
 ['virtual','INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',c=>[c.principal]],
])test('late '+field+' change suppresses selected native image',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const active=c.start({pause:true});await bounded(active.captured);
 await c.pool.execute(sql,args(c));const result=await c.continue(active);assert.equal(result.kind,'denied');assert.equal(result.status,409);
 const lease=await c.lease('write');await lease.close();
}));

test('SQL grant changed while Source is queued is rechecked after SH acquisition',{timeout:30000},()=>fixture(async c=>{
 await c.seed();assert.equal((await c.ask()).kind,'image');
 const lease=await c.lease('write');try{
  const active=c.start({skipPrepare:true});await bounded(active.firstSql);
  await c.pool.execute('DELETE FROM bind WHERE qq=?',[c.principal]);await lease.close();
  const value=await active.completed;assert.equal(value.code,0);assert.equal(value.result.result.kind,'denied');assert.equal(value.result.result.status,409);
 }finally{await lease.close();}
}));

test('Native u0 derives selected manual profile and retains exact member selection',{timeout:30000},()=>fixture(async c=>{
 c.ids=[c.ids[0],c.taikoId];await c.seed({current:0});await c.seed({id:c.taikoId,slot:2,current:1,source:'manual'});
 await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[c.principal]);
 const result=await c.ask();assert.equal(result.kind,'image');assert.equal(result.sha256,createHash('sha256').update('owned-synthetic-view:B').digest('hex'));
}));

test('projection replacement cannot change current, renderer faults use fixed state',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const expected=await c.ask();const path=join(c.config.userdataDir,c.ids[0]+'data.json');
 await writeFile(path+'.replacement',JSON.stringify({profile:{mydon_name:'Wrong'}}));await rename(path+'.replacement',path);
 assert.equal((await c.ask()).sha256,expected.sha256);
 assert.equal((await c.ask({renderError:true})).text,'生成失败了，请稍后再试~');
 assert.equal((await c.ask({wrongRoot:true})).text,'生成失败了，请稍后再试~');
}));

test('case mismatch and readonly COMMIT failure expose no private driver details',{timeout:30000},()=>fixture(async c=>{
 await c.seed();const wrong=c.principal.replace('Read_','read_');
 const result=await c.ask({principal:wrong});assert.notEqual(result.kind,'image');
 assert.equal((await c.ask({commitFailure:1})).text,'查询暂不可用，请稍后重试。');
}));
