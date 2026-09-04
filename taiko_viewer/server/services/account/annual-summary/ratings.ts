import { getAnnualRatingDistribution } from "./runtime";
import type { AnnualSummaryV4 } from "./types";

const ratingTier = (topPercent: number) => {
  if (topPercent <= 1) return "top1";
  if (topPercent <= 5) return "top5";
  if (topPercent <= 20) return "top20";
  if (topPercent <= 50) return "top50";
  return "growing";
};

const profileField = (summary: AnnualSummaryV4, key: string) => {
  const profile = (summary.profileCard || {}) as Record<string, unknown>;
  return profile[key];
};

const resolvePlayerRank = (summary: AnnualSummaryV4) => {
  const danMax = Math.floor(Number(profileField(summary, "danMax") || 0));
  if (danMax >= 1 && danMax <= 19) {
    return {
      rankKey: `grade_${danMax}`,
      rankLabel: String(profileField(summary, "danName") || `grade_${danMax}`)
    };
  }
  return { rankKey: null, rankLabel: null };
};

export const enrichAnnualRatingRank = async (summary: AnnualSummaryV4): Promise<AnnualSummaryV4> => {
  const original = summary.sections.ratingRank || { status: "unavailable", data: null };
  const originalData =
    original.data && typeof original.data === "object" ? (original.data as Record<string, unknown>) : null;
  const rating = Number(originalData?.rating || 0);
  if (!Number.isFinite(rating) || rating <= 0) return summary;

  const distribution = await getAnnualRatingDistribution();
  const sampleSize = distribution?.ratings.length || 0;
  if (!distribution || sampleSize < 20) {
    return {
      ...summary,
      sections: {
        ...summary.sections,
        ratingRank: {
          status: "unavailable",
          data: null,
          reason: "insufficient_site_sample"
        }
      }
    };
  }

  const rounded = Number(rating.toFixed(4));
  const higher = distribution.ratings.filter((value) => value > rounded).length;
  const tied = distribution.ratings.filter((value) => value === rounded).length;
  const rankMin = higher + 1;
  const rankMax = higher + Math.max(1, tied);
  const midRank = Number(((rankMin + rankMax) / 2).toFixed(1));
  const topPercent = Number(((midRank / sampleSize) * 100).toFixed(2));
  const percentile = Number(Math.max(0, 100 - topPercent).toFixed(2));
  const { rankKey, rankLabel } = resolvePlayerRank(summary);

  return {
    ...summary,
    sections: {
      ...summary.sections,
      ratingRank: {
        status: "exact",
        data: {
          ...originalData,
          rating: rounded,
          rank: midRank,
          rankMin,
          rankMax,
          midRank,
          sampleSize,
          percentile,
          topPercent,
          tier: ratingTier(topPercent),
          rankKey,
          rankLabel,
          distribution: distribution.distribution || null,
          asOf: distribution.generatedAt
        }
      }
    }
  };
};
