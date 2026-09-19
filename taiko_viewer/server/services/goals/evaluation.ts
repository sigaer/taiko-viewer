import { createError } from 'h3';
import { getCurrentBindingRow } from '../../internal/account/shared';
import { getAccountDb } from '../../utils/account-db';
import { readGoalSnapshot } from './snapshot';
import { goalBaseline } from '../../../utils/playerGoal';
import { GoalConflict } from './store';
import { evaluateStoredGoal } from './evaluation-store';
export async function evaluateActiveGoalForBinding(userId: number, body: Record<string,unknown>) {
  if (!body || typeof body !== 'object' || Object.keys(body).some(k=>!['profileId','expectedActiveGoalId'].includes(k)) || typeof body.profileId !== 'string' || !/^\d+$/.test(body.profileId) || typeof body.expectedActiveGoalId !== 'string' || !/^\d+$/.test(body.expectedActiveGoalId)) throw createError({statusCode:400,statusMessage:'invalid-evaluation-request'});
  const binding = await getCurrentBindingRow(userId);
  if (!binding || String(binding.id) !== body.profileId || binding.source === 'manual') throw createError({statusCode:409,statusMessage:'profile-changed'});
  try {
    const result = await evaluateStoredGoal(getAccountDb(),userId,body.profileId,body.expectedActiveGoalId,async (goal, connection)=>{
      const snapshot = await readGoalSnapshot(binding.taiko_id, true);
      const [locks] = await connection.execute<any[]>('SELECT id FROM web_song_locks WHERE taiko_id=? AND song_no=? AND level=? AND is_locked=1 LIMIT 1',[binding.taiko_id,goal.songId,goal.difficultyType]);
      return {ownerId:userId,profileId:String(binding.id),songId:goal.songId,difficultyType:goal.difficultyType,revision:snapshot.revision,capturedAt:snapshot.capturedAt,provenance:locks.length ? null : snapshot.provenance,state:goalBaseline(snapshot.current.songs?.find(r=>Number(r.song_no)===goal.songId&&Number(r.level)===goal.difficultyType),snapshot.revision,snapshot.capturedAt)};
    });
    return {profileId:String(binding.id),outcome:result.outcome,activeGoal:result.goal.status==='active'?result.goal:null,recentCompletedGoal:result.goal.status==='completed'?result.goal:null};
  }catch(error){if(error instanceof GoalConflict)throw createError({statusCode:409,statusMessage:'goal-conflict'});throw error;}
}
