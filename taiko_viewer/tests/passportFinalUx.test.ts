import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSkillPassportMilestones as audit, curateSkillPassportMilestones as curate } from '../server/services/growth-passport/milestones.ts';
import { composePassportMilestoneNarrative, passportMetricRuns } from '../utils/passportNarrative.ts';
import { buildMeasurementSegments, sampleDailyGrowthMeasurements } from '../server/services/growth-passport/composer.ts';
import { finalCases, finalPeriod as period, fourAccuracyPoints } from './fixtures/passportFinalUx.ts';
import { recoveryFact as fact } from './fixtures/passportRecovery.ts';

test('quality gate removes eight tiny PBs before any diversity or capacity decisions', () => {
  const input = finalCases().flood, result = audit(input, period);
  assert.equal(result.milestones.length, 5);
  assert.ok(result.trace.filter(row => row.factKeys.some(key => key.startsWith('tiny-pb'))).every(row => row.qualityTier === 'C' && !row.selected && row.reason.startsWith('quality-gate')));
  assert.ok(result.milestones.some(node => node.factKeys.includes('early-fc')));
  assert.deepEqual(audit([...input].reverse(),period), result);
  assert.deepEqual(Object.keys(curate(input,period)).sort(), ['initialIds','milestones']);
});
test('three strong same-day achievements break soft caps and exclude a weak early representative', () => {
  const result = audit(finalCases().sameDay,period);
  assert.equal(result.milestones.length,3);
  assert.ok(result.milestones.every(node => node.day === '2026-10-06'));
  assert.ok(result.trace.some(row => row.reason.includes('soft-day-exception')));
  assert.equal(result.trace.find(row => row.factKeys.includes('weak-early'))?.selected,false);
});
test('NG zero is FC; substantial nonzero reductions qualify and one ordinary reduction does not', () => {
  const result = audit(finalCases().ng,period);
  assert.equal(result.milestones.length,3);
  assert.equal(result.trace.find(row => row.factKeys.includes('ng-5-4'))?.qualityTier,'C');
  for(const node of result.milestones)assert.equal(composePassportMilestoneNarrative(node,(_t,v) => String(v)).headline.key,node.after===0?'passport.narrative.fc':'passport.narrative.ngDown');
  const zero=result.milestones.find(node=>node.after===0)!;
  assert.equal(result.trace.find(row=>row.primaryFact==='ng-1-0')?.qualityTier,'A');
  assert.equal(composePassportMilestoneNarrative(zero,(_t,v)=>String(v)).support[0]?.params.type,'ng-reduced');
});
test('only small PB/combo yields empty highlights, not a quota of weak records', () => assert.equal(curate(finalCases().weak,period).milestones.length,0));
test('PB materiality combines absolute gain, baseline, ladder and frozen relative distribution', () => {
  const result = audit(finalCases().calibration,period);
  assert.equal(result.trace.find(row => row.factKeys.includes('calibration-0'))?.qualityTier,'C');
  assert.equal(result.trace.find(row => row.factKeys.includes('calibration-2'))?.qualityTier,'B');
  assert.equal(result.trace.find(row => row.factKeys.includes('calibration-3'))?.qualityTier,'C');
  // A +5k near the top of the ladder can pass in a modest window, but never
  // gets promoted just for being the maximum in a window of tiny PBs.
  const moderate=fact('moderate','score-pb','2026-10-06',{before:950000,after:955000,delta:5000});
  assert.equal(audit([moderate,...finalCases().weak],period).trace.find(row=>row.primaryFact==='moderate')?.qualityTier,'B');
  assert.equal(curate([fact('max-tiny','score-pb','2026-10-06',{before:950000,after:951000,delta:1000})],period).milestones.length,0);
});
test('FC/NG/PB merges into one FC headline with at most two supporting facts', () => {
  const node = curate(finalCases().mixed,period).milestones[0]!;
  const line = composePassportMilestoneNarrative(node,(_t,v)=>String(v));
  assert.equal(line.headline.key,'passport.narrative.fc');assert.equal(line.support.length,2);
  assert.deepEqual(node.factKeys,['mixed-fc','mixed-ng','mixed-pb']);
  const rank = curate(finalCases().flood.filter(fact=>fact.factKey!=='rank-ng'),period).milestones.find(node=>node.factKeys.includes('rank'))!;
  assert.equal(composePassportMilestoneNarrative(rank,(_t,v)=>String(v)).headline.key,'passport.narrative.rankUp');
});
test('missing baseline, unknown rank enumeration and invalid evidence are rejected with reasons', () => {
  const result=audit(finalCases().evidence,period);assert.equal(result.milestones.length,0);
  assert.ok(result.trace.every(row=>row.qualityTier==='C' && !row.selected));
  assert.match(result.trace.find(row=>row.primaryFact==='no-baseline')!.reason,/baseline/);
  assert.match(result.trace.find(row=>row.primaryFact==='no-evidence')!.reason,/evidence/);
});
test('strict Goals preserve matched day and unmatched observation, including small score targets', () => {
  const score=fact('small','score-pb','2026-10-06',{before:950000,after:950001,delta:1});
  const goal=fact('matched','goal-completed',null,{goalId:'g1',goalType:'score-pb',before:950000,after:950001,delta:1,evidence:{source:'goal',sourceRevision:'small',evidenceVersion:1}});
  const unmatched={...goal,id:'unmatched',factKey:'unmatched',goalId:'g2',songId:101};
  const result=curate([score,goal,unmatched],period);
  const played=result.milestones.find(node=>node.factKeys.includes('matched'))!;
  const observed=result.milestones.find(node=>node.factKeys.includes('unmatched'))!;
  assert.equal(played.day,'2026-10-06');assert.equal(played.observationOnly,false);
  assert.equal(observed.day,null);assert.equal(observed.observationOnly,true);
  assert.equal(composePassportMilestoneNarrative(played,(_t,v)=>String(v)).headline.key,'passport.narrative.goalCompleted');
  assert.equal(composePassportMilestoneNarrative(observed,(_t,v)=>String(v)).headline.key,'passport.narrative.goalObserved');
});
test('invalid linked Goal cannot claim completion; FC and NG-zero share achievement deduplication', () => {
  const fc=fact('canonical-fc','fc','2026-09-12',{before:0,after:1,delta:1});
  const zero=fact('observed-zero','ng-reduced','2026-10-06',{before:1,after:0,delta:-1});
  const goal=fact('bad-goal','goal-completed',null,{goalId:'bad',goalType:'fc',before:0,after:1,delta:1,evidence:{source:'goal',sourceRevision:'canonical-fc',evidenceVersion:0}});
  const result=curate([fc,zero,goal],period);
  assert.equal(result.milestones.length,1);
  assert.ok(result.milestones.every(node=>!node.goalCompleted));
});
test('initial and expanded selection share one prefix, deterministic ties and exact canonical keys', () => {
  const facts=Array.from({length:40},(_,i)=>fact(`fc-${i}`,'fc',`2026-09-${String(10+i%20).padStart(2,'0')}`,{songId:1000+i,before:0,after:1,delta:1}));
  const result=audit(facts,period);assert.equal(result.initialIds.length,8);assert.equal(result.milestones.length,24);
  assert.deepEqual(audit([...facts].reverse(),period),result);
  assert.deepEqual(new Set(result.initialIds),new Set(result.trace.filter(row=>row.selected && row.selectionRank!<=8).map(row=>row.candidateId)));
  assert.ok(result.milestones.every(node=>node.factKeys.length===1 && facts.some(f=>f.factKey===node.factKeys[0])));
});
test('four frozen daily values connect identically regardless of historical algorithm revisions', () => {
  const runs=(independent:boolean)=>passportMetricRuns(buildMeasurementSegments(sampleDailyGrowthMeasurements(fourAccuracyPoints(independent))),'accuracy_power');
  assert.deepEqual(runs(false).map(run=>run.points.length),[4]);assert.deepEqual(runs(true).map(run=>run.points.length),[4]);
  assert.deepEqual(runs(false)[0]!.points.map(point=>point.value),[10.42,10.42,10.44,10.48]);
});

test('FC flood leaves initial room for qualified rank, NG and PB without admitting weak records', () => {
  const input = Array.from({length:30}, (_,i) => fact(`fc-flood-${i}`, 'fc', '2026-10-06', {songId:2000+i,before:0,after:1,delta:1}));
  input.push(fact('mixed-rank','rank-upgrade','2026-09-20',{songId:3001,before:5,after:6,delta:1}),
    fact('mixed-ng','ng-reduced','2026-09-21',{songId:3002,before:21,after:5,delta:-16}),
    fact('mixed-pb','score-pb','2026-09-22',{songId:3003,before:965680,after:1005060,delta:39380}),
    fact('weak-extra','score-pb','2026-09-23',{songId:3004,before:950000,after:950001,delta:1}));
  const result = audit(input,period);
  const initial = result.milestones.filter(node => result.initialIds.includes(node.id));
  for (const key of ['mixed-rank','mixed-ng','mixed-pb']) assert.ok(initial.some(node => node.factKeys.includes(key)),key);
  assert.ok(!result.milestones.some(node => node.factKeys.includes('weak-extra')));
  assert.deepEqual(audit([...input].reverse(),period), result);
});
