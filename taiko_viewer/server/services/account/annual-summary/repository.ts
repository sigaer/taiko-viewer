import type { ResultSetHeader } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";
import type { BindingRow } from "~/server/internal/account/shared";
import type {
  AnnualDataMode,
  AnnualJobParameters,
  AnnualJobRow,
  AnnualJobType,
  AnnualLocale,
  AnnualPosterRow,
  AnnualShareRow,
  AnnualShareCardRow,
  AnnualSummaryRow
} from "./types";

const parseJobParameters = (value: string | null): AnnualJobParameters => {
  try {
    return value ? (JSON.parse(value) as AnnualJobParameters) : {};
  } catch {
    return {};
  }
};

export const serializeAnnualJob = (row: AnnualJobRow) => ({
  id: row.id,
  type: row.job_type,
  status: row.status,
  versionKey: row.version_key,
  summaryId: row.summary_id,
  posterId: row.poster_id,
  parameters: parseJobParameters(row.parameters_json),
  error: row.status === "failed" ? { code: row.error_code || "BUILD_FAILED", message: row.error_message || "处理失败" } : null,
  progressStage: row.progress_stage || row.status,
  progressPercent: Number(row.progress_percent || 0),
  progressDetail: row.progress_detail || null,
  startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
  completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

export const findAnnualSummaryById = async (summaryId: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow>[]>(
    "SELECT * FROM web_annual_summaries WHERE id = ? LIMIT 1",
    [summaryId]
  );
  return rows[0] || null;
};

export const listAnnualSummariesForAdmin = async (target: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow & { username: string; taiko_id: string; verified_title: string | null }>[]>(
    `SELECT s.*, a.username, b.taiko_id, b.verified_title
     FROM web_annual_summaries s
     INNER JOIN web_user_accounts a ON a.id = s.user_id
     INNER JOIN web_taiko_bindings b ON b.id = s.binding_id
     ORDER BY s.generated_at DESC LIMIT 1000`,
    []
  );
  return rows;
};

export const findAnnualBinding = async (bindingId: number, userId: number) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE id = ? AND user_id = ? LIMIT 1",
    [bindingId, userId]
  );
  return rows[0] || null;
};

export const listAnnualBindingsForAdmin = async () => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<BindingRow & { username: string; email: string }>[]>(
    `SELECT b.*, a.username, a.email
     FROM web_taiko_bindings b INNER JOIN web_user_accounts a ON a.id = b.user_id
     ORDER BY b.updated_at DESC LIMIT 1000`, []
  );
  return rows;
};

export const findOwnerAnnualSummary = async (summaryId: string, userId: number) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow>[]>(
    "SELECT * FROM web_annual_summaries WHERE id = ? AND user_id = ? LIMIT 1",
    [summaryId, userId]
  );
  return rows[0] || null;
};

export const findLatestAnnualSummary = async (
  userId: number,
  bindingId: number,
  versionKey: string,
  fingerprint?: string
) => {
  await ensureAccountSchema();
  const sql = fingerprint
    ? `SELECT * FROM web_annual_summaries
       WHERE user_id = ? AND binding_id = ? AND version_key = ? AND input_fingerprint = ?
       ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM web_annual_summaries
       WHERE user_id = ? AND binding_id = ? AND version_key = ?
       ORDER BY created_at DESC LIMIT 1`;
  const params = fingerprint
    ? [userId, bindingId, versionKey, fingerprint]
    : [userId, bindingId, versionKey];
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow>[]>(sql, params);
  return rows[0] || null;
};

