import {randomUUID} from 'node:crypto';
import {readBody,getRouterParam,type H3Event} from 'h3';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import type {ResourceGrant} from '@sakura-taiko/contract';
import {apiDb,sessionOwner} from './authority';
import {ApiFailure,exactKeys,AUDIENCE,CONSENT_VERSION,OPEN_SCOPES,deny} from './common';
const id=(prefix='')=>prefix+randomUUID().replaceAll('-','');
const bindingKey=(value:unknown)=>{if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value)||value==='0')throw new ApiFailure(400,'INVALID_REQUEST');return value;};
const GRANT_FIELDS=`g.*,CAST(g.owner_user_id AS CHAR) owner_id,CAST(g.binding_id AS CHAR) binding_key,
 DATE_FORMAT(g.consented_at,'%Y-%m-%dT%H:%i:%s.%fZ') consent_time,DATE_FORMAT(g.issued_at,'%Y-%m-%dT%H:%i:%s.%fZ') issue_time,
 DATE_FORMAT(g.expires_at,'%Y-%m-%dT%H:%i:%s.%fZ') expiry,DATE_FORMAT(g.revoked_at,'%Y-%m-%dT%H:%i:%s.%fZ') revocation`;
const dto=(row:RowDataPacket):ResourceGrant=>({grantId:row.grant_id,ownerUserId:row.owner_id,bindingId:row.binding_key,playerId:row.player_id,clientId:row.client_id,audience:row.audience,scopes:JSON.parse(row.scopes_json),consentVersion:row.consent_version,consentedAt:row.consent_time,issuedAt:row.issue_time,expiresAt:row.expiry,revokedAt:row.revocation,revision:row.revision});
async function transaction<T>(event:H3Event,task:(connection:PoolConnection,ownerId:string)=>Promise<T>){
 const db=await apiDb();await sessionOwner(event,db,true);const connection=await db.getConnection();
 try{
  await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await connection.beginTransaction();
  const owner=await sessionOwner(event,connection,true,true);
  const result=await task(connection,owner);if(owner!==await sessionOwner(event,connection,true,true))throw deny();
  await connection.commit();return result;
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
export async function listGrants(event:H3Event){
 const db=await apiDb();const owner=await sessionOwner(event,db);
 const [clients]=await db.query<RowDataPacket[]>(`SELECT c.client_id clientId,c.display_name displayName,c.status FROM web_developer_api_clients c
 JOIN web_developer_applications a ON a.id=c.application_id AND a.user_id=c.owner_user_id
 JOIN web_user_accounts u ON u.id=c.owner_user_id WHERE c.status='active' AND a.status='approved' AND u.email_verified=1 ORDER BY c.client_id LIMIT 100`);
 const [bindings]=await db.execute<RowDataPacket[]>(`SELECT CAST(b.id AS CHAR) bindingId,b.source,b.verified_title displayName,r.player_id playerId FROM web_taiko_bindings b
 LEFT JOIN web_developer_api_resources r ON r.binding_id=b.id WHERE b.user_id=?
 AND ((b.source IN ('wahlap','hiroba') AND b.verified_title IS NOT NULL AND b.manual_account_id IS NULL)
 OR (b.source='manual' AND CAST(b.manual_account_id AS BINARY)=CAST(b.taiko_id AS BINARY) AND EXISTS(SELECT 1 FROM taiko_manual_accounts m WHERE CAST(m.taiko_id AS BINARY)=CAST(b.taiko_id AS BINARY)))) ORDER BY b.id LIMIT 100`,[owner]);
 const [rows]=await db.execute<RowDataPacket[]>(`SELECT ${GRANT_FIELDS} FROM web_developer_resource_grants g WHERE owner_user_id=? ORDER BY g.issued_at DESC LIMIT 100`,[owner]);
 if(owner!==await sessionOwner(event,db))throw deny();
 return {consentVersion:CONSENT_VERSION,audience:AUDIENCE,availableScopes:OPEN_SCOPES,clients,bindings,grants:rows.map(dto)};
}
export async function issueGrant(event:H3Event){
 const body=await readBody(event);if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiFailure(400,'INVALID_REQUEST');
 exactKeys(body,['bindingId','clientId','scopes','expiresInDays','consent','consentVersion','audience']);
 const bindingId=bindingKey(body.bindingId),clientId=body.clientId;
 if(typeof clientId!=='string'||!/^clt_[a-f0-9]{32}$/.test(clientId)||body.consent!==true||body.consentVersion!==CONSENT_VERSION||body.audience!==AUDIENCE
 ||!Array.isArray(body.scopes)||!body.scopes.length||body.scopes.length>2||body.scopes.some((s:unknown)=>!OPEN_SCOPES.includes(s as any))||new Set(body.scopes).size!==body.scopes.length
 ||!Number.isInteger(body.expiresInDays)||body.expiresInDays<1||body.expiresInDays>90)throw new ApiFailure(400,'INVALID_REQUEST');
 return transaction(event,async(db,owner)=>{
  const [bindings]=await db.execute<RowDataPacket[]>('SELECT id,taiko_id,source,manual_account_id,verified_title FROM web_taiko_bindings WHERE id=? AND user_id=? FOR UPDATE',[bindingId,owner]);
  const binding=bindings[0];if(!binding)throw deny();
  if(binding.source==='manual'){
   const [manual]=await db.execute<RowDataPacket[]>('SELECT taiko_id FROM taiko_manual_accounts WHERE taiko_id=? AND taiko_id=? FOR UPDATE',[binding.taiko_id,binding.manual_account_id]);if(!manual[0])throw deny();
  }else if(!['wahlap','hiroba'].includes(binding.source)||binding.verified_title===null||binding.manual_account_id!==null)throw deny();
  const [clients]=await db.execute<RowDataPacket[]>(`SELECT c.client_id FROM web_developer_api_clients c JOIN web_developer_applications a ON a.id=c.application_id AND a.user_id=c.owner_user_id
   JOIN web_user_accounts u ON u.id=c.owner_user_id WHERE c.client_id=? AND c.status='active' AND a.status='approved' AND u.email_verified=1 FOR UPDATE`,[clientId]);if(!clients[0])throw deny();
  await db.execute('INSERT INTO web_developer_api_resources(player_id,binding_id) VALUES (?,?) ON DUPLICATE KEY UPDATE binding_id=VALUES(binding_id)',[id('plr_'),bindingId]);
  const [[resource]]=await db.execute<RowDataPacket[]>('SELECT player_id FROM web_developer_api_resources WHERE binding_id=?',[bindingId]);
  const scopes=JSON.stringify([...body.scopes].sort());const grantId=id();
  await db.execute(`INSERT INTO web_developer_resource_grants(grant_id,revision,owner_user_id,binding_id,player_id,client_id,audience,taiko_id,source,manual_account_id,scopes_json,consent_version,consented_at,issued_at,expires_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? DAY)) ON DUPLICATE KEY UPDATE grant_id=VALUES(grant_id),revision=VALUES(revision),player_id=VALUES(player_id),audience=VALUES(audience),taiko_id=VALUES(taiko_id),source=VALUES(source),manual_account_id=VALUES(manual_account_id),scopes_json=VALUES(scopes_json),consent_version=VALUES(consent_version),consented_at=VALUES(consented_at),issued_at=VALUES(issued_at),expires_at=VALUES(expires_at),revoked_at=NULL`,[grantId,id(),owner,bindingId,resource.player_id,clientId,AUDIENCE,binding.taiko_id,binding.source,binding.manual_account_id,scopes,CONSENT_VERSION,body.expiresInDays]);
  await db.execute(`INSERT INTO web_developer_resource_grant_events(grant_id,owner_user_id,binding_id,client_id,action,scopes_json,consent_version) VALUES (?,?,?,?,'consent',?,?)`,[grantId,owner,bindingId,clientId,scopes,CONSENT_VERSION]);
  const [[row]]=await db.execute<RowDataPacket[]>(`SELECT ${GRANT_FIELDS} FROM web_developer_resource_grants g WHERE grant_id=?`,[grantId]);return {grant:dto(row)};
 });
}
export async function revokeGrant(event:H3Event){
 const grantId=getRouterParam(event,'grantId')||'';if(!/^[a-f0-9]{32}$/.test(grantId))throw deny();
 return transaction(event,async(db,owner)=>{
  const [[row]]=await db.execute<RowDataPacket[]>(`SELECT ${GRANT_FIELDS} FROM web_developer_resource_grants g WHERE grant_id=? AND owner_user_id=? FOR UPDATE`,[grantId,owner]);if(!row)throw deny();
  if(!row.revoked_at){
   await db.execute('UPDATE web_developer_resource_grants SET revoked_at=UTC_TIMESTAMP(3),revision=? WHERE grant_id=?',[id(),grantId]);
   await db.execute(`INSERT INTO web_developer_resource_grant_events(grant_id,owner_user_id,binding_id,client_id,action,scopes_json,consent_version) VALUES (?,?,?,?,'revoke',?,?)`,[grantId,owner,row.binding_id,row.client_id,row.scopes_json,CONSENT_VERSION]);
  }
  return {ok:true};
 });
}
export async function registerClient(event:H3Event){
 const body=await readBody(event);if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiFailure(400,'INVALID_REQUEST');exactKeys(body,['displayName']);
 const name=body.displayName;if(typeof name!=='string'||!name.trim()||name.length>80)throw new ApiFailure(400,'INVALID_REQUEST');
 return transaction(event,async(db,owner)=>{
  const [[app]]=await db.execute<RowDataPacket[]>('SELECT CAST(id AS CHAR) id FROM web_developer_applications WHERE user_id=? AND status=\'approved\' ORDER BY id DESC LIMIT 1 FOR UPDATE',[owner]);if(!app)throw deny();
  await db.execute(`INSERT INTO web_developer_api_clients(client_id,application_id,owner_user_id,display_name) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE application_id=VALUES(application_id)`,[id('clt_'),app.id,owner,name.trim()]);
  const [[row]]=await db.execute<RowDataPacket[]>('SELECT client_id clientId,display_name displayName,status FROM web_developer_api_clients WHERE application_id=?',[app.id]);return {client:row};
 });
}
export async function listOwnClients(event:H3Event){const db=await apiDb(),owner=await sessionOwner(event,db);const [clients]=await db.execute<RowDataPacket[]>('SELECT client_id clientId,display_name displayName,status FROM web_developer_api_clients WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 100',[owner]);return {clients};}
export async function disableClient(event:H3Event){const clientId=getRouterParam(event,'clientId')||'';return transaction(event,async(db,owner)=>{const [result]=await db.execute<any>('UPDATE web_developer_api_clients SET status=\'disabled\' WHERE client_id=? AND owner_user_id=?',[clientId,owner]);if(!result.affectedRows)throw deny();return {ok:true};});}
