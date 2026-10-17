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
import {
  ANNUAL_BUILD_LEASE_SECONDS,
  ANNUAL_BUILD_MAX_ATTEMPTS,
  ANNUAL_DURABLE_QUEUE_TTL_SECONDS,
  durableQueueWouldAccept
} from "./hardening";

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
  error: ["failed", "expired", "cancelled"].includes(row.status)
    ? { code: row.error_code || "BUILD_FAILED", message: row.error_message || "处理失败" }
    : null,
  progressStage: row.progress_stage || row.status,
  progressPercent: Number(row.progress_percent || 0),
  progressDetail: row.progress_detail || null,
  startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
  completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

export type AnnualQueueMetrics = {
  queuedCount: number;
  queuedWorkSeconds: number;
  oldestQueuedAt: string | null;
};

export class AnnualQueueCapacityError extends Error {
  code = "ANNUAL_CAPACITY_RETRY";
  statusCode = 429;
  statusMessage = "年度服务繁忙，请稍后重试";
  retryAfter = 30;
  constructor(readonly metrics: AnnualQueueMetrics) {
    super("annual durable queue work budget is exhausted");
  }
}

export const findAnnualSummaryById = async (summaryId: string) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow>[]>(
    "SELECT * FROM web_annual_summaries WHERE id = ? LIMIT 1",
    [summaryId]
  );
  return rows[0] || null;
};

export const listAnnualSummariesForAdmin = async (target: string) => {
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE id = ? AND user_id = ? LIMIT 1",
    [bindingId, userId]
  );
  return rows[0] || null;
};

export const listAnnualBindingsForAdmin = async () => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<BindingRow & { username: string; email: string }>[]>(
    `SELECT b.*, a.username, a.email
     FROM web_taiko_bindings b INNER JOIN web_user_accounts a ON a.id = b.user_id
     ORDER BY b.updated_at DESC LIMIT 1000`, []
  );
  return rows;
};

export const findOwnerAnnualSummary = async (summaryId: string, userId: number) => {
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
  const sql = fingerprint
    ? `SELECT * FROM web_annual_summaries
       WHERE user_id = ? AND binding_id = ? AND version_key = ? AND input_fingerprint = ?
       ORDER BY created_at DESC, generated_at DESC, id DESC LIMIT 1`
    : `SELECT * FROM web_annual_summaries
       WHERE user_id = ? AND binding_id = ? AND version_key = ?
       ORDER BY created_at DESC, generated_at DESC, id DESC LIMIT 1`;
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
  await ensureAccountSchema("annual");
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

export const pruneSupersededAnnualSummaries = async (userId: number, bindingId: number, versionKey: string) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow>[]>(
    `SELECT s.* FROM web_annual_summaries s
     WHERE s.user_id=? AND s.binding_id=? AND s.version_key=?
       AND NOT EXISTS (
         SELECT 1 FROM web_annual_shares sh
         WHERE sh.summary_id=s.id AND sh.status='active' AND sh.expires_at > NOW()
       )
     ORDER BY s.created_at DESC`,
    [userId, bindingId, versionKey]
  );
  const removed: AnnualSummaryRow[] = [];
  for (const row of rows.slice(2)) {
    const [result] = await getAccountDb().execute<ResultSetHeader>(
      "DELETE FROM web_annual_summaries WHERE id=?", [row.id]
    );
    if (result.affectedRows) removed.push(row);
  }
  return removed;
};

export const findAnnualJobById = async (jobId: string) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(
    "SELECT * FROM web_annual_summary_jobs WHERE id = ? LIMIT 1",
    [jobId]
  );
  return rows[0] || null;
};

