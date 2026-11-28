// Author edit / delete over one real H3 / MySQL chain (isolated, owned test database only; refused elsewhere by the
// environment guard below). Catalog and runtime are synthetic; session lookup, permissions, forum services, SQL and
// HTTP handlers are real.
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

test('isolated author edit / delete HTTP: ownership, lock, hidden and deleted states, moderator powers unchanged',async()=>{
 assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
 const database='viewer_community_author_test';
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
  const {ACCOUNT_TITLE_TABLE_SQL}=await import('../server/services/account-titles/schema.ts');
  await pool.execute(ACCOUNT_TITLE_TABLE_SQL);
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
   ['get','/api/forum/notifications','notifications.get.ts'],['post','/api/forum/notifications/read','notifications/read.post.ts'],
   ['get','/api/forum/notifications/unread','notifications/unread.get.ts'],
   ['get','/api/forum/users/:id','users/[id].get.ts'],
   ['post','/api/forum/threads/:id/edit','threads/[id]/edit.post.ts'],['post','/api/forum/threads/:id/delete','threads/[id]/delete.post.ts'],
   ['post','/api/forum/posts/:id/edit','posts/[id]/edit.post.ts'],['post','/api/forum/posts/:id/delete','posts/[id]/delete.post.ts'],
   ['post','/api/forum/threads/:id/favorite','threads/[id]/favorite.post.ts']
  ])router[method](path,(await import('../server/api/forum/'+file)).default);
  server=createServer(toNodeListener(createApp().use(router)));server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port,calls=[],checks=[];
  globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).origin,base,'external requests forbidden');return nativeFetch(url,options);};
  const ask=async(method,path,account,body,status=200)=>{
   const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(account?{cookie:'stv_session='+({author:'a',replier:'b',admin:'c'}[account]).repeat(64)}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
   const value=await response.json();calls.push({method,path,account:account||'guest',status:response.status});assert.equal(response.status,status,'HTTP status mismatch: '+path+' '+String(value.statusMessage||value.message||'').slice(0,300));return value;
  };
  const body=text=>[{type:'paragraph',text}];
  const thread=await ask('POST','/api/forum/threads','author',{sectionSlug:'general',threadType:'discussion',title:'Synthetic author thread',contentBlocks:body('Original body')});
  // Thread edit: guests, other members and moderators cannot edit another member's thread.
  await ask('POST',`/api/forum/threads/${thread.id}/edit`,null,{title:'Guest edit',contentBlocks:body('x')},401);
  await ask('POST',`/api/forum/threads/${thread.id}/edit`,'replier',{title:'Other member edit',contentBlocks:body('x')},403);
  await ask('POST',`/api/forum/threads/${thread.id}/edit`,'admin',{title:'Moderator edit',contentBlocks:body('x')},403);
  await ask('POST',`/api/forum/threads/${thread.id}/edit`,'author',{title:'Synthetic author thread',contentBlocks:[]},400);
  await ask('POST',`/api/forum/threads/${thread.id}/edit`,'author',{title:'短',contentBlocks:body('x')},400);
  await ask('POST','/api/forum/threads/999999999/edit','author',{title:'Missing thread',contentBlocks:body('x')},404);
  const edited=await ask('POST',`/api/forum/threads/${thread.id}/edit`,'author',{title:'Synthetic edited thread',tags:['a','a','b'],contentBlocks:[...body('Edited body'),{type:'image',imageUrl:'https://static.example.test/x.png',caption:'c'}]});
  assert.equal(edited.id,thread.id);assert.equal(edited.title,'Synthetic edited thread');assert.deepEqual(edited.tags,['a','b']);
  assert.equal(edited.contentBlocks[0].text,'Edited body');assert.equal(edited.coverImageUrl,'https://static.example.test/x.png');
  const [[threadRow]]=await pool.query('SELECT title,status,author_user_id FROM forum_threads WHERE id=?',[thread.id]);
  assert.equal(threadRow.title,'Synthetic edited thread');assert.equal(threadRow.status,'published');assert.equal(threadRow.author_user_id,990331);
  checks.push('thread edit: 401 guest, 403 other member and moderator, 400 empty body / short title, 404 missing; author edit persists title, body, tags and cover only');
  // Reply edit / delete.
  const floorDetail=await ask('POST',`/api/forum/threads/${thread.id}/replies`,'replier',{bodyText:'Replier floor'});const floor=floorDetail.posts[0];
  await ask('POST',`/api/forum/posts/${floor.id}/edit`,'author',{bodyText:'Not mine'},403);
  await ask('POST',`/api/forum/posts/${floor.id}/edit`,'admin',{bodyText:'Moderator'},403);
  await ask('POST',`/api/forum/posts/${floor.id}/edit`,'replier',{bodyText:''},400);
  const floorEdited=await ask('POST',`/api/forum/posts/${floor.id}/edit`,'replier',{bodyText:'Replier floor edited'});
  assert.equal(floorEdited.posts[0].bodyText,'Replier floor edited');assert.equal(floorEdited.posts[0].floorNo,floor.floorNo);
  const nestedDetail=await ask('POST',`/api/forum/threads/${thread.id}/replies`,'author',{bodyText:'Author nested',parentPostId:floor.id});
  const nested=nestedDetail.posts[0].replies[0];const countBefore=nestedDetail.replyCount;
  await ask('POST',`/api/forum/posts/${floor.id}/delete`,'replier',undefined,400);
  await ask('POST',`/api/forum/posts/${nested.id}/delete`,'replier',undefined,403);
  const afterNested=await ask('POST',`/api/forum/posts/${nested.id}/delete`,'author');
  assert.equal(afterNested.replyCount,countBefore-1);assert.equal(afterNested.posts[0].replies.length,0);
  await ask('POST',`/api/forum/posts/${nested.id}/delete`,'author',undefined,404);
  await ask('POST',`/api/forum/posts/${nested.id}/edit`,'author',{bodyText:'Edit a deleted reply'},404);
  const afterFloor=await ask('POST',`/api/forum/posts/${floor.id}/delete`,'replier');assert.equal(afterFloor.posts.length,0);
  const [[postRows]]=await pool.query("SELECT COUNT(*) AS total FROM forum_posts WHERE thread_id=? AND status='deleted'",[thread.id]);assert.equal(postRows.total,2);
  const again=await ask('POST',`/api/forum/threads/${thread.id}/replies`,'replier',{bodyText:'Next floor'});assert.equal(again.posts[0].floorNo,floor.floorNo+1,'floor numbers are not reused');
  checks.push('reply edit / delete: owner only (moderators unchanged), floor with live replies refused, reply_count decremented, soft rows 404 afterwards, floor numbers not reused');
  // Lock and hide stop author writes; moderator actions are unchanged.
  await ask('POST','/api/forum/moderation/action','admin',{threadId:thread.id,action:'lock',enabled:true});
  await ask('POST',`/api/forum/threads/${thread.id}/edit`,'author',{title:'Locked edit',contentBlocks:body('x')},400);
  await ask('POST',`/api/forum/threads/${thread.id}/delete`,'author',undefined,400);
  await ask('POST',`/api/forum/posts/${again.posts[0].id}/edit`,'replier',{bodyText:'Locked reply edit'},400);
  await ask('POST','/api/forum/moderation/action','admin',{threadId:thread.id,action:'lock',enabled:false});
  await ask('POST','/api/forum/moderation/action','admin',{threadId:thread.id,action:'hide',enabled:true});
  await ask('POST',`/api/forum/threads/${thread.id}/edit`,'author',{title:'Hidden edit',contentBlocks:body('x')},404);
  await ask('POST',`/api/forum/threads/${thread.id}/delete`,'author',undefined,404);
  await ask('POST','/api/forum/moderation/action','admin',{threadId:thread.id,action:'hide',enabled:false});
  checks.push('locked thread: author edit / delete / reply edit refused (400); hidden thread: 404; unlock / restore unchanged');
  // Thread delete.
  await ask('POST',`/api/forum/threads/${thread.id}/delete`,'replier',undefined,403);
  await ask('POST',`/api/forum/threads/${thread.id}/delete`,'admin',undefined,403);
  assert.deepEqual(await ask('POST',`/api/forum/threads/${thread.id}/delete`,'author'),{ok:true});
  const [[deletedRow]]=await pool.query('SELECT status FROM forum_threads WHERE id=?',[thread.id]);assert.equal(deletedRow.status,'deleted');
  for(const account of [null,'author','admin'])await ask('GET',`/api/forum/threads/${thread.id}`,account,undefined,404);
  assert.ok(!(await ask('GET','/api/forum/threads?includeHidden=1','admin')).items.some(row=>row.id===thread.id));
  assert.ok(!(await ask('GET','/api/forum/threads?scope=mine','author')).items.some(row=>row.id===thread.id));
  await ask('POST','/api/forum/moderation/action','admin',{threadId:thread.id,action:'hide',enabled:false},404);
  await ask('POST',`/api/forum/threads/${thread.id}/favorite`,'replier',{enabled:true},404);
  await ask('POST',`/api/forum/threads/${thread.id}/replies`,'replier',{bodyText:'Reply to deleted'},404);
  await ask('POST',`/api/forum/threads/${thread.id}/delete`,'author',undefined,404);
  checks.push('thread delete: owner only, soft status, 404 for guest / author / moderator, gone from lists and moderation, no favourite / reply / restore');
  // Concurrent deletion and child insertion must serialize on the thread row.
  for (let attempt=0; attempt<3; attempt++) {
    const raceThread=await ask('POST','/api/forum/threads','author',{sectionSlug:'general',threadType:'discussion',title:'Concurrent floor test',contentBlocks:body('Race fixture')});
    const raceFloor=(await ask('POST',`/api/forum/threads/${raceThread.id}/replies`,'replier',{bodyText:'Floor'})).posts[0];
    const concurrent=async(path,account,payload)=>{
      const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',cookie:'stv_session='+(account==='author'?'a':'b').repeat(64)},body:JSON.stringify(payload||{}),signal:AbortSignal.timeout(10000)});
      await response.json();return response.status;
    };
    const statuses=await Promise.all([
      concurrent(`/api/forum/posts/${raceFloor.id}/delete`,'replier'),
      concurrent(`/api/forum/threads/${raceThread.id}/replies`,'author',{bodyText:'Concurrent child',parentPostId:raceFloor.id})
    ]);
    assert.ok((statuses[0]===200 && statuses[1]===404) || (statuses[0]===400 && statuses[1]===200),'one of deleting the floor or adding its child must be refused');
    const [[orphans]]=await pool.query("SELECT COUNT(*) AS total FROM forum_posts p JOIN forum_posts root ON root.id=p.root_post_id WHERE p.thread_id=? AND p.status='published' AND root.status<>'published'",[raceThread.id]);
    assert.equal(orphans.total,0);
    const [[counts]]=await pool.query("SELECT t.reply_count,(SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id=t.id AND p.status='published') AS actual FROM forum_threads t WHERE t.id=?",[raceThread.id]);
    assert.equal(counts.reply_count,counts.actual);
  }
  checks.push('concurrent floor deletion / child insertion: no orphan reply and committed counts agree');
  // Force an author deletion between moderation's read and update, on real SQL.
  const raceModeration=await ask('POST','/api/forum/threads','author',{sectionSlug:'general',threadType:'discussion',title:'Concurrent moderation test',contentBlocks:body('Race fixture')});
  const originalExecute=pool.execute.bind(pool);
  let injected=false;
  pool.execute=async(sql,params)=>{
    if (!injected && typeof sql==='string' && sql.startsWith('UPDATE forum_threads SET status = ?, updated_at = NOW() WHERE id = ?') && params?.[1]===raceModeration.id) {
      injected=true;
      await originalExecute("UPDATE forum_threads SET status='deleted' WHERE id=?",[raceModeration.id]);
    }
    return originalExecute(sql,params);
  };
  try { await ask('POST','/api/forum/moderation/action','admin',{threadId:raceModeration.id,action:'hide',enabled:false},404); }
  finally { pool.execute=originalExecute; }
  assert.equal(injected,true);
  const [[raceRow]]=await pool.query('SELECT status FROM forum_threads WHERE id=?',[raceModeration.id]);
  assert.equal(raceRow.status,'deleted');
  checks.push('moderation racing an author deletion cannot restore the deleted thread');
  const result={pass:true,level:'actual H3 HTTP and private MySQL; synthetic catalog/session rows',database:identity.databaseName,actualSelectDatabase:true,privateDatadirVerified:true,checks,calls,productionConnections:0,productionWrites:0};
  await writeFile(resolve(process.env.VIEWER_REVIEW_OUT,'author-edit-sql-http.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,database:identity.databaseName,checks:checks.length,httpRequests:calls.length,productionConnections:0}));
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  globalThis.fetch=nativeFetch;globalThis.defineEventHandler=oldHandler;uninstall?.();if(pool)await pool.end();await admin.end();
 }
});
