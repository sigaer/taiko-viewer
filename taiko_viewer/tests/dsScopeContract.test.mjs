import test from 'node:test';
import assert from 'node:assert/strict';
import { sameScopeSnapshot, isProductionEpStylesheet } from '../scripts/ds/scope-contract.mjs';
test('scope check rejects tooltip/message/root regressions after equal stylesheet loading', () => {
  const baseline = { htmlVars: { '--el-color-primary': 'red' }, body: { color: 'black' }, tooltip: { color: 'white' }, message: { 'background-color': 'green' } };
  assert.ok(sameScopeSnapshot(baseline, structuredClone(baseline)));
  for (const key of Object.keys(baseline)) {
    const changed = structuredClone(baseline);
    changed[key][Object.keys(changed[key])[0]] = 'regression';
    assert.equal(sameScopeSnapshot(baseline, changed), false, key);
  }
});

import { SAMPLE_MARKERS } from '../scripts/ds/build-report.mjs';
test('production DS assets are allowed while sample implementation remains forbidden', () => {
  const sample = path => SAMPLE_MARKERS.some(marker => path.includes(marker));
  assert.equal(sample('ds-samples/10-tokens.vue'), true);
  for (const path of ['components/ds/Cover.vue', 'assets/css/ds/tokens.css', 'assets/font/ds/barlow.woff2'])
    assert.equal(sample(path), false);
});

test('control warms vendor EP styles without importing sample CSS that could hide a leak', () => {
  assert.equal(isProductionEpStylesheet('http://localhost/_nuxt/el-tooltip.abc123.css'), true);
  for (const name of ['element-plus.abc123.css', '10-tokens.abc123.css', 'Cover.abc123.css'])
    assert.equal(isProductionEpStylesheet('http://localhost/_nuxt/' + name), false);
});
