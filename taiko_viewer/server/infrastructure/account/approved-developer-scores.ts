import {randomBytes} from 'node:crypto';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {validateSourceServicePolicy} from './source-service-schema.ts';

/** Caller owns the approval transaction. Never widen unrelated service scopes,
 * source lists, credential principals or expiry; never revive a revoked grant. */
export async function grantApprovedDeveloperScores(db:PoolConnection,tokenId:number|string,operatorId:number|string){
 const [[token]]=await db.execute<RowDataPacket[]>(`SELECT t.id,t.user_id FROM web_developer_tokens t
  JOIN web_developer_applications app ON app.id=t.application_id AND app.user_id=t.user_id
  JOIN web_user_accounts a ON a.id=t.user_id
  WHERE t.id=? AND t.status='active' AND t.revoked_at IS NULL AND app.status='approved' AND a.email_verified=1 FOR UPDATE`,[tokenId]);
 if(!token)throw new Error('Approved active developer token required');
 const [[prior]]=await db.execute<RowDataPacket[]>('SELECT * FROM taiko_source_service_grants WHERE developer_token_id=? FOR UPDATE',[tokenId]);
 if(prior?.status==='revoked')return {tokenId:String(tokenId),action:'preserved-revocation'};
 if(prior?.expires_at&&new Date(prior.expires_at).getTime()<=Date.now())return {tokenId:String(tokenId),action:'preserved-expiry'};
 let scopes:readonly string[]=['source_read'],sources:readonly string[]|'*'='*';
 if(prior){
  const policy=validateSourceServicePolicy(JSON.parse(prior.scopes_json),JSON.parse(prior.sources_json));
  if(policy.scopes.includes('scores_read_any')||(policy.scopes.includes('source_read')&&policy.sources==='*'))return {tokenId:String(tokenId),action:'unchanged'};
  scopes=[...policy.scopes,'scores_read_any'].sort();sources=policy.sources;
 }
 const operation=randomBytes(16).toString('hex'),scopesJson=JSON.stringify(scopes),sourcesJson=JSON.stringify(sources),service=prior?.service_name||'approved-developer-scores';
 if(prior)await db.execute('UPDATE taiko_source_service_grants SET scopes_json=?,revision_nonce=? WHERE id=?',[scopesJson,operation,prior.id]);
 else await db.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,issued_by_user_id)
  VALUES(?,?,?,?,?,?,'active',?)`,[tokenId,token.user_id,service,scopesJson,sourcesJson,operation,operatorId]);
 await db.execute(`INSERT INTO taiko_source_service_grant_audit(operation_id,developer_token_id,operator_user_id,service_name,status,scopes_json,sources_json,principals_json,expires_at)
  VALUES(?,?,?,?,'active',?,?,?,?)`,[operation,tokenId,operatorId,service,scopesJson,sourcesJson,prior?.principals_json??null,prior?.expires_at??null]);
 return {tokenId:String(tokenId),action:prior?'added-read-only-capability':'granted-source-read',operationId:operation};
}
