// Pure P0 presentation benchmark. No userdata, database, Python or replay.
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { buildSkillPassport } from '../server/services/growth-passport/composer.ts';
import { auditSkillPassportMilestones, curateSkillPassportMilestones } from '../server/services/growth-passport/milestones.ts';
import { recoveryBenchmarkFacts, recoveryInput, recoveryMeasurement } from '../tests/fixtures/passportRecovery.ts';
import { monitorPassportResources } from '../tests/fixtures/passportRecoveryResources.mjs';
import {finalCases,finalPeriod} from '../tests/fixtures/passportFinalUx.ts';
const out = process.env.PASSPORT_BROWSER_OUT || '/var/tmp/passport-final-ux-0814';
await mkdir(out, { recursive: true });
const finish = await monitorPassportResources(`${out}/curation-resources.json`);
try {
  const facts = recoveryBenchmarkFacts().map((fact,i) => {
    const values = fact.type === 'df' ? [1,2] : fact.type === 'fc' ? [0,1] : fact.type === 'clear' ? [-1,0] : fact.type === 'rank-upgrade' ? [7,8] : fact.type === 'ng-reduced' ? [21,i%20] : fact.type === 'combo-improved' ? [500,501+i%100] : [900000,900000+100+i*20];
    return {...fact,before:values[0],after:values[1],delta:values[1]-values[0]};
  });
  // Include 300 legitimate matched Goals in a separate cost case, while
  // keeping all 3,000 score facts (3,300 total). Chart indexing bounds matching.
  const withGoals = [...facts, ...facts.filter(fact => fact.type !== 'combo-improved').slice(0,300).map((fact, i) => ({ ...fact, id: `goal-${i}`, factKey: `goal-${i}`, type: 'goal-completed', goalType: fact.type, goalId: `goal-${i}`, evidence: { ...fact.evidence, source: 'goal' }, temporal: { ...fact.temporal, attributedDay: null, precision: 'observation' } }))];
  const trace={};for(const [label,corpus] of Object.entries(finalCases()))trace[label]=auditSkillPassportMilestones(corpus,finalPeriod).trace;
  await writeFile(`${out}/selection-traces.json`,JSON.stringify(trace,null,2));
  const cases = [];
  for (const [label, corpus] of [['score-facts', facts], ['score-and-goal-facts', withGoals]]) {
    const times = [];
    for (let i=0; i<220; i++) {
      const started = performance.now();
      const curated=curateSkillPassportMilestones(corpus, { from: '2026-07-11', to: '2026-10-08' });
      if(curated.initialIds.length>8||curated.milestones.length>24)throw new Error('Curation capacity regression');
      times.push(performance.now()-started);
    }
    times.sort((a,b)=>a-b);
    const result=auditSkillPassportMilestones(corpus,finalPeriod);
    cases.push({ label, facts: corpus.length, initial:result.initialIds.length,expanded:result.milestones.length,qualityDistribution:result.trace.reduce((counts,row)=>({...counts,[row.qualityTier]:(counts[row.qualityTier]||0)+1}),{}), iterations: times.length, p50Ms: times[110], p95Ms: times[209], maxMs: times.at(-1) });
  }
  const rows = Array.from({length:365},(_,i)=>recoveryMeasurement(String(i),new Date(Date.parse('2025-10-09')+i*86400000).toISOString().slice(0,10)));
  const start = performance.now(), payload = buildSkillPassport(recoveryInput(facts,rows));
  const report = { node: process.version, cpu: os.cpus()[0].model, cpuQuota: '200%', facts: facts.length, cases, composeMs: performance.now()-start,
    shared365PayloadBytes: Buffer.byteLength(JSON.stringify(payload)), dailyPoints: payload.shared.segments.reduce((n,s)=>n+s.points.length,0), selectedNodeUnion: payload.shared.milestones.length,
    gate: cases.every(row => row.p95Ms<30) ? 'PASS' : 'FAIL' };
  await writeFile(`${out}/curation.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(report.gate!=='PASS') process.exitCode=1;
} finally { await finish(); }
