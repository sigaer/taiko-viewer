import {createHash} from 'node:crypto';
import {createError,getQuery,setHeader,type H3Event} from 'h3';
import {fromLegacyScore} from '@sakura-taiko/contract';
import {requireAccountUser} from '../../utils/account/auth';
import {getAccountProfile} from '../../utils/account/profile';
import {getAccountDb} from '../../utils/account-db';
import {readViewerCurrentBinding,requireViewerBindingOwner} from '../../internal/account/binding-read';
import {assertBindingIdentity,captureBindingIdentity,type BindingIdentity} from '../../internal/account/binding-identity';
import {withViewerCurrentSource} from '../account/current-source';
import {currentScoreScope} from '../taiko-domain/publication';
import {readGoalSnapshot} from '../goals/snapshot';
import {getGrowthHistory} from '../growth-history/service';
import {createGrowthScoreEvidenceRequest} from '../growth-history/evidence';
import {resolveGrowthHistoryRange} from '../growth-history/range';
import {getSongCatalog} from '../content';
import {catalog,mapCatalog,versions} from '../developer-api-v1/catalog';
import {captureMyTaikoAdmission} from './admission';
import type {MyTaikoOverview} from '../../../types/my-taiko';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(statusCode:number,statusMessage:string)=>createError({statusCode,statusMessage});

/** Session self-read. No Developer credentials, Writer, persisted response cache,
 * measurements or alternative fact projection. The private feature gate defaults off.
 */
export async function readMyTaikoOverview(event:H3Event):Promise<MyTaikoOverview>{
 setHeader(event,'cache-control','private, no-store');setHeader(event,'vary','Cookie, Authorization');
 if(useRuntimeConfig().myTaikoReadModelMode!=='allowlist')throw fail(404,'not-found');
 if(Object.keys(getQuery(event)).length)throw fail(400,'unsupported-query');
 const user=await requireAccountUser(event);
 const admission=await captureMyTaikoAdmission(user.id);if(!admission)throw fail(404,'not-found');
 let expected:BindingIdentity|undefined;
 try{
  const result=await withViewerCurrentSource(user.id,'read',async binding=>{
   if(!binding)throw fail(400,'binding-required');
   expected=captureBindingIdentity(binding);
   const scope=currentScoreScope(binding.taiko_id);
   if(!scope?.lease.view)throw fail(503,'publication-required');
   const publication=scope.lease.view,original=scope.reader;
   let current:ReturnType<typeof original.readCurrent>|undefined,physicalCurrentReads=0;
   // Never retain this memo beyond this request's already authorized ALS scope.
   scope.reader={...original,readCurrent:identity=>{
    if(identity!==binding.taiko_id)throw fail(403,'binding-changed');
    if(!current){physicalCurrentReads++;current=original.readCurrent(identity);}return current;
   }};
   try{
    const sourceCatalog=await catalog();
    const profile=await getAccountProfile(user.id),snapshot=await readGoalSnapshot(binding.taiko_id),legacy=await getSongCatalog();
    if(hash(mapCatalog(legacy,sourceCatalog.revision))!==hash({songs:sourceCatalog.songs,charts:sourceCatalog.charts}))throw fail(409,'catalog-source-mismatch');
    if(!Array.isArray(snapshot.current.songs)||snapshot.current.songs.length>20000)throw fail(503,'bounded-read-required');
    const source=typeof snapshot.current._meta?.source==='string'?snapshot.current._meta.source:null;
    const authoritySource=source==='manual-score'?'manual':source;
    if(authoritySource&&['wahlap','hiroba','manual'].includes(authoritySource)&&authoritySource!==binding.source)throw fail(409,'source-mismatch');
    const scoreRevision=`publication-v1:${publication.sequence}:${publication.commitId}`;
    const summary={rows:0,scored:0,cleared:0,clearUnknown:0,highestScore:null as number|null};
    // Contract owns every number/unknown conversion; this is only a summary.
    for(const record of snapshot.current.songs){
     const score=fromLegacyScore(record,{source:source||'unknown',capturedAt:null});
     summary.rows++;if(score.score!==null){summary.scored++;summary.highestScore=Math.max(summary.highestScore??score.score,score.score);}
     if(score.clear===true)summary.cleared++;if(score.clear===null)summary.clearUnknown++;
    }
    const growth=await getGrowthHistory(user.id,resolveGrowthHistoryRange({days:90}),{
     includeMeasurements:false,loadScoreEvidence:createGrowthScoreEvidenceRequest(binding.taiko_id)
    });
    if((await catalog()).revision!==sourceCatalog.revision||hash(await getSongCatalog())!==hash(legacy))throw fail(409,'catalog-changed');
    const counts:Partial<Record<MyTaikoOverview['growth']['recentFacts'][number]['type'],number>>={};
    for(const fact of growth.facts){
     if(fact.ownerId!==String(user.id)||fact.bindingId!==String(binding.id))throw fail(409,'fact-owner-mismatch');
     counts[fact.type]=(counts[fact.type]||0)+1;
    }
    const result:MyTaikoOverview={
     release:{...versions(sourceCatalog.revision,scoreRevision,source,null),catalogRevisionProfile:'developer-api-v1-source-bytes',legacyCatalogRevision:'legacy-projection-sha256:'+hash(legacy),bindingSource:binding.source},
     profile:{username:profile.user.username,bindingId:String(binding.id),taikoId:binding.taiko_id,currentTitle:profile.currentBinding?.currentTitle??null,
      bindings:profile.bindings.map(b=>({bindingId:String(b.id),label:b.displayName||b.taikoId,isCurrent:String(b.id)===String(binding.id)}))},
     scores:summary,
     growth:{range:growth.range,coverage:growth.coverage,totalFacts:growth.facts.length,counts,recentFacts:growth.facts.slice(-8).reverse(),recentFactsLimit:8,hasMoreFacts:growth.facts.length>8},
     recommendation:{href:'/tools/recommend',state:'ENTRY_ONLY',bindingId:String(binding.id),scoreRevision},
     diagnostics:{physicalCurrentReads,measurements:'NOT_REQUESTED',historyMeaning:'CANONICAL_FACTS_NOT_SYNCHRONIZATION_PLAY_EVENTS'}
    };
    if(Buffer.byteLength(JSON.stringify(result))>8*1024*1024)throw fail(503,'bounded-read-required');
    return result;
   }finally{scope.reader=original;}
  });
  // The SH worker has now closed. Prove session + owner + current source again
  // before returning any private body, independently of ETag (none is emitted).
  const fresh=await requireAccountUser(event);if(fresh.id!==user.id)throw fail(401,'session-changed');
  const db=getAccountDb();await requireViewerBindingOwner(db,user.id);
  assertBindingIdentity(expected!,await readViewerCurrentBinding(db,user.id));
  if((await catalog()).revision!==result.release.catalogRevision)throw fail(409,'catalog-changed');
  const currentAdmission=await captureMyTaikoAdmission(user.id);
  if(!currentAdmission||currentAdmission.revision!==admission.revision)throw fail(404,'not-found');
  return result;
 }catch(error){
  // Never expose driver data, worker paths or malformed source contents.
  const code=error&&typeof error==='object'&&'statusCode' in error?Number(error.statusCode):503;
  const message=error&&typeof error==='object'&&'statusMessage' in error?String(error.statusMessage):'read-unavailable';
  throw fail([400,401,403,404,409,503,504].includes(code)?code:503,message);
 }
}
