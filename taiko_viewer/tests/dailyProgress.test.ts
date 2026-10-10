import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDailyProgress } from '../utils/dailyProgress.ts';
const day = '2026-09-17';
const before = { song_no: 1, level: 4, high_score: 900000, good_cnt: 90, ok_cnt: 3, ng_cnt: 7, combo_cnt: 60, clear_cnt: 0, full_combo_cnt: 0, dondaful_combo_cnt: 0, best_score_rank: 6, highscore_datetime: '2026-09-16 18:00:00', update_datetime: '2026-09-16 18:00:00' };
const after = { ...before, highscore_datetime: '2026-09-17 12:00:00', update_datetime: '2026-09-17 12:00:00' };
const run = (row = after, baseline: any = before, extra: any[] = []) => deriveDailyProgress([row], [{ full: true, timestamp: '2026-09-17 00:00:00', songs: baseline ? [baseline] : [] }, { full: false, timestamp: '', songs: [row] }, ...extra], day, s => `Song ${s.song_no}`);
const types = (r: ReturnType<typeof run>) => r.events.flatMap(e => e.facts.map(f => f.type));
test('no play has no events and zero metrics are not part of DTO', () => { const r = run(before); assert.equal(r.attendance, 'not_played'); assert.deepEqual(r.events, []); assert.equal('newBestCount' in r, false); });
test('ordinary play uses update time even with an old PB time', () => { const r = run({...after, highscore_datetime: before.highscore_datetime}); assert.equal(r.uniqueCharts, 1); assert.deepEqual(types(r), ['played']); });
test('score PB carries exact before/after delta', () => { const r = run({...after, high_score: 907130}); assert.deepEqual(r.events[0].facts[0], { type: 'score-pb', before: 900000, after: 907130, delta: 7130 }); });
test('NG decrease needs complete comparable judgments', () => { assert.ok(types(run({...after, good_cnt: 93, ng_cnt: 4})).includes('ng-reduced')); assert.ok(!types(run({...after, ng_cnt: 4})).includes('ng-reduced')); });
test('accuracy is not invented from a separate formula', () => assert.deepEqual(types(run({...after, good_cnt: 91, ok_cnt: 2})), ['played']));
for (const [field,type] of [['clear_cnt','clear-upgrade'],['full_combo_cnt','fc'],['dondaful_combo_cnt','df']]) test(type, () => assert.ok(types(run({...after, [field]: 1})).includes(type)));
test('rank uses known score-rank domain', () => { assert.ok(types(run({...after,best_score_rank: 7})).includes('rank-upgrade')); assert.ok(!types(run({...after,best_score_rank: 99})).includes('rank-upgrade')); });
test('same chart merges PB NG and FC into one block', () => { const r=run({...after,high_score:907130,ng_cnt:0,good_cnt:97,full_combo_cnt:1}); assert.equal(r.events.length,1); assert.equal(r.events[0].facts[0].type,'fc'); assert.equal(r.events[0].facts.length,3); });
test('multiple charts ranked by meaning and capped', () => { const rows=Array.from({length:5},(_,i)=>({...after,song_no:i+2})); const r=run({...after,full_combo_cnt:1},before,[{full:false,timestamp:'',songs:rows}]); assert.equal(r.uniqueCharts,6); assert.equal(r.events.length,3); assert.equal(r.events[0].songId,1); });
test('midnight respects Shanghai', () => { assert.equal(run({...after,update_datetime:'2026-09-16T16:00:00Z',highscore_datetime:before.highscore_datetime}).attendance,'played'); assert.equal(run({...after,update_datetime:'2026-09-16T15:59:59Z',highscore_datetime:before.highscore_datetime}).attendance,'not_played'); });
test('duplicate sync does not duplicate event', () => { const row={...after,high_score:910000}; const r=run(row,before,[{full:false,timestamp:'',songs:[row]}]); assert.equal(r.events.length,1); assert.equal(r.events[0].facts[0].delta,10000); });
test('missing previous state or fields never becomes zero baseline', () => { assert.deepEqual(types(run({...after,high_score:910000},null)),['played']); assert.ok(!types(run({...after,high_score:910000},{...before,high_score:undefined})).includes('score-pb')); });
test('incomplete delta-only history still compares known records', () => { const r=deriveDailyProgress([], [{full:false,timestamp:'',songs:[before]},{full:false,timestamp:'',songs:[{...after,high_score:910000}]}],day,s=>'Song'); assert.equal(r.events[0].facts[0].type,'score-pb'); });
test('stale PB timestamp cannot prove a new PB today', () => assert.ok(!types(run({...after,high_score:910000,highscore_datetime:before.highscore_datetime})).includes('score-pb')));
test('regressions do not become achievements', () => assert.deepEqual(types(run({...after,high_score:800000,best_score_rank:5}, {...before,full_combo_cnt:1})),['played']));
test('empty unknown history remains unknown', () => assert.equal(deriveDailyProgress([],[],day,()=>'' ).attendance,'unknown'));
test('delta transitions use the preceding delta and merge score gains', () => { const row={...after,high_score:910000}; const r=run(row,before,[{full:false,timestamp:'',songs:[{...row,high_score:920000,highscore_datetime:'2026-09-17 13:00:00'}]}]); assert.equal(r.events[0].facts[0].delta,20000); });

test('cumulative crown across an unobserved midnight is not attributed to today', () => { const r=deriveDailyProgress([], [{full:true,timestamp:'2026-09-16 12:00:00',songs:[before]},{full:false,timestamp:'2026-09-17 12:00:00',songs:[{...after,full_combo_cnt:1}]}],day,()=> 'Song'); assert.deepEqual(types(r),['played']); });

test('a recovery below a historical maximum is not a PB', () => { const r=deriveDailyProgress([], [{full:true,timestamp:'',songs:[{...before,high_score:990000}]},{full:false,timestamp:'',songs:[{...before,highscore_datetime:'2026-09-16 19:00:00'}]},{full:false,timestamp:'',songs:[{...after,high_score:950000}]}],day,()=> 'Song'); assert.ok(!types(r).includes('score-pb')); });


test('new DF is dated by its complete best-score judgments across a snapshot gap', () => {
  const previous = {...before,high_score:998670,good_cnt:207,ok_cnt:1,ng_cnt:0,combo_cnt:208,clear_cnt:1,full_combo_cnt:1};
  const next = {...previous,high_score:1001280,good_cnt:208,ok_cnt:0,dondaful_combo_cnt:1,highscore_datetime:after.highscore_datetime,update_datetime:after.update_datetime};
  const derive = (row: any) => deriveDailyProgress([], [{full:true,timestamp:'2026-09-16 12:00:00',songs:[previous]},{full:false,timestamp:'2026-09-17 20:00:00',songs:[row]}],day,()=> 'Song');
  const result = derive(next);
  assert.equal(result.events[0].facts[0].type,'df');
  assert.equal(result.events[0].factOccurredAt?.df,'2026-09-17T04:00:00.000Z');
  for (const changed of [{ok_cnt:1,good_cnt:207},{ok_cnt:undefined},{highscore_datetime:before.highscore_datetime},{dondaful_combo_cnt:0}]) {
    assert.ok(!types(derive({...next,...changed})).includes('df'));
  }
});
