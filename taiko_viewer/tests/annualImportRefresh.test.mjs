import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';

test('import history invalidates only after an import and acknowledges the exact revision', async () => {
  const root = await mkdtemp('/var/tmp/annual-import-unit-');
  try {
    await build({ entryPoints: ['server/services/account/annual-summary/import-refresh.ts'], outfile: root+'/module.mjs', bundle: true, platform: 'node', format: 'esm' });
    const m = await import(root+'/module.mjs');
    await mkdir(root+'/123');
    await writeFile(root+'/123/data_20261001_wahlap.json', '{}');
    assert.equal((await m.annualImportState(root, '123')).revision, '');
    await writeFile(root+'/123/data_2026-10-01_kinoko-import.json', '{}');
    const first = await m.annualImportState(root, '123');
    assert.equal(m.annualImportNeedsRefresh({ generatedAt: '2026-09-01T00:00:00Z' }, first), true);
    const summary = { generatedAt: new Date().toISOString(), provenance: { warnings: ['kinoko_revision:'+first.revision] } };
    assert.equal(m.annualImportNeedsRefresh(summary, first), false);
    await writeFile(root+'/123/data_20250910_kinoko-history_abcdef.json', '{}');
    assert.equal(m.annualImportNeedsRefresh(summary, await m.annualImportState(root, '123')), true);
    assert.equal(m.annualImportNeedsRefresh(summary, await m.annualImportState(root, 'absent')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
