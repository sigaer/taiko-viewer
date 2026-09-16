import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";

export const BETA_FEATURE = "annual_first_run_beta";
export const hashBetaToken = (value: string) => createHash("sha256").update(value).digest("hex");
export const newBetaToken = () => randomBytes(32).toString("base64url");
export class BetaError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export const normalizeInvite = (input: unknown) => {
  const value = String(input || "").trim().toUpperCase().replace(/-/g, "");
  if (!/^[0-9A-F]{32}$/.test(value)) throw new BetaError("invalid_invite");
  return value;
};
const checkInvite = (row: any) => {
  if (!row) throw new BetaError("invalid_invite");
  if (row.disabled_at) throw new BetaError("disabled_invite");
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new BetaError("expired_invite");
  if (row.used_count >= row.max_uses) throw new BetaError("used_invite", 409);
};
export const createBetaInvite = async (db: Pool, cohort: string, expiresAt: Date, source = "other") => {
  if (!["wave1", "wave2"].includes(cohort) || !["qq", "friend", "community", "other"].includes(source)
    || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new BetaError("invalid_invite_options");
  const raw = randomBytes(16).toString("hex").toUpperCase(); const id = randomUUID();
  await db.execute("INSERT INTO web_beta_invites (id,code_hash,cohort,recruitment_source,expires_at) VALUES (?,?,?,?,?)", [id,hashBetaToken(raw),cohort,source,expiresAt]);
  return { id, code: raw.match(/.{1,4}/g)!.join("-"), cohort, expires_at: expiresAt.toISOString() };
};
// Validation never reserves or consumes a use. Pending is browser-session bound.
export const validateBetaInvite = async (db: Pool, input: unknown, sessionId: string) => {
  const code = normalizeInvite(input);
  const [rows]: any = await db.execute("SELECT * FROM web_beta_invites WHERE code_hash=?", [hashBetaToken(code)]);
  const invite = rows[0]; checkInvite(invite);
  const token = newBetaToken(); const expires = new Date(Date.now() + 30 * 60_000);
  await db.execute("INSERT INTO web_beta_pending (token_hash,session_id,invite_id,expires_at) VALUES (?,?,?,?)", [hashBetaToken(token),sessionId,invite.id,expires]);
  return { token, inviteId: invite.id, expiresAt: expires };
};
export const redeemBetaInvite = async (db: Pool, token: string, sessionId: string, userId: number) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new BetaError("pending_expired");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [pendingRows]: any = await connection.execute("SELECT * FROM web_beta_pending WHERE token_hash=? AND session_id=? FOR UPDATE", [hashBetaToken(token),sessionId]);
    const pending = pendingRows[0];
    if (!pending || new Date(pending.expires_at).getTime() <= Date.now()) throw new BetaError("pending_expired");
    if (pending.redeemed_by) {
      if (Number(pending.redeemed_by) !== userId) throw new BetaError("pending_used",409);
      const [grants]: any = await connection.execute("SELECT user_id FROM web_annual_summary_access WHERE user_id=? AND enabled=1 AND feature=?",[userId,BETA_FEATURE]);
      if (!grants.length) throw new BetaError("entitlement_disabled",403);
      await connection.commit(); return { inviteId: pending.invite_id, reused: true };
    }
    // Lock order is pending -> invite -> user. A single-use invite is serialized here.
    const [invites]: any = await connection.execute("SELECT * FROM web_beta_invites WHERE id=? FOR UPDATE",[pending.invite_id]);
    const invite=invites[0]; checkInvite(invite);
    await connection.execute("SELECT id FROM web_user_accounts WHERE id=? FOR UPDATE",[userId]);
    const [existing]: any = await connection.execute("SELECT * FROM web_annual_summary_access WHERE user_id=?",[userId]);
    if (existing[0] && !existing[0].enabled) throw new BetaError("entitlement_disabled",403);
    if (!existing.length) {
      const [changed]: any=await connection.execute("UPDATE web_beta_invites SET used_count=used_count+1 WHERE id=? AND disabled_at IS NULL AND expires_at>NOW() AND used_count<max_uses",[invite.id]);
      if(changed.affectedRows!==1)throw new BetaError("used_invite",409);
      await connection.execute("INSERT INTO web_annual_summary_access (user_id,note,invite_id,feature,enabled) VALUES (?,?,?,?,1)",[userId,"Closed beta",invite.id,BETA_FEATURE]);
      await connection.execute("UPDATE web_beta_participants SET invite_id=?,cohort=? WHERE user_id=?",[invite.id,invite.cohort,userId]);
    }
    await connection.execute("UPDATE web_beta_pending SET redeemed_by=?,redeemed_at=NOW() WHERE token_hash=?",[userId,hashBetaToken(token)]);
    await connection.commit();return {inviteId:existing[0]?.invite_id||invite.id,reused:!!existing.length};
  } catch(error) {await connection.rollback();throw error;} finally {connection.release();}
};
