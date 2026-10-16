// Diagnostic only: real evidence loader + installed Publication + fact projection.
// No product mutation and no oracle replacement. Run with run_qa.sh and approved 0.14.2 interpreter.
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { importGrowthModule } from './growth-module-loader.mjs';
const output = process.argv[2], existing = process.argv[3];
assert.ok(output?.startsWith('/var/tmp/'));
assert.ok(existing?.startsWith('/var/tmp/'));
assert.ok(process.env.TAIKO_PYTHON_EXECUTABLE?.startsWith('/var/tmp/'), 'explicit isolated installed interpreter required');
assert.ok(process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT?.startsWith('/var/tmp/'), 'no legacy repo fallback');
const sha = raw => createHash('sha256').update(raw).digest('hex');
const hash = value => sha(JSON.stringify(value));
const work = await mkdtemp('/var/tmp/oracle-multichart-');
const report = { status: 'DIAGNOSTIC_ONLY_OWNER_DECISION_PENDING', productionAccess: false, productChanges: false, sourceBase: '6e7f35b', scenarios: [] };
const row = (id, step, instant) => ({ song_no: id, level: 4, high_score: 900000 + step * 100, stage_cnt: 1 + step,
  best_score_rank: 4 + step, clear_cnt: 1, full_combo_cnt: step > 0 ? 1 : 0, dondaful_combo_cnt: step > 1 ? 1 : 0,
  good_cnt: 480 + step * 5, ok_cnt: 10, ng_cnt: 10 - step * 5, combo_cnt: 300,
  update_datetime: instant, highscore_datetime: instant });
