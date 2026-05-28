import type { H3Event } from "h3";
import { createError } from "h3";
import type { ResultSetHeader } from "mysql2/promise";
import type {
  SupportMessageAuthorRole,
  SupportReviewDashboard,
  SupportReviewTicketSummary,
  SupportStaffReplyResponse,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketCreateResponse,
  SupportTicketDetail,
  SupportTicketListResponse,
  SupportTicketMessage,
  SupportTicketUserSummary,
  SupportUserMessageResponse
} from "~/types/support";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";
import { requireAccountUser } from "~/server/utils/account/auth";
import {
  clipText,
  ensureNonEmpty,
  isSiteOperator,
  sendAccountMail,
  toIso
} from "../internal/account/shared";

type SupportTicketRow = {
  id: number;
  user_id: number;
  title: string;
  category: SupportTicketCategory;
  content: string;
  contact: string | null;
  status: "open" | "closed";
  mail_status: "pending" | "sent" | "failed";
  mail_error: string | null;
  staff_last_read_at: Date | string | null;
  user_last_read_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  username?: string;
  email?: string;
};

type SupportTicketMessageRow = {
  id: number;
  ticket_id: number;
  author_role: SupportMessageAuthorRole;
  author_user_id: number;
  content: string;
  mail_status: "pending" | "sent" | "failed" | "skipped";
  mail_error: string | null;
  created_at: Date | string;
  username?: string;
};

const SUPPORT_CATEGORIES = new Set<SupportTicketCategory>([
  "account",
  "sync",
  "forum",
  "data",
  "bug",
  "feature",
  "other"
]);

const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  account: "账号问题",
  sync: "同步问题",
  forum: "论坛社区",
  data: "数据内容",
  bug: "站点异常",
  feature: "功能建议",
  other: "其他"
};

const SUPPORT_INBOX_FALLBACK = "1106865024@qq.com";
const SUPPORT_SITE_BASE_FALLBACK = "https://forum.sakura-bot.cn";

const getSupportInbox = () => {
  const runtimeConfig = useRuntimeConfig();
  const inbox = String(runtimeConfig.supportInbox || process.env.TAIKO_SUPPORT_INBOX || "").trim();
  return inbox || SUPPORT_INBOX_FALLBACK;
};

const getSupportSiteBaseUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  const base = String(runtimeConfig.public?.siteBaseUrl || process.env.TAIKO_PUBLIC_BASE_URL || "").trim();
  return (base || SUPPORT_SITE_BASE_FALLBACK).replace(/\/+$/, "");
};

const buildSupportReviewUrl = (ticketId: number) =>
  `${getSupportSiteBaseUrl()}/account/support/review?id=${ticketId}`;

const buildSupportPageUrl = () => `${getSupportSiteBaseUrl()}/support`;

export const requireSiteOperator = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  if (!isSiteOperator(user)) {
    throw createError({ statusCode: 403, statusMessage: "无权访问工单审批台" });
  }
  return user;
};

