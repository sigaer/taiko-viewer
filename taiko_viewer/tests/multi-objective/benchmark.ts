/** B4-1 synthetic offline performance. Run through the bounded QA wrapper. */
import { performance } from 'node:perf_hooks';
import { cpus, platform, arch, totalmem } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fixture, seal, portfolio, record } from './fixtures.ts';
import { hash } from '../../utils/multi-objective/common.ts';
import { prepareValidationContext } from '../../utils/multi-objective/context.ts';
import { validateCandidate } from '../../utils/multi-objective/candidate.ts';
import { associateCandidatesWithPortfolio } from '../../utils/multi-objective/goals.ts';
import { composeRecommendationSlate } from '../../utils/multi-objective/composer.ts';
import { validatePrioritySlate } from '../../utils/multi-objective/priority.ts';
const out = process.argv[2]; if (!out) throw Error('output path required');
function measure(operation: () => unknown, repetitions: number) {
  operation(); const ms: number[] = [];
  for (let n = 0; n < repetitions; n++) { const start = performance.now(); operation(); ms.push(performance.now() - start); }
  const sorted = [...ms].sort((a, b) => a - b);
  return { repetitions, warmups: 1, unit: 'ms_per_batch', min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1), samples: ms };
}
const results = [];
for (const count of [10, 100, 1000, 5000]) {
  const f = fixture(count), p = portfolio(f);
  // One exact active score-pb Goal per candidate; no empty-portfolio shortcut.
  for (const c of f.candidates) {
    const baselineRef = `baseline-${c.songId}`;
    c.subtype = 'score_pb'; c.target = { kind: 'score', threshold: 900001, comparison: 'gte', baselineRef, horizon: 'near_term', definitionVersion: 'target/1' }; c.targetHash = hash(c.target); c.actionability.targetHash = c.targetHash; c.actionability.evaluatorId = 'b4-contract:score_pb';
    f.evidence.push(record(baselineRef, 'goal_baseline', 'goal-portfolio', c.chartId, c.catalogRevision, { type: 'goal_baseline', goalType: 'score-pb', highScore: 900000, total: null, ng: null, platform: null, mode: null }));
    p.goals.push({ id: `goal-${c.songId}`, profileId: c.profileId, chartId: c.chartId, identityMappingRef: c.identityMappingRef, goalType: 'score-pb', goalRevision: '1', baselineRef, target: structuredClone(c.target), targetHash: c.targetHash, lifecycleStatus: 'active', availability: 'available', userPriority: c.songId % 4, userOrder: c.songId, actionability: structuredClone(c.actionability), evaluationRef: null });
  }
  f.options.capacities = { A: 25, B: 25, C: 0, D: 0 }; f.options.maxTotal = 50; seal(f);
  const prepared = prepareValidationContext(f.context); if (prepared.issues.length) throw Error(JSON.stringify(prepared.issues.slice(0, 3)));
  const composed = composeRecommendationSlate(f.candidates, f.context, f.options); if (!composed.ok) throw Error(JSON.stringify(composed.issues));
  const associated = associateCandidatesWithPortfolio(f.candidates, f.context, prepared); if (associated.candidates.some(c => c.goalLinks.length !== 1)) throw Error('association benchmark must have actual links');
  const cards = Object.values(composed.value.groups).flat();
  const reps = count < 1000 ? 7 : 5;
  const timings = {
    contextPreparation: measure(() => prepareValidationContext(f.context), reps),
    candidateValidation: measure(() => { for (const c of f.candidates) if (!validateCandidate(c, f.context, prepared).ok) throw Error('candidate invalid'); }, reps),
    canonicalIdentityResolution: measure(() => { for (const c of f.candidates) if (prepared.authority.resolve({ namespace: 'wahlap', sourceId: String(c.songId), difficulty: c.difficultyType, catalogRevision: c.catalogRevision, region: c.region, businessPolicy: 'cn_current_playable', modelProfile: null }).status !== 'RESOLVED') throw Error('identity unresolved'); }, reps),
    goalAssociation: measure(() => associateCandidatesWithPortfolio(f.candidates, f.context, prepared), reps),
    priorityGate: measure(() => { if (!validatePrioritySlate(cards, associated.candidates).hardGatePassed) throw Error('gate failed'); }, reps),
    slateComposition: measure(() => { const r = composeRecommendationSlate(f.candidates, f.context, f.options); if (!r.ok || r.value.slateId !== composed.value.slateId) throw Error('nondeterministic slate'); }, reps),
  };
  results.push({ candidates: count, goals: p.goals.length, evidenceRecords: f.evidence.length, displayedCards: cards.length, slateHash: composed.value.slateId, timings });
  process.stdout.write(JSON.stringify({ candidates: count, mediansMs: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Number(v.median.toFixed(3))])) }) + '\n');
}
const report = { schemaVersion: 'b4-benchmark/1', measuredAt: new Date().toISOString(), scope: 'synthetic-offline-only', environment: { node: process.version, platform: platform(), architecture: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, hostMemoryBytes: totalmem(), processResourceUsage: process.resourceUsage() }, methodology: { oneWarmupPerOperation: true, concurrency: 1, aggregateBatchMilliseconds: true, candidateValidationAndIdentityAndAssociationReusePreparedContext: true, compositionIncludesContextPreparationAndAllValidation: true, priorityGateUsesAtMost50CardsWithFullCandidateLookup: true, predictionsExecuted: false, liveDataRead: false, productionPerformanceConclusion: false }, results };
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
