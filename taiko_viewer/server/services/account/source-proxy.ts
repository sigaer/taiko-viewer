import {randomUUID,createHash} from 'node:crypto';
import {open,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import {isError,type H3Event} from 'h3';
import {enforceTaikoOpenQuota} from '../../utils/taiko-open.ts';
import {captureAuthorizedSourceMutation,withCapturedSourceRead,withAuthorizedSourceRead} from './source-access.ts';
import {runSourceMutationWorker} from '../../infrastructure/account/source-mutation-worker.ts';
import {currentScoreScope} from '../../infrastructure/taiko-publication/scope.ts';
import {PublicationUnavailableError} from '../../infrastructure/taiko-publication/client.ts';
import {recordPrivateSourceView} from '../../infrastructure/account/private-source-response.ts';
import {isMergedSource} from '../../infrastructure/account/merged-source-id.ts';
import {readAuthorizedMergedSource} from './merged-source-read.ts';
export async function sourceProxyRequest<T>(event:H3Event,apiName:string,task:()=>Promise<T>){
  try{await enforceTaikoOpenQuota(event,apiName);return await task();}
  catch(error){if(isError(error)||error instanceof PublicationUnavailableError)throw error;throw new PublicationUnavailableError();}
}
export async function updateAuthorizedSource(event:H3Event,sourceInput:unknown,platform:'wahlap'|'hiroba',
  options:{showAll?:boolean;includeImage?:boolean;email?:unknown;password?:unknown}={}){
  const ticket=await captureAuthorizedSourceMutation(event,sourceInput,platform==='wahlap'?'wahlap_update':'hiroba_sync');
  const operationId=randomUUID().replaceAll('-',''),path=resolve(ticket.paths.cacheDir,'source-render',operationId+'.png');
  try{
    const result=await runSourceMutationWorker({operationId,source:ticket.source,scope:ticket.scope as 'wahlap_update'|'hiroba_sync',actor:ticket.actor,grant:ticket.grant,
      showAll:Boolean(options.showAll),includeImage:options.includeImage!==false,email:typeof options.email==='string'?options.email:'',password:typeof options.password==='string'?options.password:''},ticket);
    return await withCapturedSourceRead(ticket,async()=>{
      const scope=currentScoreScope(ticket.source)!,publication=scope.lease.view;
      if(!publication||publication.commitId!==result.commitId||publication.sequence!==result.sequence)throw new PublicationUnavailableError();
      const userdata=JSON.parse(await scope.reader.readRawCurrent(ticket.source));
      if(!userdata||typeof userdata!=='object'||Array.isArray(userdata))throw new PublicationUnavailableError();
      let imageBase64:string|null=null;
      if(result.imageBytes){
        const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
        try{const info=await file.stat();if(!info.isFile()||info.nlink!==1||info.size!==result.imageBytes||info.size>16*1024*1024)throw new PublicationUnavailableError();
          const bytes=await file.readFile();if(createHash('sha256').update(bytes).digest('hex')!==result.imageHash)throw new PublicationUnavailableError();imageBase64=bytes.toString('base64');
        }finally{await file.close();}
      }
      return {ok:true,taikoId:ticket.source,source:platform,message:platform==='wahlap'?'更新成功，成绩已写入中心设备。':'Hiroba 更新成功，成绩已写入中心设备。',
        userdata,imageBase64,imageMimeType:imageBase64?'image/png':null,imageFilename:imageBase64?`taiko-${platform==='wahlap'?'update':'hiroba-update'}-${ticket.source}.png`:null};
    });
  }finally{await unlink(path).catch(()=>{});}
}
export async function readAuthorizedSourceHistory(event:H3Event,sourceInput:unknown){
  if(isMergedSource(sourceInput))return readAuthorizedMergedSource(event,sourceInput,'history');
  return withAuthorizedSourceRead(event,sourceInput,'history_read',async()=>{
    const source=String(sourceInput).trim(),scope=currentScoreScope(source)!,names=(await scope.reader.listHistory(source)).filter(name=>name.startsWith('data_')&&name.endsWith('.json')).sort();
    const snapshots:Array<{capturedAt:string;payload:Record<string,unknown>}>=[];let bytes=0;
    for(const name of names){
      const raw=await scope.reader.readHistory(source,name);bytes+=Buffer.byteLength(raw)+Buffer.byteLength(name)+128;
      if(bytes>32*1024*1024)throw new PublicationUnavailableError();
      try{const payload=JSON.parse(raw);if(!payload||typeof payload!=='object')continue;
        const capturedAt=String(payload._meta?.ts||name).trim();snapshots.push({capturedAt,payload});
      }catch{/* Invalid legacy/historical JSON is preserved but not returned as a parsed snapshot. */}
    }
    recordPrivateSourceView(event,scope.lease.view);
    return {ok:true,taikoId:source,snapshots};
  });
}
