export type AdminAuthUser = {
  id: number;
  username: string;
  exp: number;
  expiresAt: string;
};

export type AdminAuthPayload = {
  authenticated: boolean;
  user: AdminAuthUser | null;
};

export type AdminMetricSummary = {
  viewerUsers: number;
  taikoBindings: number;
  wahlapBindings: number;
  hirobaBindings: number;
  /** Viewer and Bot identities, deduplicated only by verified identity links. */
  totalUsers: number;
  botUsers: number;
  viewerOnlyUsers: number;
  botOnlyUsers: number;
  linkedUsers: number;
  totalUploads: number;
  uploads24h: number;
  pagePv24h: number;
  pageUv24h: number;
  homePv24h: number;
  botCommands24h: number;
  botCommands24hByPlatform: {
    qqOfficial: number;
    onebotV11: number;
  };
  recentNewUsers: number;
  /** Distinct uploading taikoIds in the last 24 hours. */
  uploaders24h: number;
  /**
   * Daily active users on the current Beijing calendar day: union of active accounts and
   * qualified beacon devices (deduplicated, suspect devices excluded). null before dauSince.
   */
  dauToday: number | null;
  dauYesterday: number | null;
  /** Today's split: distinct accounts vs. devices not attributed to an account. */
  dauLoggedIn: number | null;
  dauAnonymous: number | null;
  /** Same union over the last 7 / 30 Beijing days. */
  wau7d: number | null;
  mau30d: number | null;
  /** Beacon devices marked suspect today (too many devices from one network address). */
  suspectDevicesToday: number | null;
};

export type AdminHourlyTrendItem = {
  bucket: string;
  label: string;
  pv?: number;
  uv?: number;
  homePv?: number;
  count?: number;
};

export type AdminDailyTrendItem = {
  day: string;
  newUsers: number;
  newBindings: number;
  uploads: number;
  /** Distinct taikoIds with at least one upload that day. */
  uploaders: number;
  /** Daily active users (same definition as summary.dauToday); null before dauSince. */
  activeUsers: number | null;
  pv: number;
  uv: number;
  homePv: number;
};

export type AdminDashboardPayload = {
  trafficQuality: {
    windowStart: string;
    windowEnd: string;
    checkedAt: string | null;
    lastLogAt: string | null;
    coverageStart: string | null;
    status: string;
    complete24h: boolean;
    gapAt: string | null;
    backlogBytes: number;
    malformedLines: number;
    rawRequests24h: number;
    suspected24h: number;
    excluded24h: number;
    reasons: Array<{ key: string; label: string; count: number }>;
  };
  summary: AdminMetricSummary;
  trends: {
    accessHourly: AdminHourlyTrendItem[];
    botHourly: AdminHourlyTrendItem[];
    daily: AdminDailyTrendItem[];
  };
  topCommands: Array<{ name: string; count: number }>;
  taikoCommandStatsSince: string | null;
  /** Beacon launch day (first day with web_daily_visitors rows), YYYY-MM-DD. */
  dauSince: string | null;
  backups: Array<{
    name: string;
    path: string;
    category: string;
    createdAt: string;
    size: number;
    manifest: Record<string, unknown> | null;
  }>;
  recentAudits: Array<{
    id: number;
    actorType: string;
    actorId: string;
    actorName: string;
    source: string;
    targetType: string;
    targetKey: string;
    action: string;
    before: unknown;
    after: unknown;
    extra: unknown;
    createdAt: string;
  }>;
};
