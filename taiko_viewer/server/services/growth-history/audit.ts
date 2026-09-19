import type { Connection, Pool, RowDataPacket } from "mysql2/promise";

export async function auditGrowthMeasurementOrphans(db: Pick<Pool, "query"> | Connection) {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT
    SUM(u.id IS NULL) AS userOrphans,
    SUM(b.id IS NULL) AS bindingOrphans,
    SUM(b.id IS NOT NULL AND b.user_id<>m.user_id) AS ownerMismatches
    FROM web_growth_measurements m
    LEFT JOIN web_user_accounts u ON u.id=m.user_id
    LEFT JOIN web_taiko_bindings b ON b.id=m.binding_id`);
  return { userOrphans: Number(rows[0]?.userOrphans || 0), bindingOrphans: Number(rows[0]?.bindingOrphans || 0), ownerMismatches: Number(rows[0]?.ownerMismatches || 0) };
}

export async function inspectGrowthMeasurementSchema(db: Pick<Pool, "query"> | Connection) {
  const [tables] = await db.query<RowDataPacket[]>("SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_growth_measurements'");
  if (!tables.length) return { exists: false, errors: [] as string[], foreignKeys: [] as string[] };
  const [columns] = await db.query<RowDataPacket[]>("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_growth_measurements'");
  const [indexes] = await db.query<RowDataPacket[]>("SELECT INDEX_NAME,NON_UNIQUE,COLUMN_NAME,SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_growth_measurements' ORDER BY INDEX_NAME,SEQ_IN_INDEX");
  const [foreignKeys] = await db.query<RowDataPacket[]>("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_growth_measurements' AND CONSTRAINT_TYPE='FOREIGN KEY'");
  const errors: string[] = [];
  const map = new Map(columns.map(column => [String(column.COLUMN_NAME), column]));
  for (const name of ["id","user_id","binding_id","score_revision","measurement_version","algorithm_version","model_revision","rating","dimensions_json","focus","sample_count","availability_state","captured_at","created_at"]) if (!map.has(name)) errors.push(`missing-${name}`);
  const groups = new Map<string, RowDataPacket[]>();
  for (const row of indexes) groups.set(String(row.INDEX_NAME), [...(groups.get(String(row.INDEX_NAME)) || []), row]);
  const unique = [...groups.values()].some(parts => Number(parts[0]?.NON_UNIQUE) === 0 && parts.map(part => part.COLUMN_NAME).join(",") === "binding_id,score_revision,algorithm_version");
  if (!unique) errors.push("revision-unique");
  if (foreignKeys.length) errors.push("foreign-keys");
  return { exists: true, errors, foreignKeys: foreignKeys.map(row => String(row.CONSTRAINT_NAME)), engine: String(tables[0].ENGINE), collation: String(tables[0].TABLE_COLLATION) };
}
