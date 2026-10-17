import {randomUUID} from 'node:crypto';
import type {H3Event} from 'h3';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {enterPrivateWorker,leavePrivateWorker} from '../../infrastructure/account/private-worker-admission.ts';
import {runHirobaCredentialWorker} from '../../infrastructure/account/hiroba-credential-worker.ts';
import {metadataHash,credentialRows,saveHirobaBinding,hirobaBindingResult} from '../../infrastructure/account/hiroba-binding-rows.ts';
import {captureHirobaAccess,proveHirobaAccess,requireHirobaSources,hirobaReceiptGrant,validHirobaSource,type HirobaTicket} from './hiroba-authority.ts';
import {principalFailure,safePrincipalError} from './principal-access.ts';
import {PublicationUnavailableError} from '../../infrastructure/taiko-publication/client.ts';
const idFor=(value:unknown)=>{if(value===undefined||value===null||value==='')return randomUUID().replaceAll('-','');
 if(typeof value!=='string'||!(/^[a-f0-9]{32}$/.test(value)||/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)))throw principalFailure(400,'请求标识无效。');return value.replaceAll('-','');};
const unavailable=()=>principalFailure(503,'Hiroba 凭据服务暂不可用，请稍后重试。');
const safe=(error:unknown)=>{const result=safePrincipalError(error);return result instanceof PublicationUnavailableError?unavailable():result;};
const RECEIPT='SELECT actor_user_id,actor_hash,grant_hash,intent_hash,source_ids_json,credential_hash,outcome_hash FROM taiko_hiroba_binding_operations WHERE operation_id=?';
const principalGate=(ticket:HirobaTicket)=>ticket.principal?'taiko-bind-'+metadataHash(ticket.principal.principal).slice(0,52):null;
async function acquire(db:PoolConnection,name:string){const [[row]]=await db.execute<RowDataPacket[]>('SELECT GET_LOCK(?,5) AS acquired',[name]);if(row?.acquired!==1)throw unavailable();}
async function close(db:PoolConnection,names:string[],discard=false){
 if(discard)return;
 try{for(const name of [...names].reverse()){const [[row]]=await db.execute<RowDataPacket[]>('SELECT RELEASE_LOCK(?) AS released',[name]);if(row?.released!==1)throw unavailable();}db.release();}catch{db.destroy();}
}
function receiptIds(row:RowDataPacket){
 if(typeof row.source_ids_json!=='string'||Buffer.byteLength(row.source_ids_json)>4096)throw unavailable();
 const ids=JSON.parse(row.source_ids_json);if(!Array.isArray(ids)||ids.length>128||new Set(ids).size!==ids.length||ids.some(id=>!validHirobaSource(id)))throw unavailable();return ids as string[];
}
function assertReceipt(row:RowDataPacket,ticket:HirobaTicket,intent:string,ids:readonly string[]){
 if(row.actor_user_id!==ticket.actor.userId||row.actor_hash!==metadataHash(ticket.actor)||row.grant_hash!==metadataHash(hirobaReceiptGrant(ticket,ids))||row.intent_hash!==intent)throw principalFailure(409,'请求标识已用于其他操作。');
}
async function resolveCommit(ticket:HirobaTicket,operationId:string,intentHash:string,expected:{credentials:string;outcome:string}){
 const db=await ticket.db.getConnection(),names:string[]=[];let discard=false;
 try{
  const gate=principalGate(ticket);if(gate){await acquire(db,gate);names.push(gate);}
  await db.beginTransaction();await proveHirobaAccess(db,ticket,true);
  const [[receipt]]=await db.execute<RowDataPacket[]>(RECEIPT+' FOR UPDATE',[operationId]);if(!receipt)throw unavailable();
  const ids=receiptIds(receipt);assertReceipt(receipt,ticket,intentHash,ids);requireHirobaSources(ticket,ids);
  const result=await hirobaBindingResult(db,ticket,ids),credentials=metadataHash(await credentialRows(db,ids));
  if(receipt.credential_hash!==expected.credentials||receipt.outcome_hash!==expected.outcome||credentials!==expected.credentials||metadataHash(result)!==expected.outcome)throw unavailable();
  await proveHirobaAccess(db,ticket,true);await db.commit();return result;
 }catch{try{await db.rollback();}catch{discard=true;db.destroy();}throw unavailable();}
 finally{await close(db,names,discard);}
}
export async function readHirobaCredentialStatus(event:H3Event,input:unknown){
 try{
  const target=typeof input==='string'?input.trim():'';if(!validHirobaSource(target))throw principalFailure(400,'账号标识无效。');
  const ticket=await captureHirobaAccess(event,'hiroba_credential_status',target,'');await enterPrivateWorker();
  let db:PoolConnection|undefined,discard=false;
  try{
   db=await ticket.db.getConnection();await db.beginTransaction();await proveHirobaAccess(db,ticket,true);
   const rows=await credentialRows(db,[target]);let exists=false;
   if(rows.length){await runHirobaCredentialWorker({operationId:idFor(undefined),mode:'decode',passwordEnc:rows[0].password_enc},ticket);exists=true;}
   await proveHirobaAccess(db,ticket,true);await db.commit();return {ok:true,taikoId:target,hasCredentials:exists};
  }catch(error){if(db)try{await db.rollback();}catch{discard=true;db.destroy();}throw safe(error);}
  finally{if(db&&!discard)db.release();leavePrivateWorker();}
 }catch(error){throw safe(error);}
}
/** SQL-only credentials + optional QQ metadata, one COMMIT. Native discovery
 * holds no SQL transaction, writes no files and receives secrets only via stdin. */
