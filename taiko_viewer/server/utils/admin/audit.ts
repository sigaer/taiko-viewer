import type { ResultSetHeader } from "mysql2/promise";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { safeJsonStringify } from "./shared";

export type AdminActionLogRecord = {
  id: number;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  source: string;
  target_type: string;
  target_key: string;
  action: string;
  before_json: string | null;
  after_json: string | null;
  extra_json: string | null;
  created_at: string;
};

export type AdminActionLogInput = {
  actorType: string;
  actorId?: string | null;
  actorName?: string | null;
  source: string;
  targetType: string;
  targetKey: string;
  action: "read" | "create" | "update" | "delete" | "login";
  before?: unknown;
  after?: unknown;
  extra?: unknown;
};

const toPublicLogRow = (row: AdminActionLogRecord) => ({
  id: row.id,
  actorType: row.actor_type,
  actorId: row.actor_id || "",
  actorName: row.actor_name || "",
  source: row.source,
  targetType: row.target_type,
  targetKey: row.target_key,
  action: row.action,
  before: row.before_json ? JSON.parse(row.before_json) : null,
  after: row.after_json ? JSON.parse(row.after_json) : null,
  extra: row.extra_json ? JSON.parse(row.extra_json) : null,
  createdAt: String(row.created_at || "")
});

export const recordAdminAction = async (input: AdminActionLogInput) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO web_admin_action_logs
      (actor_type, actor_id, actor_name, source, target_type, target_key, action, before_json, after_json, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.actorType,
      input.actorId || null,
      input.actorName || null,
      input.source,
      input.targetType,
      input.targetKey,
      input.action,
      input.before === undefined ? null : safeJsonStringify(input.before),
      input.after === undefined ? null : safeJsonStringify(input.after),
      input.extra === undefined ? null : safeJsonStringify(input.extra)
    ]
  );
  return result.insertId;
};

export const listAdminActionLogs = async (query: {
  page?: unknown;
  pageSize?: unknown;
  keyword?: unknown;
  source?: unknown;
  action?: unknown;
  targetType?: unknown;
}) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const page = Math.max(1, Math.floor(Number(query.page || 1) || 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(query.pageSize || 20) || 20)));
  const offset = (page - 1) * pageSize;
  const keyword = String(query.keyword || "").trim();
  const source = String(query.source || "").trim();
  const action = String(query.action || "").trim();
  const targetType = String(query.targetType || "").trim();
  const whereParts: string[] = [];
  const params: Array<string | number> = [];

  if (keyword) {
    whereParts.push(
      "(target_key LIKE ? OR actor_name LIKE ? OR actor_id LIKE ? OR source LIKE ? OR target_type LIKE ?)"
    );
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (source) {
    whereParts.push("source = ?");
    params.push(source);
  }
  if (action) {
    whereParts.push("action = ?");
    params.push(action);
  }
  if (targetType) {
    whereParts.push("target_type = ?");
    params.push(targetType);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const [countRows] = await db.execute<DbRow<{ total: number }>[]>(
    `SELECT COUNT(*) AS total FROM web_admin_action_logs ${whereSql}`,
    params
  );
  const [rows] = await db.execute<DbRow<AdminActionLogRecord>[]>(
    `SELECT *
     FROM web_admin_action_logs
     ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  return {
    total: Number(countRows[0]?.total || 0),
    page,
    pageSize,
    items: rows.map(toPublicLogRow)
  };
};
