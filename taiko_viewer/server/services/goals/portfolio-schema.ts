// Explicit migration declarations and read-only runtime capability checks.
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createError } from 'h3';
export const PORTFOLIO_SCHEMA_REVISION = 'goal-portfolio/2';
export const PORTFOLIO_TABLES = [
    `CREATE TABLE IF NOT EXISTS web_goal_schema_revisions (
 capability VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 revision VARCHAR(64) NOT NULL, migration_key VARCHAR(128) NOT NULL, updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS web_goal_portfolios (
 user_id BIGINT UNSIGNED NOT NULL, binding_id BIGINT UNSIGNED NOT NULL,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0, updated_at DATETIME(3) NOT NULL,
 PRIMARY KEY (user_id,binding_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS web_goal_portfolio_commands (
 user_id BIGINT UNSIGNED NOT NULL, binding_id BIGINT UNSIGNED NOT NULL,
 command_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 nonce VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 before_revision BIGINT UNSIGNED NOT NULL, after_revision BIGINT UNSIGNED NOT NULL,
 response_json LONGTEXT NOT NULL, created_at DATETIME(3) NOT NULL,
 PRIMARY KEY (user_id,binding_id,command_id), UNIQUE KEY uniq_goal_nonce (user_id,binding_id,nonce)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS web_goal_portfolio_events (
 event_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL, binding_id BIGINT UNSIGNED NOT NULL,
 portfolio_revision BIGINT UNSIGNED NOT NULL, goal_id BIGINT UNSIGNED NOT NULL,
 command_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_type VARCHAR(32) NOT NULL, event_payload LONGTEXT NOT NULL, created_at DATETIME(3) NOT NULL,
 KEY idx_goal_events (user_id,binding_id,goal_id,portfolio_revision),
 UNIQUE KEY uniq_goal_event (user_id,binding_id,goal_id,command_id,event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
export const PORTFOLIO_COLUMNS: Record<string, string> = {
    goal_schema_version: 'INT UNSIGNED NOT NULL DEFAULT 1', goal_revision: 'BIGINT UNSIGNED NOT NULL DEFAULT 1',
    user_priority: 'TINYINT UNSIGNED NOT NULL DEFAULT 1', user_order: 'INT UNSIGNED NOT NULL DEFAULT 0',
    availability_state: "VARCHAR(16) NOT NULL DEFAULT 'unknown'", availability_reason_codes: 'LONGTEXT NULL',
    availability_checked_at: 'DATETIME(3) NULL', availability_catalog_revision: 'CHAR(64) NULL'
};
type Reader = Pick<Pool, 'query'>;
export async function getGoalSchemaVersion(db: Reader): Promise<1 | 2> {
    const [tables] = await db.query<RowDataPacket[]>("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_goal_schema_revisions'");
    if (!tables.length)
        return 1;
    const [rows] = await db.query<RowDataPacket[]>("SELECT revision FROM web_goal_schema_revisions WHERE capability='goal-portfolio'");
    if (!rows.length) {
        throw createError({ statusCode: 503, statusMessage: 'goal-portfolio-migration-in-progress' });
    }
    if (rows[0].revision === PORTFOLIO_SCHEMA_REVISION)
        return 2;
    throw createError({ statusCode: 503, statusMessage: 'goal-portfolio-schema-unavailable' });
}
export async function validateGoalPortfolioSchema(db: Reader) {
    if (await getGoalSchemaVersion(db) !== 2)
        throw createError({ statusCode: 503, statusMessage: 'goal-portfolio-not-migrated', data: { code: 'GOAL_PORTFOLIO_NOT_MIGRATED' } });
    const names = ['web_player_goals', 'web_goal_schema_revisions', 'web_goal_portfolios', 'web_goal_portfolio_commands', 'web_goal_portfolio_events'];
    const [columns] = await db.query<RowDataPacket[]>('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)', [names]);
    const [indexes] = await db.query<RowDataPacket[]>('SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,NON_UNIQUE,SEQ_IN_INDEX,SUB_PART FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX', [names]);
    const [engines] = await db.query<RowDataPacket[]>('SELECT TABLE_NAME,ENGINE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)', [names]);
    const expected: Record<string, string[]> = {
        web_player_goals: Object.keys(PORTFOLIO_COLUMNS), web_goal_schema_revisions: ['capability', 'revision', 'migration_key', 'updated_at'],
        web_goal_portfolios: ['user_id', 'binding_id', 'revision', 'updated_at'],
        web_goal_portfolio_commands: ['user_id', 'binding_id', 'command_id', 'request_hash', 'nonce', 'before_revision', 'after_revision', 'response_json', 'created_at'],
        web_goal_portfolio_events: ['event_id', 'user_id', 'binding_id', 'portfolio_revision', 'goal_id', 'command_id', 'event_type', 'event_payload', 'created_at']
    };
    const fail = () => { throw createError({ statusCode: 503, statusMessage: 'goal-portfolio-schema-unavailable' }); };
    if (engines.length !== names.length || engines.some(t => t.ENGINE !== 'InnoDB'))
        fail();
    for (const c of columns)
        if (['command_id', 'nonce', 'event_id', 'request_hash'].includes(String(c.COLUMN_NAME)) && c.COLLATION_NAME !== 'ascii_bin')
            fail();
    for (const [table, cols] of Object.entries(expected))
        for (const col of cols)
            if (!columns.some(c => c.TABLE_NAME === table && c.COLUMN_NAME === col))
                fail();
    if (columns.some(c => c.TABLE_NAME === 'web_player_goals' && c.COLUMN_NAME === 'active_binding_id') || indexes.some(i => i.TABLE_NAME === 'web_player_goals' && i.INDEX_NAME === 'uniq_goal_active_binding'))
        fail();
    const keys: Record<string, string[]> = {};
    for (const i of indexes)
        if (Number(i.NON_UNIQUE) === 0 && i.SUB_PART === null)
            (keys[`${i.TABLE_NAME}:${i.INDEX_NAME}`] ||= []).push(String(i.COLUMN_NAME));
    for (const [table, key] of [['web_goal_portfolios', 'user_id,binding_id'], ['web_goal_portfolio_commands', 'user_id,binding_id,command_id'], ['web_goal_portfolio_commands', 'user_id,binding_id,nonce'], ['web_goal_portfolio_events', 'event_id'], ['web_goal_portfolio_events', 'user_id,binding_id,goal_id,command_id,event_type']])
        if (!Object.entries(keys).some(([k, v]) => k.startsWith(table + ':') && v.join(',') === key))
            fail();
    for (const [table, col] of [['web_player_goals', 'goal_revision'], ['web_goal_portfolios', 'revision'], ['web_goal_portfolio_commands', 'before_revision'], ['web_goal_portfolio_commands', 'after_revision'], ['web_goal_portfolio_events', 'portfolio_revision']])
        if (String(columns.find(c => c.TABLE_NAME === table && c.COLUMN_NAME === col)?.COLUMN_TYPE).replace(/\(\d+\)/, '') !== 'bigint unsigned')
            fail();
}
export async function rejectLegacyGoalWrite(db: Reader) {
    if (await getGoalSchemaVersion(db) === 2)
        throw createError({ statusCode: 409, statusMessage: 'goal-portfolio-upgrade-required' });
}
