import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRecommendations } from '../utils/player-intelligence/benchmark.ts';
import { benchmarkFixture } from './fixtures/player-intelligence.ts';

test('seven-metric oracle exposes unknowns instead of treating clicks or PB as identifiable plays', () => {
  const data = benchmarkFixture(), result = evaluateRecommendations(data);
  assert.equal(result.reachabilityPrecisionAtK.conservativeLowerBound.value, 0.25);
  assert.equal(result.reachabilityPrecisionAtK.conditional.value, 0.5);
  assert.equal(result.reachabilityPrecisionAtK.conditional.unknownCount, 2);
  assert.equal(result.actionableCoverage.value, 1);
  assert.equal(result.scorePredictionError.mae, 15); assert.equal(result.scorePredictionError.rmse, Math.sqrt(250));
  assert.equal(result.scorePredictionError.bias, 5); assert.equal(result.predictionCalibration.brier, null);
  assert.equal(result.recommendationDiversity.distinctSongPairs.value, 1);
  assert.equal(result.recommendationDiversity.uniqueChartRatio.value, 0.75);
  assert.equal(result.repeatRate.value, 0.25);
  assert.equal(result.goalProgression.completionRate.value, 1); assert.equal(result.goalProgression.observationCoverage.value, 0.5);
  assert.equal(result.excludedLabels, 2); assert.deepEqual(evaluateRecommendations(data), result);
});
test('probability calibration requires actual first-play probability, never predictor confidence', () => {
  const data = benchmarkFixture(); data.decisions[0].items[0].probability = 0.8; data.decisions[0].items[1].probability = 0.6;
  assert.ok(Math.abs(evaluateRecommendations(data).predictionCalibration.brier! - 0.2) < 1e-9);
});
test('time leakage, immature windows, duplicate outcomes and absent labels fail explicitly', () => {
  const data = benchmarkFixture(); data.decisions[0].features[0].availableAt = '2026-11-02T00:00:00Z';
  assert.equal(evaluateRecommendations(data).decisions.excluded[0].reason, 'feature-leakage-or-provenance');
  data.freezeAt = '2026-11-10T00:00:00Z'; assert.equal(evaluateRecommendations(data).decisions.accepted, 0);
  const duplicate = benchmarkFixture(); duplicate.plays.push(duplicate.plays[0]);
  assert.throws(() => evaluateRecommendations(duplicate), /duplicate-play/);
  const empty = benchmarkFixture(); empty.plays = []; empty.goals = [];
  const result = evaluateRecommendations(empty);
  assert.equal(result.scorePredictionError.mae, null); assert.equal(result.reachabilityPrecisionAtK.conditional.value, null);
  assert.equal(result.goalProgression.completionRate.value, null);
});
test('PB-only labels never resolve stability and one-item slates have no pair diversity', () => {
  const data = benchmarkFixture(); data.plays = data.plays.map(p => ({ ...p, kind: 'snapshot' }));
  data.decisions.forEach(d => { d.items = d.items.slice(0,1); });
  const result = evaluateRecommendations(data);
  assert.equal(result.reachabilityPrecisionAtK.conditional.denominator, 0);
  assert.equal(result.recommendationDiversity.distinctSongPairs.value, null);
});

test('repeat history warmup is explicit and an early active goal evaluation is not an endpoint', () => {
  const data = benchmarkFixture(); data.priorExposures = [{ player: 'synthetic', chartKey: 'B', at: '2026-10-30T00:00:00Z' }];
  assert.equal(evaluateRecommendations(data).repeatRate.value, 0.5);
  data.goals[0].outcome = 'active';
  assert.equal(evaluateRecommendations(data).goalProgression.completionRate.denominator, 0);
  data.goals[0].at = '2026-11-08T00:00:00Z'; data.goals[0].availableAt = data.goals[0].at;
  assert.equal(evaluateRecommendations(data).goalProgression.completionRate.value, 0);
});
