import { createError } from 'h3';
import { getCurrentBindingRow } from '../../internal/account/shared';
import { getAccountDb } from '../../utils/account-db';
import { readGoalSnapshot } from './snapshot';
import { goalBaseline } from '../../../utils/playerGoal';
import { GoalConflict, readActiveGoal } from './store';
import { hasNewSyncObservation, type SyncObservation } from './sync-observation';
import { evaluateStoredGoal } from './evaluation-store';
import { withDomainScoreRead } from '../taiko-domain/publication.ts';
export async function evaluateActiveGoalForBinding(userId: number, body: Record<string,unknown>, syncBefore?: SyncObservation | null) {
  if (!body || typeof body !== 'object' || Object.keys(body).some(k=>!['profileId','expectedActiveGoalId'].includes(k)) || typeof body.profileId !== 'string' || !/^\d+$/.test(body.profileId) || typeof body.expectedActiveGoalId !== 'string' || !/^\d+$/.test(body.expectedActiveGoalId)) throw createError({statusCode:400,statusMessage:'invalid-evaluation-request'});
  const binding = await getCurrentBindingRow(userId);
  if (!binding || String(binding.id) !== body.profileId || binding.source === 'manual') throw createError({statusCode:409,statusMessage:'profile-changed'});
  try {
    const result = await withDomainScoreRead(binding.taiko_id, () => evaluateStoredGoal(getAccountDb(),userId,body.profileId as string,body.expectedActiveGoalId as string,async (goal, connection)=>{
      const snapshot = await readGoalSnapshot(binding.taiko_id, true);
      const [locks] = await connection.execute<any[]>('SELECT id FROM web_song_locks WHERE taiko_id=? AND song_no=? AND level=? AND is_locked=1 LIMIT 1',[binding.taiko_id,goal.songId,goal.difficultyType]);
      return {ownerId:userId,profileId:String(binding.id),songId:goal.songId,difficultyType:goal.difficultyType,revision:snapshot.revision,capturedAt:snapshot.capturedAt,provenance:locks.length || (syncBefore !== undefined && !hasNewSyncObservation(syncBefore, snapshot)) ? null : snapshot.provenance,state:goalBaseline(snapshot.current.songs?.find(r=>Number(r.song_no)===goal.songId&&Number(r.level)===goal.difficultyType),snapshot.revision,snapshot.capturedAt)};
    }, { taikoId: binding.taiko_id, source: binding.source }));
    return {profileId:String(binding.id),outcome:result.outcome,activeGoal:result.goal.status==='active'?result.goal:null,recentCompletedGoal:result.goal.status==='completed'?result.goal:null};
  }catch(error){if(error instanceof GoalConflict)throw createError({statusCode:409,statusMessage:'goal-conflict'});throw error;}
}

// Resolve the active ID without invoking the composite Growth/Python reader.
// The evaluator rechecks current ownership and the selected Goal under locks.
export async function evaluateCurrentGoalForBinding(userId: number, body: Record<string, unknown>, syncBefore?: SyncObservation | null) {
  if (!body || typeof body !== 'object' || Object.keys(body).some(k => k !== 'profileId') || typeof body.profileId !== 'string' || !/^\d+$/.test(body.profileId)) throw createError({ statusCode: 400, statusMessage: 'invalid-evaluation-request' });
  const binding = await getCurrentBindingRow(userId);
  if (!binding || String(binding.id) !== body.profileId || binding.source === 'manual') throw createError({ statusCode: 409, statusMessage: 'profile-changed' });
  const goal = await readActiveGoal(getAccountDb(), userId, binding.id);
  if (!goal) return { profileId: body.profileId, outcome: 'no-active-goal' as const, activeGoal: null, recentCompletedGoal: null };
  return evaluateActiveGoalForBinding(userId, { profileId: body.profileId, expectedActiveGoalId: goal.id }, syncBefore);
}
