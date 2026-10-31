import type {Pool, RowDataPacket} from 'mysql2/promise';
import type {SourceActor} from './source-access.ts';

export type LegacyDeveloperGrant = Readonly<{kind: 'developer'; applicationId: string}>;

/** The approved legacy Developer token is a Bot credential. V1 client tokens
 * and ResourceGrants are validated by their own API and never reach this path. */
export async function legacyDeveloperGrant(
  db: Pick<Pool, 'execute'>, actor: SourceActor, locked = false,
): Promise<LegacyDeveloperGrant | null> {
  if (actor.kind !== 'developer') return null;
  const [[row]] = await db.execute<RowDataPacket[]>(`SELECT CAST(app.id AS CHAR) AS application_id
    FROM web_developer_tokens t
    JOIN web_developer_applications app ON app.id=t.application_id AND app.user_id=t.user_id
    JOIN web_user_accounts a ON a.id=t.user_id
    WHERE t.id=? AND t.user_id=? AND t.token_hash=? AND t.status='active'
      AND t.revoked_at IS NULL AND app.status='approved' AND a.email_verified=1` + (locked ? ' FOR UPDATE' : ''),
  [actor.tokenId!, actor.userId, actor.credential]);
  return row ? Object.freeze({kind: 'developer', applicationId: String(row.application_id)}) : null;
}
