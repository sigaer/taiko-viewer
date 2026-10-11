// Real Goal services/SQL/bridge. Only catalog and Python calculations are fixtures.
import assert from 'node:assert/strict';
import test from 'node:test';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installGoalSqlRuntime } from './fixtures/goalSqlRuntime.mjs';
import { authoritativeFixture } from './fixtures/goalAuthoritative.mjs';
import { withPublicationLease } from '../server/infrastructure/taiko-publication/client.ts';
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || '/home/sigaer/git/Sakura_bot/taiko';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(task) {
  assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, '1');
  assert.match(String(process.env.TAIKO_DB_NAME || ''), /_test$/);
  const pool = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306),
    user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 4 });
  let root, uninstall, user = 0;
  let currentScoreScope;
  const state = { transactionalSourceChecks: 0, onOwnerLocked: null, writerSourceEntered: false };
  try {
    const [[identity]] = await pool.query('SELECT DATABASE() AS name');
    assert.match(identity.name, /_test$/);
    assert.equal(identity.name, process.env.TAIKO_DB_NAME);
    root = await mkdtemp('/var/tmp/goal-source-sql-');
    const db = { execute: (...args) => { if (currentScoreScope()?.mode === "write") state.writerSourceEntered = true; return pool.execute(...args); }, query: (...args) => pool.query(...args), async getConnection() {
      const scope = currentScoreScope();
      assert.ok(scope, 'source lease must exist before acquiring a Goal SQL connection');
      assert.equal(scope.mode, 'read', 'Goal must acquire its source read lease before SQL owner/FK locks');
      state.transactionalSourceChecks++;
      const connection = await pool.getConnection();
      return { beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(), rollback: () => connection.rollback(), release: () => connection.release(),
        async execute(sql, args) {
          const result = await connection.execute(sql, args);
          if (sql.includes('FROM web_user_accounts') && sql.endsWith('FOR UPDATE') && state.onOwnerLocked) await state.onOwnerLocked();
          return result;
        } };
    } };
    uninstall = installGoalSqlRuntime(db, { repoRoot, userdataDir: resolve(root, 'userdata'), accountCacheDir: resolve(root, 'cache') });
    const scopeModule = await import('../server/services/taiko-domain/publication.ts');
    currentScoreScope = scopeModule.currentScoreScope;
    const { writePlayerGoal } = await import('../server/services/goals/service.ts');
    const { evaluateActiveGoalForBinding } = await import('../server/services/goals/evaluation.ts');
    const { getPlayerGrowthOverview } = await import('../server/services/account/growth.ts');
    const { createAccountSong } = await import('../server/utils/account/songs.ts');
    const tag = 'gp-' + randomUUID().slice(0, 8);
    const [created] = await pool.execute('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)', [tag, tag + '@example.test', 'no-login']);
    user = created.insertId;
    const [bound] = await pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',1)", [user, tag]);
    const payload = authoritativeFixture({ songs: [100, 101, 102].map(song_no => ({ song_no, level: 4, high_score: 900000, good_cnt: 400, ok_cnt: 20, ng_cnt: 8, stage_cnt: 1,
      combo_cnt: 100, clear_cnt: 0, full_combo_cnt: 0, dondaful_combo_cnt: 0, best_score_rank: 4, update_datetime: '2026-10-11 09:00:00' })) }, tag, new Date(Date.now() - 30000));
    await withPublicationLease({ root: resolve(root, 'userdata'), repoRoot, identity: tag, mode: 'write' }, async lease => {
      await lease.put('current', JSON.stringify(payload)); await lease.publish();
    });
    await task({ pool, state, scopeModule, writePlayerGoal, evaluateActiveGoalForBinding, getPlayerGrowthOverview, createAccountSong, user, binding: bound.insertId, taikoId: tag, root });
    const [[constraint]] = await pool.query("SELECT COUNT(*) AS total FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='web_song_locks' AND REFERENCED_TABLE_NAME='web_user_accounts'");
    process.stdout.write(JSON.stringify({ testDatabase: identity.name, transactionalSourceChecks: state.transactionalSourceChecks, testSongLockForeignKey: constraint.total > 0 }) + '\n');
  } finally {
    if (user) {
      // Delete only this test's owned rows; never clear shared test tables.
      for (const table of ['web_player_goals', 'web_growth_measurements', 'web_growth_recent_cursors', 'web_song_locks', 'web_user_sessions', 'web_taiko_bindings']) {
        const [tables] = await pool.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table]);
        if (tables.length) await pool.execute(`DELETE FROM ${table} WHERE user_id=?`, [user]);
      }
      await pool.execute('DELETE FROM web_user_accounts WHERE id=?', [user]);
    }
    uninstall?.();
    await pool.end();
    if (root) await rm(root, { recursive: true, force: true });
  }
}