export const insertAnnualSummary = async (input: {
  id: string;
  userId: number;
  bindingId: number;
  versionKey: string;
  mode: AnnualDataMode;
  fingerprint: string;
  summaryPath: string;
  eventsPath: string;
  eventCount: number;
  generatedAt: string;
}) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `INSERT INTO web_annual_summaries
      (id, user_id, binding_id, version_key, schema_version, data_mode, input_fingerprint,
       summary_path, events_path, event_count, generated_at)
     VALUES (?, ?, ?, ?, 4, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.userId,
      input.bindingId,
      input.versionKey,
      input.mode,
      input.fingerprint,
      input.summaryPath,
      input.eventsPath,
      input.eventCount,
      new Date(input.generatedAt)
    ]
  );
  return findAnnualSummaryById(input.id);
};

export const findAnnualJobById = async (jobId: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(
    "SELECT * FROM web_annual_summary_jobs WHERE id = ? LIMIT 1",
    [jobId]
  );
  return rows[0] || null;
};

export const findOwnerAnnualJob = async (jobId: string, userId: number, type?: AnnualJobType) => {
  await ensureAccountSchema();
  const sql = type
    ? "SELECT * FROM web_annual_summary_jobs WHERE id = ? AND user_id = ? AND job_type = ? LIMIT 1"
    : "SELECT * FROM web_annual_summary_jobs WHERE id = ? AND user_id = ? LIMIT 1";
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(sql, type ? [jobId, userId, type] : [jobId, userId]);
  return rows[0] || null;
};

export const findActiveAnnualJob = async (input: {
  userId: number;
  bindingId: number;
  versionKey: string;
  type: AnnualJobType;
  summaryId?: string;
}) => {
  await ensureAccountSchema();
  const summaryClause = input.summaryId ? " AND summary_id = ?" : "";
  const params = [input.userId, input.bindingId, input.versionKey, input.type, ...(input.summaryId ? [input.summaryId] : [])];
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(
    `SELECT * FROM web_annual_summary_jobs
     WHERE user_id = ? AND binding_id = ? AND version_key = ? AND job_type = ?
       AND status IN ('queued', 'running')${summaryClause}
     ORDER BY created_at DESC LIMIT 1`,
    params
  );
  return rows[0] || null;
};

export const insertAnnualJob = async (input: {
  id: string;
  userId: number;
  bindingId: number;
  versionKey: string;
  type: AnnualJobType;
  summaryId?: string | null;
  posterId?: string | null;
  parameters?: AnnualJobParameters;
  completed?: boolean;
}) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `INSERT INTO web_annual_summary_jobs
      (id, user_id, binding_id, version_key, job_type, status, summary_id, poster_id,
       parameters_json, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.userId,
      input.bindingId,
      input.versionKey,
      input.type,
      input.completed ? "completed" : "queued",
      input.summaryId || null,
      input.posterId || null,
      JSON.stringify(input.parameters || {}),
      input.completed ? new Date() : null,
      input.completed ? new Date() : null
    ]
  );
  return findAnnualJobById(input.id);
};

export const markAnnualJobRunning = async (jobId: string) => {
  await ensureAccountSchema();
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    "UPDATE web_annual_summary_jobs SET status = 'running', started_at = NOW(), error_code = NULL, error_message = NULL, progress_stage = 'preparing', progress_percent = 5 WHERE id = ? AND status = 'queued'",
    [jobId]
  );
  return result.affectedRows > 0;
};

export const markAnnualJobCompleted = async (jobId: string, result: { summaryId?: string; posterId?: string }) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET status = 'completed', summary_id = COALESCE(?, summary_id), poster_id = COALESCE(?, poster_id),
         completed_at = NOW(), error_code = NULL, error_message = NULL,
         progress_stage = 'completed', progress_percent = 100, progress_detail = NULL
     WHERE id = ?`,
    [result.summaryId || null, result.posterId || null, jobId]
  );
};

export const markAnnualJobFailed = async (jobId: string, code: string, message: string) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET status = 'failed', error_code = ?, error_message = ?, completed_at = NOW(), progress_stage = 'failed'
     WHERE id = ?`,
    [code.slice(0, 64), message.slice(0, 255), jobId]
  );
};

export const updateAnnualJobProgress = async (
  jobId: string,
  stage: string,
  percent: number,
  detail?: string | null
) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET progress_stage = ?, progress_percent = ?, progress_detail = ?
     WHERE id = ? AND status = 'running'`,
    [stage.slice(0, 32), Math.max(0, Math.min(99, Math.floor(percent))), detail?.slice(0, 255) || null, jobId]
  );
};

export const recoverInterruptedAnnualJobs = async () => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET status = 'queued', started_at = NULL
     WHERE status = 'running'`
  );
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(
    "SELECT * FROM web_annual_summary_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 100"
  );
  return rows;
};

export const countRecentAnnualJobs = async (input: {
  userId: number;
  type: AnnualJobType;
  since: Date;
}) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<{ count: number }>[]>(
    `SELECT COUNT(*) AS count FROM web_annual_summary_jobs
     WHERE user_id = ? AND job_type = ? AND created_at >= ?`,
    [input.userId, input.type, input.since]
  );
  return Number(rows[0]?.count || 0);
};

