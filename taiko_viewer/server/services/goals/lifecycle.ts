import type { Pool, PoolConnection, Connection, RowDataPacket } from 'mysql2/promise';
type ConnectionLike = PoolConnection | Connection;

// Call within the owner's transaction, after locking its user/bindings.
export async function deleteGoalsForBinding(connection: ConnectionLike, bindingId: number) {
  await connection.execute('DELETE FROM web_player_goals WHERE binding_id=?', [bindingId]);
}
export async function deleteGoalsForUser(connection: ConnectionLike, userId: number) {
  // Include inconsistent ownership rows tied to this user's bindings, for privacy cleanup.
  await connection.execute('DELETE g FROM web_player_goals g LEFT JOIN web_taiko_bindings b ON b.id=g.binding_id WHERE g.user_id=? OR b.user_id=?', [userId, userId]);
}
export async function deleteUserAndGoalsInTransaction(connection: ConnectionLike, userId: number) {
  await connection.execute('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE', [userId]);
  await connection.execute('SELECT id FROM web_taiko_bindings WHERE user_id=? ORDER BY id FOR UPDATE', [userId]);
  await deleteGoalsForUser(connection, userId);
  await connection.execute('DELETE FROM web_song_locks WHERE user_id=?', [userId]);
  await connection.execute('DELETE FROM web_user_sessions WHERE user_id=?', [userId]);
  await connection.execute('DELETE FROM web_taiko_bindings WHERE user_id=?', [userId]);
  await connection.execute('DELETE FROM web_user_accounts WHERE id=?', [userId]);
}
export async function deleteUserWithGoalsConnection(connection: ConnectionLike, userId: number) {
  try {
    await connection.beginTransaction();
    await deleteUserAndGoalsInTransaction(connection, userId);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
}
export async function deleteUserWithGoals(db: Pool, userId: number) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await deleteUserAndGoalsInTransaction(connection, userId);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function deleteBindingsWithGoals(db: Pool, userId: number, filter: { bindingId?: number; taikoId?: string; source?: string }) {
  if (!filter.bindingId && !filter.taikoId) throw new Error('Scoped binding identity required');
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Same lock order as Goal mutation and account cleanup.
    await connection.execute('SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE', [userId]);
    const [bindings] = await connection.execute<RowDataPacket[]>('SELECT id,taiko_id,source FROM web_taiko_bindings WHERE user_id=? ORDER BY id FOR UPDATE', [userId]);
    for (const binding of bindings) {
      if (filter.bindingId && Number(binding.id) !== filter.bindingId) continue;
      if (filter.taikoId && binding.taiko_id !== filter.taikoId) continue;
      if (filter.source && binding.source !== filter.source) continue;
      await deleteGoalsForBinding(connection, Number(binding.id));
      await connection.execute('DELETE FROM web_song_locks WHERE user_id=? AND taiko_id=?', [userId, binding.taiko_id]);
      await connection.execute('DELETE FROM web_taiko_bindings WHERE id=? AND user_id=?', [binding.id, userId]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
