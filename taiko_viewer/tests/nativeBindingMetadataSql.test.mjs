import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {manualSqlFixture} from './fixtures/manualSqlRuntime.mjs';
import {bounded} from './fixtures/accountSourceHttp.mjs';

async function fixture(task){return manualSqlFixture(async c=>{
 c.principals=['onebot_v11:9'+String(c.user).padStart(12,'0'),'qq_official:_Abc'+randomUUID().replaceAll('-','')+'_'];
 c.children=[];
 c.ask=(keys,mode)=>new Promise((resolve,reject)=>{
  const env={PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:c.config.repoRoot,TAIKO_ALLOW_TEST_DB_MUTATION:'1'};
  for(const key of ['TAIKO_DB_HOST','TAIKO_DB_PORT','TAIKO_DB_USER','TAIKO_DB_PASSWORD','TAIKO_DB_NAME'])env[key]=process.env[key];
  const child=spawn('/usr/bin/python3',[c.config.repoRoot+'/tests/native_binding_metadata_sql_child.py'],{env,stdio:['pipe','pipe','pipe']});c.children.push(child);
  let output='',diagnosticBytes=0;const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Owned metadata child deadline'));},12000);
  child.stdout.on('data',data=>{output+=data; if(output.length>65536)child.kill('SIGTERM');});child.stderr.on('data',data=>{diagnosticBytes+=data.length; if(diagnosticBytes>8192)child.kill('SIGTERM');});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('Owned metadata child unavailable'));});
  child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error('Owned metadata query failed'));try{resolve(JSON.parse(output).result);}catch{reject(new Error('Owned metadata response invalid'));}});
  child.stdin.end(JSON.stringify({principals:keys,mode}));
 });
 try{await task(c);}finally{
  for(const child of c.children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await bounded(new Promise(resolve=>child.once('close',resolve)));}assert.ok(child.exitCode!==null||child.signalCode!==null);}
  for(const principal of c.principals){await c.pool.execute('DELETE FROM bind WHERE qq=?',[principal]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[principal]);}
 }
});}

test('native bounded metadata returns only exact owned principal and keeps u0/hidden selection',{timeout:20000},()=>fixture(async c=>{
 const [one,two]=c.principals;
 await c.pool.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,1,0,'wahlap'),(?,?,0,2,1,'hiroba'),(?,?,1,1,1,'wahlap')",[one,'111',one,'222',two,'333']);
 await c.pool.execute('INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,1)',[one]);
 assert.deepEqual(await c.ask([one]),{[one]:{ids:['111','222'],current_index:1,current_slot:0,sources:{111:'wahlap',222:'hiroba'}}});
 assert.deepEqual(Object.keys(await c.ask([two])),[two]);
 // Older table collation may match the opposite case, but the binary
 // predicate must exclude it without revealing the real identifier.
 assert.deepEqual(await c.ask([two.toUpperCase().replace('QQ_OFFICIAL:','qq_official:')]),{});
 assert.equal((await c.ask([two]))[two].current_slot,1);
 assert.deepEqual(await c.ask([one],'command-info'),{id:'222',visible:0,source:'hiroba'});
 assert.equal(await c.ask([two.toUpperCase().replace('QQ_OFFICIAL:','qq_official:')],'command-info'),null);
}));
