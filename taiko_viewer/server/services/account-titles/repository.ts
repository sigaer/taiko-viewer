import type { Pool, RowDataPacket } from "mysql2/promise";
import type { AccountTitle } from "../../../types/account-title.ts";

export const ANNUAL_BETA_TITLE: Readonly<AccountTitle> = Object.freeze({
  key: "annual-beta-pioneer",
  name: "虹光先行者",
  style: "rainbow"
});

/** Account ownership, independent of current game binding or annual access. */
export async function readAccountTitles(db: Pick<Pool, "execute">, userIds: number[]) {
  const ids = [...new Set(userIds.filter(id => Number.isSafeInteger(id) && id > 0))];
  const result = new Map<number, AccountTitle[]>();
  if (!ids.length) return result;
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT user_id, title_key FROM web_account_titles
     WHERE user_id IN (${ids.map(() => "?").join(",")}) AND revoked_at IS NULL
     ORDER BY title_key`, ids
  );
  for (const row of rows) {
    if (row.title_key !== ANNUAL_BETA_TITLE.key) continue;
    const titles = result.get(Number(row.user_id)) || [];
    titles.push({ ...ANNUAL_BETA_TITLE });
    result.set(Number(row.user_id), titles);
  }
  return result;
}
