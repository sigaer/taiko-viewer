import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {PublicationUnavailableError} from '../taiko-publication/client.ts';
import type {getRuntimePaths} from '../runtime-paths.ts';
export type MergedView={identity:string;commitId:string;sequence:number};
export type MergedWorker={views:MergedView[];ruleRevision:string;alive:()=>boolean;derive:()=>Promise<Record<string,unknown>>;close:()=>Promise<void>};
const MAX_BYTES=32*1024*1024;
/** One process holds all SH leases. No SQL credential enters this worker. */
export async function openMergedReadWorker(paths:ReturnType<typeof getRuntimePaths>,sources:string[],profileSource:string,kind:'current'|'history',rawHistory=false):Promise<MergedWorker>{
  const env:NodeJS.ProcessEnv={PYTHONDONTWRITEBYTECODE:'1'};
  for(const key of ['PATH','LANG','LC_ALL','TZ'])if(process.env[key]!==undefined)env[key]=process.env[key];
  const child:ChildProcessWithoutNullStreams=spawn('python3',['-m','scripts.merged_read_cli'],{cwd:paths.repoRoot,env,stdio:['pipe','pipe','pipe']});
  let closed=false,failed=false,closing=false,chunks:Buffer[]=[],bytes=0,stderr=0;
  let pending:{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|undefined;
  const exit=new Promise<void>(resolve=>child.once('close',()=>{closed=true;resolve();}));
  const fail=()=>{failed=true;if(pending){clearTimeout(pending.timer);pending.reject(new PublicationUnavailableError());pending=undefined;}chunks=[];bytes=0;if(!closed)child.kill('SIGTERM');};
  for(const stream of [child,child.stdin,child.stdout,child.stderr])stream.on('error',fail);
  child.once('close',()=>{if(pending||!closing)fail();});
  child.stderr.on('data',(chunk:Buffer)=>{stderr+=chunk.length;if(stderr>8192)fail();});
  child.stdout.on('data',(chunk:Buffer)=>{
    if(failed)return;let offset=0;
    while(offset<chunk.length){const end=chunk.indexOf(10,offset),piece=chunk.subarray(offset,end<0?chunk.length:end);bytes+=piece.length;
      if(bytes>MAX_BYTES){fail();return;}chunks.push(piece);if(end<0)break;
      try{const result=JSON.parse(Buffer.concat(chunks,bytes).toString('utf8'));chunks=[];bytes=0;
        if(!pending||result?.error){fail();return;}const waiting=pending;pending=undefined;clearTimeout(waiting.timer);waiting.resolve(result);
      }catch{fail();return;}offset=end+1;
    }
  });
  const lifetime=setTimeout(fail,182000);
  const send=(message:unknown,timeout=45000):Promise<any>=>{
    if(pending||failed||closed)return Promise.reject(new PublicationUnavailableError());
    return new Promise((resolve,reject)=>{pending={resolve,reject,timer:setTimeout(fail,timeout)};child.stdin.write(JSON.stringify(message)+'\n',error=>{if(error)fail();});});
  };
  const stop=async()=>{clearTimeout(lifetime);if(closed)return;child.stdin.end();let timer:ReturnType<typeof setTimeout>|undefined;
    try{await Promise.race([exit,new Promise<void>(resolve=>{timer=setTimeout(resolve,1500);})]);clearTimeout(timer);
      if(!closed){child.kill('SIGKILL');await Promise.race([exit,new Promise<void>(resolve=>{timer=setTimeout(resolve,1500);})]);if(!closed)throw new PublicationUnavailableError();}
    }finally{clearTimeout(timer);chunks=[];bytes=0;}
  };
  try{
    const ready=await send({root:paths.userdataDir,sources,profileSource,kind,rawHistory});
    if(ready?.ready!==true||ready.schema!==1||typeof ready.ruleRevision!=='string'||!/^[a-f0-9]{64}$/.test(ready.ruleRevision)||!Array.isArray(ready.views)||ready.views.length!==sources.length||ready.views.some((view:MergedView,i:number)=>view?.identity!==sources[i]||!/^[a-f0-9]{32}$/.test(view.commitId)||!Number.isSafeInteger(view.sequence)||view.sequence<0))throw new PublicationUnavailableError();
    return {views:ready.views,ruleRevision:ready.ruleRevision,alive:()=>!closed&&!failed&&!closing,
      async derive(){const result=await send({method:'derive'},90000);if(result?.ok!==true||!result.payload||typeof result.payload!=='object'||Array.isArray(result.payload))throw new PublicationUnavailableError();return result.payload;},
      async close(){if(closing)return;closing=true;try{if(!failed&&!closed){const result=await send({method:'finish'});if(result?.finished!==true)throw new PublicationUnavailableError();}}finally{await stop();}}
    };
  }catch(error){closing=true;fail();await stop();throw error;}
}
