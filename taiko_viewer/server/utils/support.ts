import type { H3Event } from "h3";
import { createError } from "h3";
import type { ResultSetHeader } from "mysql2/promise";
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketListResponse,
  SupportTicketCreateResponse
} from "~/types/support";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";
import { requireAccountUser } from "~/server/utils/account/auth";
import { clipText, ensureNonEmpty, sendAccountMail, toIso } from "../internal/account/shared";

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
  created_at: Date | string;
  updated_at: Date | string;
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

const getSupportInbox = () => {
  const runtimeConfig = useRuntimeConfig();
  const inbox = String(runtimeConfig.supportInbox || process.env.TAIKO_SUPPORT_INBOX || "").trim();
  return inbox || SUPPORT_INBOX_FALLBACK;
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

const toSupportTicket = (row: SupportTicketRow): SupportTicket => ({
  id: row.id,
  title: row.title,
  category: row.category,
  content: row.content,
  contact: row.contact,
  status: row.status,
  mailStatus: row.mail_status,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const sendSupportTicketNotification = async (payload: {
  ticketId: number;
  title: string;
  category: SupportTicketCategory;
  content: string;
  contact: string | null;
  createdAt: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}) => {
  const categoryLabel = SUPPORT_CATEGORY_LABELS[payload.category];
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
    payload.content
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
    </div>
  `.trim();

  await sendAccountMail({
    to: getSupportInbox(),
    replyTo: payload.user.email,
    subject: `[Viewer 工单 #${payload.ticketId}] ${categoryLabel} - ${payload.title}`,
    text,
    html
  });
};

const loadTicketById = async (ticketId: number) => {
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SupportTicketRow>[]>(
    `SELECT id, user_id, title, category, content, contact, status, mail_status, mail_error, created_at, updated_at
     FROM web_support_tickets
     WHERE id = ?
     LIMIT 1`,
    [ticketId]
  );
  return rows[0] || null;
};

export const listSupportTickets = async (event: H3Event): Promise<SupportTicketListResponse> => {
  await ensureAccountSchema();
  const user = await requireAccountUser(event);
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SupportTicketRow>[]>(
    `SELECT id, user_id, title, category, content, contact, status, mail_status, mail_error, created_at, updated_at
     FROM web_support_tickets
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [user.id]
  );
  return {
    items: rows.map(toSupportTicket)
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

  const ticketRow = await loadTicketById(result.insertId);
  if (!ticketRow) {
    throw createError({ statusCode: 500, statusMessage: "工单已提交，但读取工单结果失败" });
  }

  return {
    ok: true,
    ticket: toSupportTicket(ticketRow),
    mailDelivered
  };
};
