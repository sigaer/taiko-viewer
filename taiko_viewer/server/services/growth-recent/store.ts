import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export const GROWTH_RECENT_ALGORITHM_VERSION = "recent-observation-v1";

export type RecentCursor = {
  userId: number;
  bindingId: number;
  token: string;
  observationRevision: string;
  observedAt: string;
  algorithmVersion: string;
};

type CursorRow = RowDataPacket & {
  user_id: number;
  binding_id: number;
  cursor_token: string;
  observation_revision: string;
  observation_observed_at: Date | string;
  algorithm_version: string;
};

const iso = (value: Date | string) => new Date(value).toISOString();

const mapCursor = (row: CursorRow): RecentCursor => ({
  userId: Number(row.user_id),
  bindingId: Number(row.binding_id),
  token: String(row.cursor_token),
  observationRevision: String(row.observation_revision),
  observedAt: iso(row.observation_observed_at),
  algorithmVersion: String(row.algorithm_version)
});

export async function readRecentCursor(db: Pick<Pool, "execute">, userId: number, bindingId: number): Promise<RecentCursor | null> {
  const [rows] = await db.execute<CursorRow[]>(`SELECT c.user_id,c.binding_id,c.cursor_token,c.observation_revision,c.observation_observed_at,c.algorithm_version
    FROM web_growth_recent_cursors c
    JOIN web_taiko_bindings b ON b.id=c.binding_id AND b.user_id=c.user_id
    JOIN web_user_accounts u ON u.id=c.user_id
    WHERE c.user_id=? AND c.binding_id=? LIMIT 1`, [userId, bindingId]);
  return rows[0] ? mapCursor(rows[0]) : null;
}

export async function readRecentCursorForUpdate(connection: PoolConnection, userId: number, bindingId: number): Promise<RecentCursor | null> {
  const [rows] = await connection.execute<CursorRow[]>(`SELECT user_id,binding_id,cursor_token,observation_revision,observation_observed_at,algorithm_version
    FROM web_growth_recent_cursors WHERE user_id=? AND binding_id=? FOR UPDATE`, [userId, bindingId]);
  return rows[0] ? mapCursor(rows[0]) : null;
}

export async function writeRecentCursor(
  connection: PoolConnection,
  cursor: Omit<RecentCursor, "algorithmVersion">
) {
  await connection.execute(`INSERT INTO web_growth_recent_cursors
    (user_id,binding_id,cursor_token,observation_revision,observation_observed_at,algorithm_version)
    VALUES (?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),cursor_token=VALUES(cursor_token),observation_revision=VALUES(observation_revision),observation_observed_at=VALUES(observation_observed_at),algorithm_version=VALUES(algorithm_version)`, [
    cursor.userId,
    cursor.bindingId,
    cursor.token,
    cursor.observationRevision,
    new Date(cursor.observedAt),
    GROWTH_RECENT_ALGORITHM_VERSION
  ]);
}

export async function deleteRecentCursorsForBinding(connection: Pick<PoolConnection, "execute">, bindingId: number) {
  await connection.execute("DELETE FROM web_growth_recent_cursors WHERE binding_id=?", [bindingId]);
}

export async function deleteRecentCursorsForUser(connection: Pick<PoolConnection, "execute">, userId: number) {
  await connection.execute(`DELETE c FROM web_growth_recent_cursors c
    LEFT JOIN web_taiko_bindings b ON b.id=c.binding_id
    WHERE c.user_id=? OR b.user_id=?`, [userId, userId]);
}
