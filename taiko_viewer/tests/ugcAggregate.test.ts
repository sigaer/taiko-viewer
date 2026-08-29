import assert from "node:assert/strict";
import test from "node:test";
import { aggregateDifficultyVotes, selectCommonTagAggregates } from "../server/services/ugc/aggregate.ts";
import type { ChartDifficultyVoteValue } from "../types/ugc.ts";

const votes = (...values: ChartDifficultyVoteValue[]) => values.map((value, index) => ({ value, verifiedPlay: index % 2 === 0 }));

test("difficulty aggregation covers empty and cold-start samples", () => {
  assert.deepEqual(aggregateDifficultyVotes([]), {
    count: 0,
    verifiedCount: 0,
    distribution: { "-2": 0, "-1": 0, "0": 0, "1": 0, "2": 0 },
    mean: null,
    summary: "insufficient"
  });
  assert.equal(aggregateDifficultyVotes(votes(2)).summary, "insufficient");
  assert.equal(aggregateDifficultyVotes(votes(-1, 1)).summary, "insufficient");
});

test("difficulty aggregation applies dominant and mixed thresholds", () => {
  const dominant = aggregateDifficultyVotes(votes(1, 1, 2, 0));
  assert.equal(dominant.summary, "hard");
  assert.equal(dominant.count, 4);
  assert.equal(dominant.verifiedCount, 2);
  assert.equal(dominant.mean, 1);
  assert.deepEqual(dominant.distribution, { "-2": 0, "-1": 0, "0": 1, "1": 2, "2": 1 });
  assert.equal(aggregateDifficultyVotes(votes(-2, -1, 1, 2)).summary, "mixed");
  assert.equal(aggregateDifficultyVotes(votes(-1, -1, 1, 1)).summary, "mixed");
  assert.equal(aggregateDifficultyVotes(votes(0, 0, 1)).summary, "balanced");
});

test("tag aggregation exposes only common top-six tags with percentages", () => {
  const rows = [
    { slug: "one", labelKey: "one", groupKey: "rhythm", count: 1 },
    ...Array.from({ length: 8 }, (_, index) => ({
      slug: `tag-${index}`,
      labelKey: `tag.${index}`,
      groupKey: "technique",
      count: 9 - index
    }))
  ];
  const result = selectCommonTagAggregates(rows, 10);
  assert.equal(result.length, 6);
  assert.equal(result[0].slug, "tag-0");
  assert.equal(result[0].percentage, 90);
  assert.ok(result.every((tag) => tag.count >= 2));
});
