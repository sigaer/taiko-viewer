export type VersionSummaryAvailableVersion = {
  key: string;
  name: string;
  startDate: string;
  endDate: string | null;
};

export type AnnualMetricStatus = AnnualMetricStatusV4;
export type AnnualDataMode = AnnualDataModeV4;
export type AnnualTimePrecision = AnnualTimePrecisionV4;

export type AnnualSection<T> = {
  status: AnnualMetricStatus;
  data: T | null;
  note?: string | null;
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
  stars?: number | null;
  difficulty?: string | null;
  score?: number | null;
  okCount?: number | null;
  poundCount?: number | null;
};

export type VersionSummaryProfileCard = {
  nickname: string;
  title: string | null;
  titleplateId: number | null;
  danName: string | null;
  danLevel: number | null;
  myDonUrl: string | null;
};

export type VersionSummarySpeedProfile = {
  speed: number;
  chartCount: number;
  eligibleChartCount: number;
};

export type VersionSummaryNearDondaful = {
  song: VersionSummarySongCard;
  okCount: number;
  score: number;
};

export type VersionSummaryChallenge = {
  song: VersionSummarySongCard;
  playCount: number;
  observedPlayCount: number;
  level: number | null;
};

export type VersionSummaryPound = {
  totalPoundCount: number;
  topSong: VersionSummarySongCard | null;
  topPoundCount: number;
  /** Highest hits-per-second when supplied by the summary producer. */
  speed?: number | null;
};

export type VersionSummaryHighScore = {
  song: VersionSummarySongCard;
  score: number;
  occurredAt: string | null;
  happenedLabel: string;
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
  evidence: Array<{
    key: string;
    label: string;
    value: string;
  }>;
};

export type VersionSummaryFinalTitle = {
  title: string;
  eyebrow: string;
  /** 组合文案（Poster closing line 沿用）：evidence｜narrative */
  body: string;
  /** Finale 独立一行显示的证据行（Copy-3B evidence 语义） */
  evidenceText: string;
  /** Finale 独立一行显示的叙事行（Copy-3B body 语义） */
  narrativeBody: string;
  themeKey: string;
  evidenceKey: string;
  evidenceValue: unknown;
  evidenceLabel: string;
  /** V4.1 strongDan overlay is active (current-version standing presentation) */
  standing?: boolean;
  /** Resolved standing bucket identity, e.g. `standing_19_gold_rainbow` */
  standingKey?: string;
  /** `current_version` for the standing overlay */
  standingProvenance?: string;
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
  estimatedSeconds: number;
  estimatedTimeText: string;
  song: VersionSummarySongCard;
};

export type VersionSummaryMilestone = {
  type: string;
  title: string;
  occurredAt: string;
  happenedLabel: string;
  level: number | null;
  song: VersionSummarySongCard;
  playCount: number;
  observedPlayCount: number;
  achievementCount: number;
};

export type VersionSummaryRatingRank = {
  rating: number;
  rank: number;
  rankMin?: number | null;
  rankMax?: number | null;
  sampleSize: number;
  percentile: number;
  tier: string;
  generatedAt: string;
  rankKey?: string | null;
  rankLabel?: string | null;
  distribution?: {
    ratingMin: number;
    ratingMax: number;
    ratingStep: number;
    ranks: Array<{
      key: string;
      label: string;
      order: number;
      colorGroup?: "low" | "mid" | "high";
      bins: Array<{
        ratingMin: number;
        ratingMax: number;
        relative: number;
      }>;
    }>;
  } | null;
};

export type VersionSummaryCopyBlock = {
  eyebrow: string;
  title: string;
  body: string;
};

