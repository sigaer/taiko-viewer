// Native real manual SQL/source runtime; synthetic configuration/catalog only.
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installGoalSqlRuntime } from './goalSqlRuntime.mjs';
import { SOURCE_LIFECYCLE_TABLE_SQL } from '../../server/infrastructure/taiko-publication/lifecycle-schema.ts';
import { GOAL_TABLE_SQL } from '../../server/services/goals/schema.ts';
import { GROWTH_MEASUREMENT_TABLE_SQL } from '../../server/services/growth-history/schema.ts';
import { GROWTH_RECENT_CURSOR_TABLE_SQL } from '../../server/services/growth-recent/schema.ts';
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || '/home/sigaer/git/Sakura_bot/taiko';

// The isolated DB lacks REFERENCES grants. These are business-compatible test
// tables without FK enforcement; they do not replace production migrations.
const TEST_MANUAL_TABLES = [
  SOURCE_LIFECYCLE_TABLE_SQL,
  GOAL_TABLE_SQL, GROWTH_MEASUREMENT_TABLE_SQL, GROWTH_RECENT_CURSOR_TABLE_SQL,
  `CREATE TABLE IF NOT EXISTS web_taiko_binding_mydon_showcase_titles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, binding_id BIGINT UNSIGNED NOT NULL,
    slot_index INT NOT NULL, title_name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_showcase_binding_slot (binding_id,slot_index), UNIQUE KEY uniq_showcase_binding_title (binding_id,title_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS taiko_manual_accounts (
    taiko_id CHAR(18) NOT NULL PRIMARY KEY, nickname VARCHAR(64) NOT NULL,
    bot_identity_key VARCHAR(191) DEFAULT NULL, created_by VARCHAR(16) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS taiko_manual_claim_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, taiko_id CHAR(18) NOT NULL,
    code_hash CHAR(64) NOT NULL, issued_by VARCHAR(16) NOT NULL, expires_at DATETIME NOT NULL,
    consumed_at DATETIME DEFAULT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_taiko_manual_claim_codes_hash (code_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS bind (
    row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, qq VARCHAR(191) NOT NULL,
    id VARCHAR(25) NOT NULL, visible TINYINT(1) NOT NULL DEFAULT 0,
    slot_index INT NOT NULL DEFAULT 1, is_current TINYINT(1) NOT NULL DEFAULT 1,
    source VARCHAR(16) NOT NULL DEFAULT 'wahlap', created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_bind_identity_slot (qq,slot_index), UNIQUE KEY uniq_bind_identity_taiko (qq,id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

export async function manualSqlFixture(task) {
  assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, '1');
  assert.match(String(process.env.TAIKO_DB_NAME || ''), /_test$/);
  const pool = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306),
    user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 4 });
  let root, uninstall, user = 0, taikoId;
  const tag = 'mp-' + randomUUID().slice(0, 8);
  const botKey = 'test:' + tag;
  const RealDate = globalThis.Date;
  let fixedAt = RealDate.now();
  const priorFetch = globalThis.fetch;
  let scopeModule;
  const state = { afterExecute: null, optimisticChecks: 0, onOptimisticChecks: null, beforeSqlStatement: null, afterSqlStatement: null, afterSqlCommit: null, transactions: 0, commits: 0, failRollback: false, discardedConnections: 0 };
  try {
    const [[identity]] = await pool.query('SELECT DATABASE() AS name');
    assert.match(identity.name, /_test$/);
    assert.equal(identity.name, process.env.TAIKO_DB_NAME);
    for (const statement of TEST_MANUAL_TABLES) await pool.execute(statement);
    root = await mkdtemp('/var/tmp/manual-source-sql-');
    const config = { repoRoot, userdataDir: resolve(root, 'userdata'), accountCacheDir: resolve(root, 'cache'), manualClaimSecret: 'synthetic-claim-only' };
    const db = { query: (...args) => pool.query(...args), async execute(sql, args) {
      const result = await pool.execute(sql, args);
      if (sql.includes('COUNT(*) AS total') && (sql.includes('FROM web_taiko_bindings') || sql.includes('FROM bind')) && !scopeModule.currentScoreScope()) {
        state.optimisticChecks++;
        state.onOptimisticChecks?.();
      }
      if (state.afterExecute) await state.afterExecute(sql, args, result);
      return result;
    }, async getConnection() {
      assert.equal(scopeModule.currentScoreScope()?.mode, 'write', 'manual detach must enter source EX before SQL owner locks');
      const connection = await pool.getConnection();
      return {
        query: (...args) => connection.query(...args),
        async execute(sql, args) {
          if (state.beforeSqlStatement) await state.beforeSqlStatement(sql, args);
          const result = await connection.execute(sql, args);
          if (state.afterSqlStatement) await state.afterSqlStatement(sql, args, result);
          return result;
        },
        async beginTransaction() { state.transactions++; return connection.beginTransaction(); },
        async commit() { await connection.commit(); state.commits++; if (state.afterSqlCommit) await state.afterSqlCommit(); },
        rollback: () => state.failRollback ? Promise.reject(new Error('Synthetic failed rollback')) : connection.rollback(),
        destroy: () => { state.discardedConnections++; connection.destroy(); }, release: () => connection.release()
      };
    } };
    uninstall = installGoalSqlRuntime(db, config);
    globalThis.fetch = async () => { throw new Error('Network forbidden during manual source SQL QA'); };
    globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixedAt])); } static now() { return fixedAt; } };
    scopeModule = await import('../../server/services/taiko-domain/publication.ts');
    const manual = await import('../../server/utils/account/manual.ts');
    const shared = await import('../../server/internal/account/shared.ts');
    const [created] = await pool.execute('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)', [tag, tag + '@example.test', 'no-login']);
    user = created.insertId;
    const owner = { kind: 'viewer', userId: user };
    ({ taikoId } = await manual.createManualAccount(owner, 'Synthetic manual'));
    await task({ pool, state, scopeModule, manual, shared, owner, user, taikoId, botKey, root, config,
      tick: () => { fixedAt += 1000; } });
  } finally {
    globalThis.Date = RealDate;
    globalThis.fetch = priorFetch;
    if (taikoId) {
      await pool.execute('DELETE FROM taiko_source_lifecycle WHERE taiko_id=?', [taikoId]);
      await pool.execute('DELETE FROM taiko_manual_claim_codes WHERE taiko_id=?', [taikoId]);
      await pool.execute('DELETE FROM bind WHERE id=? OR qq=?', [taikoId, botKey]);
    }
    if (user) {
      await pool.execute('DELETE t FROM web_taiko_binding_mydon_showcase_titles t JOIN web_taiko_bindings b ON b.id=t.binding_id WHERE b.user_id=?', [user]);
      for (const table of ['web_player_goals', 'web_growth_measurements', 'web_growth_recent_cursors', 'web_song_locks', 'web_user_sessions', 'web_taiko_bindings']) {
        const [tables] = await pool.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table]);
        if (tables.length) await pool.execute(`DELETE FROM ${table} WHERE user_id=?`, [user]);
      }
      await pool.execute('DELETE FROM web_user_accounts WHERE id=?', [user]);
    }
    if (taikoId) await pool.execute('DELETE FROM taiko_manual_accounts WHERE taiko_id=?', [taikoId]);
    uninstall?.();
    await pool.end();
    if (root) await rm(root, { recursive: true, force: true });
  }
}

export async function manualSourceSnapshot(c) {
  return c.scopeModule.withDomainScoreRead(c.taikoId, async () => {
    const reader = c.scopeModule.currentScoreScope(c.taikoId).reader;
    const history = [];
    for (const name of await reader.listHistory(c.taikoId)) history.push(createHash('sha256').update(await reader.readHistory(c.taikoId, name)).digest('hex'));
    return { current: await reader.currentExists(c.taikoId) ? await reader.readRawCurrent(c.taikoId) : null, history };
  });
}
export const manualScoreInput = { songNo: 100, level: 4, title: 'Synthetic chart', titleJp: 'Synthetic JP', values: { high_score: 800000, good_cnt: 500, ok_cnt: 20, ng_cnt: 5, combo_cnt: 100, stage_cnt: 1 } };