export async function bindHirobaCredentials(event:H3Event,input:unknown){
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))throw principalFailure(400,'Hiroba 请求无效。');const body=input as Record<string,unknown>;
  const text=(key:string)=>{const value=body[key];if(value===undefined)return '';if(typeof value!=='string')throw principalFailure(400,'Hiroba 请求无效。');return value.trim();};
  const email=text('email'),password=text('password'),target=text('targetTaikoNo'),principal=text('configuredByQq'),operationId=idFor(body.requestId);
  if(!email||!password||Buffer.byteLength(email)>255||Buffer.byteLength(password)>4096||(target&&!validHirobaSource(target)))throw principalFailure(400,'Hiroba 邮箱、密码或账号标识无效。');
  const ticket=await captureHirobaAccess(event,'hiroba_bind',target,principal);await enterPrivateWorker();
  let db:PoolConnection|undefined,discard=false,attempted=false,intentHash='',expected:{credentials:string;outcome:string}|undefined;const names:string[]=[];
  try{
   db=await ticket.db.getConnection();const operationGate='taiko-hi-'+operationId;await acquire(db,operationGate);names.push(operationGate);
   await proveHirobaAccess(db,ticket);
   const request={operationId,email,password,target,principal};
   intentHash=(await runHirobaCredentialWorker({...request,mode:'fingerprint'},ticket)).intentHash!;
   const [[prior]]=await db.execute<RowDataPacket[]>(RECEIPT,[operationId]);
   let ids:string[],cipher:string|undefined;
   if(prior){ids=receiptIds(prior);requireHirobaSources(ticket,ids);assertReceipt(prior,ticket,intentHash,ids);}
   else{
    await proveHirobaAccess(db,ticket);const discovery=await runHirobaCredentialWorker({...request,mode:'discover'},ticket);
    if(discovery.intentHash!==intentHash)throw unavailable();ids=discovery.taikoIds!;cipher=discovery.passwordEnc!;requireHirobaSources(ticket,ids);
   }
   const gate=principalGate(ticket);if(gate&&ids.length){await acquire(db,gate);names.push(gate);}
   await db.beginTransaction();await proveHirobaAccess(db,ticket,true);requireHirobaSources(ticket,ids);
   const [[receipt]]=await db.execute<RowDataPacket[]>(RECEIPT+' FOR UPDATE',[operationId]);
   if(receipt){const stored=receiptIds(receipt);assertReceipt(receipt,ticket,intentHash,stored);if(JSON.stringify(ids)!==JSON.stringify(stored))throw unavailable();}
   else{if(!cipher)throw unavailable();await saveHirobaBinding(db,ticket,ids,email,cipher);}
   const result=await hirobaBindingResult(db,ticket,ids);await proveHirobaAccess(db,ticket,true);
   if(!receipt){
    expected={credentials:metadataHash(await credentialRows(db,ids)),outcome:metadataHash(result)};
    await db.execute(`INSERT INTO taiko_hiroba_binding_operations(operation_id,actor_user_id,actor_hash,grant_hash,intent_hash,source_ids_json,credential_hash,outcome_hash)
     VALUES (?,?,?,?,?,?,?,?)`,[operationId,ticket.actor.userId,metadataHash(ticket.actor),metadataHash(hirobaReceiptGrant(ticket,ids)),intentHash,JSON.stringify(ids),expected.credentials,expected.outcome]);
   }
   await proveHirobaAccess(db,ticket,true);
   attempted=true;await db.commit();return result;
  }catch(error){
   if(db){try{await db.rollback();}catch{discard=true;db.destroy();}await close(db,names,discard);db=undefined;}
   if(attempted&&expected)try{return await resolveCommit(ticket,operationId,intentHash,expected);}catch{/* No uncertain success without both exact SQL outcomes. */}
   throw safe(error);
  }finally{if(db)await close(db,names,discard);leavePrivateWorker();}
 }catch(error){throw safe(error);}
}
