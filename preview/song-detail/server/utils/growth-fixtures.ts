// Deterministic synthetic inputs composed by the existing pure presenters.
// This module is only loaded by the isolated preview server.
import { buildSkillPassport } from '../../../../taiko_viewer/server/services/growth-passport/composer';
import { resolveSkillPassportRange } from '../../../../taiko_viewer/server/services/growth-passport/range';
import { buildWeeklyGrowthRecap } from '../../../../taiko_viewer/server/services/growth-weekly/composer';
import { recoveryFact as fact, recoveryMeasurement as measurement, recoveryInput } from '../../../../taiko_viewer/tests/fixtures/passportRecovery';
import { finalFlood } from '../../../../taiko_viewer/tests/fixtures/passportFinalUx';
import { extraReadonly } from './site-fixtures';
import type { PlayerGoal } from '../../../../taiko_viewer/types/player-goal';
import type { PlayerGrowthOverview } from '../../../../taiko_viewer/types/player-growth';

export function growthData(path: string, query: Record<string, any>, state: string) {
  if (!['/api/account/growth/passport', '/api/account/growth/weekly'].includes(path)) return undefined;
  const empty = state === 'growth-empty';
  const rows = (empty ? [] : state === 'growth-single' ? ['2026-10-20'] : ['2025-11-05', '2026-04-30', '2026-07-28', '2026-08-21', '2026-09-29', '2026-10-12', '2026-10-19', '2026-10-20']).map((day, i) => {
    const row = measurement(`preview-${i}`, day, { modelRevision: i < 5 ? 'synthetic-r1' : 'synthetic-r2', rating: 10.4 + i * .11, focus: i < 5 ? 'accuracy_power' : 'complex' });
    for (const key of Object.keys(row.dimensions)) row.dimensions[key] = 10.1 + i * .12;
    if (state === 'growth-missing') { row.dimensions.speed = null; if (i === 5) row.dimensions.accuracy_power = null; }
    return row;
  });
  const input = recoveryInput(empty ? [] : [...finalFlood(), ...Array.from({ length: 10 }, (_, i) => fact(`preview-strong-${i}`, 'score-pb', `2026-10-${String(i + 9).padStart(2, '0')}`, { songId: [1455, 1, 1357, 627][i % 4], title: i % 2 ? 'さいたま2000' : 'ハッピーシンセサイザ · 长标题的练习记录与这一段旋律', before: 930000, after: 950000 + i * 1300, delta: 20000 + i * 1300 }))], rows);
  input.range = resolveSkillPassportRange({ range: Number(query.range) || 90, dimension: query.dimension || 'rating' }, new Date('2026-10-21T04:00:00Z'));
  input.history.range = { from: input.range.recentFrom, to: input.range.to, maxDays: 90, timezone: 'Asia/Shanghai' };
  input.history.coverage.scoreHistoryState = ['growth-limited', 'growth-empty'].includes(state) ? 'partial' : state === 'growth-unknown' ? 'unknown' : 'complete';
  input.overview = extraReadonly('/api/account/growth/overview', {}, 'scores') as PlayerGrowthOverview;
  if (input.overview && !empty) {
    const goal: PlayerGoal = { id:'synthetic-goal', profileId:'1', songId:1455, difficultyType:4, title:'ハッピーシンセサイザ', starLevel:8, goalType:'fc', baselineVersion:1,
      baseline:{recordPresent:true,highScore:980000,goodCnt:700,okCnt:7,ngCnt:1,comboCnt:450,clearCnt:12,fullComboCnt:0,dondafulComboCnt:0,bestScoreRank:5,highscoreDatetime:null,updateDatetime:null,scoreObservedAt:null,capturedAt:'2026-10-19T04:00:00Z',sourceRevision:'synthetic-review-r1',sourceCompleteness:'partial'},
      source:'today-plan',sourceBasis:'complex',sourceMode:'dimension',sourceRank:1,sourceRevision:'synthetic-review-r1',sourceGeneratedAt:'2026-10-19T04:00:00Z',targetData:{comparison:'greater',field:'fullComboCnt',value:0},status:'active',createdAt:'2026-10-19T04:00:00Z',cancelledAt:null,unavailable:false };
    input.overview.activeGoal=goal;
    input.overview.recentCompletedGoal={...goal,id:'synthetic-completed',songId:1357,title:'ミクミクにしてあげる♪',difficultyType:5,status:'completed',completedAt:'2026-10-20T04:00:00Z'};
  }
  if (empty) input.overview = null;
  if (state === 'growth-missing' && input.overview) input.overview.playerState.skills = input.overview.playerState.skills.filter(skill => skill.key !== 'speed');
  if (path.endsWith('/passport')) return buildSkillPassport(input);
  const historical = query.week === '2026-10-12';
  const from = historical ? '2026-10-12' : '2026-10-19', to = historical ? '2026-10-18' : '2026-10-25';
  const day = historical ? '2026-10-14' : '2026-10-20';
  input.history.measurements = rows.slice(-2).map((row, i) => ({ ...row, capturedAt: `${historical ? (i ? '2026-10-18' : '2026-10-12') : (i ? '2026-10-20' : '2026-10-19')}T04:00:00Z`, modelRevision: state === 'growth-incompatible' ? `revision-${i}` : 'synthetic-r2' }));
  input.history.facts = empty || ['growth-quiet', 'growth-no-play'].includes(state) ? [] : [
    fact('week-pb', 'score-pb', day, { songId: 1455, title: 'ハッピーシンセサイザ · 长标题的练习记录与这一段旋律', before: 970000, after: 986000, delta: 16000 }),
    fact('week-fc', 'fc', day, { songId: 1357, title: 'ミクミクにしてあげる♪', before: 0, after: 1, delta: 1 }),
    fact('week-df', 'df', day, { songId: 627, title: 'さいたま2000', before: 1, after: 2, delta: 1 }),
    fact('week-rank', 'rank-upgrade', day, { songId: 1, title: '天竺2000', difficultyType: 5, before: 7, after: 8, delta: 1 }),
    fact('week-played', 'played', day, {songId: 300, title:'別の譜面', before:null, after:null, delta:null}),
    ...Array.from({length: 3}, (_, i) => fact(`week-pb-${i}`, 'score-pb', day, { songId: 1455, before: 950000 + i * 1000, after: 951000 + i * 1000, delta: 1000 }))
  ];
  if (state === 'growth-no-play') input.history.measurements = [];
  if (state === 'growth-quiet') input.history.facts = [fact('played', 'played', day, { before: null, after: null, delta: null })];
  const overview = input.overview;
  return buildWeeklyGrowthRecap(input.history, { from, to, isCompleteWeek: historical }, overview && state !== 'growth-no-next' ? { focus: 'complex', todayPlan: overview.todayPlan } : null);
}
