import { createError } from 'h3';
import { getCurrentBindingRow } from '../../internal/account/shared';
import { getAccountDb } from '../../utils/account-db';
import { getPlayerGrowthOverview } from '../account/growth';
import { getSongCatalog } from '../content';
import { goalBaseline, goalOptions, goalTarget, goalChartAvailable } from '../../../utils/playerGoal';
import { GoalConflict, mutateGoal } from './store';
import { readGoalSnapshot } from './snapshot';
import type { GoalType } from '../../../types/player-goal';

export async function writePlayerGoal(userId: number, body: Record<string, unknown>, cancel = false) {
  const started = performance.now();
  const allowed = cancel ? ['profileId', 'expectedActiveGoalId'] : ['profileId', 'expectedActiveGoalId', 'songId', 'difficultyType', 'goalType', 'scoreRevision'];
  if (!body || typeof body !== 'object' || Object.keys(body).some(k => !allowed.includes(k)) || typeof body.profileId !== 'string' || !/^\d+$/.test(body.profileId) || !(body.expectedActiveGoalId === null || (typeof body.expectedActiveGoalId === 'string' && /^\d+$/.test(body.expectedActiveGoalId)))) throw createError({ statusCode: 400, statusMessage: 'invalid-goal-request' });
  const binding = await getCurrentBindingRow(userId);
  if (!binding || String(binding.id) !== body.profileId) throw createError({ statusCode: 409, statusMessage: 'profile-changed' });
  if (!cancel && binding.source === 'manual') throw createError({ statusCode: 400, statusMessage: 'goal-unavailable' });
  try {
    if (cancel) return { activeGoal: await mutateGoal(getAccountDb(), userId, body.profileId, body.expectedActiveGoalId as string | null, null), profileId: body.profileId };
    if (!Number.isSafeInteger(body.songId) || !Number.isInteger(body.difficultyType) || typeof body.goalType !== 'string' || typeof body.scoreRevision !== 'string') throw createError({ statusCode: 400, statusMessage: 'invalid-goal-request' });
    const overview = await getPlayerGrowthOverview(userId);
    if (overview.profileId !== body.profileId) throw new GoalConflict('profile-changed');
    const index = overview.todayPlan.items.findIndex(item => item.songId === body.songId && item.difficultyType === body.difficultyType);

    const activeGoal = await mutateGoal(getAccountDb(), userId, body.profileId, body.expectedActiveGoalId as string | null, async (active, connection) => {
      if (active && active.songId === body.songId && active.difficultyType === body.difficultyType && active.goalType === body.goalType) return active;
      if (index < 0 || overview.scoreRevision !== body.scoreRevision) throw new GoalConflict('stale-plan');
      const item = overview.todayPlan.items[index];
      const [snapshot, catalog] = await Promise.all([readGoalSnapshot(binding.taiko_id, true), getSongCatalog()]);
      if (snapshot.revision !== overview.scoreRevision) throw new GoalConflict('score-changed');
      const available = goalChartAvailable(catalog.find(song => Number(song.id) === item.songId), item.difficultyType);
      const baseline = goalBaseline(snapshot.current.songs?.find(row => Number(row.song_no) === item.songId && Number(row.level) === item.difficultyType), snapshot.revision, snapshot.capturedAt);
      const [locks] = await connection.execute<any[]>('SELECT id FROM web_song_locks WHERE taiko_id=? AND song_no=? AND level=? AND is_locked=1 LIMIT 1',[binding.taiko_id,item.songId,item.difficultyType]);
      baseline.provenance = locks.length ? null : snapshot.provenance;
      const type = body.goalType as GoalType;
      if (!goalOptions(baseline, binding.source, available).includes(type)) throw createError({ statusCode: 400, statusMessage: 'goal-unavailable' });
      return { profileId: String(binding.id), songId: item.songId, difficultyType: item.difficultyType, title: item.title, starLevel: item.starLevel, goalType: type, baselineVersion: 1, baseline, source: 'today-plan', sourceBasis: item.targetDimension, sourceMode: item.reason === 'general-fallback' ? 'general-fallback' : 'dimension', sourceRank: index + 1, sourceRevision: overview.scoreRevision!, sourceGeneratedAt: overview.sourceGeneratedAt!, targetData: goalTarget(type), status: 'active', createdAt: '', cancelledAt: null, unavailable: false };
    });
    return { activeGoal, profileId: String(binding.id) };
  } catch (error) {
    if (error instanceof GoalConflict || (error as { code?: string })?.code === 'ER_DUP_ENTRY') throw createError({ statusCode: 409, statusMessage: 'goal-conflict' });
    throw error;
  } finally { console.info('[player-goal] mutation', { durationMs: Math.round(performance.now() - started), cancel }); }
}
