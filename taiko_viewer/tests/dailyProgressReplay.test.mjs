import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fixtures} from './fixtures/dailyProgressReplay.mjs';
import {replayOverview} from './fixtures/growthReplayHarness.mjs';
const report=[];
for(const fixture of fixtures)test(`authoritative replay: ${fixture.id}`,async()=>{
 const {overview,counters}=await replayOverview(fixture);
 const p=overview.dailyProgress;
 const actual={attendance:p.attendance,uniqueCharts:p.uniqueCharts,facts:p.events.map(e=>e.facts)};
 const pass=JSON.stringify(actual)===JSON.stringify(fixture.expected);
 report.push({fixture:fixture.id,inputSnapshots:fixture.snapshots,expected:fixture.expected,actual,result:pass?'PASS':'FAIL'});
 assert.deepEqual(actual,fixture.expected);
 assert.equal(p.calendarDay,'2026-09-17');
 assert.deepEqual(counters,{compute:1,current:1,catalog:1,historyLoads:1,replays:1});
 for(const event of p.events)assert.match(event.title,/^Replay Song (Alpha|Beta)$/);
});
test.after(async()=>{await mkdir('/var/tmp/growth-closure',{recursive:true});await writeFile('/var/tmp/growth-closure/replay.json',JSON.stringify(report,null,2));});

for(const locale of ['zh','ja'])test(`growth replay event translations: ${locale}`,async()=>{
 const messages=JSON.parse(await readFile(new URL(`../locales/${locale}.json`,import.meta.url),'utf8'));
 const growth=messages.home.growth;
 const types=new Set(fixtures.flatMap(f=>f.expected.facts.flatMap(fs=>fs.map(fact=>fact.type))));
 for(const type of types){
  assert.equal(typeof growth.events[type],'string',`${locale} missing event ${type}`);
  assert.ok(growth.events[type].trim(),`${locale} empty event ${type}`);
  if(['score-pb','ng-reduced','combo-improved','rank-upgrade'].includes(type))assert.ok(growth.factLabels[type]?.trim(),`${locale} missing fact label ${type}`);
 }
 assert.doesNotMatch(growth.events['rank-upgrade'],/段位/);
 assert.match(growth.playedSummary,/\{count\}/);
 assert.doesNotMatch(JSON.stringify(growth),/推荐歌曲取得进步|接下来先练|练这三首|次は.*を練習/);
});
