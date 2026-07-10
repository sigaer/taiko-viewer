export type VersionSummaryLocale = "zh" | "ja";

export type RawVersionSummarySong = {
  songNo: number;
  songName: string;
  playCount?: number;
  activeDays?: number;
};

export type RawVersionSummaryActivity = {
  favoriteShift: { oldFavorite: RawVersionSummarySong; newFavorite: RawVersionSummarySong } | null;
  monthlyFavorites: Array<{ month: string; playCount: number; song: RawVersionSummarySong }>;
  weekdayActivity: { counts: number[]; topWeekday: number; totalPlays: number } | null;
  calendarActivity: { days: Array<{ date: string; playCount: number }>; maxPlayCount: number } | null;
  timeOfDay: { periods: Record<string, number>; topPeriod: string; totalPlays: number } | null;
  lateNight: { playCount: number; latestAt: string; song: RawVersionSummarySong } | null;
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
