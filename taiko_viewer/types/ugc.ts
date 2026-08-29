export type ChartDifficultyCode = 1 | 2 | 3 | 4 | 5;
export type ChartDifficultyVoteValue = -2 | -1 | 0 | 1 | 2;
export type ChartUgcSummaryKind = "insufficient" | "mixed" | "easy" | "balanced" | "hard";
export type ChartUgcStatus = "active" | "inactive";

export type ChartUgcIdentity = {
  chartId: string;
  songId: number;
  difficultyCode: ChartDifficultyCode;
};

export type ChartUgcDifficultyAggregate = {
  count: number;
  verifiedCount: number;
  distribution: Record<"-2" | "-1" | "0" | "1" | "2", number>;
  mean: number | null;
  summary: ChartUgcSummaryKind;
};

export type ChartUgcTagAggregate = {
  slug: string;
  labelKey: string;
  groupKey: string;
  count: number;
  percentage: number;
};

export type ChartUgcTip = {
  tipId: string;
  body: string;
  helpfulCount: number;
  verifiedPlay: boolean;
  author: {
    displayName: string;
    avatarUrl: string;
    isDeleted: boolean;
  };
  createdAt: string;
};

export type ChartUgcSummary = {
  chart: ChartUgcIdentity;
  difficulty: ChartUgcDifficultyAggregate;
  tags: ChartUgcTagAggregate[];
  tips: ChartUgcTip[];
};

export type ViewerChartUgcState = {
  difficultyVote: ChartDifficultyVoteValue | null;
  tagSlugs: string[];
  tip: {
    tipId: string;
    body: string;
    status: "active" | "hidden" | "deleted";
  } | null;
  helpfulTipIds: string[];
};