export const findOwnerAnnualJob = async (jobId: string, userId: number, type?: AnnualJobType) => {
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
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
  jobKey?: string | null;
  activeKey?: string | null;
  algorithmVersion?: string | null;
  inputFingerprint?: string | null;
  sourceRevision?: string | null;
  estimatedServiceSeconds?: number;
}) => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    `INSERT INTO web_annual_summary_jobs
      (id, user_id, binding_id, version_key, job_type, status, summary_id, poster_id,
       parameters_json, job_key, active_key, algorithm_version, input_fingerprint,
       source_revision, estimated_service_seconds, queued_at, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
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
      input.jobKey || null,
      input.completed ? null : input.activeKey || null,
      input.algorithmVersion || null,
      input.inputFingerprint || null,
      input.sourceRevision || null,
      Math.max(0.1, Number(input.estimatedServiceSeconds || 1)),
      input.completed ? new Date() : null,
      input.completed ? new Date() : null
    ]
  );
  return findAnnualJobById(input.id);
};

const withAnnualAdmissionLock = async <T>(runner: (connection: any) => Promise<T>): Promise<T> => {
  await ensureAccountSchema("annual");
  const connection = await getAccountDb().getConnection();
  let locked = false;
  let lockName = "annual-build-durable-admission";
  try {
    const [identityRows] = await connection.query("SELECT DATABASE() AS database_name");
    const databaseName = String((identityRows as Array<{ database_name: string }>)[0]?.database_name || "unknown");
    lockName = `annual-build:${databaseName}`.slice(0, 64);
    const [rows] = await connection.query("SELECT GET_LOCK(?, 5) AS acquired", [lockName]);
    locked = Number((rows as Array<{ acquired: number }>)[0]?.acquired || 0) === 1;
    if (!locked) throw new Error("annual durable admission lock unavailable");
    return await runner(connection);
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
    connection.release();
  }
};

const selectAnnualQueueMetrics = async (connection: any): Promise<AnnualQueueMetrics> => {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS queued_count,
            COALESCE(SUM(estimated_service_seconds), 0) AS queued_work_seconds,
            MIN(queued_at) AS oldest_queued_at
     FROM web_annual_summary_jobs WHERE job_type = 'build' AND status = 'queued'`
  );
  const row = rows[0] || {};
  return {
    queuedCount: Number(row.queued_count || 0),
    queuedWorkSeconds: Number(row.queued_work_seconds || 0),
    oldestQueuedAt: row.oldest_queued_at ? new Date(row.oldest_queued_at).toISOString() : null
  };
};

