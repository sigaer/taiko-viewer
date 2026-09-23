import type { Pool, RowDataPacket } from "mysql2/promise";

export async function inspectGrowthRecentCursorSchema(db: Pick<Pool, "query">) {
  const [tables] = await db.query<RowDataPacket[]>("SHOW TABLES LIKE 'web_growth_recent_cursors'");
  if (!tables.length) return { exists: false, errors: ["missing-table"], foreignKeys: [] as string[] };
  const [columns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM web_growth_recent_cursors");
  const [indexes] = await db.query<RowDataPacket[]>("SHOW INDEX FROM web_growth_recent_cursors");
  const [foreignKeys] = await db.query<RowDataPacket[]>(`SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_growth_recent_cursors' AND REFERENCED_TABLE_NAME IS NOT NULL`);
  const byName = new Map(columns.map(row => [String(row.Field), String(row.Type).toLowerCase()]));
  const expected: Record<string, RegExp> = {
    user_id: /^bigint unsigned$/,
    binding_id: /^bigint unsigned$/,
    cursor_token: /^char\(64\)$/,
    observation_revision: /^char\(64\)$/,
    observation_observed_at: /^datetime\(3\)$/,
    algorithm_version: /^varchar\(64\)$/,
    created_at: /^datetime\(3\)$/,
    updated_at: /^datetime\(3\)$/
  };
  const errors: string[] = [];
  for (const [name, type] of Object.entries(expected)) {
    if (!byName.has(name)) errors.push(`missing-column:${name}`);
    else if (!type.test(byName.get(name)!)) errors.push(`column-type:${name}`);
  }
  const primary = indexes.filter(row => String(row.Key_name) === "PRIMARY").sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index)).map(row => String(row.Column_name));
  if (primary.join(",") !== "binding_id") errors.push("primary-key");
  const ownerIndex = indexes.filter(row => String(row.Key_name) === "idx_growth_recent_cursor_owner").sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index)).map(row => String(row.Column_name));
  if (ownerIndex.join(",") !== "user_id,binding_id") errors.push("owner-index");
  return { exists: true, errors, foreignKeys: foreignKeys.map(row => String(row.CONSTRAINT_NAME)) };
}

export async function auditGrowthRecentCursorOrphans(db: Pick<Pool, "query">) {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT
    SUM(u.id IS NULL) AS userOrphans,
    SUM(b.id IS NULL) AS bindingOrphans,
    SUM(b.id IS NOT NULL AND b.user_id<>c.user_id) AS ownerMismatches
    FROM web_growth_recent_cursors c
    LEFT JOIN web_user_accounts u ON u.id=c.user_id
    LEFT JOIN web_taiko_bindings b ON b.id=c.binding_id`);
  return {
    userOrphans: Number(rows[0]?.userOrphans || 0),
    bindingOrphans: Number(rows[0]?.bindingOrphans || 0),
    ownerMismatches: Number(rows[0]?.ownerMismatches || 0)
  };
}
