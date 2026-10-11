// Owned child: actual guarded MySQL, credential and H3 request; no external IO.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import mysql from 'mysql2/promise';
import {createApp,defineEventHandler,toNodeListener} from 'h3';
import {installGoalSqlRuntime} from './goalSqlRuntime.mjs';

assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
assert.match(String(process.env.TAIKO_DB_NAME||''),/_test$/);
const options=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.ok(['before-commit','after-commit'].includes(options.point));
const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),
 user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2});
async function guard(db){const [[row]]=await db.query('SELECT DATABASE() AS name');assert.match(row.name,/_test$/);assert.equal(row.name,process.env.TAIKO_DB_NAME);}
await guard(pool);
let server,uninstall;
try{
 const db={execute:(...args)=>pool.execute(...args),query:(...args)=>pool.query(...args),async getConnection(){
  const connection=await pool.getConnection();await guard(connection);
  return {execute:(...args)=>connection.execute(...args),query:(...args)=>connection.query(...args),
   beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),release:()=>connection.release(),destroy:()=>connection.destroy(),
   async commit(){if(options.point==='before-commit')process.exit(73);await connection.commit();if(options.point==='after-commit')process.exit(73);}};
 }};
 uninstall=installGoalSqlRuntime(db,options.config,{withDeveloper:true});
 globalThis.defineEventHandler=defineEventHandler;
 const handler=(await import('../../server/api/taiko/proxy/bind.post.ts')).default;
 server=createServer(toNodeListener(createApp().use(handler)));server.listen(0,'127.0.0.1');await once(server,'listening');
 const response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'Content-Type':'application/json',Cookie:options.cookie,'x-forwarded-for':options.ip},
  body:JSON.stringify({identityKey:options.principal,taikoId:options.taikoId,requestId:options.requestId}),signal:AbortSignal.timeout(10000)});
 await response.arrayBuffer();throw new Error('Owned process did not reach its SQL COMMIT boundary');
}finally{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 uninstall?.();await pool.end();
}
