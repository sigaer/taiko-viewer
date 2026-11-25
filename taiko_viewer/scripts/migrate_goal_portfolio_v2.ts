// Candidate tool intentionally cannot connect to a production database.
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { migratePortfolioV2 } from '../server/services/goals/migrations/portfolio-v2.ts';
for (const key of ['TAIKO_DB_HOST', 'TAIKO_DB_USER', 'TAIKO_DB_NAME', 'TAIKO_GOAL_MIGRATION_CATALOG'])
    if (!process.env[key])
        throw Error('Explicit isolated configuration and frozen fixture catalog required');
if (!process.env.TAIKO_DB_NAME!.endsWith('_test'))
    throw Error('Only isolated _test database is allowed');
if (process.argv.some(x => !['--apply', '--dry-run'].includes(x) && x.startsWith('--')))
    throw Error('Unknown flag');
const db = await mysql.createConnection({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, supportBigNumbers: true, bigNumberStrings: true });
try {
    const catalog = JSON.parse(await readFile(process.env.TAIKO_GOAL_MIGRATION_CATALOG!, 'utf8'));
    console.log(JSON.stringify(await migratePortfolioV2(db, catalog, { apply: process.argv.includes('--apply') })));
}
finally {
    await db.end();
}
