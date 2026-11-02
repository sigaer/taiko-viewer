// Run via scripts/memory/run_qa.sh. Empty private MySQL, synthetic TLS provider,
// actual H3 routes. No environment or data is inherited from production.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, open, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

assert.ok(process.argv.includes('--allow-test-db-mutation'), 'Explicit mutation opt-in required');
const scratch = await realpath(process.env.QA_RUN_TMPDIR || '');
const evidence = await realpath(process.env.QA_EVIDENCE_DIR || '');
assert.ok(scratch.startsWith('/home/sigaer/taiko/qa-vault/runs/'));
const cwd = fileURLToPath(new URL('../', import.meta.url));
const datadir = resolve(scratch, 'community-mysql-data'), socket = resolve(scratch, 'community-mysql.sock');
assert.ok(Buffer.byteLength(socket) < 104);
await mkdir(datadir, { mode: 0o700 });
const env = { PATH: process.env.PATH, TMPDIR: scratch, NODE_OPTIONS: '--max-old-space-size=1536', QA_RUN_TMPDIR: scratch, QA_EVIDENCE_DIR: evidence,
  COMMUNITY_TEST_SOCKET: socket, TAIKO_ALLOW_TEST_DB_MUTATION: '1', VIEWER_REVIEW_OUT: evidence };
const executable = '/www/server/mysql/bin/mysqld';
const base = ['--no-defaults', '--user=root', '--basedir=/www/server/mysql', `--datadir=${datadir}`, '--innodb-buffer-pool-size=128M', '--innodb-log-file-size=32M', '--performance-schema=OFF'];
async function run(command, args, name, timeout = 120000) {
  const log = await open(resolve(evidence, name + '.log'), 'w', 0o600);
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', log.fd, log.fd] });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
  try { return await new Promise((accept, reject) => { child.once('error', reject); child.once('close', code => accept(code)); }); }
  finally { clearTimeout(timer); await log.close(); }
}
let daemon, admin;
const report = { productionConnections: 0, productionWrites: 0, pass: false };
try {
  assert.equal(await run(executable, [...base, '--initialize-insecure'], 'oidc-mysql-initialize'), 0);
  const log = await open(resolve(evidence, 'oidc-mysql.log'), 'w', 0o600);
  daemon = spawn(executable, [...base, '--skip-networking', '--mysqlx=OFF', `--socket=${socket}`, `--pid-file=${scratch}/mysql.pid`, '--max-connections=20', '--table-open-cache=128'], { cwd, env, stdio: ['ignore', log.fd, log.fd] });
  await log.close();
  for (let i = 0; i < 120; i++) {
    try { admin = await mysql.createConnection({ socketPath: socket, user: 'root', connectTimeout: 300 }); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  assert.ok(admin, 'Owned MySQL ready');
  const [[proof]] = await admin.query('SELECT @@datadir dir');
  assert.equal(await realpath(proof.dir), datadir);
  await admin.end(); admin = null;
  const key = resolve(scratch, 'oidc-key.pem'), cert = resolve(scratch, 'oidc-cert.pem');
  assert.equal(await run('/usr/bin/openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=OIDC synthetic test', '-addext', 'subjectAltName=IP:127.0.0.1'], 'oidc-tls'), 0);
  Object.assign(env, { OIDC_TEST_CERT: cert, OIDC_TEST_KEY: key, NODE_EXTRA_CA_CERTS: cert });
  report.oidcExit = await run(process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=1', 'tests/oidcSqlHttp.test.mjs'], 'oidc-sql-http', 180000);
  report.legacyExit = await run(process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=1', 'tests/accountEntrySqlHttp.test.mjs'], 'oidc-legacy-account-http', 180000);
  report.pass = report.oidcExit === 0 && report.legacyExit === 0;
} finally {
  await admin?.end().catch(() => {});
  if (daemon) {
    const exited = new Promise(r => daemon.once('close', r));
    daemon.kill('SIGTERM'); const timer = setTimeout(() => daemon.kill('SIGKILL'), 15000);
    await exited; clearTimeout(timer); report.daemonExited = true;
  }
  await writeFile(resolve(evidence, 'oidc-isolation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}
