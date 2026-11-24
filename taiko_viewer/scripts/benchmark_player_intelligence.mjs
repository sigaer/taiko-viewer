import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { evaluateRecommendations } from '../utils/player-intelligence/benchmark.ts';
import { benchmarkFixture } from '../tests/fixtures/player-intelligence.ts';

const [baselinePath, outputPath] = process.argv.slice(2);
if (!baselinePath || !outputPath) throw new Error('Usage: node --experimental-strip-types scripts/benchmark_player_intelligence.mjs BASELINE OUTPUT');
const raw = await readFile(baselinePath, 'utf8');
if (raw.length > 1048576) throw new Error('baseline-size-limit');
const baseline = JSON.parse(raw);
if (baseline.kind !== 'synthetic-existing-policy-replay') throw new Error('baseline-kind');
const synthetic = benchmarkFixture();
const existing = { kind: 'synthetic-harness', revision: baseline.fixtureSha256, freezeAt: '2026-11-20T00:00:00Z', plays: [], goals: [],
  decisions: baseline.cases.map((c, index) => ({ id: `existing-${index}`, player: `fixture-${index}`, at: '2026-11-01T00:00:00Z', k: Math.max(1, c.limit),
    inputsComplete: false, exposureHistoryComplete: false, catalogRevision: baseline.fixtureSha256, scoreRevision: baseline.fixtureSha256,
    predictorVersion: `${baseline.coreVersion}:${baseline.sourceManifestSha256}`, features: [{ occurredAt: '2026-10-31T00:00:00Z', availableAt: '2026-10-31T00:00:00Z' }], activeGoalId: null,
    items: c.rows.map(r => ({ chartKey: `${r.song_id}:${r.level}`, songIdentity: String(r.song_id), targetScore: null,
      predictedScore: null, probability: null, actionable: false, genre: null })) })) };
const report = { baselineSha256: createHash('sha256').update(raw).digest('hex'),
  syntheticDatasetSha256: createHash('sha256').update(JSON.stringify(synthetic)).digest('hex'),
  existingPolicy: evaluateRecommendations(existing), syntheticMetricOracle: evaluateRecommendations(synthetic),
  limitations: ['Ordinary policy has no stable target or identifiable outcome labels; these fields remain null.',
    'Synthetic metric oracle is not an algorithm quality comparison.', 'No production recommendation replacement is authorized.'] };
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, existingDecisions: existing.decisions.length, syntheticDecisions: synthetic.decisions.length }));
