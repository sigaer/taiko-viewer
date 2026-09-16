import type { H3Event } from "h3";
import { createError } from "h3";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { requireAccountUser } from "~/server/utils/account";

export const hasAccountAnnualSummaryAccess = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<{ username: string; annual_summary_access: number }>[]>(
    `SELECT a.username, (w.user_id IS NOT NULL) AS annual_summary_access
     FROM web_user_accounts a
     LEFT JOIN web_annual_summary_access w ON w.user_id = a.id AND w.enabled = 1 AND w.feature = 'annual_first_run_beta'
     WHERE a.id = ?`,
    [userId]
  );
  const e2eMode = process.env.NODE_ENV !== "production" && process.env.TAIKO_ANNUAL_E2E_MODE === "1" && String(process.env.TAIKO_DB_NAME || "").endsWith("_test");
  return rows.some((row) => (
    e2eMode && /^annual_e2e_[0-9a-z_]+$/i.test(row.username)
  ) || Boolean(row.annual_summary_access));
};

export const requireAccountAnnualSummaryUser = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  if (!(await hasAccountAnnualSummaryAccess(user.id))) {
    throw createError({ statusCode: 403, statusMessage: "2026 年度回顾暂未对外开放" });
  }
  return user;
};
