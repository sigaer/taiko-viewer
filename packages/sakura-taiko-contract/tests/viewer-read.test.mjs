import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { legacyScoreReader, legacyScoreValue, legacyCrown, legacyJudgmentTotal, legacyScoreInstant, hasLegacyScoreEvidence, fromLegacyScore } from '../src/legacy.mjs';

test('read profiles preserve all original counter acceptance policies', async () => {
  const golden = JSON.parse(await readFile(new URL('../fixtures/viewer-read-utc.json', import.meta.url), 'utf8'));
  for (const row of golden.numeric) {
    assert.equal(legacyScoreValue(row.value, row.profile), row.expected, `${row.profile}: ${JSON.stringify(row.value)}`);
    assert.equal(legacyScoreReader(row.profile)(row.value), row.expected);
  }
  for (const row of golden.crowns) {
    assert.equal(legacyCrown(row.record, 'viewer-daily-v1'), row.crown);
    assert.equal(legacyJudgmentTotal(row.record, 'viewer-daily-v1'), row.judgments);
  }
  assert.equal(legacyScoreValue(undefined, 'viewer-goal-v1'), null);
  assert.equal(legacyScoreValue(undefined, 'viewer-overview-v1'), 0);
  assert.throws(() => legacyScoreValue(1, 'unknown'), /Unknown/);
});

test('timestamp decoding preserves original semantics in UTC and Asia/Shanghai', () => {
  const module = new URL('../src/legacy.mjs', import.meta.url).href;
  const script = `import {readFileSync} from 'node:fs';import {legacyScoreInstant} from ${JSON.stringify(module)};const g=JSON.parse(readFileSync(process.argv[1]));const ok=g.instants.every(r=>[['daily','viewer-daily-v1'],['goal','viewer-goal-v1'],['evidence','viewer-evidence-v1']].every(([key,profile])=>legacyScoreInstant(r.value,profile)===r[key]));if(!ok)process.exitCode=1;`;
  for (const [zone, file] of [['UTC', 'utc'], ['Asia/Shanghai', 'shanghai']]) {
    execFileSync(process.execPath, ['--input-type=module', '-e', script, new URL(`../fixtures/viewer-read-${file}.json`, import.meta.url).pathname], { env: { ...process.env, TZ: zone }, timeout: 5000, maxBuffer: 8192, stdio: 'pipe' });
  }
});

test('compatibility decoding does not weaken the strict canonical Score mapper', () => {
  assert.equal(legacyScoreValue(true, 'viewer-daily-v1'), 1);
  assert.equal(legacyScoreValue(true, 'viewer-goal-v1'), null);
  assert.equal(hasLegacyScoreEvidence({ high_score: 0.5 }), false);
  assert.equal(hasLegacyScoreEvidence({ stage_cnt: 1 }), true);
  assert.equal(hasLegacyScoreEvidence({ high_score: null }), false);
  assert.throws(() => fromLegacyScore({ song_no: 1, level: 4, good_cnt: true }, { source: 'synthetic', capturedAt: null }), /invalid score field/);
  assert.throws(() => fromLegacyScore({ song_no: 1, level: 4, good_cnt: 1.5 }, { source: 'synthetic', capturedAt: null }), /invalid score field/);
  assert.equal(legacyScoreInstant(null, 'viewer-goal-v1'), null);
});
