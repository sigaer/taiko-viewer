import {captureProjectionIntegrity} from '../../infrastructure/taiko-publication/projection-integrity';
import type {H3Event} from 'h3';
import {getQuery} from 'h3';
import {fromLegacyScore,type Score} from '@sakura-taiko/contract';
import {getRuntimePaths} from '../../infrastructure/runtime-paths';
import {withScoreRead,currentScoreScope} from '../../infrastructure/taiko-publication/scope';
import {apiDb,apiClient,proveGrant,quota,publicIdentity} from './authority';
import {catalog,aliases,versions,SCHEMA_REVISION} from './catalog';
import {ApiFailure,conditional,exactKeys,hash} from './common';
import {contractRelease} from './lifecycle';
import {getProgressOptions} from '../account/progress';
// The frozen JS mapper's default-null inference is narrower than its Schema types.
// This consumer annotation reuses Score; the mapper and values are unchanged.
const mapScore=fromLegacyScore as unknown as (row:Record<string,unknown>,options:{source:Score['source'];capturedAt:Score['capturedAt'];chartLevel:Score['chart']['level'];chartType:Score['chart']['type'];catalogRevision:Score['chart']['catalogRevision']})=>Score;
const observationSources=new Set(['wahlap','hiroba','manual','manual-score','cookie','import','repair','dispatcher-transfer','local-snapshot','content-edit','unknown']);
const fields=['song_no','level','high_score','best_score_rank','good_cnt','ok_cnt','ng_cnt','pound_cnt','combo_cnt','stage_cnt','clear_cnt','full_combo_cnt','dondaful_combo_cnt','highscore_datetime','update_datetime'];
export async function publicRead(event:H3Event,kind:'meta'|'songs'|'charts'|'aliases'|'progress-options'){
 exactKeys(getQuery(event),[]);const db=await apiDb();await publicIdentity(event,db);const c=await catalog();const a=kind==='aliases'?await aliases():null;const p=kind==='progress-options'?await getProgressOptions():null;
 const payload=kind==='meta'?{apiVersion:'v1',contractVersion:'1.0',schemaRevision:SCHEMA_REVISION,catalogRevision:c.revision,capabilities:['catalog:read','profile:read','scores:read','account:read'],unavailableScopes:['history:read','growth:read'],...contractRelease,runtimeEnabled:true,catalogProfile:'source-catalog-explicit-v1',pagination:'none-bounded-complete-response'}:{versions:versions(kind==='aliases'?(a?.revision||c.revision):c.revision),items:kind==='songs'?c.songs:kind==='charts'?c.charts:kind==='aliases'?a?.items:p};
 return conditional(event,payload);
}
export async function privateRead(event:H3Event,kind:'profile'|'scores',playerId:string){
 const db=await apiDb();const client=await apiClient(event,db);const grant=await proveGrant(db,client,playerId,kind==='scores'?'scores:read':'profile:read');
 exactKeys(getQuery(event),[]);await quota(event,db,client);
 const paths=getRuntimePaths();const c=await catalog();
 const body=await withScoreRead({root:paths.userdataDir,repoRoot:paths.repoRoot,identity:grant.taikoId,now:()=>new Date().toISOString()},async()=>{
  // Recheck after waiting for the Publication lease, before reading any score.
  const before=await proveGrant(db,client,playerId,kind==='scores'?'scores:read':'profile:read');if(before.revision!==grant.revision||before.grantId!==grant.grantId)throw new ApiFailure(403,'GRANT_REQUIRED');
  const scope=currentScoreScope(grant.taikoId)!;if(!scope.lease.view)throw new ApiFailure(503,'PUBLICATION_REQUIRED');
  const projectionIntegrity=await captureProjectionIntegrity(paths.userdataDir,scope.lease.view);
  const snapshot=await scope.reader.readCurrent(grant.taikoId);const data=snapshot.current;
  if(!data||typeof data!=='object'||!Array.isArray(data.songs))throw new ApiFailure(503,'UNAVAILABLE');
  if(data.songs.length>20000)throw new ApiFailure(503,'SCORES_LIMIT_EXCEEDED');
  const source=typeof data._meta?.source==='string'&&observationSources.has(data._meta.source)?data._meta.source:null;
  const ts=data._meta?.ts;const capturedAt=typeof ts==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(ts)&&Number.isFinite(Date.parse(ts))?ts:null;
  const revision=`publication-v1:${scope.lease.view.sequence}:${scope.lease.view.commitId}`;const v=versions(c.revision,revision,source,capturedAt);
  if(await captureProjectionIntegrity(paths.userdataDir,scope.lease.view)!==projectionIntegrity)throw new ApiFailure(503,'UNAVAILABLE');
  if(kind==='profile'){
   const profile=data.profile, costume=profile?.gameCostume, dan=costume?.dan_name;
   const text=(value:unknown)=>typeof value==='string'?value.slice(0,80):null;
   const integer=(value:unknown)=>{const n=typeof value==='string'&&/^-?[0-9]{1,9}$/.test(value)?Number(value):value;return typeof n==='number'&&Number.isSafeInteger(n)?n:null;};
   return {versions:v,profile:{playerId,bindingId:grant.bindingId,displayName:text(profile?.mydon_name)||text(costume?.mydon_name),source:grant.source,
    ...(grant.scopes.includes('account:read')?{taikoId:grant.taikoId,title:text(costume?.title)||text(profile?.title),dan:{equippedGrade:integer(dan?.grade),equippedLevel:integer(dan?.level),highestPassedGrade:integer(costume?.got_dan_max)}}:{})}};
  }
  const chartMap=new Map(c.charts.map(chart=>[`${chart.songId}:${chart.difficulty}`,chart]));const songMap=new Map(c.songs.map(song=>[song.songId,song]));
  const items=data.songs.map(record=>{
   const safe=Object.fromEntries(fields.filter(key=>Object.hasOwn(record,key)).map(key=>[key,record[key]]));
   const chart=chartMap.get(`${record.song_no}:${record.level}`);
   const value=mapScore(safe,{source:source||'unknown',capturedAt,chartLevel:chart?.level??null,chartType:chart?.type??'unknown',catalogRevision:c.revision});
   const {legacy:_legacy,...result}=value;result.song=songMap.get(result.song.songId)||result.song;if(chart)result.chart=chart;return result;
  });
  // Retain native record order; repeated reads of one committed generation are stable.
  return {versions:v,playerId,items};
 });
 // After Worker teardown, recheck credential + binding + consent + revocation before ETag/304.
 const after=await proveGrant(db,client,playerId,kind==='scores'?'scores:read':'profile:read');
 if(after.grantId!==grant.grantId||after.revision!==grant.revision||hash(JSON.stringify(after))!==hash(JSON.stringify(grant)))throw new ApiFailure(403,'GRANT_REQUIRED');
 return conditional(event,body,true);
}
