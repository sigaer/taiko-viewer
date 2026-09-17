import test from 'node:test';
import assert from 'node:assert/strict';
import { annualEntryTarget, isAnnualMobileBrowser } from '../utils/annualDevice.ts';

test('desktop browsers remain blocked regardless of viewport; phones and tablets pass', () => {
  for (const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15']) assert.equal(isAnnualMobileBrowser(ua), false);
  assert.equal(isAnnualMobileBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 10), false);
  for (const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148', 'Mozilla/5.0 (Linux; Android 14) Chrome/128.0 Mobile', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148', 'Mozilla/5.0 (Linux; Android 14; Tablet)']) assert.equal(isAnnualMobileBrowser(ua), true);
  assert.equal(isAnnualMobileBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5), true);
});

test('gate covers localized entry/direct report; leaves operator, share and render routes alone', () => {
  for (const prefix of ['', '/ja']) {
    assert.equal(annualEntryTarget(prefix + '/annual'), 'entry');
    assert.equal(annualEntryTarget(prefix + '/account/version-summary/'), 'report');
    for (const path of ['/annual/share/token', '/account/annual-poster/summary', '/account/annual-share-card/summary', '/account/login', '/admin/taiko/annual-summaries', '/api/account/annual-summaries/annual_2026']) assert.equal(annualEntryTarget(prefix + path), null);
  }
});
