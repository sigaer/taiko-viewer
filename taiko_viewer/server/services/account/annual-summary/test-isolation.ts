import { realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

// Only activated by an explicitly isolated synthetic run. The bootstrap also
// verifies the actual database/grants before starting Nitro (which runs jobs).
export function annualTestIsolation() {
  const raw = process.env.ANNUAL_E2E_ISOLATED_ROOT;
  if (!raw) return null;
  const root = realpathSync(raw);
  if (!root.startsWith('/var/tmp/annual-test-') ||
      process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== '1' ||
      !process.env.TAIKO_DB_NAME?.endsWith('_test') ||
      process.env.ANNUAL_E2E_SYNTHETIC_DATA !== '1') {
    throw new Error('Invalid annual test worker boundary');
  }
  for (const key of ['TAIKO_USERDATA_DIR', 'TAIKO_ANNUAL_CACHE_DIR', 'TAIKO_ANNUAL_ADMISSION_DIR']) {
    if (!realpathSync(process.env[key] || '').startsWith(root + sep)) throw new Error(`Unsafe ${key}`);
  }
  return {
    tmp: resolve(root, 'tmp'),
    properties: [
      '--slice=development-qa.slice',
      '-p', 'IPAddressDeny=any', '-p', 'IPAddressAllow=localhost',
      '-p', 'ProtectSystem=strict', '-p', `ReadWritePaths=${root}`,
      '-p', 'InaccessiblePaths=-/home/sigaer/taiko/userdata -/home/sigaer/taiko/config.json -/etc/taiko-viewer.env -/etc/taiko-runtime.env'
    ]
  };
}
