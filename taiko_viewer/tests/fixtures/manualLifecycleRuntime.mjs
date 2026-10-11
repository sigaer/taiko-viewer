// Shared synthetic owned lifecycle setup; no production/private data input.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {manualSourceSnapshot as snapshot,manualScoreInput as input} from './manualSqlRuntime.mjs';
const digest=raw=>createHash('sha256').update(raw).digest('hex');

export async function populate(c) {
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
  return { id, daily, dailyRaw, before: await snapshot(c), initialCommits: c.state.commits };
}
export async function receipt(c) {
  const [[row]] = await c.pool.query('SELECT * FROM taiko_source_lifecycle WHERE taiko_id=? ORDER BY created_at DESC,operation_id DESC LIMIT 1', [c.taikoId]);
  return row;
}
export async function rowCounts(c, id) {
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
export async function assertDeleted(c, fixture, expectedStatus = 'published') {
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
