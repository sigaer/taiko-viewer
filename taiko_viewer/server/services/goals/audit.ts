import type { Connection, Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
type Database = Connection | Pool | PoolConnection;
export async function auditGoalOrphans(db: Database) {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT
    SUM(u.id IS NULL) AS userOrphans,
    SUM(b.id IS NULL) AS bindingOrphans,
    SUM(b.id IS NOT NULL AND b.user_id <> g.user_id) AS ownerMismatches
    FROM web_player_goals g
    LEFT JOIN web_user_accounts u ON u.id=g.user_id
    LEFT JOIN web_taiko_bindings b ON b.id=g.binding_id`);
  return { userOrphans: Number(rows[0]?.userOrphans || 0), bindingOrphans: Number(rows[0]?.bindingOrphans || 0), ownerMismatches: Number(rows[0]?.ownerMismatches || 0) };
}
export async function inspectGoalSchema(db: Database) {
  const [tables] = await db.query<RowDataPacket[]>("SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_player_goals'");
  if (!tables.length) return { exists: false as const, errors: [], showCreateTable: null };
  const [columns] = await db.query<RowDataPacket[]>("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,EXTRA,GENERATION_EXPRESSION,DATETIME_PRECISION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_player_goals'");
  const [indexes] = await db.query<RowDataPacket[]>("SELECT INDEX_NAME,NON_UNIQUE,COLUMN_NAME,SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_player_goals' ORDER BY INDEX_NAME,SEQ_IN_INDEX");
  const [foreignKeys] = await db.query<RowDataPacket[]>("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_player_goals' AND CONSTRAINT_TYPE='FOREIGN KEY'");
  const [ddl] = await db.query<RowDataPacket[]>('SHOW CREATE TABLE web_player_goals');
  const errors: string[] = [];
  const map = new Map(columns.map(c => [c.COLUMN_NAME, c]));
  if (tables[0].ENGINE !== 'InnoDB') errors.push('engine');
  if (!String(tables[0].TABLE_COLLATION).startsWith('utf8mb4')) errors.push('charset');
  if (foreignKeys.length) errors.push('foreign-keys-present');
  for (const [name, type] of Object.entries({id:'bigint unsigned',user_id:'bigint unsigned',binding_id:'bigint unsigned',active_binding_id:'bigint unsigned',song_id:'int unsigned',difficulty_type:'tinyint unsigned',baseline_version:'int unsigned',goal_data:'longtext',goal_type:'varchar(24)',status:'varchar(16)',source:'varchar(24)',source_basis:'varchar(32)',source_mode:'varchar(24)',source_rank:'tinyint unsigned',source_revision:'char(64)'})) {
    if (map.get(name)?.COLUMN_TYPE !== type) errors.push(`column:${name}`);
  }
  for (const name of ['id','user_id','binding_id','song_id','difficulty_type','baseline_version','goal_data','goal_type','status','source','source_mode','source_rank','source_revision','created_at','updated_at','source_generated_at']) {
    if (map.get(name)?.IS_NULLABLE !== 'NO') errors.push(`not-null:${name}`);
  }
  for (const name of ['created_at','updated_at','cancelled_at','completed_at','source_generated_at']) {
    if (map.get(name)?.COLUMN_TYPE !== 'datetime(3)') errors.push(`time:${name}`);
  }
  const active = map.get('active_binding_id');
  const expression = String(active?.GENERATION_EXPRESSION || '').toLowerCase().replaceAll(String.fromCharCode(92), '').replace(/_utf8mb4|[`\s()]/g, '');
  if (expression !== "casewhenstatus='active'thenbinding_idelsenullend" || !String(active?.EXTRA).includes('STORED GENERATED')) errors.push('generated-expression');
  const groups = new Map<string, RowDataPacket[]>();
  for (const index of indexes) groups.set(index.INDEX_NAME, [...(groups.get(index.INDEX_NAME) || []), index]);
  if (!Array.from(groups.values()).some(parts => parts.length === 1 && Number(parts[0].NON_UNIQUE) === 0 && parts[0].COLUMN_NAME === 'active_binding_id')) errors.push('active-unique');
  if (groups.get('PRIMARY')?.length !== 1 || groups.get('PRIMARY')?.[0].COLUMN_NAME !== 'id') errors.push('primary-key');
  return { exists: true as const, engine: tables[0].ENGINE, collation: tables[0].TABLE_COLLATION, generatedExpression: active?.GENERATION_EXPRESSION, foreignKeyCount: foreignKeys.length, indexes, errors, showCreateTable: String(ddl[0]['Create Table']) };
}
