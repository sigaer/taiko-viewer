import test from 'node:test';
import assert from 'node:assert/strict';
import {installGoalSqlRuntime} from './fixtures/goalSqlRuntime.mjs';

test('OurTaiko real Django link timestamp and protocol UTC timestamps are accepted', async () => {
  const uninstall=installGoalSqlRuntime(null,{});
  try {
    const {validOurTaikoLinkedAt}=await import('../server/services/oidc/ourtaiko-link.ts');
    for(const value of ['2026-11-03T07:00:36.936729+00:00','2026-11-03T15:00:36.936729+08:00','2026-10-28T03:00:00Z','2026-11-03T07:00:36.936Z']) assert.equal(validOurTaikoLinkedAt(value),true);
    for(const value of [null,42,'','not-a-time','2026-11-03','2026-11-03T07:00:36','2026-99-03T07:00:36Z','2026-11-03T07:00:36+99:00','2026-11-03T07:00:36Z\n']) assert.equal(validOurTaikoLinkedAt(value),false);
  } finally { uninstall(); }
});
