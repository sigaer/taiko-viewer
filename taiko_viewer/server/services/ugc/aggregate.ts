import type {
  ChartDifficultyVoteValue,
  ChartUgcDifficultyAggregate,
  ChartUgcSummaryKind,
  ChartUgcTagAggregate
} from "../../../types/ugc";
import {
  UGC_DIFFICULTY_MINIMUM_SAMPLE,
  UGC_DIFFICULTY_STRONG_THRESHOLD,
  UGC_PUBLIC_MAX_TAGS,
  UGC_TAG_COMMON_MINIMUM
} from "./constants.ts";

export type DifficultyVoteInput = { value: ChartDifficultyVoteValue; verifiedPlay: boolean };

const summaryForBucket = (value: ChartDifficultyVoteValue): ChartUgcSummaryKind => {
  if (value < 0) return "easy";
  if (value > 0) return "hard";
  return "balanced";
};

export const aggregateDifficultyVotes = (votes: DifficultyVoteInput[]): ChartUgcDifficultyAggregate => {
  const distribution: ChartUgcDifficultyAggregate["distribution"] = { "-2": 0, "-1": 0, "0": 0, "1": 0, "2": 0 };
  let verifiedCount = 0;
  let sum = 0;
  for (const vote of votes) {
    distribution[String(vote.value) as keyof typeof distribution] += 1;
    if (vote.verifiedPlay) verifiedCount += 1;
    sum += vote.value;
  }
  const count = votes.length;
  let summary: ChartUgcSummaryKind = "insufficient";
  if (count >= UGC_DIFFICULTY_MINIMUM_SAMPLE) {
    const buckets = (Object.entries(distribution) as Array<[`${ChartDifficultyVoteValue}`, number]>).sort(
      ([first], [second]) => Number(first) - Number(second)
    );
    const highest = Math.max(...buckets.map(([, bucketCount]) => bucketCount));
    const dominantBuckets = buckets.filter(([, bucketCount]) => bucketCount === highest);
    const dominant = dominantBuckets[0];
    summary = highest / count >= UGC_DIFFICULTY_STRONG_THRESHOLD && dominantBuckets.length === 1 && dominant
      ? summaryForBucket(Number(dominant[0]) as ChartDifficultyVoteValue)
      : "mixed";
  }
  return {
    count,
    verifiedCount,
    distribution,
    mean: count ? Math.round((sum / count) * 10) / 10 : null,
    summary
  };
};

export type TagAggregateInput = Omit<ChartUgcTagAggregate, "percentage">;

export const selectCommonTagAggregates = (rows: TagAggregateInput[], distinctVoters: number): ChartUgcTagAggregate[] =>
  rows
    .filter((row) => row.count >= UGC_TAG_COMMON_MINIMUM)
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
    .slice(0, UGC_PUBLIC_MAX_TAGS)
    .map((row) => ({
      ...row,
      percentage: distinctVoters > 0 ? Math.round((row.count / distinctVoters) * 1000) / 10 : 0
    }));
