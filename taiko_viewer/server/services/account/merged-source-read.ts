import {createHash} from 'node:crypto';
import type {H3Event} from 'h3';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {ensureAccountSchema,getAccountDb} from '../../utils/account-db';
import {getRuntimePaths} from '../../infrastructure/runtime-paths.ts';
import {enterPrivateWorker,leavePrivateWorker} from '../../infrastructure/account/private-worker-admission.ts';
import {readBotBindingData,type BotBindingData} from '../../infrastructure/account/bot-binding-rows.ts';
import {mergedSourcePrincipal} from '../../infrastructure/account/merged-source-id.ts';
import {openMergedReadWorker,type MergedWorker} from '../../infrastructure/account/merged-read-worker.ts';
import {recordMergedSourceView} from '../../infrastructure/account/private-source-response.ts';
import {captureActor,captureSourceReadForActor,proveCapturedSourceAccess} from './source-access.ts';
import {capturePrincipalForActor,provePrincipalAccess,principalFailure,safePrincipalError} from './principal-access.ts';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unavailable=()=>safePrincipalError(new Error('Merged read unavailable'));
function composition(data:BotBindingData){
  const official=data.rows.filter(row=>row.source!=='manual');
  if(!data.virtual||official.length<2)throw principalFailure(409,'当前未使用 u0 合并账号。');
  // Preserve the previous client's profile index clamp after manual exclusion.
  const index=Math.max(0,data.rows.findIndex(row=>row.is_current===1));
  return {sources:official.map(row=>row.id),profileSource:official[Math.min(index,official.length-1)]!.id};
}
/** All Source SH -> principal gate -> SQL. SQL never waits for a Source lease. */
export async function readAuthorizedMergedSource(event:H3Event,input:unknown,kind:'current'|'history',rawHistory=false){
  let worker:MergedWorker|undefined,connection:PoolConnection|undefined,discard=false,admitted=false,gateHeld=false;
  let lockName='';
  try{
    let principal:string;
    try{principal=mergedSourcePrincipal(input);}catch{throw principalFailure(400,'合并账号标识无效。');}
    await ensureAccountSchema("source");const db=getAccountDb(),paths=Object.freeze(getRuntimePaths()),actor=await captureActor(event,db);
    const ticket=await capturePrincipalForActor(db,actor,principal,'bind_read');
    await provePrincipalAccess(db,ticket);
    const original=await readBotBindingData(db,ticket,false),{sources,profileSource}=composition(original);
    const grants=[];
    for(const row of original.rows.filter(row=>row.source!=='manual')){
      const grant=await captureSourceReadForActor(db,paths,actor,row.id,kind==='current'?'source_read':'history_read');
      if(grant.grant.kind==='owner'&&grant.grant.binding.source!==row.source)throw principalFailure(403,'绑定来源已变更。');
      grants.push(grant);
      // A merged history includes the current observation as the legacy u0
      // materializer did. Its caller must also hold current-score authority.
      if(kind==='history')grants.push(await captureSourceReadForActor(db,paths,actor,row.id,'source_read'));
    }
    await enterPrivateWorker();admitted=true;
    worker=await openMergedReadWorker(paths,sources,profileSource,kind,rawHistory);
    const alive=()=>{if(!worker!.alive())throw unavailable();};
    alive();connection=await db.getConnection();lockName='taiko-bind-'+hash(principal).slice(0,52);
    const [[gate]]=await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?,5) AS acquired',[lockName]);
    if(gate?.acquired!==1)throw unavailable();gateHeld=true;
    await connection.beginTransaction();
    const prove=async()=>{alive();await provePrincipalAccess(connection!,ticket,true);
      if(hash(await readBotBindingData(connection!,ticket))!==hash(original))throw principalFailure(403,'合并账号绑定已变更。');
      for(const grant of grants)await proveCapturedSourceAccess(connection!,grant,true);
      await provePrincipalAccess(connection!,ticket,true);alive();
    };
    await prove();const derived=await worker.derive();await prove();await connection.commit();alive();
    const result=kind==='current'?derived:{ok:true,taikoId:String(input),...derived};
    // This digest identifies the entire member vector plus profile/topology;
    // it is distinct from a single canonical publication commit.
    const digest=hash({principal,bindings:original,views:worker.views,profileSource,ruleRevision:worker.ruleRevision});
    await worker.close();worker=undefined;recordMergedSourceView(event,digest);return result;
  }catch(error){
    if(connection)try{await connection.rollback();}catch{discard=true;connection.destroy();}
    throw safePrincipalError(error);
  }finally{
    if(connection&&!discard){try{if(gateHeld){const [[released]]=await connection.execute<RowDataPacket[]>('SELECT RELEASE_LOCK(?) AS released',[lockName]);if(released?.released!==1)throw unavailable();}connection.release();}catch{connection.destroy();}}
    try{await worker?.close();}finally{if(admitted)leavePrivateWorker();}
  }
}
