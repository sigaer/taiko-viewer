import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ANNUAL_BETA_TITLE } from "./repository.ts";

export const ANNUAL_BETA_TITLE_SOURCE = "annual-report-closed-beta";
export const rosterHash = (ids: number[]) => createHash("sha256").update(ids.join("\n") + "\n").digest("hex");

export function normalizeRoster(input: unknown): number[] {
  if (!Array.isArray(input) || !input.length || input.length > 500 ||
      input.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(input).size !== input.length) {
    throw Error("Invalid account title roster");
  }
  return [...input].sort((a, b) => a - b);
}

export async function readAnnualBetaTitleRecipients(db: Pick<PoolConnection, "execute">) {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT a.user_id
    FROM web_annual_summary_access a
    JOIN web_user_accounts u ON u.id=a.user_id
    JOIN web_beta_invites i ON i.id=a.invite_id
    JOIN web_beta_participants p ON p.user_id=a.user_id AND p.invite_id=a.invite_id
    WHERE a.feature='annual_first_run_beta' AND i.analysis_excluded=0 AND p.analysis_excluded=0
    AND EXISTS (SELECT 1 FROM web_beta_events e WHERE e.participant_id=p.id
      AND e.user_id=a.user_id AND e.event_name='annual_report_open')
    ORDER BY a.user_id`);
  return rows.map(row => Number(row.user_id));
}

function assertSameRoster(actual: number[], expected: number[]) {
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    throw Error("Live closed-beta recipients differ from the reviewed roster; no titles granted");
  }
}

/** Caller must prove DB identity and explicit mutation opt-in before invoking. */
export async function grantAnnualBetaTitle(db: PoolConnection, input: number[], apply: boolean) {
  const ids = normalizeRoster(input);
  if (apply) await db.beginTransaction();
  else await db.query("START TRANSACTION READ ONLY");
  try {
    if (apply) {
      const [locked] = await db.execute<RowDataPacket[]>(
        `SELECT id FROM web_user_accounts WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`, ids);
      assertSameRoster(locked.map(row => Number(row.id)), ids);
    }
    assertSameRoster(await readAnnualBetaTitleRecipients(db), ids);
    const [existing] = await db.execute<RowDataPacket[]>(
      `SELECT user_id,source,revoked_at FROM web_account_titles WHERE title_key=? ORDER BY user_id${apply ? " FOR UPDATE" : ""}`,
      [ANNUAL_BETA_TITLE.key]);
    if (existing.some(row => !ids.includes(Number(row.user_id)) || row.revoked_at !== null || row.source !== ANNUAL_BETA_TITLE_SOURCE)) {
      throw Error("Existing title grants conflict with the reviewed campaign; no titles changed");
    }
    const missing = ids.filter(id => !existing.some(row => Number(row.user_id) === id));
    if (apply && missing.length) {
      for (const id of missing) await db.execute(
        "INSERT INTO web_account_titles(user_id,title_key,source) VALUES (?,?,?)",
        [id, ANNUAL_BETA_TITLE.key, ANNUAL_BETA_TITLE_SOURCE]);
      await db.execute(`INSERT INTO web_admin_action_logs
        (actor_type,actor_name,source,target_type,target_key,action,before_json,after_json,extra_json)
        VALUES ('system','annual-beta-title-cli','admin-cli','account-title',?,'grant',?,?,?)`,
        [ANNUAL_BETA_TITLE.key, JSON.stringify({ recipients: existing.length }), JSON.stringify({ recipients: ids.length }),
          JSON.stringify({ source: ANNUAL_BETA_TITLE_SOURCE, rosterSha256: rosterHash(ids), granted: missing.length })]);
    }
    if (apply) {
      const [after] = await db.execute<RowDataPacket[]>(
        "SELECT user_id FROM web_account_titles WHERE title_key=? AND revoked_at IS NULL ORDER BY user_id FOR UPDATE",
        [ANNUAL_BETA_TITLE.key]);
      assertSameRoster(after.map(row => Number(row.user_id)), ids);
      await db.commit();
    } else await db.rollback();
    return { title: ANNUAL_BETA_TITLE.name, recipients: ids.length, existing: existing.length,
      granted: apply ? missing.length : 0, pending: apply ? 0 : missing.length, rosterSha256: rosterHash(ids) };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}
