// Native real manual SQL/source runtime; synthetic configuration/catalog only.
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installGoalSqlRuntime } from './goalSqlRuntime.mjs';
import { SOURCE_LIFECYCLE_TABLE_SQL } from '../../server/infrastructure/taiko-publication/lifecycle-schema.ts';
import { MANUAL_GRANT_RECEIPT_TABLE_SQL } from '../../server/infrastructure/taiko-publication/grant-schema.ts';
import { MANUAL_CREATION_TABLE_SQL } from '../../server/infrastructure/taiko-publication/creation-schema.ts';
import { BINDING_CONFIRMATION_TABLE_SQL } from '../../server/infrastructure/taiko-publication/binding-confirmation-schema.ts';
import { BINDING_REVOCATION_TABLE_SQL } from '../../server/infrastructure/taiko-publication/binding-revocation-schema.ts';
import { ACCOUNT_SYNC_RECEIPT_TABLE_SQL } from '../../server/infrastructure/account/sync-request.ts';
import { SOURCE_SERVICE_GRANT_TABLE_SQL, SOURCE_SERVICE_GRANT_AUDIT_TABLE_SQL,SOURCE_SERVICE_PRINCIPAL_MIGRATIONS } from '../../server/infrastructure/account/source-service-schema.ts';
import { BOT_BINDING_OPERATION_TABLE_SQL,BOT_BINDING_OPERATION_MIGRATIONS } from '../../server/infrastructure/account/bot-binding-schema.ts';
import { HIROBA_CREDENTIAL_TABLE_SQL,HIROBA_CREDENTIAL_MIGRATIONS,HIROBA_BINDING_OPERATION_TABLE_SQL } from '../../server/infrastructure/account/hiroba-credential-schema.ts';
import { SCORE_TOKEN_TABLE_SQL } from '../../server/infrastructure/account/score-token.ts';
import { GOAL_TABLE_SQL } from '../../server/services/goals/schema.ts';
import { GROWTH_MEASUREMENT_TABLE_SQL } from '../../server/services/growth-history/schema.ts';
import { GROWTH_RECENT_CURSOR_TABLE_SQL } from '../../server/services/growth-recent/schema.ts';
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || '/home/sigaer/git/Sakura_bot/taiko';

