import {qaTempPrefix} from './fixtures/qaPaths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {importGrowthModule} from '../scripts/performance/growth-module-loader.mjs';
const row=(id,day,extra={})=>({song_no:id,level:4,high_score:900000+day*100,stage_cnt:day,update_datetime:`2026-01-0${day} 12:00:00`,highscore_datetime:`2026-01-0${day} 12:00:00`,...extra});
async function replay(entries, check) {
  const root=await mkdtemp(qaTempPrefix('chart-continuity-')),id='990000000000000003';
  try {
    await mkdir(resolve(root,id));
    for(let i=0;i<entries.length;i++) {
      const entry=entries[i];
      await writeFile(resolve(root,id,`data_2026010${i+1}_130000.json`),JSON.stringify({songs:entry.songs,...(entry.removed?{songs_removed:entry.removed}:{}),_meta:{full:entry.full??true,ts:`2026-01-0${i+1} 13:00:00`,writer_source:'wahlap',source_account:id,...entry.meta}}));
    }
    const loader=await importGrowthModule('server/services/growth-history/evidence.ts',{userdataDir:root});
    const evidence=await loader.loadGrowthScoreEvidence(id);
    assert.equal(evidence.invalidFiles,0);
    const daily=await importGrowthModule('utils/dailyProgress.ts');
    const project=await importGrowthModule('utils/growthHistory.ts');
    const days=daily.deriveProgressForRange(entries.at(-1).songs,evidence.snapshots,'2026-01-01','2026-01-06',song=>`Synthetic ${song.song_no}`);
    await check(evidence,days,project.projectScoreFacts(1,1,days));
  } finally {await rm(root,{recursive:true,force:true});}
}
for(const cause of ['manual','counter-regression']) test(`affected chart requires its own authoritative baseline after ${cause}`,async()=>{
  const bad=cause==='manual'?row(1,2,{high_score:999999}):row(1,2,{stage_cnt:0});
  await replay([
    {songs:[row(1,1),row(2,1)]},
    {full:false,songs:[bad],meta:{writer_source:cause==='manual'?'manual-score':'wahlap'}},
    {full:false,songs:[row(1,3),row(2,3)]},
    {full:false,songs:[row(1,4),row(2,4)]},
  ],(e,days,facts)=>{
    assert.equal(e.snapshots[1].chartExclusions['1:4'],cause);
    assert.equal(e.observations[1].evidenceLevel,'L0');
    assert.equal(e.observations[1].excludedReason,cause);
    assert.equal(e.snapshots[2].chartExclusions['1:4'],'discontinuity-baseline');
    assert.equal(e.snapshots[2].chartExclusions['2:4'],undefined);
    assert.equal(facts.some(f=>f.songId===1&&f.temporal.attributedDay==='2026-01-03'),false);
    assert.ok(facts.some(f=>f.songId===2&&f.type==='score-pb'&&f.temporal.attributedDay==='2026-01-03'));
    const resumed=facts.find(f=>f.songId===1&&f.type==='score-pb'&&f.temporal.attributedDay==='2026-01-04');
    assert.equal(resumed.before,900300);assert.equal(resumed.after,900400);
    assert.equal(resumed.evidence.provenance.factPolicyRevision,'observation-chart-continuity-v3');
  });
});
for(const change of [{writer_source:'hiroba'},{source_account:'other-synthetic'},{merge_topology:['other-synthetic']}]) test(`authoritative identity change remains global: ${JSON.stringify(change)}`,async()=>{
  await replay([{songs:[row(1,1),row(2,1)]},{songs:[row(1,2),row(2,2)],meta:change}],(e,days,facts)=>{
    assert.equal(e.snapshots[1].excludedReason,'source-switch');
    assert.equal(days[1].attendance,'unknown');
    assert.equal(facts.some(f=>f.temporal.attributedDay==='2026-01-02'),false);
  });
});
for(const source of ['unknown','web-score-import','repair-job']) test(`untrusted batch ${source} waits for authoritative full baseline`,async()=>{
  await replay([
    {songs:[row(1,1),row(2,1)]},
    {full:false,songs:[row(1,2)],meta:{writer_source:source}},
    {full:false,songs:[row(2,3)]},
    {songs:[row(1,4),row(2,4)]},
    {full:false,songs:[row(2,5)]},
  ],(e,days,facts)=>{
    assert.equal(e.snapshots[2].excludedReason,'discontinuity-baseline');
    assert.equal(e.snapshots[3].excludedReason,'discontinuity-baseline');
    assert.equal(facts.some(f=>f.temporal.attributedDay==='2026-01-03'),false);
    assert.ok(facts.some(f=>f.songId===2&&f.type==='score-pb'&&f.temporal.attributedDay==='2026-01-05'));
  });
});
test('manual removal and full absence do not resurrect attendance',async()=>{
  await replay([
    {songs:[row(1,1),row(2,1)]},
    {songs:[row(2,1)],meta:{writer_source:'manual-score'}},
    {songs:[row(1,3),row(2,3)]},
    {full:false,songs:[],removed:[[2,4]],meta:{writer_source:'manual-score-delete'}},
    {full:false,songs:[row(2,5)]},
  ],(e,days,facts)=>{
    assert.equal(facts.some(f=>f.songId===1&&f.temporal.attributedDay==='2026-01-03'),false);
    assert.equal(facts.some(f=>f.songId===2&&f.temporal.attributedDay==='2026-01-05'),false);
  });
});
test('new manual chart has no attendance until a trusted baseline and later change',async()=>{
  await replay([
    {songs:[row(1,1)]},
    {songs:[row(1,1),row(2,2)],meta:{writer_source:'manual-score'}},
    {full:false,songs:[row(2,3)]},
    {full:false,songs:[row(2,4)]},
  ],(e,days,facts)=>{
    assert.equal(e.observations[1].evidenceLevel,'L0');
    assert.equal(facts.some(f=>f.songId===2&&['2026-01-02','2026-01-03'].includes(f.temporal.attributedDay)),false);
    assert.ok(facts.some(f=>f.songId===2&&f.type==='score-pb'&&f.temporal.attributedDay==='2026-01-04'));
  });
});
test('manual full after unknown batch cannot restore authoritative continuity',async()=>{
  await replay([
    {songs:[row(1,1),row(2,1)]},
    {full:false,songs:[row(1,2)],meta:{writer_source:'unknown'}},
    {songs:[row(1,2),row(2,1)],meta:{writer_source:'manual-score'}},
    {full:false,songs:[row(2,4)]},
    {songs:[row(1,5),row(2,5)]},
    {full:false,songs:[row(2,6)]},
  ],(e,days,facts)=>{
    assert.equal(e.snapshots[2].excludedReason,'discontinuity-baseline');
    assert.equal(e.snapshots[3].excludedReason,'discontinuity-baseline');
    assert.equal(e.snapshots[4].excludedReason,'discontinuity-baseline');
    assert.equal(facts.some(f=>f.songId===2&&f.temporal.attributedDay==='2026-01-04'),false);
    assert.ok(facts.some(f=>f.songId===2&&f.type==='score-pb'&&f.temporal.attributedDay==='2026-01-06'));
  });
});
