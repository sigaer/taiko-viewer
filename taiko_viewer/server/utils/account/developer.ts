import { readAuthorizedSourceUserdata } from "../../services/account/source-access.ts";
import { privateSourceResponse } from "../../infrastructure/account/private-source-response.ts";
import {isMergedSource} from '../../infrastructure/account/merged-source-id.ts';
import {readAuthorizedMergedSource} from '../../services/account/merged-source-read.ts';
import type { H3Event, MultiPartData } from "h3";
import { createError, isError } from "h3";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";
import type { ResultSetHeader } from "mysql2/promise";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import {
  type AccountRow,
  type DeveloperApplicationRow,
  ensureNonEmpty,
  isSiteOperator,
  sha256
} from "~/server/internal/account/shared";
import {
  type DeveloperApplicationPublic,
  generateDeveloperToken,
  getActiveDeveloperTokenRow,
  getDeveloperTokenRowByHash,
  maskDeveloperToken,
  normalizeDeveloperApplicationInput,
  normalizeReviewNote,
  readDeveloperApplicationMultipart,
  readDeveloperBearerToken,
  sendDeveloperApplicationNotification,
  sendDeveloperApprovedMail,
  sendDeveloperRejectedMail,
  toDeveloperApplicationPublic,
  toDeveloperTokenPublic,
  touchDeveloperToken,
  uploadDeveloperApplicationImages
} from "~/server/internal/account/developer";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { requireAccountUser } from "./auth";

type DeveloperApplicationJoinedRow = DeveloperApplicationRow & {
  applicant_id: number | null;
  applicant_username: string | null;
  applicant_email: string | null;
  reviewer_id: number | null;
  reviewer_username: string | null;
  reviewer_email: string | null;
};

const REVIEWER_SQL = `
  SELECT a.*,
         applicant.id AS applicant_id,
         applicant.username AS applicant_username,
         applicant.email AS applicant_email,
         reviewer.id AS reviewer_id,
         reviewer.username AS reviewer_username,
         reviewer.email AS reviewer_email
  FROM web_developer_applications a
  INNER JOIN web_user_accounts applicant ON applicant.id = a.user_id
  LEFT JOIN web_user_accounts reviewer ON reviewer.id = a.reviewed_by_user_id
`;

const getDeveloperApplicationRows = async (query: {
  userId?: number;
  status?: string;
  limit?: number;
}) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const conditions: string[] = [];
  const params: Array<number | string> = [];
  if (query.userId) {
    conditions.push("a.user_id = ?");
    params.push(query.userId);
  }
  if (query.status) {
    conditions.push("a.status = ?");
    params.push(query.status);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(50, Number(query.limit || 10)));
  const [rows] = await db.execute<DbRow<DeveloperApplicationJoinedRow>[]>(
    `${REVIEWER_SQL} ${whereClause} ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`,
    params
  );
  return rows;
};

const getLatestDeveloperApplicationRow = async (userId: number) => {
  const rows = await getDeveloperApplicationRows({ userId, limit: 1 });
  return rows[0] || null;
};

const getDeveloperApplicationHistory = async (userId: number) => {
  const rows = await getDeveloperApplicationRows({ userId, limit: 10 });
  return rows.map((row) => toDeveloperApplicationPublic(row)).filter(Boolean) as DeveloperApplicationPublic[];
};

export const isDeveloperReviewer = isSiteOperator;

export const requireDeveloperReviewer = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  if (!isDeveloperReviewer(user)) {
    throw createError({ statusCode: 403, statusMessage: "只有 sigaer 可以审批开发者权限申请" });
  }
  return user;
};

const revokeActiveDeveloperTokens = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  await db.execute(
    "UPDATE web_developer_tokens SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE user_id = ? AND status = 'active'",
    [userId]
  );
};

export const getDeveloperApplicationStatus = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  const [currentApplication, history, tokenRow] = await Promise.all([
    getLatestDeveloperApplicationRow(user.id),
    getDeveloperApplicationHistory(user.id),
    getActiveDeveloperTokenRow(user.id)
  ]);
  return {
    canReview: isDeveloperReviewer(user),
    currentApplication: toDeveloperApplicationPublic(currentApplication),
    history,
    token: toDeveloperTokenPublic(tokenRow)
  };
};

const ensureDeveloperApplicationAllowed = async (userId: number) => {
  const latest = await getLatestDeveloperApplicationRow(userId);
  if (!latest) return;
  if (latest.status === "pending") {
    throw createError({ statusCode: 409, statusMessage: "你已有待审批的开发者申请，请等待处理结果" });
  }
  if (latest.status === "approved") {
    throw createError({ statusCode: 409, statusMessage: "你的开发者权限已通过，无需重复申请" });
  }
};

export const submitDeveloperApplication = async (
  event: H3Event,
  form?: { reason: string; replyEmail: string; images: MultiPartData[] }
) => {
  const user = await requireAccountUser(event);
  await ensureDeveloperApplicationAllowed(user.id);
  const payload = form || (await readDeveloperApplicationMultipart(event));
  const normalized = normalizeDeveloperApplicationInput(payload);
  const imageUrls = await uploadDeveloperApplicationImages(user.id, payload.images);
  const db = getAccountDb();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO web_developer_applications
      (user_id, reply_email, reason, image_urls_json, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [user.id, normalized.replyEmail, normalized.reason, JSON.stringify(imageUrls)]
  );
  const [rows] = await db.execute<DbRow<DeveloperApplicationJoinedRow>[]>(
    `${REVIEWER_SQL} WHERE a.id = ? LIMIT 1`,
    [result.insertId]
  );
  await sendDeveloperApplicationNotification({
    applicantUsername: user.username,
    applicantEmail: user.email,
    replyEmail: normalized.replyEmail,
    reason: normalized.reason,
    imageUrls,
    createdAt: rows[0]?.created_at ? String(rows[0].created_at) : new Date().toISOString()
  });
  return {
    ok: true,
    application: toDeveloperApplicationPublic(rows[0] || null)
  };
};

