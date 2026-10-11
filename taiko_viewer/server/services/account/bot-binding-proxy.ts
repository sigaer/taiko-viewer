import {createHash,randomUUID} from 'node:crypto';
import type {H3Event} from 'h3';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {MANUAL_SOURCE_ID} from '../../internal/account/source-lifecycle.ts';
import {enterPrivateWorker,leavePrivateWorker} from '../../infrastructure/account/private-worker-admission.ts';
import {readBotBindingData,botBindingPayload,applyBotBindingIntent,type BotBindingIntent} from '../../infrastructure/account/bot-binding-rows.ts';
import {capturePrincipalAccess,provePrincipalAccess,principalFailure,safePrincipalError,type PrincipalTicket} from './principal-access.ts';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const operationId=(input:unknown)=>{if(input===undefined||input===null||input==='')return randomUUID().replaceAll('-','');
 if(typeof input!=='string'||!(/^[a-f0-9]{32}$/.test(input)||/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input)))throw principalFailure(400,'请求标识无效。');return input.replaceAll('-','');};
const unavailable=()=>safePrincipalError(new Error('Private binding operation unavailable'));
const RECEIPT_SELECT='SELECT actor_user_id,actor_hash,grant_hash,principal,action,intent_hash,outcome_hash FROM taiko_bot_binding_operations WHERE operation_id=?';
const matches=(row:RowDataPacket,t:PrincipalTicket,intent:BotBindingIntent)=>row.actor_user_id===t.actor.userId&&row.actor_hash===hash(t.actor)&&row.grant_hash===hash(t.grant)&&row.principal===t.principal&&row.action===intent.action&&row.intent_hash===hash(intent);
async function resolveCommit(ticket:PrincipalTicket,intent:BotBindingIntent,id:string,expectedHash:string){
 const db=await ticket.db.getConnection();let discard=false;
 try{await db.beginTransaction();await provePrincipalAccess(db,ticket,true);
  const result=botBindingPayload(ticket.principal,await readBotBindingData(db,ticket));
  const [[receipt]]=await db.execute<RowDataPacket[]>(RECEIPT_SELECT,[id]);
  if(!receipt||!matches(receipt,ticket,intent)||receipt.outcome_hash!==expectedHash||hash(result)!==expectedHash)throw unavailable();
  await provePrincipalAccess(db,ticket,true);await db.commit();return result;
 }catch{try{await db.rollback();}catch{discard=true;db.destroy();}throw unavailable();}
 finally{if(!discard)db.release();}
}
/** SQL-only metadata. Never acquire a Source lock after starting SQL. */
export async function runBotBindingOperation(event:H3Event,action:BotBindingIntent['action'],body:Record<string,unknown>){
 let ticket:PrincipalTicket;
 try{
  const sourceId=action==='upsert'&&typeof body.taikoId==='string'?body.taikoId.trim():null;
  const platform=action==='upsert'?(body.source===undefined||body.source===''?'wahlap':body.source):null;
  if(action==='upsert'&&(!sourceId||!/^[0-9]{1,25}$/.test(sourceId)||MANUAL_SOURCE_ID.test(sourceId)||!['wahlap','hiroba'].includes(String(platform))))throw principalFailure(400,'绑定账号或来源无效。');
  const visible=action==='upsert'?(body.visible===undefined?0:Number(body.visible)):null;
  if(action==='upsert'&&(![0,1].includes(visible!)||!['number','boolean','string','undefined'].includes(typeof body.visible)))throw principalFailure(400,'可见性无效。');
  const slot=action==='current'?Number(body.slot??0):null;if(action==='current'&&(!Number.isSafeInteger(slot)||slot!<0||slot!>=1000000))throw principalFailure(400,'槽位无效。');
  const id=action==='read'?null:operationId(body.requestId);
  ticket=await capturePrincipalAccess(event,body.identityKey,action==='read'?'bind_read':action==='upsert'?'bind_write':'bind_current',sourceId,platform as 'wahlap'|'hiroba'|null);
  const intent:BotBindingIntent={action,principal:ticket.principal,sourceId,platform:platform as BotBindingIntent['platform'],visible,slot};
  await enterPrivateWorker();
  let connection:PoolConnection|undefined,discard=false,attempted=false,producedHash:string|undefined,lockName='taiko-bind-'+hash(ticket.principal).slice(0,52);
  try{
   connection=await ticket.db.getConnection();
   const [[lock]]=await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?,5) AS acquired',[lockName]);if(lock?.acquired!==1)throw unavailable();
   await connection.beginTransaction();await provePrincipalAccess(connection,ticket,true);
   const data=await readBotBindingData(connection,ticket);
   let replay=false;
   if(id){const [[receipt]]=await connection.execute<RowDataPacket[]>(RECEIPT_SELECT+' FOR UPDATE',[id]);
    if(receipt){if(!matches(receipt,ticket,intent))throw principalFailure(409,'请求标识已用于其他操作。');replay=true;}}
   if(!replay)await applyBotBindingIntent(connection,ticket,intent,data);
   const result=botBindingPayload(ticket.principal,action==='read'||replay?data:await readBotBindingData(connection,ticket));
   await provePrincipalAccess(connection,ticket,true);
   if(id&&!replay){producedHash=hash(result);await connection.execute(`INSERT INTO taiko_bot_binding_operations(operation_id,actor_user_id,actor_hash,grant_hash,principal,action,intent_hash,outcome_hash)
     VALUES (?,?,?,?,?,?,?,?)`,[id,ticket.actor.userId,hash(ticket.actor),hash(ticket.grant),ticket.principal,action,hash(intent),producedHash]);}
   attempted=true;await connection.commit();return result;
  }catch(error){
   if(connection)try{await connection.rollback();}catch{discard=true;connection.destroy();}
   if(attempted&&producedHash&&id)try{return await resolveCommit(ticket,intent,id,producedHash);}catch{/* Unknown COMMIT stays unavailable. */}
   throw safePrincipalError(error);
  }finally{
   if(connection&&!discard){try{const [[released]]=await connection.execute<RowDataPacket[]>('SELECT RELEASE_LOCK(?) AS released',[lockName]);if(released?.released!==1)throw new Error('Lock release unproved');connection.release();}catch{connection.destroy();}}
   leavePrivateWorker();
  }
 }catch(error){throw safePrincipalError(error);}
}