export const findAnnualShareById = async (shareId: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareRow>[]>(
    "SELECT * FROM web_annual_shares WHERE id = ? LIMIT 1",
    [shareId]
  );
  return rows[0] || null;
};

export const findOwnerAnnualShare = async (shareId: string, userId: number) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareRow>[]>(
    "SELECT * FROM web_annual_shares WHERE id = ? AND user_id = ? LIMIT 1",
    [shareId, userId]
  );
  return rows[0] || null;
};

export const findActiveAnnualShare = async (summaryId: string, userId?: number) => {
  await ensureAccountSchema();
  const sql = userId
    ? `SELECT * FROM web_annual_shares
       WHERE summary_id = ? AND user_id = ? AND status = 'active' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM web_annual_shares
       WHERE summary_id = ? AND status = 'active' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`;
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareRow>[]>(sql, userId ? [summaryId, userId] : [summaryId]);
  return rows[0] || null;
};

export const listActiveAnnualShares = async (summaryId: string, userId: number) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareRow>[]>(
    "SELECT * FROM web_annual_shares WHERE summary_id = ? AND user_id = ? AND status = 'active'",
    [summaryId, userId]
  );
  return rows;
};

export const insertAnnualShare = async (input: {
  id: string;
  summaryId: string;
  userId: number;
  locale: AnnualLocale;
  tokenHash: string;
  expiresAt: Date;
}) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE web_annual_shares SET status = 'revoked', revoked_at = NOW() WHERE summary_id = ? AND user_id = ? AND status = 'active'",
      [input.summaryId, input.userId]
    );
    await connection.execute(
      `INSERT INTO web_annual_shares
        (id, summary_id, user_id, locale, token_hash, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [input.id, input.summaryId, input.userId, input.locale, input.tokenHash, input.expiresAt]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAnnualShareById(input.id);
};

export const renewAnnualShare = async (shareId: string, userId: number, expiresAt: Date) => {
  await ensureAccountSchema();
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_shares
     SET status = 'active', expires_at = ?, revoked_at = NULL
     WHERE id = ? AND user_id = ? AND status != 'revoked'`,
    [expiresAt, shareId, userId]
  );
  return result.affectedRows > 0 ? findAnnualShareById(shareId) : null;
};

