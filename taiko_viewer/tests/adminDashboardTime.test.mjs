import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

test('dashboard uses Shanghai calendar boundaries and explicit source timezones', async () => {
  const root = await mkdtemp('/var/tmp/dashboard-time-test-');
  const previousTZ = process.env.TZ;
  try {
    await build({entryPoints:['server/utils/admin/dashboard-time.ts'],outfile:root+'/time.mjs',bundle:true,platform:'node',format:'esm'});
    const m = await import(root+'/time.mjs');
    for (const tz of ['Asia/Shanghai','UTC','America/Los_Angeles']) {
      process.env.TZ = tz;
      const midnight = m.parseNginxLogTime('02/Oct/2026:00:03:00 +0800');
      assert.equal(midnight.toISOString(),'2026-10-01T16:03:00.000Z');
      assert.equal(m.parseNginxLogTime('01/Oct/2026:09:03:00 -0700').getTime(),midnight.getTime());
      assert.equal(m.dashboardBucketStart(midnight,'day').toISOString(),'2026-10-01T16:00:00.000Z');
      assert.equal(m.dashboardDayKey(new Date('2026-10-01T15:59:59Z')),'2026-10-01');
      assert.equal(m.dashboardDayKey(midnight),'2026-10-02');
      const viewer = m.dashboardRollupTime('2026-10-01 17:00:00','viewer');
      const bot = m.dashboardRollupTime('2026-10-02 01:00:00','bot');
      assert.deepEqual(viewer,{bucket:'2026-10-01T17:00:00.000Z',label:'10-02 01:00',day:'2026-10-02'});
      assert.deepEqual(bot,viewer);
      assert.equal(m.dashboardBucketStart(new Date(viewer.bucket),'hour').getTime(),Date.parse(viewer.bucket));
    }
  } finally {
    if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ;
    await rm(root,{recursive:true,force:true});
  }
});
