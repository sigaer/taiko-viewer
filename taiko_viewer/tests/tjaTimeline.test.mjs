import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const chart = (body, headers = '') => `TITLE:Golden\nBPM:120\n${headers}\nCOURSE:Oni\nLEVEL:1\n#START\n${body}\n#END`;
const fixtures = [
  ['constant', '10001000,', [null, 1000]],
  ['audit mid-bar BPM', '10\n#BPMCHANGE 240\n001000,', [null, 750]],
  ['audit delay', '10\n#DELAY 1\n001000,', [null, 2000]],
  ['BPM at endpoint', '1000\n#BPMCHANGE 240\n1000,', [null, 1000]],
  ['BPM at start', '#BPMCHANGE 240\n10001000,', [null, 500]],
  ['multiple BPM', '10\n#BPMCHANGE 240\n00\n#BPMCHANGE 60\n0010,', [null, 1750]],
  ['duplicate BPM index', '10\n#BPMCHANGE 240\n#BPMCHANGE 60\n001000,', [null, 1500]],
  ['delay at start', '#DELAY 1\n10001000,', [null, 1000]],
  ['delay at endpoint', '1000\n#DELAY .25\n1000,', [null, 1250]],
  ['mixed', '10\n#BPMCHANGE 240\n#DELAY .25\n001000,', [null, 1000]],
  ['measure', '#MEASURE 3/4\n10001000,', [null, 750]],
  ['measure with BPM', '#MEASURE 3/4\n10\n#BPMCHANGE 240\n001000,', [null, 562.5]],
  ['cross-bar BPM', '0000001\n#BPMCHANGE 240\n0,\n00100000,', [null, 625]],
  ['boundary delay', '00000010,\n#DELAY .2\n10000000,', [null, 700]],
  ['empty bar delay', '00000010,\n#DELAY .2\n,\n00100000,', [null, 3200]],
  ['mid-bar measure applies next bar', '1000\n#MEASURE 3/4\n1000,\n10001000,', [null, 1000, 1000, 750]],
  ['negative delay', '10\n#DELAY -.25\n001000,', [null, 750]],
  ['inline comments', '10001000, // notes', [null, 1000]],
  ['big notes', '30004000,', [null, 1000]],
];

test('TJA timeline golden corpus', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'timeline-'));
  try {
    const outfile = resolve(dir, 'timeline.mjs');
    await build({ stdin: { contents: `export { analyzeTJA } from './vendor/tja/TJAAnalyzer/offline-analysis/tja-gaps.ts'; export { getGapMs, getGapMeasures } from './vendor/tja/TJAAnalyzer/src/utils/note-gap.ts'; export { parseTJA } from './vendor/tja/TJARenderer/src/tja-parser.ts';`, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, alias: { 'tja-renderer': resolve(root, 'scripts/tja/renderer.ts') } });
    const { analyzeTJA, parseTJA, getGapMs, getGapMeasures } = await import(pathToFileURL(outfile));
    for (const [name, body, expected] of fixtures) await t.test(name, () => {
      assert.deepEqual(analyzeTJA(chart(body), 'ms', 'skip').courses.oni.unbranched.flat(), expected);
    });
    for (const offset of [-1, 0, 1.5]) await t.test(`OFFSET ${offset} leaves relative gaps invariant`, () => {
      assert.deepEqual(analyzeTJA(chart('10001000,', `OFFSET:${offset}`), 'ms', 'skip').courses.oni.unbranched.flat(), [null, 1000]);
    });
    await t.test('branches keep independent BPM and delay state', () => {
      const result = analyzeTJA(chart('#BRANCHSTART p,50,80\n#N\n10001000,\n#E\n10\n#BPMCHANGE 240\n001000,\n#M\n10\n#DELAY 1\n001000,\n#BRANCHEND'), 'ms', 'skip');
      for (const [branch, expected] of [['normal',1000],['expert',750],['master',2000]]) assert.deepEqual(result.courses.oni[branch].flat(), [null,expected]);
    });
    for (const marker of ['5','6','7','9']) await t.test(`long note ${marker} boundary modes`, () => {
      const parsed = parseTJA(chart(`1${marker}0\n#DELAY .25\n80001,`, 'BALLOON:5')).oni;
      assert.equal(getGapMs(parsed,0,7,{longNoteHandling:'end'}),1000);
      assert.equal(getGapMs(parsed,0,7,{longNoteHandling:'start'}),1750);
      assert.equal(getGapMs(parsed,0,7,{longNoteHandling:'skip'}),2000);
      assert.equal(getGapMs(parsed,0,7,{longNoteHandling:'strict'}),null);
    });
    await t.test('maxMeasures applies within a bar and ignores delay duration', () => {
      const parsed=parseTJA(chart('10\n#DELAY 1\n001000,')).oni;
      assert.equal(getGapMs(parsed,0,4,{maxMeasures:.49}),null);
      assert.equal(getGapMs(parsed,0,4,{maxMeasures:.5}),2000);
      assert.equal(getGapMeasures(parsed,0,4),.5);
    });
  } finally { await rm(dir,{recursive:true,force:true}); }
});
