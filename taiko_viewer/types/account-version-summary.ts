export type VersionSummaryAvailableVersion = {
  key: string;
  name: string;
  startDate: string;
  endDate: string | null;
};

export type VersionSummaryBinding = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  currentTitle?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VersionSummarySongCard = {
  songNo: number;
  name: string;
  subtitle: string;
  coverUrl: string;
  playCount?: number;
  activeDays?: number;
  level?: number | null;
};

export type VersionSummaryKeyword = {
  dimensionKey: string;
  dimensionLabel: string;
  titleKey: string;
  title: string;
  score: number;
  radarValues: Record<string, number>;
  body: string;
  rating?: number;
};

export type VersionSummaryBreakthrough = {
  type: string;
  occurredAt: string | null;
  song: VersionSummarySongCard | null;
  scoreDelta: number;
  playDelta: number;
  title: string;
  body: string;
  happenedLabel: string;
};

export type VersionSummaryFinalTitle = {
  title: string;
  eyebrow: string;
  body: string;
  themeKey: string;
};

export type VersionSummaryPoster = {
  title: string;
  subtitle: string;
  finalTitle: string;
  periodLabel: string;
  favoriteSong: string;
  keyword: string;
  closingLine: string;
  shareCopy: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
};

export type VersionSummaryStory = {
  pageCount: number;
  pageKeys: string[];
};

export type VersionSummaryFavoriteShift = {
  oldFavorite: VersionSummarySongCard;
  newFavorite: VersionSummarySongCard;
};

export type VersionSummaryMonthlyFavorite = {
  month: string;
  monthLabel: string;
  playCount: number;
  song: VersionSummarySongCard;
};

export type VersionSummaryRatingRank = {
  rating: number;
  rank: number;
  sampleSize: number;
  percentile: number;
  tier: string;
  generatedAt: string;
};

export type VersionSummaryCopyBlock = {
  eyebrow: string;
  title: string;
  body: string;
};

export type VersionSummaryViewModel = {
  summaryId: string;
  generatedAt: string;
  user: {
    nickname: string;
  };
  version: {
    key: string;
    name: string;
    startDate: string;
    endDate: string | null;
    effectiveEndDate: string;
    isOngoing: boolean;
  };
  coverage: {
    snapshotCount: number;
    firstSnapshotAt: string | null;
    lastSnapshotAt: string | null;
    partialStart: boolean;
  };
  period: {
    firstRecordAt: string | null;
    lastRecordAt: string | null;
    totalDays: number;
    activeDays: number;
  };
  overview: {
    playCount: number;
    uniqueSongs: number;
    estimatedSeconds: number;
    estimatedTimeText: string;
  };
  favoriteSong: VersionSummarySongCard | null;
  obsessionSong: VersionSummarySongCard | null;
  favoriteShift: VersionSummaryFavoriteShift | null;
  monthlyFavorites: VersionSummaryMonthlyFavorite[];
  weekdayActivity: { counts: number[]; labels: string[]; topWeekday: number; topLabel: string; totalPlays: number } | null;
  calendarActivity: { days: Array<{ date: string; playCount: number; intensity: number }>; maxPlayCount: number } | null;
  timeOfDay: { periods: Array<{ key: string; label: string; playCount: number }>; topPeriod: string; topLabel: string; totalPlays: number } | null;
  lateNight: { playCount: number; latestAt: string; latestLabel: string; song: VersionSummarySongCard } | null;
  ratingRank: VersionSummaryRatingRank | null;
  keyword: VersionSummaryKeyword | null;
  keywordProfile: VersionSummaryKeyword | null;
  breakthrough: VersionSummaryBreakthrough;
  finalTitle: VersionSummaryFinalTitle;
  poster: VersionSummaryPoster;
  story: VersionSummaryStory;
  copy: {
    opening: {
      eyebrow: string;
      title: string;
      subtitle: string;
    };
    period: VersionSummaryCopyBlock;
    overview: VersionSummaryCopyBlock;
    favoriteSong: VersionSummaryCopyBlock;
    obsessionSong: VersionSummaryCopyBlock;
    favoriteShift: VersionSummaryCopyBlock;
    monthlyFavorites: VersionSummaryCopyBlock;
    weekdayActivity: VersionSummaryCopyBlock;
    calendarActivity: VersionSummaryCopyBlock;
    timeOfDay: VersionSummaryCopyBlock;
    lateNight: VersionSummaryCopyBlock;
    ratingRank: VersionSummaryCopyBlock;
    keyword: VersionSummaryCopyBlock;
    breakthrough: VersionSummaryCopyBlock;
    finalTitle: VersionSummaryCopyBlock;
    poster: {
      eyebrow: string;
      title: string;
      subtitle: string;
    };
    controls: {
      versionLabel: string;
      bindingLabel: string;
      refresh: string;
    };
  };
  flags: {
    newcomer: boolean;
    insufficientData: boolean;
  };
};

export type VersionSummaryPayload = {
  availableVersions: VersionSummaryAvailableVersion[];
  selectedVersion: VersionSummaryAvailableVersion;
  currentBinding: VersionSummaryBinding;
  summary: VersionSummaryViewModel;
};
