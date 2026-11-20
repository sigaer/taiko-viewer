import test from 'node:test';
import assert from 'node:assert/strict';

const { formatAdminRelativeTime, formatAdminClock, formatAdminMonthDay } = await import('../utils/admin-time.ts');

test('admin relative time and Beijing clock/date labels', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  assert.equal(formatAdminRelativeTime('2026-11-19T11:59:30Z', now), '刚刚');
  assert.equal(formatAdminRelativeTime('2026-11-19T11:57:00Z', now), '3 分钟前');
  assert.equal(formatAdminRelativeTime('2026-11-19T09:00:00Z', now), '3 小时前');
  assert.equal(formatAdminRelativeTime('2026-11-18T10:00:00Z', now), '昨天');
  assert.equal(formatAdminRelativeTime('2026-11-14T12:00:00Z', now), '5 天前');
  assert.equal(formatAdminRelativeTime('2026-09-01T00:00:00Z', now), '9月1日');
  assert.equal(formatAdminRelativeTime('not a date', now), '—');
  assert.equal(formatAdminClock('2026-11-19T16:05:00Z'), '00:05');
  assert.equal(formatAdminMonthDay('2026-10-01T16:00:00Z'), '10月2日');
});