async function concurrentWriter(context, operation) {
  let startWriter, writerEntered = false;
  const gate = new Promise(resolve => { startWriter = resolve; });
  // Register outside the Goal source scope: an independent business request.
  const writer = gate.then(async () => {
    await context.createAccountSong(context.user, { songNo: 103, level: 4, title: 'Synthetic extra chart', values: { high_score: 800000 } });
    writerEntered = true;
  });
  context.state.onOwnerLocked = async () => {
    startWriter();
    await sleep(100);
    assert.equal(writerEntered, false);
    assert.equal(context.state.writerSourceEntered, false, 'the independent writer has not entered its EX source scope');
    assert.equal(context.scopeModule.currentScoreScope().mode, 'read');
  };
  try {
    const result = await operation();
    context.state.onOwnerLocked = null;
    await writer;
    assert.equal(writerEntered, true);
    assert.equal(context.state.writerSourceEntered, true);
    const [[lock]] = await context.pool.query('SELECT COUNT(*) AS total FROM web_song_locks WHERE user_id=? AND taiko_id=? AND song_no=103', [context.user, context.taikoId]);
    assert.equal(lock.total, 1);
    return result;
  } finally {
    context.state.onOwnerLocked = null; startWriter();
    await writer.catch(() => undefined);
  }
}

test('real Goal creation and account score writer complete with source-before-SQL ordering', { timeout: 20000 }, async () => fixture(async c => {
  const overview = await c.getPlayerGrowthOverview(c.user);
  const result = await concurrentWriter(c, () => c.writePlayerGoal(c.user, { profileId: String(c.binding), expectedActiveGoalId: null, songId: 100, difficultyType: 4, goalType: 'score-pb', scoreRevision: overview.scoreRevision }));
  assert.equal(result.activeGoal.baseline.highScore, 900000);
  assert.equal(result.activeGoal.baseline.sourceRevision, overview.scoreRevision);
  assert.equal(c.state.transactionalSourceChecks, 1);
}));

test('real Goal evaluation and account score writer use the same lock order without recomputing Growth', { timeout: 20000 }, async () => fixture(async c => {
  const overview = await c.getPlayerGrowthOverview(c.user);
  const { activeGoal } = await c.writePlayerGoal(c.user, { profileId: String(c.binding), expectedActiveGoalId: null, songId: 100, difficultyType: 4, goalType: 'score-pb', scoreRevision: overview.scoreRevision });
  const pythonBefore = globalThis.__goalSqlRuntime.pythonCalls;
  const result = await concurrentWriter(c, () => c.evaluateActiveGoalForBinding(c.user, { profileId: String(c.binding), expectedActiveGoalId: activeGoal.id }));
  assert.equal(result.outcome, 'inconclusive');
  assert.equal(globalThis.__goalSqlRuntime.pythonCalls, pythonBefore);
  assert.equal(c.state.transactionalSourceChecks, 2);
}));

test('SQL-locked binding identity rejects same-row source substitution before observation', { timeout: 20000 }, async () => fixture(async c => {
  const overview = await c.getPlayerGrowthOverview(c.user);
  const { activeGoal } = await c.writePlayerGoal(c.user, { profileId: String(c.binding), expectedActiveGoalId: null, songId: 100, difficultyType: 4, goalType: 'score-pb', scoreRevision: overview.scoreRevision });
  c.state.onOwnerLocked = () => c.pool.execute("UPDATE web_taiko_bindings SET taiko_id='substituted' WHERE id=?", [c.binding]);
  await assert.rejects(c.evaluateActiveGoalForBinding(c.user, { profileId: String(c.binding), expectedActiveGoalId: activeGoal.id }), error => error.statusCode === 409);
  const [[stored]] = await c.pool.query('SELECT status FROM web_player_goals WHERE id=?', [activeGoal.id]);
  assert.equal(stored.status, 'active');
}));
