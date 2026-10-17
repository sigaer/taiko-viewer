import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,opendir} from 'node:fs/promises';
import {join} from 'node:path';
import {PublicationUnavailableError,type PublicationManifest} from './client.ts';

/** Compatibility guard for Sources with legacy producers. It never imports a
 * newer projection over a committed view. An out-of-kernel write is unavailable,
 * not permission to return an older private payload. Normal linked projections
 * need metadata only; adopted copies are stream-hashed without decoding again.
 */
export async function captureProjectionIntegrity(root:string,view:PublicationManifest,history=false):Promise<string>{
 const keys=Object.keys(view.files).filter(k=>k==='current'||history&&k.startsWith('history/')).sort();
 if(!keys.includes('current')||keys.length>50001)throw new PublicationUnavailableError();
 const fingerprint:string[]=[];
 if(history){
  const expected=new Set(keys.filter(k=>k.startsWith('history/')).map(k=>k.slice(8))),actual=new Set<string>();
  let dir;
  try{const info=await lstat(join(root,view.identity));if(!info.isDirectory()||info.isSymbolicLink())throw new PublicationUnavailableError();dir=await opendir(join(root,view.identity));for await(const item of dir){if(item.name.startsWith('data_')&&item.name.endsWith('.json')){actual.add(item.name);if(actual.size>50000)throw new PublicationUnavailableError();}}}
  catch(error){if(!(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT'&&expected.size===0))throw new PublicationUnavailableError();}
  if(actual.size!==expected.size||[...actual].some(name=>!expected.has(name)))throw new PublicationUnavailableError();
 }
 try{
  for(const key of keys){
   const reference=view.files[key]!;
   const path=key==='current'?join(root,view.identity+'data.json'):join(root,view.identity,key.slice(8));
   const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   try{
    const before=await file.stat({bigint:true});if(!before.isFile()||before.size!==BigInt(reference.bytes))throw new PublicationUnavailableError();
    const signature=(s:typeof before)=>[s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');
    const object=await lstat(join(root,'.taiko-publications',view.identity,'objects',reference.sha256),{bigint:true});
    if(before.ino!==object.ino||before.dev!==object.dev){
     const hash=createHash('sha256');for await(const chunk of file.createReadStream({autoClose:false,highWaterMark:65536}))hash.update(chunk as unknown as Uint8Array);
     if(hash.digest('hex')!==reference.sha256)throw new PublicationUnavailableError();
    }
    if(signature(await file.stat({bigint:true}))!==signature(before))throw new PublicationUnavailableError();
    fingerprint.push(key+':'+signature(before));
   }finally{await file.close();}
  }
 }catch{throw new PublicationUnavailableError();}
 return createHash('sha256').update(fingerprint.join('\n')).digest('hex');
}
