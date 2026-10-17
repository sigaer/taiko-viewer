import {randomUUID} from 'node:crypto';
import type {H3Event} from 'h3';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {MANUAL_SOURCE_ID} from '../../internal/account/source-lifecycle.ts';
import {enterPrivateWorker,leavePrivateWorker} from '../../infrastructure/account/private-worker-admission.ts';
import {readBotBindingData,applyBotBindingIntent,type BotBindingIntent} from '../../infrastructure/account/bot-binding-rows.ts';
import {bindingHash as hash,bindingResponse,effectHash,receiptEffect} from '../../infrastructure/account/bot-binding-effect.ts';
import {capturePrincipalAccess,provePrincipalAccess,requirePrincipalSources,principalFailure,safePrincipalError,type PrincipalTicket,type PrincipalScope} from './principal-access.ts';

const operationId=(input:unknown)=>{
 if(input===undefined||input===null||input==='')return randomUUID().replaceAll('-','');
 if(typeof input!=='string'||!(/^[a-f0-9]{32}$/.test(input)||/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input)))throw principalFailure(400,'请求标识无效。');
 return input.replaceAll('-','');
};
const unavailable=()=>safePrincipalError(new Error('Private binding operation unavailable'));
const RECEIPT_SELECT='SELECT actor_user_id,actor_hash,grant_hash,principal,action,intent_hash,outcome_hash,effect_json,effect_hash FROM taiko_bot_binding_operations WHERE operation_id=?';
const matches=(row:RowDataPacket,t:PrincipalTicket,intent:BotBindingIntent)=>row.actor_user_id===t.actor.userId&&row.actor_hash===hash(t.actor)&&row.grant_hash===hash(t.grant)&&row.principal===t.principal&&row.action===intent.action&&row.intent_hash===hash(intent);
const gate=(ticket:PrincipalTicket)=>'taiko-bind-'+hash(ticket.principal).slice(0,52);
async function acquire(db:PoolConnection,name:string){
 const [[row]]=await db.execute<RowDataPacket[]>('SELECT GET_LOCK(?,5) AS acquired',[name]);
 if(row?.acquired!==1)throw unavailable();
}
async function close(db:PoolConnection,name:string,discard=false){
 if(discard)return;
 try{
  const [[row]]=await db.execute<RowDataPacket[]>('SELECT RELEASE_LOCK(?) AS released',[name]);
  if(row?.released!==1)throw unavailable();
  db.release();
 }catch{db.destroy();}
}
function requireIntentSource(ticket:PrincipalTicket,intent:BotBindingIntent){
 if(intent.sourceId)requirePrincipalSources(ticket,[intent.sourceId]);
}
async function resolveCommit(ticket:PrincipalTicket,intent:BotBindingIntent,id:string,expectedHash:string){
 const db=await ticket.db.getConnection();let discard=false;
 try{
  await acquire(db,gate(ticket));await db.beginTransaction();await provePrincipalAccess(db,ticket,true);requireIntentSource(ticket,intent);
  const data=await readBotBindingData(db,ticket);
  const [[receipt]]=await db.execute<RowDataPacket[]>(RECEIPT_SELECT+' FOR UPDATE',[id]);
  if(!receipt||!matches(receipt,ticket,intent))throw unavailable();
  const result=bindingResponse(ticket.principal,data,intent,receiptEffect(receipt,intent));
  if(receipt.outcome_hash!==expectedHash||hash(result)!==expectedHash)throw unavailable();
  await provePrincipalAccess(db,ticket,true);await db.commit();return result;
 }catch{
  try{await db.rollback();}catch{discard=true;db.destroy();}
  throw unavailable();
 }finally{await close(db,gate(ticket),discard);}
}

