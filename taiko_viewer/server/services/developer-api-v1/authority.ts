import {isIP} from 'node:net';
import {developerClientAdmitted} from './admission';
import {getCookie,getHeader,getRequestIP,getRequestURL,type H3Event} from 'h3';
import type {Pool,RowDataPacket} from 'mysql2/promise';
import {getAccountDb,ensureAccountSchema} from '../../utils/account-db';
import {consumeOpenQuota} from '../../infrastructure/account/open-quota';
import {ApiFailure,AUDIENCE,CONSENT_VERSION,OPEN_SCOPES,hash,deny} from './common';
export type ClientProof={clientId:string;tokenId:string;credentialHash:string};
export async function clientFromHash(db:Pick<Pool,'execute'>,credentialHash:string):Promise<ClientProof>{
 const [rows]=await db.execute<RowDataPacket[]>(`SELECT c.client_id,CAST(t.id AS CHAR) token_id
 FROM web_developer_tokens t JOIN web_developer_api_clients c ON c.application_id=t.application_id AND c.owner_user_id=t.user_id
 JOIN web_developer_applications app ON app.id=c.application_id AND app.user_id=c.owner_user_id
 JOIN web_user_accounts a ON a.id=c.owner_user_id
 WHERE t.token_hash=? AND t.status='active' AND t.revoked_at IS NULL AND c.status='active' AND app.status='approved' AND a.email_verified=1 LIMIT 1`,[credentialHash]);
 if(!rows[0]||!await developerClientAdmitted(String(rows[0].client_id)))throw new ApiFailure(401,'UNAUTHENTICATED');
 return {clientId:String(rows[0].client_id),tokenId:String(rows[0].token_id),credentialHash};
}
export async function apiClient(event:H3Event,db:Pool){
 const value=getHeader(event,'authorization');const match=typeof value==='string'?/^Bearer ([A-Za-z0-9_-]{16,256})$/i.exec(value):null;
 const credential=match?.[1];if(!credential)throw new ApiFailure(401,'UNAUTHENTICATED');return clientFromHash(db,hash(credential));
}
/** Session-only authority never interprets a Developer Key as an owner. */
export async function sessionOwner(event:H3Event,db:Pick<Pool,'execute'>,mutation=false,locked=false){
 if(getHeader(event,'authorization')!==undefined)throw new ApiFailure(401,'SESSION_REQUIRED');
 if(mutation){
  const origin=getHeader(event,'origin');const site=getHeader(event,'sec-fetch-site');
  if(!origin||origin!==getRequestURL(event).origin||(site&&site!=='same-origin'&&site!=='none'))throw new ApiFailure(403,'ORIGIN_REQUIRED');
 }
 const cookie=getCookie(event,'stv_session');if(!cookie||!/^[a-f0-9]{64}$/.test(cookie))throw new ApiFailure(401,'SESSION_REQUIRED');
 const [rows]=await db.execute<RowDataPacket[]>(`SELECT a.id,a.username FROM web_user_sessions s JOIN web_user_accounts a ON a.id=s.user_id
 WHERE s.session_token=? AND s.expires_at>NOW() AND a.email_verified=1 LIMIT 1`+(locked?' FOR UPDATE':''),[cookie]);
 if(!rows[0])throw new ApiFailure(401,'SESSION_REQUIRED');return String(rows[0].id);
}
export async function apiDb(){await ensureAccountSchema();return getAccountDb();}
export async function quota(event:H3Event,db:Pool,client?:ClientProof){
 const config=useRuntimeConfig();const specified=Number(client?config.developerApiClientDailyLimit:config.developerApiAnonymousDailyLimit);
 const limit=Number.isSafeInteger(specified)&&specified>0&&specified<=100000?specified:client?5000:300;
 // Trust X-Real-IP only from explicitly configured ingress sockets. Nginx
 // overwrites it with remote_addr; arbitrary X-Forwarded-For is never authority.
 const direct=getRequestIP(event)||'unknown';
 const trusted=String(config.developerApiTrustedProxyAddresses||'').split(',').map(x=>x.trim());
 const forwarded=getHeader(event,'x-real-ip');
 const ip=trusted.includes(direct)&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:direct;
 const subject=client?'v1:client:'+client.clientId:'v1:ip:'+hash(ip).slice(0,56);
 const [[clock]]=await db.query<RowDataPacket[]>('SELECT DATE_FORMAT(UTC_DATE(),"%Y-%m-%d") AS day');
 if(!clock||typeof clock.day!=='string')throw new ApiFailure(503,'UNAVAILABLE');
 if(!await consumeOpenQuota(db,subject,'developer-api-v1',String(clock.day),limit))throw new ApiFailure(429,'RATE_LIMITED');
}
export async function publicIdentity(event:H3Event,db:Pool){
 const client=getHeader(event,'authorization')===undefined?undefined:await apiClient(event,db);await quota(event,db,client);
}
export type GrantProof={grantId:string;revision:string;ownerId:string;bindingId:string;playerId:string;taikoId:string;source:string;manualId:string|null;scopes:string[];expiresAt:string};
export async function proveGrant(db:Pick<Pool,'execute'>,client:ClientProof,playerId:string,scope:string):Promise<GrantProof>{
 if(!/^plr_[a-f0-9]{32}$/.test(playerId)||!await developerClientAdmitted(client.clientId))throw deny();
 const [rows]=await db.execute<RowDataPacket[]>(`SELECT g.*,CAST(g.owner_user_id AS CHAR) owner_id,CAST(g.binding_id AS CHAR) binding_key,
 DATE_FORMAT(g.expires_at,'%Y-%m-%dT%H:%i:%s.%fZ') expiry
 FROM web_developer_resource_grants g JOIN web_taiko_bindings b ON b.id=g.binding_id AND b.user_id=g.owner_user_id
 JOIN web_user_accounts owner ON owner.id=g.owner_user_id
 JOIN web_developer_api_resources r ON r.player_id=g.player_id AND r.binding_id=g.binding_id
 JOIN web_developer_api_clients c ON c.client_id=g.client_id
 JOIN web_developer_tokens t ON t.application_id=c.application_id AND t.user_id=c.owner_user_id
 JOIN web_developer_applications app ON app.id=c.application_id AND app.user_id=c.owner_user_id
 JOIN web_user_accounts developer ON developer.id=c.owner_user_id
 WHERE t.token_hash=? AND t.id=? AND t.status='active' AND t.revoked_at IS NULL
 AND c.status='active' AND app.status='approved' AND developer.email_verified=1 AND g.client_id=? AND g.player_id=? AND CAST(g.audience AS BINARY)=CAST(? AS BINARY) AND g.revoked_at IS NULL
 AND g.issued_at<=UTC_TIMESTAMP(3) AND g.consented_at<=g.issued_at AND g.expires_at>UTC_TIMESTAMP(3)
 AND owner.email_verified=1 AND CAST(b.taiko_id AS BINARY)=CAST(g.taiko_id AS BINARY)
 AND CAST(b.source AS BINARY)=CAST(g.source AS BINARY) AND CAST(b.manual_account_id AS BINARY)<=>CAST(g.manual_account_id AS BINARY)
 AND CAST(g.consent_version AS BINARY)=CAST(? AS BINARY) AND ((b.source IN ('wahlap','hiroba') AND b.verified_title IS NOT NULL AND b.manual_account_id IS NULL)
 OR (b.source='manual' AND CAST(b.manual_account_id AS BINARY)=CAST(b.taiko_id AS BINARY) AND EXISTS(SELECT 1 FROM taiko_manual_accounts m WHERE CAST(m.taiko_id AS BINARY)=CAST(b.taiko_id AS BINARY)))) LIMIT 1`,[client.credentialHash,client.tokenId,client.clientId,playerId,AUDIENCE,CONSENT_VERSION]);
 const row=rows[0];if(!row)throw deny();
 let scopes:unknown;try{scopes=JSON.parse(row.scopes_json);}catch{throw deny();}
 if(!Array.isArray(scopes)||scopes.length===0||scopes.some(s=>!OPEN_SCOPES.includes(s))||!scopes.includes(scope))throw deny();
 const taikoId=String(row.taiko_id);if(!/^(?:[0-9]{1,25}|manual_[A-Za-z0-9_-]{1,18})$/.test(taikoId)){
  // Existing manual identifiers use the domain's own validated namespace.
  if(row.source!=='manual'||!/^[A-Za-z0-9_-]{1,25}$/.test(taikoId))throw deny();
 }
 return {grantId:row.grant_id,revision:row.revision,ownerId:row.owner_id,bindingId:row.binding_key,playerId,taikoId,source:row.source,manualId:row.manual_account_id,scopes:scopes as string[],expiresAt:row.expiry};
}
