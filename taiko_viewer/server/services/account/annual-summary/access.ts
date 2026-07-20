import type { H3Event } from "h3";
import { createError } from "h3";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { requireAccountUser } from "~/server/utils/account";

const ANNUAL_SUMMARY_ALLOWED_STAFF = [
  { username: "sigaer", taikoId: "2258735" }
];

export const hasAccountAnnualSummaryAccess = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<{ username: string; taiko_id: string }>[]>(
    `SELECT a.username, b.taiko_id
     FROM web_user_accounts a
     INNER JOIN web_taiko_bindings b ON b.user_id = a.id
     WHERE a.id = ?`,
    [userId]
  );
  return rows.some((row) => ANNUAL_SUMMARY_ALLOWED_STAFF.some(
    (staff) => row.username === staff.username && String(row.taiko_id || "").trim() === staff.taikoId
  ));
};

export const requireAccountAnnualSummaryUser = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  if (!(await hasAccountAnnualSummaryAccess(user.id))) {
    throw createError({ statusCode: 403, statusMessage: "2026 年度回顾暂未对外开放" });
  }
  return user;
};
