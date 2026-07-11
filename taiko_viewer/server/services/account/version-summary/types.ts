export type VersionSummaryLocale = "zh" | "ja";

export type RawVersionSummarySong = {
  songNo: number;
  songName: string;
  playCount?: number;
  activeDays?: number;
};

export type RawVersionSummaryActivity = {
  favoriteShift: { oldFavorite: RawVersionSummarySong; newFavorite: RawVersionSummarySong } | null;
  monthlyFavorites: Array<{ month: string; playCount: number; estimatedSeconds: number; song: RawVersionSummarySong }>;
  weekdayActivity: { counts: number[]; topWeekday: number; bottomWeekday: number; totalPlays: number } | null;
  calendarActivity: { days: Array<{ date: string; playCount: number }>; maxPlayCount: number; activeDays: number; longestStreak: number; streakStart: string | null; streakEnd: string | null } | null;
  timeOfDay: { periods: Record<string, number>; hourlyCounts: number[]; topPeriod: string; favoriteHour: number; favoriteSong: RawVersionSummarySong | null; totalPlays: number } | null;
  lateNight: { playCount: number; activeDays: number; latestAt: string; song: RawVersionSummarySong } | null;
  milestones: Array<{ type: string; occurredAt: string; level: number | null; song: RawVersionSummarySong }>;
};

export type RawVersionSummaryKeyword = {
  dimensionKey: string;
  titleKey: string;
  score: number;
  radarValues: Record<string, number>;
};

export type RawVersionSummaryBreakthrough = {
  type: string;
  occurredAt: string | null;
  songNo: number | null;
  level: number | null;
  songName: string;
  scoreDelta: number;
  playDelta: number;
};

export type RawVersionSummary = RawVersionSummaryActivity & {
  schemaVersion: number;
  summaryId: string;
  generatedAt: string;
  taikoId: string;
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
  favoriteSong: RawVersionSummarySong | null;
  obsessionSong: RawVersionSummarySong | null;
  keyword: RawVersionSummaryKeyword | null;
  breakthrough: RawVersionSummaryBreakthrough;
  posterCard: {
    playCount: number;
    uniqueSongs: number;
    activeDays: number;
    favoriteSongNo: number | null;
    keywordTitleKey: string;
  };
  flags: {
    newcomer: boolean;
    insufficientData: boolean;
  };
};
