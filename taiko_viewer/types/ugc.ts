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

export type ChartUgcTagDefinition = {
  slug: string;
  labelKey: string;
  groupKey: string;
  sortOrder: number;
};

export type ViewerChartUgcTagSelection = ChartUgcTagDefinition & {
  status: "active" | "deprecated";
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

export type ViewerTipStatus = "active" | "hidden" | "deleted";

export type ChartUgcReportReason = "spam" | "abuse" | "advertising" | "link" | "duplicate" | "other";

export type ChartUgcModerationAction = "hide" | "restore";

export type ChartUgcReportQueueItem = {
  reportId: string;
  reason: ChartUgcReportReason;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  reportCount: number;
  tip: {
    tipId: string;
    body: string;
    status: ViewerTipStatus;
    author: ChartUgcTip["author"];
    chart: ChartUgcIdentity;
  };
};

export type ChartUgcSummary = {
  chart: ChartUgcIdentity;
  difficulty: ChartUgcDifficultyAggregate;
  tags: ChartUgcTagAggregate[];
  availableTags: ChartUgcTagDefinition[];
  tips: ChartUgcTip[];
};

export type ViewerChartUgcState = {
  chart: ChartUgcIdentity;
  difficultyVote: ChartDifficultyVoteValue | null;
  tagSlugs: string[];
  tagSelections: ViewerChartUgcTagSelection[];
  tip: {
    tipId: string;
    body: string;
    status: ViewerTipStatus;
  } | null;
  helpfulTipIds: string[];
};
