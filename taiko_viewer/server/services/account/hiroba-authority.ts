import {legacyDeveloperGrant, type LegacyDeveloperGrant} from './legacy-developer-access.ts';
import type {H3Event} from 'h3';
import type {Pool,RowDataPacket} from 'mysql2/promise';
import {ensureAccountSchema,getAccountDb} from '../../utils/account-db';
import {getRuntimePaths} from '../../infrastructure/runtime-paths.ts';
import {capturedWorkerEnvironment} from '../../infrastructure/account/private-worker-environment.ts';
import {MANUAL_SOURCE_ID} from '../../internal/account/source-lifecycle.ts';
import {validateSourceServicePolicy} from '../../infrastructure/account/source-service-schema.ts';
import {validateServicePrincipals} from '../../infrastructure/account/principal-policy.ts';
import {captureActor,readActor,type SourceActor} from './source-access.ts';
import {capturePrincipalForActor,provePrincipalAccess,principalFailure,safePrincipalError,type PrincipalTicket} from './principal-access.ts';
type Db=Pick<Pool,'execute'>;
type Binding=Readonly<{id:string;taiko_id:string;source:string;manual_account_id:null}>;
type Grant=LegacyDeveloperGrant|Readonly<{kind:'owner';bindings:readonly Binding[]}|{kind:'service';tuple:readonly unknown[];sources:'*'|readonly string[]}>;
export type HirobaTicket=Readonly<{db:Pool;paths:ReturnType<typeof getRuntimePaths>;workerEnv:NodeJS.ProcessEnv;actor:SourceActor;grant:Grant;principal:PrincipalTicket|null;scope:'hiroba_bind'|'hiroba_credential_status';target:string}>;
export const validHirobaSource=(value:unknown):value is string=>typeof value==='string'&&/^[0-9]{1,25}$/.test(value)&&!MANUAL_SOURCE_ID.test(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const denied=()=>principalFailure(403,'没有访问该账号凭据的权限。');
async function grantFor(db:Db,actor:SourceActor,scope:HirobaTicket['scope'],target:string,locked=false,chosen?:Grant):Promise<Grant>{
 const suffix=locked?' FOR UPDATE':'';
 if(!chosen || chosen.kind==='developer'){
  const developer=await legacyDeveloperGrant(db,actor,locked);
  if(developer)return developer;
  if(chosen?.kind==='developer')throw denied();
 }
 if(actor.kind==='developer'&&chosen?.kind!=='owner'){
  const [[row]]=await db.execute<RowDataPacket[]>(`SELECT CAST(id AS CHAR) AS id,developer_user_id,service_name,scopes_json,sources_json,revision_nonce,status,
   DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s') AS expires_at,issued_by_user_id,principals_json FROM taiko_source_service_grants
   WHERE developer_token_id=? AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`+suffix,[actor.tokenId]);
  if(row){
   if(row.developer_user_id!==actor.userId||!/^[A-Za-z0-9_-]{1,64}$/.test(row.service_name)||!/^[a-f0-9]{32}$/.test(row.revision_nonce))throw new Error('Invalid Hiroba grant');
   const policy=validateSourceServicePolicy(JSON.parse(row.scopes_json),JSON.parse(row.sources_json));
   const principals=row.principals_json===null?null:validateServicePrincipals(JSON.parse(row.principals_json));
   if(policy.scopes.includes(scope)&&(scope!=='hiroba_bind'||principals!==null)&&(!target||policy.sources==='*'||policy.sources.includes(target)))
    return Object.freeze({kind:'service',sources:policy.sources,tuple:Object.freeze([row.id,row.developer_user_id,row.service_name,row.scopes_json,row.sources_json,row.revision_nonce,row.status,row.expires_at,row.issued_by_user_id,row.principals_json])});
  }
  if(chosen?.kind==='service')throw denied();
 }
 const [rows]=await db.execute<(RowDataPacket&Binding)[]>(`SELECT CAST(id AS CHAR) AS id,taiko_id,source,manual_account_id FROM web_taiko_bindings
  WHERE user_id=? ${target?'AND CAST(taiko_id AS BINARY)=CAST(? AS BINARY)':"AND source='hiroba'"} ORDER BY id LIMIT 129`+suffix,target?[actor.userId,target]:[actor.userId]);
 if(!rows.length||rows.length>128||(target&&rows.length!==1))throw denied();
 if(rows.some(row=>!validHirobaSource(row.taiko_id)||row.manual_account_id!==null||!['wahlap','hiroba'].includes(row.source)||(scope==='hiroba_bind'&&row.source!=='hiroba'))||new Set(rows.map(row=>row.taiko_id)).size!==rows.length)throw denied();
 return Object.freeze({kind:'owner',bindings:Object.freeze(rows.map(row=>Object.freeze({id:row.id,taiko_id:row.taiko_id,source:row.source,manual_account_id:null})))});
}
export async function captureHirobaAccess(event:H3Event,scope:HirobaTicket['scope'],target:string,principal:string):Promise<HirobaTicket>{
 try{
  if(target&&!validHirobaSource(target))throw principalFailure(400,'账号标识无效。');
  await ensureAccountSchema("source");const db=getAccountDb(),paths=Object.freeze(getRuntimePaths()),workerEnv=Object.freeze(capturedWorkerEnvironment(db,paths));
  const actor=await captureActor(event,db),grant=await grantFor(db,actor,scope,target);
  const qq=principal?await capturePrincipalForActor(db,actor,principal,'hiroba_bind'):null;
  return Object.freeze({db,paths,workerEnv,actor,grant,principal:qq,scope,target});
 }catch(error){throw safePrincipalError(error);}
}
export async function proveHirobaAccess(db:Db,ticket:HirobaTicket,locked=false){
 if(locked)await db.execute('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE',[ticket.actor.userId]);
 if(!same(ticket.actor,await readActor(db,ticket.actor.kind,ticket.actor.credential,locked)))throw principalFailure(401,'访问凭据已失效。');
 if(!same(ticket.grant,await grantFor(db,ticket.actor,ticket.scope,ticket.target,locked,ticket.grant)))throw denied();
 if(ticket.principal)await provePrincipalAccess(db,ticket.principal,locked);
}
export function requireHirobaSources(ticket:HirobaTicket,ids:readonly string[]){
 const allowed=ticket.grant.kind==='developer'?'*':ticket.grant.kind==='service'?ticket.grant.sources:ticket.grant.bindings.map(row=>row.taiko_id);
 if(allowed!=='*'&&ids.some(id=>!allowed.includes(id)))throw denied();
}
/** Owner receipts cover selected complete bindings; unrelated later additions
 * do not invalidate a completed operation. Service receipts cover the full policy. */
export function hirobaReceiptGrant(ticket:HirobaTicket,ids:readonly string[]){
 return {source:ticket.grant.kind!=='owner'?ticket.grant:{kind:'owner',bindings:ticket.grant.bindings.filter(row=>ids.includes(row.taiko_id))},principal:ticket.principal?.grant||null};
}
