import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { PlayerGoal } from '../../../types/player-goal.ts';
export class GoalConflict extends Error {}
export type GoalBindingIdentity = { taikoId: string; source: string };
export async function readActiveGoal(db: Pick<Pool, 'execute'> | PoolConnection, userId: number, bindingId: number): Promise<PlayerGoal | null> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT g.id, g.goal_data FROM web_player_goals g JOIN web_taiko_bindings b ON b.id=g.binding_id AND b.user_id=g.user_id JOIN web_user_accounts u ON u.id=g.user_id WHERE g.user_id=? AND g.binding_id=? AND g.status=\'active\' LIMIT 1', [userId, bindingId]);
  return rows[0] ? { ...JSON.parse(rows[0].goal_data), id: String(rows[0].id) } : null;
}
// The binding lock serializes writes and conflicts with switch/unbind updates.
// No Python computation runs while this transaction holds a lock.
export async function mutateGoal(db: Pool, userId: number, profileId: string, expectedId: string | null, prepare: null | ((active: PlayerGoal | null, connection: PoolConnection) => Promise<Omit<PlayerGoal, 'id'>>), sourceIdentity?: GoalBindingIdentity): Promise<PlayerGoal | null> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [owners] = await connection.execute<RowDataPacket[]>('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE', [userId]);
    if (!owners.length) throw new GoalConflict('owner-deleted');
    const [bindings] = await connection.execute<RowDataPacket[]>('SELECT id,taiko_id,source FROM web_taiko_bindings WHERE user_id=? ORDER BY is_current DESC, id ASC FOR UPDATE', [userId]);
    if (String(bindings[0]?.id) !== profileId) throw new GoalConflict('profile-changed');
    if (sourceIdentity && (bindings[0]?.taiko_id !== sourceIdentity.taikoId || bindings[0]?.source !== sourceIdentity.source)) throw new GoalConflict('profile-changed');
    const active = await readActiveGoal(connection, userId, Number(profileId));
    if (expectedId !== null && (active?.id || null) !== expectedId) throw new GoalConflict('goal-changed');
    const next = prepare ? await prepare(active, connection) : null;
    if (next && active && active.songId === next.songId && active.difficultyType === next.difficultyType && active.goalType === next.goalType) {
      await connection.commit(); return active;
    }
    if ((active?.id || null) !== expectedId) throw new GoalConflict('goal-changed');
    const now = new Date().toISOString();
    const sqlTime = now.replace('T', ' ').replace('Z', '');
    if (active) {
      await connection.execute('UPDATE web_player_goals SET status=\'cancelled\', cancelled_at=?, updated_at=?, goal_data=? WHERE id=?', [sqlTime, sqlTime, JSON.stringify({ ...active, status: 'cancelled', cancelledAt: now }), active.id]);
    }
    let result: PlayerGoal | null = null;
    if (next) {
      // The capture inside prepare is the causal boundary; persistence time is separate.
      const goal = { ...next, createdAt: now };
      const [inserted] = await connection.execute<ResultSetHeader>('INSERT INTO web_player_goals (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_basis,source_mode,source_rank,source_revision,source_generated_at,baseline_version,goal_data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)', [userId, Number(profileId), goal.songId, goal.difficultyType, goal.goalType, goal.source, goal.sourceBasis, goal.sourceMode, goal.sourceRank, goal.sourceRevision, goal.sourceGeneratedAt.replace('T', ' ').replace('Z', ''), JSON.stringify(goal), sqlTime, sqlTime]);
      result = { ...goal, id: String(inserted.insertId) };
    }
    await connection.commit(); return result;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
