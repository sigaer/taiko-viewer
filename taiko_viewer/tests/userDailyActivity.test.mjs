import test from 'node:test';
import assert from 'node:assert/strict';

const { activityDayKey, shiftDayKey, createDailyActivityMemo, recordDailyActivity } =
  await import('../server/services/user-activity/daily-activity.ts');

test('activity day key uses the Beijing calendar regardless of process TZ', () => {
  const previousTZ = process.env.TZ;
  try {
    for (const tz of ['Asia/Shanghai', 'UTC', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      assert.equal(activityDayKey(new Date('2026-10-01T15:59:59Z')), '2026-10-01');
      assert.equal(activityDayKey(new Date('2026-10-01T16:00:00Z')), '2026-10-02');
    }
  } finally {
    if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ;
  }
  assert.equal(shiftDayKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDayKey('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDayKey('2026-11-19', -29), '2026-10-21');
});

test('memo claims once per user per day and resets when the day changes', () => {
  const memo = createDailyActivityMemo();
  assert.equal(memo.claim('2026-11-19', 1), true);
  assert.equal(memo.claim('2026-11-19', 1), false);
  assert.equal(memo.claim('2026-11-19', 2), true);
  assert.equal(memo.size, 2);
  assert.equal(memo.claim('2026-11-20', 1), true);
  assert.equal(memo.size, 1);
  assert.equal(memo.day, '2026-11-20');
});

test('memo stays bounded and backs off after a failed write', () => {
  const memo = createDailyActivityMemo({ maxEntries: 3, backoffMs: 1000 });
  for (const id of [1, 2, 3, 4]) assert.equal(memo.claim('2026-11-19', id, 0), true);
  assert.ok(memo.size <= 3);
  memo.release('2026-11-19', 4, 10);
  assert.equal(memo.claim('2026-11-19', 4, 500), false);
  assert.equal(memo.claim('2026-11-19', 4, 1011), true);
});

test('recordDailyActivity writes once per day and never rejects', async () => {
  const calls = [];
  const db = { execute: async (sql, params) => { calls.push([sql, params]); } };
  const memo = createDailyActivityMemo();
  const at = new Date('2026-11-19T02:00:00Z');
  assert.equal(await recordDailyActivity(db, 7, at, memo), true);
  assert.equal(await recordDailyActivity(db, 7, at, memo), false);
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^INSERT IGNORE INTO web_user_daily_activity \(day, user_id\)/);
  assert.deepEqual(calls[0][1], ['2026-11-19', 7]);
  assert.equal(await recordDailyActivity(db, 'abc', at, memo), false);
  assert.equal(await recordDailyActivity(db, 0, at, memo), false);

  const failing = { execute: async () => { const e = new Error('missing'); e.code = 'ER_NO_SUCH_TABLE'; throw e; } };
  const memo2 = createDailyActivityMemo({ backoffMs: 60_000 });
  await assert.doesNotReject(recordDailyActivity(failing, 8, at, memo2));
  assert.equal(await recordDailyActivity(failing, 9, at, memo2), false);
  const throwingSync = { execute: () => { throw new Error('sync'); } };
  await assert.doesNotReject(recordDailyActivity(throwingSync, 10, at, createDailyActivityMemo()));
});
