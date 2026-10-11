// Private operator CLI: bounded stdin JSON, no raw token/credentials in argv.
import mysql from 'mysql2/promise';
import { SOURCE_SERVICE_GRANT_TABLE_SQL, SOURCE_SERVICE_GRANT_AUDIT_TABLE_SQL } from '../server/infrastructure/account/source-service-schema.ts';
import { provisionSourceService, SourceServiceProvisionError } from '../server/infrastructure/account/source-service-provision.ts';
const apply = process.argv.includes('--apply'), production = process.argv.includes('--production');
const deadline = setTimeout(() => { process.stderr.write('Source service operation timed out\n'); process.exit(1); }, 45000);
let db: mysql.Pool | undefined;
try {
  for (const key of ['TAIKO_DB_HOST', 'TAIKO_DB_USER', 'TAIKO_DB_NAME']) if (!process.env[key]) throw new SourceServiceProvisionError(400);
  let bytes = 0, body = '';
  for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 16384) throw new SourceServiceProvisionError(400); body += chunk.toString('utf8'); }
  db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER,
    password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 2, connectTimeout: 5000, timezone: 'Z' });
  const [[actual]] = await db.query<mysql.RowDataPacket[]>('SELECT DATABASE() AS name');
  if (production) {
    if (!process.env.TAIKO_SOURCE_SERVICE_EXPECTED_DATABASE || actual.name !== process.env.TAIKO_SOURCE_SERVICE_EXPECTED_DATABASE || actual.name.endsWith('_test') ||
      (apply && process.env.TAIKO_ALLOW_SOURCE_SERVICE_PRODUCTION_MUTATION !== '1')) throw new SourceServiceProvisionError(403);
  } else if (!actual.name?.endsWith('_test') || actual.name !== process.env.TAIKO_DB_NAME || (apply && process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== '1')) throw new SourceServiceProvisionError(403);
  // The normal schema bootstrap creates these tables. This also supports an
  // explicit isolated migration before a Viewer process has bootstrapped them.
  if (apply) { await db.execute(SOURCE_SERVICE_GRANT_TABLE_SQL); await db.execute(SOURCE_SERVICE_GRANT_AUDIT_TABLE_SQL); }
  let input: unknown;
  try { input = JSON.parse(body); } catch { throw new SourceServiceProvisionError(400); }
  const result = await provisionSourceService(db, input, { apply });
  process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, statusCode: error instanceof SourceServiceProvisionError ? error.statusCode : 503,
    message: 'Source service configuration unavailable' }) + '\n'); process.exitCode = 1;
} finally { if (db) await db.end(); clearTimeout(deadline); }
