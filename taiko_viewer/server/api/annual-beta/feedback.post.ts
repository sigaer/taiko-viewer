import { stat } from 'node:fs/promises';
import { getUserdataPath } from '~/server/internal/account/shared';
import { findAnnualBinding } from '~/server/services/account/annual-summary/repository';
import { randomUUID } from 'node:crypto';
import {readBody,createError} from 'h3';
import {requireAccountAnnualSummaryUser} from '~/server/services/account/annual-summary/access';
import {findOwnerAnnualSummary} from '~/server/services/account/annual-summary/repository';
import {readAnnualSummary} from '~/server/services/account/annual-summary/runtime';
import {getAccountDb} from '~/server/utils/account-db';
import {assertBetaOrigin,betaRate,betaContext,recordBetaEventSafely} from '~/server/services/annual-beta/events';
import {ANNUAL_ALGORITHM_VERSION} from '~/server/services/account/annual-summary/constants';
import pkg from '../../../package.json';
const categories=new Set(['number','song_chart','dan','time','missing','subjective_copy','other']);
const slides=new Set(['opening','period','overview','favorite','obsession','favoriteShift','keyword','ratingRank','monthly','weekday','calendar','timeOfDay','lateNight','speedProfile','nearDondaful','challenge','pound','highScore','milestones','final','poster']);
const clean=(x:unknown,max=1000)=>typeof x==='string'?x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,max):'';
export default defineEventHandler(async event=>{
 assertBetaOrigin(event);betaRate(event,'invite');const user=await requireAccountAnnualSummaryUser(event);const ctx=await betaContext(event,user.id);const body=await readBody(event);
 if(!['issue','survey'].includes(body?.kind))throw createError({statusCode:400,statusMessage:'Invalid feedback'});
 let summary:any=null;let row:any=null;
 if(body.summaryId){row=await findOwnerAnnualSummary(String(body.summaryId),user.id);if(!row)throw createError({statusCode:404,statusMessage:'报告不存在'});summary=await readAnnualSummary(row.summary_path);}
 if(body.kind==='issue'&&(!categories.has(body.category)||!summary))throw createError({statusCode:400,statusMessage:'请选择问题类型和报告'});
 const answers:Record<string,unknown>={};
 if(body.kind==='issue'){answers.expected_value=clean(body.expectedValue,300);answers.comment=clean(body.comment);if(!answers.comment&&!answers.expected_value)throw createError({statusCode:400,statusMessage:'请补充问题说明'});}
 else{
  for(const key of ['start','auth','binding','incorrect','suspectPage','memorablePage','share'])answers[key]=clean(body.answers?.[key],300);
  const score=Number(body.answers?.resembles);if(!Number.isInteger(score)||score<1||score>5)throw createError({statusCode:400,statusMessage:'请选择 1–5 分'});answers.resembles=score;
 }
 const slide=slides.has(body.slideKey)?body.slideKey:'opening';
 const binding=row?await findAnnualBinding(row.binding_id,user.id):null;
 const dataUpdatedAt=binding?await stat(getUserdataPath(binding.taiko_id)).then(value=>value.mtime.toISOString()).catch(()=>null):null;
 const context={participant_id:ctx.participantId,user_id:user.id,summary_id:summary?.summaryId||null,algorithm_version:summary?.provenance?.algorithmVersion||ANNUAL_ALGORITHM_VERSION,app_version:pkg.version,locale:ctx.locale,slide_key:slide,data_updated_at:dataUpdatedAt,metric_key:slide==='final'?'finalTitle':null,displayed_value:slide==='final'?{titleKey:summary?.finalTitle?.titleKey,standingKey:summary?.finalTitle?.standingPresentation?.titleKey||null}:null};
 const id=randomUUID();await getAccountDb().execute('INSERT INTO web_beta_feedback (id,participant_id,user_id,kind,category,summary_id,context_json,answers_json) VALUES (?,?,?,?,?,?,?,?)',[id,ctx.participantId,user.id,body.kind,body.kind==='issue'?body.category:null,summary?.summaryId||null,JSON.stringify(context),JSON.stringify(answers)]);
 await recordBetaEventSafely(ctx,body.kind==='issue'?'annual_data_issue_submit':'annual_feedback_submit');return {ok:true,id};
});
