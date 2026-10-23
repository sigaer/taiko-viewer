// Native round-trip of this run's synthetic SQL only. Never a production backup.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createReadStream, openSync, closeSync, realpathSync, statSync} from 'node:fs';
import {unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

export async function restoreSyntheticAuthorization({pool, database, socket, scratch, expectedTables}) {
  assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, '1');
  const [[proof]] = await pool.query('SELECT DATABASE() name,@@datadir dir');
  assert.equal(proof.name, database);
  assert.match(database, /^viewer_account_entry_test$/);
  assert.equal(realpathSync(proof.dir), resolve(scratch, 'community-mysql-data'));
  assert.equal(socket, resolve(scratch, 'community-mysql.sock'));
  const [rows] = await pool.query('SHOW TABLES');
  const tables = rows.map(row => Object.values(row)[0]).sort();
  assert.deepEqual(tables, [...expectedTables].sort(), 'Only the exact synthetic fixture tables may be restored');
  async function counts() {
    const result = {};
    for (const table of tables) {
      assert.match(table, /^[a-z_]+$/);
      const [[row]] = await pool.query('SELECT COUNT(*) n FROM `' + table + '`');
      result[table] = row.n;
    }
    return result;
  }
  const before = await counts(), file = resolve(scratch, 'synthetic-authorization.sql');
  assert.ok(Object.values(before).every(n => n <= 32) && Object.values(before).reduce((a, b) => a + b, 0) <= 128,
    'Synthetic restore exceeds the bounded row budget');
  const started = performance.now();
  let descriptor;
  try {
    descriptor = openSync(file, 'wx', 0o600);
    execFileSync('/www/server/mysql/bin/mysqldump', ['--no-defaults', '--socket=' + socket,
      '--user=root', '--single-transaction', '--skip-lock-tables', '--no-tablespaces',
      '--set-gtid-purged=OFF', '--skip-comments', '--skip-dump-date', '--skip-extended-insert',
      '--hex-blob', database, ...tables], {stdio: ['ignore', descriptor, 'pipe'], timeout: 10000, maxBuffer: 16384});
    closeSync(descriptor); descriptor = undefined;
    const bytes = statSync(file).size;
    assert.ok(bytes < 2 * 1024 * 1024, 'Synthetic dump exceeds bounded fixture size');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    const connection = await pool.getConnection();
    try {
      const [[again]] = await connection.query('SELECT DATABASE() name,@@datadir dir');
      assert.equal(again.name, database);
      assert.equal(realpathSync(again.dir), resolve(scratch, 'community-mysql-data'));
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      for (const table of tables) await connection.query('DROP TABLE `' + table + '`');
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
    } finally { connection.release(); }
    descriptor = openSync(file, 'r');
    execFileSync('/www/server/mysql/bin/mysql', ['--no-defaults', '--socket=' + socket,
      '--user=root', '--database=' + database], {stdio: [descriptor, 'ignore', 'pipe'], timeout: 10000, maxBuffer: 16384});
    closeSync(descriptor); descriptor = undefined;
    assert.deepEqual(await counts(), before, 'Restored table row counts changed');
    return {database, nativeDumpAndImport: true, tables, rowCounts: before,
      dumpBytes: bytes, dumpSha256: hash.digest('hex'), seconds: (performance.now() - started) / 1000,
      syntheticOnly: true, productionConnections: 0};
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
