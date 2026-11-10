import { buildSkillPassport } from '../../server/services/growth-passport/composer.ts';
import { finalBrowserInput } from '../../tests/fixtures/passportFinalUx.ts';

const passport = buildSkillPassport(finalBrowserInput('normal'));

export const user = { id: 990071, username: 'Navigation QA', email: 'navigation@example.test', emailVerified: true, avatarUrl: '', annualSummaryAccess: false };
export const binding = id => ({ id, taikoId: String(id), isCurrent: true, verifiedTitle: null, source: 'manual', displayName: `QA ${id}`, isManual: true, canExternalSync: false });
export function responseFor(url, identity) {
  const currentBinding = binding(identity);
  if (url.pathname.startsWith('/api/content/guide/')) return { difficulty: 4, difficultyLabel: '', level: 9, tags: [], summary: { overPlus: 0, over: 0, strong: 0, middle: 0, weak: 0, under: 0, underMinus: 0, total: 0 } };
  switch (url.pathname) {
    case '/api/account/auth/me': return { authenticated: true, user };
    case '/api/account/bindings': return { bindings: [currentBinding], currentBinding };
    case '/api/content/songs': return { songs: Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, song_name: `QA Song ${i + 1}`, type: 'ゲームミュージック', max_combo: [100, 200, 300, 600], level_4: 9 })) };
    case '/api/account/songs': return { currentBinding, total: 2000, page: Number(url.searchParams.get('page') || 1), pageSize: 25, items: Array.from({ length: 25 }, (_, i) => ({ songNo: i + 1, title: `QA ${identity} Song ${i + 1}`, level: 4, levelLabel: '鬼', highScore: 900000, bestScoreRank: 5, isCustom: false, isLocked: false, goodCnt: 580, okCnt: 15, ngCnt: 5, poundCnt: 10, comboCnt: 550, stageCnt: 2, clearCnt: 2, fullComboCnt: 0, dondafulComboCnt: 0, maxCombo: 600, starLevel: 9, updateDatetime: '2026-11-01 12:00:00' })) };
    case '/api/account/growth/passport': return { ...passport, range: { ...passport.range, requestedDays: Number(url.searchParams.get('range') || 90) }, profileId: String(identity) };
    case '/api/account/growth/weekly': return {
      profileId: String(identity), week: { from: '2026-11-02', to: '2026-11-08', timezone: 'Asia/Shanghai', isCompleteWeek: true },
      coverage: { scoreHistoryState: 'complete', measurementState: 'partial' },
      theme: { type: 'quiet', confidence: 'high', evidenceFactKeys: [], evidenceMeasurementIds: [] }, highlights: [],
      measurementChange: { start: null, end: null, compatible: false, reason: 'insufficient', ratingDelta: null, focusFrom: null, focusTo: null },
      totals: { distinctCharts: 0, pb: 0, fc: 0, df: 0, rankUpgrade: 0, completedGoals: 0 }, currentNextAction: null
    };
    default: return {};
  }
}