/** SQL-only metadata. Never acquire a Source lock after starting SQL. */
export async function runBotBindingOperation(event:H3Event,action:BotBindingIntent['action'],body:Record<string,unknown>){
 try{
  if(!body||typeof body!=='object'||Array.isArray(body))throw principalFailure(400,'绑定请求无效。');
  const sourceId=(action==='upsert'||action==='remove')&&typeof body.taikoId==='string'?body.taikoId.trim():null;
  const platform=action==='upsert'?(body.source===undefined||body.source===''?'wahlap':body.source):null;
  if(action==='upsert'&&(!sourceId||!/^[0-9]{1,25}$/.test(sourceId)||MANUAL_SOURCE_ID.test(sourceId)||!['wahlap','hiroba'].includes(String(platform))))throw principalFailure(400,'绑定账号或来源无效。');
  if(action==='remove'&&(!sourceId||!/^[0-9]{1,25}$/.test(sourceId)))throw principalFailure(400,'删除目标无效。');
  const visible=(action==='upsert'||action==='visibility')?(body.visible===undefined?0:Number(body.visible)):null;
  if((action==='upsert'||action==='visibility')&&(![0,1].includes(visible!)||!['number','boolean','string','undefined'].includes(typeof body.visible)))throw principalFailure(400,'可见性无效。');
  if(action==='visibility'&&body.visible===undefined)throw principalFailure(400,'可见性无效。');
  const slot=action==='current'?Number(body.slot??0):null;
  if(action==='current'&&(!Number.isSafeInteger(slot)||slot!<0||slot!>=1000000))throw principalFailure(400,'槽位无效。');
  const forceLast=action==='remove'?(body.forceLast===undefined?false:body.forceLast):undefined;
  if(action==='remove'&&typeof forceLast!=='boolean')throw principalFailure(400,'删除确认无效。');
  const id=action==='read'?null:operationId(body.requestId);
  const scopes:Record<BotBindingIntent['action'],PrincipalScope>={read:'bind_read',upsert:'bind_write',current:'bind_current',remove:'bind_remove',visibility:'bind_visibility'};
  const ticket=await capturePrincipalAccess(event,body.identityKey,scopes[action],action==='upsert'?sourceId:null,platform as 'wahlap'|'hiroba'|null);
  // Keep the frozen upsert/current intent hashes compatible with old receipts.
  const intent:BotBindingIntent={action,principal:ticket.principal,sourceId,platform:platform as BotBindingIntent['platform'],visible,slot,
   ...(action==='remove'?{forceLast:forceLast as boolean}:{})};
  requireIntentSource(ticket,intent);
  await enterPrivateWorker();
  let connection:PoolConnection|undefined,discard=false,attempted=false,producedHash:string|undefined;
  try{
   connection=await ticket.db.getConnection();await acquire(connection,gate(ticket));
   await connection.beginTransaction();await provePrincipalAccess(connection,ticket,true);requireIntentSource(ticket,intent);
   const data=await readBotBindingData(connection,ticket);
   let receipt:RowDataPacket|undefined;
   if(id){
    const [[prior]]=await connection.execute<RowDataPacket[]>(RECEIPT_SELECT+' FOR UPDATE',[id]);
    if(prior){if(!matches(prior,ticket,intent))throw principalFailure(409,'请求标识已用于其他操作。');receipt=prior;}
   }
   const effect=receipt?receiptEffect(receipt,intent):await applyBotBindingIntent(connection,ticket,intent,data);
   const result=bindingResponse(ticket.principal,action==='read'||receipt?data:await readBotBindingData(connection,ticket),intent,effect);
   await provePrincipalAccess(connection,ticket,true);
   if(id&&!receipt){
    producedHash=hash(result);
    await connection.execute(`INSERT INTO taiko_bot_binding_operations(operation_id,actor_user_id,actor_hash,grant_hash,principal,action,intent_hash,outcome_hash,effect_json,effect_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,[id,ticket.actor.userId,hash(ticket.actor),hash(ticket.grant),ticket.principal,action,hash(intent),producedHash,effect?JSON.stringify(effect):null,effect?effectHash(intent,effect):null]);
   }
   await provePrincipalAccess(connection,ticket,true);
   attempted=true;await connection.commit();return result;
  }catch(error){
   if(connection){
    try{await connection.rollback();}catch{discard=true;connection.destroy();}
    // Release the old principal gate before proving an uncertain COMMIT on a
    // captured-pool connection; never wait for a gate still owned by ourselves.
    await close(connection,gate(ticket),discard);connection=undefined;
   }
   if(attempted&&producedHash&&id)try{return await resolveCommit(ticket,intent,id,producedHash);}catch{/* Unproved COMMIT stays unavailable. */}
   throw safePrincipalError(error);
  }finally{
   if(connection)await close(connection,gate(ticket),discard);
   leavePrivateWorker();
  }
 }catch(error){throw safePrincipalError(error);}
}
