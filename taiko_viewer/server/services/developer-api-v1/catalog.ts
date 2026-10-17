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

/** Song metadata and aliases are combined only for public songs/meta reads. */
export async function catalog(includeAliases=false){
 const runtime=useRuntimeConfig();
 const paths=getRuntimePaths();
 const songPath=String(runtime.songDataPath||process.env.TAIKO_SONG_DATA_PATH||resolve(paths.repoRoot,'songs/song_data.json'));
 const songSource=await readBoundedArray(songPath,8*1024*1024,10000,'CATALOG_LIMIT_EXCEEDED');
 const songRevision=hash(songSource.bytes.toString('utf8'));
 let aliasRevision:string|null=null;
 let aliasRows:Array<Record<string,unknown>>=[];
 if(includeAliases){
  const aliasPath=resolve(songPath,'..','song_alias.json');
  const aliasSource=await readBoundedArray(aliasPath,4*1024*1024,20000,'CATALOG_LIMIT_EXCEEDED');
  aliasRevision=hash(aliasSource.bytes.toString('utf8'));
  aliasRows=aliasSource.rows;
 }
 const revision=includeAliases?hash(JSON.stringify({songDataSha256:songRevision,songAliasSha256:aliasRevision})):songRevision;
 const projected=projectCatalog(songSource.rows,revision);
 if(!includeAliases)return {revision,songRevision,aliasRevision,songs:projected.songs,charts:projected.charts};
 const aliasById=new Map<string,Record<string,unknown>>();
 for(const row of aliasRows){
  const id=Number(row.id);
  if(Number.isSafeInteger(id)&&id>0)aliasById.set(String(id),row);
 }
 const sourceById=new Map(songSource.rows.map(row=>[String(row.id),row]));
 const songs=projected.songs.map(song=>{
  const source=sourceById.get(song.songId);
  const alias=aliasById.get(song.songId);
  const songName=typeof source?.song_name==='string'?source.song_name:null;
  const songNameJp=typeof source?.song_name_jp==='string'?source.song_name_jp:typeof alias?.song_name_jp==='string'?alias.song_name_jp:null;
  const aliases=Array.isArray(alias?.aliases)?alias.aliases.filter((value):value is string=>typeof value==='string').slice(0,100):[];
  return {...song,song_name:songName,song_name_jp:songNameJp,aliases};
 });
 return {revision,songRevision,aliasRevision,songs,charts:projected.charts};
}
export const versions=(catalogRevision:string,scoreRevision:string|null=null,observationSource:string|null=null,capturedAt:string|null=null):ApiReadVersions=>({contractVersion:'1.0',schemaRevision:SCHEMA_REVISION,catalogRevision,scoreRevision,calculationProfile:null,observationSource,capturedAt});
