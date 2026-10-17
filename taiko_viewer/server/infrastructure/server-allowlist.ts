import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
/** Operational admission metadata only. Atomic replacement, no authorization cache. */
export async function readServerAllowlist(path:unknown,key:'userIds'|'clientIds',pattern:RegExp){
 if(typeof path!=='string'||!isAbsolute(path))return null;
 let file;
 try{
  file=await open(path,'r');const stat=await file.stat();
  if(!stat.isFile()||stat.size>32768||(stat.mode&0o022)!==0)return null;
  const bytes=Buffer.alloc(32769),{bytesRead}=await file.read(bytes,0,bytes.length,0);
  if(bytesRead>32768)return null;
  const raw=bytes.subarray(0,bytesRead),policy=JSON.parse(raw.toString('utf8'));
  if(!policy||policy.schemaVersion!==1||Object.keys(policy).some(k=>!['schemaVersion',key].includes(k))||!Array.isArray(policy[key])||policy[key].length>500)return null;
  const ids:unknown[]=policy[key];
  if(ids.some(v=>typeof v!=='string'||!pattern.test(v))||new Set(ids).size!==ids.length)return null;
  return {ids:new Set(ids as string[]),revision:createHash('sha256').update(raw).digest('hex')};
 }catch{return null;}finally{await file?.close();}
}