const normalizeSupportContent = (value: unknown, limit: number) => {
  const normalized = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trim();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderMultilineHtml = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");

const normalizeCategory = (value: unknown): SupportTicketCategory => {
  const category = String(value || "").trim() as SupportTicketCategory;
  if (!SUPPORT_CATEGORIES.has(category)) {
    throw createError({ statusCode: 400, statusMessage: "工单分类无效" });
  }
  return category;
};

const normalizeSupportTicketInput = (payload: Record<string, unknown>) => {
  const title = clipText(String(payload.title || "").trim(), 120);
  const content = normalizeSupportContent(payload.content, 8000);
  const contact = clipText(String(payload.contact || "").trim(), 255);
  const category = normalizeCategory(payload.category);
  ensureNonEmpty(title, "请输入工单标题");
  ensureNonEmpty(content, "请输入工单内容");
  return {
    title,
    category,
    content,
    contact: contact || null
  };
};

const normalizeMessageInput = (payload: Record<string, unknown>) => {
  const content = normalizeSupportContent(payload.content, 8000);
  ensureNonEmpty(content, "请输入留言内容");
  return content;
};

const toSupportTicket = (
  row: SupportTicketRow,
  extras: { hasUnread?: boolean; messageCount?: number } = {}
): SupportTicket => ({
  id: row.id,
  title: row.title,
  category: row.category,
  content: row.content,
  contact: row.contact,
  status: row.status,
  mailStatus: row.mail_status,
  hasUnread: extras.hasUnread,
  messageCount: extras.messageCount,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const toSupportTicketUser = (row: SupportTicketRow): SupportTicketUserSummary => ({
  id: row.user_id,
  username: String(row.username || ""),
  email: String(row.email || "")
});

const toSupportMessage = (row: SupportTicketMessageRow, options: { isInitial?: boolean } = {}): SupportTicketMessage => ({
  id: row.id,
  authorRole: row.author_role,
  authorUserId: row.author_user_id,
  authorUsername: row.username || undefined,
  content: row.content,
  mailStatus: row.mail_status,
  createdAt: toIso(row.created_at),
  isInitial: options.isInitial
});

const buildInitialMessage = (row: SupportTicketRow, username?: string): SupportTicketMessage => ({
  id: 0,
  authorRole: "user",
  authorUserId: row.user_id,
  authorUsername: username,
  content: row.content,
  mailStatus: "skipped",
  createdAt: toIso(row.created_at),
  isInitial: true
});

const sendSupportTicketNotification = async (payload: {
  ticketId: number;
  title: string;
  category: SupportTicketCategory;
  content: string;
  contact: string | null;
  createdAt: string;
  user: SupportTicketUserSummary;
}) => {
  const categoryLabel = SUPPORT_CATEGORY_LABELS[payload.category];
  const reviewUrl = buildSupportReviewUrl(payload.ticketId);
  const text = [
    `Viewer 工单 #${payload.ticketId}`,
    `分类：${categoryLabel} (${payload.category})`,
    `标题：${payload.title}`,
    `提交人：${payload.user.username} <${payload.user.email}>`,
    `用户 ID：${payload.user.id}`,
    `联系信息：${payload.contact || "未填写"}`,
    `提交时间：${payload.createdAt}`,
    "",
    "工单内容：",
    payload.content,
    "",
    "请前往工单审批台回复，不要直接回复此邮件：",
    reviewUrl
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.65; color: #222;">
      <h2 style="margin: 0 0 16px;">Viewer 工单 #${payload.ticketId}</h2>
      <p><strong>分类：</strong>${escapeHtml(categoryLabel)} (${escapeHtml(payload.category)})</p>
      <p><strong>标题：</strong>${escapeHtml(payload.title)}</p>
      <p><strong>提交人：</strong>${escapeHtml(payload.user.username)} &lt;${escapeHtml(payload.user.email)}&gt;</p>
      <p><strong>用户 ID：</strong>${payload.user.id}</p>
      <p><strong>联系信息：</strong>${payload.contact ? escapeHtml(payload.contact) : "未填写"}</p>
      <p><strong>提交时间：</strong>${escapeHtml(payload.createdAt)}</p>
      <p><strong>工单内容：</strong></p>
      <div style="padding: 12px 14px; border-radius: 10px; background: #f7f7f9; white-space: normal;">${renderMultilineHtml(payload.content)}</div>
      <p style="margin-top: 18px;"><strong>请前往工单审批台回复，不要直接回复此邮件。</strong></p>
      <p><a href="${escapeHtml(reviewUrl)}">${escapeHtml(reviewUrl)}</a></p>
    </div>
  `.trim();

  await sendAccountMail({
    to: getSupportInbox(),
    subject: `[Viewer 工单 #${payload.ticketId}] ${categoryLabel} - ${payload.title}`,
    text,
    html
  });
};

const sendSupportFollowUpNotification = async (payload: {
  ticketId: number;
  title: string;
  content: string;
  user: SupportTicketUserSummary;
  createdAt: string;
}) => {
  const reviewUrl = buildSupportReviewUrl(payload.ticketId);
  const text = [
    `Viewer 工单 #${payload.ticketId} 收到新的用户留言`,
    `标题：${payload.title}`,
    `用户：${payload.user.username} <${payload.user.email}>`,
    `留言时间：${payload.createdAt}`,
    "",
    "留言内容：",
    payload.content,
    "",
    "请前往工单审批台处理：",
    reviewUrl
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.65; color: #222;">
      <h2 style="margin: 0 0 16px;">工单 #${payload.ticketId} 收到新的用户留言</h2>
      <p><strong>标题：</strong>${escapeHtml(payload.title)}</p>
      <p><strong>用户：</strong>${escapeHtml(payload.user.username)} &lt;${escapeHtml(payload.user.email)}&gt;</p>
      <p><strong>留言时间：</strong>${escapeHtml(payload.createdAt)}</p>
      <p><strong>留言内容：</strong></p>
      <div style="padding: 12px 14px; border-radius: 10px; background: #f7f7f9;">${renderMultilineHtml(payload.content)}</div>
      <p style="margin-top: 18px;"><strong>请前往工单审批台处理，不要直接回复此邮件。</strong></p>
      <p><a href="${escapeHtml(reviewUrl)}">${escapeHtml(reviewUrl)}</a></p>
    </div>
  `.trim();

  await sendAccountMail({
    to: getSupportInbox(),
    subject: `[Viewer 工单 #${payload.ticketId}] 用户追加留言 - ${payload.title}`,
    text,
    html
  });
};

const sendSupportReplyToUser = async (payload: {
  ticketId: number;
  title: string;
  content: string;
  username: string;
  email: string;
  closed: boolean;
}) => {
  const supportUrl = buildSupportPageUrl();
  const statusNote = payload.closed ? "此工单已标记为处理完成。" : "如需继续沟通，可在工单支持页追加留言。";
  const text = [
    `${payload.username}，你的 Viewer 工单 #${payload.ticketId} 收到站务回复。`,
    `标题：${payload.title}`,
    "",
    "站务回复：",
    payload.content,
    "",
    statusNote,
    `工单支持页：${supportUrl}`
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.65; color: #222;">
      <p>${escapeHtml(payload.username)}，你的 Viewer 工单 #${payload.ticketId} 收到站务回复。</p>
      <p><strong>标题：</strong>${escapeHtml(payload.title)}</p>
      <p><strong>站务回复：</strong></p>
      <div style="padding: 12px 14px; border-radius: 10px; background: #f7f7f9;">${renderMultilineHtml(payload.content)}</div>
      <p style="margin-top: 16px;">${escapeHtml(statusNote)}</p>
      <p><a href="${escapeHtml(supportUrl)}">${escapeHtml(supportUrl)}</a></p>
    </div>
  `.trim();

  await sendAccountMail({
    to: payload.email,
    subject: `[Viewer 工单 #${payload.ticketId}] 站务回复：${payload.title}`,
    text,
    html
  });
};

const loadTicketRowById = async (ticketId: number, withUser = false) => {
  const db = getAccountDb();
  const userSelect = withUser ? ", u.username, u.email" : "";
  const userJoin = withUser ? "INNER JOIN web_user_accounts u ON u.id = t.user_id" : "";
  const [rows] = await db.execute<DbRow<SupportTicketRow>[]>(
    `SELECT t.id, t.user_id, t.title, t.category, t.content, t.contact, t.status, t.mail_status, t.mail_error,
            t.staff_last_read_at, t.user_last_read_at, t.created_at, t.updated_at${userSelect}
     FROM web_support_tickets t
     ${userJoin}
     WHERE t.id = ?
     LIMIT 1`,
    [ticketId]
  );
  return rows[0] || null;
};

const loadTicketMessages = async (ticketId: number) => {
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SupportTicketMessageRow>[]>(
    `SELECT m.id, m.ticket_id, m.author_role, m.author_user_id, m.content, m.mail_status, m.mail_error, m.created_at,
            u.username
     FROM web_support_ticket_messages m
     INNER JOIN web_user_accounts u ON u.id = m.author_user_id
     WHERE m.ticket_id = ?
     ORDER BY m.created_at ASC, m.id ASC`,
    [ticketId]
  );
  return rows;
};

const countTicketMessages = async (ticketId: number) => {
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<{ total: number }>[]>(
    "SELECT COUNT(*) AS total FROM web_support_ticket_messages WHERE ticket_id = ?",
    [ticketId]
  );
  return Number(rows[0]?.total || 0);
};

const computeUserUnread = async (row: SupportTicketRow) => {
  const db = getAccountDb();
  const userLastRead = row.user_last_read_at ? toIso(row.user_last_read_at) : null;
  const [rows] = await db.execute<DbRow<{ total: number }>[]>(
    `SELECT COUNT(*) AS total
     FROM web_support_ticket_messages
     WHERE ticket_id = ?
       AND author_role = 'staff'
       AND (? IS NULL OR created_at > ?)`,
    [row.id, userLastRead, userLastRead]
  );
  return Number(rows[0]?.total || 0) > 0;
};

const computeStaffUnread = (row: SupportTicketRow) => {
  if (row.status !== "open") return false;
  if (!row.staff_last_read_at) return true;
  return toIso(row.updated_at) > toIso(row.staff_last_read_at);
};

const buildTicketThread = async (row: SupportTicketRow, username?: string): Promise<SupportTicketMessage[]> => {
  const messageRows = await loadTicketMessages(row.id);
  return [buildInitialMessage(row, username), ...messageRows.map((item) => toSupportMessage(item))];
};

const buildTicketDetail = async (
  row: SupportTicketRow,
  options: { markUserRead?: boolean; markStaffRead?: boolean } = {}
): Promise<SupportTicketDetail> => {
  const db = getAccountDb();
  if (options.markUserRead) {
    await db.execute("UPDATE web_support_tickets SET user_last_read_at = NOW() WHERE id = ?", [row.id]);
    row.user_last_read_at = new Date();
  }
  if (options.markStaffRead) {
    await db.execute("UPDATE web_support_tickets SET staff_last_read_at = NOW() WHERE id = ?", [row.id]);
    row.staff_last_read_at = new Date();
  }

  const messageCount = await countTicketMessages(row.id);
  const hasUnread = options.markUserRead ? false : await computeUserUnread(row);
  const messages = await buildTicketThread(row, row.username);

  return {
    ...toSupportTicket(row, { hasUnread, messageCount }),
    messages,
    user: row.username
      ? {
          id: row.user_id,
          username: row.username,
          email: String(row.email || "")
        }
      : undefined
  };
};

const insertTicketMessage = async (payload: {
  ticketId: number;
  authorRole: SupportMessageAuthorRole;
  authorUserId: number;
  content: string;
  mailStatus?: "pending" | "sent" | "failed" | "skipped";
  mailError?: string | null;
}) => {
  const db = getAccountDb();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO web_support_ticket_messages (ticket_id, author_role, author_user_id, content, mail_status, mail_error)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.ticketId,
      payload.authorRole,
      payload.authorUserId,
      payload.content,
      payload.mailStatus || "skipped",
      payload.mailError || null
    ]
  );
  await db.execute("UPDATE web_support_tickets SET updated_at = NOW() WHERE id = ?", [payload.ticketId]);
  return result.insertId;
};

export const listSupportTickets = async (event: H3Event): Promise<SupportTicketListResponse> => {
  await ensureAccountSchema();
  const user = await requireAccountUser(event);
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SupportTicketRow>[]>(
    `SELECT id, user_id, title, category, content, contact, status, mail_status, mail_error,
            staff_last_read_at, user_last_read_at, created_at, updated_at
     FROM web_support_tickets
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [user.id]
  );

  const items = await Promise.all(
    rows.map(async (row) => {
      const [messageCount, hasUnread] = await Promise.all([
        countTicketMessages(row.id),
        computeUserUnread(row)
      ]);
      return toSupportTicket(row, { messageCount, hasUnread });
    })
  );

  return { items };
};

export const getSupportTicketDetail = async (event: H3Event, ticketIdInput: unknown): Promise<SupportTicketDetail> => {
  await ensureAccountSchema();
  const user = await requireAccountUser(event);
  const ticketId = Number(ticketIdInput);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "工单编号无效" });
  }

  const row = await loadTicketRowById(ticketId);
  if (!row || row.user_id !== user.id) {
    throw createError({ statusCode: 404, statusMessage: "工单不存在" });
  }

  return buildTicketDetail(row, { markUserRead: true });
};

export const addSupportTicketMessage = async (
  event: H3Event,
  ticketIdInput: unknown,
  payload: Record<string, unknown>
): Promise<SupportUserMessageResponse> => {
  await ensureAccountSchema();
  const user = await requireAccountUser(event);
  const ticketId = Number(ticketIdInput);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "工单编号无效" });
  }

  const row = await loadTicketRowById(ticketId, true);
  if (!row || row.user_id !== user.id) {
    throw createError({ statusCode: 404, statusMessage: "工单不存在" });
  }
  if (row.status !== "open") {
    throw createError({ statusCode: 400, statusMessage: "工单已关闭，请提交新工单" });
  }

  const content = normalizeMessageInput(payload);
  let mailDelivered = true;
  let mailError: string | null = null;

  const messageId = await insertTicketMessage({
    ticketId,
    authorRole: "user",
    authorUserId: user.id,
    content,
    mailStatus: "pending"
  });

  try {
    await sendSupportFollowUpNotification({
      ticketId,
      title: row.title,
      content,
      user: toSupportTicketUser(row),
      createdAt: new Date().toISOString()
    });
    await getAccountDb().execute(
      "UPDATE web_support_ticket_messages SET mail_status = 'sent', mail_error = NULL WHERE id = ?",
      [messageId]
    );
  } catch (error: any) {
    mailDelivered = false;
    mailError = clipText(String(error?.message || error?.statusMessage || "邮件发送失败"), 255);
    await getAccountDb().execute(
      "UPDATE web_support_ticket_messages SET mail_status = 'failed', mail_error = ? WHERE id = ?",
      [mailError, messageId]
    );
  }

  const refreshed = await loadTicketRowById(ticketId, true);
  if (!refreshed) {
    throw createError({ statusCode: 500, statusMessage: "留言已提交，但读取工单失败" });
  }

  return {
    ok: true,
    ticket: await buildTicketDetail(refreshed),
    mailDelivered
  };
};

export const createSupportTicket = async (
  event: H3Event,
  payload: Record<string, unknown>
): Promise<SupportTicketCreateResponse> => {
  await ensureAccountSchema();
  const user = await requireAccountUser(event);
  const normalized = normalizeSupportTicketInput(payload);
  const db = getAccountDb();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO web_support_tickets (user_id, title, category, content, contact, status, mail_status)
     VALUES (?, ?, ?, ?, ?, 'open', 'pending')`,
    [user.id, normalized.title, normalized.category, normalized.content, normalized.contact]
  );

  let mailDelivered = true;
  try {
    await sendSupportTicketNotification({
      ticketId: result.insertId,
      title: normalized.title,
      category: normalized.category,
      content: normalized.content,
      contact: normalized.contact,
      createdAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
    await db.execute(
      "UPDATE web_support_tickets SET mail_status = 'sent', mail_error = NULL WHERE id = ?",
      [result.insertId]
    );
  } catch (error: any) {
    mailDelivered = false;
    await db.execute(
      "UPDATE web_support_tickets SET mail_status = 'failed', mail_error = ? WHERE id = ?",
      [clipText(String(error?.message || error?.statusMessage || "邮件发送失败"), 255), result.insertId]
    );
  }

  const ticketRow = await loadTicketRowById(result.insertId);
  if (!ticketRow) {
    throw createError({ statusCode: 500, statusMessage: "工单已提交，但读取工单结果失败" });
  }

  return {
    ok: true,
    ticket: toSupportTicket(ticketRow, { messageCount: 0, hasUnread: false }),
    mailDelivered
  };
};

const toReviewSummary = (row: SupportTicketRow): SupportReviewTicketSummary => ({
  ...toSupportTicket(row, { messageCount: undefined }),
  hasUnread: computeStaffUnread(row),
  user: toSupportTicketUser(row)
});

export const getSupportReviewDashboard = async (event: H3Event): Promise<SupportReviewDashboard> => {
  await ensureAccountSchema();
  await requireSiteOperator(event);
  const db = getAccountDb();

  const [pendingRows] = await db.execute<DbRow<SupportTicketRow>[]>(
    `SELECT t.id, t.user_id, t.title, t.category, t.content, t.contact, t.status, t.mail_status, t.mail_error,
            t.staff_last_read_at, t.user_last_read_at, t.created_at, t.updated_at, u.username, u.email
     FROM web_support_tickets t
     INNER JOIN web_user_accounts u ON u.id = t.user_id
     WHERE t.status = 'open'
     ORDER BY t.updated_at DESC, t.id DESC
     LIMIT 50`
  );

  const [historyRows] = await db.execute<DbRow<SupportTicketRow>[]>(
    `SELECT t.id, t.user_id, t.title, t.category, t.content, t.contact, t.status, t.mail_status, t.mail_error,
            t.staff_last_read_at, t.user_last_read_at, t.created_at, t.updated_at, u.username, u.email
     FROM web_support_tickets t
     INNER JOIN web_user_accounts u ON u.id = t.user_id
     WHERE t.status = 'closed'
     ORDER BY t.updated_at DESC, t.id DESC
     LIMIT 20`
  );

  return {
    pending: pendingRows.map(toReviewSummary),
    history: historyRows.map(toReviewSummary)
  };
};

export const getSupportReviewTicketDetail = async (
  event: H3Event,
  ticketIdInput: unknown
): Promise<SupportTicketDetail> => {
  await ensureAccountSchema();
  await requireSiteOperator(event);
  const ticketId = Number(ticketIdInput);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "工单编号无效" });
  }

  const row = await loadTicketRowById(ticketId, true);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "工单不存在" });
  }

  return buildTicketDetail(row, { markStaffRead: true });
};

