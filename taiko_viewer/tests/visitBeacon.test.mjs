import test from 'node:test';
import assert from 'node:assert/strict';

const { visitDayKey, createVisitQualifier, decideVisitSend } = await import('../utils/visit-beacon.ts');
const { isVisitorDeviceId, isSameOriginVisit, isCountableUserAgent, shouldMarkVisitorSuspect, VISITOR_DEVICES_PER_IP_CAP, visitClientIp } =
  await import('../server/services/user-activity/visit-rules.ts');

test('beacon day key is the Beijing calendar day', () => {
  assert.equal(visitDayKey(Date.parse('2026-10-01T15:59:59Z')), '2026-10-01');
  assert.equal(visitDayKey(Date.parse('2026-10-01T16:00:00Z')), '2026-10-02');
});

test('visit qualifies after 5 s of cumulative visibility', () => {
  const q = createVisitQualifier({ visible: true, now: 0 });
  assert.equal(q.isQualified(4999), false);
  assert.equal(q.remainingMs(1000), 4000);
  q.setVisible(false, 3000);
  assert.equal(q.remainingMs(10_000), null);
  assert.equal(q.isQualified(60_000), false, 'hidden time does not count');
  q.setVisible(true, 60_000);
  assert.equal(q.isQualified(61_999), false);
  assert.equal(q.isQualified(62_000), true);
});

test('visit qualifies on first interaction, even when hidden at start', () => {
  const q = createVisitQualifier({ visible: false, now: 0 });
  assert.equal(q.isQualified(100_000), false);
  q.interact();
  assert.equal(q.isQualified(100_001), true);
});

test('send once per day, plus one re-send after logging in that day', () => {
  assert.deepEqual(decideVisitSend(null, '2026-11-19', false), { send: true, marker: '2026-11-19' });
  assert.deepEqual(decideVisitSend('2026-11-19', '2026-11-19', false), { send: false, marker: '2026-11-19' });
  assert.deepEqual(decideVisitSend('2026-11-19', '2026-11-19', true), { send: true, marker: '2026-11-19:u' });
  assert.equal(decideVisitSend('2026-11-19:u', '2026-11-19', true).send, false);
  assert.equal(decideVisitSend('2026-11-19:u', '2026-11-19', false).send, false);
  assert.deepEqual(decideVisitSend('2026-11-18:u', '2026-11-19', false), { send: true, marker: '2026-11-19' });
  assert.deepEqual(decideVisitSend(null, '2026-11-19', true), { send: true, marker: '2026-11-19:u' });
  assert.equal(decideVisitSend('garbage', '2026-11-19', false).send, true);
});

test('device id must be a UUID', () => {
  assert.equal(isVisitorDeviceId('3f2b8c1e-9a4d-4c7e-8b1a-2d3e4f5a6b7c'), true);
  assert.equal(isVisitorDeviceId('3F2B8C1E-9A4D-4C7E-8B1A-2D3E4F5A6B7C'), true);
  for (const bad of ['', 'abc', '3f2b8c1e9a4d4c7e8b1a2d3e4f5a6b7c', '3f2b8c1e-9a4d-4c7e-8b1a-2d3e4f5a6b7', '3f2b8c1e-9a4d-0c7e-8b1a-2d3e4f5a6b7c', 123, null, undefined, {}])
    assert.equal(isVisitorDeviceId(bad), false, String(bad));
});

test('same-origin check prefers Sec-Fetch-Site, else Origin vs host', () => {
  assert.equal(isSameOriginVisit({ secFetchSite: 'same-origin' }), true);
  assert.equal(isSameOriginVisit({ secFetchSite: 'same-site', origin: 'https://viewer.sakura-bot.cn', host: 'viewer.sakura-bot.cn' }), false);
  assert.equal(isSameOriginVisit({ secFetchSite: 'cross-site' }), false);
  assert.equal(isSameOriginVisit({ origin: 'https://viewer.sakura-bot.cn', host: 'viewer.sakura-bot.cn' }), true);
  assert.equal(isSameOriginVisit({ origin: 'https://evil.example', host: 'viewer.sakura-bot.cn' }), false);
  assert.equal(isSameOriginVisit({ origin: 'null', host: 'viewer.sakura-bot.cn' }), false);
  assert.equal(isSameOriginVisit({ host: 'viewer.sakura-bot.cn' }), false);
});

test('empty and automation user agents are not counted', () => {
  assert.equal(isCountableUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'), true);
  for (const ua of ['', '-', '   ', 'Mozilla/5.0 HeadlessChrome/120.0', 'Mozilla/5.0 PhantomJS/2.1', 'Googlebot/2.1', 'python-requests/2.31', 'Mozilla/5.0 Playwright', null])
    assert.equal(isCountableUserAgent(ua), false, String(ua));
});

test('client address trusts X-Real-IP only from a loopback proxy peer', () => {
  assert.equal(visitClientIp('127.0.0.1', '203.0.113.5'), '203.0.113.5');
  assert.equal(visitClientIp('::ffff:127.0.0.1', '2001:db8::1'), '2001:db8::1');
  assert.equal(visitClientIp('198.51.100.2', '203.0.113.5'), '198.51.100.2', 'direct client cannot choose its address');
  assert.equal(visitClientIp('127.0.0.1', '203.0.113.5, 10.0.0.1'), '127.0.0.1', 'not a single address');
  assert.equal(visitClientIp(undefined, undefined), 'unknown');
});

test('devices beyond the per-address cap are marked suspect', () => {
  assert.equal(VISITOR_DEVICES_PER_IP_CAP, 20);
  assert.equal(shouldMarkVisitorSuspect(0), false);
  assert.equal(shouldMarkVisitorSuspect(20), false);
  assert.equal(shouldMarkVisitorSuspect(21), true);
});

test('recordVisit stores only HMAC keys, marks over-cap devices suspect and never throws', async () => {
  const { recordVisit, visitKey } = await import('../server/services/user-activity/visit-recorder.ts');
  const calls = [];
  const fake = (existing) => ({
    query: async (sql, params) => { calls.push(['query', sql, params]); return [[{ total: existing }]]; },
    execute: async (sql, params) => { calls.push(['execute', sql, params]); return [{}]; }
  });
  const deviceId = '3f2b8c1e-9a4d-4c7e-8b1a-2d3e4f5a6b7c';
  const now = new Date('2026-11-19T02:00:00Z');
  assert.equal(await recordVisit(fake(3), { salt: 's', deviceId, ip: '198.51.100.7', userId: 42, now }), true);
  const insert = calls.find(([kind, sql]) => kind === 'execute' && sql.includes('INSERT INTO web_daily_visitors'));
  assert.deepEqual(insert[2], ['2026-11-19', visitKey('s', 'device', deviceId), visitKey('s', 'ip', '198.51.100.7'), 42, 0]);
  assert.match(insert[1], /ON DUPLICATE KEY UPDATE user_id = COALESCE\(VALUES\(user_id\), user_id\)/);
  assert.ok(!JSON.stringify(calls).includes(deviceId) && !JSON.stringify(calls).includes('198.51.100.7'), 'no plain identifiers');
  assert.equal(insert[2][1].length, 64);
  calls.length = 0;
  await recordVisit(fake(21), { salt: 's', deviceId, ip: '198.51.100.7', userId: null, now });
  assert.equal(calls.find(([kind, sql]) => kind === 'execute' && sql.includes('INSERT'))[2][4], 1);
  const broken = { query: async () => { throw new Error('down'); }, execute: async () => { throw new Error('down'); } };
  assert.equal(await recordVisit(broken, { salt: 's', deviceId, ip: 'x', userId: null, now }), false);
});
