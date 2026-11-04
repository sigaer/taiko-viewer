import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { errors } from 'oidc-provider';

export type SessionBinding = { subject: string; sessionHash: string };
export const authorizationBinding = new AsyncLocalStorage<SessionBinding>();
const boundModels = new Set(['Grant', 'AuthorizationCode', 'AccessToken', 'RefreshToken']);

export const PROVIDER_TABLES = [
  `CREATE TABLE IF NOT EXISTS web_oidc_provider_objects (
    model VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NOT NULL,
    expires_at BIGINT NOT NULL,
    consumed BIGINT DEFAULT NULL,
    grant_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    uid VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    user_code VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    subject VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    PRIMARY KEY (model,id), INDEX idx_grant (grant_id), INDEX idx_uid (model,uid),
    INDEX idx_user_code (model,user_code), INDEX idx_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_oidc_provider_consent (
    interaction_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    csrf_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at BIGINT NOT NULL, INDEX idx_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

type Stored = RowDataPacket & { payload: any; consumed: number | null; subject: string | null; session_hash: string | null };
export function databaseAdapter(db: Pool) {
  return class ViewerProviderAdapter {
    model: string;
    constructor(model: string) { this.model = model; }
    async upsert(id: string, payload: any, expiresIn: number) {
      let binding = authorizationBinding.getStore();
      if (payload.grantId) {
        const [grants] = await db.execute<Stored[]>(
          "SELECT subject,session_hash FROM web_oidc_provider_objects WHERE model='Grant' AND id=? AND expires_at>UNIX_TIMESTAMP()", [payload.grantId]);
        if (!grants[0]?.session_hash) throw new errors.InvalidGrant('Authorization has been revoked');
        binding = { subject: grants[0].subject!, sessionHash: grants[0].session_hash };
      }
      if (boundModels.has(this.model) && !binding) throw new errors.InvalidGrant('Viewer session required');
      if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw Error('Provider expiry required');
      await db.execute(`INSERT INTO web_oidc_provider_objects
        (model,id,payload,expires_at,grant_id,uid,user_code,subject,session_hash) VALUES (?,?,?,UNIX_TIMESTAMP()+?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE payload=VALUES(payload),expires_at=VALUES(expires_at),grant_id=VALUES(grant_id),
          uid=VALUES(uid),user_code=VALUES(user_code),subject=COALESCE(VALUES(subject),subject),session_hash=COALESCE(VALUES(session_hash),session_hash)`,
      [this.model,id,JSON.stringify(payload),Math.ceil(expiresIn),payload.grantId || null,payload.uid || null,payload.userCode || null,binding?.subject || null,binding?.sessionHash || null]);
    }
    async lookup(column: 'id' | 'uid' | 'user_code', value: string) {
      const [rows] = await db.execute<Stored[]>(`SELECT payload,consumed,subject,session_hash FROM web_oidc_provider_objects o
        WHERE model=? AND ${column}=? AND expires_at>UNIX_TIMESTAMP()
        AND (session_hash IS NULL OR EXISTS (SELECT 1 FROM web_user_sessions s
          WHERE SHA2(s.session_token,256)=o.session_hash AND s.user_id=CAST(o.subject AS UNSIGNED) AND s.expires_at>NOW())) LIMIT 1`, [this.model,value]);
      const row = rows[0];
      if (!row || (boundModels.has(this.model) && !row.session_hash)) return undefined;
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      if (row.consumed) payload.consumed = Number(row.consumed);
      return payload;
    }
    find(id: string) { return this.lookup('id',id); }
    findByUid(uid: string) { return this.lookup('uid',uid); }
    findByUserCode(code: string) { return this.lookup('user_code',code); }
    async consume(id: string) {
      const [result] = await db.execute<ResultSetHeader>(`UPDATE web_oidc_provider_objects o SET consumed=UNIX_TIMESTAMP()
        WHERE model=? AND id=? AND consumed IS NULL AND expires_at>UNIX_TIMESTAMP()
        AND EXISTS (SELECT 1 FROM web_user_sessions s WHERE SHA2(s.session_token,256)=o.session_hash
          AND s.user_id=CAST(o.subject AS UNSIGNED) AND s.expires_at>NOW())`, [this.model,id]);
      if (result.affectedRows !== 1) throw new errors.InvalidGrant('Authorization already used or revoked');
    }
    async destroy(id: string) {
      if (this.model === 'Grant') await this.revokeByGrantId(id);
      await db.execute('DELETE FROM web_oidc_provider_objects WHERE model=? AND id=?', [this.model,id]);
    }
    async revokeByGrantId(grantId: string) {
      await db.execute("DELETE FROM web_oidc_provider_objects WHERE grant_id=? OR (model='Grant' AND id=?)", [grantId,grantId]);
    }
  };
}
