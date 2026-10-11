// Actual service/SQL/source lifecycle; every mutation is an owned _test fixture.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { manualSqlFixture as fixture, manualSourceSnapshot as snapshot, manualScoreInput as input } from './fixtures/manualSqlRuntime.mjs';
import { decodeSqlRecoveryBackup } from '../server/infrastructure/taiko-publication/sql-backup.ts';
const execFileAsync = promisify(execFile);
const digest = raw => createHash('sha256').update(raw).digest('hex');

async function populate(c) {
  await c.manual.upsertManualScore(c.owner, c.taikoId, input);
  const [[binding]] = await c.pool.query('SELECT id FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?', [c.user, c.taikoId]);
  const id = binding.id;
  await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'manual',1,1)", [c.botKey, c.taikoId]);
  await c.pool.execute('UPDATE taiko_manual_accounts SET bot_identity_key=? WHERE taiko_id=?', [c.botKey, c.taikoId]);
  await c.manual.issueManualClaimCode(c.owner, c.taikoId);
  await c.pool.execute(`INSERT INTO web_player_goals
    (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_mode,source_rank,source_revision,source_generated_at,goal_data,created_at,updated_at)
    VALUES (?,?,100,4,'score-pb','today-plan','dimension',1,?,NOW(3),'{}',NOW(3),NOW(3))`, [c.user, id, 'a'.repeat(64)]);
  await c.pool.execute(`INSERT INTO web_growth_measurements
    (user_id,binding_id,score_revision,measurement_version,algorithm_version,rating,dimensions_json,focus,sample_count,availability_state,captured_at)
    VALUES (?,?,?,1,'synthetic',10,'[]','stamina',30,'ready',NOW(3))`, [c.user, id, 'b'.repeat(64)]);
  await c.pool.execute(`INSERT INTO web_growth_recent_cursors
    (user_id,binding_id,cursor_token,observation_revision,observation_observed_at,algorithm_version)
    VALUES (?,?,?,?,NOW(3),'synthetic')`, [c.user, id, 'c'.repeat(64), 'd'.repeat(64)]);
  await c.pool.execute('INSERT INTO web_song_locks (user_id,taiko_id,song_no,level,is_locked) VALUES (?,?,100,4,1)', [c.user, c.taikoId]);
  await c.pool.execute('INSERT INTO web_taiko_binding_mydon_showcase_titles (binding_id,slot_index,title_name) VALUES (?,1,?)', [id, 'Synthetic title']);
  const daily = resolve(c.config.userdataDir, c.taikoId, 'daily-ability-v1-top20.json');
  const dailyRaw = '{"days":{"2026-10-10":{"rating":123,"origin":"snapshot"}}}\n';
  await writeFile(daily, dailyRaw);
  return { id, daily, dailyRaw, before: await snapshot(c) };
}
async function receipt(c) {
  const [[row]] = await c.pool.query('SELECT * FROM taiko_source_lifecycle WHERE taiko_id=? ORDER BY created_at DESC,operation_id DESC LIMIT 1', [c.taikoId]);
  return row;
}
async function rowCounts(c, id) {
  const counts = {};
  for (const [name, table, where, args] of [
    ['account', 'taiko_manual_accounts', 'taiko_id=?', [c.taikoId]],
    ['viewer', 'web_taiko_bindings', 'user_id=? AND taiko_id=?', [c.user, c.taikoId]],
    ['bot', 'bind', 'id=?', [c.taikoId]],
    ['claims', 'taiko_manual_claim_codes', 'taiko_id=?', [c.taikoId]],
    ['goals', 'web_player_goals', 'binding_id=?', [id]],
    ['measurements', 'web_growth_measurements', 'binding_id=?', [id]],
    ['cursors', 'web_growth_recent_cursors', 'binding_id=?', [id]],
    ['locks', 'web_song_locks', 'taiko_id=?', [c.taikoId]],
    ['titles', 'web_taiko_binding_mydon_showcase_titles', 'binding_id=?', [id]]
  ]) {
    const [[row]] = await c.pool.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`, args);
    counts[name] = row.total;
  }
  return counts;
}
async function assertDeleted(c, fixture, expectedStatus = 'published') {
  for (const count of Object.values(await rowCounts(c, fixture.id))) assert.equal(count, 0);
  const row = await receipt(c);
  assert.equal(row.status, expectedStatus);
  await c.scopeModule.withDomainScoreRead(c.taikoId, async () => {
    assert.deepEqual(c.scopeModule.scorePublication(c.taikoId).files, {});
    assert.equal(await c.scopeModule.currentScoreScope(c.taikoId).reader.currentExists(c.taikoId), false);
  });
  await assert.rejects(access(fixture.daily), { code: 'ENOENT' });
  const backup = resolve(c.config.userdataDir, '.manual_deleted', `${c.taikoId}-${row.backup_key}`);
  assert.equal(digest(await readFile(resolve(backup, `${c.taikoId}data.json`), 'utf8')), digest(fixture.before.current));
  assert.equal(digest(await readFile(resolve(backup, c.taikoId, 'daily-ability-v1-top20.json'), 'utf8')), digest(fixture.dailyRaw));
  await assert.rejects(c.manual.upsertManualScore(c.owner, c.taikoId, input), error => error.statusCode === 403);
  return row;
}

test('actual permanent deletion commits all identities/products once, keeps verified private backups, and retries without ownership', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  const beforeTransactions = c.state.transactions;
  const result = await c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true);
  assert.equal(result.ok, true);
  assert.equal(c.state.transactions - beforeTransactions, 1);
  assert.equal(c.state.commits, 1);
  const row = await assertDeleted(c, f);
  const sqlBackup = decodeSqlRecoveryBackup(row.sql_backup, row.sql_backup_sha256);
  assert.equal(sqlBackup.schema, 1);
  assert.equal(sqlBackup.bindings.length, 1);
  for (const name of ['goals', 'measurements', 'cursors', 'titles', 'locks']) assert.equal(sqlBackup.products[name].length, 1);
  const retry = await c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true);
  assert.deepEqual(retry, result);
  await assert.rejects(c.manual.permanentlyDeleteManualAccount({ kind: 'viewer', userId: c.user + 1 }, c.taikoId, true), error => error.statusCode === 403);
  await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, false), error => error.statusCode === 409);
}));

test('late actual SQL failure rolls back the entire manual cleanup and receipt, leaving C/H/daily unchanged', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  const beforeCounts = await rowCounts(c, f.id);
  const expected = new Error('Synthetic final SQL failure');
  c.state.beforeSqlStatement = sql => { if (sql.startsWith('DELETE FROM taiko_manual_accounts')) throw expected; };
  await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true), error => error === expected);
  assert.deepEqual(await rowCounts(c, f.id), beforeCounts);
  assert.equal(await receipt(c), undefined);
  assert.deepEqual(await snapshot(c), f.before);
  assert.equal(await readFile(f.daily, 'utf8'), f.dailyRaw);
  assert.equal(c.state.commits, 0);
}));

test('a failed rollback discards its real connection so an uncommitted cleanup cannot escape through the pool', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  const counts = await rowCounts(c, f.id);
  const expected = new Error('Synthetic SQL error before COMMIT');
  c.state.beforeSqlStatement = sql => { if (sql.startsWith('DELETE FROM taiko_manual_accounts')) throw expected; };
  c.state.failRollback = true;
  await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true), error => error === expected);
  assert.equal(c.state.discardedConnections, 1);
  assert.deepEqual(await rowCounts(c, f.id), counts);
  assert.equal(await receipt(c), undefined);
  assert.deepEqual(await snapshot(c), f.before);
  c.state.failRollback = false;
}));

test('lost actual SQL COMMIT acknowledgement probes its durable receipt and completes source cleanup', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  c.state.afterSqlCommit = () => { throw new Error('Synthetic lost COMMIT acknowledgement'); };
  assert.equal((await c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true)).ok, true);
  await assertDeleted(c, f);
  assert.equal(c.state.commits, 1);
}));

test('source publication failure after SQL revocation stays pending and a fresh recovery invocation completes it', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  c.state.afterSqlCommit = () => { c.scopeModule.currentScoreScope(c.taikoId).lease.publish = async () => { throw new Error('Synthetic source publish failure'); }; };
  await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true));
  for (const count of Object.values(await rowCounts(c, f.id))) assert.equal(count, 0);
  const pending = await receipt(c);
  assert.equal(pending.status, 'pending');
  assert.deepEqual(await snapshot(c), f.before);
  c.state.afterSqlCommit = null;
  const { recoverOneManualSourceDeletion } = await import('../server/services/account/manual-lifecycle.ts');
  assert.deepEqual(await recoverOneManualSourceDeletion(undefined, pending.operation_id), { recovered: true });
  await assertDeleted(c, f);
  assert.deepEqual(await recoverOneManualSourceDeletion(undefined, pending.operation_id), { recovered: false });
}));

test('a different active source or changed daily measurement after revocation blocks destructive recovery', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  c.state.afterSqlCommit = () => { c.scopeModule.currentScoreScope(c.taikoId).lease.purgeBackupArchives = async () => { throw new Error('Synthetic failure before cleanup'); }; };
  await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true));
  const pending = await receipt(c);
  assert.equal(pending.status, 'pending');
  const { recoverOneManualSourceDeletion } = await import('../server/services/account/manual-lifecycle.ts');
  await writeFile(f.daily, 'new frozen measurement');
  await assert.rejects(recoverOneManualSourceDeletion(undefined, pending.operation_id));
  assert.equal(await readFile(f.daily, 'utf8'), 'new frozen measurement');
  assert.deepEqual(await snapshot(c), f.before);
  await writeFile(f.daily, f.dailyRaw);
  // Actual source commit models an unexpected stale writer; recovery must not
  // erase its newer canonical head on the strength of an old receipt.
  await c.shared.writeUserdataWithHistory(c.taikoId, { profile: { userid: c.taikoId }, songs: [] }, 'manual-score');
  const changed = await snapshot(c);
  await assert.rejects(recoverOneManualSourceDeletion(undefined, pending.operation_id));
  assert.deepEqual(await snapshot(c), changed);
  assert.equal((await receipt(c)).status, 'pending');
}));

test('two independent permanent-delete requests share one durable operation and source deletion', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  const [first, second] = await Promise.all([
    c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true),
    c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true)
  ]);
  assert.deepEqual(first, second);
  assert.equal(c.state.commits, 1);
  const [[rows]] = await c.pool.query('SELECT COUNT(*) AS n FROM taiko_source_lifecycle WHERE taiko_id=?', [c.taikoId]);
  assert.equal(rows.n, 1);
  await assertDeleted(c, f);
}));

test('manual cleanup handles legacy additional bot owners in one transaction and preserves other binding products', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  const otherBot = c.botKey + '-two';
  try {
    await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'manual',1,1),(?,?,'wahlap',2,0)",
      [otherBot, c.taikoId, otherBot, 'aux-' + c.taikoId.slice(-8)]);
    const [bound] = await c.pool.execute("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'wahlap',0)", [c.user, 'aux-' + c.taikoId.slice(-8)]);
    await c.pool.execute(`INSERT INTO web_player_goals
      (user_id,binding_id,song_id,difficulty_type,goal_type,source,source_mode,source_rank,source_revision,source_generated_at,goal_data,created_at,updated_at)
      VALUES (?,?,101,4,'score-pb','today-plan','dimension',1,?,NOW(3),'{}',NOW(3),NOW(3))`, [c.user, bound.insertId, 'e'.repeat(64)]);
    await c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true);
    await assertDeleted(c, f);
    const [[other]] = await c.pool.query('SELECT COUNT(*) AS n FROM web_player_goals WHERE binding_id=?', [bound.insertId]);
    assert.equal(other.n, 1);
    const [[binding]] = await c.pool.query('SELECT is_current FROM web_taiko_bindings WHERE id=?', [bound.insertId]);
    assert.equal(binding.is_current, 1);
    const [[slot]] = await c.pool.query('SELECT slot_index,is_current FROM bind WHERE qq=?', [otherBot]);
    assert.equal(slot.slot_index, 1);
    assert.equal(slot.is_current, 1);
    assert.equal(decodeSqlRecoveryBackup((await receipt(c)).sql_backup, (await receipt(c)).sql_backup_sha256).botBindings.length, 2);
    assert.equal(c.state.commits, 1);
  } finally { await c.pool.execute('DELETE FROM bind WHERE qq=?', [otherBot]); }
}));

test('a malformed pending receipt records its failed attempt without touching files, then recovers after repair', { timeout: 20000 }, async () => fixture(async c => {
  const f = await populate(c);
  c.state.afterSqlCommit = () => { c.scopeModule.currentScoreScope(c.taikoId).lease.purgeBackupArchives = async () => { throw new Error('Synthetic interruption before cleanup'); }; };
  await assert.rejects(c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true));
  const pending = await receipt(c);
  await c.pool.execute("UPDATE taiko_source_lifecycle SET kind='invalid' WHERE operation_id=?", [pending.operation_id]);
  const { recoverOneManualSourceDeletion } = await import('../server/services/account/manual-lifecycle.ts');
  await assert.rejects(recoverOneManualSourceDeletion(undefined, pending.operation_id));
  const invalid = await receipt(c);
  assert.ok(invalid.last_attempt_at);
  assert.equal(invalid.attempts, 1);
  assert.deepEqual(await snapshot(c), f.before);
  assert.equal(await readFile(f.daily, 'utf8'), f.dailyRaw);
  await c.pool.execute("UPDATE taiko_source_lifecycle SET kind='manual-delete' WHERE operation_id=?", [pending.operation_id]);
  assert.deepEqual(await recoverOneManualSourceDeletion(undefined, pending.operation_id), { recovered: true });
  await assertDeleted(c, f);
}));

async function ownedCrash(c, point) {
  const options = resolve(c.root, 'crash-options.json');
  const childFile = resolve(c.root, 'crash-child.mjs');
  await writeFile(options, JSON.stringify({ point, owner: c.owner, taikoId: c.taikoId, config: c.config }), { mode: 0o600 });
  const runtime = new URL('./fixtures/goalSqlRuntime.mjs', import.meta.url).href;
  const source = new URL('../server/services/taiko-domain/publication.ts', import.meta.url).href;
  const manual = new URL('../server/utils/account/manual.ts', import.meta.url).href;
  await writeFile(childFile, `
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import mysql from ${JSON.stringify(import.meta.resolve('mysql2/promise'))};
import {installGoalSqlRuntime} from ${JSON.stringify(runtime)};
assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
assert.match(String(process.env.TAIKO_DB_NAME||''),/_test$/);
const options=JSON.parse(await readFile(process.argv[2],'utf8'));
const pool=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2});
const [[identity]]=await pool.query('SELECT DATABASE() AS name');
assert.match(identity.name,/_test$/);assert.equal(identity.name,process.env.TAIKO_DB_NAME);
let scope;
const db={execute:(...args)=>pool.execute(...args),query:(...args)=>pool.query(...args),async getConnection(){
 assert.equal(scope.currentScoreScope(options.taikoId)?.mode,'write');
 const connection=await pool.getConnection();
 return {beginTransaction:()=>connection.beginTransaction(),rollback:()=>connection.rollback(),destroy:()=>connection.destroy(),release:()=>connection.release(),
  async execute(sql,args){const result=await connection.execute(sql,args);if(options.point==='before-sql-commit'&&sql.startsWith('DELETE FROM taiko_manual_accounts'))process.exit(73);return result;},
  async commit(){await connection.commit();if(options.point==='after-sql-commit')process.exit(73);
   if(options.point==='after-source-commit'){const lease=scope.currentScoreScope(options.taikoId).lease;const publish=lease.publish;lease.publish=async input=>{await publish(input);process.exit(73);};}}
 };
}};
installGoalSqlRuntime(db,options.config);
scope=await import(${JSON.stringify(source)});
const service=await import(${JSON.stringify(manual)});
await service.permanentlyDeleteManualAccount(options.owner,options.taikoId,true);
process.exit(74);
`, { mode: 0o600 });
  await assert.rejects(execFileAsync(process.execPath, ['--experimental-strip-types', childFile, options], { cwd: new URL('../', import.meta.url), timeout: 15000, maxBuffer: 8192 }), error => error.code === 73);
}

for (const point of ['before-sql-commit', 'after-sql-commit', 'after-source-commit']) {
  test(`actual owned process death ${point} preserves the correct SQL authority and resumes from durable receipt`, { timeout: 25000 }, async () => fixture(async c => {
    const f = await populate(c);
    const counts = await rowCounts(c, f.id);
    await ownedCrash(c, point);
    if (point === 'before-sql-commit') {
      assert.deepEqual(await rowCounts(c, f.id), counts);
      assert.equal(await receipt(c), undefined);
      assert.deepEqual(await snapshot(c), f.before);
      assert.equal(await readFile(f.daily, 'utf8'), f.dailyRaw);
      await c.manual.permanentlyDeleteManualAccount(c.owner, c.taikoId, true);
    } else {
      const pending = await receipt(c);
      assert.equal(pending.status, 'pending');
      for (const count of Object.values(await rowCounts(c, f.id))) assert.equal(count, 0);
      if (point === 'after-sql-commit') assert.deepEqual(await snapshot(c), f.before);
      const { recoverOneManualSourceDeletion } = await import('../server/services/account/manual-lifecycle.ts');
      assert.deepEqual(await recoverOneManualSourceDeletion(undefined, pending.operation_id), { recovered: true });
    }
    await assertDeleted(c, f);
  }));
}