export const getDeveloperReviewDashboard = async (event: H3Event) => {
  await requireDeveloperReviewer(event);
  const [pendingRows, historyRows] = await Promise.all([
    getDeveloperApplicationRows({ status: "pending", limit: 20 }),
    getDeveloperApplicationRows({ limit: 30 })
  ]);
  return {
    pending: pendingRows.map((row) => toDeveloperApplicationPublic(row)).filter(Boolean) as DeveloperApplicationPublic[],
    history: historyRows.map((row) => toDeveloperApplicationPublic(row)).filter(Boolean) as DeveloperApplicationPublic[]
  };
};

export const reviewDeveloperApplication = async (
  event: H3Event,
  payload: { applicationId?: unknown; action?: unknown; reviewNote?: unknown }
) => {
  const reviewer = await requireDeveloperReviewer(event);
  const applicationId = Number(payload.applicationId || 0);
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "申请记录无效" });
  }
  const action = String(payload.action || "").trim().toLowerCase();
  if (!["approve", "reject"].includes(action)) {
    throw createError({ statusCode: 400, statusMessage: "审批动作无效" });
  }
  const reviewNote = normalizeReviewNote(payload.reviewNote, action === "reject");
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<DeveloperApplicationJoinedRow>[]>(
    `${REVIEWER_SQL} WHERE a.id = ? LIMIT 1`,
    [applicationId]
  );
  const application = rows[0];
  if (!application) {
    throw createError({ statusCode: 404, statusMessage: "未找到该开发者申请" });
  }
  if (application.status !== "pending") {
    throw createError({ statusCode: 409, statusMessage: "该申请已处理，请刷新后重试" });
  }

  let issuedToken = "";
  let mailDelivered = true;
  if (action === "approve") {
    issuedToken = generateDeveloperToken();
    await revokeActiveDeveloperTokens(application.user_id);
    await db.execute(
      `INSERT INTO web_developer_tokens
        (user_id, application_id, token_hash, token_mask, status, issued_by_user_id)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [application.user_id, application.id, sha256(issuedToken), maskDeveloperToken(issuedToken), reviewer.id]
    );
    await db.execute(
      `UPDATE web_developer_applications
       SET status = 'approved',
           review_note = ?,
           reviewed_by_user_id = ?,
           reviewed_at = NOW()
       WHERE id = ?`,
      [reviewNote || null, reviewer.id, application.id]
    );
    try {
      await sendDeveloperApprovedMail({
        email: application.reply_email,
        username: application.applicant_username || application.applicant_email || `用户 ${application.user_id}`,
        token: issuedToken,
        reviewNote
      });
    } catch (error) {
      console.error("[developer] 审批通过邮件发送失败", { applicationId, error });
      mailDelivered = false;
    }
  } else {
    await db.execute(
      `UPDATE web_developer_applications
       SET status = 'rejected',
           review_note = ?,
           reviewed_by_user_id = ?,
           reviewed_at = NOW()
       WHERE id = ?`,
      [reviewNote, reviewer.id, application.id]
    );
    try {
      await sendDeveloperRejectedMail({
        email: application.reply_email,
        username: application.applicant_username || application.applicant_email || `用户 ${application.user_id}`,
        reviewNote
      });
    } catch (error) {
      console.error("[developer] 审批拒绝邮件发送失败", { applicationId, error });
      mailDelivered = false;
    }
  }

  const [updatedRows] = await db.execute<DbRow<DeveloperApplicationJoinedRow>[]>(
    `${REVIEWER_SQL} WHERE a.id = ? LIMIT 1`,
    [application.id]
  );
  return {
    ok: true,
    action,
    mailDelivered,
    issuedToken: issuedToken || null,
    application: toDeveloperApplicationPublic(updatedRows[0] || application)
  };
};

export const requireDeveloperToken = async (event: H3Event) => {
  const token = readDeveloperBearerToken(event);
  ensureNonEmpty(token, "缺少开发者 token");
  const row = await getDeveloperTokenRowByHash(token);
  if (!row) {
    throw createError({ statusCode: 401, statusMessage: "开发者 token 无效或已失效" });
  }
  await touchDeveloperToken(row.id);
  return row;
};

export const getDeveloperUserdataByUserid = async (event: H3Event, useridInput: unknown) => {
  try {
    await enforceTaikoOpenQuota(event, "developer_userdata");
    const userid = String(useridInput || "").trim();
    ensureNonEmpty(userid, "缺少 userid");
    return await privateSourceResponse(event, 'current', () => isMergedSource(userid)?readAuthorizedMergedSource(event,userid,'current'):readAuthorizedSourceUserdata(event, userid));
  } catch (error) {
    if (isError(error) || error instanceof PublicationUnavailableError) throw error;
    throw new PublicationUnavailableError();
  }
};
