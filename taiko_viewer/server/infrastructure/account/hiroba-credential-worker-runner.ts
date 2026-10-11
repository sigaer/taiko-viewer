import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {principalFailure} from '../../services/account/principal-access.ts';
import {validHirobaSource,type HirobaTicket} from '../../services/account/hiroba-authority.ts';
export type CredentialWorkerRequest={operationId:string;mode:'fingerprint'|'discover'|'decode';email?:string;password?:string;target?:string;principal?:string;passwordEnc?:string};
export type CredentialWorkerResult={operationId:string;intentHash?:string;taikoIds?:string[];passwordEnc?:string;hasCredentials?:boolean};
const unavailable=()=>principalFailure(503,'Hiroba 凭据服务暂不可用，请稍后重试。');
/** Admission belongs to the controller, spanning worker close and SQL cleanup. */
export function createHirobaCredentialWorker(launch:typeof spawn=spawn){
 return async(request:CredentialWorkerRequest,ticket:Pick<HirobaTicket,'paths'|'workerEnv'>):Promise<CredentialWorkerResult>=>{
  const input=JSON.stringify(request);if(Buffer.byteLength(input)>32768)throw unavailable();
  return new Promise((resolve,reject)=>{
   let child:ReturnType<typeof spawn>;
   try{child=launch('python3',['-m','scripts.hiroba_credential_cli'],{cwd:ticket.paths.repoRoot,env:ticket.workerEnv,stdio:['pipe','pipe','pipe']});}catch{reject(unavailable());return;}
   const decoder=new StringDecoder('utf8');let output='',bytes=0,stderr=0,failed=false,killTimer:ReturnType<typeof setTimeout>|undefined;
   const stop=()=>{failed=true;child.kill('SIGTERM');killTimer??=setTimeout(()=>child.kill('SIGKILL'),1500);};
   const timer=setTimeout(stop,(request.mode==='discover'?180:30)*1000);
   child.stdout!.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>16384)stop();else output+=decoder.write(chunk);});
   child.stderr!.on('data',(chunk:Buffer)=>{stderr+=chunk.length;if(stderr>8192)stop();});child.stdin!.on('error',stop);child.once('error',()=>{failed=true;});
   child.once('close',code=>{
    clearTimeout(timer);if(killTimer)clearTimeout(killTimer);if(failed||code!==0){reject(unavailable());return;}
    try{
     const payload=JSON.parse(output+decoder.end());
     if(payload?.ok===false){if(payload.status===400&&payload.error==='invalid_request')throw principalFailure(400,'Hiroba 请求无效。');
      if(payload.status===502&&payload.error==='hiroba_login_failed')throw principalFailure(502,'Hiroba 登录失败，请检查邮箱和密码。');throw unavailable();}
     const result=payload?.result;if(payload?.ok!==true||result?.operationId!==request.operationId)throw unavailable();
     if(request.mode==='decode'){if(result.hasCredentials!==true)throw unavailable();resolve({operationId:result.operationId,hasCredentials:true});return;}
     if(typeof result.intentHash!=='string'||!/^[a-f0-9]{64}$/.test(result.intentHash))throw unavailable();
     if(request.mode==='fingerprint'){resolve({operationId:result.operationId,intentHash:result.intentHash});return;}
     if(!Array.isArray(result.taikoIds)||result.taikoIds.length>128||new Set(result.taikoIds).size!==result.taikoIds.length||result.taikoIds.some((id:unknown)=>!validHirobaSource(id))||
      (request.target&&result.taikoIds.some((id:string)=>id!==request.target))||typeof result.passwordEnc!=='string'||result.passwordEnc.length>8192||!/^[A-Za-z0-9_-]{80,8190}={0,2}$/.test(result.passwordEnc))throw unavailable();
     resolve({operationId:result.operationId,intentHash:result.intentHash,taikoIds:result.taikoIds,passwordEnc:result.passwordEnc});
    }catch(error){reject(error instanceof Error&&'statusCode' in error?error:unavailable());}
   });child.stdin!.end(input);
  });
 };
}
