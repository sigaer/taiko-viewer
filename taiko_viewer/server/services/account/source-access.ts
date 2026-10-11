import {createHash} from 'node:crypto';
import {createError, getCookie, getHeader, type H3Event} from 'h3';
import type {Pool, RowDataPacket} from 'mysql2/promise';
import {ensureAccountSchema, getAccountDb} from '../../utils/account-db';
import {SESSION_COOKIE_NAME} from '../../internal/account/shared';
import {captureBindingIdentity, type BindingIdentity} from '../../internal/account/binding-identity.ts';
import {MANUAL_SOURCE_ID} from '../../internal/account/source-lifecycle.ts';
import {withScoreRead, currentScoreScope} from '../../infrastructure/taiko-publication/scope.ts';
import {getRuntimePaths} from '../../infrastructure/runtime-paths.ts';
import {PublicationUnavailableError} from '../../infrastructure/taiko-publication/client.ts';
import {validSourceIdentity, validateSourceServicePolicy, type SourceServiceScope} from '../../infrastructure/account/source-service-schema.ts';

export type SourceActor = Readonly<{kind:'session'|'developer'; userId:number; credential:string; tokenId?:string}>;
export type SourceGrant = Readonly<{kind:'owner'; binding:BindingIdentity}|{kind:'service'; tuple:readonly unknown[]}>;
type Actor = SourceActor;
type Grant = SourceGrant;
export type SourceAccessTicket = Readonly<{db:Pool;paths:ReturnType<typeof getRuntimePaths>;actor:Actor;grant:Grant;source:string;scope:SourceServiceScope}>;
const publicErrors = new WeakSet<Error>();
const failure = (status:number, message:string) => {const e=createError({statusCode:status,statusMessage:message});publicErrors.add(e);return e;};
const denied = () => failure(403,'没有访问该账号成绩的权限');
const unauthorized = () => failure(401,'请登录或使用已授权的访问凭据');
export const safeSourceError = (error:unknown) => error instanceof Error && publicErrors.has(error) ? error : new PublicationUnavailableError();
const safe=safeSourceError;
const same = (a:unknown,b:unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function readActor(db:Pick<Pool,'execute'>,kind:Actor['kind'],credential:string,locked=false):Promise<Actor> {
  const sql=kind==='session' ? `SELECT a.id AS user_id FROM web_user_sessions s JOIN web_user_accounts a ON a.id=s.user_id
    WHERE s.session_token=? AND s.expires_at>NOW() LIMIT 1` : `SELECT CAST(t.id AS CHAR) AS token_id,t.user_id FROM web_developer_tokens t
    JOIN web_user_accounts a ON a.id=t.user_id WHERE t.token_hash=? AND t.status='active' AND t.revoked_at IS NULL LIMIT 1`;
  const [rows]=await db.execute<RowDataPacket[]>(sql+(locked?' FOR UPDATE':''),[credential]);const row=rows[0];
  if(!row || !Number.isSafeInteger(Number(row.user_id)) || Number(row.user_id)<=0) throw unauthorized();
  return Object.freeze({kind,credential,userId:Number(row.user_id),...(kind==='developer'?{tokenId:String(row.token_id)}:{})});
}
export async function captureActor(event:H3Event,db:Pool) {
  const header=getHeader(event,'authorization');
  if(header!==undefined){const match=/^Bearer ([A-Za-z0-9_-]{16,256})$/i.exec(header.trim());if(!match)throw unauthorized();
    return readActor(db,'developer',createHash('sha256').update(match[1]).digest('hex'));}
  const cookie=getCookie(event,SESSION_COOKIE_NAME);if(!cookie || !/^[a-f0-9]{64}$/.test(cookie))throw unauthorized();
  return readActor(db,'session',cookie);
}
async function serviceGrant(db:Pool,actor:Actor,source:string,scope:SourceServiceScope):Promise<Grant|null> {
  if(actor.kind!=='developer')return null;
  const [rows]=await db.execute<RowDataPacket[]>(`SELECT CAST(id AS CHAR) AS id,developer_user_id,service_name,scopes_json,sources_json,
    revision_nonce,status,DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s') AS expires_at,issued_by_user_id
    FROM taiko_source_service_grants WHERE developer_token_id=? AND status='active' AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`,[actor.tokenId]);
  const row=rows[0];if(!row)return null;
  if(Number(row.developer_user_id)!==actor.userId || !/^[A-Za-z0-9_-]{1,64}$/.test(row.service_name) || !/^[a-f0-9]{32}$/.test(row.revision_nonce))throw new PublicationUnavailableError();
  const policy=validateSourceServicePolicy(JSON.parse(row.scopes_json),JSON.parse(row.sources_json));
  if(!policy.scopes.includes(scope) || (policy.sources!=='*'&&!policy.sources.includes(source)))return null;
  return Object.freeze({kind:'service',tuple:Object.freeze([row.id,row.developer_user_id,row.service_name,row.scopes_json,row.sources_json,row.revision_nonce,row.status,row.expires_at,row.issued_by_user_id])});
}
async function ownerGrant(db:Pool,actor:Actor,source:string,expected?:BindingIdentity):Promise<Grant> {
  const [rows]=await db.execute<(RowDataPacket & BindingIdentity)[]>(`SELECT CAST(id AS CHAR) AS id,taiko_id,source,manual_account_id
    FROM web_taiko_bindings WHERE user_id=? AND CAST(taiko_id AS BINARY)=CAST(? AS BINARY) ORDER BY id LIMIT 2`,[actor.userId,source]);
  if(rows.length!==1)throw denied();const row=rows[0];
  if(expected&&!same(captureBindingIdentity(row),expected))throw denied();
  if(!['wahlap','hiroba','manual'].includes(row.source))throw new PublicationUnavailableError();
  if(MANUAL_SOURCE_ID.test(source) && (row.source!=='manual'||row.manual_account_id!==source))throw denied();
  if(!MANUAL_SOURCE_ID.test(source)&&(row.source==='manual'||row.manual_account_id))throw new PublicationUnavailableError();
  return Object.freeze({kind:'owner',binding:captureBindingIdentity(row)});
}
async function requireManualAlive(db:Pool,source:string) {
  if(!MANUAL_SOURCE_ID.test(source))return;
  const [rows]=await db.execute<RowDataPacket[]>('SELECT taiko_id FROM taiko_manual_accounts WHERE CAST(taiko_id AS BINARY)=CAST(? AS BINARY) LIMIT 1',[source]);
  if(!rows[0])throw denied();
}
async function prove(db:Pool,actor:Actor,grant:Grant,source:string,scope:SourceServiceScope) {
  if(!same(actor,await readActor(db,actor.kind,actor.credential)))throw unauthorized();
  const actual=grant.kind==='service'?await serviceGrant(db,actor,source,scope):await ownerGrant(db,actor,source,grant.binding);
  if(!same(grant,actual))throw denied();await requireManualAlive(db,source);
}

/** Private source read: live credential + owned binding or explicit service
 * capability. Never infer authority from a quota result or HTTP owner fields. */
async function captureAccess(event:H3Event,sourceInput:unknown,scope:SourceServiceScope,mutation=false):Promise<SourceAccessTicket> {
  try {
    const source=typeof sourceInput==='string'?sourceInput.trim():'';if(!validSourceIdentity(source))throw failure(400,'成绩账号标识无效');
    await ensureAccountSchema();const db=getAccountDb(),paths=Object.freeze(getRuntimePaths());
    const actor=await captureActor(event,db);
    const grant=await serviceGrant(db,actor,source,scope) || await ownerGrant(db,actor,source);
    if(grant.kind==='owner'&&!['source_read','history_read'].includes(scope)){
      const platform=scope==='wahlap_update'?'wahlap':scope==='hiroba_sync'?'hiroba':null;
      if(!mutation||!platform||grant.binding.source!==platform||grant.binding.manual_account_id||MANUAL_SOURCE_ID.test(source))throw denied();
    }
    await prove(db,actor,grant,source,scope);
    return Object.freeze({db,paths,actor,grant,source,scope});
  }catch(error){throw safe(error);}
}
export const captureAuthorizedSourceMutation=(event:H3Event,sourceInput:unknown,scope:'wahlap_update'|'hiroba_sync')=>captureAccess(event,sourceInput,scope,true);
export async function withCapturedSourceRead<T>(ticket:SourceAccessTicket,task:()=>Promise<T>):Promise<T>{
  try{
    const {db,paths:{userdataDir,repoRoot},actor,grant,source,scope}=ticket;
    return await withScoreRead({root:userdataDir,repoRoot,identity:source,now:()=>new Date().toISOString()},async()=>{
      const alive=()=>{if(!currentScoreScope(source)?.lease.alive())throw new PublicationUnavailableError();};
      alive();await prove(db,actor,grant,source,scope);alive();const result=await task();
      await prove(db,actor,grant,source,scope);alive();return result;
    });
  }catch(error){throw safe(error);}
}
export async function withAuthorizedSourceRead<T>(event:H3Event,sourceInput:unknown,scope:SourceServiceScope,task:()=>Promise<T>):Promise<T> {
  return withCapturedSourceRead(await captureAccess(event,sourceInput,scope),task);
}

export async function readAuthorizedSourceUserdata(event:H3Event,sourceInput:unknown) {
  return withAuthorizedSourceRead(event,sourceInput,'source_read',async()=>{
    const source=String(sourceInput).trim(),scope=currentScoreScope(source)!;
    if(!await scope.reader.currentExists(source))throw failure(404,'未找到该账号的成绩');
    const raw=await scope.reader.readRawCurrent(source);
    try{const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid score object');return data as Record<string,unknown>;}
    catch{if(scope.lease.view)throw new PublicationUnavailableError();throw failure(500,'目标用户的本地 JSON 已损坏');}
  });
}
