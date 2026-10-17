import {randomUUID} from 'node:crypto';
import type {H3Event} from 'h3';
import {capturePrincipalAccess,provePrincipalAccess,principalFailure,safePrincipalError} from './principal-access.ts';
import {getRuntimePaths} from '../../infrastructure/runtime-paths.ts';
import {capturedWorkerEnvironment} from '../../infrastructure/account/private-worker-environment.ts';
import {enterPrivateWorker,leavePrivateWorker} from '../../infrastructure/account/private-worker-admission.ts';
import {runQqMigrationWorker} from '../../infrastructure/account/qq-migration-worker.ts';

/** One shared Python transaction owns native + remote QQ migration. Code
 * issue is a single request; consumption retries the same code and target. */
export async function runQqMigration(event:H3Event,action:'issue'|'migrate',input:unknown){
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))throw principalFailure(400,'QQ 迁移请求无效。');
  const body=input as Record<string,unknown>,principal=body.identityKey;
  if(typeof principal!=='string'||!/^(?:onebot_v11:[0-9]{1,128}|qq_official:[A-Za-z0-9_-]{1,128})$/.test(principal))throw principalFailure(400,'身份标识无效。');
  const qq=body.qq,code=body.code??'';
  if(action==='issue'&&!/^onebot_v11:[1-9][0-9]{4,14}$/.test(principal))throw principalFailure(403,'请使用原 QQ 私聊旧 bot 申请迁移验证码。');
  if(action==='migrate'&&(typeof qq!=='string'||!/^[1-9][0-9]{4,14}$/.test(qq)||typeof code!=='string'||(code!==''&&!/^[a-f0-9]{32}$/.test(code))
    ||(principal!=='onebot_v11:'+qq&&!code)))throw principalFailure(400,'请输入原 QQ 号及迁移验证码。');
  const ticket=await capturePrincipalAccess(event,principal,'bind_migrate');
  const paths=Object.freeze(getRuntimePaths()),workerEnv=Object.freeze(capturedWorkerEnvironment(ticket.db,paths));
  await enterPrivateWorker();
  try{
   await provePrincipalAccess(ticket.db,ticket);
   const result=await runQqMigrationWorker({operationId:randomUUID().replaceAll('-',''),action,principal,
    ...(action==='migrate'?{qq:qq as string,code:code as string}:{}),actor:ticket.actor,grant:ticket.grant},{paths,workerEnv});
   await provePrincipalAccess(ticket.db,ticket);
   return result;
  }finally{leavePrivateWorker();}
 }catch(error){throw safePrincipalError(error);}
}
