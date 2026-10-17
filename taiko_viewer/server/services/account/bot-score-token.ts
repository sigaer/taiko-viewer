import type {H3Event} from 'h3';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {capturePrincipalAccess,capturePrincipalForActor,provePrincipalAccess,principalFailure,safePrincipalError,type PrincipalTicket} from './principal-access.ts';
import {readBotBindingData,type BotBindingData} from '../../infrastructure/account/bot-binding-rows.ts';
import {bindingHash} from '../../infrastructure/account/bot-binding-effect.ts';
import {getRuntimePaths} from '../../infrastructure/runtime-paths.ts';
import {withScoreWrite,currentScoreScope} from '../../infrastructure/taiko-publication/scope.ts';
import {mutateScoreToken,proveScoreTokenResult,type ScoreTokenResult} from '../../infrastructure/account/score-token.ts';

const unavailable=()=>safePrincipalError(new Error('Bot score token unavailable'));
function selected(data:BotBindingData){
 const row=data.rows.find(row=>row.is_current===1)||data.rows[0];
 if(!row)throw principalFailure(404,'请先绑定鼓众 ID。');
 if(data.virtual||row.source==='manual')throw principalFailure(403,'请切换到自己的实账号生成成绩 token。');
 return row;
}
async function close(db:PoolConnection,name:string,discard:boolean){
 if(discard)return;
 try{const [[row]]=await db.execute<RowDataPacket[]>('SELECT RELEASE_LOCK(?) AS released',[name]);if(row?.released!==1)throw unavailable();db.release();}
 catch{db.destroy();}
}

/** Captured Source EX -> principal gate -> SQL caller/current/token proof.
 * Minting has no automatic replay: a lost response must not silently rotate a
 * token again. No durable receipt stores or regenerates the returned secret.
 */
export async function issueBotScoreToken(event:H3Event,body:Record<string,unknown>){
 try{
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.taikoId!=='string'||!/^[0-9]{1,25}$/.test(body.taikoId))throw principalFailure(400,'成绩 token 请求无效。');
  const captured=await capturePrincipalAccess(event,body.identityKey,'score_token_issue');
  const paths=Object.freeze(getRuntimePaths()),original=await readBotBindingData(captured.db,captured,false),binding=selected(original);
  if(binding.id!==body.taikoId)throw principalFailure(403,'请使用自己的当前绑定管理成绩 token。');
  const ticket:PrincipalTicket=await capturePrincipalForActor(captured.db,captured.actor,captured.principal,'score_token_issue',binding.id,binding.source as 'wahlap'|'hiroba');
  return await withScoreWrite({root:paths.userdataDir,repoRoot:paths.repoRoot,identity:binding.id,now:()=>new Date().toISOString()},async()=>{
   const live=()=>{const scope=currentScoreScope(binding.id);if(!scope||scope.mode!=='write'||scope.staged.size||!scope.lease.alive())throw unavailable();};
   const name='taiko-bind-'+bindingHash(ticket.principal).slice(0,52);
   let db:PoolConnection|undefined,discard=false,attempted=false,prepared:ScoreTokenResult|undefined;
   const prove=async(connection:PoolConnection)=>{
    live();await provePrincipalAccess(connection,ticket,true);
    const data=await readBotBindingData(connection,ticket);
    if(bindingHash(data)!==bindingHash(original))throw principalFailure(403,'当前绑定已变化，请重新查询。');
    selected(data);await provePrincipalAccess(connection,ticket,true);live();
   };
   try{
    db=await ticket.db.getConnection();
    const [[gate]]=await db.execute<RowDataPacket[]>('SELECT GET_LOCK(?,5) AS acquired',[name]);if(gate?.acquired!==1)throw unavailable();
    await db.beginTransaction();await prove(db);
    prepared=await mutateScoreToken(db,binding.id,'issue');await proveScoreTokenResult(db,binding.id,'issue',prepared);
    await prove(db);attempted=true;await db.commit();live();
   }catch(error){
    if(db){try{await db.rollback();}catch{discard=true;db.destroy();}await close(db,name,discard);db=undefined;}
    if(!attempted||!prepared)throw error;
    // Prove the exact committed token on the captured pool, while the original
    // EX remains live; never acknowledge a different concurrent token outcome.
    discard=false;db=await ticket.db.getConnection();
    const [[gate]]=await db.execute<RowDataPacket[]>('SELECT GET_LOCK(?,5) AS acquired',[name]);if(gate?.acquired!==1)throw unavailable();
    try{await db.beginTransaction();await prove(db);await proveScoreTokenResult(db,binding.id,'issue',prepared);await prove(db);await db.commit();live();}
    catch{try{await db.rollback();}catch{discard=true;db.destroy();}throw unavailable();}
   }finally{if(db)await close(db,name,discard);}
   if(!prepared?.token)throw unavailable();
   return {ok:true,identityKey:ticket.principal,taikoId:binding.id,token:prepared.token,tokenMask:prepared.status.tokenMask};
  });
 }catch(error){throw safePrincipalError(error);}
}
