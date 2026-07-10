export type VersionSummaryLocale = "zh" | "ja";

export type RawVersionSummarySong = {
  songNo: number;
  songName: string;
  playCount?: number;
  activeDays?: number;
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

export type RawVersionSummary = {
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
