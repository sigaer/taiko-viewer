import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { calculateV1, calculateV2, resolveJudgments, lookupConstantScore } from '../utils/rtCalculator.ts';
import { buildV1RtCharts } from '../utils/rtCalculatorCatalog.ts';

const v1 = { level: 4, totalNotes: 1000000, constant: 10, constantScore: 12,
  complex: 80, averageDensity: 70, peakDensity: 90, separation: 65, bpmChange: 40 };
const v2 = { id: 10001, songName: 'Synthetic', difficulty: 'oni', totalNotes: 1000000,
  subConstant1: 10, mainConstant: 12, subConstant2: 14, stamina: 12, handspeed: 13, burst: 15, complex: 11, rhythm: 10 };

test('judgment completion preserves the chart total and rejects invalid counts', () => {
  assert.deepEqual(resolveJudgments(100, { good: NaN, ok: 10, bad: 2 }, 'good'), { good: 88, ok: 10, bad: 2 });
  assert.deepEqual(resolveJudgments(100, { good: 88, ok: NaN, bad: 2 }, 'ok'), { good: 88, ok: 10, bad: 2 });
  assert.deepEqual(resolveJudgments(100, { good: 88, ok: 10, bad: NaN }, 'bad'), { good: 88, ok: 10, bad: 2 });
  for (const counts of [{ good: 101, ok: 0, bad: 0 }, { good: 90.5, ok: 9.5, bad: 0 },
    { good: -1, ok: 101, bad: 0 }, { good: 90, ok: NaN, bad: 0 }, { good: 90, ok: 0, bad: 0 }]) {
    assert.equal(resolveJudgments(100, counts, 'manual'), null);
  }
  assert.equal(resolveJudgments(100, { good: 0, ok: 99, bad: 2 }, 'good'), null);
  assert.throws(() => calculateV2(v2, { good: 1000001, ok: 0, bad: 0 }), /Invalid/);
});

test('constant conversion interpolates and clamps against the actual mapping', () => {
  const table = [[1, 0.1], [5, 4], [10, 12]];
  assert.equal(lookupConstantScore(-1, table), 0.1);
  assert.equal(lookupConstantScore(12, table), 12);
  assert.equal(lookupConstantScore(7.5, table), 8);
});

test('catalog selects song ID and difficulty independently and omits unavailable constants', () => {
  const row = { id: 100, level: 4, combo: 800, score: 9, '复合处理': 80 };
  const config = { const_table: { const_to_score: { 8: 10, 10: 12 } }, songs: {
    oni: row, edit: { ...row, level: 5, combo: 900 }, other: { ...row, id: 101 },
    hard: { ...row, level: 3 }, noScore: { ...row, score: null }, noNotes: { ...row, combo: 0 }
  } };
  const charts = buildV1RtCharts(config, 100);
  assert.deepEqual(charts.map(row => [row.level, row.totalNotes, row.constantScore]), [[4,800,11],[5,900,11]]);
  assert.deepEqual(buildV1RtCharts(config, 999), []);
  assert.deepEqual(buildV1RtCharts({ ...config, const_table: {} },100), []);
});

test('threshold, full judgments and V2 bad-rate penalty', () => {
  for (const fn of [counts => calculateV1(v1, counts), counts => calculateV2(v2, counts)]) {
    assert.equal(fn({ good: 499998, ok: 500002, bad: 0 }).eligible, false);
    assert.equal(fn({ good: 500000, ok: 500000, bad: 0 }).eligible, true);
    const full = fn({ good: 1000000, ok: 0, bad: 0 });
    assert.equal(full.accuracy, 1);
    assert.ok([full.rating, ...full.dimensions].every(Number.isFinite));
  }
  const noBad = calculateV2(v2, { good: 960000, ok: 40000, bad: 0 });
  const bad = calculateV2(v2, { good: 980000, ok: 0, bad: 20000 });
  assert.equal(noBad.accuracy, bad.accuracy);
  assert.equal(noBad.rating, bad.rating);
  assert.ok(noBad.dimensions[5] > bad.dimensions[5]);
});