export const admitAnnualBuildJob = async (input: {
  id: string;
  userId: number;
  bindingId: number;
  versionKey: string;
  jobKey: string;
  algorithmVersion: string;
  inputFingerprint: string;
  sourceRevision: string;
  estimatedServiceSeconds: number;
  parameters: AnnualJobParameters;
}) => withAnnualAdmissionLock(async (connection) => {
  await connection.beginTransaction();
  try {
    const [ownerActiveRows] = await connection.execute(
      `SELECT * FROM web_annual_summary_jobs
       WHERE user_id=? AND binding_id=? AND version_key=? AND job_type='build'
         AND status IN ('queued','running')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [input.userId, input.bindingId, input.versionKey]
    );
    const ownerActive = ownerActiveRows[0] as AnnualJobRow | undefined;
    if (ownerActive && ownerActive.active_key === input.jobKey) {
      await connection.commit();
      return { job: ownerActive, joined: true, metrics: await selectAnnualQueueMetrics(connection) };
    }
    if (ownerActive?.status === 'running') {
      await connection.commit();
      return { job: ownerActive, joined: true, metrics: await selectAnnualQueueMetrics(connection) };
    }
    if (ownerActive?.status === 'queued') {
      await connection.execute(
        `UPDATE web_annual_summary_jobs
         SET status='expired', active_key=NULL, error_code='ANNUAL_INPUT_SUPERSEDED',
             error_message='数据已更新，请重新生成年度总结', completed_at=NOW(), progress_stage='expired'
         WHERE id=? AND status='queued'`,
        [ownerActive.id]
      );
    }
    const [activeRows] = await connection.execute(
      "SELECT * FROM web_annual_summary_jobs WHERE active_key = ? AND status IN ('queued','running') LIMIT 1 FOR UPDATE",
      [input.jobKey]
    );
    if (activeRows[0]) {
      await connection.commit();
      return { job: activeRows[0] as AnnualJobRow, joined: true, metrics: await selectAnnualQueueMetrics(connection) };
    }
    const metrics = await selectAnnualQueueMetrics(connection);
    if (!durableQueueWouldAccept({
      queuedCount: metrics.queuedCount,
      queuedWorkSeconds: metrics.queuedWorkSeconds,
      estimatedServiceSeconds: input.estimatedServiceSeconds
    })) {
      await connection.rollback();
      throw new AnnualQueueCapacityError(metrics);
    }
    await connection.execute(
      `INSERT INTO web_annual_summary_jobs
       (id,user_id,binding_id,version_key,job_type,status,parameters_json,job_key,active_key,
        algorithm_version,input_fingerprint,source_revision,estimated_service_seconds,queued_at)
       VALUES (?,?,?,?,?,'queued',?,?,?,?,?,?,?,NOW())`,
      [input.id, input.userId, input.bindingId, input.versionKey, "build", JSON.stringify(input.parameters),
        input.jobKey, input.jobKey, input.algorithmVersion, input.inputFingerprint, input.sourceRevision,
        input.estimatedServiceSeconds]
    );
    const [createdRows] = await connection.execute("SELECT * FROM web_annual_summary_jobs WHERE id = ?", [input.id]);
    await connection.commit();
    return {
      job: createdRows[0] as AnnualJobRow,
      joined: false,
      metrics: {
        ...metrics,
        queuedCount: metrics.queuedCount + 1,
        queuedWorkSeconds: metrics.queuedWorkSeconds + input.estimatedServiceSeconds,
        oldestQueuedAt: metrics.oldestQueuedAt || new Date().toISOString()
      }
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  }
});

export const getAnnualQueueMetrics = async () => {
  await ensureAccountSchema("annual");
  return selectAnnualQueueMetrics(getAccountDb());
};

export const claimNextAnnualBuild = async (leaseOwner: string) => withAnnualAdmissionLock(async (connection) => {
  await connection.beginTransaction();
  try {
    await connection.execute(
      `UPDATE web_annual_summary_jobs
       SET status = 'failed', active_key = NULL, lease_owner = NULL, lease_until = NULL,
           error_code = 'ANNUAL_LEASE_EXHAUSTED', error_message = '年度任务执行中断，请稍后重试',
           completed_at = NOW(), progress_stage = 'failed'
       WHERE job_type = 'build' AND status = 'running' AND (lease_until IS NULL OR lease_until < NOW()) AND attempt >= ?`,
      [ANNUAL_BUILD_MAX_ATTEMPTS]
    );
    await connection.execute(
      `UPDATE web_annual_summary_jobs
       SET status = 'queued', lease_owner = NULL, lease_until = NULL, heartbeat_at = NULL,
           progress_stage = 'queued', progress_percent = 0
       WHERE job_type = 'build' AND status = 'running' AND (lease_until IS NULL OR lease_until < NOW()) AND attempt < ?`,
      [ANNUAL_BUILD_MAX_ATTEMPTS]
    );
    const [countRows] = await connection.query(
      "SELECT COUNT(*) AS count FROM web_annual_summary_jobs WHERE job_type='build' AND status='running' AND lease_until >= NOW()"
    );
    if (Number(countRows[0]?.count || 0) >= 2) {
      await connection.commit();
      return null;
    }
    const [rows] = await connection.query(
      `SELECT * FROM web_annual_summary_jobs
       WHERE job_type='build' AND status='queued'
         AND queued_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
       ORDER BY queued_at ASC, created_at ASC LIMIT 1 FOR UPDATE`,
      [ANNUAL_DURABLE_QUEUE_TTL_SECONDS]
    );
    const job = rows[0] as AnnualJobRow | undefined;
    if (!job) {
      await connection.commit();
      return null;
    }
    const [result] = await connection.execute(
      `UPDATE web_annual_summary_jobs
       SET status='running', lease_owner=?, lease_until=DATE_ADD(NOW(), INTERVAL ? SECOND), heartbeat_at=NOW(),
           attempt=attempt+1, started_at=COALESCE(started_at,NOW()), progress_stage='preparing', progress_percent=5,
           error_code=NULL, error_message=NULL
       WHERE id=? AND status='queued'`,
      [leaseOwner, ANNUAL_BUILD_LEASE_SECONDS, job.id]
    );
    if (!(result as ResultSetHeader).affectedRows) {
      await connection.rollback();
      return null;
    }
    const [claimedRows] = await connection.execute("SELECT * FROM web_annual_summary_jobs WHERE id=?", [job.id]);
    await connection.commit();
    return claimedRows[0] as AnnualJobRow;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  }
});

export const heartbeatAnnualBuild = async (jobId: string, leaseOwner: string) => {
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_summary_jobs SET heartbeat_at=NOW(), lease_until=DATE_ADD(NOW(), INTERVAL ? SECOND)
     WHERE id=? AND job_type='build' AND status='running' AND lease_owner=? AND lease_until >= NOW()`,
    [ANNUAL_BUILD_LEASE_SECONDS, jobId, leaseOwner]
  );
  return result.affectedRows > 0;
};

export const completeLeasedAnnualBuild = async (jobId: string, leaseOwner: string, summaryId: string) => {
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_summary_jobs
     SET status='completed', summary_id=?, active_key=NULL, lease_owner=NULL, lease_until=NULL, heartbeat_at=NULL,
         completed_at=NOW(), error_code=NULL, error_message=NULL, progress_stage='completed', progress_percent=100,
         progress_detail=NULL
     WHERE id=? AND status='running' AND lease_owner=?`,
    [summaryId, jobId, leaseOwner]
  );
  return result.affectedRows > 0;
};

export const failLeasedAnnualBuild = async (
  jobId: string,
  leaseOwner: string,
  code: string,
  message: string,
  status: "failed" | "expired" = "failed"
) => {
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_summary_jobs
     SET status=?, active_key=NULL, lease_owner=NULL, lease_until=NULL, heartbeat_at=NULL,
         error_code=?, error_message=?, completed_at=NOW(), progress_stage=?
     WHERE id=? AND status='running' AND lease_owner=?`,
    [status, code.slice(0, 64), message.slice(0, 255), status, jobId, leaseOwner]
  );
  return result.affectedRows > 0;
};

export const markAnnualJobRunning = async (jobId: string) => {
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    "UPDATE web_annual_summary_jobs SET status = 'running', started_at = NOW(), error_code = NULL, error_message = NULL, progress_stage = 'preparing', progress_percent = 5 WHERE id = ? AND status = 'queued'",
    [jobId]
  );
  return result.affectedRows > 0;
};

