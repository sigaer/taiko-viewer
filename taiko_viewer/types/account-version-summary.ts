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

export type VersionSummaryPoster = {
  title: string;
  subtitle: string;
  favoriteSong: string;
  keyword: string;
  shareCopy: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
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
  keyword: VersionSummaryKeyword | null;
  breakthrough: VersionSummaryBreakthrough;
  poster: VersionSummaryPoster;
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
    keyword: VersionSummaryCopyBlock;
    breakthrough: VersionSummaryCopyBlock;
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
