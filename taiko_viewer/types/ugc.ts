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
  firstReportAt: string;
  latestReportAt: string;
  helpfulCount: number;
  reportCount: number;
  tip: {
    tipId: string;
    body: string;
    status: ViewerTipStatus;
    verifiedPlay: boolean;
    author: ChartUgcTip["author"];
    chart: ChartUgcIdentity;
    songTitle: string;
  };
};

export type ChartUgcModerationHistoryItem = {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  reason: string | null;
  operatorDisplayName: string;
  operatorDeleted: boolean;
  createdAt: string;
};

export type UgcOperationsWindow = "24h" | "7d" | "30d" | "all";

export type UgcOperationsOverview = {
  window: UgcOperationsWindow;
  charts: {
    active: number;
    withAnyUgc: number;
    withDifficultyVotes: number;
    withTags: number;
    withTips: number;
  };
  contributions: {
    difficultyVotes: number;
    tagVotes: number;
    activeTips: number;
    deletedTips: number;
    hiddenTips: number;
    helpful: number;
    reportsPending: number;
    reportsResolved: number;
  };
  quality: {
    verifiedDifficultyCount: number;
    verifiedDifficultyRatio: number;
    verifiedTagCount: number;
    verifiedTagRatio: number;
    verifiedTipCount: number;
    verifiedTipRatio: number;
    averageTagsPerContributor: number;
    tipsWithHelpful: number;
    tipsWithReports: number;
  };
  periods: Record<UgcOperationsWindow, {
    difficultyVotes: number;
    tagVotes: number;
    tips: number;
    helpful: number;
    reports: number;
  }>;
  topCharts: Array<{ chartId: string; songId: number; difficultyCode: number; songTitle: string; contributions: number }>;
  difficultyDistribution: Array<{ value: number; count: number }>;
  tagFrequency: Array<{ slug: string; labelKey: string; count: number }>;
};

export type ChartUgcSummary = {
  chart: ChartUgcIdentity;
  difficulty: ChartUgcDifficultyAggregate;
  tags: ChartUgcTagAggregate[];
  availableTags: ChartUgcTagDefinition[];
  tips: ChartUgcTip[];
};

export type CommunityChartActivity = {
  chartId: string;
  songId: number;
  difficulty: ChartDifficultyCode;
  songTitle: string;
  songTitleJp: string;
  cover: string;
  level: number | null;
  difficultySummary: ChartUgcSummaryKind | null;
  participantCount: number;
  tags: Array<{ slug: string; labelKey: string; count: number }>;
  tipPreview: { body: string; helpfulCount: number } | null;
  activityAt: string | null;
  href: string;
};

export type CommunityChartActivityPayload = {
  items: CommunityChartActivity[];
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
