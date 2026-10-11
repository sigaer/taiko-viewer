// Real manual services, MySQL and center bridge; synthetic identity/source only.
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { cp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { openPublicationLease } from '../server/infrastructure/taiko-publication/client.ts';
import { manualSqlFixture as fixture, manualSourceSnapshot as snapshot, manualScoreInput as input } from './fixtures/manualSqlRuntime.mjs';
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || '/home/sigaer/git/Sakura_bot/taiko';

test('actual manual create/read/rename/edit/delete preserve the frozen legacy payload and all historical bytes', { timeout: 20000 }, async () => fixture(async c => {
  const originalRoot = c.config.userdataDir;
  const legacyRoot = resolve(c.root, 'legacy-userdata');
  await cp(originalRoot, legacyRoot, { recursive: true });
  const frozen = execFileSync('git', ['show', 'fbfd43e:taiko_viewer/server/utils/account/manual.ts'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const originalUrl = new URL('../server/utils/account/manual.ts', import.meta.url);
  const resolved = frozen.replace(/from "([^"]+)"/g, (full, name) => {
    if (name.startsWith('.')) return `from "${new URL(name.endsWith('.ts') ? name : name + '.ts', originalUrl).href}"`;
    if (!name.startsWith('~/') && !name.startsWith('node:')) return `from "${import.meta.resolve(name)}"`;
    return full;
  });
  const file = resolve(c.root, 'frozen-manual.mjs');
  await writeFile(file, ts.transpileModule(resolved, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const legacy = await import(pathToFileURL(file).href);
  const run = async service => {
    const results = [];
    results.push(await service.upsertManualScore(c.owner, c.taikoId, input));
    results.push(await snapshot(c));
    results.push(await service.getManualScore(c.owner, c.taikoId, 100, 4));
    results.push(await service.renameManualAccount(c.owner, c.taikoId, 'Renamed synthetic'));
    results.push(await snapshot(c));
    results.push(await service.upsertManualScore(c.owner, c.taikoId, { ...input, values: { high_score: 900000, combo_cnt: 200 } }));
    results.push(await snapshot(c));
    results.push(await service.deleteManualScore(c.owner, c.taikoId, 100, 4, true));
    results.push(await snapshot(c));
    return results;
  };
  const actual = await run(c.manual);
  await c.pool.execute('UPDATE taiko_manual_accounts SET nickname=? WHERE taiko_id=?', ['Synthetic manual', c.taikoId]);
  c.config.userdataDir = legacyRoot;
  const expected = await run(legacy);
  assert.deepEqual(actual, expected);
  c.config.userdataDir = originalRoot;
  const current = JSON.parse((await snapshot(c)).current);
  assert.equal(current.profile.mydon_name, 'Renamed synthetic');
  assert.equal(current._meta.source, 'manual');
  assert.equal(current.songs.length, 0);
}));

const revokedOperations = {
  rename: c => c.manual.renameManualAccount(c.owner, c.taikoId, 'Revoked rename'),
  upsert: c => c.manual.upsertManualScore(c.owner, c.taikoId, input),
  delete: c => c.manual.deleteManualScore(c.owner, c.taikoId, 100, 4, true),
  read: c => c.manual.getManualScore(c.owner, c.taikoId, 100, 4)
};
for (const [name, operation] of Object.entries(revokedOperations)) {
  test(`actual manual ${name} rechecks the SQL owner after waiting for the source fence`, { timeout: 15000 }, async () => fixture(async c => {
    await c.manual.upsertManualScore(c.owner, c.taikoId, input);
    const before = await snapshot(c);
    const baselineChecks = c.state.optimisticChecks;
    const blocker = await openPublicationLease({ root: c.config.userdataDir, repoRoot, identity: c.taikoId, mode: 'write' });
    let ready;
    const gate = new Promise(resolve => { ready = resolve; });
    c.state.onOptimisticChecks = () => { if (c.state.optimisticChecks >= baselineChecks + (name === 'rename' ? 1 : 2)) ready(); };
    const result = operation(c).then(value => ({ value }), error => ({ error }));
    let failure;
    let timer;
    try {
      await Promise.race([gate, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owner precheck was not reached')), 2000); })]);
      await c.pool.execute("UPDATE web_taiko_bindings SET source='wahlap' WHERE user_id=? AND taiko_id=?", [c.user, c.taikoId]);
    } catch (error) { failure = error; }
    finally { clearTimeout(timer); c.state.onOptimisticChecks = null; await blocker.close(); }
    const outcome = await result;
    if (failure) throw failure;
    assert.equal(outcome.error?.statusCode, 403);
    assert.deepEqual(await snapshot(c), before);
    const [[account]] = await c.pool.query('SELECT nickname FROM taiko_manual_accounts WHERE taiko_id=?', [c.taikoId]);
    assert.equal(account.nickname, 'Synthetic manual');
  }));
}

test('actual manual rename compensates SQL nickname after a proven pre-publication failure', { timeout: 15000 }, async () => fixture(async c => {
  const before = await snapshot(c);
  let compensatedUnderFence = false;
  c.state.afterExecute = async (sql, args) => {
    if (sql.startsWith('UPDATE taiko_manual_accounts SET nickname')) {
      if (args[0] === 'Renamed synthetic') c.scopeModule.currentScoreScope(c.taikoId).lease.publish = async () => { throw new Error('Synthetic pre-publication failure'); };
      else compensatedUnderFence = true;
    }
  };
  await assert.rejects(c.manual.renameManualAccount(c.owner, c.taikoId, 'Renamed synthetic'));
  assert.equal(compensatedUnderFence, true);
  const [[account]] = await c.pool.query('SELECT nickname FROM taiko_manual_accounts WHERE taiko_id=?', [c.taikoId]);
  assert.equal(account.nickname, 'Synthetic manual');
  assert.deepEqual(await snapshot(c), before);
}));

test('actual manual rename lost source acknowledgement retains the committed nickname and scores', { timeout: 15000 }, async () => fixture(async c => {
  c.state.afterExecute = async (sql, args) => {
    if (sql.startsWith('UPDATE taiko_manual_accounts SET nickname') && args[0] === 'Renamed synthetic') {
      const lease = c.scopeModule.currentScoreScope(c.taikoId).lease;
      const publish = lease.publish;
      lease.publish = async options => { await publish(options); throw new Error('Synthetic lost acknowledgement'); };
    }
  };
  assert.deepEqual(await c.manual.renameManualAccount(c.owner, c.taikoId, 'Renamed synthetic'), { ok: true, nickname: 'Renamed synthetic' });
  const [[account]] = await c.pool.query('SELECT nickname FROM taiko_manual_accounts WHERE taiko_id=?', [c.taikoId]);
  assert.equal(account.nickname, 'Renamed synthetic');
  assert.equal(JSON.parse((await snapshot(c)).current).profile.mydon_name, account.nickname);
}));

test('actual bot visibility and claim mutations hold source EX without producing score observations', { timeout: 15000 }, async () => fixture(async c => {
  const bot = { kind: 'bot', identityKey: c.botKey };
  await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'manual',1,1)", [c.botKey, c.taikoId]);
  await c.pool.execute('UPDATE taiko_manual_accounts SET bot_identity_key=? WHERE taiko_id=?', [c.botKey, c.taikoId]);
  const before = await snapshot(c);
  let checked = 0;
  c.state.afterExecute = async sql => {
    if (sql.startsWith('UPDATE bind SET visible') || sql.includes('INSERT INTO taiko_manual_claim_codes')) {
      assert.equal(c.scopeModule.currentScoreScope(c.taikoId)?.mode, 'write'); checked++;
    }
  };
  assert.deepEqual(await c.manual.setManualAccountVisibility(bot, c.taikoId, 1), { ok: true, visible: 1 });
  const claim = await c.manual.issueManualClaimCode(c.owner, c.taikoId);
  assert.match(claim.code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
  assert.equal(checked, 2);
  await c.manual.claimManualAccount(bot, claim.code);
  await assert.rejects(c.manual.claimManualAccount(bot, claim.code), error => error.statusCode === 400);
  assert.deepEqual(await snapshot(c), before);
}));

test('actual viewer detach takes source EX before the owner cleanup SQL transaction', { timeout: 15000 }, async () => fixture(async c => {
  await c.pool.execute("INSERT INTO bind (qq,id,source,slot_index,is_current) VALUES (?,?,'manual',1,1)", [c.botKey, c.taikoId]);
  await c.pool.execute('UPDATE taiko_manual_accounts SET bot_identity_key=? WHERE taiko_id=?', [c.botKey, c.taikoId]);
  const before = await snapshot(c);
  assert.deepEqual(await c.manual.detachManualAccount(c.owner, c.taikoId), { ok: true });
  const [[binding]] = await c.pool.query('SELECT COUNT(*) AS n FROM web_taiko_bindings WHERE user_id=? AND taiko_id=?', [c.user, c.taikoId]);
  assert.equal(binding.n, 0);
  await assert.rejects(c.manual.upsertManualScore(c.owner, c.taikoId, input), error => error.statusCode === 403);
  assert.deepEqual(await snapshot(c), before);
}));

test('actual manual ownership and confirmation errors preserve the existing API status and source bytes', { timeout: 15000 }, async () => fixture(async c => {
  const before = await snapshot(c);
  await assert.rejects(c.manual.deleteManualScore(c.owner, c.taikoId, 100, 4, false), error => error.statusCode === 409);
  await assert.rejects(c.manual.detachManualAccount(c.owner, c.taikoId), error => error.statusCode === 409);
  await assert.rejects(c.manual.upsertManualScore(c.owner, c.taikoId, { ...input, values: { high_score: -1 } }), error => error.statusCode === 400);
  await assert.rejects(c.manual.renameManualAccount({ kind: 'viewer', userId: c.user + 1 }, c.taikoId, 'Other owner'), error => error.statusCode === 403);
  await assert.rejects(c.manual.setManualAccountVisibility(c.owner, c.taikoId, 1), error => error.statusCode === 400);
  assert.deepEqual(await snapshot(c), before);
}));
