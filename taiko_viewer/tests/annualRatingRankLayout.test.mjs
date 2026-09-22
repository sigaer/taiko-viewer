import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

test('RatingRank follows the shared Annual stage-height contract', async () => {
  const scene = await read('components/account/version-summary/AnnualRatingRankScene.vue');
  const rootRule = scene.match(/\.annual-rating-rank-scene\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  const sharedRule = scene.match(/\.annual-rating-rank-scene__paper,\s*\n\.annual-rating-rank-scene__content\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  const contentRule = scene.match(/\.annual-rating-rank-scene__content\s*\{([\s\S]*?)\n\}/g)?.at(-1) || '';

  assert.match(rootRule, /position:\s*relative/);
  assert.match(rootRule, /height:\s*var\(--annual-stage-height,\s*100dvh\)/);
  assert.match(rootRule, /min-height:\s*0/);
  assert.match(rootRule, /overflow:\s*hidden/);
  assert.match(sharedRule, /position:\s*absolute/);
  assert.match(sharedRule, /inset:\s*0/);
  assert.match(sharedRule, /height:\s*100%/);
  assert.match(sharedRule, /min-height:\s*0/);
  assert.match(sharedRule, /box-sizing:\s*border-box/);
  assert.doesNotMatch(contentRule, /position:\s*relative/);
});

test('RatingRank anomaly telemetry is active-only, bounded, and geometry-only', async () => {
  const [player, events] = await Promise.all([
    read('components/account/version-summary/StoryPlayer.vue'),
    read('server/services/annual-beta/events.ts')
  ]);

  assert.match(player, /slides\.value\[activeIndex\.value\]\?\.key !== "ratingRank"/);
  assert.match(player, /!props\.betaTracking/);
  assert.match(player, /beta\.track\("annual_rating_rank_layout_anomaly"/);
  assert.match(player, /window\.visualViewport/);
  assert.match(player, /--annual-stage-height/);
  assert.match(player, /sceneRect\.height - annualStageHeight/);
  assert.match(player, /axisLabelsRect\.bottom > visualRect\.bottom - axisSafeMargin/);
  assert.match(player, /axis_safe_margin:/);
  assert.match(player, /nextSlideTop < stageRect\.bottom - tolerance/);
  assert.match(player, /document\.documentElement\.scrollHeight > window\.innerHeight/);
  assert.match(player, /settleRatingRankLayoutCheck\(\)/);
  assert.match(events, /"annual_rating_rank_layout_anomaly"/);
  assert.match(events, /"ua"/);
  assert.match(events, /LAYOUT_NUMBER_KEYS/);
});

test('RatingRank waterfall reserves an explicit bottom safe area without changing its 19-rank contract', async () => {
  const [scene, chart] = await Promise.all([
    read('components/account/version-summary/AnnualRatingRankScene.vue'),
    read('components/account/version-summary/AnnualRatingWaterfallChart.vue')
  ]);
  assert.match(scene, /<AnnualRatingWaterfallChart/);
  assert.doesNotMatch(scene, /viewBox|createLayerPath|chartLeft|chartRight/);
  assert.match(chart, /const RANK_COUNT = 19/);
  assert.match(chart, /const chartBottom = 1550/);
  assert.match(chart, /const axisY = 1590/);
  assert.match(chart, /const axisBottomSafeArea = 56/);
  assert.match(chart, /:data-axis-safe-area="axisBottomSafeArea"/);
  assert.doesNotMatch(chart, /transform="translate\(0 -55\)"/);
});
