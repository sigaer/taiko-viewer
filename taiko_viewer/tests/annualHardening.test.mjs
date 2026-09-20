import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import {
  ANNUAL_DURABLE_QUEUE_COUNT_LIMIT,
  ANNUAL_DURABLE_QUEUE_WORK_SECONDS,
  classifyAnnualDisk,
  durableQueueWouldAccept,
  estimateAnnualBuildCost,
  simulateAnnualAdmission,
  simulateAnnualQueueArrivals
} from '../server/services/account/annual-summary/hardening.ts';

test('durable admission is bounded by work and count, not a nominal large queue', () => {
  assert.equal(ANNUAL_DURABLE_QUEUE_COUNT_LIMIT, 300);
  assert.equal(ANNUAL_DURABLE_QUEUE_WORK_SECONDS, 270);
  assert.equal(durableQueueWouldAccept({ queuedCount: 299, queuedWorkSeconds: 260, estimatedServiceSeconds: 10 }), true);
  assert.equal(durableQueueWouldAccept({ queuedCount: 300, queuedWorkSeconds: 0, estimatedServiceSeconds: 1 }), false);
  assert.equal(durableQueueWouldAccept({ queuedCount: 10, queuedWorkSeconds: 260, estimatedServiceSeconds: 11 }), false);
});

const populationMix = (count, arrivalWindowSeconds) => {
  const buckets = [
    [0.4543, 0.9], [0.2410, 1.4], [0.1650, 1.7],
    [0.0927, 2.5], [0.0396, 8.7], [0.0074, 30.1]
  ];
  const services = [];
  let target = 0;
  for (const [share, seconds] of buckets) {
    target += Math.round(count * share);
    while (services.length < Math.min(count, target)) services.push(seconds);
  }
  while (services.length < count) services.push(0.9);
  let seed = count * 2654435761 >>> 0;
  for (let index = services.length - 1; index > 0; index -= 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const swap = seed % (index + 1);
    [services[index], services[swap]] = [services[swap], services[index]];
  }
  return services.slice(0, count).map((serviceSeconds, index) => ({
    arrivalSeconds: count === 1 ? 0 : index * arrivalWindowSeconds / (count - 1), serviceSeconds
  }));
};

test('short launch bursts remain finite and shed only beyond the work budget', () => {
  const fifty = simulateAnnualQueueArrivals(populationMix(50, 10));
  const hundred = simulateAnnualQueueArrivals(populationMix(100, 30));
  const twoHundred = simulateAnnualQueueArrivals(populationMix(200, 60));
  assert.equal(fifty.accepted, 50);
  assert.equal(hundred.accepted, 100);
  assert.ok(twoHundred.accepted > 100);
  assert.equal(fifty.expired + hundred.expired + twoHundred.expired, 0);
  console.log(JSON.stringify({ shortBursts: { fifty, hundred, twoHundred } }));
});

test('50/100/200/500 launch fixtures shed excess work explicitly', () => {
  const results = [50, 100, 200, 500].map((count) => simulateAnnualAdmission(Array(count).fill(3)));
  assert.deepEqual(results.map((result) => result.accepted), [50, 90, 90, 90]);
  assert.deepEqual(results.map((result) => result.rejected), [0, 10, 110, 410]);
  const heavy = simulateAnnualAdmission(Array(50).fill(30));
  assert.equal(heavy.accepted, 9);
  assert.equal(heavy.rejected, 41);
});

test('disk governance keeps the 20 GiB emergency floor distinct', () => {
  const gib = 1024 ** 3;
  assert.equal(classifyAnnualDisk(32 * gib), 'NORMAL');
  assert.equal(classifyAnnualDisk(25 * gib), 'LOW');
  assert.equal(classifyAnnualDisk(21 * gib), 'CRITICAL');
  assert.equal(classifyAnnualDisk(19 * gib), 'EMERGENCY');
});

test('service estimate accounts for snapshots and source bytes', async () => {
  const root = await mkdtemp('/var/tmp/annual-hardening-test-');
  try {
    const id = 'fixture';
    await mkdir(`${root}/${id}`);
    await writeFile(`${root}/${id}data.json`, Buffer.alloc(1024));
    for (let index = 0; index < 6; index += 1) {
      await writeFile(`${root}/${id}/data_${index}.json`, Buffer.alloc(1024));
    }
    const estimate = await estimateAnnualBuildCost(root, id);
    assert.equal(estimate.snapshotCount, 6);
    assert.equal(estimate.sourceCount, 7);
    assert.equal(estimate.totalSourceBytes, 7 * 1024);
    assert.equal(estimate.estimatedServiceSeconds, 1.4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
