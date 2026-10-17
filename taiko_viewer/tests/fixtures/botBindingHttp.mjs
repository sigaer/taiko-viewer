import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {accountSourceFixture} from './accountSourceHttp.mjs';
const nonce=()=>randomUUID().replaceAll('-','');
export async function botBindingFixture(task){return accountSourceFixture(async c=>{
 const qq='1'+BigInt('0x'+nonce().slice(0,10)).toString().padStart(12,'0');c.principal='onebot_v11:'+qq;c.qq=qq;
 const ip='fd00:'+nonce().slice(0,4)+':'+nonce().slice(0,4)+'::1';c.ip=ip;c.keys=[c.principal];c.credentialIds=new Set([c.taikoId,c.taikoId+'1',c.taikoId+'2']);c.state.expectedSourceMode='none';
 try{
 const [q]=await c.pool.execute("INSERT INTO web_user_qq_bindings(user_id,qq_number,status,verified_at) VALUES (?,?,'active',NOW())",[c.user,qq]);c.qqId=String(q.insertId);
 c.rawToken=randomBytes(12).toString('hex');const [token]=await c.pool.execute('INSERT INTO web_developer_tokens(user_id,token_hash,token_mask) VALUES (?,?,?)',[c.user,createHash('sha256').update(c.rawToken).digest('hex'),'synthetic']);c.tokenId=String(token.insertId);
 c.register=async({scopes=['bind_read','bind_write','bind_current'],sources='*',principals=[c.principal]}={})=>c.pool.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,principals_json,revision_nonce,status,issued_by_user_id)
 VALUES (?,?,'synthetic-center',?,?,?,?,'active',?) ON DUPLICATE KEY UPDATE scopes_json=VALUES(scopes_json),sources_json=VALUES(sources_json),principals_json=VALUES(principals_json),revision_nonce=VALUES(revision_nonce),status='active'`,[c.tokenId,c.user,JSON.stringify(scopes),JSON.stringify(sources),principals===null?null:JSON.stringify(principals),nonce(),c.user]);
 c.seed=async(id=c.taikoId,{source='wahlap',slot=1,current=1,visible=0,key=c.principal}={})=>c.pool.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,?,?,?,?)',[key,id,visible,slot,current,source]);
 c.snapshot=async()=>{const [rows]=await c.pool.query('SELECT row_id,qq,id,visible,slot_index,is_current,source FROM bind WHERE qq=? ORDER BY slot_index,row_id',[c.principal]);const [state]=await c.pool.query('SELECT identity_key,current_virtual FROM taiko_bind_identity_state WHERE identity_key=?',[c.principal]);const [receipts]=await c.pool.query('SELECT operation_id,actor_hash,grant_hash,intent_hash,outcome_hash,effect_json,effect_hash FROM taiko_bot_binding_operations WHERE actor_user_id=? ORDER BY operation_id',[c.user]);return {rows,state,receipts};};
 for(const [method,path,file] of [['get','/bot-bind','bind.get.ts'],['post','/bot-bind','bind.post.ts'],['post','/bot-current','bind/current.post.ts'],['post','/bot-remove','bind/remove.post.ts'],['post','/bot-visibility','bind/visibility.post.ts'],['get','/api/taiko/proxy/bind','bind.get.ts'],['post','/api/taiko/proxy/bind/remove','bind/remove.post.ts'],['post','/api/taiko/proxy/bind/visibility','bind/visibility.post.ts']])c.route(method,path,(await import('../../server/api/taiko/proxy/'+file)).default);
 c.ask=async({action='read',principal=c.principal,body={},token,cookie=c.cookie,header}={})=>{
  const r=await c.request(action==='read'?'GET':'POST',action==='read'?'/bot-bind?identityKey='+encodeURIComponent(principal):action==='current'?'/bot-current':action==='remove'?'/bot-remove':action==='visibility'?'/bot-visibility':'/bot-bind',action==='read'?null:{identityKey:principal,...body},cookie,{'x-forwarded-for':ip,...(token?{authorization:'Bearer '+token}:{}),...(header!==undefined?{authorization:header}:{})});
  const result=await r.json();if(!r.ok)assert.ok(!JSON.stringify(result).includes('/password/hash')&&!JSON.stringify(result).includes(c.rawToken));return {status:r.status,body:result};
 };
 await task(c);
 }finally{
  c.state.afterExecute=null;c.state.beforeSqlStatement=null;c.state.afterSqlStatement=null;c.state.beforeSqlCommit=null;c.state.afterSqlCommit=null;
  for(const key of c.keys){await c.pool.execute('DELETE FROM bind WHERE qq=?',[key]);await c.pool.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=?',[key]);}
  for(const id of c.credentialIds)await c.pool.execute('DELETE FROM web_hiroba_credentials WHERE taiko_no=?',[id]);
  await c.pool.execute('DELETE FROM web_user_qq_bindings WHERE user_id=?',[c.user]);await c.pool.execute('DELETE FROM web_taiko_open_api_daily_usage WHERE ip_address=?',[ip]);
 }
},{withDeveloper:true});}
