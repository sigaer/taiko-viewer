// Two owned loopback servers, actual account/session/source/token SQL, no real gateways.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createApp,createRouter,defineEventHandler,toNodeListener} from 'h3';
import {manualSqlFixture,manualSourceSnapshot} from './manualSqlRuntime.mjs';
const nativeFetch=globalThis.fetch;
const digest=token=>createHash('sha256').update(token).digest('hex');
export function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
export async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned account source race deadline')),5000);})]);}finally{clearTimeout(timer);}}
export async function sourceSnapshot(c){return c.scopeModule.withDomainScoreRead(c.taikoId,async()=>({raw:await manualSourceSnapshot(c),publication:c.scopeModule.scorePublication(c.taikoId)}));}

export async function accountSourceFixture(task,{manual=false,withDeveloper=false}={}){
 return manualSqlFixture(async context=>{
  const c={...context,manualId:context.taikoId,ownedTokenIds:new Set([context.taikoId])};
  if(!manual){
   c.taikoId='7'+BigInt('0x'+randomUUID().replaceAll('-','').slice(0,12)).toString().padStart(15,'0');
   c.ownedTokenIds.add(c.taikoId);
   await c.shared.writeUserdataWithHistory(c.taikoId,{profile:{userid:c.taikoId,gameCostume:{title:'Synthetic current title',titleplate_id:2}},songs:[]},'wahlap');
   await c.pool.execute('UPDATE web_taiko_bindings SET is_current=0 WHERE user_id=?',[c.user]);
   const [created]=await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,verified_title,verified_titleplate_id,is_current) VALUES (?,?,'wahlap','Verified public title',1,1)",[c.user,c.taikoId]);c.bindingId=created.insertId;
  }else{const [[row]]=await c.pool.query('SELECT id FROM web_taiko_bindings WHERE user_id=?',[c.user]);c.bindingId=row.id;}
  const previousHandler=globalThis.defineEventHandler,previousFetch=globalThis.fetch,previousCookie=process.env.TAIKO_WAHLAP_COOKIE;
  let api,gateway;
  const gate={requests:[],beforeRequest:null,afterMutation:null,reply:null,targetReply:null,failure:null};c.gate=gate;
  try{
   process.env.TAIKO_WAHLAP_COOKIE='synthetic-public-cookie';globalThis.defineEventHandler=defineEventHandler;
   gateway=createServer(async(req,res)=>{
    try{
     if(req.url==='/targets'){
      gate.requests.push({action:'targets'});await gate.beforeRequest?.('targets');
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(gate.targetReply||{ok:true,targets:[{id:'sakura-bot',label:'Sakura bot',description:'Synthetic target'}]}));return;
     }
     assert.equal(req.url,'/score-token');assert.equal(req.method,'POST');
     let body='';for await(const chunk of req){body+=chunk.toString();assert.ok(body.length<4096);}
     const input=JSON.parse(body);assert.ok(c.ownedTokenIds.has(input.userid),'Gateway accepts only this fixture sources');
     gate.requests.push(input);await gate.beforeRequest?.(input.action);
     if(gate.failure){res.writeHead(gate.failure.status,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,message:gate.failure.message}));return;}
     let token,revoked;
     if(input.action==='issue'){
      token=randomBytes(24).toString('hex');
      await c.pool.execute(`INSERT INTO public_score_tokens(taiko_id,token_hash,token_mask) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),token_mask=VALUES(token_mask),last_used_at=NULL`,[input.userid,digest(token),token.slice(0,8)+'...'+token.slice(-8)]);
     }else if(input.action==='revoke'){
      const [removed]=await c.pool.execute('DELETE FROM public_score_tokens WHERE taiko_id=?',[input.userid]);revoked=removed.affectedRows>0;
     }else assert.equal(input.action,'status');
     await gate.afterMutation?.(input.action,token);
     const [[row]]=await c.pool.query(`SELECT token_mask,DATE_FORMAT(last_used_at,'%Y-%m-%dT%H:%i:%s') AS last_used_at,
       DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s') AS created_at,DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s') AS updated_at FROM public_score_tokens WHERE taiko_id=?`,[input.userid]);
     let payload={ok:true,action:input.action,...(token?{token}:{}),...(revoked!==undefined?{revoked}:{}),status:{taiko_id:input.userid,exists:Boolean(row),token_mask:row?.token_mask||null,last_used_at:row?.last_used_at||null,created_at:row?.created_at||null,updated_at:row?.updated_at||null}};
     if(gate.reply)payload=await gate.reply(payload,input.action);
     res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(payload));
    }catch{
     if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,message:'Owned gateway fixture failed'}));
    }
   });
   gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
   const gatewayBase=`http://127.0.0.1:${gateway.address().port}`;c.config.localSyncReceiverBaseUrl=gatewayBase;
   globalThis.fetch=async(url,options)=>{
    const target=String(url);assert.ok(target===gatewayBase+'/targets'||target===gatewayBase+'/score-token','No diagnostic or external requests permitted');
    return nativeFetch(url,options);
   };
   const router=createRouter();
   c.route=(method,path,handler)=>router[method](path,defineEventHandler(handler));
   for(const [method,path,file] of [['post','/login','auth/login.post.ts'],['post','/logout','auth/logout.post.ts'],['get','/profile','profile.get.ts'],['get','/bindings','bindings.get.ts'],['get','/sync','sync/targets.get.ts'],['post','/sync-submit','sync.post.ts'],['post','/token','score-token.post.ts'],['post','/current','bindings/current.post.ts'],['post','/remove','bindings/remove.post.ts']])router[method](path,(await import(new URL('../../server/api/account/'+file,import.meta.url).href)).default);
   api=createServer(toNodeListener(createApp().use(router)));api.listen(0,'127.0.0.1');await once(api,'listening');
   const apiBase=`http://127.0.0.1:${api.address().port}`;
   c.baseUrl=apiBase;
   c.request=(method,path,body,cookie=c.cookie,headers={})=>nativeFetch(apiBase+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie||'',...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
   c.read=async path=>{const response=await c.request('GET',path);const body=await response.json();assert.equal(response.status,200);return body;};
   const password=randomBytes(16).toString('hex'),[[account]]=await c.pool.query('SELECT username FROM web_user_accounts WHERE id=?',[c.user]);
   await c.pool.execute('UPDATE web_user_accounts SET password_hash=?,email_verified=1 WHERE id=?',[await c.shared.getPasswordHash(password),c.user]);
   c.login=async()=>{const response=await c.request('POST','/login',{identifier:account.username,password},'');assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};c.cookie=await c.login();
   c.profile=await import('../../server/utils/account/profile.ts');c.sync=await import('../../server/utils/account/sync.ts');c.tokens=await import('../../server/services/account/score-token-authority.ts');
   await task(c);
  }finally{
   for(const server of [api,gateway])if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
   globalThis.fetch=previousFetch;
   if(previousCookie===undefined)delete process.env.TAIKO_WAHLAP_COOKIE;else process.env.TAIKO_WAHLAP_COOKIE=previousCookie;
   if(previousHandler===undefined)delete globalThis.defineEventHandler;else globalThis.defineEventHandler=previousHandler;
   for(const id of c.ownedTokenIds)await c.pool.execute('DELETE FROM public_score_tokens WHERE taiko_id=?',[id]);
  }
 },{withAccountSource:true,withDeveloper});
}

export async function queuedAccountSource(c,operation,change){
 const {openPublicationLease}=await import('../../server/infrastructure/taiko-publication/client.ts');
 const held=await openPublicationLease({root:c.config.userdataDir,repoRoot:c.config.repoRoot,identity:c.taikoId,mode:'write'});
 const observed=deferred();c.state.afterExecute=sql=>{if(!c.scopeModule.currentScoreScope()&&sql.includes('FROM web_taiko_bindings'))observed.resolve();};
 const reading=operation();reading.catch(()=>{});
 try{await bounded(observed.promise);await change();await held.close();return await reading;}
 finally{await held.close();await reading.catch(()=>{});c.state.afterExecute=null;}
}

export async function replaceIdentity(c,field){
 if(field==='id'){
  await c.pool.execute('DELETE FROM web_taiko_bindings WHERE id=?',[c.bindingId]);
  await c.pool.execute("INSERT INTO web_taiko_bindings(user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)",[c.user,c.taikoId]);
 }else await c.pool.execute(`UPDATE web_taiko_bindings SET ${field}=? WHERE id=?`,[field==='taiko_id'?c.taikoId+'1':field==='source'?'hiroba':c.manualId,c.bindingId]);
}
