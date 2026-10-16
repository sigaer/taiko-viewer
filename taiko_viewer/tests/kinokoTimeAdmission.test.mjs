import test from 'node:test';import assert from 'node:assert/strict';
import {parseKinokoTimestamp,parseKinokoMetadataTime,filterKinokoEvents} from '../server/internal/account/kinoko-time.ts';
import {accountPublicationFixture as fixture} from './fixtures/accountScorePublicationHarness.mjs';
const now=new Date('2026-10-16T00:00:00Z');
test('Kinoko upstream time admission preserves offsets and excludes future/invalid event evidence',()=>{
 assert.equal(parseKinokoTimestamp('2026-10-15 08:00:00',now).epochMs,Date.parse('2026-10-15T00:00:00Z'));
 assert.equal(parseKinokoTimestamp('2026-10-15T00:00:00Z',now).epochMs,Date.parse('2026-10-15T00:00:00Z'));
 for(const value of ['2026-02-30 00:00:00','2099-01-01 00:00:00',20261015,''])assert.throws(()=>parseKinokoTimestamp(value,now));
 assert.ok(parseKinokoMetadataTime('20261015_080000_123456'));
 const rows=[{update_datetime:'2026-10-15 08:00:00'},{update_datetime:'2099-01-01 00:00:00'},{}, {update_datetime:1}];
 const admitted=filterKinokoEvents(rows,now);assert.equal(admitted.records.length,1);assert.equal(admitted.timeSummary.skippedTimeRecords,3);
});
test('Kinoko admitted time reaches existing Publication Writer; rejected time never stages data',()=>fixture(async service=>{
 const initial=await service.readUserdata('synthetic'),before=await service.withDomainScoreRead('synthetic',async()=>service.scorePublication('synthetic'));
 const future={song_no:1,level:4,high_score:9999999,stage_cnt:99999,update_datetime:'2099-01-01 00:00:00',highscore_datetime:'2099-01-01 00:00:00'};
 assert.equal(service.mergeKinokoScores(initial,[future],now).updated,0);
 assert.equal((await service.writeKinokoHistorySnapshots('synthetic',[future],initial,now)).snapshotFiles,0);
 const after=await service.withDomainScoreRead('synthetic',async()=>service.scorePublication('synthetic'));assert.equal(after.commitId,before.commitId);assert.equal(initial.songs[0].high_score,800000);
}));
