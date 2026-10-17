import {createError,type H3Event} from 'h3';
import type {Pool,RowDataPacket} from 'mysql2/promise';
import {ensureAccountSchema,getAccountDb} from '../../utils/account-db';
import {captureActor,readActor,safeSourceError,type SourceActor} from './source-access.ts';
import {validBotPrincipal,validateServicePrincipals} from '../../infrastructure/account/principal-policy.ts';
import {validateSourceServicePolicy} from '../../infrastructure/account/source-service-schema.ts';
type Db=Pick<Pool,'execute'>;
export type PrincipalScope='bind_read'|'bind_write'|'bind_current'|'bind_remove'|'bind_visibility'|'hiroba_bind'|'score_token_issue'|'bind_migrate';
type Target=Readonly<{id:string;taiko_id:string;source:string;manual_account_id:null}>;
type Grant=Readonly<{kind:'owner';tuple:readonly unknown[];target:Target|null}|{kind:'service';tuple:readonly unknown[];sources:'*'|readonly string[]}>;
export type PrincipalTicket=Readonly<{db:Pool;actor:SourceActor;principal:string;scope:PrincipalScope;grant:Grant;targetSource:string|null;targetPlatform:string|null}>;
const publicErrors=new WeakSet<Error>();
export const principalFailure=(status:number,message:string)=>{const e=createError({statusCode:status,statusMessage:message});publicErrors.add(e);return e;};
export const safePrincipalError=(error:unknown)=>error instanceof Error&&publicErrors.has(error)?error:safeSourceError(error);
const deny=()=>principalFailure(403,'没有访问该绑定的权限。');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
async function grantFor(db:Db,actor:SourceActor,principal:string,scope:PrincipalScope,targetSource:string|null,targetPlatform:string|null,locked=false,chosen?:Grant):Promise<Grant>{
 const suffix=locked?' FOR UPDATE':'';
 if(actor.kind==='developer'&&chosen?.kind!=='owner'){
  const [rows]=await db.execute<RowDataPacket[]>(`SELECT CAST(id AS CHAR) AS id,developer_user_id,service_name,scopes_json,sources_json,
   revision_nonce,status,DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s') AS expires_at,issued_by_user_id,principals_json
   FROM taiko_source_service_grants WHERE developer_token_id=? AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`+suffix,[actor.tokenId]);
  const row=rows[0];
  if(row){
   if(Number(row.developer_user_id)!==actor.userId||!/^[A-Za-z0-9_-]{1,64}$/.test(row.service_name)||!/^[a-f0-9]{32}$/.test(row.revision_nonce))throw new Error('Invalid service grant');
   const policy=validateSourceServicePolicy(JSON.parse(row.scopes_json),JSON.parse(row.sources_json));
   const principals=row.principals_json===null?null:validateServicePrincipals(JSON.parse(row.principals_json));
   if(policy.scopes.includes(scope)&&principals&&(principals==='*'||principals.includes(principal))&&(!targetSource||policy.sources==='*'||policy.sources.includes(targetSource)))
    return Object.freeze({kind:'service',sources:policy.sources,tuple:Object.freeze([row.id,row.developer_user_id,row.service_name,row.scopes_json,row.sources_json,row.revision_nonce,row.status,row.expires_at,row.issued_by_user_id,row.principals_json])});
  }
  if(chosen?.kind==='service')throw deny();
 }
 const qq=/^(?:onebot_v11:)?([1-9][0-9]{4,14})$/.exec(principal)?.[1];if(!qq)throw deny();
 const [rows]=await db.execute<RowDataPacket[]>(`SELECT CAST(id AS CHAR) AS id,user_id,qq_number,status,DATE_FORMAT(verified_at,'%Y-%m-%dT%H:%i:%s') AS verified_at
  FROM web_user_qq_bindings WHERE user_id=? AND qq_number=? AND status='active' LIMIT 1`+suffix,[actor.userId,qq]);
 const row=rows[0];if(!row||row.user_id!==actor.userId||row.qq_number!==qq||!row.verified_at)throw deny();
 let target:Target|null=null;
 if(targetSource){
  const [bindings]=await db.execute<(RowDataPacket&Target)[]>(`SELECT CAST(id AS CHAR) AS id,taiko_id,source,manual_account_id FROM web_taiko_bindings
    WHERE user_id=? AND CAST(taiko_id AS BINARY)=CAST(? AS BINARY) ORDER BY id LIMIT 2`+suffix,[actor.userId,targetSource]);
  const binding=bindings[0];if(bindings.length!==1||binding.source!==targetPlatform||binding.manual_account_id!==null)throw deny();
  target=Object.freeze({id:binding.id,taiko_id:binding.taiko_id,source:binding.source,manual_account_id:null});
 }
 return Object.freeze({kind:'owner',tuple:Object.freeze([row.id,row.user_id,row.qq_number,row.status,row.verified_at]),target});
}
export async function capturePrincipalAccess(event:H3Event,input:unknown,scope:PrincipalScope,targetSource:string|null=null,targetPlatform:string|null=null):Promise<PrincipalTicket>{
 try{
  const principal=typeof input==='string'?input.trim():'';if(!validBotPrincipal(principal))throw principalFailure(400,'身份标识无效。');
  await ensureAccountSchema("source");const db=getAccountDb(),actor=await captureActor(event,db);
  return await capturePrincipalForActor(db,actor,principal,scope,targetSource,targetPlatform);
 }catch(error){throw safePrincipalError(error);}
}
export async function capturePrincipalForActor(db:Pool,actor:SourceActor,input:unknown,scope:PrincipalScope,targetSource:string|null=null,targetPlatform:string|null=null):Promise<PrincipalTicket>{
 const principal=typeof input==='string'?input.trim():'';if(!validBotPrincipal(principal))throw principalFailure(400,'身份标识无效。');
 const grant=await grantFor(db,actor,principal,scope,targetSource,targetPlatform);
 return Object.freeze({db,actor,principal,scope,grant,targetSource,targetPlatform});
}
export async function provePrincipalAccess(db:Db,ticket:PrincipalTicket,locked=false){
 const {actor,principal,scope,grant,targetSource,targetPlatform}=ticket;
 if(locked)await db.execute('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE',[actor.userId]);
 if(!same(actor,await readActor(db,actor.kind,actor.credential,locked)))throw principalFailure(401,'访问凭据已失效。');
 if(!same(grant,await grantFor(db,actor,principal,scope,targetSource,targetPlatform,locked,grant)))throw deny();
}
export function requirePrincipalSources(ticket:PrincipalTicket,sources:readonly string[]){
 const allowed=ticket.grant.kind==='service'?ticket.grant.sources:null;
 if(allowed&&allowed!=='*'&&sources.some(source=>!allowed.includes(source)))throw deny();
}
