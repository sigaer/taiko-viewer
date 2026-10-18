import {createHash} from 'node:crypto';
import {createError,isError,type H3Event} from 'h3';
import {getRuntimePaths} from '../../infrastructure/runtime-paths';
import {privateSourceResponse} from '../../infrastructure/account/private-source-response';
import {PublicationUnavailableError} from '../../infrastructure/taiko-publication/client';
import {isMergedSource} from '../../infrastructure/account/merged-source-id';
import {readAuthorizedSourceUserdata} from './source-access';
import {readAuthorizedMergedSource} from './merged-source-read';
import {enforceTaikoOpenQuota} from '../../utils/taiko-open';
import {getTaikoPython,getTaikoPythonEnv} from '../../utils/taiko-python';
import {acquireDeveloperAnalysisSlot} from './developer-analysis-limits';
import {createDeveloperAnalysisWorker} from './developer-analysis-worker';

type AnalysisKind='rating'|'recommendations';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const readCurrent=(event:H3Event,id:string)=>isMergedSource(id)?readAuthorizedMergedSource(event,id,'current'):readAuthorizedSourceUserdata(event,id);
const ratingCode=[
'import json,sys',
'from taiko_bot.offline.score_calculator import compute_all_from_userdata_records',
'from taiko_application.query import RecommendationContext',
'from taiko_application.query.recommendation import project_player_rating',
'd=json.load(sys.stdin); records=d.get("songs",[])',
'r=compute_all_from_userdata_records(records,collapse_duplicate_versions=False)',
'p=project_player_rating(RecommendationContext(rating_results=r))',
'rows=sorted(r,key=lambda x:float(getattr(x,"AI_rating",0) or 0),reverse=True)[:30]',
'p["topSongs"]=[{"songId":int(getattr(x,"song_id",0) or 0),"level":int(getattr(x,"level",0) or 0),"title":str(getattr(x,"song_name","") or ""),"rating":round(float(getattr(x,"AI_rating",0) or 0),6),"dimensions":{"big_song":round(float(getattr(x,"big_song",0) or 0),6),"stamina":round(float(getattr(x,"stamina",0) or 0),6),"speed":round(float(getattr(x,"speed",0) or 0),6),"accuracy_power":round(float(getattr(x,"accuracy_power",0) or 0),6),"rhythm":round(float(getattr(x,"rhythm",0) or 0),6),"complex":round(float(getattr(x,"complex_proc",0) or 0),6)}} for x in rows if int(getattr(x,"song_id",0) or 0)>0 and int(getattr(x,"level",0) or 0)>0]',
'p["topSongsCount"]=len(p["topSongs"]); print(json.dumps(p,ensure_ascii=False,separators=(",",":")))'
].join('\n');
const recommendationsCode=[
'import json,sys',
'from taiko_bot.offline import score_calculator as sc',
'from taiko_application.query.recommendation import project_ordinary_recommendations',
'from taiko_application.query import RecommendationContext',
'd=json.load(sys.stdin); records=d.get("songs",[])',
'cfg=sc.load_rating_config("./songs/rating_structured_with_ids.json")',
'default_ids,_=sc.identity_inputs()',
'all_stats,songs_cfg,const_table=sc.domain_candidates.build_all_stats_from_records(records,cfg,collapse_duplicate_versions=True,default_ids=default_ids)',
'rows=sc.recommend_songs(all_stats,songs_cfg,const_table,best_key="rating",limit=20)',
'p=project_ordinary_recommendations(RecommendationContext(rows=rows,basis="rating"))',
'print(json.dumps(p,ensure_ascii=False,separators=(",",":")))'
].join('\n');
const executeWorker=createDeveloperAnalysisWorker();
async function runPython(kind:AnalysisKind,records:unknown[]){
 const {repoRoot}=getRuntimePaths();
 return executeWorker({python:getTaikoPython(),repoRoot,env:getTaikoPythonEnv(repoRoot),code:kind==='rating'?ratingCode:recommendationsCode,records});
}
export async function getDeveloperAnalysisByUserid(event:H3Event,useridInput:unknown,kind:AnalysisKind){
 const release=acquireDeveloperAnalysisSlot();
 try{
  await enforceTaikoOpenQuota(event,'developer_userdata');
  const id=String(useridInput||'').trim();
  if(!id||id.length>128)throw createError({statusCode:400,statusMessage:'成绩账号标识无效'});
  return await privateSourceResponse(event,'current',async()=>{
   const before=await readCurrent(event,id);
   if(!before||typeof before!=='object'||!Array.isArray(before.songs))throw new PublicationUnavailableError();
   if(before.songs.length>20000)throw new PublicationUnavailableError();
   const revision=digest({songs:before.songs,meta:before._meta??null});
   const result=await runPython(kind,before.songs);
   const after=await readCurrent(event,id);
   if(!after||!Array.isArray(after.songs)||digest({songs:after.songs,meta:after._meta??null})!==revision)throw new PublicationUnavailableError();
   return {playerId:id,scoreRevision:revision,...result};
  });
 }catch(error){if(isError(error)||error instanceof PublicationUnavailableError)throw error;throw new PublicationUnavailableError();}
 finally{release();}
}
