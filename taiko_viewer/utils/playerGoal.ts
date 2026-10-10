import type { GoalBaseline, GoalType, PlayerGoal } from '../types/player-goal.ts';
import { legacyScoreReader, legacyScoreInstant } from '@sakura-taiko/contract';
const integer = legacyScoreReader('viewer-goal-v1');
export function goalBaseline(record: Record<string, unknown> | undefined, revision: string, capturedAt: string, completeness: GoalBaseline['sourceCompleteness'] = 'unknown'): GoalBaseline {
  const r = record || {};
  const date = (v: unknown) => legacyScoreInstant(v, 'viewer-goal-v1');
  return { recordPresent: !!record, highScore: integer(r.high_score), goodCnt: integer(r.good_cnt), okCnt: integer(r.ok_cnt), ngCnt: integer(r.ng_cnt), comboCnt: integer(r.combo_cnt), clearCnt: integer(r.clear_cnt), fullComboCnt: integer(r.full_combo_cnt), dondafulComboCnt: integer(r.dondaful_combo_cnt), bestScoreRank: integer(r.best_score_rank), highscoreDatetime: date(r.highscore_datetime), updateDatetime: date(r.update_datetime), scoreObservedAt: null, capturedAt, sourceRevision: revision, sourceCompleteness: completeness };
}
export function goalOptions(b: GoalBaseline, source: string, available = true): GoalType[] {
  if (source === 'manual' || !available) return [];
  if (!b.recordPresent) return b.sourceCompleteness === 'complete' ? ['played', 'clear'] : [];
  const options: GoalType[] = [];
  if (b.highScore !== null) options.push('score-pb');
  if (b.goodCnt !== null && b.okCnt !== null && b.ngCnt !== null && b.ngCnt > 0 && b.goodCnt + b.okCnt + b.ngCnt > 0) options.push('ng-reduced');
  if ([b.clearCnt, b.fullComboCnt, b.dondafulComboCnt].every(v => v !== null)) {
    if (!b.clearCnt && !b.fullComboCnt && !b.dondafulComboCnt) options.push('clear');
    if (!b.fullComboCnt && !b.dondafulComboCnt) options.push('fc');
    if (!b.dondafulComboCnt) options.push('df');
  }
  if (b.bestScoreRank !== null && b.bestScoreRank >= 1 && b.bestScoreRank < 8) options.push('rank-upgrade');
  return options;
}
export function goalTarget(type: GoalType): PlayerGoal['targetData'] {
  const fields = { 'score-pb': 'highScore', 'ng-reduced': 'ngCnt', clear: 'clearCnt', fc: 'fullComboCnt', df: 'dondafulComboCnt', 'rank-upgrade': 'bestScoreRank', played: 'recordPresent' };
  return { comparison: type === 'played' ? 'present' : type === 'ng-reduced' ? 'less' : 'greater', field: fields[type], ...(['clear', 'fc', 'df'].includes(type) ? { value: 0 } : {}) };
}
export function goalChartAvailable(song: { shelf_status?: unknown; [key: string]: unknown } | undefined, difficulty: number): boolean {
  return !!song && Number(song.shelf_status || 0) === 0 && Number(song[`level_${difficulty}`]) > 0;
}
