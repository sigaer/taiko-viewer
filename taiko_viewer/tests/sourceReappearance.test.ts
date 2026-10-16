import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveProgressForRange, type GrowthSnapshot } from '../utils/dailyProgress.ts';
import { projectScoreFacts } from '../utils/growthHistory.ts';

const song = (day: number, score = 900000) => ({song_no: 1, level: 4, high_score: score, stage_cnt: day,
  update_datetime: `2026-01-0${day} 12:00:00`, highscore_datetime: `2026-01-0${day} 12:00:00`});
const snap = (day: number, songs: ReturnType<typeof song>[], extra: Partial<GrowthSnapshot> = {}): GrowthSnapshot =>
  ({full: true, source: 'wahlap', timestamp: `2026-01-0${day} 13:00:00`, songs, ...extra});
const replay = (history: GrowthSnapshot[], current = history.at(-1)!.songs) =>
  deriveProgressForRange(current, history, '2026-01-01', '2026-01-06', () => 'Synthetic chart');

for (const otherSource of [false, true]) test(`full absence/reappearance remains unknown, source switch=${otherSource}`, () => {
  const history = [snap(1,[song(1)]),snap(2,[],{source:otherSource?'hiroba':'wahlap'}),snap(3,[song(3)])];
  const before = JSON.stringify(history);
  const days = replay(history);
  assert.equal(days[2].attendance,'unknown');
  assert.equal(days[2].events.length,0);
  assert.equal(projectScoreFacts(1,2,days).filter(f => f.temporal.attributedDay === '2026-01-03').length,0);
  assert.equal(JSON.stringify(history),before);
  assert.deepEqual(replay(history),days,'replay must be deterministic without mutating snapshots');
  assert.deepEqual(replay([...history].reverse(),history.at(-1)!.songs),days,'dated snapshots must replay chronologically');
});

test('delta omission preserves continuity but explicit removal keeps tombstone', () => {
  const baseline = snap(1,[song(1)]);
  const delta = snap(2,[],{full:false});
  assert.ok(replay([baseline,delta,snap(3,[song(3,910000)])])[2].events[0].facts.some(f=>f.type==='score-pb'));
  const deleted = {...delta,removed:['1:4']};
  assert.equal(replay([baseline,deleted,snap(3,[song(3,910000)])])[2].events.length,0);
});

test('duplicate reappearance stays unknown; subsequent comparable improvement is retained without backdating', () => {
  const returned = song(3,910000);
  const next = {...song(5,920000),highscore_datetime:returned.highscore_datetime};
  const history = [snap(1,[song(1)]),snap(2,[]),snap(3,[returned]),snap(4,[returned]),snap(5,[next])];
  const days = replay(history);
  assert.equal(days[2].events.length,0,'later current must not recreate rejected attendance');
  assert.equal(days[3].events.length,0);
  assert.equal(days[4].attendance,'played');
  const improved = replay([...history,snap(6,[song(6,930000)])]);
  assert.ok(improved[5].events[0].facts.some(f=>f.type==='score-pb'));
});

for (const boundary of [{source:'hiroba'}, {identity:'merged-topology-b'}, {excludedReason:'manual'}, {excludedReason:'import'}, {excludedReason:'repair'}]) {
  test(`noncomparable observation cannot become canonical fact: ${JSON.stringify(boundary)}`, () => {
    const days = replay([snap(1,[song(1)],{identity:'merged-topology-a'}),snap(2,[song(2,920000)],boundary)]);
    assert.equal(days[1].events.length,0);
    assert.equal(days[1].attendance,'unknown');
    assert.equal(projectScoreFacts(1,2,days).filter(f=>f.temporal.attributedDay==='2026-01-02').length,0);
  });
}

test('genuinely new chart retains first observation and subsequent improvement', () => {
  const days = replay([snap(1,[]),snap(2,[song(2)]),snap(3,[song(3,930000)])]);
  assert.equal(days[1].attendance,'played');
  assert.ok(days[2].events[0].facts.some(f=>f.type==='score-pb'));
  assert.equal((projectScoreFacts(1,2,days)[0].evidence.provenance as Record<string,unknown>).factPolicyRevision,'observation-reappearance-v2');
});

test('partial new topology cannot compare untouched charts against the old identity', () => {
  const second = (day: number, score: number) => ({...song(day,score),song_no:2});
  const history = [snap(1,[song(1),second(1,990000)],{identity:'a'}),
    snap(2,[song(2,910000)],{identity:'b',full:false}),
    snap(3,[second(3,920000)],{identity:'b',full:false}),
    snap(4,[second(4,930000)],{identity:'b',full:false})];
  const days = replay(history);
  assert.equal(days[1].events.length,0);
  assert.equal(days[2].events.length,0);
  assert.ok(days[3].events[0].facts.some(f=>f.type==='score-pb' && f.before===920000));
});
