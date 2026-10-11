import {createHash} from 'node:crypto';
import {appendResponseHeader,getHeader,setResponseHeader,setResponseStatus,type H3Event} from 'h3';
const observations=new WeakMap<H3Event,string>();
export function recordPrivateSourceView(event:H3Event,view:{commitId:string;sequence:number}|null|undefined){
  if(view)observations.set(event,'v1-'+view.commitId+'-'+view.sequence);
  else observations.delete(event);
}
export function recordMergedSourceView(event:H3Event,digest:string){
  if(!/^[a-f0-9]{64}$/.test(digest))throw new Error('Invalid merged observation');
  observations.set(event,'merged-v1-'+digest);
}

/** Conditional reuse never replaces the task's live grant, lease and content proof. */
export async function privateSourceResponse<T>(event:H3Event,kind:'current'|'history',task:()=>Promise<T>):Promise<T|null>{
  let payload:T;
  try{payload=await task();}catch(error){observations.delete(event);throw error;}
  const etag='"taiko-'+kind+'-v1-'+createHash('sha256').update(JSON.stringify(payload)).digest('hex')+'"';
  setResponseHeader(event,'cache-control','private, no-cache, must-revalidate');
  appendResponseHeader(event,'vary','Authorization, Cookie');
  setResponseHeader(event,'etag',etag);
  const observation=observations.get(event);observations.delete(event);
  if(observation)setResponseHeader(event,'x-taiko-source-view',observation);
  if(getHeader(event,'if-none-match')===etag){setResponseStatus(event,304);return null;}
  return payload;
}
