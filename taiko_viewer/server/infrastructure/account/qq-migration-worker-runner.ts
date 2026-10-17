import {getTaikoPython} from "../../utils/taiko-python.ts";
import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import type {getRuntimePaths} from '../runtime-paths.ts';
import type {SourceActor} from '../../services/account/source-access.ts';
import {principalFailure,type PrincipalTicket} from '../../services/account/principal-access.ts';
export type QqWorkerRequest={operationId:string;action:'issue'|'migrate';principal:string;qq?:string;code?:string;actor:SourceActor;grant:PrincipalTicket['grant']};
type Host={paths:ReturnType<typeof getRuntimePaths>;workerEnv:NodeJS.ProcessEnv};
const unavailable=()=>principalFailure(503,'QQ 迁移结果暂无法确认，请查询当前绑定后再重试。');
const messages:Record<string,[number,string]>={
 invalid_request:[400,'QQ 迁移请求无效。'],unauthorized:[401,'中心访问凭据已失效。'],denied:[403,'没有迁移该绑定的权限。'],
 qq_proof_required:[403,'请先用原 QQ 私聊旧 bot 申请迁移验证码。'],qq_source_missing:[404,'未找到该 QQ 的历史绑定。'],
 qq_manual_origin:[403,'手动账号请通过认领命令绑定。'],qq_proof_expired:[409,'验证码已过期或历史绑定已改变，请重新申请。'],
 qq_capacity:[409,'绑定数量已达上限。'],qq_source_conflict:[409,'两边账号来源不一致，请先检查当前绑定。'],qq_code_cooldown:[429,'请一分钟后再申请迁移验证码。']
};
function validatePayload(request:QqWorkerRequest,payload:Record<string,any>){
 if(request.action==='issue'){
  if(payload.qq!==request.principal.split(':')[1]||typeof payload.code!=='string'||!/^[a-f0-9]{32}$/.test(payload.code)||payload.expiresInSeconds!==600)throw unavailable();
  return;
 }
 const operation=payload.operation,rows=payload.bindings;
 if(!operation||operation.kind!=='qq-migrate'||operation.qq!==request.qq||typeof operation.sourceCurrentId!=='string'||!/^[0-9]{1,25}$/.test(operation.sourceCurrentId)||
  typeof operation.firstBinding!=='boolean'||typeof operation.replayed!=='boolean'||typeof payload.found!=='boolean'||!Array.isArray(rows)||rows.length>128||payload.found!==Boolean(rows.length))throw unavailable();
 const ids=new Set(),slots=new Set();
 for(const row of rows){
  if(!row||typeof row.taikoId!=='string'||!/^[0-9]{1,25}$/.test(row.taikoId)||!Number.isSafeInteger(row.slot)||row.slot<1||row.slot>=1000000||
   ![0,1].includes(row.visible)||typeof row.isCurrent!=='boolean'||!['wahlap','hiroba','manual'].includes(row.source)||
   typeof row.displayName!=='string'||Buffer.byteLength(row.displayName)>256||typeof row.isManual!=='boolean'||row.isManual!==(row.source==='manual')||
   (row.source==='manual')!==/^98[0-9]{16}$/.test(row.taikoId)||
   row.canExternalSync!==(row.source!=='manual')||ids.has(row.taikoId)||slots.has(row.slot))throw unavailable();
  ids.add(row.taikoId);slots.add(row.slot);
 }
 if(rows.length){const current=rows.filter(row=>row.isCurrent);
  if(current.length!==1||payload.taikoId!==current[0].taikoId||payload.currentTaikoId!==current[0].taikoId||payload.currentSource!==current[0].source||
   typeof payload.currentVirtual!=='boolean'||payload.currentSlot!==(payload.currentVirtual?0:current[0].slot)||
   (payload.currentVirtual&&rows.filter(row=>!row.isManual).length<2))throw unavailable();
 }
}
/** Entire worker lifetime and close stay within caller's admission slot. */
export function createQqMigrationWorker(launch:typeof spawn=spawn){return async(request:QqWorkerRequest,host:Host):Promise<Record<string,unknown>>=>{
 const input=JSON.stringify(request);if(Buffer.byteLength(input)>65536)throw unavailable();
 return new Promise((resolve,reject)=>{
  let child:ReturnType<typeof spawn>;
  try{child=launch(getTaikoPython(),['-I','-m','taiko_bot.cli.qq_migration_cli'],{cwd:host.paths.repoRoot,env:host.workerEnv,stdio:['pipe','pipe','pipe']});}catch{reject(unavailable());return;}
  const decoder=new StringDecoder('utf8');let output='',bytes=0,stderr=0,failed=false,killTimer:ReturnType<typeof setTimeout>|undefined;
  const stop=()=>{failed=true;child.kill('SIGTERM');killTimer??=setTimeout(()=>child.kill('SIGKILL'),1500);};
  const timer=setTimeout(stop,50000);
  child.stdout!.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>256*1024)stop();else output+=decoder.write(chunk);});
  child.stderr!.on('data',(chunk:Buffer)=>{stderr+=chunk.length;if(stderr>8192)stop();});child.stdin!.on('error',stop);child.once('error',()=>{failed=true;});
  child.once('close',code=>{
   clearTimeout(timer);if(killTimer)clearTimeout(killTimer);if(failed||code!==0){reject(unavailable());return;}
   try{
    const response=JSON.parse(output+decoder.end());
    if(response?.ok===false){const entry=messages[response.error];if(entry&&entry[0]===response.status)throw principalFailure(...entry);throw unavailable();}
    const result=response?.result;
    if(response?.ok!==true||result?.operationId!==request.operationId||result?.payload?.ok!==true||result.payload.identityKey!==request.principal)throw unavailable();
    validatePayload(request,result.payload);
    resolve(result.payload);
   }catch(error){reject(error instanceof Error&&'statusCode' in error?error:unavailable());}
  });child.stdin!.end(input);
 });
};}