export const replySupportTicketAsStaff = async (
  event: H3Event,
  ticketIdInput: unknown,
  payload: Record<string, unknown>
): Promise<SupportStaffReplyResponse> => {
  await ensureAccountSchema();
  const staff = await requireSiteOperator(event);
  const ticketId = Number(ticketIdInput);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "工单编号无效" });
  }

  const row = await loadTicketRowById(ticketId, true);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "工单不存在" });
  }
  if (row.status !== "open") {
    throw createError({ statusCode: 400, statusMessage: "工单已关闭" });
  }

  const content = normalizeMessageInput(payload);
  const shouldClose = Boolean(payload.close);

  let mailDelivered = true;
  const messageId = await insertTicketMessage({
    ticketId,
    authorRole: "staff",
    authorUserId: staff.id,
    content,
    mailStatus: "pending"
  });

  try {
    await sendSupportReplyToUser({
      ticketId,
      title: row.title,
      content,
      username: String(row.username || ""),
      email: String(row.email || ""),
      closed: shouldClose
    });
    await getAccountDb().execute(
      "UPDATE web_support_ticket_messages SET mail_status = 'sent', mail_error = NULL WHERE id = ?",
      [messageId]
    );
  } catch (error: any) {
    mailDelivered = false;
    await getAccountDb().execute(
      "UPDATE web_support_ticket_messages SET mail_status = 'failed', mail_error = ? WHERE id = ?",
      [clipText(String(error?.message || error?.statusMessage || "邮件发送失败"), 255), messageId]
    );
  }

  if (shouldClose) {
    await getAccountDb().execute("UPDATE web_support_tickets SET status = 'closed' WHERE id = ?", [ticketId]);
  }

  const refreshed = await loadTicketRowById(ticketId, true);
  if (!refreshed) {
    throw createError({ statusCode: 500, statusMessage: "回复已提交，但读取工单失败" });
  }

  return {
    ok: true,
    ticket: await buildTicketDetail(refreshed, { markStaffRead: true }),
    mailDelivered
  };
};

export const closeSupportTicketAsStaff = async (
  event: H3Event,
  ticketIdInput: unknown
): Promise<{ ok: true; ticket: SupportTicketDetail }> => {
  await ensureAccountSchema();
  await requireSiteOperator(event);
  const ticketId = Number(ticketIdInput);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "工单编号无效" });
  }

  const row = await loadTicketRowById(ticketId, true);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "工单不存在" });
  }
  if (row.status === "closed") {
    return {
      ok: true,
      ticket: await buildTicketDetail(row, { markStaffRead: true })
    };
  }

  await getAccountDb().execute("UPDATE web_support_tickets SET status = 'closed' WHERE id = ?", [ticketId]);
  const refreshed = await loadTicketRowById(ticketId, true);
  if (!refreshed) {
    throw createError({ statusCode: 500, statusMessage: "关闭工单失败" });
  }

  return {
    ok: true,
    ticket: await buildTicketDetail(refreshed, { markStaffRead: true })
  };
};
