import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { readDailyGrowthMeasurements } from '../server/services/growth-history/measurements.ts';
import { auditGrowthMeasurementOrphans } from '../server/services/growth-history/audit.ts';

test('daily SQL projection uses Shanghai days, latest id ties, ownership and bounded range; cleanup is complete', async () => {
  const db = mysql.createPool({ host: process.env.TAIKO_DB_HOST, port: Number(process.env.TAIKO_DB_PORT || 3306), user: process.env.TAIKO_DB_USER, password: process.env.TAIKO_DB_PASSWORD, database: process.env.TAIKO_DB_NAME, connectionLimit: 1 });
  const users: number[] = [], bindings: number[] = [];
  try {
    const [[identity]] = await db.query<any[]>('SELECT DATABASE() AS name');
    assert.ok(identity.name.endsWith('_test')); assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION, '1');
    const tag = randomUUID().slice(0,8);
    for (let i=0; i<2; i++) {
      const [user] = await db.execute<any>('INSERT INTO web_user_accounts (username,email,password_hash) VALUES (?,?,?)', [`passport-${tag}-${i}`, `passport-${tag}-${i}@example.test`, 'no-login']);
      users.push(Number(user.insertId));
      const [binding] = await db.execute<any>("INSERT INTO web_taiko_bindings (user_id,taiko_id,source,is_current) VALUES (?,?,'manual',1)", [users[i], `passport-${tag}-${i}`]);
      bindings.push(Number(binding.insertId));
    }
    const insert = async (capturedAt: string, revision: string) => {
      const [row] = await db.execute<any>(`INSERT INTO web_growth_measurements (user_id,binding_id,score_revision,measurement_version,algorithm_version,model_revision,rating,dimensions_json,focus,sample_count,availability_state,captured_at) VALUES (?,?,?,1,'growth-v1','model-a',10,'{}','balanced',30,'ready',?)`, [users[0],bindings[0],revision.padEnd(64,'a'),capturedAt]);
      return String(row.insertId);
    };
    await insert('2026-10-05 15:59:59.000','first');
    const latestDay1 = await insert('2026-10-05 15:59:59.999','latest-day-1');
    await insert('2026-10-05 16:00:00.000','first-day-2');
    const latestDay2 = await insert('2026-10-05 16:00:00.000','tie-day-2');
    await insert('2026-10-08 16:00:00.000','excluded');
    const rows = await readDailyGrowthMeasurements(db,users[0]!,bindings[0]!,'2026-10-04T16:00:00Z','2026-10-08T16:00:00Z');
    assert.deepEqual(rows.map(row=>row.id),[latestDay1,latestDay2]);
    assert.equal((await readDailyGrowthMeasurements(db,users[1]!,bindings[0]!,'2026-10-04T16:00:00Z','2026-10-08T16:00:00Z')).length,0);
    assert.equal((await readDailyGrowthMeasurements(db,users[0]!,bindings[1]!,'2026-10-04T16:00:00Z','2026-10-08T16:00:00Z')).length,0);
  } finally {
    try {
      for (const binding of bindings) { await db.execute('DELETE FROM web_growth_measurements WHERE binding_id=?',[binding]); await db.execute('DELETE FROM web_taiko_bindings WHERE id=?',[binding]); }
      for (const user of users) await db.execute('DELETE FROM web_user_accounts WHERE id=?',[user]);
      for (const user of users) {
        const [[row]] = await db.query<any[]>('SELECT COUNT(*) AS n FROM web_user_accounts WHERE id=?',[user]); assert.equal(Number(row.n),0);
      }
      assert.deepEqual(await auditGrowthMeasurementOrphans(db),{userOrphans:0,bindingOrphans:0,ownerMismatches:0});
    } finally { await db.end(); }
  }
});
