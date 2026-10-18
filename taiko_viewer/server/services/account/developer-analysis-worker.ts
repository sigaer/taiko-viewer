import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import {createError} from 'h3';
import {ANALYSIS_ADDRESS_SPACE_BYTES,ANALYSIS_MAX_INPUT_BYTES,ANALYSIS_MAX_OUTPUT_BYTES,ANALYSIS_TIMEOUT_MS} from './developer-analysis-limits.ts';

type Input={python:string;repoRoot:string;env:NodeJS.ProcessEnv;code:string;records:unknown[]};
const unavailable=()=>createError({statusCode:503,statusMessage:'分析服务暂不可用，请稍后重试'});
/** flock is held by the Python PID through exec, across Viewer replicas. */
export function createDeveloperAnalysisWorker(launch:typeof spawn=spawn){
 return async({python,repoRoot,env,code,records}:Input):Promise<Record<string,unknown>>=>{
  const input=JSON.stringify({songs:records});
  if(Buffer.byteLength(input)>ANALYSIS_MAX_INPUT_BYTES)throw unavailable();
  const lockDir=resolve(repoRoot,'data','developer-analysis');
  await mkdir(lockDir,{recursive:true,mode:0o700});
  return new Promise((accept,reject)=>{
   let child:ReturnType<typeof spawn>;
   try{
    child=launch('/usr/bin/flock',['--nonblock','--no-fork','--conflict-exit-code=75',resolve(lockDir,'worker.lock'),
     '/usr/bin/prlimit',`--as=${ANALYSIS_ADDRESS_SPACE_BYTES}`,'--cpu=60','--',python,'-I','-c',code],
     {cwd:repoRoot,env:{...env,TAIKO_COMPUTE_ONLY:'1',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'},stdio:['pipe','pipe','ignore']});
   }catch{reject(unavailable());return;}
   const decoder=new StringDecoder('utf8');let output='',bytes=0,failed=false;
   const stop=()=>{failed=true;child.kill('SIGKILL');};
   const timer=setTimeout(stop,ANALYSIS_TIMEOUT_MS);
   child.stdout!.on('data',(chunk:Buffer)=>{
    bytes+=chunk.length;
    if(bytes>ANALYSIS_MAX_OUTPUT_BYTES){stop();return;}
    if(!failed)output+=decoder.write(chunk);
   });
   child.once('error',()=>{failed=true;});
   child.stdin!.on('error',stop);
   // Do not settle early: the caller releases admission only after this PID
   // exits, including timeout, output overflow and failed launch cases.
   child.once('close',exitCode=>{
    clearTimeout(timer);
    if(failed||exitCode!==0){reject(unavailable());return;}
    try{
     const value=JSON.parse(output+decoder.end());
     if(!value||typeof value!=='object'||Array.isArray(value))throw unavailable();
     accept(value);
    }catch{reject(unavailable());}
   });
   child.stdin!.end(input);
  });
 };
}
