import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readDailyAbilityArchive, mergeDailyAbilityMeasurements } from '../server/services/growth-history/daily-archive.ts';

test('archive restores historical dates without replacing existing frozen Viewer values', async () => {
  const root = await mkdtemp('/var/tmp/daily-ability-test-');
  try {
    await mkdir(`${root}/123`);
    const dimensions = Object.fromEntries(['大歌力','体力','高速处理','精度力','节奏处理','复合处理'].map(key => [key,10.42]));
    const row = (day: string) => ({capturedAt:`${day}T20:00:00+08:00`,dimensions,rating:10.5,sampleCount:25});
    await writeFile(`${root}/123/daily-ability-v1-top20.json`,JSON.stringify({version:1,namespace:'v1-top20',days:{'2026-09-20':row('2026-09-20'),'2026-10-10':row('2026-10-10')}}));
    const archive = await readDailyAbilityArchive(root,'123',7,9,'2026-09-01','2026-10-10');
    assert.equal(archive.length,2); assert.equal(archive[0]!.dimensions.accuracy_power,10.42);
    const stored = {...archive[0]!,id:'100',rating:9.9};
    const today = {...archive[1]!,id:'101',rating:10,capturedAt:'2026-10-10T10:00:00.000Z'};
    const merged=mergeDailyAbilityMeasurements([stored,today],archive,'2026-10-10');
    assert.equal(merged[0]!.rating,9.9);assert.equal(merged[1]!.rating,10.5);
    assert.equal((await readDailyAbilityArchive(root,'456',7,9,'2026-09-01','2026-10-10')).length,0);
    await assert.rejects(readDailyAbilityArchive(root,'../123',7,9,'2026-09-01','2026-10-10'));
    await writeFile(`${root}/123/daily-ability-v1-top20.json`,'bad');
    await assert.rejects(readDailyAbilityArchive(root,'123',7,9,'2026-09-01','2026-10-10'));
  } finally { await rm(root,{recursive:true,force:true}); }
});
