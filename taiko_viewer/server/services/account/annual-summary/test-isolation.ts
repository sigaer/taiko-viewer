import { lstatSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, resolve, sep } from 'node:path';

// Only activated by an explicitly isolated synthetic run. SQL bootstrap separately
// verifies SELECT DATABASE()/datadir/grants before jobs can mutate their test DB.
const noSymlinkPath = (raw: string) => {
  if (!isAbsolute(raw)) throw new Error('Absolute annual QA path required');
  let current = sep;
  for (const part of resolve(raw).split(sep).filter(Boolean)) {
    current = resolve(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error('Annual QA symlink forbidden');
  }
  return realpathSync(raw);
};
export function annualTestIsolation() {
  const raw = process.env.ANNUAL_E2E_ISOLATED_ROOT;
  if (!raw) return null;
  const run = noSymlinkPath(process.env.QA_RUN_DIR || '');
  const scratch = noSymlinkPath(process.env.QA_RUN_TMPDIR || '');
  const root = noSymlinkPath(raw);
  const runId = process.env.QA_RUN_ID || '';
  if (!/^qa-[0-9a-f]{12}$/.test(runId) || basename(run) !== runId ||
      !run.startsWith('/home/sigaer/taiko/qa-vault/runs/') ||
      scratch !== resolve(run, 'scratch') ||
      !root.startsWith(scratch + sep + 'annual-test-') ||
      process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== '1' ||
      !process.env.TAIKO_DB_NAME?.endsWith('_test') ||
      process.env.ANNUAL_E2E_SYNTHETIC_DATA !== '1') {
    throw new Error('Invalid annual test worker boundary');
  }
  for (const key of ['TAIKO_USERDATA_DIR', 'TAIKO_ANNUAL_CACHE_DIR', 'TAIKO_ANNUAL_ADMISSION_DIR']) {
    if (!noSymlinkPath(process.env[key] || '').startsWith(root + sep)) throw new Error(`Unsafe ${key}`);
  }
  return {
    tmp: resolve(root, 'tmp'),
    properties: [
      '--slice=development-qa.slice',
      // Test worker units stop before their owning QA unit: scratch cleanup must
      // never race an orphaned sibling generator/renderer cgroup.
      '-p', `BindsTo=taiko-${runId}.service`, '-p', `After=taiko-${runId}.service`,
      '-p', 'IPAddressDeny=any', '-p', 'IPAddressAllow=localhost',
      '-p', 'ProtectSystem=strict', '-p', `ReadWritePaths=${root}`,
      '-p', 'InaccessiblePaths=-/home/sigaer/taiko/userdata -/home/sigaer/taiko/config.json -/etc/taiko-viewer.env -/etc/taiko-runtime.env'
    ]
  };
}
