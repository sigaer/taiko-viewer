// Executes production service validation with bounded, synthetic authoritative inputs.
// Storage tests separately exercise the production SQL store against the isolated DB.
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {goalBaseline,goalOptions} from '../../utils/playerGoal.ts';
const root=new URL('../../',import.meta.url);
const data=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
export async function goalServiceHarness(){
 const hook='__goalFixture_'+randomUUID().replaceAll('-','_');
 const row={song_no:100,level:4,high_score:900000,good_cnt:400,ok_cnt:20,ng_cnt:8,clear_cnt:0,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:4};
 const state={binding:{id:1,taiko_id:'fixture',source:'wahlap'},revision:'revision',row,catalog:[{id:100,level_4:9,shelf_status:0},{id:101,level_4:9,shelf_status:0}],active:null,serial:0,basis:'accuracy_power',fallback:false,plan:[100,101]};
 state.overview=()=>({profileId:String(state.binding.id),scoreRevision:state.revision,sourceGeneratedAt:'2026-09-19T00:00:00Z',todayPlan:{items:state.plan.map(songId=>({songId,difficultyType:4,title:`Song ${songId}`,starLevel:9,targetDimension:state.basis,reason:state.fallback?'general-fallback':'target-dimension',goalOptions:goalOptions(goalBaseline(state.row,state.revision,'now'),state.binding.source)}))}});
 globalThis[hook]=state;
 const get=`const s=globalThis.${hook};`;
 const shared=data(get+`export const getCurrentBindingRow=async()=>s.binding;`);
 const db=data(`export const getAccountDb=()=>({execute:async()=>[[]]});`);
 const growth=data(get+`export const getPlayerGrowthOverview=async()=>s.overview();`);
 const catalog=data(get+`export const getSongCatalog=async()=>s.catalog;`);
 const snapshot=data(get+`export const readGoalSnapshot=async()=>({revision:s.revision,current:{songs:s.row?[s.row]:[]},capturedAt:new Date().toISOString()});`);
 const publication=data(`export const withDomainScoreRead=async(identity,task)=>task();`);
 const store=data(get+`export class GoalConflict extends Error{};export async function mutateGoal(db,user,profile,expected,prepare){if(String(s.binding.id)!==profile)throw new GoalConflict();if(expected!==null&&(s.active?.id||null)!==expected)throw new GoalConflict();const next=prepare?await prepare(s.active,db):null;if(s.active&&next&&s.active.songId===next.songId&&s.active.goalType===next.goalType)return s.active;if((s.active?.id||null)!==expected)throw new GoalConflict();s.active=next?{...next,id:String(++s.serial),createdAt:new Date().toISOString()}:null;return s.active}`);
 const imports={'../growth-history/model-revision':data('export const getGrowthModelRevision=async()=>"fixture";'),'../../internal/account/shared':shared,'../../utils/account-db':db,'../account/growth':growth,'../content':catalog,'../../../utils/playerGoal':new URL('utils/playerGoal.ts',root).href,'./store':store,'./snapshot':snapshot,'../taiko-domain/publication.ts':publication,'h3':import.meta.resolve('h3')};
 let code=ts.transpileModule(await readFile(new URL('server/services/goals/service.ts',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replace(/from ['"]([^'"]+)['"]/g,(_,name)=>{if(!imports[name])throw Error(`Unknown dependency ${name}`);return `from ${JSON.stringify(imports[name])}`});
 const service=await import(data(code));
 return {state,write:service.writePlayerGoal,cleanup:()=>delete globalThis[hook]};
}