export const markAnnualJobCompleted = async (jobId: string, result: { summaryId?: string; posterId?: string }) => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET status = 'completed', summary_id = COALESCE(?, summary_id), poster_id = COALESCE(?, poster_id),
         active_key = NULL, lease_owner = NULL, lease_until = NULL, heartbeat_at = NULL,
         completed_at = NOW(), error_code = NULL, error_message = NULL,
         progress_stage = 'completed', progress_percent = 100, progress_detail = NULL
     WHERE id = ?`,
    [result.summaryId || null, result.posterId || null, jobId]
  );
};

export const markAnnualJobFailed = async (jobId: string, code: string, message: string) => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET status = 'failed', error_code = ?, error_message = ?, completed_at = NOW(), progress_stage = 'failed'
         , active_key = NULL, lease_owner = NULL, lease_until = NULL, heartbeat_at = NULL
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
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET progress_stage = ?, progress_percent = ?, progress_detail = ?
     WHERE id = ? AND status = 'running'`,
    [stage.slice(0, 32), Math.max(0, Math.min(99, Math.floor(percent))), detail?.slice(0, 255) || null, jobId]
  );
};

// Expire queue wait atomically; never overwrite a job that acquired its slot.
export const expireQueuedAnnualJobs = async () => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(
    "SELECT * FROM web_annual_summary_jobs WHERE status = 'queued' AND queued_at <= DATE_SUB(NOW(), INTERVAL 10 MINUTE) ORDER BY queued_at LIMIT 64"
  );
  const expired: AnnualJobRow[] = [];
  for (const row of rows) {
    const [result] = await getAccountDb().execute<ResultSetHeader>(
      `UPDATE web_annual_summary_jobs
       SET status = IF(job_type='build','expired','failed'), active_key = NULL,
           error_code = 'ANNUAL_QUEUE_TIMEOUT', error_message = '年度任务等待超时，请稍后重试',
           completed_at = NOW(), progress_stage = IF(job_type='build','expired','failed')
       WHERE id = ? AND status = 'queued' AND queued_at <= DATE_SUB(NOW(), INTERVAL 10 MINUTE)`,
      [row.id]
    );
    if (result.affectedRows) expired.push(row);
  }
  return expired;
};

export const recoverInterruptedAnnualJobs = async () => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    `UPDATE web_annual_summary_jobs
     SET status = 'queued'
     WHERE status = 'running' AND job_type = 'poster'`
  );
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(
    "SELECT * FROM web_annual_summary_jobs WHERE status = 'queued' AND job_type = 'poster' ORDER BY created_at ASC LIMIT 100"
  );
  return rows;
};

export const countRecentAnnualJobs = async (input: {
  userId: number;
  type: AnnualJobType;
  since: Date;
}) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<{ count: number }>[]>(
    `SELECT COUNT(*) AS count FROM web_annual_summary_jobs
     WHERE user_id = ? AND job_type = ? AND created_at >= ?`,
    [input.userId, input.type, input.since]
  );
  return Number(rows[0]?.count || 0);
};

export const findAnnualShareById = async (shareId: string) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareRow>[]>(
    "SELECT * FROM web_annual_shares WHERE id = ? LIMIT 1",
    [shareId]
  );
  return rows[0] || null;
};

export const findOwnerAnnualShare = async (shareId: string, userId: number) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareRow>[]>(
    "SELECT * FROM web_annual_shares WHERE id = ? AND user_id = ? LIMIT 1",
    [shareId, userId]
  );
  return rows[0] || null;
};

