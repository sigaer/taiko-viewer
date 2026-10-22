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

test('isolated real HTTP creates thread, replies, delivers owned notification, marks and opens reply',async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const database='viewer_community_pr33_test';
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
  for(const [id,name] of [[990331,'author'],[990332,'replier']]){
   await pool.execute('INSERT INTO web_user_accounts(id,username,email,password_hash,email_verified) VALUES (?,?,?,?,1)',[id,'synthetic-'+name,name+'@example.test','synthetic-session-fixture']);
   await pool.execute('INSERT INTO web_user_sessions(session_token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))',[(id===990331?'a':'b').repeat(64),id]);
  }
  const router=createRouter();
  for(const [method,path,file] of [
   ['post','/api/forum/threads','threads.post.ts'],['post','/api/forum/threads/:id/replies','threads/[id]/replies.post.ts'],
   ['get','/api/forum/threads/:id','threads/[id].get.ts'],['get','/api/forum/notifications','notifications.get.ts'],['post','/api/forum/notifications/read','notifications/read.post.ts']
  ])router[method](path,(await import('../server/api/forum/'+file)).default);
  server=createServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;const calls=[];
  globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).origin,base,'external requests forbidden');return nativeFetch(url,options);};
  const ask=async(method,path,account,body)=>{
   const response=await fetch(base+path,{method,headers:{'content-type':'application/json',cookie:'stv_session='+(account==='author'?'a':'b').repeat(64)},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
   const value=await response.json();calls.push({method,path,account,status:response.status});assert.equal(response.status,200,JSON.stringify(value).slice(0,300));return value;
  };
  const paragraphs=['合成作者正文，不能在失败或重试时丢失。','Synthetic second paragraph — 保持歌曲关联。'];
  const created=await ask('POST','/api/forum/threads','author',{sectionSlug:'score-guides',threadType:'discussion',title:'Synthetic PR33 persistence thread',songId:100,difficultyType:4,level:9,contentBlocks:paragraphs.map(text=>({type:'paragraph',text}))});
  assert.ok(created.id>0);assert.deepEqual(created.contentBlocks.map(b=>b.text),paragraphs);assert.equal(created.song.id,100);assert.equal(created.song.difficultyType,4);assert.equal(created.author.id,990331);
  const replied=await ask('POST','/api/forum/threads/'+created.id+'/replies','replier',{bodyText:'合成回复：这条通知必须属于原作者。'});
  assert.equal(replied.posts.length,1);const reply=replied.posts[0];assert.equal(reply.author.id,990332);assert.equal(reply.bodyText,'合成回复：这条通知必须属于原作者。');
  const notifications=await ask('GET','/api/forum/notifications?page=1&pageSize=20','author');assert.equal(notifications.total,1);assert.equal(notifications.unreadCount,1);const item=notifications.items[0];assert.equal(item.threadId,created.id);assert.equal(item.postId,reply.id);assert.equal(item.actor.id,990332);assert.equal(item.isRead,false);
  const own=await ask('GET','/api/forum/notifications','replier');assert.equal(own.total,0);
  await ask('POST','/api/forum/notifications/read','replier',{ids:[item.id]});assert.equal((await ask('GET','/api/forum/notifications','author')).unreadCount,1);
  const marked=await ask('POST','/api/forum/notifications/read','author',{ids:[item.id]});assert.equal(marked.unreadCount,0);
  const final=await ask('GET','/api/forum/notifications','author');assert.equal(final.items[0].isRead,true);assert.equal(final.unreadCount,0);
  const opened=await ask('GET','/api/forum/threads/'+item.threadId,'author');assert.equal(opened.posts.find(p=>p.id===item.postId).bodyText,reply.bodyText);
  const [[stored]]=await pool.query('SELECT author_user_id,song_id,difficulty_type,content_blocks_json FROM forum_threads WHERE id=?',[created.id]);assert.equal(stored.author_user_id,990331);assert.equal(stored.song_id,100);assert.equal(stored.difficulty_type,4);assert.deepEqual(JSON.parse(stored.content_blocks_json).map(b=>b.text),paragraphs);
  const [[notice]]=await pool.query('SELECT user_id,is_read FROM forum_notifications WHERE id=?',[item.id]);assert.equal(notice.user_id,990331);assert.equal(notice.is_read,1);
  const result={pass:true,level:'real isolated MySQL plus real H3 HTTP handlers/services; synthetic accounts and catalog',database:identity.databaseName,actualSelectDatabase:true,privateDatadirVerified:true,networkDisabledDatabase:true,bodyVerified:true,songId:100,difficultyType:4,notificationOwner:990331,unreadBefore:1,unreadAfter:0,foreignAccountMarkCannotChangeOwner:true,replyTarget:'/forum/thread/'+created.id+'#reply-'+reply.id,calls,productionConnections:0,productionWrites:0};
  await writeFile(resolve(process.env.VIEWER_REVIEW_OUT,'sql-http.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,database:identity.databaseName,httpRequests:calls.length,productionConnections:0}));
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  globalThis.fetch=nativeFetch;globalThis.defineEventHandler=oldHandler;uninstall?.();if(pool)await pool.end();await admin.end();
 }
});
