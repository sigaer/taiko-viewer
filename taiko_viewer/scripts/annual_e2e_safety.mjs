import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import { sep } from 'node:path';

// Fail before starting Nitro: startup itself can migrate tables or resume jobs.
export async function assertAnnualE2eEnvironment(env) {
  assert.equal(env.TAIKO_ALLOW_TEST_DB_MUTATION, '1', 'E2E requires explicit test mutation opt-in');
  assert.match(env.TAIKO_DB_NAME || '', /_test$/, 'E2E requires a test database');
  assert.ok(!env.ANNUAL_E2E_BASE_URL, 'E2E must own its server; external targets are not verified');
  const root = await realpath(env.ANNUAL_E2E_ISOLATED_ROOT || '/missing-annual-test-root');
  assert.ok(root.startsWith('/var/tmp/annual-test-'), 'Use a dedicated /var/tmp/annual-test-* root');
  for (const key of ['TAIKO_USERDATA_DIR', 'TAIKO_ANNUAL_CACHE_DIR', 'TAIKO_ANNUAL_ADMISSION_DIR']) {
    const path = await realpath(env[key] || '/missing-annual-test-path');
    assert.ok(path.startsWith(root + sep), `${key} must resolve inside the isolated root`);
  }
  // A manifest is an operator attestation, not automatic proof of full isolation.
  assert.equal(env.ANNUAL_E2E_SYNTHETIC_DATA, '1', 'Only synthetic userdata is allowed');
  assert.equal(env.ANNUAL_E2E_EGRESS_BLOCKED, '1', 'Block external callbacks/storage/analytics before running E2E');
}
