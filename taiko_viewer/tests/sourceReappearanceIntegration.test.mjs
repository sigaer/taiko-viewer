import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {importGrowthModule} from '../scripts/performance/growth-module-loader.mjs';
const digest = data => createHash('sha256').update(data).digest('hex');

for (const removed of [false,true]) test(`actual installed read / evidence / fact projection preserves removed=${removed}`,async()=>{
  const root=await mkdtemp('/var/tmp/viewer-g1-facts-'),id='990000000000000001';
  try {
    const directory=resolve(root,id);await mkdir(directory);
    const chart=day=>({song_no:1,level:4,high_score:900000+day*1000,stage_cnt:day,
      update_datetime:`2026-01-0${day} 12:00:00`,highscore_datetime:`2026-01-0${day} 12:00:00`});
    const paths=[];
    for (let day=1;day<=4;day++) {
      const path=resolve(directory,`data_2026010${day}_130000.json`);
      const payload={profile:{userid:id},songs:day===2?[]:[chart(day)],
        _meta:{full:!removed||day!==2,source:'wahlap',source_account:id,merge_topology:[id]}};
      if(removed&&day===2)payload.songs_removed=[[1,4]];
      await writeFile(path,JSON.stringify(payload));paths.push(path);
    }
    const frozen=resolve(directory,'daily-ability-v1-top20.json');
    const annual=resolve(root,'published-annual.json');
    await writeFile(frozen,JSON.stringify({days:{'2025-01-01':{rating:8,modelRevision:'frozen'}}}));
    await writeFile(annual,JSON.stringify({algorithmVersion:'old',published:true}));paths.push(frozen,annual);
    const hashes=await Promise.all(paths.map(async path=>digest(await readFile(path))));
    const {loadGrowthScoreEvidence}=await importGrowthModule('server/services/growth-history/evidence.ts',{userdataDir:root});
    const evidence=await loadGrowthScoreEvidence(id);
    assert.equal(evidence.invalidFiles,0);assert.equal(evidence.snapshots.length,4);
    if(removed)assert.deepEqual(evidence.snapshots[1].removed,['1:4']);
    assert.equal(typeof evidence.snapshots[0].identity,'string');
    const {deriveProgressForRange}=await importGrowthModule('utils/dailyProgress.ts');
    const {projectScoreFacts}=await importGrowthModule('utils/growthHistory.ts');
    const days=deriveProgressForRange([chart(4)],evidence.snapshots,'2026-01-01','2026-01-04',()=> 'Synthetic');
    assert.equal(days[2].attendance,'unknown');
    const facts=projectScoreFacts(1,1,days);
    assert.equal(facts.some(f=>f.temporal.attributedDay==='2026-01-03'),false);
    assert.ok(facts.some(f=>f.temporal.attributedDay==='2026-01-04'&&f.type==='score-pb'));
    assert.deepEqual(await Promise.all(paths.map(async path=>digest(await readFile(path)))),hashes);
  } finally {await rm(root,{recursive:true,force:true});}
});
