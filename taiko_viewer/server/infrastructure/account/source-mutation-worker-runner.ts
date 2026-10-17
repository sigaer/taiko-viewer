import {getTaikoPython} from "../../utils/taiko-python.ts";
import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {createError} from 'h3';
import type {SourceAccessTicket} from '../../services/account/source-access.ts';
import {enterPrivateWorker,leavePrivateWorker} from './private-worker-admission.ts';
import {capturedWorkerEnvironment} from './private-worker-environment.ts';
export type SourceMutationRequest={operationId:string;source:string;scope:'wahlap_update'|'hiroba_sync';actor:SourceAccessTicket['actor'];grant:SourceAccessTicket['grant'];
  showAll:boolean;includeImage:boolean;email:string;password:string};
export type SourceMutationResult={operationId:string;source:string;commitId:string;sequence:number;imageBytes:number;imageHash:string|null};
const unavailable=()=>createError({statusCode:503,statusMessage:'同步服务暂不可用，请稍后重试。'});
export function createSourceMutationWorker(launch:typeof spawn=spawn){
  return async(request:SourceMutationRequest,ticket:SourceAccessTicket):Promise<SourceMutationResult>=>{
    const input=JSON.stringify(request);if(Buffer.byteLength(input)>32768)throw unavailable();
    const env=capturedWorkerEnvironment(ticket.db,ticket.paths),lifetime=request.scope==='hiroba_sync'?900:180;
    await enterPrivateWorker();
    try{return await new Promise((resolve,reject)=>{
      let child:ReturnType<typeof spawn>;
      try{child=launch(getTaikoPython(),['-I','-m','taiko_bot.cli.source_mutation_cli'],{cwd:ticket.paths.repoRoot,env,stdio:['pipe','pipe','pipe']});}catch{reject(unavailable());return;}
      const decoder=new StringDecoder('utf8');let text='',bytes=0,stderr=0,failed=false,killTimer:ReturnType<typeof setTimeout>|undefined;
      const stop=()=>{failed=true;child.kill('SIGTERM');killTimer??=setTimeout(()=>child.kill('SIGKILL'),1500);};
      const timer=setTimeout(stop,lifetime*1000);
      child.stdout!.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>65536)stop();else text+=decoder.write(chunk);});
      child.stderr!.on('data',(chunk:Buffer)=>{stderr+=chunk.length;if(stderr>8192)stop();});child.stdin!.on('error',stop);child.once('error',()=>{failed=true;});
      child.once('close',code=>{
        clearTimeout(timer);if(killTimer)clearTimeout(killTimer);if(failed||code!==0){reject(unavailable());return;}
        try{
          const payload=JSON.parse(text+decoder.end());
          if(payload?.ok===false){const errors:Record<string,[number,string]>={unauthorized:[401,'访问凭据已失效。'],denied:[403,'没有访问该账号成绩的权限。'],
            invalid_request:[400,'同步请求无效。'],hiroba_credentials_missing:[409,'该账号尚未配置 Hiroba 凭据。'],wahlap_user_not_found:[404,'未找到该鼓众 ID 的成绩。'],
            wahlap_sync_failed:[502,'从鼓众广场拉取成绩失败，请稍后重试。'],hiroba_sync_failed:[502,'Hiroba 同步失败，请稍后重试。']};
            const known=errors[payload.error];reject(known&&payload.status===known[0]?createError({statusCode:known[0],statusMessage:known[1]}):unavailable());return;}
          const result=payload?.result;
          if(payload?.ok!==true||result?.operationId!==request.operationId||result?.source!==request.source||!Number.isSafeInteger(result.sequence)||result.sequence<1||
            !/^[a-f0-9]{32}$/.test(result.commitId)||!Number.isSafeInteger(result.imageBytes)||result.imageBytes<0||result.imageBytes>16*1024*1024||
            (request.includeImage?result.imageBytes===0||typeof result.imageHash!=='string'||!/^[a-f0-9]{64}$/.test(result.imageHash):result.imageBytes!==0||result.imageHash!==null))throw unavailable();
          resolve({operationId:result.operationId,source:result.source,commitId:result.commitId,sequence:result.sequence,imageBytes:result.imageBytes,imageHash:result.imageHash});
        }catch{reject(unavailable());}
      });child.stdin!.end(input);
    });}finally{leavePrivateWorker();}
  };
}
