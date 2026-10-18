import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import schema from '@sakura-taiko/contract/schema' with {type:'json'};
import {projectCatalog} from '@sakura-taiko/contract/catalog';
import type {ApiReadVersions,CatalogVersions} from '@sakura-taiko/contract';
import {getRuntimePaths} from '../../infrastructure/runtime-paths';
import {hash,ApiFailure} from './common';
export const SCHEMA_REVISION=hash(JSON.stringify(schema));
export {difficultyToTjaCourse} from '@sakura-taiko/contract/catalog';
export {projectCatalog as mapCatalog} from '@sakura-taiko/contract/catalog';

async function readBoundedArray(path:string,maxBytes:number,maxRows:number,code:string){
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const stat=await file.stat();
  if(!stat.isFile()||stat.size>maxBytes)throw new ApiFailure(503,code);
  const bytes=await file.readFile();
  if(bytes.length>maxBytes)throw new ApiFailure(503,code);
  const rows=JSON.parse(bytes.toString('utf8'));
  if(!Array.isArray(rows)||rows.length>maxRows)throw new ApiFailure(503,code);
  return {bytes,rows:rows as Array<Record<string,unknown>>};
 }catch(error){if(error instanceof ApiFailure)throw error;throw new ApiFailure(503,code);}
 finally{await file.close();}
}

/** One revision covers song metadata and aliases; no duplicate title field. */
export async function catalog(){
 const runtime=useRuntimeConfig();
 const paths=getRuntimePaths();
 const songPath=String(runtime.songDataPath||process.env.TAIKO_SONG_DATA_PATH||resolve(paths.repoRoot,'songs/song_data.json'));
 const aliasPath=resolve(songPath,'..','song_alias.json');
 const [songSource,aliasSource]=await Promise.all([
  readBoundedArray(songPath,8*1024*1024,10000,'CATALOG_LIMIT_EXCEEDED'),
  readBoundedArray(aliasPath,4*1024*1024,20000,'CATALOG_LIMIT_EXCEEDED')
 ]);
 const songRevision=createHash('sha256').update(songSource.bytes).digest('hex');
 const aliasRevision=createHash('sha256').update(aliasSource.bytes).digest('hex');
 const revision=hash(JSON.stringify({songDataSha256:songRevision,songAliasSha256:aliasRevision}));
 const projected=projectCatalog(songSource.rows,revision,aliasSource.rows);
 return {revision,songRevision,aliasRevision,songs:projected.songs,charts:projected.charts};
}
export const versions=(catalogRevision:string,scoreRevision:string|null=null,observationSource:string|null=null,capturedAt:string|null=null):ApiReadVersions=>({contractVersion:'1.1',schemaRevision:SCHEMA_REVISION,catalogRevision,scoreRevision,calculationProfile:null,observationSource,capturedAt});

/** One catalog revision for the entire public response. */
export const catalogVersions=(catalogRevision:string):CatalogVersions=>({contractVersion:'1.1',schemaRevision:SCHEMA_REVISION,catalogRevision});