test('V1/V2 match installed Core on segment boundaries, density branches and real public charts', { timeout: 30000 }, t => {
  const python = process.env.TAIKO_PYTHON_EXECUTABLE || '/opt/taiko-bot/current/bin/python';
  if (!existsSync(python)) return t.skip('Installed Taiko Core interpreter unavailable');
  const cases = [];
  for (const point of [0, 0.5, 0.749999, 0.75, 0.750001, 0.827799, 0.8278, 0.827801, 0.899999, 0.9,
    0.900001, 0.949999, 0.95, 0.950001, 0.979299, 0.9793, 0.979301, 0.99, 0.999999, 1]) {
    const good = Math.round(point * 1000000);
    for (const variant of [0, 1, 2]) {
      cases.push({ v1: { ...v1, averageDensity: [70, 90, 0][variant], peakDensity: [90, 70, 0][variant] },
        v2: { ...v2, handspeed: [13, 0, 15][variant], burst: [15, 0, 13][variant] },
        counts: { good, ok: 0, bad: 1000000 - good } });
    }
  }
  // Public catalog only; no account records or DB are read.
  const catalogPath = '/home/sigaer/taiko/songs/rating_structured_with_ids.json';
  if (existsSync(catalogPath)) {
    const config = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const table = Object.entries(config.const_table.const_to_score).map(([c, s]) => [Number(c), Number(s)]).sort((a,b) => a[0]-b[0]);
    for (const row of Object.values(config.songs).filter(row => [4,5].includes(Number(row.level))).slice(0, 20)) {
      const total = Number(row.combo), ok = Math.floor(total * .04), bad = Math.floor(total * .01);
      cases.push({ v1: { level: Number(row.level), totalNotes: total, constant: row.score, constantScore: lookupConstantScore(row.score, table),
        complex: row['复合处理'], averageDensity: row['平均密度'], peakDensity: row['瞬间密度'], separation: row['叩き分け'], bpmChange: row['BPM变化'] },
        v2: { ...v2, totalNotes: total }, counts: { good: total-ok-bad, ok, bad } });
    }
  }
  const code = `
import json,sys
from sakura_taiko_core.score.calculation import _compute_results_from_userdata_records
from sakura_taiko_core.score.v2 import result_from_entry
from sakura_taiko_core.models.calculation import V2SongData
out=[]
for case in json.load(sys.stdin):
 c=case['v1'];v=case['v2'];n=case['counts']
 rec={'song_no':10001,'level':4,'good_cnt':n['good'],'ok_cnt':n['ok'],'ng_cnt':n['bad']}
 song={'id':10001,'level':4,'song_name_cn':'Synthetic','score':c['constant'],'combo':c['totalNotes'],'复合处理':c['complex'],'平均密度':c['averageDensity'],'瞬间密度':c['peakDensity'],'叩き分け':c['separation'],'BPM变化':c['bpmChange']}
 rows=_compute_results_from_userdata_records([rec],{'songs':{'Synthetic':song}},[(c['constant'],c['constantScore'])])
 a=rows[0] if rows else None
 chart=V2SongData(10001,4,'Synthetic',v['totalNotes'],v['subConstant1'],v['mainConstant'],v['subConstant2'],v['stamina'],v['handspeed'],v['burst'],v['complex'],v['rhythm'])
 b=result_from_entry(rec,{(10001,4):chart},profile='v2-center-20261010')
 out.append({'v1':None if a is None else [a.AI_rating,a.big_song,a.stamina,a.speed,a.accuracy_power,a.rhythm,a.complex_proc], 'v2':None if b is None else [b.AI_rating,b.stamina_rt,b.handspeed_rt,b.burst_rt,b.accuracy_rt,b.rhythm_rt,b.complex_rt]})
print(json.dumps(out))
`;
  const run = spawnSync(python, ['-I', '-c', code], { input: JSON.stringify(cases), encoding: 'utf8', timeout: 20000, maxBuffer: 256*1024 });
  assert.equal(run.status, 0, `Core parity worker failed: ${run.stderr?.slice(0, 800)}`);
  const expected = JSON.parse(run.stdout);
  for (let i=0;i<cases.length;i++) for (const version of ['v1','v2']) {
    const actual = version === 'v1' ? calculateV1(cases[i].v1,cases[i].counts) : calculateV2(cases[i].v2,cases[i].counts);
    if (expected[i][version] === null) { assert.equal(actual.eligible, false); continue; }
    assert.equal(actual.eligible, true);
    [actual.rating,...actual.dimensions].forEach((value, index) => assert.ok(Math.abs(value-expected[i][version][index]) < 1e-8, `${version} case ${i} metric ${index} differs`));
  }
  t.diagnostic(`${cases.length} cases × V1/V2 × seven scores matched installed Core`);
});