export type VersionSummaryViewModel = {
  schemaVersion?: 4;
  summaryId: string;
  generatedAt: string;
  mode?: AnnualDataMode;
  user: {
    nickname: string;
  };
  profileCard?: VersionSummaryProfileCard;
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
    // First day this user is observable inside the current reporting window.
    firstObservedDate: string | null;
    // Earliest real play moment the account's own data can prove, independent of
    // the annual observation window. Produced by the upstream generator.
    firstActualPlayDate: string | null;
    firstRecordAt: string | null;
    lastRecordAt: string | null;
    totalDays: number;
    activeDays: number;
  };
  overview: {
    playCount: number;
    uniqueSongs: number;
    uniqueCharts?: number;
    estimatedSeconds: number;
    estimatedTimeText: string;
    currentClearCharts?: number;
    currentFullComboCharts?: number;
    currentDondafulCharts?: number;
    currentKiwamiCharts?: number;
  };
  coverSongs: VersionSummarySongCard[];
  favoriteSong: VersionSummarySongCard | null;
  obsessionSong: VersionSummarySongCard | null;
  favoriteShift: VersionSummaryFavoriteShift | null;
  monthlyFavorites: VersionSummaryMonthlyFavorite[];
  weekdayActivity: { counts: number[]; labels: string[]; topWeekday: number; bottomWeekday: number; topLabel: string; bottomLabel: string; totalPlays: number } | null;
  calendarActivity: { days: Array<{ date: string; playCount: number; intensity: number }>; maxPlayCount: number; activeDays: number; longestStreak: number; streakStart: string | null; streakEnd: string | null; streakLabel: string } | null;
  timeOfDay: { periods: Array<{ key: string; label: string; range: string; playCount: number }>; hourlyCounts: number[]; topPeriod: string; topLabel: string; favoriteHour: number; favoriteHourLabel: string; favoriteSong: VersionSummarySongCard | null; totalPlays: number } | null;
  lateNight: { playCount: number; activeDays: number; latestAt: string; latestLabel: string; song: VersionSummarySongCard } | null;
  milestones: VersionSummaryMilestone[];
  ratingRank: VersionSummaryRatingRank | null;
  speedProfile?: VersionSummarySpeedProfile | null;
  nearDondaful?: VersionSummaryNearDondaful | null;
  challenge?: VersionSummaryChallenge | null;
  pound?: VersionSummaryPound | null;
  highScore?: VersionSummaryHighScore | null;
  keyword: VersionSummaryKeyword | null;
  keywordProfile: VersionSummaryKeyword | null;
  breakthrough: VersionSummaryBreakthrough;
  finalTitle: VersionSummaryFinalTitle;
  poster: VersionSummaryPoster;
  activeShare?: {
    id: string;
    url: string;
    expiresAt: string;
    locale: "zh" | "ja";
    posterUrl?: string | null;
  } | null;
  story: VersionSummaryStory;
  sectionStatus?: Partial<Record<
    | "profile"
    | "period"
    | "overview"
    | "favoriteSong"
    | "obsessionSong"
    | "favoriteShift"
    | "keyword"
    | "ratingRank"
    | "monthlyFavorites"
    | "weekdayActivity"
    | "calendarActivity"
    | "timeOfDay"
    | "lateNight"
    | "speedProfile"
    | "nearDondaful"
    | "challenge"
    | "pound"
    | "highScore"
    | "milestones"
    | "breakthrough"
    | "finalTitle"
    | "poster",
    AnnualMetricStatus
  >>;
  timeCoverage?: {
    status?: AnnualMetricStatus;
    ratio?: number;
    trustedPlayCount?: number;
    totalPlayCount?: number;
    precision?: AnnualTimePrecision;
    note?: string | null;
  };
  copy: {
    opening: {
      eyebrow: string;
      title: string;
      subtitle: string;
    };
    profile: VersionSummaryCopyBlock;
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
    milestones: VersionSummaryCopyBlock;
    keyword: VersionSummaryCopyBlock;
    speedProfile: VersionSummaryCopyBlock;
    nearDondaful: VersionSummaryCopyBlock;
    challenge: VersionSummaryCopyBlock;
    pound: VersionSummaryCopyBlock;
    highScore: VersionSummaryCopyBlock;
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

export type AnnualSummaryV4 = AnnualSummaryV4Generated & {
  copy?: Partial<VersionSummaryViewModel["copy"]>;
  [key: string]: unknown;
};

export type VersionSummaryPayload = {
  availableVersions: VersionSummaryAvailableVersion[];
  selectedVersion: VersionSummaryAvailableVersion;
  currentBinding: VersionSummaryBinding;
  summary: VersionSummaryViewModel | AnnualSummaryV4;
  share?: {
    id: string;
    token?: string;
    url?: string;
    expiresAt: string;
    locale: "zh" | "ja";
    posterUrl?: string | null;
  } | null;
};
import type {
  AnnualDataModeV4,
  AnnualMetricStatusV4,
  AnnualSummaryV4Generated,
  AnnualTimePrecisionV4
} from "./annual-summary-v4.generated";
