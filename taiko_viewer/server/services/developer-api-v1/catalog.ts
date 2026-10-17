import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import schema from '@sakura-taiko/contract/schema' with {type:'json'};
import {projectCatalog} from '@sakura-taiko/contract/catalog';
import type {ApiReadVersions} from '@sakura-taiko/contract';
import {getRuntimePaths} from '../../infrastructure/runtime-paths';
import {hash,ApiFailure} from './common';
export const SCHEMA_REVISION=hash(JSON.stringify(schema));
export {difficultyToTjaCourse} from '@sakura-taiko/contract/catalog';
export {projectCatalog as mapCatalog} from '@sakura-taiko/contract/catalog';
/** Hash and projection come from the same bounded bytes; no upstream call/cache. */
export async function catalog(){
 const c=useRuntimeConfig();const path=String(c.songDataPath||process.env.TAIKO_SONG_DATA_PATH||resolve(getRuntimePaths().repoRoot,'songs/song_data.json'));
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const stat=await file.stat();if(!stat.isFile())throw new ApiFailure(503,'UNAVAILABLE');if(stat.size>8*1024*1024)throw new ApiFailure(503,'CATALOG_LIMIT_EXCEEDED');const bytes=await file.readFile();if(bytes.length>8*1024*1024)throw new ApiFailure(503,'CATALOG_LIMIT_EXCEEDED');const revision=hash(bytes.toString('utf8'));const rows=JSON.parse(bytes.toString('utf8'));if(Array.isArray(rows)&&rows.length>10000)throw new ApiFailure(503,'CATALOG_LIMIT_EXCEEDED');return {revision,...projectCatalog(rows,revision)};}finally{await file.close();}
}
export const versions=(catalogRevision:string,scoreRevision:string|null=null,observationSource:string|null=null,capturedAt:string|null=null):ApiReadVersions=>({contractVersion:'1.0',schemaRevision:SCHEMA_REVISION,catalogRevision,scoreRevision,calculationProfile:null,observationSource,capturedAt});

export async function aliases(){
 const aliasPath=resolve(getRuntimePaths().repoRoot,'songs','song_alias.json');
 const file=await open(aliasPath,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const stat=await file.stat();if(!stat.isFile()||stat.size>4*1024*1024)throw new ApiFailure(503,'ALIASES_UNAVAILABLE');const bytes=await file.readFile();if(bytes.length>4*1024*1024)throw new ApiFailure(503,'ALIASES_UNAVAILABLE');const revision=hash(bytes.toString('utf8'));const rows=JSON.parse(bytes.toString('utf8'));if(!Array.isArray(rows)||rows.length>20000)throw new ApiFailure(503,'ALIASES_UNAVAILABLE');return {revision,items:rows.filter(x=>x&&Number.isSafeInteger(Number(x.id))&&Number(x.id)>0).map(x=>({songId:Number(x.id),aliases:Array.isArray(x.aliases)?x.aliases.filter((a:unknown)=>typeof a==='string').slice(0,100):[],japaneseTitle:typeof x.song_name_jp==='string'?x.song_name_jp:null}))};}finally{await file.close();}
}