// The isolated DB lacks REFERENCES grants. These are business-compatible test
// tables without FK enforcement; they do not replace production migrations.
const TEST_MANUAL_TABLES = [
  HIROBA_CREDENTIAL_TABLE_SQL,
  HIROBA_BINDING_OPERATION_TABLE_SQL,
  SOURCE_SERVICE_GRANT_TABLE_SQL, SOURCE_SERVICE_GRANT_AUDIT_TABLE_SQL,
  BOT_BINDING_OPERATION_TABLE_SQL,
  `CREATE TABLE IF NOT EXISTS web_developer_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED DEFAULT NULL, token_hash CHAR(64) NOT NULL, token_mask VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active', issued_by_user_id BIGINT UNSIGNED DEFAULT NULL,
    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_used_at DATETIME DEFAULT NULL, revoked_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_developer_tokens_token_hash(token_hash), KEY idx_web_developer_tokens_user_id_status(user_id,status,issued_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_taiko_open_api_daily_usage (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, ip_address VARCHAR(64) NOT NULL, api_name VARCHAR(128) NOT NULL,
    day_key DATE NOT NULL, request_count INT UNSIGNED NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_taiko_open_api_daily_usage_ip_api_day(ip_address,api_name,day_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  SCORE_TOKEN_TABLE_SQL, ACCOUNT_SYNC_RECEIPT_TABLE_SQL,
  `CREATE TABLE IF NOT EXISTS web_data_sync_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    taiko_id VARCHAR(25) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'success',
    target_ids_json LONGTEXT NOT NULL, result_json LONGTEXT NOT NULL,
    original_bytes INT UNSIGNED NOT NULL DEFAULT 0, compressed_bytes INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_web_data_sync_logs_user_id_created_at(user_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  SOURCE_LIFECYCLE_TABLE_SQL, BINDING_REVOCATION_TABLE_SQL, BINDING_CONFIRMATION_TABLE_SQL,
  MANUAL_GRANT_RECEIPT_TABLE_SQL,
  MANUAL_CREATION_TABLE_SQL,
  GOAL_TABLE_SQL, GROWTH_MEASUREMENT_TABLE_SQL, GROWTH_RECENT_CURSOR_TABLE_SQL,
  `CREATE TABLE IF NOT EXISTS web_user_qq_bindings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    qq_number VARCHAR(15) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
    verify_code_hash CHAR(64) DEFAULT NULL, verify_code_expires_at DATETIME DEFAULT NULL,
    verify_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0, verified_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_user_qq_bindings_user (user_id), UNIQUE KEY uniq_web_user_qq_bindings_qq (qq_number),
    KEY idx_web_user_qq_bindings_status (status), KEY idx_web_user_qq_bindings_qq (qq_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_taiko_binding_verifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    taiko_id VARCHAR(25) NOT NULL, original_title VARCHAR(255) NOT NULL, original_titleplate_id INT NOT NULL,
    expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_taiko_binding_verifications_user_id (user_id),
    KEY idx_web_taiko_binding_verifications_taiko_id (taiko_id), KEY idx_web_taiko_binding_verifications_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS taiko_bind_identity_state (
    identity_key VARCHAR(191) NOT NULL PRIMARY KEY, current_virtual TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
];

export async function manualSqlFixture(task, { withProfile = false, withPersonal = false, withRealPython = false, withAccountSource = false, withDeveloper = false } = {}) {
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
  const state = { expectedSourceMode: 'write', afterExecute: null, optimisticChecks: 0, onOptimisticChecks: null, beforeSqlStatement: null, afterSqlStatement: null, beforeSqlCommit: null, afterSqlCommit: null, transactions: 0, commits: 0, failRollback: false, discardedConnections: 0 };
  try {
    const [[identity]] = await pool.query('SELECT DATABASE() AS name');
    assert.match(identity.name, /_test$/);
    assert.equal(identity.name, process.env.TAIKO_DB_NAME);
    for (const statement of TEST_MANUAL_TABLES) await pool.execute(statement);
    for(const sql of BOT_BINDING_OPERATION_MIGRATIONS)try{await pool.execute(sql);}catch(error){if(error.code!=='ER_DUP_FIELDNAME')throw error;}
    for(const sql of SOURCE_SERVICE_PRINCIPAL_MIGRATIONS)try{await pool.execute(sql);}catch(error){if(error.code!=='ER_DUP_FIELDNAME')throw error;}
    for(const sql of HIROBA_CREDENTIAL_MIGRATIONS)await pool.execute(sql);
    root = await mkdtemp('/var/tmp/manual-source-sql-');
    const config = { repoRoot, userdataDir: resolve(root, 'userdata'), accountCacheDir: resolve(root, 'cache'), manualClaimSecret: 'synthetic-claim-only' };
    const db = { query: (...args) => pool.query(...args), async execute(sql, args) {
      let result;
      try{result=await pool.execute(sql,args);}catch(error){state.sqlFaultCode=error.code||'unknown';throw error;}
      if (sql.includes('COUNT(*) AS total') && (sql.includes('FROM web_taiko_bindings') || sql.includes('FROM bind')) && !scopeModule.currentScoreScope()) {
        state.optimisticChecks++;
        state.onOptimisticChecks?.();
      }
      if (state.afterExecute) await state.afterExecute(sql, args, result);
      return result;
    }, async getConnection() {
      assert.equal(scopeModule.currentScoreScope()?.mode || 'none', state.expectedSourceMode, 'Expected source lease before SQL owner locks');
      const connection = await pool.getConnection();
      return {
        query: (...args) => connection.query(...args),
        async execute(sql, args) {
          if (state.beforeSqlStatement) await state.beforeSqlStatement(sql, args);
          let result;
          try{result=await connection.execute(sql,args);}catch(error){state.sqlFaultCode=error.code||'unknown';throw error;}
          if (state.afterSqlStatement) await state.afterSqlStatement(sql, args, result,connection);
          return result;
        },
        async beginTransaction() { state.transactions++; return connection.beginTransaction(); },
        async commit() { if (state.beforeSqlCommit) await state.beforeSqlCommit(); await connection.commit(); state.commits++; if (state.afterSqlCommit) await state.afterSqlCommit(); },
        rollback: () => state.failRollback ? Promise.reject(new Error('Synthetic failed rollback')) : connection.rollback(),
        destroy: () => { state.discardedConnections++; connection.destroy(); }, release: () => connection.release()
      };
    } };
    uninstall = installGoalSqlRuntime(db, config, { withProfile, withPersonal, withRealPython, withAccountSource, withDeveloper });
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
    const [births] = user ? await pool.query("SELECT taiko_id FROM taiko_manual_creations WHERE (actor_kind='viewer' AND actor_key=?) OR (actor_kind='bot' AND actor_key=?)", [String(user),botKey]) : [[]];
    const ownedIds = [...new Set([taikoId,...births.map(row=>row.taiko_id)].filter(Boolean))];
    for (const ownedId of ownedIds) {
      await pool.execute('DELETE FROM web_hiroba_credentials WHERE taiko_no=?', [ownedId]);
      await pool.execute('DELETE FROM taiko_manual_creations WHERE taiko_id=?', [ownedId]);
      await pool.execute('DELETE FROM taiko_manual_grant_receipts WHERE taiko_id=?', [ownedId]);
      await pool.execute('DELETE FROM taiko_source_lifecycle WHERE taiko_id=?', [ownedId]);
      await pool.execute('DELETE FROM taiko_manual_claim_codes WHERE taiko_id=?', [ownedId]);
      await pool.execute('DELETE FROM bind WHERE id=? OR qq=?', [ownedId, botKey]);
      await pool.execute('DELETE FROM taiko_manual_accounts WHERE taiko_id=?', [ownedId]);
    }
    if (user) {
      await pool.execute('DELETE FROM taiko_bot_binding_operations WHERE actor_user_id=?',[user]);
      await pool.execute('DELETE FROM taiko_hiroba_binding_operations WHERE actor_user_id=?',[user]);
      await pool.execute('DELETE a FROM taiko_source_service_grant_audit a JOIN web_developer_tokens t ON t.id=a.developer_token_id WHERE t.user_id=?', [user]);
      await pool.execute('DELETE FROM taiko_source_service_grants WHERE developer_user_id=?', [user]);
      await pool.execute("DELETE q FROM web_taiko_open_api_daily_usage q JOIN web_developer_tokens t ON q.ip_address=CONCAT('token:',t.id) WHERE t.user_id=?", [user]);
      await pool.execute('DELETE FROM web_developer_tokens WHERE user_id=?', [user]);
      await pool.execute('DELETE t FROM web_taiko_binding_mydon_showcase_titles t JOIN web_taiko_bindings b ON b.id=t.binding_id WHERE b.user_id=?', [user]);
      for (const table of ['web_data_sync_receipts', 'web_data_sync_logs', 'web_taiko_binding_confirmations', 'web_taiko_binding_verifications', 'web_taiko_binding_revocations', 'web_player_goals', 'web_growth_measurements', 'web_growth_recent_cursors', 'web_song_locks', 'web_user_sessions', 'web_taiko_bindings']) {
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
    for (const name of await reader.listHistory(c.taikoId)) {
      if (name.startsWith('data_') && name.endsWith('.json')) history.push(createHash('sha256').update(await reader.readHistory(c.taikoId, name)).digest('hex'));
    }
    return { current: await reader.currentExists(c.taikoId) ? await reader.readRawCurrent(c.taikoId) : null, history };
  });
}
export const manualScoreInput = { songNo: 100, level: 4, title: 'Synthetic chart', titleJp: 'Synthetic JP', values: { high_score: 800000, good_cnt: 500, ok_cnt: 20, ng_cnt: 5, combo_cnt: 100, stage_cnt: 1 } };
