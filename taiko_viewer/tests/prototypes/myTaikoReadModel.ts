/** Isolated integration prototype. No production route imports this module.
 * Uses existing owner authority, ReadView, canonical Catalog adapter and Growth projector.
 * This remains a candidate experiment until explicit Owner freeze approval.
 */
import {createHash} from 'node:crypto';
import {createError,getQuery,setHeader,type H3Event} from 'h3';
import {requireAccountUser} from '../../server/utils/account/auth.ts';
import {getAccountProfile} from '../../server/utils/account/profile.ts';
import {withViewerCurrentSource} from '../../server/services/account/current-source.ts';
import {currentScoreScope} from '../../server/services/taiko-domain/publication.ts';
import {readGoalSnapshot} from '../../server/services/goals/snapshot.ts';
import {getGrowthHistory} from '../../server/services/growth-history/service.ts';
import {resolveGrowthHistoryRange,type GrowthHistoryRange} from '../../server/services/growth-history/range.ts';
import {getSongCatalog} from '../../server/services/content';
import {catalog as readDeveloperCatalog,mapCatalog} from '../../server/services/developer-api-v1/catalog.ts';
import {fromLegacyScore} from '@sakura-taiko/contract';
import schema from '@sakura-taiko/contract/schema' with {type:'json'};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function myTaikoReadModel(event:H3Event,options:{range?:GrowthHistoryRange}={}){
 setHeader(event,'cache-control','private, no-store');setHeader(event,'vary','Cookie, Authorization');
 if(Object.keys(getQuery(event)).length)throw createError({statusCode:400,statusMessage:'unsupported-query'});
 const user=await requireAccountUser(event);
 return withViewerCurrentSource(user.id,'read',async binding=>{
  if(!binding)throw createError({statusCode:400,statusMessage:'binding-required'});
  const scope=currentScoreScope(binding.taiko_id)!;
  if(!scope.lease.view)throw createError({statusCode:503,statusMessage:'publication-required'});
  const original=scope.reader;let current:ReturnType<typeof original.readCurrent>|undefined,physicalCurrentReads=0;
  // Request-local memo on this already-authorized ALS scope, discarded before the lease closes.
  scope.reader={...original,readCurrent:identity=>{
   if(identity!==binding.taiko_id)throw createError({statusCode:403,statusMessage:'binding-changed'});
   if(!current){physicalCurrentReads++;current=original.readCurrent(identity);}return current;
  }};
  try{
   const sourceCatalog=await readDeveloperCatalog();
   const profile=await getAccountProfile(user.id),snapshot=await readGoalSnapshot(binding.taiko_id),catalog=await getSongCatalog();
   const canonicalProjection={songs:sourceCatalog.songs,charts:sourceCatalog.charts};
   if(hash(mapCatalog(catalog,sourceCatalog.revision))!==hash(canonicalProjection))throw createError({statusCode:409,statusMessage:'catalog-source-mismatch'});
   if(!Array.isArray(snapshot.current.songs)||snapshot.current.songs.length>20000)throw createError({statusCode:503,statusMessage:'bounded-read-required'});
   // Delegate all facts to the existing service. No alternate replay, Writer or measurements.
   const range=options.range||resolveGrowthHistoryRange({days:90});
   const growth=await getGrowthHistory(user.id,range,{includeMeasurements:false});
   // Revalidation is explicit: the old mtime cache may not claim a new source-byte revision.
   const revalidatedCatalog=await readDeveloperCatalog();
   if(revalidatedCatalog.revision!==sourceCatalog.revision||hash(await getSongCatalog())!==hash(catalog))throw createError({statusCode:409,statusMessage:'catalog-changed'});
   const publication=scope.lease.view;
   const release={schemaRevision:hash(schema),catalogRevision:sourceCatalog.revision,catalogRevisionProfile:'developer-api-v1-source-bytes',legacyCatalogRevision:'legacy-projection-sha256:'+hash(catalog),scoreRevision:`publication-v1:${publication.sequence}:${publication.commitId}`,calculationProfile:null,source:typeof snapshot.current._meta?.source==='string'?snapshot.current._meta.source:null,bindingSource:binding.source,legacyScoreRevision:snapshot.revision};
   const scores=snapshot.current.songs.map(record=>{const {legacy,...score}=fromLegacyScore(record,{source:binding.source,capturedAt:null});return score;});
   const fresh=await requireAccountUser(event);if(fresh.id!==user.id)throw createError({statusCode:401,statusMessage:'session-changed'});
   // A recommendation entry, not recomputed recommendations or a frozen algorithm claim.
   const result={release,profile:{bindingId:String(binding.id),currentTitle:profile.currentBinding?.currentTitle??null},scores,growth,recommendation:{href:'/tools/recommend',bindingId:String(binding.id),scoreRevision:release.scoreRevision,state:'ENTRY_ONLY'},diagnostics:{physicalCurrentReads,historyMeaning:'C/H observations and Canonical Facts; not play events',measurements:'NOT_REQUESTED'}};
   if(Buffer.byteLength(JSON.stringify(result))>8*1024*1024)throw createError({statusCode:503,statusMessage:'bounded-read-required'});
   return result;
  }finally{scope.reader=original;}
 });
}
