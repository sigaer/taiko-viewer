// Pure P0 presentation benchmark. No userdata, database, Python or replay.
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { buildSkillPassport } from '../server/services/growth-passport/composer.ts';
import { curateSkillPassportMilestones } from '../server/services/growth-passport/milestones.ts';
import { recoveryBenchmarkFacts, recoveryInput, recoveryMeasurement } from '../tests/fixtures/passportRecovery.ts';
import { monitorPassportResources } from '../tests/fixtures/passportRecoveryResources.mjs';
const out = '/var/tmp/passport-recovery-0801';
await mkdir(out, { recursive: true });
const finish = await monitorPassportResources(`${out}/curation-resources.json`);
try {
  const facts = recoveryBenchmarkFacts();
  // Include 300 legitimate matched Goals in a separate cost case, while
  // holding the total at 3,000. Chart indexing keeps attribution bounded.
  const withGoals = [...facts.slice(0,2700), ...facts.filter(fact => fact.type !== 'combo-improved').slice(0,300).map((fact, i) => ({ ...fact, id: `goal-${i}`, factKey: `goal-${i}`, type: 'goal-completed', goalType: fact.type, goalId: `goal-${i}`, evidence: { ...fact.evidence, source: 'goal' }, temporal: { ...fact.temporal, attributedDay: null, precision: 'observation' } }))];
  const cases = [];
  for (const [label, corpus] of [['score-facts', facts], ['score-and-goal-facts', withGoals]]) {
    const times = [];
    for (let i=0; i<220; i++) {
      const started = performance.now();
      curateSkillPassportMilestones(corpus, { from: '2026-07-11', to: '2026-10-08' });
      times.push(performance.now()-started);
    }
    times.sort((a,b)=>a-b);
    cases.push({ label, facts: corpus.length, iterations: times.length, p50Ms: times[110], p95Ms: times[209], maxMs: times.at(-1) });
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