export const findActiveAnnualShare = async (summaryId: string, userId?: number) => {
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_shares
     SET status = 'active', expires_at = ?, revoked_at = NULL
     WHERE id = ? AND user_id = ? AND status != 'revoked'`,
    [expiresAt, shareId, userId]
  );
  return result.affectedRows > 0 ? findAnnualShareById(shareId) : null;
};

export const revokeAnnualShare = async (shareId: string, userId: number) => {
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_shares
     SET status = 'revoked', revoked_at = NOW()
     WHERE id = ? AND user_id = ? AND status = 'active'`,
    [shareId, userId]
  );
  return result.affectedRows > 0;
};

export const expireAnnualShares = async () => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    "UPDATE web_annual_shares SET status = 'expired' WHERE status = 'active' AND expires_at <= NOW()"
  );
};

export const expireAnnualShare = async (shareId: string) => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    "UPDATE web_annual_shares SET status = 'expired' WHERE id = ? AND status = 'active' AND expires_at <= NOW()",
    [shareId]
  );
};

export const listAnnualSharesNeedingPosterCleanup = async () => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<{ id: string }>[]>(
    `SELECT DISTINCT s.id
     FROM web_annual_shares s
     INNER JOIN web_annual_posters p ON p.share_id = s.id
     WHERE s.status != 'active' OR s.expires_at <= NOW()`
  );
  return rows.map((row) => row.id);
};

export const findAnnualPosterById = async (posterId: string) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualPosterRow>[]>(
    "SELECT * FROM web_annual_posters WHERE id = ? LIMIT 1",
    [posterId]
  );
  return rows[0] || null;
};

export const findAnnualPosterForShare = async (shareId: string, locale?: AnnualLocale) => {
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualShareCardRow>[]>(
    "SELECT * FROM web_annual_share_cards WHERE summary_id = ? AND locale = ? AND fingerprint = ? LIMIT 1",
    [summaryId, locale, fingerprint]
  );
  return rows[0] || null;
};

export const findOwnerAnnualShareCard = async (cardId: string, userId: number) => {
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    `INSERT INTO web_annual_share_cards
      (id, summary_id, user_id, locale, fingerprint, file_path, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE file_path = VALUES(file_path),
       width = VALUES(width), height = VALUES(height), updated_at = NOW()`,
    [input.id, input.summaryId, input.userId, input.locale, input.fingerprint, input.filePath, input.width, input.height]
  );
  // The row id must stay stable: concurrent first saves of the same fingerprint must
  // not steal each other's id, otherwise a later forum_thread_id write would miss.
  return findAnnualShareCard(input.summaryId, input.locale, input.fingerprint);
};

export const markAnnualShareCardForumSync = async (input: {
  cardId: string;
  imageUrl: string;
  threadId: number;
}) => {
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    `UPDATE web_annual_share_cards
     SET forum_image_url = ?, forum_thread_id = ?, updated_at = NOW()
     WHERE id = ? AND forum_thread_id IS NULL`,
    [input.imageUrl, input.threadId, input.cardId]
  );
  return result.affectedRows > 0;
};

export const listAnnualPosterPathsForShare = async (shareId: string) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<{ file_path: string }>[]>(
    "SELECT file_path FROM web_annual_posters WHERE share_id = ?",
    [shareId]
  );
  return rows.map((row) => row.file_path);
};

export const deleteAnnualPostersForShare = async (shareId: string) => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute("DELETE FROM web_annual_posters WHERE share_id = ?", [shareId]);
};

export const listAnnualSummaryGcCandidates = async () => {
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
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
  await ensureAccountSchema("annual");
  const [result] = await getAccountDb().execute<ResultSetHeader>("DELETE FROM web_annual_summaries WHERE id = ?", [summaryId]);
  return result.affectedRows > 0;
};

export const deleteOldAnnualJobs = async () => {
  await ensureAccountSchema("annual");
  await getAccountDb().execute(
    "DELETE FROM web_annual_summary_jobs WHERE status IN ('completed', 'failed', 'expired', 'cancelled') AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
  );
};

// Preserve a terminal failure across reloads; the entry UI must not auto-loop builds.
export const findLatestFailedAnnualBuild = async (userId: number, bindingId: number, versionKey: string) => {
  await ensureAccountSchema("annual");
  const [rows] = await getAccountDb().execute<DbRow<AnnualJobRow>[]>(
    `SELECT * FROM web_annual_summary_jobs WHERE user_id = ? AND binding_id = ?
     AND version_key = ? AND job_type = 'build' ORDER BY created_at DESC LIMIT 1`,
    [userId, bindingId, versionKey]
  );
  return rows[0]?.status === "failed" ? rows[0] : null;
};
