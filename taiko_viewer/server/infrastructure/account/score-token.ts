import { createHash, randomBytes } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { PublicationUnavailableError } from "../taiko-publication/client.ts";

// The existing Python issuer and bearer endpoint use this same table and format.
// Infrastructure helpers do not authorize a caller or acquire a Source lease.
export const SCORE_TOKEN_TABLE_SQL = `CREATE TABLE IF NOT EXISTS public_score_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  taiko_id VARCHAR(25) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_mask VARCHAR(32) NOT NULL,
  last_used_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_public_score_tokens_taiko_id (taiko_id),
  UNIQUE KEY uniq_public_score_tokens_token_hash (token_hash),
  KEY idx_public_score_tokens_last_used_at (last_used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export type ScoreTokenStatus = {
  taikoId: string; exists: boolean; tokenMask: string | null;
  lastUsedAt: string | null; createdAt: string | null; updatedAt: string | null;
};
export type ScoreTokenResult = { token: string | null; revoked: boolean; status: ScoreTokenStatus };
type ScoreTokenDb = Pick<Pool, "execute">;

export async function readScoreTokenStatus(db: ScoreTokenDb, taikoId: string): Promise<ScoreTokenStatus> {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT token_mask,
    DATE_FORMAT(last_used_at,'%Y-%m-%dT%H:%i:%s') AS last_used_at,
    DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s') AS created_at,
    DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s') AS updated_at
    FROM public_score_tokens WHERE taiko_id=? LIMIT 1`, [taikoId]);
  const row = rows[0];
  const date = (value: unknown) => {
    if (value == null) return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) throw new PublicationUnavailableError();
    return value;
  };
  if (row && (typeof row.token_mask !== "string" || !row.token_mask || row.token_mask.length > 32)) throw new PublicationUnavailableError();
  return { taikoId, exists: Boolean(row), tokenMask: row?.token_mask || null,
    lastUsedAt: date(row?.last_used_at), createdAt: date(row?.created_at), updatedAt: date(row?.updated_at) };
}

/** Run inside the caller's existing Source EX and SQL authority transaction. */
export async function mutateScoreToken(db: ScoreTokenDb, taikoId: string, action: "issue" | "revoke"): Promise<ScoreTokenResult> {
  let token: string | null = null;
  let revoked = false;
  if (action === "issue") {
    token = randomBytes(24).toString("hex");
    await db.execute(`INSERT INTO public_score_tokens (taiko_id,token_hash,token_mask) VALUES (?,?,?)
      ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),token_mask=VALUES(token_mask),last_used_at=NULL`,
    [taikoId, createHash("sha256").update(token).digest("hex"), `${token.slice(0, 8)}...${token.slice(-8)}`]);
  } else {
    const [removed] = await db.execute<ResultSetHeader>("DELETE FROM public_score_tokens WHERE taiko_id=?", [taikoId]);
    revoked = removed.affectedRows > 0;
  }
  return { token, revoked, status: await readScoreTokenStatus(db, taikoId) };
}

/** Exact outcome proof, including recovery of an uncertain SQL COMMIT. */
export async function proveScoreTokenResult(db: ScoreTokenDb, taikoId: string, action: "issue" | "revoke", result: ScoreTokenResult) {
  const [rows] = await db.execute<RowDataPacket[]>("SELECT token_hash,token_mask FROM public_score_tokens WHERE taiko_id=? LIMIT 1", [taikoId]);
  const row = rows[0];
  if (result.status.taikoId !== taikoId || (action === "issue" ?
    !row || !result.token || !result.status.exists || row.token_hash !== createHash("sha256").update(result.token).digest("hex") || row.token_mask !== result.status.tokenMask :
    Boolean(row) || result.status.exists || result.token !== null)) throw new PublicationUnavailableError();
}