const baselineA = row(1, 0, '2026-01-02 08:00:00');
const baselineB = row(2, 0, '2026-01-02 08:00:00');
const firstB = row(2, 1, '2026-01-02 10:00:00');
const nextB = { ...row(2, 2, '2026-01-03 09:00:00'), good_cnt: 500, ok_cnt: 0 };
const files = [
  ['20260102_083000','2026-01-02 08:30:00'], ['20260102_093000','2026-01-02 09:30:00'],
  ['20260102_103000','2026-01-02 10:30:00'], ['20260103_083000','2026-01-03 08:30:00'], ['20260103_093000','2026-01-03 09:30:00']
];
try {
  // Executable bound on the existing complete DTOs, with exact old evidence hash.
  const priorBytes = await readFile(existing), prior = JSON.parse(priorBytes);
  const expected = structuredClone(prior.passport.old);
  const excluded = 'milestone:1:1:2:4:2026-10-08:instant';
  for (const list of [expected.milestones, expected.shared.milestones]) assert.equal(list.filter(x => x.id === excluded).length, 1);
  expected.milestones = expected.milestones.filter(x => x.id !== excluded);
  expected.initialMilestoneIds = expected.initialMilestoneIds.filter(x => x !== excluded);
  expected.shared.milestones = expected.shared.milestones.filter(x => x.id !== excluded);
  for (const view of Object.values(expected.shared.views)) {
    view.milestoneIds = view.milestoneIds.filter(x => x !== excluded);
    view.initialMilestoneIds = view.initialMilestoneIds.filter(x => x !== excluded);
  }
  assert.equal(hash(expected), hash(prior.passport.candidate), 'only exact milestone removal and view references allowed');
  assert.equal(hash(prior.passport.old), prior.passport.oldHash);
  assert.equal(hash(prior.passport.candidate), prior.passport.candidateHash);
  report.exactDtoBound = { status: 'PASS', inputEvidenceSha256: sha(priorBytes), removedMilestone: excluded, oldHash: prior.passport.oldHash, expectedHash: hash(expected), candidateHash: prior.passport.candidateHash, indexDiffPaths: prior.passport.differences.length, meaning: 'One removed milestone and its references; index shifts are not independent semantic changes' };
  const daily = await importGrowthModule('utils/dailyProgress.ts');
  const projection = await importGrowthModule('utils/growthHistory.ts');
  for (const mode of ['control', 'counter-regression', 'manual']) {
    const root = resolve(work, mode), id = '990000000000000002'; await mkdir(resolve(root, id), { recursive: true });
    const a = mode === 'counter-regression' ? { ...baselineA, stage_cnt: 0 } : mode === 'manual' ? { ...baselineA, high_score: 900001 } : baselineA;
    const rows = [[baselineA,baselineB],[a],[firstB],[a,firstB],[nextB]];
    const source = index => mode === 'manual' && index === 1 ? 'manual-score' : 'wahlap';
    const reader = await importGrowthModule('server/services/growth-history/evidence.ts', { userdataDir: root });
    const scenario = { mode, inputHashes: {}, checkpoints: [] };
    for (let index = 0; index < files.length; index++) {
      const [name, timestamp] = files[index];
      const path = resolve(root,id,`data_${name}.json`);
      const text = JSON.stringify({ profile: { userid: id }, songs: rows[index], _meta: { full: index === 0 || index === 3, ts: timestamp, writer_source: source(index), source_account: id } });
      await writeFile(path, text); scenario.inputHashes[`data_${name}.json`] = sha(text);
      if (![2,4].includes(index)) continue;
      const evidence = await reader.loadGrowthScoreEvidence(id);
      assert.equal(evidence.invalidFiles, 0); assert.equal(evidence.snapshots.length, index+1);
      const current = [a, index === 2 ? firstB : nextB];
      const days = daily.deriveProgressForRange(current, evidence.snapshots, '2026-01-02', '2026-01-03', songId => `Synthetic ${songId}`);
      const facts = projection.projectScoreFacts(1,1,days);
      const day = index === 2 ? '2026-01-02' : '2026-01-03';
      // Earlier trusted baseline may already prove attendance on this day. Audit
      // improvements separately, retaining every played fact in the full report.
      const relevant = facts.filter(f => f.songId === 2 && f.temporal.attributedDay === day && f.type !== 'played');
      const observation = evidence.observations.at(-1);
      const check = { checkpoint: index === 2 ? 'other-chart-improvement-before-full-baseline' : 'next-comparable-after-full-baseline', observations: evidence.observations, snapshots: evidence.snapshots, days, facts, selectedFacts: relevant };
      if (index === 2 && mode !== 'control') {
        assert.equal(relevant.length, 0, 'record actual conservative suppression, do not label as preserved');
        assert.equal(observation.excludedReason, 'discontinuity-baseline');
        check.actual = 'SUPPRESSED_BY_GLOBAL_BASELINE';
        check.legitimateOtherChartPreservation = 'FAIL_UNDER_CURRENT_CONSERVATIVE_POLICY';
      } else {
        const expectedValues = index === 2 ? [['fc',0,1],['rank-upgrade',4,5],['score-pb',900000,900100],['ng-reduced',10,5]] : [['df',1,2],['rank-upgrade',5,6],['score-pb',900100,900200],['ng-reduced',5,0]];
        const occurredAt = index === 2 ? '2026-01-02T02:00:00.000Z' : '2026-01-03T01:00:00.000Z';
        const expectedFacts = expectedValues.map(([type,before,after]) => {
          const factKey = `score-history:v1:1:${day}:2:4:${type}:${before}:${after}`;
          return { id: factKey, factKey, ownerId:'1', bindingId:'1', type, title:'Synthetic 2', songId:2, difficultyType:4, before, after, delta:after-before, goalId:null,
            evidence:{source:'score-history',sourceRevision:observation.revision,evidenceVersion:1,provenance:{snapshotKind:'full-snapshot',factPolicyRevision:'observation-reappearance-v2'}},
            temporal:{attributedDay:day,occurredAt,observedAt:observation.observedAt,confirmedAt:null,precision:'instant'} };
        });
        const sorted = value => [...value].sort((a,b) => a.type.localeCompare(b.type));
        assert.deepEqual(sorted(relevant), sorted(expectedFacts), `${mode} ${index} complete fact identity/values/time/provenance`);
        check.actual = 'EXACT_FACTS_PASS'; check.expectedFacts = expectedFacts;
      }
      scenario.checkpoints.push(check);
    }
    report.scenarios.push(scenario);
  }
  report.disposition = 'Bounded DTO removal proven. Cross-chart conservative suppression is real; acceptance requires explicit policy decision or targeted product fix, not an oracle-only waiver.';
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output,diagnostic:'PASS',semanticPreservation:'BLOCKED_OWNER_POLICY',scenarios:report.scenarios.length,exactDtoBound:report.exactDtoBound.status}));
} catch (error) {
  report.diagnosticFailure = { name:error.name, message:error.message };
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  throw error;
} finally { await rm(work,{recursive:true,force:true}); }
