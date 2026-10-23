// One real H3 / MySQL persistence chain. Catalog and runtime are synthetic;
// session lookup, permissions, forum services, SQL and HTTP handlers are real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {realpathSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import {createApp,createRouter,defineEventHandler,toNodeListener} from 'h3';
import {installGoalSqlRuntime} from './fixtures/goalSqlRuntime.mjs';

test('isolated community core HTTP preserves list filters, likes, replies, blocks and moderation authority',async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const database='viewer_community_core_test';
 const scratch=realpathSync(process.env.QA_RUN_TMPDIR);
 const socket=resolve(process.env.COMMUNITY_TEST_SOCKET||'');
 assert.equal(socket,resolve(scratch,'community-mysql.sock'));
 const admin=await mysql.createConnection({socketPath:socket,user:'root'});
 let pool,server,uninstall;const oldHandler=globalThis.defineEventHandler;const nativeFetch=globalThis.fetch;
 try{
  const [[host]]=await admin.query('SELECT @@datadir AS dataDirectory');
  assert.equal(realpathSync(host.dataDirectory),resolve(scratch,'community-mysql-data'));
  // Only bootstrap an empty owned test schema on this private, network-disabled
  // daemon. No production config, credentials, socket or user data are used.
  await admin.query('CREATE DATABASE IF NOT EXISTS '+database+' CHARACTER SET utf8mb4');
  pool=mysql.createPool({socketPath:socket,user:'root',database,connectionLimit:2,charset:'utf8mb4'});
  const [[identity]]=await pool.query('SELECT DATABASE() AS databaseName, @@datadir AS dataDirectory');
  assert.equal(identity.databaseName,database);assert.match(identity.databaseName,/_test$/);assert.equal(realpathSync(identity.dataDirectory),resolve(scratch,'community-mysql-data'));
  const [initialTables]=await pool.query('SHOW TABLES');assert.equal(initialTables.length,0);
  const runtime={dbHost:'127.0.0.1',dbPort:'1',dbName:database,repoRoot:resolve(scratch,'synthetic-repo'),userdataDir:resolve(scratch,'synthetic-userdata'),accountCacheDir:resolve(scratch,'synthetic-cache')};
  uninstall=installGoalSqlRuntime(pool,runtime,{withProfile:true});globalThis.defineEventHandler=defineEventHandler;
  const {CREATE_TABLES,MIGRATIONS}=await import('../server/utils/account-schema-definition.ts');
  const names=['web_user_accounts','web_user_sessions','web_taiko_bindings'];
  for(const sql of CREATE_TABLES)if(names.some(name=>sql.startsWith('CREATE TABLE IF NOT EXISTS '+name+' (')))await pool.execute(sql);
  for(const sql of MIGRATIONS)if(names.some(name=>sql.startsWith('ALTER TABLE '+name+' '))){try{await pool.execute(sql);}catch(e){if(!['ER_DUP_FIELDNAME','ER_DUP_KEYNAME'].includes(e.code))throw e;}}
  const {initializeForumSchema}=await import('../server/utils/forum-schema-bootstrap.ts');await initializeForumSchema();
  for(const [id,name] of [[990331,'author'],[990332,'replier'],[990333,'admin']]){
   await pool.execute('INSERT INTO web_user_accounts(id,username,email,password_hash,email_verified) VALUES (?,?,?,?,1)',[id,'synthetic-'+name,name+'@example.test','synthetic-session-fixture']);
   await pool.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))',[(id===990331?'a':id===990332?'b':'c').repeat(64),id]);
  }
  await pool.execute("INSERT INTO forum_user_profiles(user_id,role) VALUES (990333,'admin') ON DUPLICATE KEY UPDATE role='admin'");
  const router=createRouter();
  for(const [method,path,file] of [
   ['get','/api/forum/home','home.get.ts'],['get','/api/forum/sections','sections.get.ts'],['get','/api/forum/threads','threads.get.ts'],
   ['post','/api/forum/threads','threads.post.ts'],['post','/api/forum/threads/:id/replies','threads/[id]/replies.post.ts'],
   ['get','/api/forum/threads/:id','threads/[id].get.ts'],['post','/api/forum/threads/:id/like','threads/[id]/like.post.ts'],
   ['post','/api/forum/posts/:id/like','posts/[id]/like.post.ts'],['post','/api/forum/moderation/action','moderation/action.post.ts'],
   ['post','/api/forum/users/:id/block','users/[id]/block.post.ts'],
   ['get','/api/forum/notifications','notifications.get.ts'],['post','/api/forum/notifications/read','notifications/read.post.ts']
  ])router[method](path,(await import('../server/api/forum/'+file)).default);
  server=createServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port,calls=[],checks=[];
  globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).origin,base,'external requests forbidden');return nativeFetch(url,options);};
  const ask=async(method,path,account,body,status=200)=>{
   const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(account?{cookie:'stv_session='+({author:'a',replier:'b',admin:'c'}[account]).repeat(64)}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
   const value=await response.json();calls.push({method,path,account:account||'guest',status:response.status});assert.equal(response.status,status,'HTTP status mismatch: '+path+' '+String(value.statusMessage||value.message||'').slice(0,300));return value;
  };
  const create=async(account,title,difficultyType=4,sectionSlug='score-guides')=>ask('POST','/api/forum/threads',account,{sectionSlug,threadType:'discussion',title,songId:100,difficultyType,level:9,contentBlocks:[{type:'paragraph',text:'Synthetic core persistent body'}]});
  const a=await create('author','Synthetic alpha match chart 4');const other=await create('author','Synthetic beta chart 4',4);const b=await create('replier','Synthetic gamma general',4,'general');
  const list=await ask('GET','/api/forum/threads?songId=100&difficultyType=4&sectionSlug=score-guides&keyword=alpha','author');assert.equal(list.total,1);assert.equal(list.items[0].id,a.id);
  const mine=await ask('GET','/api/forum/threads?scope=mine&pageSize=1','author');const mine2=await ask('GET','/api/forum/threads?scope=mine&pageSize=1&page=2','author');assert.equal(mine.total,2);assert.notEqual(mine.items[0].id,mine2.items[0].id);assert.ok(mine.items.every(row=>row.author.id===990331));
  await ask('GET','/api/forum/threads?scope=mine',null,undefined,401);await ask('GET','/api/forum/threads',null);checks.push('actual query filters, mine ownership, paging and guest scope refusal');
  await ask('POST',`/api/forum/threads/${a.id}/like`,null,undefined,401);
  const like=await ask('POST',`/api/forum/threads/${a.id}/like`,'replier');assert.equal(like.liked,true);assert.equal(like.likeCount,1);const unlike=await ask('POST',`/api/forum/threads/${a.id}/like`,'replier');assert.equal(unlike.liked,false);assert.equal(unlike.likeCount,0);
  const replied=await ask('POST',`/api/forum/threads/${a.id}/replies`,'replier',{bodyText:'Persistent floor'});const floor=replied.posts[0];
  const nested=await ask('POST',`/api/forum/threads/${a.id}/replies`,'author',{bodyText:'Persistent nested reply',parentPostId:floor.id});assert.equal(nested.posts[0].replies[0].parentPostId,floor.id);
  const postLike=await ask('POST',`/api/forum/posts/${floor.id}/like`,'author');assert.equal(postLike.liked,true);checks.push('actual authenticated thread/post likes and exact parent reply persistence');
  await ask('POST','/api/forum/moderation/action','author',{threadId:a.id,action:'lock',enabled:true},403);
  await ask('POST','/api/forum/moderation/action','admin',{threadId:a.id,action:'lock',enabled:true});
  const [[beforeLocked]]=await pool.query('SELECT COUNT(*) AS total FROM forum_posts WHERE thread_id=?',[a.id]);
  await ask('POST',`/api/forum/threads/${a.id}/replies`,'replier',{bodyText:'Must not be inserted while locked'},400);
  const [[afterLocked]]=await pool.query('SELECT COUNT(*) AS total FROM forum_posts WHERE thread_id=?',[a.id]);assert.equal(afterLocked.total,beforeLocked.total);
  await ask('POST','/api/forum/moderation/action','admin',{threadId:a.id,action:'lock',enabled:false});
  await ask('POST',`/api/forum/threads/${a.id}/replies`,'replier',{bodyText:'Allowed after unlock'});checks.push('ordinary moderation refused; lock denial persists no reply; unlock recovers');
  await ask('POST','/api/forum/moderation/action','admin',{threadId:a.id,action:'hide',enabled:true});
  await ask('GET',`/api/forum/threads/${a.id}`,'author',undefined,404);const hiddenGuest=await ask('GET','/api/forum/threads?includeHidden=1','author');assert.ok(!hiddenGuest.items.some(row=>row.id===a.id));const hiddenAdmin=await ask('GET','/api/forum/threads?includeHidden=1','admin');assert.ok(hiddenAdmin.items.some(row=>row.id===a.id));
  await ask('POST','/api/forum/moderation/action','admin',{threadId:a.id,action:'hide',enabled:false});checks.push('hidden content remains inaccessible to ordinary accounts; authorized restore works');
  await ask('POST','/api/forum/users/990332/block','author',{enabled:true});const blocked=await ask('GET',`/api/forum/threads/${a.id}`,'author');assert.equal(blocked.posts[0].isBlockedAuthor,true);const filtered=await ask('GET','/api/forum/threads','author');assert.ok(!filtered.items.some(row=>row.id===b.id));
  await ask('POST','/api/forum/users/990332/block','author',{enabled:false});const restored=await ask('GET',`/api/forum/threads/${a.id}`,'author');assert.equal(restored.posts[0].isBlockedAuthor,false);checks.push('block API filters authors and marks reply folding; unblock restores');
  const notices=await ask('GET','/api/forum/notifications','author');const home=await ask('GET','/api/forum/home','author');assert.equal(home.unreadNotificationCount,notices.unreadCount);assert.ok(notices.unreadCount>0);
  await ask('POST','/api/forum/notifications/read','author',{all:true});const fresh=await ask('GET','/api/forum/home','author');assert.equal(fresh.unreadNotificationCount,0);assert.equal((await ask('GET','/api/forum/notifications','author')).unreadCount,0);checks.push('real home unread count matches notifications before and after mark-all');
  const result={pass:true,level:'actual H3 HTTP and private MySQL; synthetic catalog/session rows',database:identity.databaseName,actualSelectDatabase:true,privateDatadirVerified:true,checks,calls,productionConnections:0,productionWrites:0};
  await writeFile(resolve(process.env.VIEWER_REVIEW_OUT,'core-sql-http.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,database:identity.databaseName,checks:checks.length,httpRequests:calls.length,productionConnections:0}));
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  globalThis.fetch=nativeFetch;globalThis.defineEventHandler=oldHandler;uninstall?.();if(pool)await pool.end();await admin.end();
 }
});
