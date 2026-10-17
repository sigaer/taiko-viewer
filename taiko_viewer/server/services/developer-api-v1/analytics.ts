import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import type {H3Event} from 'h3';
import {getQuery} from 'h3';
import {getRuntimePaths} from '../../infrastructure/runtime-paths';
import {withScoreRead,currentScoreScope} from '../../infrastructure/taiko-publication/scope';
import {getTaikoPython,getTaikoPythonEnv} from '../../utils/taiko-python';
import {apiDb,apiClient,proveGrant,quota} from './authority';
import {ApiFailure,exactKeys} from './common';
import {catalog,versions} from './catalog';
const execFileAsync=promisify(execFile);
type AnalysisKind='rating'|'b30'|'recommendations';
async function compute(taikoId:string,kind:AnalysisKind){
 const paths=getRuntimePaths(),python=getTaikoPython();
 const rating=['import json,sys','from taiko_bot.offline.recommendation_intelligence import build_player_rating_intelligence','print(json.dumps(build_player_rating_intelligence(sys.argv[1]),ensure_ascii=False,separators=(",",":")))'].join('\\n');
 const recommendations=['import json,sys','from taiko_bot.offline.recommendation_intelligence import build_ordinary_recommendation_intelligence','print(json.dumps(build_ordinary_recommendation_intelligence(sys.argv[1],basis="rating",limit=20),ensure_ascii=False,separators=(",",":")))'].join('\\n');
 const b30=[
 'import json,sys',
 'from taiko_bot.offline.score_calculator import compute_all_from_userdata',
 'from sakura_taiko_core.rating.v1 import aggregate_topN_value,compute_dim_topN_means',
 'r=compute_all_from_userdata(sys.argv[1],collapse_duplicate_versions=False)',
 'dims=compute_dim_topN_means(r,20) if r else {}',
 'rows=sorted(r,key=lambda x:float(getattr(x,"AI_rating",0) or 0),reverse=True)[:30]',
 'items=[{"songId":int(getattr(x,"song_id",0) or 0),"level":int(getattr(x,"level",0) or 0),"rating":round(float(getattr(x,"AI_rating",0) or 0),6),"dimensions":{"big_song":round(float(getattr(x,"big_song",0) or 0),6),"stamina":round(float(getattr(x,"stamina",0) or 0),6),"speed":round(float(getattr(x,"speed",0) or 0),6),"accuracy_power":round(float(getattr(x,"accuracy_power",0) or 0),6),"rhythm":round(float(getattr(x,"rhythm",0) or 0),6),"complex":round(float(getattr(x,"complex_proc",0) or 0),6)}} for x in rows if int(getattr(x,"song_id",0) or 0)>0 and int(getattr(x,"level",0) or 0)>0]',
 'print(json.dumps({"model":"v1","aggregation":"per-dimension-top20","topN":20,"overallRating":round(float(aggregate_topN_value(r,"AI_rating",20)),6) if r else None,"sampleCount":len(r),"dimensions":[{"key":k,"label":label,"value":round(float(dims.get(label,0) or 0),6)} for k,label in [("big_song","大歌力"),("stamina","体力"),("speed","高速处理"),("accuracy_power","精度力"),("rhythm","节奏处理"),("complex","复合处理")]],"b30":items},ensure_ascii=False,separators=(",",":")))'
 ].join('\\n');
 try{const result=await execFileAsync(python,['-I','-c',kind==='rating'?rating:kind==='recommendations'?recommendations:b30,taikoId],{cwd:paths.repoRoot,env:{...getTaikoPythonEnv(paths.repoRoot),TAIKO_USERDATA_DIR:paths.userdataDir,TAIKO_COMPUTE_ONLY:'1'},encoding:'utf8',timeout:120000,killSignal:'SIGKILL',maxBuffer:8*1024*1024});const value=JSON.parse(String(result.stdout||''));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid payload');return value;}catch{throw new ApiFailure(503,'ANALYSIS_UNAVAILABLE');}
}
export async function privateAnalysis(event:H3Event,kind:AnalysisKind,playerId:string){
 const db=await apiDb(),client=await apiClient(event,db),grant=await proveGrant(db,client,playerId,'scores:read');
 exactKeys(getQuery(event),[]);await quota(event,db,client);
 const paths=getRuntimePaths(),c=await catalog();
 const body=await withScoreRead({root:paths.userdataDir,repoRoot:paths.repoRoot,identity:grant.taikoId,now:()=>new Date().toISOString()},async()=>{
  const before=await proveGrant(db,client,playerId,'scores:read');if(before.grantId!==grant.grantId||before.revision!==grant.revision)throw new ApiFailure(403,'GRANT_REQUIRED');
  const scope=currentScoreScope(grant.taikoId);if(!scope?.lease.view||!await scope.reader.currentExists(grant.taikoId))throw new ApiFailure(503,'PUBLICATION_REQUIRED');
  const value=await compute(grant.taikoId,kind);
  const after=await proveGrant(db,client,playerId,'scores:read');if(after.grantId!==grant.grantId||after.revision!==grant.revision)throw new ApiFailure(403,'GRANT_REQUIRED');
  return {versions:versions(c.revision,`publication-v1:${scope.lease.view.sequence}:${scope.lease.view.commitId}`),playerId,...value};
 });
 const after=await proveGrant(db,client,playerId,'scores:read');if(after.grantId!==grant.grantId||after.revision!==grant.revision)throw new ApiFailure(403,'GRANT_REQUIRED');return body;
}
