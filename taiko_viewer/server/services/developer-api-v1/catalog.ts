import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import schema from '@sakura-taiko/contract/schema' with {type:'json'};
import {projectCatalog} from '@sakura-taiko/contract/catalog';
import type {ApiReadVersions,CatalogVersions} from '@sakura-taiko/contract';
import {getRuntimePaths} from '../../infrastructure/runtime-paths';
import {hash,ApiFailure} from './common';
import {captureCatalogAuthority} from '../content/catalogAuthority';
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
 const {data}=await captureCatalogAuthority();
 const revision=data.catalogRevision;
 const projected=projectCatalog(data.songs,revision,data.searchAliases);
 const byId=new Map(data.songs.map(song=>[String(song.id),song]));
 for(const song of projected.songs){
  const source=byId.get(song.songId);
  Object.assign(song,{catalogSongId:source.catalog.songId,policyVersion:data.policyVersion,
    policies:{catalog_display:source.catalog.catalogDisplay,historical_score:source.catalog.historicalScore},
    availability:{region:'CN',status:source.catalog.cnRelease==='LISTED'?'active':'unknown',releaseStatus:source.catalog.cnRelease,statusSource:source.catalog.statusSource}});
 }
 for(const chart of projected.charts){
  const source=data.charts[`${chart.songId}:${chart.difficulty}`];
  Object.assign(chart,{catalogChartId:source.chartId,policyVersion:data.policyVersion,policies:source.policies,
    availability:{region:'CN',status:source.policies.cn_current_playable.eligible?'active':'unknown',releaseStatus:source.cnDifficultyEvidence}});
 }
 return {revision,policyVersion:data.policyVersion,songRevision:revision,aliasRevision:revision,
   songRowsHash:hash(JSON.stringify(data.songs)),songs:projected.songs,charts:projected.charts};
}
export const versions=(catalogRevision:string,scoreRevision:string|null=null,observationSource:string|null=null,capturedAt:string|null=null):ApiReadVersions=>({contractVersion:'1.1',schemaRevision:SCHEMA_REVISION,catalogRevision,scoreRevision,calculationProfile:null,observationSource,capturedAt});

/** One catalog revision for the entire public response. */
export const catalogVersions=(catalogRevision:string):CatalogVersions=>({contractVersion:'1.1',schemaRevision:SCHEMA_REVISION,catalogRevision});