export const revokeAnnualShare = async (shareId: string, userId: number) => {
  await ensureAccountSchema();
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_shares
     SET status = 'revoked', revoked_at = NOW()
     WHERE id = ? AND user_id = ? AND status = 'active'`,
    [shareId, userId]
  );
  return result.affectedRows > 0;
};

export const expireAnnualShares = async () => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    "UPDATE web_annual_shares SET status = 'expired' WHERE status = 'active' AND expires_at <= NOW()"
  );
};

export const expireAnnualShare = async (shareId: string) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    "UPDATE web_annual_shares SET status = 'expired' WHERE id = ? AND status = 'active' AND expires_at <= NOW()",
    [shareId]
  );
};

export const listAnnualSharesNeedingPosterCleanup = async () => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<{ id: string }>[]>(
    `SELECT DISTINCT s.id
     FROM web_annual_shares s
     INNER JOIN web_annual_posters p ON p.share_id = s.id
     WHERE s.status != 'active' OR s.expires_at <= NOW()`
  );
  return rows.map((row) => row.id);
};

export const findAnnualPosterById = async (posterId: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualPosterRow>[]>(
    "SELECT * FROM web_annual_posters WHERE id = ? LIMIT 1",
    [posterId]
  );
  return rows[0] || null;
};

export const findAnnualPosterForShare = async (shareId: string, locale?: AnnualLocale) => {
  await ensureAccountSchema();
  const sql = locale
    ? "SELECT * FROM web_annual_posters WHERE share_id = ? AND locale = ? LIMIT 1"
    : "SELECT * FROM web_annual_posters WHERE share_id = ? ORDER BY updated_at DESC LIMIT 1";
  const [rows] = await getAccountDb().execute<DbRow<AnnualPosterRow>[]>(sql, locale ? [shareId, locale] : [shareId]);
  return rows[0] || null;
};

export const upsertAnnualPoster = async (input: {
  id: string;
  summaryId: string;
  shareId: string;
  userId: number;
  locale: AnnualLocale;
  fingerprint: string;
  filePath: string;
  width: number;
  height: number;
}) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `INSERT INTO web_annual_posters
      (id, summary_id, share_id, user_id, locale, fingerprint, file_path, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = VALUES(id), fingerprint = VALUES(fingerprint),
       file_path = VALUES(file_path), width = VALUES(width), height = VALUES(height), updated_at = NOW()`,
    [input.id, input.summaryId, input.shareId, input.userId, input.locale, input.fingerprint, input.filePath, input.width, input.height]
  );
  return findAnnualPosterById(input.id);
};

export const findAnnualShareCard = async (summaryId: string, locale: AnnualLocale, fingerprint: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareCardRow>[]>(
    "SELECT * FROM web_annual_share_cards WHERE summary_id = ? AND locale = ? AND fingerprint = ? LIMIT 1",
    [summaryId, locale, fingerprint]
  );
  return rows[0] || null;
};

export const findOwnerAnnualShareCard = async (cardId: string, userId: number) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareCardRow>[]>(
    "SELECT * FROM web_annual_share_cards WHERE id = ? AND user_id = ? LIMIT 1",
    [cardId, userId]
  );
  return rows[0] || null;
};

export const insertAnnualShareCard = async (input: {
  id: string;
  summaryId: string;
  userId: number;
  locale: AnnualLocale;
  fingerprint: string;
  filePath: string;
  width: number;
  height: number;
}) => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    `INSERT INTO web_annual_share_cards
      (id, summary_id, user_id, locale, fingerprint, file_path, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = VALUES(id), file_path = VALUES(file_path),
       width = VALUES(width), height = VALUES(height), updated_at = NOW()`,
    [input.id, input.summaryId, input.userId, input.locale, input.fingerprint, input.filePath, input.width, input.height]
  );
  return findAnnualShareCard(input.summaryId, input.locale, input.fingerprint);
};

export const markAnnualShareCardForumSync = async (input: {
  cardId: string;
  imageUrl: string;
  threadId: number;
}) => {
  await ensureAccountSchema();
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_share_cards
     SET forum_image_url = ?, forum_thread_id = ?, updated_at = NOW()
     WHERE id = ? AND forum_thread_id IS NULL`,
    [input.imageUrl, input.threadId, input.cardId]
  );
  return result.affectedRows > 0;
};

export const listAnnualPosterPathsForShare = async (shareId: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<{ file_path: string }>[]>(
    "SELECT file_path FROM web_annual_posters WHERE share_id = ?",
    [shareId]
  );
  return rows.map((row) => row.file_path);
};

export const deleteAnnualPostersForShare = async (shareId: string) => {
  await ensureAccountSchema();
  await getAccountDb().execute("DELETE FROM web_annual_posters WHERE share_id = ?", [shareId]);
};

export const listAnnualSummaryGcCandidates = async () => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow>[]>(
    `SELECT s.*
     FROM web_annual_summaries s
     WHERE s.created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
       AND NOT EXISTS (
         SELECT 1 FROM web_annual_shares sh
         WHERE sh.summary_id = s.id AND sh.status = 'active' AND sh.expires_at > NOW()
       )
       AND EXISTS (
         SELECT 1 FROM web_annual_summaries newer
         WHERE newer.user_id = s.user_id AND newer.binding_id = s.binding_id
           AND newer.version_key = s.version_key AND newer.created_at > s.created_at
       )
     ORDER BY s.created_at ASC
     LIMIT 500`
  );
  return rows;
};

export const deleteAnnualSummaryForGc = async (summaryId: string) => {
  await ensureAccountSchema();
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `DELETE FROM web_annual_summaries
     WHERE id = ? AND NOT EXISTS (
       SELECT 1 FROM web_annual_shares sh
       WHERE sh.summary_id = web_annual_summaries.id AND sh.status = 'active' AND sh.expires_at > NOW()
     )`,
    [summaryId]
  );
  return result.affectedRows > 0;
};

export const deleteAnnualSummaryForAdmin = async (summaryId: string) => {
  await ensureAccountSchema();
  const [result] = await getAccountDb().execute<ResultSetHeader>("DELETE FROM web_annual_summaries WHERE id = ?", [summaryId]);
  return result.affectedRows > 0;
};

export const deleteOldAnnualJobs = async () => {
  await ensureAccountSchema();
  await getAccountDb().execute(
    "DELETE FROM web_annual_summary_jobs WHERE status IN ('completed', 'failed') AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
  );
};
