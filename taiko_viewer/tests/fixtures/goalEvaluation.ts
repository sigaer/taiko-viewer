import { goalBaseline } from '../../utils/playerGoal.ts';
import type { GoalType } from '../../types/player-goal.ts';
import type { GoalObservation } from '../../utils/goalEvaluation.ts';
export const record = {high_score:900000,good_cnt:590,ok_cnt:2,ng_cnt:8,combo_cnt:400,clear_cnt:0,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:6};
export function fixture(type: GoalType, changes:Record<string,unknown>={}) {
  const baseline = goalBaseline(record,'a'.repeat(64),'2026-09-19T00:00:01.000Z');
  baseline.provenance = {source:'wahlap',account:'12345678',topology:'[]',marker:'20260919_080000_000000',observedAt:'2026-09-19T00:00:00.000Z',contentHash:'c'.repeat(64)};
  const goal={ownerId:1,profileId:'2',songId:3,difficultyType:4,goalType:type,baseline};
  const observation:GoalObservation={ownerId:1,profileId:'2',songId:3,difficultyType:4,revision:'b'.repeat(64),capturedAt:'2026-09-19T00:00:03.000Z',provenance:{...baseline.provenance,marker:'20260919_080002_000000',observedAt:'2026-09-19T00:00:02.000Z',contentHash:'d'.repeat(64)},state:goalBaseline({...record,...changes},'b'.repeat(64),'2026-09-19T00:00:03.000Z')};
  return {goal,observation};
}
