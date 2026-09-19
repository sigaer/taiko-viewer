import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { PlayerGoal } from '../../../types/player-goal.ts';
import { evaluateGoal, type GoalObservation } from '../../../utils/goalEvaluation.ts';
import { GoalConflict } from './store.ts';
export async function readRecentCompletedGoal(db: Pick<Pool,'execute'>, userId: number, bindingId: number): Promise<PlayerGoal | null> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT g.id,g.status,g.goal_data FROM web_player_goals g JOIN web_taiko_bindings b ON b.id=g.binding_id AND b.user_id=g.user_id JOIN web_user_accounts u ON u.id=g.user_id WHERE g.user_id=? AND g.binding_id=? ORDER BY g.id DESC LIMIT 1',[userId,bindingId]);
  return rows[0]?.status === 'completed' ? {...JSON.parse(rows[0].goal_data),id:String(rows[0].id)} : null;
}
export async function evaluateStoredGoal(db: Pool, userId: number, profileId: string, expectedId: string, observe: (goal: PlayerGoal, connection: PoolConnection) => Promise<GoalObservation>) {
  const connection = await db.getConnection(); const started = performance.now();
  try {
    await connection.beginTransaction();
    const [owners] = await connection.execute<RowDataPacket[]>('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE',[userId]);
    const [bindings] = await connection.execute<RowDataPacket[]>('SELECT id,source FROM web_taiko_bindings WHERE user_id=? ORDER BY is_current DESC,id ASC FOR UPDATE',[userId]);
    if (!owners.length || String(bindings[0]?.id) !== profileId || bindings[0]?.source === 'manual') throw new GoalConflict('profile-changed');
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT id,status,goal_data FROM web_player_goals WHERE id=? AND user_id=? AND binding_id=? FOR UPDATE',[expectedId,userId,profileId]);
    if (!rows.length || rows[0].status === 'cancelled') throw new GoalConflict('goal-changed');
    const goal: PlayerGoal = {...JSON.parse(rows[0].goal_data),id:String(rows[0].id)};
    if (rows[0].status === 'completed') {
      const [latest] = await connection.execute<RowDataPacket[]>('SELECT id FROM web_player_goals WHERE user_id=? AND binding_id=? ORDER BY id DESC LIMIT 1',[userId,profileId]);
      if (String(latest[0]?.id) !== expectedId) throw new GoalConflict('goal-changed');
      await connection.commit();return {outcome:'completed' as const,goal};
    }
    if (goal.baselineVersion !== 1) { await connection.commit(); return {outcome:'inconclusive' as const,goal}; }
    const observation = await observe(goal, connection);
    const result = evaluateGoal({...goal,ownerId:userId},observation);
    if (result.outcome !== 'completed') {await connection.commit();console.info(`[goal-eval] ${result.outcome === 'active' ? 'unchanged' : 'inconclusive'}`,{reason:result.reason,durationMs:Math.round(performance.now()-started)});return {outcome:result.outcome,goal};}
    const now = new Date().toISOString();const sqlTime=now.replace('T',' ').replace('Z','');
    const completed: PlayerGoal = {...goal,status:'completed',completedAt:now,completionEvidence:{evaluationVersion:1,evaluatedAt:now,observationCapturedAt:observation.capturedAt,observationRevision:observation.revision,baselineRevision:goal.baseline.sourceRevision,source:observation.provenance!.source,provenance:observation.provenance!,result:result.result!}};
    const [updated] = await connection.execute<any>("UPDATE web_player_goals SET status='completed',completed_at=?,updated_at=?,goal_data=? WHERE id=? AND status='active'",[sqlTime,sqlTime,JSON.stringify(completed),goal.id]);
    if (updated.affectedRows !== 1) throw new GoalConflict('goal-changed');
    await connection.commit();console.info('[goal-eval] completed',{durationMs:Math.round(performance.now()-started)});return {outcome:'completed' as const,goal:completed};
  } catch(error){await connection.rollback();console.info(`[goal-eval] ${error instanceof GoalConflict ? 'conflict' : 'error'}`);throw error;}
  finally{connection.release();}
}
