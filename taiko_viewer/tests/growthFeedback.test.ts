import test from 'node:test';
import assert from 'node:assert/strict';
import {composeGrowthFeedback} from '../utils/composeGrowthFeedback.ts';
import type {PlayerGoal} from '../types/player-goal';
import type {GrowthDailyProgress, GrowthEventFact} from '../types/player-growth';
const daily=(facts:GrowthEventFact[],songId=1,level=3):GrowthDailyProgress=>({calendarDay:'2026-09-19',dataMode:'FULL_HISTORY',attendance:'played',uniqueCharts:1,events:[{songId,level,title:'Song',occurredAt:'2026-09-19',evidence:'history',importance:1,facts}]});
const fact=(type:GrowthEventFact['type'],before:number,after:number):GrowthEventFact=>({type,before,after,delta:after-before});
const goal=(type:string,before:number,after:number,facts={},counts=[0,0,0])=>({status:'completed',songId:1,difficultyType:3,baseline:{clearCnt:counts[0],fullComboCnt:counts[1],dondafulComboCnt:counts[2]},completionEvidence:{result:{goalType:type,before,after,facts}}}) as PlayerGoal;
for(const type of ['score-pb','ng-reduced','rank-upgrade'] as const)test(`${type}: exact fact only, immutable DTO`,()=>{
 const g=goal(type,8,4);const d=daily([fact(type,8,4),fact(type,9,4),fact('combo-improved',1,2)]);const before=JSON.stringify(d);
 const p=composeGrowthFeedback(g,d);assert.equal(p.dailyProgress.events[0].facts.length,2);assert.equal(JSON.stringify(d),before);
 assert.equal(composeGrowthFeedback(g,daily([fact(type,8,4)],2)).dailyProgress.events.length,1);
 assert.equal(composeGrowthFeedback(g,daily([fact(type,8,4)],1,4)).dailyProgress.events.length,1);
});
for(const [target,actual,counts,evidence] of [['clear','fc',[0,0,0],{clearCnt:0,fullComboCnt:1,dondafulComboCnt:0}],['fc','df',[1,0,0],{fullComboCnt:0,dondafulComboCnt:1}]] as const)test(`${target} completed by ${actual}: normalized crown, extra facts retained`,()=>{
 const before=target==='clear'?-1:0,after=actual==='fc'?1:2;
 const d=daily([fact(actual,before,after),fact('score-pb',900000,907130),fact('ng-reduced',8,0)]);
 const p=composeGrowthFeedback(goal(target,0,1,evidence,[...counts]),d);
 assert.equal(p.goalType,actual);assert.deepEqual(p.dailyProgress.events[0].facts.map(f=>f.type),['score-pb','ng-reduced']);
 assert.equal(composeGrowthFeedback(goal(target,0,1,evidence,[...counts]),daily([fact(actual,before+1,after)])).dailyProgress.events.length,1);
});
test('no evidence never invents higher crowns or today attribution',()=>{
 const d=daily([fact('fc',-1,1)]);assert.equal(composeGrowthFeedback(goal('clear',0,1),d).dailyProgress.events.length,1);
 assert.equal(composeGrowthFeedback(null,d).dailyProgress,d);
});
