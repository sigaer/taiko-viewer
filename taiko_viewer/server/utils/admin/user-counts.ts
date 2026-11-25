import type { Pool, RowDataPacket } from "mysql2/promise";

export type UserIdentitySnapshot = {
  viewerUsers: Array<{ id: string }>;
  botUsers: Array<{ identity_key: string }>;
  qqLinks: Array<{ user_id: string; qq_number: string; status: string; verified_at: string | null }>;
};

/** Bare historical QQ numbers and OneBot principals identify the same user.
 * Official OpenIDs are case-sensitive and cannot be inferred from game IDs.
 */
const botIdentity = (value: string) => {
  const key = value.trim();
  return /^[0-9]+$/.test(key) ? `onebot_v11:${key}` : key;
};

/** Count users, never game accounts. Shared game bindings are not identity proof.
 * A verified QQ has one Viewer owner (enforced by the account schema).
 */
export const countAdminUsers = (snapshot: UserIdentitySnapshot) => {
  const viewers = new Set(snapshot.viewerUsers.map(row => row.id));
  const bots = new Set(snapshot.botUsers.map(row => botIdentity(row.identity_key)).filter(Boolean));
  const linkedBots = new Map<string, string>();
  const linkedViewers = new Set<string>();
  for (const link of snapshot.qqLinks) {
    if (link.status !== "active" || !link.verified_at || !viewers.has(link.user_id)) continue;
    if (!/^[1-9][0-9]{4,14}$/.test(link.qq_number)) continue;
    const principal = botIdentity(link.qq_number);
    if (!bots.has(principal)) continue;
    const owner = linkedBots.get(principal);
    if (owner && owner !== link.user_id) throw new Error("Conflicting verified user identities");
    linkedBots.set(principal, link.user_id);
    linkedViewers.add(link.user_id);
  }
  const viewerOnlyUsers = viewers.size - linkedViewers.size;
  const botOnlyUsers = bots.size - linkedBots.size;
  return {
    totalUsers: viewers.size + botOnlyUsers,
    viewerUsers: viewers.size,
    botUsers: botOnlyUsers + linkedViewers.size,
    viewerOnlyUsers,
    botOnlyUsers,
    linkedUsers: linkedViewers.size
  };
};

/** One consistent read prevents a concurrent registration/link from being
 * counted in only half of the population. No business state is created here.
 */
export const readAdminUserCounts = async (db: Pick<Pool, "getConnection">) => {
  const connection = await db.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    const [viewerUsers] = await connection.query<(RowDataPacket & UserIdentitySnapshot["viewerUsers"][number])[]>(
      "SELECT CAST(id AS CHAR) AS id FROM web_user_accounts"
    );
    // All retained slots belong to one Bot user, regardless of current selection.
    const [botUsers] = await connection.query<(RowDataPacket & UserIdentitySnapshot["botUsers"][number])[]>(
      "SELECT qq AS identity_key FROM bind"
    );
    const [qqLinks] = await connection.query<(RowDataPacket & UserIdentitySnapshot["qqLinks"][number])[]>(
      `SELECT CAST(user_id AS CHAR) AS user_id, qq_number, status,
        DATE_FORMAT(verified_at, '%Y-%m-%d %H:%i:%s') AS verified_at
       FROM web_user_qq_bindings WHERE status = 'active' AND verified_at IS NOT NULL`
    );
    const result = countAdminUsers({ viewerUsers, botUsers, qqLinks });
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
